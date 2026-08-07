import type { Metadata } from "next";
import { AuthGate } from "./auth-gate";
import { SectionLibrary } from "./hub/library";
import { SavedFunnels } from "./hub/saved-funnels";
import { FunnelTray } from "./hub/funnel-tray";
import { lock } from "./actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Funnel Section Builder",
  description:
    "Browse ready-made funnel sections across the 10P framework and turn them into copy-ready AI prompts.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return <AuthGate />;

  return (
    // pb-28 reserves room for the docked tray so it cannot cover the last row.
    <main className="relative min-h-[100dvh] bg-[#0D0B1F] pb-28 text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[600px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(124,92,252,0.13) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10">
        <header className="mx-auto flex max-w-[1200px] items-start justify-between gap-4 px-4 pb-2 pt-10">
          <div>
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(124,92,252,0.22)] bg-[rgba(124,92,252,0.1)] px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9B82FF]">
              ⚡ 10P Funnel Framework
            </span>
            <h1
              className="text-[27px] font-bold leading-tight"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              Build a funnel, <em className="not-italic text-[#F5C842]">section by section</em>
            </h1>
            <p className="mt-1.5 max-w-[580px] text-[13.5px] leading-[1.6] text-[#A09AB8]">
              Ready-made sections across the whole framework. Browse them live, add what fits,
              then fill in your copy in the builder.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/build"
              className="rounded-md border border-[#2A2250] px-3.5 py-2 text-[12px] font-semibold text-[#A09AB8] transition hover:border-[#7C5CFC] hover:text-[#E8E4F5]"
            >
              Open builder
            </a>
            <form action={lock}>
              <button
                type="submit"
                className="rounded-md border border-[#2A2250] px-3 py-2 text-[11.5px] text-[#5A5478] transition hover:border-[#F87171] hover:text-[#F87171]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <SectionLibrary />
        <SavedFunnels />
        <FunnelTray />
      </div>
    </main>
  );
}
