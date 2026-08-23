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
          Leiv Method · TikTok Video ReEncoder · Always Free
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Patch video with
          <br />
          <span className="text-gradient">Leiv Method.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg"
        >
          TikTok video reencoder built for no quality loss uploads.
          1080p60 · H.264 High · private on your device — nothing leaves the
          browser.
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
            Patch with Leiv Method
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
          >
            How it works
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-8 text-sm text-zinc-500"
        >
          Support the tool ·{" "}
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
            { icon: Sparkles, label: "1080p60", sub: "No quality loss" },
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
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "TikTok video reencoder",
              desc: "Leiv Method patches your MP4 to 1080×1920, 60 fps, H.264 High — the format TikTok handles best for sharper posts.",
            },
            {
              title: "No quality loss focus",
              desc: "Built so your file stays sharp through TikTok’s pipeline. Use Edge or Chrome desktop upload for the best result.",
            },
            {
              title: "100% on your device",
              desc: "Everything runs in the browser. Your video never leaves this tab. Close it and temporary data is gone.",
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
