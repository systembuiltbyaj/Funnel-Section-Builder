import type { Metadata } from "next";
import { isAuthenticated } from "./actions";
import { PrivateGate } from "./private-gate";
import { PrivateContent } from "./private-content";
import { AuthGate } from "./auth-gate";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Funnel Section Builder",
  description:
    "Wireframe reference + copy-ready prompts for every funnel section. Restricted access.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  // Full-stack path: real Supabase accounts.
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase!.auth.getUser();
    if (!user) return <AuthGate />;
    return <PrivateContent />;
  }

  // Fallback: shared passcode gate (Phase 1, when Supabase env is absent).
  const authed = await isAuthenticated();
  if (!authed) return <PrivateGate />;
  return <PrivateContent />;
}
