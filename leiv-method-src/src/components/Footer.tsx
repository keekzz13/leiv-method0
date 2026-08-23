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
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
          <Link href="/optimizer" className="hover:text-white transition-colors">Optimizer</Link>
          <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-white/5 pt-6">
        <p className="text-xs leading-relaxed text-zinc-600">
          Lossless processing preserves compatible media streams without re-encoding.
          External platforms may independently process or re-encode uploaded videos.
          Leiv Method is currently in beta — expect occasional bugs.
        </p>
      </div>
    </footer>
  );
}
