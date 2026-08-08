import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set a new password · Funnel Section Builder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0D0B1F] px-4 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[8%] top-[-160px] h-[420px] w-[520px] rounded-full opacity-[0.42] blur-[70px]"
        style={{ background: "#7C5CFC" }}
      />

      <div className="relative w-full max-w-[400px] rounded-2xl bg-[#12102A] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.6),0_0_0_1px_#2A2250]">
        <div className="mb-5 flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 place-items-center rounded-[7px] bg-[#F5C842] text-[13px] font-bold text-[#0D0B1F]"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            F
          </span>
          <span
            className="text-[12.5px] font-semibold"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Funnel Section Builder
          </span>
        </div>

        {user ? (
          <>
            <h1
              className="mb-1 text-[19px] font-bold"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              Set a new password
            </h1>
            <p className="mb-5 text-[12.5px] leading-[1.55] text-[#A09AB8]">
              Choose something you&apos;ll remember. You&apos;ll stay signed in afterwards.
            </p>
            <ResetForm />
          </>
        ) : (
          <>
            <h1
              className="mb-1 text-[19px] font-bold"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              This link has expired
            </h1>
            <p className="mb-5 text-[12.5px] leading-[1.55] text-[#A09AB8]">
              Reset links can only be used once, and they don&apos;t last long. Request a fresh one
              and it&apos;ll work.
            </p>
            <Link
              href="/"
              className="block rounded-lg bg-[#F5C842] py-3 text-center text-[12.8px] font-bold text-[#0D0B1F] transition hover:brightness-110"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              Back to log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
