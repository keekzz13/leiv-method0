import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 px-4 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <p className="text-sm font-semibold text-white">Leiv Method</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Private, browser-based MP4 optimization. Your videos stay on your device.
          </p>
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
          >
            Support — Follow @vennngod1 on TikTok
          </a>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
          <Link href="/optimizer" className="transition-colors hover:text-white">
            Optimizer
          </Link>
          <Link href="/how-it-works" className="transition-colors hover:text-white">
            How It Works
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
          <Link href="/about" className="transition-colors hover:text-white">
            About
          </Link>
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            TikTok
          </a>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-white/5 pt-6">
        <p className="text-xs leading-relaxed text-zinc-600">
          Lossless mode preserves compatible media without re-encoding during local
          processing. Apps like TikTok may still process or re-encode videos after upload.
          Leiv Method is in beta — expect occasional bugs.
        </p>
      </div>
    </footer>
  );
}
