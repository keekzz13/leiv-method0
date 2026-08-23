export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        About Leiv Method
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        Leiv Method is a free browser tool for MP4 container optimization. It helps you tidy
        files and prepare them for smoother local playback — without sending videos to a
        remote server.
      </p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-400">
        <p>
          <strong className="text-zinc-200">Beta status.</strong> Early release. Expect bugs
          and rough edges on some devices. Feedback is welcome.
        </p>
        <p>
          <strong className="text-zinc-200">What we don’t claim.</strong> We don’t promise
          more reach, fewer restrictions, or special treatment on any social app. Those
          outcomes depend on each platform.
        </p>
        <p>
          <strong className="text-zinc-200">What we do claim.</strong> When lossless mode
          succeeds, original video and audio are kept as-is during processing — no extra
          quality loss from Leiv Method in that step. Apps you upload to later may still
          re-encode on their side.
        </p>
        <p>
          Support the project:{" "}
          <a
            href="https://www.tiktok.com/@vennngod1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300 hover:underline"
          >
            follow @vennngod1 on TikTok
          </a>
          .
        </p>
      </div>
    </div>
  );
}
