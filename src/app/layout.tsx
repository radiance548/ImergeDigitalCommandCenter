import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./globals.css";

// Self-hosted by Next at build time (no runtime request to Google Fonts),
// and imported here rather than via a CSS @import in globals.css — a CSS
// @import is a second render-blocking round trip discovered only after the
// browser has already fetched and parsed globals.css. Same reasoning for
// moving the Font Awesome stylesheet import here instead of globals.css.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Imerge Command Center",
  description: "Agency operations & analytics command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
