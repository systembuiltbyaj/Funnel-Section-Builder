/**
 * Request-body shaping for the saved-funnel routes.
 *
 * Kept out of the route handlers so it can be unit-tested: the handlers import
 * `next/server` and the `@/` alias, neither of which resolves under the bare
 * `node --test` runner this project uses.
 *
 * The security property these functions exist to guarantee: a client can only
 * ever write `name` and `data`. `user_id` comes from the verified session and is
 * never read from the body, so a caller cannot insert a row owned by someone
 * else even before RLS gets a say.
 */

export const NAME_MAX = 120;
export const DEFAULT_NAME = "Untitled funnel";

export type ProjectInsert = { user_id: string; name: string; data: unknown };
export type ProjectPatch = { name?: string; data?: unknown };

/** Keys that must never reach the database from a request body. */
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

function field(body: unknown, key: string): unknown {
  if (typeof body !== "object" || body === null || FORBIDDEN.has(key)) return undefined;
  // Own-property check only: an attacker-supplied `__proto__` cannot smuggle a
  // value in through the prototype chain.
  return Object.prototype.hasOwnProperty.call(body, key)
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

/** Trim, fall back to the default, and cap at the column width. */
export function normalizeName(raw: unknown): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return (trimmed || DEFAULT_NAME).slice(0, NAME_MAX);
}

/**
 * Build the row for `POST /api/projects`. `userId` must come from
 * `supabase.auth.getUser()`, never from the request.
 */
export function insertPayload(userId: string, body: unknown): ProjectInsert {
  return {
    user_id: userId,
    name: normalizeName(field(body, "name")),
    data: field(body, "data") ?? {},
  };
}

/**
 * Build the patch for `PATCH /api/projects/:id`.
 *
 * Returns null when the body carries no updatable field, which the route turns
 * into a 400 — an empty `update()` would otherwise be a silent no-op write.
 */
export function patchPayload(body: unknown): ProjectPatch | null {
  const patch: ProjectPatch = {};

  const name = field(body, "name");
  if (typeof name === "string") patch.name = normalizeName(name);

  const data = field(body, "data");
  if (data !== undefined) patch.data = data;

  return Object.keys(patch).length > 0 ? patch : null;
}
