/**
 * Client half of the analyzer.
 *
 * Kept out of the component so the fetch shape and the error taxonomy live in
 * one place, next to the contract they mirror.
 */

import type { Analysis } from "./analyze-contract.ts";

/** A failure the panel can render. `retryAfterSec` is set only for rate limits. */
export class AnalyzeFailure extends Error {
  readonly retryAfterSec: number | null;
  constructor(message: string, retryAfterSec: number | null = null) {
    super(message);
    this.name = "AnalyzeFailure";
    this.retryAfterSec = retryAfterSec;
  }
}

export async function analyzeFunnelCopy(copy: string): Promise<Analysis> {
  const res = await fetch("/api/funnel-analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ copy }),
  });

  const data = (await res.json().catch(() => null)) as
    | (Partial<Analysis> & { code?: string; message?: string; retryAfterSec?: number })
    | null;

  if (res.status === 429) {
    throw new AnalyzeFailure(
      data?.message ?? "Rate limited. Try again shortly.",
      typeof data?.retryAfterSec === "number" ? data.retryAfterSec : 15
    );
  }
  if (!res.ok || !Array.isArray(data?.sections)) {
    throw new AnalyzeFailure(data?.message ?? "Analysis failed. Try again.");
  }

  return {
    niche: typeof data.niche === "string" ? data.niche : "",
    vibe: typeof data.vibe === "string" ? data.vibe : "",
    sections: data.sections,
  };
}
