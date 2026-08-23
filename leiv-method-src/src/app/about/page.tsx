export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        About Leiv Method
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        Leiv Method is a free, open-minded browser tool for lossless (when possible) MP4
        container optimization. It exists so creators can tidy containers, enable fast-start,
        and clean metadata without sending files to a remote server.
      </p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-400">
        <p>
          <strong className="text-zinc-200">Beta status.</strong> This is an early release.
          Expect bugs, incomplete codec coverage, and rough edges on some devices. Feedback
          is welcome.
        </p>
        <p>
          <strong className="text-zinc-200">What we do not claim.</strong> We do not promise
          increased reach on any social platform, prevention of shadow bans, or bypassing of
          moderation. Those outcomes depend on platform-side processing that we cannot control.
        </p>
        <p>
          <strong className="text-zinc-200">What we do claim.</strong> When lossless stream
          copy succeeds, the encoded video and audio samples are copied as-is — no additional
          quality loss is introduced by Leiv Method itself during that step.
        </p>
        <p>
          Built with Next.js, React, Tailwind CSS, Framer Motion, and FFmpeg.wasm.
        </p>
      </div>
    </div>
  );
}
