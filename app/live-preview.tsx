"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBrandKit,
  hasBrandKit,
  isFrameHeightMessage,
  withHeightReporter,
  type BrandKit,
} from "@/lib/samples";

export type PreviewItem = { id: string; title: string; sampleSrc: string };

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
  kit,
  applyBrand,
  device,
  containerWidth,
}: {
  item: PreviewItem;
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
    () => `${item.id}-${applyBrand ? "brand" : "orig"}`,
    [item.id, applyBrand]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(item.sampleSrc);
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
  }, [item.sampleSrc, applyBrand, kit, frameId]);

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
  const [containerWidth, setContainerWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

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
          {brandAvailable && (
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

      {brandAvailable && applyBrand && (
        <p className="shrink-0 border-b border-[#2A2250] bg-[#100C24] px-4 py-2 text-[11px] leading-[1.5] text-[#A09AB8]">
          Approximate re-skin — the template palette and fonts are swapped for your brand kit.
          Colours hard-coded outside a template&apos;s palette may not change. The generated
          prompt is what produces the final build.
        </p>
      )}

      <div ref={stageRef} className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        <div className="mx-auto" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
          {items.map((item) => (
            // Keyed on the brand toggle so each frame remounts with fresh
            // loading state instead of showing the previous skin mid-fetch.
            <PreviewFrame
              key={`${item.id}-${applyBrand ? "brand" : "orig"}`}
              item={item}
              kit={kit}
              applyBrand={applyBrand}
              device={device}
              containerWidth={device === "mobile" ? Math.min(containerWidth, 390) : containerWidth}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
