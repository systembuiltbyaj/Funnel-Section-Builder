import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HubShell } from "../hub/shell";
import { ReviewPicks } from "./review-picks";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Review picks · Funnel Section Builder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/");

  return (
    <HubShell
      step={2}
      title="Here's the funnel we'd build"
      blurb="Each section below was chosen from your copy, with the reason it was picked. Swap a variation, edit the copy, or drop anything that doesn't fit — then build it."
    >
      <ReviewPicks />
    </HubShell>
  );
}
