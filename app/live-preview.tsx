"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBrandKit,
  hasBrandKit,
  isFrameHeightMessage,
  withHeightReporter,
  type BrandKit,
} from "@/lib/samples";

/**
 * A preview source. Either a `sampleSrc` to fetch (a catalogue sample) or an
 * inline `html` document already in hand (a freshly generated funnel). When
 * `html` is present the fetch is skipped and no brand re-skin is applied —
 * generated output is already built in the client's own brand.
 */
export type PreviewItem = {
  id: string;
  title: string;
  sampleSrc?: string;
  html?: string;
  /**
   * The slice of the client's pasted page this section maps to.
   *
   * Shown BESIDE the sample, never merged into it. The samples are 100
   * independently authored documents with no shared slot structure, so swapping
   * text into them reliably is not possible — and a half-swapped section reads
   * as a bug rather than as a preview. Side by side, the layout stays honest
   * and the mapping stays legible.
   */
  copy?: string;
  /** The greyscale wireframe for this section, when one has been generated. */
  wireframeSrc?: string;
};

/** Width of the copy column. Below this the layout is not worth splitting. */
const COPY_PANEL_WIDTH = 320;
const MIN_SPLIT_WIDTH = 760;

type Device = "desktop" | "mobile";

/** Width each device renders at before being scaled to fit the modal. */
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };

/**
 * One sandboxed sample document, scaled to fit the available width and sized
 * to the height the frame reports back. Sections stacked in funnel order read
 * as a single continuous page.
 */
function PreviewFrame({
  item,
  src,
  kit,
  applyBrand,
  device,
  containerWidth,
}: {
  item: PreviewItem;
  /** Which document to render — the designed sample or the wireframe. */
  src: string | undefined;
  kit: BrandKit;
  applyBrand: boolean;
  device: Device;
  containerWidth: number;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(720);

  // Device is deliberately excluded: resizing the frame element makes the
  // document re-report its height, so switching devices needs no refetch.
  const frameId = useMemo(
    () => `${item.id}-${applyBrand ? "brand" : "orig"}-${src ?? "inline"}`,
    [item.id, applyBrand, src]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // A generated document arrives inline and is already in the client's
      // brand, so it is neither fetched nor re-skinned.
      if (item.html !== undefined) {
        setHtml(withHeightReporter(item.html, frameId));
        return;
      }
      if (!src) {
        setError("Preview unavailable — no document to show.");
        return;
      }
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`${res.status}`);
        const raw = await res.text();
        if (cancelled) return;
        const skinned = applyBrand ? applyBrandKit(raw, kit) : raw;
        setHtml(withHeightReporter(skinned, frameId));
      } catch {
        if (!cancelled) setError("Preview unavailable — the sample file could not be loaded.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, item.html, applyBrand, kit, frameId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isFrameHeightMessage(e.data) || e.data.id !== frameId) return;
      setHeight(Math.min(Math.max(e.data.height, 200), 20000));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId]);

  const width = DEVICE_WIDTH[device];
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / width) : 1;

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-[12.5px] text-[#F87171] border border-[#3A2250] rounded-md bg-[#0B091A]">
        {error}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden bg-[#0B091A]"
      style={{ height: height * scale }}
      aria-label={`${item.title} preview`}
    >
      {html === null ? (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[#5A5478]">
          Rendering {item.title}…
        </div>
      ) : (
        <iframe
          title={item.title}
          srcDoc={html}
          sandbox="allow-scripts"
          loading="lazy"
          scrolling="no"
          style={{
            width,
            height,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}

/**
 * Full-screen live preview. Renders one section or a whole funnel from the
 * rendered HTML samples that ship with the library, optionally re-skinned in
 * the client's brand kit.
 */
export function LivePreview({
  items,
  kit,
  heading,
  onClose,
}: {
  items: PreviewItem[];
  kit: BrandKit;
  heading: string;
  onClose: () => void;
}) {
  const brandAvailable = hasBrandKit(kit);
  const [applyBrand, setApplyBrand] = useState(brandAvailable);
  const [device, setDevice] = useState<Device>("desktop");
  // Wireframe first: the preview is opened to judge a LAYOUT, and the finished
  // design competes for that attention. The design is one click away.
  const wireframeAvailable = items.some((i) => i.wireframeSrc);
  const [view, setView] = useState<"wireframe" | "design">(
    wireframeAvailable ? "wireframe" : "design"
  );
  const [containerWidth, setContainerWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Split only when there is copy to show AND room to show it. Below the
  // threshold the frame would be squeezed to the point of being useless, so the
  // layout keeps the full width and the copy column is dropped.
  const splitCopy = items.some((i) => i.copy) && containerWidth >= MIN_SPLIT_WIDTH;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const measure = useCallback(() => {
    if (stageRef.current) setContainerWidth(stageRef.current.clientWidth);
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [measure]);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition ${
      active
        ? "bg-[#7C5CFC] text-white"
        : "border border-[#2A2250] text-[#A09AB8] hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
    }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-[200] flex flex-col bg-[#07060F]/95 backdrop-blur-sm"
    >
      <header className="flex items-center gap-3 flex-wrap border-b border-[#2A2250] px-4 py-3 shrink-0">
        <h2 className="text-[13.5px] font-bold text-[#E8E4F5]">{heading}</h2>
        <span className="text-[11px] text-[#5A5478]">
          {items.length} section{items.length === 1 ? "" : "s"}
        </span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {wireframeAvailable && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#2A2250] p-1">
              <button
                type="button"
                className={tabCls(view === "wireframe")}
                onClick={() => setView("wireframe")}
              >
                Wireframe
              </button>
              <button
                type="button"
                className={tabCls(view === "design")}
                onClick={() => setView("design")}
              >
                Design
              </button>
            </div>
          )}
          {brandAvailable && view === "design" && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#2A2250] p-1">
              <button type="button" className={tabCls(applyBrand)} onClick={() => setApplyBrand(true)}>
                Brand kit
              </button>
              <button type="button" className={tabCls(!applyBrand)} onClick={() => setApplyBrand(false)}>
                Original
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-lg border border-[#2A2250] p-1">
            <button type="button" className={tabCls(device === "desktop")} onClick={() => setDevice("desktop")}>
              Desktop
            </button>
            <button type="button" className={tabCls(device === "mobile")} onClick={() => setDevice("mobile")}>
              Mobile
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {brandAvailable && applyBrand && view === "design" && (
        <p className="shrink-0 border-b border-[#2A2250] bg-[#100C24] px-4 py-2 text-[11px] leading-[1.5] text-[#A09AB8]">
          Approximate re-skin — the template palette and fonts are swapped for your brand kit.
          Colours hard-coded outside a template&apos;s palette may not change. The generated
          prompt is what produces the final build.
        </p>
      )}

      <div ref={stageRef} className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        <div className="mx-auto" style={{ maxWidth: splitCopy ? "100%" : device === "mobile" ? 390 : "100%" }}>
          {items.map((item) => {
            const frameWidth = splitCopy
              ? Math.max(320, containerWidth - COPY_PANEL_WIDTH - 16)
              : containerWidth;
            // Keyed on the brand toggle so each frame remounts with fresh
            // loading state instead of showing the previous skin mid-fetch.
            const frame = (
              <PreviewFrame
                key={`${item.id}-${view}-${applyBrand ? "brand" : "orig"}`}
                item={item}
                src={view === "wireframe" ? (item.wireframeSrc ?? item.sampleSrc) : item.sampleSrc}
                kit={kit}
                /* A wireframe is greyscale on purpose — re-skinning it to the
                   client's palette would defeat the point of showing it. */
                applyBrand={applyBrand && view === "design"}
                device={device}
                containerWidth={device === "mobile" ? Math.min(frameWidth, 390) : frameWidth}
              />
            );

            if (!splitCopy) return frame;

            return (
              <div
                key={`${item.id}-row`}
                className="flex items-start gap-4 border-b border-[#221C48] px-3 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">{frame}</div>
                <aside
                  className="shrink-0 rounded-lg border border-[#2A2250] bg-[#0B091A] p-3"
                  style={{ width: COPY_PANEL_WIDTH }}
                >
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7C5CFC]">
                    Your copy
                  </div>
                  <div className="mb-2 truncate text-[11px] text-[#8B84A8]" title={item.title}>
                    {item.title}
                  </div>
                  {item.copy ? (
                    <p className="whitespace-pre-wrap text-[12px] leading-[1.55] text-[#C0B8E0]">
                      {item.copy}
                    </p>
                  ) : (
                    <p className="text-[12px] italic leading-[1.55] text-[#5A5478]">
                      No excerpt mapped to this section.
                    </p>
                  )}
                </aside>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
