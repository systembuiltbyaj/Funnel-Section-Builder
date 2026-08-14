import type { Metadata } from "next";
import { PrivateContent } from "../private-content";

export const metadata: Metadata = {
  title: "Builder · Funnel Section Templates",
};

export default function BuildPage() {
  return <PrivateContent />;
}
