export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        Your videos stay yours.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        Leiv Method is built so your media never leaves your device during optimization.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-white">Local processing</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Optimization runs in your browser on your device. Your file is handled in memory
            here, then offered as a download. We don’t run a server that receives your video
            for processing.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">No video uploads</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            We don’t store your MP4s for optimization. Closing or refreshing the page clears
            temporary in-browser processing data.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">What we may collect</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            This site may use basic privacy-friendly page analytics later. We never send your
            video content or processing results to analytics.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">Device limits</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Results depend on your browser and device (memory, CPU). Very large files may be
            slow or fail on phones — that’s a device limit, not a server limit.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">Support</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Questions or feedback? Follow{" "}
            <a
              href="https://www.tiktok.com/@vennngod1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 hover:underline"
            >
              @vennngod1 on TikTok
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
