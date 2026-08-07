"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "private_tool_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function signToken(): string {
  const secret = process.env.PRIVATE_TOOL_COOKIE_SECRET;
  const passcode = process.env.PRIVATE_TOOL_PASSCODE;
  if (!secret || !passcode) {
    throw new Error("PRIVATE_TOOL_COOKIE_SECRET and PRIVATE_TOOL_PASSCODE must be set");
  }
  return createHmac("sha256", secret).update(passcode).digest("hex");
}

export async function isAuthenticated(): Promise<boolean> {
  const secret = process.env.PRIVATE_TOOL_COOKIE_SECRET;
  const passcode = process.env.PRIVATE_TOOL_PASSCODE;
  if (!secret || !passcode) return false;

  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  if (!cookieValue) return false;

  const expected = signToken();
  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(cookieValue, "hex");
  if (expectedBuf.length !== gotBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, gotBuf);
  } catch {
    return false;
  }
}

export async function unlock(_prev: { error?: string } | null, formData: FormData) {
  const passcode = process.env.PRIVATE_TOOL_PASSCODE;
  const secret = process.env.PRIVATE_TOOL_COOKIE_SECRET;

  if (!passcode || !secret) {
    return { error: "Server not configured. Set PRIVATE_TOOL_PASSCODE and PRIVATE_TOOL_COOKIE_SECRET in .env.local" };
  }

  const submitted = String(formData.get("passcode") ?? "");
  if (!submitted) {
    return { error: "Enter a passcode." };
  }

  const submittedBuf = Buffer.from(submitted);
  const expectedBuf = Buffer.from(passcode);
  let valid = false;
  if (submittedBuf.length === expectedBuf.length) {
    try {
      valid = timingSafeEqual(submittedBuf, expectedBuf);
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    return { error: "Incorrect passcode." };
  }

  const store = await cookies();
  store.set(COOKIE_NAME, signToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  redirect("/");
}

export async function lock() {
  // Sign out of Supabase (if configured) and clear the passcode cookie.
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect("/");
}
