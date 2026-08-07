import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Server-side Supabase client bound to the request cookies.
 * Returns null when Supabase env vars are absent, so the app still runs on the
 * passcode gate alone (Phase 1) until the full-stack layer is configured.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware/route
            // handlers refresh the session cookie.
          }
        },
      },
    }
  );
}
