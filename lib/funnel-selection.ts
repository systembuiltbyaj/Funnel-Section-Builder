// Pure selection-state logic — no JSX, no React import. Node's type stripping
// (`--experimental-strip-types`) cannot load .tsx, so anything the test file
// imports has to live here; lib/funnel-selection.tsx re-exports the React parts.

import type { FunnelBrandKit, BuilderSelection } from "./prompt-assembly.ts";

/** Bumped whenever PersistedState's shape changes, so stale state is ignored. */
export const STORAGE_KEY = "fsb.selection.v3";

/**
 * The AI's rationale for the current picks.
 *
 * Optional on purpose: adding it does NOT bump STORAGE_KEY, so a funnel saved
 * before the analyzer existed still loads — it simply arrives with no reasons.
 */
export type PersistedAnalysis = {
  reasons: Record<string, string>;
  niche: string;
  vibe: string;
};

export type PersistedState = {
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  analysis: PersistedAnalysis | null;
};
export type CatalogueShape = Record<string, string[]>; // group id -> valid variation numbers

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Group ids that were folded into another when the 12 groups became 10.
 *
 * Without this, `validatePersisted` sees an id the catalogue no longer has and
 * drops it — the section disappears from a saved funnel with no error, which is
 * exactly the silent-repair failure the variation-number note in CLAUDE.md
 * warns about. Variation numbers did not change in the merge, so the number
 * carried over is still valid under the new id.
 */
const MERGED_GROUP_IDS: Record<string, string> = {
  compare: "usp",
  urgency: "risk",
};

const REASON_MAX = 160;

/**
 * Reasons are keyed by section id, so they are filtered against the live
 * catalogue for the same reason selections are: a stale id would render a
 * rationale beside a section the user never picked.
 */
function readAnalysis(raw: unknown, catalogue: CatalogueShape): PersistedAnalysis | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const rawReasons =
    typeof obj.reasons === "object" && obj.reasons !== null
      ? (obj.reasons as Record<string, unknown>)
      : {};

  const reasons: Record<string, string> = {};
  for (const [id, value] of Object.entries(rawReasons)) {
    if (!Object.prototype.hasOwnProperty.call(catalogue, id)) continue;
    if (!Array.isArray(catalogue[id])) continue;
    reasons[id] = str(value).slice(0, REASON_MAX);
  }

  return { reasons, niche: str(obj.niche), vibe: str(obj.vibe) };
}

/**
 * Validate state read back from localStorage against the live catalogue.
 * A selection saved weeks ago can name a section or variation that no longer
 * exists; left unchecked the builder's `find()` returns undefined and silently
 * substitutes a section the user never chose. Unknown groups are dropped, a
 * dead variation number is repaired to the group's first. A `copy` field from a
 * record written before the builder became a layout picker is dropped here
 * rather than forcing a storage-key bump, which would reset every saved funnel.
 * Junk input returns null rather than throwing.
 */
export function validatePersisted(raw: unknown, catalogue: CatalogueShape): PersistedState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.sel !== "object" || obj.sel === null) return null;

  // Object.create(null): `id` comes straight from untrusted persisted JSON, and
  // "__proto__" survives JSON.parse as an own enumerable key. A plain `{}` would
  // let sel["__proto__"] = ... hit the prototype setter instead of storing inert
  // data. A null-prototype object has no such setter to hit.
  const sel: Record<string, BuilderSelection> = Object.create(null);
  for (const [id, value] of Object.entries(obj.sel as Record<string, unknown>)) {
    // Array.isArray, not just a truthiness check: a plain `catalogue[id]`
    // lookup for id === "__proto__" or "constructor" returns Object.prototype
    // (a truthy, non-array object) instead of undefined, since `catalogue` is
    // an ordinary object. That would pass a bare `!valid` check and then blow
    // up on `valid.includes(...)` below, and the provider's try/catch would
    // silently discard the visitor's whole saved funnel.
    const targetId = Object.prototype.hasOwnProperty.call(MERGED_GROUP_IDS, id)
      ? MERGED_GROUP_IDS[id]
      : id;
    // An explicit pick under the new id always wins: a migrated entry must
    // never silently replace a section the user actually chose.
    if (targetId !== id && Object.prototype.hasOwnProperty.call(obj.sel, targetId)) continue;

    const valid = catalogue[targetId];
    if (!Array.isArray(valid) || valid.length === 0) continue;
    if (typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    const variation = str(entry.variation);
    sel[targetId] = {
      enabled: Boolean(entry.enabled),
      variation: valid.includes(variation) ? variation : valid[0],
    };
  }

  const rawKit = (typeof obj.kit === "object" && obj.kit !== null ? obj.kit : {}) as Record<string, unknown>;

  return {
    // Spread (not Object.assign) to convert back to a normal, Object.prototype-
    // rooted object: object-literal spread copies own keys via a data-property
    // definition, so a "__proto__" entry survives as an ordinary key instead of
    // re-triggering the setter Object.create(null) was used to avoid above.
    sel: { ...sel },
    kit: {
      primary: str(rawKit.primary), background: str(rawKit.background),
      fontHead: str(rawKit.fontHead), fontSub: str(rawKit.fontSub),
      fontBody: str(rawKit.fontBody), images: str(rawKit.images),
    },
    analysis: readAnalysis(obj.analysis, catalogue),
  };
}
