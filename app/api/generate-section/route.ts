import { NextRequest } from "next/server";
import { CATALOGUE } from "@/lib/catalogue";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { validateGenerateRequest } from "@/lib/generate-contract";
import { buildTokenBlock } from "@/lib/design-tokens";
import { buildSectionGenerationPrompt, SYSTEM_PROMPT } from "@/lib/section-generation-prompt";
import { extractSectionFragment } from "@/lib/html-extract";
import {
  pickProvider,
  buildProviderRequest,
  parseProviderReply,
  parseRetryAfterSeconds,
} from "@/lib/generation-provider";

/**
 * Generate the HTML for ONE section.
 *
 * Per-section rather than per-funnel because Vercel Hobby caps a function at
 * 60s, which a whole multi-section page cannot fit. The client calls this once
 * per selected section and stitches the results with `stitchFunnel()`.
 *
 * The abuse control here is structural, not a rate limit: the request body
 * carries a section *reference* and a brand kit — never prompt text, and no
 * client prose at all. The prompt is rebuilt server-side from the catalogue, so
 * no matter what is posted this endpoint can only ever produce one of the
 * catalogue's sections. It cannot be farmed as a general-purpose LLM proxy.
 *
 * Spend is bounded by: the provider's own output ceiling, the input caps in
 * `validateGenerateRequest`, and — when running on a paid provider — a hard
 * monthly budget set in that provider's console. With no accounts there is no
 * reliable per-user limit, so that cap is the real backstop. The default
 * provider (Groq) is free-tier, where the equivalent limit is its own rate
 * limiting rather than a bill.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 52_000;

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

  // Groq by default: free, and ~5x faster, which is what makes a section fit
  // inside the 60s function ceiling. See lib/generation-provider.ts.
  const provider = pickProvider(process.env);
  if (!provider) {
    return fail(
      "not_configured",
      "Generation is not configured on this deployment. Copy the prompt instead.",
      503
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_selection", "Malformed request body.", 400);
  }

  const parsed = validateGenerateRequest(raw, CATALOGUE);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.message, parsed.code === "input_too_large" ? 413 : 400);
  }
  const { groupId, variation: variationNumber, kit } = parsed.value;

  // Validation already proved these exist; this is the lookup, not a check.
  const group = PROMPT_GROUPS.find((g) => g.id === groupId);
  const variation = group?.variations.find((v) => v.number === variationNumber);
  if (!variation) {
    return fail("invalid_selection", "Unknown section.", 400);
  }

  const tokenBlock = buildTokenBlock(kit);
  const prompt = buildSectionGenerationPrompt({ variation, tokenBlock });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let reply: string;
  try {
    const request = buildProviderRequest(provider, {
      system: SYSTEM_PROMPT,
      prompt,
    });
    const res = await fetch(request.url, {
      method: "POST",
      signal: controller.signal,
      headers: request.headers,
      body: request.body,
    });

    // A rate limit is not an error the user caused, and it is recoverable —
    // it gets its own code and a wait, so the client can pause and retry
    // rather than marking the section failed. The free tier is capped on
    // tokens per minute, so a multi-section funnel WILL hit this.
    if (res.status === 429) {
      const retryAfterSec = parseRetryAfterSeconds((name) => res.headers.get(name));
      return Response.json(
        {
          code: "rate_limited",
          message: `Rate limited — retrying in ${retryAfterSec}s.`,
          retryAfterSec,
        },
        { status: 429 }
      );
    }

    if (!res.ok) {
      // Surface the class of failure without leaking the provider's body.
      const hint =
        res.status === 400
          ? "The generator rejected this section."
          : "The generator is unavailable.";
      return fail("upstream_error", hint, 502);
    }

    reply = parseProviderReply(provider.provider, await res.json());
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return fail(
      "upstream_error",
      aborted ? "The generator took too long for this section." : "Could not reach the generator.",
      502
    );
  } finally {
    clearTimeout(timer);
  }

  const { html, truncated, salvagedFromDocument } = extractSectionFragment(reply);
  if (truncated) {
    return fail(
      "generation_failed",
      "The section came back incomplete. Retry it, or copy the prompt instead.",
      502
    );
  }

  return Response.json({
    groupId,
    variation: variationNumber,
    html,
    salvagedFromDocument,
    bytes: html.length,
  });
}
