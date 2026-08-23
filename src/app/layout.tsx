import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Leiv Method — TikTok Video Reencoder | No Quality Loss Prep",
  description:
    "Patch your video with Leiv Method. TikTok video reencoder — 1080p60 H.264 for maximum quality before upload. Private, on-device only.",
  keywords: [
    "TikTok video reencoder",
    "Leiv Method",
    "TikTok no quality loss",
    "TikTok 1080p 60fps",
    "TikTok upload method",
    "MP4 quality preserver",
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
