"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Sparkles } from "lucide-react";

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
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          99% Faster · No Encoding Needed · Always Free
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          Zero quality loss
          <br />
          <span className="text-zinc-400">on TikTok posts.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg"
        >
          Leiv Method patches your MP4 structure instantly — no re-encoding, no
          quality loss. Your video stays frame-perfect for TikTok.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/optimizer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-100"
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
          100% support{" "}
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-4 transition hover:text-zinc-200"
          >
            @vennngod1
          </a>{" "}
          to continue
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5"
        >
          {[
            { icon: Zap, label: "99% Faster", sub: "No encoding" },
            { icon: Shield, label: "Private", sub: "No uploads" },
            { icon: Sparkles, label: "Zero loss", sub: "Frame perfect" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1 bg-black/40 px-3 py-5"
            >
              <item.icon size={18} className="mb-1 text-zinc-300" />
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
              title: "Zero quality loss",
              desc: "Only the container structure is patched. Your video and audio data stay byte-for-byte identical — perfect for TikTok posts.",
            },
            {
              title: "99% faster",
              desc: "No re-encoding. Processing finishes in seconds even on large files. Always free, no limits.",
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
