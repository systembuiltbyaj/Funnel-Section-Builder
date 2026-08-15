import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FunnelSelectionProvider } from "@/lib/funnel-selection-provider";
import { CATALOGUE, INITIAL_SEL } from "@/lib/catalogue";
import { ColdOpen } from "./cold-open";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// No blanket noindex: this is a public, backend-free gallery — there is no
// account or gate to protect. Every route is indexable.
export const metadata: Metadata = {
  title: "Funnel Section Builder",
  description:
    "Browse ready-made funnel sections across the 10P framework and turn them into copy-ready AI prompts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans">
        {/* First child so it paints over everything. Root layout stays mounted
            across client-side navigation, so this plays once per full load. */}
        <ColdOpen />
        <FunnelSelectionProvider catalogue={CATALOGUE} initialSel={INITIAL_SEL}>
          {children}
        </FunnelSelectionProvider>
      </body>
    </html>
  );
}
