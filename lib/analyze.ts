import { PROMPT_GROUPS } from "./prompt-groups.ts";
import type { BuilderSelection } from "./prompt-assembly.ts";

export type AnalysisMeta = { niche: string; vibe: string };

export type AnalysisResult = {
  sel: Record<string, BuilderSelection>;
  reasons: Record<string, string>;
  meta: AnalysisMeta;
};

type ApiSection = {
  sectionId: string;
  recommendedVariation: string;
  reason: string;
  copy: string;
};

/** Every group switched off, defaulting to its first variation. */
function blankSelections(): Record<string, BuilderSelection> {
  return Object.fromEntries(
    PROMPT_GROUPS.map((g) => [
      g.id,
      { enabled: false, variation: g.variations[0].number, copy: "" },
    ])
  );
}

/**
 * Send a client's funnel copy to the analyzer and turn its answer into a
 * selection set.
 *
 * The model's `recommendedVariation` is checked against the live catalogue
 * before use: an unknown number would otherwise fall through to the builder
 * and silently resolve to whichever variation happened to be first.
 */
export async function analyzeFunnelCopy(copy: string): Promise<AnalysisResult> {
  const catalog = PROMPT_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    variations: g.variations.map((v) => ({
      number: v.number,
      title: v.title,
      description: v.description,
      funnelTypes: v.funnelTypes ?? [],
    })),
  }));

  const res = await fetch("/api/funnel-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ copy, catalog }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Analysis failed.");

  const sel = blankSelections();
  const reasons: Record<string, string> = {};

  for (const s of (data.sections || []) as ApiSection[]) {
    if (!sel[s.sectionId]) continue;
    const group = PROMPT_GROUPS.find((g) => g.id === s.sectionId);
    const known = group?.variations.some((v) => v.number === s.recommendedVariation);
    const variation = known
      ? s.recommendedVariation
      : group?.variations[0].number ?? sel[s.sectionId].variation;
    sel[s.sectionId] = { enabled: true, variation, copy: s.copy || "" };
    reasons[s.sectionId] = s.reason || "";
  }

  return { sel, reasons, meta: { niche: data.niche || "", vibe: data.vibe || "" } };
}
