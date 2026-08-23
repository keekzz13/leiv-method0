import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Leiv Method — TikTok Upload Method | 1080p60 Quality Prep",
  description:
    "Prepare MP4s for TikTok: H.264 High, 1080×1920, 60 fps, ~12 Mbps, AAC. Private browser processing. Maximize quality before TikTok’s compressor.",
  keywords: [
    "TikTok upload method",
    "TikTok 1080p 60fps",
    "TikTok compressor",
    "TikTok no quality loss",
    "CompressBase alternative",
    "MP4 quality preserver",
    "browser video tool",
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
