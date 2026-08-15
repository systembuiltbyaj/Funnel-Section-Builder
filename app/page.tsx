import type { Metadata } from "next";
import { Gallery } from "./gallery/gallery";

export const metadata: Metadata = {
  title: "Funnel Section Templates — 10P Framework",
  description:
    "110 ready-made funnel sections across the 12 groups of the 10P Sales Page Framework, plus 64 browse-only extras. Preview live, recolour to your brand, and take a copy-ready prompt.",
};

export default function Home() {
  return <Gallery />;
}
