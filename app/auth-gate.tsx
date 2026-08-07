"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthGate() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const supabase = createClient();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // Email confirmation is on — no session yet.
        setNotice("Account created. Check your email to confirm, then log in.");
        setMode("login");
        setBusy(false);
        return;
      }
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.refresh();
  }

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
      <div className="relative w-full max-w-[420px] rounded-[20px] border border-[#2A2250] bg-[#161330] px-7 py-11 sm:px-11 text-center shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent, #7C5CFC, transparent)" }}
        />
        <span className="block text-[44px] mb-4">🔐</span>
        <h1
          className="text-[26px] font-bold text-yellow mb-2"
          style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
        >
          Funnel Section Builder
        </h1>
        <p className="text-sm text-[#A09AB8] leading-relaxed mb-7">
          {mode === "login"
            ? "Log in to your account to continue."
            : "Create an account to save your funnels."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-left">
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#2A2250] bg-[#12102A] text-white px-4 py-3.5 text-[15px] outline-none focus:border-[#7C5CFC] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.15)] placeholder:text-[#4A4468]"
          />
          <input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[#2A2250] bg-[#12102A] text-white px-4 py-3.5 text-[15px] outline-none focus:border-[#7C5CFC] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.15)] placeholder:text-[#4A4468]"
          />
          {error && (
            <p className="text-[12.5px] text-[#F87171] min-h-[18px]" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-[12.5px] text-[#4ade80] min-h-[18px]" role="status" aria-live="polite">
              {notice}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-yellow text-[#0D0B1F] font-bold text-sm py-3.5 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in →" : "Create account →"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
            setNotice("");
          }}
          className="mt-5 text-[13px] text-[#A09AB8] hover:text-white transition"
        >
          {mode === "login"
            ? "No account? Create one"
            : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
