export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        About Leiv Method
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        Leiv Method is a free browser tool that patches MP4 structure for zero
        quality loss when posting to TikTok. No re-encoding. No uploads. Always free.
      </p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-400">
        <p>
          <strong className="text-zinc-200">What it does.</strong> It rewrites only
          the container metadata (sample tables, offsets, etc.). Your actual video
          and audio data stay completely untouched — frame-perfect output every time.
        </p>
        <p>
          <strong className="text-zinc-200">Zero quality loss on TikTok.</strong>{" "}
          Because nothing is re-encoded by the tool, you keep full original quality
          going into the upload. Pair it with the recommended Edge desktop upload
          + HD mode for the best result.
        </p>
        <p>
          <strong className="text-zinc-200">99% faster · No encoding needed · Always free.</strong>{" "}
          Processing happens instantly in your browser. No accounts, no limits, no cost.
        </p>
        <p>
          <strong className="text-zinc-200">100% support @vennngod1 to continue.</strong>{" "}
          This tool stays free because of community support. Follow{" "}
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-4 hover:text-zinc-200"
          >
            @vennngod1
          </a>{" "}
          on TikTok.
        </p>
      </div>
    </div>
  );
}
