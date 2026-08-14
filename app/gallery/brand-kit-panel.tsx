"use client";

import { useFunnelSelection } from "@/lib/funnel-selection-provider";

/**
 * Brand inputs, lifted out of the old step 1.
 *
 * It opens from the tray instead of gating entry: a visitor arriving cold should
 * see sections first, and set a brand only once they care about the re-skin.
 */
export function BrandKitPanel({ onClose }: { onClose: () => void }) {
  const { kit, setKit } = useFunnelSelection();

  const field =
    "w-full rounded-md border border-[#2A2250] bg-[#0B091A] px-3 py-2 text-[12.5px] text-[#E8E4F5] outline-none focus:border-[#7C5CFC]";
  const label = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5A5478]";

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl border border-[#2A2250] bg-[#12102A] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-[#E8E4F5]">Brand kit</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md border border-[#2A2250] px-3 py-1.5 text-[11.5px] text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
          >
            Done
          </button>
        </div>

        <p className="mb-4 text-[12px] leading-[1.6] text-[#8B84A8]">
          Two colours and up to three fonts. Every supporting shade is derived from these, so the
          whole funnel stays on-brand. Leave blank to keep each section&apos;s own palette.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="bk-primary">Primary</label>
            <input id="bk-primary" className={field} placeholder="#7C5CFC"
              value={kit.primary} onChange={(e) => setKit({ primary: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="bk-background">Background</label>
            <input id="bk-background" className={field} placeholder="#0D0B1F"
              value={kit.background} onChange={(e) => setKit({ background: e.target.value })} />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className={label} htmlFor="bk-fh">Heading font</label>
            <input id="bk-fh" className={field} placeholder="Syne"
              value={kit.fontHead} onChange={(e) => setKit({ fontHead: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="bk-fs">Sub font</label>
            <input id="bk-fs" className={field} placeholder="Inter"
              value={kit.fontSub} onChange={(e) => setKit({ fontSub: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="bk-fb">Body font</label>
            <input id="bk-fb" className={field} placeholder="Inter"
              value={kit.fontBody} onChange={(e) => setKit({ fontBody: e.target.value })} />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="bk-images">Image notes</label>
          <textarea id="bk-images" rows={3} className={field} placeholder="Logo: /brand/logo.svg"
            value={kit.images} onChange={(e) => setKit({ images: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
