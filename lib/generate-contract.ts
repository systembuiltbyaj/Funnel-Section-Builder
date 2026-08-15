/**
 * What `POST /api/generate-section` will accept.
 *
 * The client sends a section *reference* and the client's own copy — never
 * prompt text. The server rebuilds the prompt from the catalogue. That is the
 * structural abuse control: with no prompt in the request body, the endpoint
 * cannot be farmed as a general-purpose LLM proxy no matter what is posted to
 * it. Keep it that way.
 *
 * Everything here is untrusted network input, so this mirrors the defensive
 * posture of `validatePersisted` in lib/funnel-selection.ts — own-property
 * reads only, so a `__proto__` key in the JSON body is inert data.
 */

import type { FunnelBrandKit } from "./prompt-assembly.ts";
import type { CatalogueShape } from "./funnel-selection.ts";

/** One section's copy. Comfortably above any real section, far below a book. */
export const COPY_MAX = 6_000;
/** Brand-kit fields are colours and font names, never prose. */
export const KIT_FIELD_MAX = 120;

export type GenerateRequest = {
  groupId: string;
  variation: string;
  copy: string;
  kit: FunnelBrandKit;
};

export type ValidationResult =
  | { ok: true; value: GenerateRequest }
  | { ok: false; code: "invalid_selection" | "input_too_large"; message: string };

const KIT_FIELDS = ["primary", "background", "fontHead", "fontSub", "fontBody", "images"] as const;

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

export function validateGenerateRequest(raw: unknown, catalogue: CatalogueShape): ValidationResult {
  const groupId = str(own(raw, "groupId"));
  const variation = str(own(raw, "variation"));
  const copy = str(own(raw, "copy"));

  if (!groupId || !Object.prototype.hasOwnProperty.call(catalogue, groupId)) {
    return { ok: false, code: "invalid_selection", message: "Unknown section." };
  }
  const valid = catalogue[groupId];
  if (!Array.isArray(valid) || !valid.includes(variation)) {
    return { ok: false, code: "invalid_selection", message: "Unknown variation for that section." };
  }
  if (copy.length > COPY_MAX) {
    return { ok: false, code: "input_too_large", message: `Copy exceeds ${COPY_MAX} characters.` };
  }

  const rawKit = own(raw, "kit");
  const kit = {} as FunnelBrandKit;
  for (const field of KIT_FIELDS) {
    const value = str(own(rawKit, field));
    if (value.length > KIT_FIELD_MAX) {
      return {
        ok: false,
        code: "input_too_large",
        message: `Brand kit field "${field}" is too long.`,
      };
    }
    kit[field] = value;
  }

  return { ok: true, value: { groupId, variation, copy, kit } };
}
