"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryItem } from "@/lib/gallery-filter";
import { variationShortName } from "@/lib/prompt-assembly";

/**
 * One variation in the gallery.
 *
 * Three actions, deliberately separate: copying a single prompt and adding to a
 * funnel are different intents, and collapsing them into one button makes the
 * browse-and-leave visitor and the build-a-funnel visitor fight over it.
 *
 * `onPreview` is null when the variation has no rendered sample (the image-prompt
 * library, three of the five layouts, empathy-v9/v10). The button is hidden
 * rather than disabled — a dead control is worse than an absent one.
 */
export function GalleryCard({
  item,
  inFunnel,
  onPreview,
  onToggle,
  onCopy,
}: {
  item: GalleryItem;
  inFunnel: boolean;
  onPreview: (() => void) | null;
  onToggle: (() => void) | null;
  onCopy: () => string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  // Explicit `number`, not `ReturnType<typeof window.setTimeout>`: with
  // @types/node in scope, that alias resolves to NodeJS.Timeout even for the
  // browser's `window.setTimeout`, which actually returns a number.
  const resetTimer = useRef<number | null>(null);
  const v = item.variation;

  // Clear the pending reset on unmount so it cannot call setState on an
  // unmounted card (the gallery re-filters on every keystroke, which unmounts
  // cards freely).
  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function scheduleReset() {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 1600);
  }

  // Mirrors CopyButton in app/private-content.tsx: await the write and only
  // claim success once the browser confirms it. writeText rejects on insecure
  // origins and denied permission, so an unconditional setCopied(true) would
  // report "Copied ✓" while the clipboard stayed untouched.
  //
  // The empty-string guard is cheap insurance against the same failure mode
  // by a different route: writeText("") resolves successfully, so a bug that
  // hands us empty text (e.g. a groupId that doesn't resolve against the
  // group lists onCopy searches) would otherwise still report "Copied ✓".
  async function copy() {
    const text = onCopy();
    if (text === "") {
      setCopyState("failed");
      scheduleReset();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    scheduleReset();
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border bg-[#151230] transition ${
        inFunnel ? "border-[#7C5CFC]" : "border-[#2A2250] hover:border-[#4A3A8A]"
      }`}
    >
      {inFunnel && (
        <span className="absolute right-2 top-2 z-10 rounded-[3px] bg-[#7C5CFC] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.06em] text-white">
          IN FUNNEL
        </span>
      )}

      {v.previewSrc && (
        /* Plain img, not next/image: these thumbnails already pass unoptimized. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={v.previewSrc}
          alt={`${v.title} thumbnail`}
          loading="lazy"
          decoding="async"
          className="block aspect-[16/10] w-full object-cover"
        />
      )}

      <div className="p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="rounded-[3px] border border-[#2A2250] px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-[#6B6390]">
            {v.number}
          </span>
          <span className="truncate text-[13px] font-bold text-[#E8E4F5]" title={v.title}>
            {variationShortName(v.title)}
          </span>
        </div>

        <p className="mb-3 line-clamp-2 text-[11.5px] leading-[1.5] text-[#8B84A8]">
          {v.description}
        </p>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={copy}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-bold transition ${
              copyState === "failed"
                ? "bg-[#3A1E2A] text-[#F87171]"
                : "bg-[#F5C842] text-[#0D0B1F] hover:brightness-110"
            }`}
          >
            {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Copy failed" : "Copy prompt"}
          </button>

          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              title="Live preview"
              aria-label={`Live preview ${v.title}`}
              className="rounded-md border border-[#2A2250] px-2.5 py-1.5 text-[11.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
            >
              Preview
            </button>
          )}

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              title={inFunnel ? "Remove from funnel" : "Add to funnel"}
              aria-label={inFunnel ? `Remove ${v.title} from funnel` : `Add ${v.title} to funnel`}
              className={`rounded-md border px-2.5 py-1.5 text-[11.5px] transition ${
                inFunnel
                  ? "border-[#7C5CFC] text-[#9B82FF]"
                  : "border-[#2A2250] text-[#A09AB8] hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
              }`}
            >
              {inFunnel ? "✓" : "+"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
