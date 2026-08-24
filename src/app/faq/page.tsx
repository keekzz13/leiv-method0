"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const faqs = [
  {
    q: "Does this cause any quality loss?",
    a: "No. Leiv Method only patches the MP4 container structure. Your video and audio data stay completely untouched — zero quality loss. Perfect for posting to TikTok.",
  },
  {
    q: "Is it really faster?",
    a: "Yes. Because there is no re-encoding, processing is nearly instant. That’s why we say 99% faster than normal tools.",
  },
  {
    q: "Does my video get uploaded anywhere?",
    a: "Never. Everything runs in your browser. Your file never leaves your device.",
  },
  {
    q: "How do I upload for maximum quality on TikTok?",
    a: "Use Edge (desktop mode on phone) → go to tiktok.com/upload → upload the patched file → keep HD mode on → post. This is the method for maximizing quality.",
  },
  {
    q: "Is it free?",
    a: "Always free. No accounts, no limits. 100% support @vennngod1 to keep it going.",
  },
  {
    q: "What formats are supported?",
    a: "MP4 (and most MOV/M4V files that use the MP4 container). Other formats are not supported yet.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease }}
        className="mb-12 text-center"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          FAQ
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          99% Faster · No Encoding Needed · Always Free
        </p>
      </motion.div>

      <div className="space-y-3">
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.7, ease }}
              className={`overflow-hidden rounded-2xl border duration-500 ease-out ${
                isOpen
                  ? "border-white/15 bg-white/[0.04]"
                  : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.035]"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-white">{item.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.4, ease }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-zinc-400"
                >
                  +
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/5 px-5 pb-5 pt-3 text-sm leading-relaxed text-zinc-400">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease }}
        className="mt-12 text-center text-sm text-zinc-500"
      >
        100% support{" "}
        <a
          href="https://www.tiktok.com/@vennngod1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline underline-offset-4 duration-500 ease-out hover:text-zinc-200"
        >
          @vennngod1
        </a>{" "}
        to continue
      </motion.p>
    </div>
  );
}
