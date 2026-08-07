import type { Metadata } from "next";
import { PrivateContent } from "./private-content";
import { AuthGate } from "./auth-gate";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Funnel Section Builder",
  description:
    "Turn the 10P Sales Page Framework into copy-ready AI prompts for every funnel section.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return <AuthGate />;
  return <PrivateContent />;
}
