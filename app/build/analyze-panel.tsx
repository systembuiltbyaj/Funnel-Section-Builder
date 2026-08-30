"use client";

import { useState } from "react";
import { PROMPT_GROUPS } from "@/lib/prompt-groups";
import { INITIAL_SEL } from "@/lib/catalogue";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { analyzeFunnelCopy, AnalyzeFailure } from "@/lib/analyze";
import type { BuilderSelection } from "@/lib/prompt-assembly";

const FIELD_CLS =
  "w-full rounded-lg border border-[#2A2250] bg-[#0B091A] px-3 py-2.5 text-[13px] text-[#E8E4F5] placeholder-[#5A5478] focus:border-[#7C5CFC] focus:outline-none resize-y leading-[1.55]";

/**
 * Paste a page, get a recommended variation per 10P section.
 *
 * The pasted text is deliberately transient: it lives in this component's state
 * for the length of the request and is never written to the selection or to
 * localStorage. The builder is a layout picker — the only thing that survives
 * an analysis is which variation was picked and why.
 */
export function AnalyzePanel() {
  const { sel, analysis, applyAnalysis } = useFunnelSelection();
  const [copy, setCopy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chars = copy.trim().length;
  const pickedCount = PROMPT_GROUPS.filter((g) => sel[g.id]?.enabled).length;

  const run = async () => {
    // Analysis replaces every pick. Silently discarding a selection the user
    // built by hand in the gallery reads as a bug, so it is asked for first.
    if (pickedCount > 0) {
      const ok = window.confirm(
        `Analysing replaces all ${pickedCount} section${pickedCount === 1 ? "" : "s"} you have picked. Continue?`
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await analyzeFunnelCopy(copy);

      const next: Record<string, BuilderSelection> = { ...INITIAL_SEL };
      const reasons: Record<string, string> = {};
      // Excerpts ride along in memory for the preview only — see the provider.
      const excerpts: Record<string, string> = {};
      for (const s of result.sections) {
        next[s.sectionId] = { enabled: true, variation: s.recommendedVariation };
        reasons[s.sectionId] = s.reason;
        if (s.copy) excerpts[s.sectionId] = s.copy;
      }

      applyAnalysis(next, { reasons, niche: result.niche, vibe: result.vibe }, excerpts);
    } catch (e) {
      setError(e instanceof AnalyzeFailure ? e.message : "Analysis failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[14px] border border-[#2A2250] bg-[#161330] p-6 mb-5">
      <h2
        className="text-[15px] font-bold mb-1"
        style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
      >
        <span className="text-[#7C5CFC]">1 ·</span> Paste a Page to Analyse
      </h2>
      <p className="text-[12px] text-[#A09AB8] mb-4">
        The whole thing — headlines, body, testimonials, offer, FAQ. The AI maps it onto the
        10P framework and picks the best-fit layout for each section. Your text is used for the
        recommendation only: it is never saved and never appears in the output.
      </p>

      <label htmlFor="analyze-copy" className="sr-only">
        Page to analyse
      </label>
      <textarea
        id="analyze-copy"
        value={copy}
        onChange={(e) => setCopy(e.target.value)}
        rows={9}
        placeholder="Paste the client's full sales-page / funnel copy here..."
        className={FIELD_CLS}
      />

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <span className="text-[11.5px] text-[#5A5478]">{chars.toLocaleString()} chars</span>
        {analysis && (analysis.niche || analysis.vibe) && (
          <span className="text-[11.5px] text-[#A09AB8]">
            Detected:{" "}
            <span className="text-[#C0B8E0]">
              {[analysis.niche, analysis.vibe].filter(Boolean).join(" · ")}
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={run}
          disabled={busy || chars < 40}
          className="ml-auto rounded-md bg-[#7C5CFC] text-white text-[12.5px] font-bold px-5 py-2.5 transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
        >
          {busy ? "Analysing…" : "✨ Analyse & Recommend"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[12.5px] text-[#F87171] mt-3">
          {error}
        </p>
      )}
    </section>
  );
}
