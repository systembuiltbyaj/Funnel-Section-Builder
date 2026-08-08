import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrivateContent } from "../private-content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Builder · Funnel Section Builder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect("/");
  return <PrivateContent />;
}
