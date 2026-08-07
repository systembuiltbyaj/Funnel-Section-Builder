"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFunnelSelection } from "@/lib/funnel-selection-provider";
import { analyzeFunnelCopy } from "@/lib/analyze";

const fieldCls =
  "w-full rounded-lg border border-[#2A2250] bg-[#0B091A] px-3.5 py-3 text-[13.5px] text-[#E8E4F5] outline-none transition placeholder:text-[#4A4468] focus:border-[#7C5CFC] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.18)]";
const labelCls =
  "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#7d76a0]";

function StepHeading({ n, title, blurb }: { n: number; title: string; blurb: string }) {
  return (
    <div className="mb-4">
      <h2
        className="text-[15px] font-bold"
        style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
      >
        <span className="text-[#7C5CFC]">{n} ·</span> {title}
      </h2>
      <p className="mt-1 text-[12.5px] leading-[1.6] text-[#A09AB8]">{blurb}</p>
    </div>
  );
}

/**
 * The guided entry point: paste the client's copy, describe the brand, and let
 * the analyzer propose a funnel. Everything here is optional except the copy —
 * a user who already knows what they want can skip straight to picking sections.
 */
export function StartFunnel() {
  const router = useRouter();
  const { kit, setKit, analysis, replaceAll } = useFunnelSelection();
  const [copy, setCopy] = useState(analysis.sourceCopy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (copy.trim().length < 40) {
      setError("Paste a bit more copy — there isn't enough here to map onto the framework.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await analyzeFunnelCopy(copy);
      const picked = Object.values(result.sel).filter((s) => s.enabled).length;
      if (picked === 0) {
        setError("The analyzer couldn't map this copy onto any section. Try pasting more of it, or pick sections yourself.");
        setBusy(false);
        return;
      }
      replaceAll({
        sel: result.sel,
        kit,
        analysis: { reasons: result.reasons, meta: result.meta, sourceCopy: copy },
      });
      router.push("/review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setBusy(false);
    }
  }

  const cardCls = "rounded-[14px] border border-[#2A2250] bg-[#12102A] p-5 sm:p-6";

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-4 px-4 pb-24">
      <section className={cardCls}>
        <StepHeading
          n={1}
          title="Paste the full funnel copy"
          blurb="The whole thing — headlines, body, testimonials, offer, FAQ. It gets mapped onto the 10P framework, and you'll review every choice before anything is built."
        />
        <textarea
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          rows={9}
          placeholder="Paste the client's full sales-page or funnel copy here…"
          className={`${fieldCls} resize-y leading-[1.6]`}
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#5A5478]">
          <span>{copy.trim().length.toLocaleString()} characters</span>
          <span>Nothing is saved to your account until you save a funnel.</span>
        </div>
      </section>

      <section className={cardCls}>
        <StepHeading
          n={2}
          title="Brand kit"
          blurb="Two colours and up to three fonts. Every supporting shade — text, muted, cards, borders — is derived from these, so the whole funnel stays on-brand. Leave blank to keep each section's own palette."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="kit-primary">
              Primary / accent
            </label>
            <input
              id="kit-primary"
              value={kit.primary}
              onChange={(e) => setKit({ primary: e.target.value })}
              placeholder="#7C5CFC"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="kit-bg">
              Background / base
            </label>
            <input
              id="kit-bg"
              value={kit.background}
              onChange={(e) => setKit({ background: e.target.value })}
              placeholder="#0D0B1F"
              className={fieldCls}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="kit-head">
              Headline font
            </label>
            <input
              id="kit-head"
              value={kit.fontHead}
              onChange={(e) => setKit({ fontHead: e.target.value })}
              placeholder="Space Grotesk"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="kit-sub">
              Subheadline font
            </label>
            <input
              id="kit-sub"
              value={kit.fontSub}
              onChange={(e) => setKit({ fontSub: e.target.value })}
              placeholder="Inter"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="kit-body">
              Body font
            </label>
            <input
              id="kit-body"
              value={kit.fontBody}
              onChange={(e) => setKit({ fontBody: e.target.value })}
              placeholder="Inter"
              className={fieldCls}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelCls} htmlFor="kit-images">
            Images &amp; logo
          </label>
          <textarea
            id="kit-images"
            value={kit.images}
            onChange={(e) => setKit({ images: e.target.value })}
            rows={3}
            placeholder={"Logo: https://…\nHero background: https://…\nCoach photo: https://…"}
            className={`${fieldCls} resize-y leading-[1.6]`}
          />
          <p className="mt-1.5 text-[11px] leading-[1.55] text-[#5A5478]">
            Paste image URLs, one per line, labelled. Upload them to your GoHighLevel media
            library first and copy the links — that&apos;s where the funnel will look for them.
            Leave blank and each section keeps its placeholder images.
          </p>
        </div>
      </section>

      {error && (
        <p
          className="rounded-lg border border-[#4A2250] bg-[#1A0F24] px-4 py-3 text-[12.5px] text-[#F87171]"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={analyze}
          disabled={busy}
          className="rounded-lg bg-[#7C5CFC] px-6 py-3 text-[13px] font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
        >
          {busy ? "Reading your copy…" : "Analyze & recommend →"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/sections")}
          className="rounded-lg border border-[#2A2250] px-4 py-3 text-[12.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
        >
          Skip — I&apos;ll pick sections myself
        </button>
      </div>
    </div>
  );
}
