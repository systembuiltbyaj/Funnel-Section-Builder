/**
 * What `POST /api/funnel-analyze` accepts, and what it will believe back.
 *
 * The request body carries ONLY the pasted page. The catalogue the model
 * chooses from is built here, server-side, from PROMPT_GROUPS — it is never
 * accepted from the caller. That is the same structural control that shapes
 * /api/generate-section: with neither prompt text nor a caller-supplied
 * catalogue in the body, this endpoint can only ever answer with section ids
 * that already exist, so it cannot be farmed as a general-purpose LLM proxy.
 *
 * The deleted 2026-08 version of this route DID take `catalog` from the body,
 * which — combined with free-form `copy` — was close to an arbitrary prompt
 * channel. Do not reintroduce it.
 *
 * Everything here is untrusted input, so it mirrors the defensive posture of
 * `validatePersisted`: own-property reads only, so a `__proto__` key is inert.
 */

import type { CatalogueShape } from "./funnel-selection.ts";

/**
 * Default paste cap, used when no provider-derived cap is supplied.
 *
 * This is the free-tier figure. The real cap belongs to the provider — see
 * `analyzeCopyMax` on `ProviderConfig` — because it is set by the per-minute
 * token budget rather than by anything about the page.
 */
export const ANALYZE_COPY_MAX = 9_000;
/** Below this there is nothing to classify, and it is almost certainly a probe. */
export const ANALYZE_COPY_MIN = 40;

const REASON_MAX = 160;
/** One section's excerpt. Enough to recognise the section, far below a page. */
export const SECTION_COPY_MAX = 600;
const META_MAX = 200;
const DESCRIPTION_MAX = 60;

export type AnalyzeRequest = { copy: string };

export type AnalyzeValidation =
  | { ok: true; value: AnalyzeRequest }
  | { ok: false; code: "invalid_input" | "input_too_large"; message: string };

/**
 * The shape PROMPT_GROUPS already satisfies. Declared structurally so this
 * module does not depend on the full Section type.
 */
export type CatalogueSourceGroup = {
  id: string;
  label: string;
  variations: readonly { number: string; description: string; funnelTypes?: string[] }[];
};

/** One group as the model sees it — deliberately tiny, since it goes in the prompt. */
export type AnalyzerCatalogueGroup = {
  id: string;
  label: string;
  variations: { number: string; description: string; funnelTypes: string }[];
};

export type AnalyzedSection = {
  sectionId: string;
  recommendedVariation: string;
  reason: string;
  /**
   * The slice of the pasted page this section is built from.
   *
   * For display beside the layout preview ONLY — it is never persisted, never
   * assembled into a prompt, and never sent to `/api/generate-section`. The
   * tool is still a layout picker; this exists so a preview shows the client's
   * own words next to the wireframe instead of a stranger's demo content.
   *
   * Capped hard: excerpts are output tokens, and the old analyzer's unbounded
   * 6,000-character-per-section copy is what made its replies large enough to
   * trip a per-minute token limit on every real funnel.
   */
  copy: string;
};

export type Analysis = {
  niche: string;
  vibe: string;
  sections: AnalyzedSection[];
};

/** Own-property read, so an inherited or `__proto__` key never resolves. */
function own(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key)
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function validateAnalyzeRequest(
  raw: unknown,
  maxChars: number = ANALYZE_COPY_MAX
): AnalyzeValidation {
  const copy = str(own(raw, "copy")).trim();

  if (copy.length > maxChars) {
    return {
      ok: false,
      code: "input_too_large",
      message: `Paste is longer than ${maxChars.toLocaleString()} characters. Trim it and try again.`,
    };
  }
  if (copy.length < ANALYZE_COPY_MIN) {
    return {
      ok: false,
      code: "invalid_input",
      message: `Paste more of the page to analyse (at least ${ANALYZE_COPY_MIN} characters).`,
    };
  }

  // Only `copy` is returned. Any other field in the body — notably `catalog` —
  // is dropped here and never reaches the prompt.
  return { ok: true, value: { copy } };
}

export function buildAnalyzerCatalogue(
  groups: readonly CatalogueSourceGroup[]
): AnalyzerCatalogueGroup[] {
  return groups.map((g) => ({
    id: g.id,
    label: g.label,
    variations: g.variations.map((v) => ({
      number: v.number,
      description: v.description.slice(0, DESCRIPTION_MAX),
      funnelTypes: (v.funnelTypes ?? []).join("/"),
    })),
  }));
}

/**
 * Turn the model's reply into something safe to act on.
 *
 * Every `sectionId` is checked against the live catalogue and every
 * `recommendedVariation` against that section's own numbers. An unchecked id
 * would reach the builder and silently resolve to whichever variation happened
 * to be first — a wrong pick presented as a confident one.
 */
export function normalizeAnalysis(raw: unknown, catalogue: CatalogueShape): Analysis {
  const rawSections = own(raw, "sections");
  const sections: AnalyzedSection[] = [];
  const seen = new Set<string>();

  if (Array.isArray(rawSections)) {
    for (const entry of rawSections) {
      const sectionId = str(own(entry, "sectionId"));
      // Array.isArray, not truthiness: catalogue["__proto__"] returns
      // Object.prototype, which is truthy but not a section.
      const valid = Object.prototype.hasOwnProperty.call(catalogue, sectionId)
        ? catalogue[sectionId]
        : undefined;
      if (!Array.isArray(valid) || valid.length === 0) continue;
      if (seen.has(sectionId)) continue;
      seen.add(sectionId);

      const recommended = str(own(entry, "recommendedVariation"));
      sections.push({
        sectionId,
        recommendedVariation: valid.includes(recommended) ? recommended : valid[0],
        reason: str(own(entry, "reason")).slice(0, REASON_MAX),
        copy: str(own(entry, "copy")).trim().slice(0, SECTION_COPY_MAX),
      });
    }
  }

  return {
    niche: str(own(raw, "niche")).slice(0, META_MAX),
    vibe: str(own(raw, "vibe")).slice(0, META_MAX),
    sections,
  };
}
