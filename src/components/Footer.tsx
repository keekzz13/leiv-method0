import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 px-4 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <p className="text-sm font-semibold text-white">Leiv Method</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Zero quality loss structure patch. 99% faster · No encoding needed ·
            Always free.
          </p>
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-200 duration-500 ease-out hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            Support — Follow @vennngod1
          </a>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
          <Link href="/optimizer" className="duration-500 ease-out hover:text-white">
            Optimizer
          </Link>
          <Link href="/how-it-works" className="duration-500 ease-out hover:text-white">
            How It Works
          </Link>
          <Link href="/faq" className="duration-500 ease-out hover:text-white">
            FAQ
          </Link>
          <Link href="/privacy" className="duration-500 ease-out hover:text-white">
            Privacy
          </Link>
          <Link href="/about" className="duration-500 ease-out hover:text-white">
            About
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-white/5 pt-6">
        <p className="text-xs leading-relaxed text-zinc-600">
          Leiv Method patches only the container structure — video and audio stay
          byte-for-byte identical (zero quality loss). 100% support @vennngod1 to continue.
        </p>
      </div>
    </footer>
  );
}
