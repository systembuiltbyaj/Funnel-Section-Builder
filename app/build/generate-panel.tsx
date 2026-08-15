"use client";

import { useCallback, useMemo, useState } from "react";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { variationShortName } from "@/lib/prompt-assembly";
import { buildTokenBlock } from "@/lib/design-tokens";
import { stitchFunnel, type Fragment } from "@/lib/stitch-funnel";
import { LivePreview, type PreviewItem } from "../live-preview";

/**
 * Drives per-section generation and stitches the result.
 *
 * Sections are generated one request at a time, in funnel order, because a
 * whole page cannot fit inside the 60s function budget on Vercel Hobby. That
 * makes the wait long and visible, so the progress list is the feature, not
 * decoration — it has to make a two-minute run feel deliberate rather than
 * hung.
 *
 * Nothing here is persisted. The finished document lives in React state; the
 * user copies or downloads it. Storing 100-250KB of HTML in localStorage would
 * risk the quota that the funnel selection itself depends on.
 */

type RowState = "pending" | "running" | "waiting" | "done" | "failed";

/**
 * A 429 is not a failure the user caused and not one they can fix — the free
 * tier is capped on tokens per minute, so a multi-section funnel is *expected*
 * to hit it. It carries how long to wait so the run can pause and continue.
 */
class RateLimited extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Rate limited, retrying in ${retryAfterSec}s`);
  }
}

const MAX_RATE_LIMIT_WAITS = 4;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Row = {
  groupId: string;
  variation: string;
  label: string;
  name: string;
  state: RowState;
  html?: string;
  error?: string;
  /** Seconds left on a rate-limit pause, shown so the wait reads as progress. */
  waitSec?: number;
};

const STATE_LABEL: Record<RowState, string> = {
  pending: "Queued",
  running: "Generating…",
  waiting: "Rate limited",
  done: "Done",
  failed: "Failed",
};

const STATE_CLASS: Record<RowState, string> = {
  pending: "text-[#5A5478]",
  running: "text-[#F5C842]",
  waiting: "text-[#A09AB8]",
  done: "text-[#4ADE80]",
  failed: "text-[#F87171]",
};

export function GeneratePanel() {
  const { sel, kit } = useFunnelSelection();

  const chosen = useMemo(
    () =>
      PROMPT_GROUPS.filter((g) => sel[g.id]?.enabled).map((g) => {
        const number = sel[g.id].variation;
        const v = g.variations.find((x) => x.number === number) ?? g.variations[0];
        return {
          groupId: g.id,
          variation: v.number,
          label: g.label,
          name: variationShortName(v.title),
          copy: sel[g.id].copy ?? "",
        };
      }),
    [sel]
  );

  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const patchRow = useCallback((index: number, patch: Partial<Row>) => {
    setRows((prev) => prev && prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  /** One section. Returns the fragment, or throws with a readable message. */
  const generateOne = useCallback(
    async (item: (typeof chosen)[number]): Promise<string> => {
      const res = await fetch("/api/generate-section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupId: item.groupId,
          variation: item.variation,
          copy: item.copy,
          kit,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { html?: string; code?: string; message?: string; retryAfterSec?: number }
        | null;
      if (res.status === 429) {
        throw new RateLimited(
          typeof data?.retryAfterSec === "number" ? data.retryAfterSec : 15
        );
      }
      if (!res.ok || !data?.html) {
        throw new Error(data?.message ?? "Generation failed.");
      }
      return data.html;
    },
    [kit]
  );


  /**
   * One section, waiting out rate limits rather than failing on them. Returns
   * the fragment, or throws for a real failure.
   */
  const generateWithPatience = useCallback(
    async (index: number, item: (typeof chosen)[number]): Promise<string> => {
      for (let attempt = 0; attempt <= MAX_RATE_LIMIT_WAITS; attempt += 1) {
        patchRow(index, { state: "running", error: undefined, waitSec: undefined });
        try {
          return await generateOne(item);
        } catch (error) {
          if (!(error instanceof RateLimited) || attempt === MAX_RATE_LIMIT_WAITS) throw error;
          // Count the pause down so a 40s wait reads as progress, not a hang.
          for (let left = error.retryAfterSec; left > 0; left -= 1) {
            patchRow(index, { state: "waiting", waitSec: left });
            await sleep(1000);
          }
        }
      }
      throw new Error("Still rate limited after several attempts.");
    },
    [generateOne, patchRow]
  );

  const runAll = useCallback(async () => {
    setFatal(null);
    setRunning(true);
    const initial: Row[] = chosen.map((c) => ({ ...c, state: "pending" as const }));
    setRows(initial);

    for (let i = 0; i < chosen.length; i += 1) {
      try {
        const html = await generateWithPatience(i, chosen[i]);
        patchRow(i, { state: "done", html, waitSec: undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed.";
        patchRow(i, { state: "failed", error: message });
        // A missing key or an unreachable provider will fail every remaining
        // section identically — stop rather than burn through the list.
        if (/not configured|could not reach/i.test(message)) {
          setFatal(message);
          break;
        }
      }
    }
    setRunning(false);
  }, [chosen, generateWithPatience, patchRow]);

  const retryOne = useCallback(
    async (index: number) => {
      setRunning(true);
      try {
        const html = await generateWithPatience(index, chosen[index]);
        patchRow(index, { state: "done", html, waitSec: undefined });
      } catch (error) {
        patchRow(index, {
          state: "failed",
          error: error instanceof Error ? error.message : "Generation failed.",
        });
      }
      setRunning(false);
    },
    [chosen, generateWithPatience, patchRow]
  );

  // Memoised because the stitched document below depends on it; recomputing
  // a new array every render would rebuild the whole document every render.
  const doneRows = useMemo(
    () => rows?.filter((r) => r.state === "done" && r.html) ?? [],
    [rows]
  );
  const allDone = Boolean(rows?.length) && doneRows.length === rows?.length;

  const document = useMemo(() => {
    if (!doneRows.length) return null;
    const fragments: Fragment[] = doneRows.map((r) => ({
      groupId: r.groupId,
      variation: r.variation,
      html: r.html as string,
    }));
    return stitchFunnel({ tokenBlock: buildTokenBlock(kit), fragments, title: "Funnel" });
  }, [doneRows, kit]);

  async function copyDocument() {
    if (!document) return;
    try {
      await navigator.clipboard.writeText(document);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFatal("Could not copy — your browser blocked clipboard access. Use Download instead.");
    }
  }

  function downloadDocument() {
    if (!document) return;
    const blob = new Blob([document], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "funnel.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (chosen.length === 0) {
    return (
      <p className="text-[12.5px] text-[#A09AB8]">
        Pick at least one section before generating.
      </p>
    );
  }

  const previewItems: PreviewItem[] = document
    ? [{ id: "generated", title: "Generated funnel", html: document }]
    : [];

  return (
    <div className="rounded-[14px] border border-[#2A2250] bg-[#0B091A] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-[13.5px] font-bold text-[#E8E4F5]">Generate the page</h3>
        <span className="text-[11.5px] text-[#5A5478]">
          {chosen.length} section{chosen.length === 1 ? "" : "s"}, one request each
        </span>
        <button
          type="button"
          onClick={runAll}
          disabled={running}
          className="ml-auto rounded-md bg-[#F5C842] px-4 py-2 text-[12px] font-bold text-[#0D0B1F] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Generating…" : rows ? "Generate again" : "Generate my page"}
        </button>
      </div>

      {!kit.primary && !kit.background && (
        <p className="mb-3 text-[11.5px] text-[#8B84A8]">
          No brand colours set — the page will be generated in neutral monochrome. Set a brand
          kit above first if you want it in the client&apos;s colours.
        </p>
      )}

      {rows && (
        <ol className="mb-3 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li
              key={`${row.groupId}-${row.variation}`}
              className="flex items-center gap-3 rounded-md border border-[#2A2250] px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-[#E8E4F5]">
                {row.label} · {row.name}
              </span>
              <span className={`shrink-0 text-[11.5px] ${STATE_CLASS[row.state]}`}>
                {row.state === "waiting" && row.waitSec
                  ? `Rate limited — ${row.waitSec}s`
                  : STATE_LABEL[row.state]}
              </span>
              {row.state === "failed" && (
                <button
                  type="button"
                  onClick={() => retryOne(i)}
                  disabled={running}
                  className="shrink-0 rounded-md border border-[#2A2250] px-2.5 py-1 text-[11px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5] disabled:opacity-50"
                >
                  Retry
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {rows?.some((r) => r.error) && (
        <p className="mb-3 text-[11.5px] text-[#F87171]">
          {rows.find((r) => r.error)?.error}
        </p>
      )}

      {fatal && (
        <p className="mb-3 rounded-md border border-[#F87171]/40 px-3 py-2 text-[11.5px] text-[#F87171]">
          {fatal} The full-funnel prompt above still works — copy it and run it yourself.
        </p>
      )}

      {document && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyDocument}
            className="rounded-md bg-[#7C5CFC] px-4 py-2 text-[12px] font-bold text-white transition hover:brightness-110"
          >
            {copied ? "Copied ✓" : "Copy HTML"}
          </button>
          <button
            type="button"
            onClick={downloadDocument}
            className="rounded-md border border-[#2A2250] px-3.5 py-2 text-[12px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            Download funnel.html
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="rounded-md border border-[#2A2250] px-3.5 py-2 text-[12px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            Preview
          </button>
          {!allDone && (
            <span className="text-[11.5px] text-[#F5C842]">
              Partial — {doneRows.length} of {rows?.length} sections
            </span>
          )}
        </div>
      )}

      {preview && previewItems.length > 0 && (
        <LivePreview
          heading="Generated funnel"
          items={previewItems}
          kit={kit}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}
