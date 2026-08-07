import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HubShell } from "../hub/shell";
import { SectionLibrary } from "../hub/library";
import { FunnelTray } from "../hub/funnel-tray";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Choose sections · Funnel Section Builder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SectionsPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/");

  return (
    <HubShell
      step={2}
      title="Choose your sections"
      blurb="The full 10P framework, in funnel order. Add what fits — your picks collect at the bottom and carry through to the builder."
    >
      <SectionLibrary />
      <FunnelTray />
    </HubShell>
  );
}
