import { NextRequest } from "next/server";
import { CATALOGUE } from "@/lib/catalogue";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import {
  validateAnalyzeRequest,
  buildAnalyzerCatalogue,
  normalizeAnalysis,
} from "@/lib/analyze-contract";
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzePrompt } from "@/lib/analyze-prompt";
import {
  pickProvider,
  buildProviderRequest,
  parseProviderReply,
  parseRetryAfterSeconds,
  isTokenRateLimit,
} from "@/lib/generation-provider";

/**
 * Recommend a section variation per 10P section for a pasted page.
 *
 * The abuse control is structural, exactly as on /api/generate-section: the
 * body carries only the pasted page. The catalogue is rebuilt server-side, so
 * whatever is posted, the reply can only ever be section ids that exist plus a
 * short reason each. It cannot be farmed as a general-purpose LLM proxy.
 *
 * This is the cheapest model call in the app — the reply is one line per
 * section, never the page's copy — so it is well inside the free tier the
 * default provider runs on. Spend is otherwise bounded by the input caps in
 * `validateAnalyzeRequest` and, on a paid provider, the hard monthly budget set
 * in that provider's console. With no accounts there is no reliable per-user
 * limit, so that cap is the real backstop.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 45_000;

/**
 * The analyser's own output ceiling, far below generation's.
 *
 * The reply is one short line per section — a dozen at most. Groq counts
 * `max_tokens` against the per-minute budget as part of the request, so
 * inheriting generation's 6,000 ceiling made every call ask for ~10.5k tokens
 * against a free-tier limit of 8k and get refused outright. Measured: a real
 * 12-section reply lands under 400 tokens.
 */
const ANALYZE_MAX_OUTPUT_TOKENS = 1_200;

function fail(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

export async function POST(req: NextRequest) {
  // Cheap same-origin check. Not a security boundary on its own — it stops a
  // page on another site calling this from a browser, nothing more.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return fail("forbidden", "Cross-origin requests are not accepted.", 403);
  }

  const provider = pickProvider(process.env);
  if (!provider) {
    return fail(
      "not_configured",
      "Analysis is not configured on this deployment. Pick your sections manually.",
      503
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_input", "Malformed request body.", 400);
  }

  const parsed = validateAnalyzeRequest(raw);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.message, parsed.code === "input_too_large" ? 413 : 400);
  }

  const prompt = buildAnalyzePrompt({
    copy: parsed.value.copy,
    catalogue: buildAnalyzerCatalogue(PROMPT_GROUPS),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let reply: string;
  try {
    // Near-deterministic and JSON-shaped: this is classification, not design.
    const request = buildProviderRequest(
      provider,
      { system: ANALYZE_SYSTEM_PROMPT, prompt },
      { temperature: 0.2, json: true, maxOutputTokens: ANALYZE_MAX_OUTPUT_TOKENS }
    );
    const res = await fetch(request.url, {
      method: "POST",
      signal: controller.signal,
      headers: request.headers,
      body: request.body,
    });

    // Read the body before branching: Groq reports a token rate limit as a 413
    // with a rate_limit_exceeded code, not only as a 429, and telling the two
    // apart needs the body.
    if (!res.ok) {
      const body = await res.text();
      if (isTokenRateLimit(res.status, body)) {
        const retryAfterSec = parseRetryAfterSeconds((name) => res.headers.get(name));
        return Response.json(
          {
            code: "rate_limited",
            message: `Rate limited — try again in ${retryAfterSec}s.`,
            retryAfterSec,
          },
          { status: 429 }
        );
      }
      return fail("upstream_error", "The analyser is unavailable.", 502);
    }

    reply = parseProviderReply(provider.provider, await res.json());
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return fail(
      "upstream_error",
      aborted ? "The analyser took too long." : "Could not reach the analyser.",
      502
    );
  } finally {
    clearTimeout(timer);
  }

  // The model is told to return bare JSON, but a stray fence or preamble is a
  // known failure mode — recover the object rather than failing the run.
  let parsedReply: unknown;
  try {
    parsedReply = JSON.parse(reply);
  } catch {
    const start = reply.indexOf("{");
    const end = reply.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return fail("analysis_failed", "The analyser returned an unreadable result. Try again.", 502);
    }
    try {
      parsedReply = JSON.parse(reply.slice(start, end + 1));
    } catch {
      return fail("analysis_failed", "The analyser returned an unreadable result. Try again.", 502);
    }
  }

  const analysis = normalizeAnalysis(parsedReply, CATALOGUE);
  if (analysis.sections.length === 0) {
    return fail(
      "analysis_failed",
      "No 10P sections were recognised in that page. Pick your sections manually.",
      422
    );
  }

  return Response.json(analysis);
}
