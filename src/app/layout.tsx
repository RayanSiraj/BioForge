import type { Metadata } from "next";
import "./globals.css";
import { display, sans, mono } from "./fonts";

// Minimal root layout: fonts + globals only. No product chrome and no marketing
// chrome here — each route group owns its own layout so the two surfaces stay
// cleanly separated.
export const metadata: Metadata = {
  title: "BioForge",
  description:
    "Computational discovery and validation of plastic-degrading enzymes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
