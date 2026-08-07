import type { Metadata } from "next";
import { isAuthenticated } from "./actions";
import { PrivateGate } from "./private-gate";
import { PrivateContent } from "./private-content";

export const metadata: Metadata = {
  title: "Private, Funnel Section Builder",
  description: "Wireframe reference + copy-ready prompts for every funnel section. Restricted access.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PrivatePage() {
  const authed = await isAuthenticated();
  if (!authed) return <PrivateGate />;
  return <PrivateContent />;
}
