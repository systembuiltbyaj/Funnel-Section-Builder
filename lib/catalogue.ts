import { PROMPT_GROUPS } from "./prompt-groups.ts";
import type { CatalogueShape } from "./funnel-selection.ts";
import type { BuilderSelection } from "./prompt-assembly.ts";

/**
 * Group id -> the variation numbers that currently exist for it.
 *
 * Module-level and computed once, so its identity is referentially stable. The
 * provider's hydration effect depends on this value; building it inline in JSX
 * would re-run that effect on every render.
 */
export const CATALOGUE: CatalogueShape = Object.fromEntries(
  PROMPT_GROUPS.map((g) => [g.id, g.variations.map((v) => v.number)])
);

/** Every group present and switched off, defaulting to its first variation. */
export const INITIAL_SEL: Record<string, BuilderSelection> = Object.fromEntries(
  PROMPT_GROUPS.map((g) => [
    g.id,
    { enabled: false, variation: g.variations[0].number, copy: "" },
  ])
);
