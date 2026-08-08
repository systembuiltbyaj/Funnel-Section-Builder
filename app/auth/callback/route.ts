import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every Supabase auth email — confirmation, magic link and
 * password recovery all come back here with a one-time `code`.
 *
 * Without this route those links resolve to a page that ignores the code, the
 * session is never established, and the user is bounced to the login screen
 * with no explanation.
 *
 * `next` is validated as a relative path before use: it arrives in the URL and
 * would otherwise be an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requested = searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/?error=auth_unavailable`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
