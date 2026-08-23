export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        Your videos stay yours.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        Leiv Method is built so your media never leaves your device.
      </p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-white">Local processing</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Everything runs in your browser on your device. Your file is read into
            memory, patched there, and offered as a download. No server ever sees
            your video.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">No video uploads</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            We don’t store your MP4s. Closing or refreshing the page clears all
            temporary in-browser data.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">Zero quality loss</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            The tool only changes container structure. Video and audio streams stay
            byte-for-byte identical — so you keep full quality when posting to TikTok.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white">Support</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            100% support{" "}
            <a
              href="https://www.tiktok.com/@vennngod1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-4 hover:text-zinc-200"
            >
              @vennngod1
            </a>{" "}
            to continue. Follow on TikTok.
          </p>
        </section>
      </div>
    </div>
  );
}
