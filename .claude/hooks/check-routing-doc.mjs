#!/usr/bin/env node
/**
 * PostToolUse hook: keep CLAUDE.md's routing table honest.
 *
 * Twice in two days the manual went stale within the hour — the catalogue moved
 * to `lib/section-catalogue.ts` and the routing table kept pointing at
 * `app/private-content.tsx`, which still existed, so nothing errored. This fires
 * when a new `lib/*.ts` module or `app/<route>/page.tsx` is written and the
 * manual has no mention of it.
 *
 * Deliberately quiet: it only speaks when the name is absent, so editing an
 * already-documented file costs nothing.
 */

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const raw = readStdin();
if (!raw.trim()) process.exit(0);

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // Malformed input is the harness's problem, not ours.
}

const file = payload?.tool_input?.file_path ?? payload?.tool_response?.filePath;
if (typeof file !== "string" || !file) process.exit(0);

const unix = file.replace(/\\/g, "/");
if (/\.(test|spec)\.tsx?$/.test(unix) || unix.endsWith(".d.ts")) process.exit(0);

/** The token we expect to find somewhere in CLAUDE.md. */
let key = null;
if (/\/lib\/[^/]+\.tsx?$/.test(unix)) {
  key = basename(unix);
} else if (/\/app\/.+\/page\.tsx$/.test(unix)) {
  key = basename(dirname(unix)); // the route segment, e.g. "review"
}
if (!key) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let manual;
try {
  manual = readFileSync(join(root, "CLAUDE.md"), "utf8");
} catch {
  process.exit(0); // No manual here — nothing to keep in sync.
}

if (manual.includes(key)) process.exit(0);

process.stdout.write(
  JSON.stringify({
    systemMessage: `CLAUDE.md does not mention "${key}" — the routing table is drifting.`,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        `"${key}" was just written but appears nowhere in CLAUDE.md. Add it to the ` +
        `"Where things live" table (or the three-step flow table, if it is a route) ` +
        `before finishing this task — a routing table that points at the wrong file ` +
        `is worse than one with a gap, because nothing errors.`,
    },
  }) + "\n"
);
