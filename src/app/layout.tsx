import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Leiv Method — TikTok MP4 Quality Preserver | No Quality Loss Optimizer",
  description:
    "Private browser tool that optimizes MP4s for TikTok without re-encoding when possible. Keep original quality, faster start, zero uploads. Lossless stream-copy mode.",
  keywords: [
    "TikTok compressor",
    "TikTok no quality loss",
    "MP4 quality preserver",
    "lossless MP4 optimizer",
    "TikTok video optimizer",
    "fast start MP4",
    "browser video tool",
    "privacy",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="ambient-bg" aria-hidden />
        <div className="grid-overlay" aria-hidden />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
