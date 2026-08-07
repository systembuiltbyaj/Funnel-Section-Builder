import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keep the Supabase session fresh on page loads, and gate the /private/* asset
// tree (thumbnails + preview HTML) to logged-in users. The asset gate is a
// lightweight auth-cookie presence check (no Supabase round-trip per thumbnail);
// the real data is protected by RLS + getUser in the API.

function configured(): boolean {
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

export async function middleware(req: NextRequest) {
  if (!configured()) return NextResponse.next();

  const path = req.nextUrl.pathname;

  // Private asset tree: allow only if a Supabase auth cookie is present.
  if (path.startsWith("/private/")) {
    const hasAuth = req.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
    return hasAuth ? NextResponse.next() : redirectHome(req);
  }

  // Page routes: refresh the Supabase session (rotates cookies onto the response).
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

export const config = {
  matcher: ["/", "/private/:path*"],
};
