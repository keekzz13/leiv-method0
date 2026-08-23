"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Cpu, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-24 pt-20 text-center md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Leiv Method v1.0 · Beta
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Optimize your MP4.
          <br />
          <span className="text-gradient">Keep every pixel.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg"
        >
          Lossless MP4 container optimization directly in your browser.
          No uploads. No server processing. Your video stays on your device.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/optimizer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-100 glow-btn"
          >
            Start Optimizing
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
          >
            How It Works
          </Link>
        </motion.div>

        {/* Stats card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-14 grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5"
        >
          {[
            { icon: Cpu, label: "Local", sub: "Browser Processing" },
            { icon: Shield, label: "Private", sub: "No Video Uploads" },
            { icon: Sparkles, label: "Lossless*", sub: "Stream Copy" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1 bg-black/40 px-3 py-5"
            >
              <item.icon size={18} className="mb-1 text-violet-400/80" />
              <span className="text-sm font-medium text-white">{item.label}</span>
              <span className="text-[11px] text-zinc-500">{item.sub}</span>
            </div>
          ))}
        </motion.div>

        <p className="mt-4 text-xs text-zinc-600">
          *Lossless mode preserves compatible media streams without re-encoding.
        </p>
      </section>

      {/* Feature strip */}
      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Container optimization",
              desc: "Rebuild the MP4 structure, move moov atom for fast-start, and clean metadata — without touching encoded pixels when possible.",
            },
            {
              title: "Runs entirely offline",
              desc: "FFmpeg WebAssembly processes your file inside the browser. Nothing is sent to a server. Close the tab and the data is gone.",
            },
            {
              title: "Honest results",
              desc: "We only mark a result as lossless when stream copying actually succeeded. If re-encoding is required, we tell you clearly.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/6 bg-white/[0.02] p-5"
            >
              <h3 className="text-sm font-medium text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
