"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Cpu, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative">
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-24 pt-20 text-center md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
          Leiv Method v1.0 · Beta
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Optimize your MP4.
          <br />
          <span className="text-gradient">Keep every pixel.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg"
        >
          Optimize your MP4 on your device — no uploads, no servers. When lossless mode
          succeeds, original quality is preserved during processing.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-8 text-sm text-zinc-500"
        >
          Like the tool?{" "}
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300 underline-offset-4 transition hover:text-violet-200 hover:underline"
          >
            Follow @vennngod1 on TikTok
          </a>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5"
        >
          {[
            { icon: Cpu, label: "Local", sub: "On your device" },
            { icon: Shield, label: "Private", sub: "No uploads" },
            { icon: Sparkles, label: "Lossless*", sub: "When supported" },
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
          *Lossless mode keeps original video and audio when the file allows it. Upload
          apps may still re-encode on their side.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Cleaner container",
              desc: "Rebuilds the MP4 structure for smoother playback startup and tidier metadata — without changing pixels when lossless mode succeeds.",
            },
            {
              title: "Stays on your device",
              desc: "Everything runs in your browser. Nothing is sent to our servers. Close the tab and temporary data is gone.",
            },
            {
              title: "Honest results",
              desc: "We only call a result lossless when quality was actually preserved. If conversion is needed, you’ll see that clearly.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-white/6 bg-white/[0.02] p-5 transition hover:border-white/10 hover:bg-white/[0.04]"
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
