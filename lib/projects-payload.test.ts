import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insertPayload,
  patchPayload,
  normalizeName,
  NAME_MAX,
  DEFAULT_NAME,
} from "./projects-payload.ts";

const USER = "user-a-uuid";

// --- ownership / mass assignment -------------------------------------------

test("insertPayload takes user_id from the session, never the body", () => {
  const row = insertPayload(USER, { user_id: "user-b-uuid", name: "Mine" });
  assert.equal(row.user_id, USER);
});

test("insertPayload ignores every field except name and data", () => {
  const row = insertPayload(USER, {
    name: "Client funnel",
    data: { hero: true },
    id: "forged-id",
    created_at: "1999-01-01",
    updated_at: "1999-01-01",
    is_admin: true,
  });
  assert.deepEqual(Object.keys(row).sort(), ["data", "name", "user_id"]);
});

test("patchPayload ignores every field except name and data", () => {
  const patch = patchPayload({ name: "Renamed", user_id: "user-b-uuid", id: "forged" });
  assert.deepEqual(patch, { name: "Renamed" });
});

test("a __proto__ key in the body cannot pollute the payload", () => {
  const body = JSON.parse('{"name":"ok","__proto__":{"polluted":true}}');
  const row = insertPayload(USER, body);
  assert.deepEqual(Object.keys(row).sort(), ["data", "name", "user_id"]);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

// --- name handling ----------------------------------------------------------

test("normalizeName falls back to the default for blank and non-string input", () => {
  assert.equal(normalizeName(""), DEFAULT_NAME);
  assert.equal(normalizeName("   "), DEFAULT_NAME);
  assert.equal(normalizeName(undefined), DEFAULT_NAME);
  assert.equal(normalizeName(42), DEFAULT_NAME);
  assert.equal(normalizeName(null), DEFAULT_NAME);
});

test("normalizeName trims and caps at the column width", () => {
  assert.equal(normalizeName("  spaced  "), "spaced");
  assert.equal(normalizeName("x".repeat(500)).length, NAME_MAX);
});

test("insertPayload defaults data to an empty object, not undefined", () => {
  assert.deepEqual(insertPayload(USER, { name: "n" }).data, {});
});

test("insertPayload treats null data as absent, but keeps other falsy values", () => {
  // `?? {}` collapses null and undefined alike — matching the route's original
  // behaviour, so a null never reaches the jsonb column.
  assert.deepEqual(insertPayload(USER, { data: null }).data, {});
  assert.equal(insertPayload(USER, { data: 0 }).data, 0);
  assert.equal(insertPayload(USER, { data: "" }).data, "");
  assert.equal(insertPayload(USER, { data: false }).data, false);
});

// --- patch emptiness --------------------------------------------------------

test("patchPayload returns null when there is nothing to update", () => {
  assert.equal(patchPayload({}), null);
  assert.equal(patchPayload({ id: "x", user_id: "y" }), null);
  assert.equal(patchPayload(null), null);
  assert.equal(patchPayload("not an object"), null);
});

test("patchPayload rejects a non-string name instead of writing it", () => {
  assert.equal(patchPayload({ name: 42 }), null);
});

test("patchPayload allows clearing data explicitly", () => {
  assert.deepEqual(patchPayload({ data: {} }), { data: {} });
});

test("patchPayload accepts a name-only and a data-only patch", () => {
  assert.deepEqual(patchPayload({ name: "New" }), { name: "New" });
  assert.deepEqual(patchPayload({ data: { a: 1 } }), { data: { a: 1 } });
});
