import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Gate the /private/* asset tree, and (when Supabase is configured) keep the
// auth session fresh on page loads.
//
// - Supabase mode: page routes refresh the session; /private/* assets are gated
//   by a lightweight auth-cookie presence check (avoids a Supabase round-trip
//   per thumbnail — the real data is protected by RLS + getUser in the API).
// - Fallback (no Supabase env): the original passcode HMAC cookie gates /private/*.

const PASSCODE_COOKIE = "private_tool_auth";

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function redirectHome(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

// ---- passcode fallback helpers (Phase 1) ----
function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function passcodeAuthed(req: NextRequest): Promise<boolean> {
  const secret = process.env.PRIVATE_TOOL_COOKIE_SECRET;
  const passcode = process.env.PRIVATE_TOOL_PASSCODE;
  if (!secret || !passcode) return false;
  const got = req.cookies.get(PASSCODE_COOKIE)?.value;
  if (!got) return false;
  const gotBytes = hexToBytes(got);
  if (!gotBytes) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(passcode));
  return timingSafeEqual(new Uint8Array(sig), gotBytes);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (supabaseConfigured()) {
    // Lightweight asset gate: is a Supabase auth cookie present?
    if (path.startsWith("/private/")) {
      const hasAuth = req.cookies
        .getAll()
        .some((c) => /^sb-.*-auth-token/.test(c.name));
      return hasAuth ? NextResponse.next() : redirectHome(req);
    }

    // Page routes: refresh the Supabase session (rotates cookies on the response).
    let res = NextResponse.next({ request: req });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    await supabase.auth.getUser();
    return res;
  }

  // Fallback: passcode gate for the private asset tree.
  if (path.startsWith("/private/")) {
    return (await passcodeAuthed(req)) ? NextResponse.next() : redirectHome(req);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/private/:path*"],
};
