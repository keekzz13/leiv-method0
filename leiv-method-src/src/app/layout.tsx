import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Leiv Method — Private Lossless MP4 Optimizer",
  description:
    "Optimize your MP4 container locally in your browser. No uploads. Lossless stream copy when supported. Your videos stay on your device.",
  keywords: ["MP4 optimizer", "lossless remux", "fast start", "browser video tool", "privacy"],
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
