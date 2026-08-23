"use client";

import { motion } from "framer-motion";
import { Upload, Cpu, Download, Monitor } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Drop your MP4",
    desc: "Select a video from your device. It stays in your browser only — nothing is uploaded.",
  },
  {
    icon: Cpu,
    title: "Instant structure patch",
    desc: "Leiv Method rewrites only the container metadata. No re-encoding. Zero quality loss. 99% faster than normal tools.",
  },
  {
    icon: Download,
    title: "Download",
    desc: "Get the patched file straight from your browser. Video and audio are frame-perfect.",
  },
  {
    icon: Monitor,
    title: "Upload the right way",
    desc: "Use Edge (desktop mode on phone) → tiktok.com/upload → HD mode on → post. This is the method for maximizing quality.",
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
          99% Faster · No Encoding Needed · Always Free
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <s.icon size={20} className="text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-base font-medium text-white">{s.title}</h2>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {s.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-white/6 bg-white/[0.02] p-6">
        <h3 className="text-sm font-medium text-white">
          Method upload for maximizing quality
        </h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
          <li>
            Open Edge on your phone/PC (on phone: turn on desktop mode).
          </li>
          <li>
            Go to{" "}
            <a
              href="https://www.tiktok.com/upload"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-4"
            >
              tiktok.com/upload
            </a>
          </li>
          <li>Upload the patched file.</li>
          <li>HD mode is on by default — post and enjoy.</li>
        </ol>
        <p className="mt-5 text-sm text-zinc-500">
          100% support{" "}
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-4 hover:text-zinc-200"
          >
            @vennngod1
          </a>{" "}
          to continue.
        </p>
      </div>
    </div>
  );
}
