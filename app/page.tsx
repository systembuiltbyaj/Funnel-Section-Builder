import type { Metadata } from "next";
import { Suspense } from "react";
import { Shell } from "./shell";

export const metadata: Metadata = {
  title: "Funnel Section Builder — 10P Framework",
  description:
    "110 ready-made funnel sections across the 12 groups of the 10P Sales Page Framework, plus 64 browse-only extras. Preview live, recolour to your brand, and take a copy-ready prompt.",
};

export default function Home() {
  // useSearchParams needs a Suspense boundary to keep the page statically
  // renderable; without it Next opts the whole route into dynamic rendering.
  return (
    <Suspense fallback={null}>
      <Shell />
    </Suspense>
  );
}
