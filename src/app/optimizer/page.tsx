"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileVideo,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  X,
  ExternalLink,
} from "lucide-react";
import {
  MediaInfo,
  OptimizeMode,
  OptimizeResult,
  optimizeMp4,
  probeFile,
  getFFmpeg,
} from "@/lib/ffmpeg";

type Stage =
  | "idle"
  | "selected"
  | "probing"
  | "ready"
  | "processing"
  | "done"
  | "error";

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function formatDuration(s?: number) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ":" + sec.toString().padStart(2, "0");
}

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return fallback;
}

const TIKTOK_FOLLOW_URL = "https://www.tiktok.com/@vennngod1";

const ease = [0.22, 1, 0.36, 1] as const;

export default function OptimizerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [mode, setMode] = useState<OptimizeMode>("tiktok");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showFollowPopup, setShowFollowPopup] = useState(false);

  const stopFakeProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  /** ffmpeg.wasm often reports 0% during long encodes — simulate steady progress */
  const startFakeProgress = useCallback(() => {
    stopFakeProgress();
    setProgress(2);
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        // Slow asymptotic crawl so it never hits 100 until real finish
        const step = p < 30 ? 1.2 : p < 60 ? 0.7 : p < 80 ? 0.35 : 0.15;
        return Math.min(92, p + step);
      });
    }, 400);
  }, [stopFakeProgress]);

  useEffect(() => {
    return () => stopFakeProgress();
  }, [stopFakeProgress]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getFFmpeg((ratio) => {
          if (!cancelled) setLoadProgress(Math.round(ratio * 40));
        });
        if (!cancelled) {
          setEngineReady(true);
          setLoadProgress(40);
        }
      } catch {
        // user can still try later
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = useCallback(() => {
    stopFakeProgress();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setInfo(null);
    setStage("idle");
    setProgress(0);
    setLoadProgress(engineReady ? 40 : 0);
    setLogs([]);
    setResult(null);
    setError(null);
    setDownloadUrl(null);
    setShowFollowPopup(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [downloadUrl, engineReady, stopFakeProgress]);

  const handleFile = useCallback(
    async (f: File) => {
      if (!f.type.includes("mp4") && !f.name.toLowerCase().endsWith(".mp4")) {
        setError("Please select an MP4 file.");
        setStage("error");
        return;
      }
      if (f.size > 500 * 1024 * 1024) {
        setError(
          "This file is very large (>500 MB). Processing may be slow or fail on devices with limited memory."
        );
      } else {
        setError(null);
      }

      setFile(f);
      setStage("probing");
      setLoadProgress(engineReady ? 40 : 0);
      setLogs([]);
      setResult(null);
      setShowFollowPopup(false);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }

      try {
        const engine = await getFFmpeg((ratio) => {
          setLoadProgress(Math.min(70, 40 + Math.round(ratio * 30)));
        });
        setLoadProgress(75);
        const meta = await probeFile(engine, f);
        setLoadProgress(100);
        setInfo(meta);
        setStage("ready");
      } catch (e) {
        console.error(e);
        setInfo({ name: f.name, size: f.size });
        setStage("ready");
        setLogs((prev) => [
          ...prev,
          "[!] Couldn’t read full details — you can still try optimizing",
        ]);
        setError(
          errorMessage(
            e,
            "Couldn’t fully analyze this file. You can still try optimizing."
          )
        );
      }
    },
    [downloadUrl, engineReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const startOptimize = async () => {
    if (!file) return;
    setStage("processing");
    setProgress(0);
    setLogs([]);
    setError(null);
    setShowFollowPopup(false);
    startFakeProgress();

    try {
      const res = await optimizeMp4(
        file,
        mode,
        (msg) => setLogs((prev) => [...prev, msg]),
        (p) => {
          // Prefer real progress when ffmpeg reports meaningful values
          const pct = Math.round(p * 100);
          if (pct > 5) {
            setProgress((prev) => Math.max(prev, Math.min(99, pct)));
          }
        }
      );

      stopFakeProgress();

      if (res.error) {
        setError(res.error);
        setResult(res);
        setStage("error");
        setProgress(0);
        return;
      }

      const url = URL.createObjectURL(res.blob);
      setDownloadUrl(url);
      setResult(res);
      setProgress(100);
      setStage("done");
      setTimeout(() => setShowFollowPopup(true), 800);
    } catch (e: unknown) {
      stopFakeProgress();
      console.error(e);
      setError(
        errorMessage(e, "Something went wrong while optimizing. Please try again.")
      );
      setStage("error");
      setProgress(0);
    }
  };

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-12 md:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Patch video with Leiv Method
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          TikTok video reencoder · No quality loss · 1080p60 is fine
        </p>
      </div>

      <AnimatePresence mode="wait">
        {(stage === "idle" || stage === "error") && !file && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.45, ease }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
              dragOver
                ? "border-violet-400/50 bg-violet-500/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,.mp4"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Upload className="text-zinc-300" size={24} />
            </div>
            <p className="text-lg font-medium text-white">
              Drop your video here
            </p>
            <p className="mt-1 text-sm text-zinc-500">or click to browse</p>
            <p className="mt-6 text-xs text-zinc-600">
              MP4 · Leiv Method · Private on-device reencoder
            </p>
            {!engineReady && (
              <p className="mt-3 text-xs text-violet-300/80">
                Preparing engine in the background…
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && stage === "error" && !result && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {(stage === "probing" ||
        stage === "ready" ||
        stage === "processing" ||
        stage === "done" ||
        (stage === "error" && file)) &&
        file && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                  <FileVideo className="text-violet-300" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{file.name}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {formatBytes(file.size)}
                    {stage === "probing" && " · Analyzing…"}
                  </p>
                </div>
                {stage !== "processing" && (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                    title="Clear"
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>

              {stage === "probing" && (
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-zinc-400">
                        {loadProgress < 45
                          ? "Loading engine…"
                          : "Reading file details…"}
                      </span>
                      <span className="tabular-nums text-violet-300">
                        {loadProgress}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-violet-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${loadProgress}%` }}
                        transition={{ ease: "easeOut", duration: 0.4 }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-black/30 px-3 py-2"
                      >
                        <div className="skeleton h-3 w-12" />
                        <div className="skeleton mt-2 h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {info && stage !== "probing" && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: "Resolution",
                      value:
                        info.width && info.height
                          ? info.width + "×" + info.height
                          : "—",
                    },
                    {
                      label: "FPS",
                      value: info.fps ? info.fps.toFixed(2) : "—",
                    },
                    {
                      label: "Duration",
                      value: formatDuration(info.duration),
                    },
                    {
                      label: "Video",
                      value: info.videoCodec || "—",
                    },
                    {
                      label: "Audio",
                      value: info.audioCodec || "—",
                    },
                    {
                      label: "Bitrate",
                      value: info.bitrate
                        ? Math.round(info.bitrate / 1000) + " kb/s"
                        : "—",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl bg-black/30 px-3 py-2"
                    >
                      <p className="text-[11px] text-zinc-500">{m.label}</p>
                      <p className="mt-0.5 text-sm font-medium text-zinc-200">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(stage === "ready" || stage === "error") && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-300">
                  Choose method
                </p>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("tiktok")}
                    className={`rounded-2xl border p-4 text-left transition duration-300 ${
                      mode === "tiktok"
                        ? "border-violet-400/40 bg-violet-500/10 glow-border"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        Leiv Method (TikTok Reencoder)
                      </span>
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                        Recommended
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      <strong className="text-zinc-300">
                        1080×1920 · 60 fps · H.264 High · ~15 Mbps · fast encode
                      </strong>
                      <br />
                      Max quality for TikTok — keeps 60 fps (not 30). High
                      bitrate + ultrafast preset = strong source, as fast as
                      browser WASM allows.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("lossless")}
                    className={`rounded-2xl border p-4 text-left transition duration-300 ${
                      mode === "lossless"
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        Lossless (container only)
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      Stream-copy + faststart only. Fast — no re-encode.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("compatibility")}
                    className={`rounded-2xl border p-4 text-left transition duration-300 ${
                      mode === "compatibility"
                        ? "border-amber-400/40 bg-amber-500/10"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        Compatibility
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      Fallback re-encode if Leiv Method path fails.
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={startOptimize}
                  className="mt-2 w-full rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-100 glow-btn"
                >
                  {mode === "tiktok"
                    ? "Patch with Leiv Method"
                    : mode === "lossless"
                      ? "Run Lossless"
                      : "Run Compatibility"}
                </button>
              </div>
            )}

            {stage === "processing" && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    {mode === "tiktok"
                      ? "Patching with Leiv Method (fast max · 1080p60)…"
                      : "Processing on your device…"}
                  </p>
                  <span className="text-sm tabular-nums text-violet-300">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full rounded-full bg-violet-400 ${
                      progress < 8 ? "progress-waiting" : ""
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(progress, 3)}%` }}
                    transition={{ ease: "easeOut", duration: 0.5 }}
                  />
                </div>
                <div className="mt-5 max-h-40 overflow-y-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                  {logs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-zinc-600">Starting…</div>
                  )}
                </div>
                <p className="mt-4 text-xs text-zinc-600">
                  Keep this tab open. Re-encode can take a few minutes on longer
                  clips — progress may move slowly while encoding.
                </p>
              </div>
            )}

            {stage === "done" && result && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="space-y-5"
              >
                <div
                  className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                    result.mode === "tiktok"
                      ? "border-violet-500/25 bg-violet-500/10 text-violet-200"
                      : result.streamCopyUsed
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <CheckCircle2 size={18} />
                  {result.mode === "tiktok"
                    ? "Leiv Method patch complete — ready for TikTok"
                    : result.streamCopyUsed
                      ? "Lossless optimization completed"
                      : "Compatibility processing completed"}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Original
                    </p>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Size</dt>
                        <dd className="text-zinc-200">
                          {formatBytes(file.size)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Resolution</dt>
                        <dd className="text-zinc-200">
                          {info?.width && info?.height
                            ? info.width + "×" + info.height
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Codec</dt>
                        <dd className="text-zinc-200">
                          {info?.videoCodec || "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-violet-300/80">
                      After Leiv Method
                    </p>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Size</dt>
                        <dd className="text-zinc-200">
                          {formatBytes(result.outputSize)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Mode</dt>
                        <dd className="text-zinc-200">
                          {result.mode === "tiktok"
                            ? "Leiv Method"
                            : result.streamCopyUsed
                              ? "Lossless"
                              : "Compatibility"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Path</dt>
                        <dd className="text-zinc-200">
                          {result.videoEncoderUsed ||
                            (result.streamCopyUsed ? "stream-copy" : "—")}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Highest quality upload guide — Edge desktop mode */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm">
                  <p className="font-medium text-white">
                    How to get the highest quality on TikTok
                  </p>
                  <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-xs leading-relaxed text-zinc-400">
                    <li>
                      <span className="text-zinc-300">Phone first</span> — TikTok
                      app → Profile → ☰ →{" "}
                      <strong className="text-zinc-200">
                        Settings and privacy
                      </strong>{" "}
                      → Content preferences → turn{" "}
                      <strong className="text-zinc-200">ON</strong> “Allow
                      high-quality uploads”
                    </li>
                    <li>
                      Turn <strong className="text-zinc-200">OFF</strong> Data
                      Saver (Settings → Data Saver)
                    </li>
                    <li>
                      Open <strong className="text-zinc-200">Microsoft Edge</strong>{" "}
                      (phone or PC) → request{" "}
                      <strong className="text-zinc-200">Desktop site</strong>{" "}
                      → go to{" "}
                      <a
                        href="https://www.tiktok.com/upload"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-300 underline-offset-2 hover:underline"
                      >
                        tiktok.com/upload
                      </a>{" "}
                      and log in
                    </li>
                    <li>
                      Upload the file from Leiv Method (
                      <code className="text-zinc-300">*-tiktok-ready.mp4</code>
                      )
                    </li>
                    <li>
                      Use <strong className="text-zinc-200">Wi‑Fi</strong>
                    </li>
                    <li>
                      After posting, watch on Wi‑Fi so HD loads — 1080p60 is fine
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href={downloadUrl || "#"}
                    download={
                      file.name.replace(/\.mp4$/i, "") +
                      (result.mode === "tiktok"
                        ? "-tiktok-ready.mp4"
                        : "-leiv-optimized.mp4")
                    }
                    onClick={() => {
                      setTimeout(() => setShowFollowPopup(true), 400);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-100 glow-btn"
                  >
                    <Download size={16} />
                    Download{" "}
                    {result.mode === "tiktok" ? "TikTok-ready" : "Optimized"}{" "}
                    MP4
                  </a>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                  >
                    Patch Another
                  </button>
                </div>

                <div className="max-h-32 overflow-y-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] text-zinc-500">
                  {result.logs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </motion.div>
            )}

            {stage === "error" && result?.error && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p>{result.error}</p>
                    <p className="mt-2 text-xs text-amber-200/60">
                      The original file was not modified.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("compatibility");
                    setStage("ready");
                    setError(null);
                  }}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-3 text-sm text-zinc-200 hover:bg-white/10"
                >
                  Switch to Compatibility mode
                </button>
              </div>
            )}
          </motion.div>
        )}

      {/* Follow popup */}
      <AnimatePresence>
        {showFollowPopup && stage === "done" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setShowFollowPopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowFollowPopup(false)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15">
                <CheckCircle2 className="text-violet-300" size={22} />
              </div>

              <h2 className="text-lg font-semibold text-white">
                Enjoy the tool?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Follow{" "}
                <span className="text-violet-300">@vennngod1</span> on TikTok to
                support Leiv Method — free updates keep coming.
              </p>

              <a
                href={TIKTOK_FOLLOW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium text-black transition hover:bg-zinc-100"
              >
                Follow @vennngod1 on TikTok
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                onClick={() => setShowFollowPopup(false)}
                className="mt-3 w-full py-2 text-center text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
