export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        Your videos stay yours.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        Leiv Method is designed so that your media never leaves your device during optimization.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-white">Local processing</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            All supported optimization runs inside your browser using FFmpeg compiled to
            WebAssembly. The video file is read into browser memory, processed there, and
            the result is offered as a downloadable Blob. No server receives your video for
            processing.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">No video uploads</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            We do not operate a backend that accepts or stores your MP4 files for optimization.
            Closing or refreshing the page discards temporary in-memory processing data.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">What we may collect</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            This static site may use privacy-friendly analytics (page views only) if enabled
            in the future. We never send video content, filenames of your media, or processing
            results to analytics services.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">Device limits</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Processing depends on your browser and device capabilities (memory, CPU). Very
            large files may fail or be slow on phones and low-memory devices. That is a
            client-side constraint, not a server limit.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            For privacy questions about this project, open an issue on the project repository
            or contact the maintainers through the channels listed on the About page.
          </p>
        </section>
      </div>
    </div>
  );
}
