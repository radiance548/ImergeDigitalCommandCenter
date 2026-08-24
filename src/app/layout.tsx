import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imerge Command Center",
  description: "Agency operations & analytics command center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
