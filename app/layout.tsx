import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FunnelSelectionProvider } from "@/lib/funnel-selection-provider";
import { CATALOGUE, INITIAL_SEL } from "@/lib/catalogue";

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

// No blanket noindex: signup is open, so the landing page should be findable.
// The authed surfaces (/build, /private/*) set their own noindex.
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
        <FunnelSelectionProvider catalogue={CATALOGUE} initialSel={INITIAL_SEL}>
          {children}
        </FunnelSelectionProvider>
      </body>
    </html>
  );
}
