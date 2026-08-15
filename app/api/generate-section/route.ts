import { NextRequest } from "next/server";
import { CATALOGUE } from "@/lib/catalogue";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { validateGenerateRequest } from "@/lib/generate-contract";
import { buildTokenBlock } from "@/lib/design-tokens";
import { buildSectionGenerationPrompt, SYSTEM_PROMPT } from "@/lib/section-generation-prompt";
import { extractSectionFragment } from "@/lib/html-extract";

/**
 * Generate the HTML for ONE section.
 *
 * Per-section rather than per-funnel because Vercel Hobby caps a function at
 * 60s, which a whole multi-section page cannot fit. The client calls this once
 * per selected section and stitches the results with `stitchFunnel()`.
 *
 * The abuse control here is structural, not a rate limit: the request body
 * carries a section *reference* and the client's copy — never prompt text. The
 * prompt is rebuilt server-side from the catalogue, so no matter what is posted
 * this endpoint can only ever produce one of the catalogue's sections. It
 * cannot be farmed as a general-purpose LLM proxy.
 *
 * Spend is bounded by: the output ceiling below, the input caps in
 * `validateGenerateRequest`, and a hard monthly budget set in the Anthropic
 * console — which is the real backstop, since there are no accounts and so no
 * reliable per-user limit.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
/** A section is a few thousand tokens of HTML; this is headroom, not a target. */
const MAX_OUTPUT_TOKENS = 6_000;
/** Leaves room to still return a JSON error inside the 60s function budget. */
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
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
  const { groupId, variation: variationNumber, copy, kit } = parsed.value;

  // Validation already proved these exist; this is the lookup, not a check.
  const group = PROMPT_GROUPS.find((g) => g.id === groupId);
  const variation = group?.variations.find((v) => v.number === variationNumber);
  if (!variation) {
    return fail("invalid_selection", "Unknown section.", 400);
  }

  const tokenBlock = buildTokenBlock(kit);
  const prompt = buildSectionGenerationPrompt({ variation, copy, tokenBlock });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let reply: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      // Surface the class of failure without leaking the provider's body.
      const hint =
        res.status === 429
          ? "The generator is rate limited right now."
          : res.status === 400
            ? "The generator rejected this section."
            : "The generator is unavailable.";
      return fail("upstream_error", hint, 502);
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    reply = (data.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
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
