"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

/**
 * Set a new password.
 *
 * Reached from a recovery email via /auth/callback, which exchanges the link's
 * code for a session first — so by the time this renders the user is already
 * authenticated and updateUser is all that remains.
 */
export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // The commonest cause is an expired or already-used recovery link.
      setError(`${error.message}. Request a new reset link and try again.`);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const fieldCls =
    "w-full rounded-lg border border-[#2A2250] bg-[#0B091A] px-3.5 py-3 text-[14px] text-[#E8E4F5] outline-none transition placeholder:text-[#4A4468] focus:border-[#7C5CFC] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.2)]";
  const labelCls =
    "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#7d76a0]";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className={labelCls} htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldCls}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="confirm-password">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={fieldCls}
        />
      </div>

      {error && (
        <p className="text-[12.5px] text-[#F87171]" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[#F5C842] py-3 text-[12.8px] font-bold text-[#0D0B1F] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
      >
        {busy ? "Saving…" : "Save password →"}
      </button>
    </form>
  );
}
