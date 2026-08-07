import { NextRequest, NextResponse } from "next/server";

// Gate every /private/* asset (thumbnails + preview HTML) behind the same
// passcode cookie that protects the home page. Direct links are useless without
// an unlocked session; the authed user's browser sends the cookie automatically,
// so assets still load inside the unlocked tool.

const COOKIE_NAME = "private_tool_auth";

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

async function isAuthed(req: NextRequest): Promise<boolean> {
  const secret = process.env.PRIVATE_TOOL_COOKIE_SECRET;
  const passcode = process.env.PRIVATE_TOOL_PASSCODE;
  if (!secret || !passcode) return false;

  const got = req.cookies.get(COOKIE_NAME)?.value;
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
  if (await isAuthed(req)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/private/:path*"],
};
