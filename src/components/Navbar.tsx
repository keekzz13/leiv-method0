"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { href: "/optimizer", label: "Optimizer" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/about", label: "About" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  // Sliding active pill
  useEffect(() => {
    const container = navRef.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>(`[data-active="true"]`);
    if (!active) {
      setIndicator((s) => ({ ...s, opacity: 0 }));
      return;
    }

    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    setIndicator({
      left: aRect.left - cRect.left,
      width: aRect.width,
      opacity: 1,
    });
  }, [pathname, open]);

  // Recalc on resize
  useEffect(() => {
    const onResize = () => {
      const container = navRef.current;
      if (!container) return;
      const active = container.querySelector<HTMLElement>(`[data-active="true"]`);
      if (!active) return;
      const cRect = container.getBoundingClientRect();
      const aRect = active.getBoundingClientRect();
      setIndicator({
        left: aRect.left - cRect.left,
        width: aRect.width,
        opacity: 1,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav className="relative mx-auto flex max-w-5xl items-center justify-between overflow-hidden rounded-2xl border border-white/5 bg-black/60 px-4 py-2.5 backdrop-blur-xl">
        <Link
          href="/"
          className="relative z-10 text-sm font-semibold tracking-tight text-white duration-500 ease-out hover:opacity-75"
        >
          Leiv Method
        </Link>

        {/* Desktop links + sliding indicator */}
        <div ref={navRef} className="relative z-10 hidden items-center gap-1 md:flex">
          {/* Sliding background pill */}
          <motion.div
            className="pointer-events-none absolute top-0 h-full rounded-full bg-white/10"
            animate={{
              left: indicator.left,
              width: indicator.width,
              opacity: indicator.opacity,
            }}
            transition={{ duration: 0.55, ease }}
          />

          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                data-active={active ? "true" : "false"}
                className={`relative z-10 rounded-full px-3.5 py-1.5 text-sm duration-500 ease-out ${
                  active ? "text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="relative z-10 hidden md:block">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
            Always Free
          </span>
        </div>

        <button
          type="button"
          className="relative z-10 rounded-lg p-2 text-zinc-300 duration-500 ease-out hover:bg-white/5 hover:text-white md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease }}
            className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-2xl border border-white/5 bg-black/90 p-3 backdrop-blur-xl md:hidden"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm duration-500 ease-out ${
                  pathname === l.href
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
