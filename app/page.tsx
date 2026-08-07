import type { Metadata } from "next";
import { AuthGate } from "./auth-gate";
import { HubShell } from "./hub/shell";
import { StartFunnel } from "./hub/start";
import { SavedFunnels } from "./hub/saved-funnels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Funnel Section Builder",
  description:
    "Paste a client's funnel copy and get a recommended 10P section stack with copy-ready AI prompts.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return <AuthGate />;

  return (
    <HubShell
      step={1}
      title="Start a funnel"
      blurb="Paste the client's copy and set the brand. You'll get a recommended section stack to review — nothing is built until you approve it."
    >
      <StartFunnel />
      <SavedFunnels />
    </HubShell>
  );
}
