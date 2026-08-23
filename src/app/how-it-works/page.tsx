"use client";

import { motion } from "framer-motion";
import { Upload, Search, Settings2, Download } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Select",
    desc: "Choose an MP4 from your device. The file stays in your browser only.",
  },
  {
    icon: Search,
    title: "Analyze",
    desc: "Leiv Method reads the file structure and media tracks locally on your device.",
  },
  {
    icon: Settings2,
    title: "Optimize",
    desc: "When possible, original video and audio are kept as-is while the container is cleaned up for smoother playback. Compatibility mode is only used if you choose it.",
  },
  {
    icon: Download,
    title: "Download",
    desc: "Get the optimized MP4 straight from your browser — nothing was uploaded to a server.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          How it works
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Simple, private, and straightforward.
        </p>
      </div>

      <div className="space-y-6">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-5 rounded-2xl border border-white/6 bg-white/[0.02] p-5 transition hover:border-white/10"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <s.icon size={20} className="text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-base font-medium text-white">{s.title}</h2>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-white/6 bg-white/[0.02] p-6">
        <h3 className="text-sm font-medium text-white">A quick note</h3>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          A video file has the actual picture and sound data, plus a container that organizes
          them. Leiv Method can clean up that container without changing the picture and sound
          when lossless mode succeeds. Apps you upload to later may still process the file on
          their side — that part is outside this tool.
        </p>
      </div>
    </div>
  );
}
