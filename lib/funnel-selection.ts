// Pure selection-state logic — no JSX, no React import. Node's type stripping
// (`--experimental-strip-types`) cannot load .tsx, so anything the test file
// imports has to live here; lib/funnel-selection.tsx re-exports the React parts.

import type { FunnelBrandKit, BuilderSelection } from "./prompt-assembly.ts";

/** Bumped whenever PersistedState's shape changes, so stale state is ignored. */
export const STORAGE_KEY = "fsb.selection.v3";

export type PersistedState = {
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
};
export type CatalogueShape = Record<string, string[]>; // group id -> valid variation numbers

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Validate state read back from localStorage against the live catalogue.
 * A selection saved weeks ago can name a section or variation that no longer
 * exists; left unchecked the builder's `find()` returns undefined and silently
 * substitutes a section the user never chose. Unknown groups are dropped, a
 * dead variation number is repaired to the group's first, and the user's typed
 * copy is preserved either way. Junk input returns null rather than throwing.
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
    const valid = catalogue[id];
    if (!valid || valid.length === 0) continue;
    if (typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    const variation = str(entry.variation);
    sel[id] = {
      enabled: Boolean(entry.enabled),
      variation: valid.includes(variation) ? variation : valid[0],
      copy: str(entry.copy),
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
  };
}
