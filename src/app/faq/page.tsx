"use client";

import { useState } from "react";

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
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          FAQ
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          99% Faster · No Encoding Needed · Always Free
        </p>
      </div>

      <div className="space-y-2">
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-white"
              >
                {item.q}
                <span className="ml-4 text-zinc-500">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-white/5 px-5 pb-4 pt-3 text-sm leading-relaxed text-zinc-400">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-zinc-500">
        100% support{" "}
        <a
          href="https://www.tiktok.com/@vennngod1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline underline-offset-4 hover:text-zinc-200"
        >
          @vennngod1
        </a>{" "}
        to continue
      </p>
    </div>
  );
}
