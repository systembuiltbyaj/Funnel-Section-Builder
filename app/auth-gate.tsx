"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";

/** The 10P stages, abbreviated. Two are marked to read as an in-progress build. */
const STACK: { label: string; picked: boolean }[] = [
  { label: "Hero", picked: true },
  { label: "Empathy", picked: false },
  { label: "Offer", picked: true },
  { label: "Proof", picked: false },
  { label: "Close", picked: false },
];

const fieldCls =
  "w-full rounded-lg border border-[#2A2250] bg-[#0B091A] px-3.5 py-3 text-[14px] text-[#E8E4F5] outline-none transition placeholder:text-[#4A4468] focus:border-[#7C5CFC] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.2)]";
const labelCls =
  "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#7d76a0]";

export function AuthGate() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const supabase = createClient();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    if (!email) {
      setError("Enter your email.");
      return;
    }
    if (mode !== "forgot" && !password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
      });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      // Same message whether or not the address exists, so this cannot be used
      // to discover who has an account.
      setNotice("If that email has an account, a reset link is on its way.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // Email confirmation is on — no session until they click the link.
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

  const heading =
    mode === "forgot" ? "Reset your password" : mode === "signup" ? "Create your account" : "Welcome back";
  const submitLabel =
    mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account →" : "Log in →";

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
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-140px] right-[4%] h-[300px] w-[360px] rounded-full opacity-[0.13] blur-[70px]"
        style={{ background: "#F5C842" }}
      />

      <div className="relative grid w-full max-w-[860px] overflow-hidden rounded-2xl bg-[#12102A] shadow-[0_40px_120px_rgba(0,0,0,0.6),0_0_0_1px_#2A2250] md:grid-cols-[1.05fr_0.95fr]">
        {/* Brand panel. Hidden on small screens: the form is the job there. */}
        <div className="relative hidden flex-col border-r border-[#2A2250] bg-gradient-to-b from-[#191338] to-[#12102A] p-9 md:flex">
          <div className="mb-auto flex items-center gap-2.5">
            <span
              className="grid h-7 w-7 place-items-center rounded-[7px] bg-[#F5C842] text-[13px] font-bold text-[#0D0B1F]"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              F
            </span>
            <span
              className="text-[12.5px] font-semibold tracking-[0.02em]"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              Funnel Section Builder
            </span>
          </div>

          <h1
            className="mb-2.5 mt-7 text-[31px] font-bold leading-[1.12]"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Build the page,
            <br />
            <span className="text-[#F5C842]">section by section.</span>
          </h1>
          <p className="mb-5 max-w-[34ch] text-[12.8px] leading-[1.62] text-[#A09AB8]">
            Pick from ready-made funnel sections, drop in your copy, and walk away with prompts
            that build the whole page.
          </p>

          <div aria-hidden className="flex flex-col gap-[5px]">
            {STACK.map((s, i) => (
              <div
                key={s.label}
                className={`flex h-[26px] items-center rounded-[5px] border px-2.5 text-[8.5px] font-bold uppercase tracking-[0.13em] ${
                  s.picked
                    ? "border-[#7C5CFC] bg-[rgba(124,92,252,0.14)] text-[#b9a8ff]"
                    : "border-[#2A2250] bg-[#0B091A] text-[#6f679a]"
                }`}
                style={{
                  animation: "slot-in 0.5s cubic-bezier(0.2,0.7,0.3,1) backwards",
                  animationDelay: `${0.05 + i * 0.09}s`,
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center gap-3 p-8 sm:p-9">
          <div className="mb-1">
            <h2
              className="text-[19px] font-bold"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              {heading}
            </h2>
            {mode === "forgot" && (
              <p className="mt-1 text-[12.5px] leading-[1.55] text-[#A09AB8]">
                Enter your email and we&apos;ll send you a link to set a new password.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className={labelCls} htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@studio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className={labelCls} htmlFor="auth-password">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldCls}
                />
              </div>
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchTo("forgot")}
                  className="text-[11.5px] text-[#7d76a0] transition hover:text-[#E8E4F5]"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <p className="text-[12.5px] text-[#F87171]" role="alert" aria-live="polite">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-[12.5px] text-[#4ade80]" role="status" aria-live="polite">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#F5C842] py-3 text-[12.8px] font-bold text-[#0D0B1F] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              {busy ? "Please wait…" : submitLabel}
            </button>
          </form>

          <p className="mt-1 text-center text-[11.5px] text-[#7d76a0]">
            {mode === "login" && (
              <>
                New here?{" "}
                <button type="button" onClick={() => switchTo("signup")} className="text-[#b9a8ff] hover:underline">
                  Create an account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchTo("login")} className="text-[#b9a8ff] hover:underline">
                  Log in
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => switchTo("login")} className="text-[#b9a8ff] hover:underline">
                ← Back to log in
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
