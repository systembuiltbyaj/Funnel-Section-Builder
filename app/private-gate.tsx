"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { unlock } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-yellow text-[#0D0B1F] font-bold text-sm py-3.5 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
    >
      {pending ? "Unlocking…" : "Unlock →"}
    </button>
  );
}

export function PrivateGate() {
  const [state, formAction] = useActionState(unlock, null as { error?: string } | null);

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center px-4 py-10 bg-[#0D0B1F] text-white overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(124,92,252,0.13) 0%, transparent 65%)",
        }}
      />
      <div
        className="relative w-full max-w-[420px] rounded-[20px] border border-[#2A2250] bg-[#161330] px-7 py-12 sm:px-11 sm:py-13 text-center shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
      >
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #7C5CFC, transparent)",
          }}
        />
        <span className="block text-[44px] mb-5">🔐</span>
        <h1
          className="text-[26px] font-bold text-yellow mb-2"
          style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
        >
          Private Access
        </h1>
        <p className="text-sm text-[#A09AB8] leading-relaxed mb-8">
          This tool is restricted to AJ only.
          <br />
          Enter your passcode to continue.
        </p>

        <form action={formAction} className="space-y-2.5">
          <input
            type="password"
            name="passcode"
            autoFocus
            autoComplete="off"
            placeholder="Enter passcode..."
            className="w-full rounded-lg border border-[#2A2250] bg-[#12102A] text-white px-4 py-3.5 text-[15px] outline-none focus:border-[#7C5CFC] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.15)] placeholder:tracking-normal placeholder:text-[#4A4468] tracking-[3px]"
          />
          <p
            className="text-[12.5px] text-[#F87171] min-h-[18px] text-left"
            role="alert"
            aria-live="polite"
          >
            {state?.error ?? ""}
          </p>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
