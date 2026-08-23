"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { href: "/optimizer", label: "Optimizer" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/privacy", label: "Privacy" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl border border-white/5 bg-black/60 px-4 py-2.5 backdrop-blur-xl glow-border">
        <Link href="/" className="text-sm font-semibold tracking-tight text-white">
          Leiv Method
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:block">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
            Beta · Free
          </span>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-lg p-2 text-zinc-300 hover:bg-white/5 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-2xl border border-white/5 bg-black/90 p-3 backdrop-blur-xl md:hidden"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm ${
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
