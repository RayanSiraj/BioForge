import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

// Display / headings — technical grotesque, deep-tech voice.
export const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Body — highly legible neutral sans.
export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Data / sequences / metrics — monospace with tabular figures.
export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});
