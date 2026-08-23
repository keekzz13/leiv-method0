"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileVideo,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  Loader2,
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

export default function OptimizerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [mode, setMode] = useState<OptimizeMode>("lossless");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setInfo(null);
    setStage("idle");
    setProgress(0);
    setLogs([]);
    setResult(null);
    setError(null);
    setDownloadUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [downloadUrl]);

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
      setLogs([]);
      setResult(null);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }

      try {
        const engine = await getFFmpeg();
        const meta = await probeFile(engine, f);
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
    [downloadUrl]
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

    try {
      const res = await optimizeMp4(
        file,
        mode,
        (msg) => setLogs((prev) => [...prev, msg]),
        (p) => setProgress(Math.min(99, Math.round(p * 100)))
      );

      if (res.error) {
        setError(res.error);
        setResult(res);
        setStage("error");
        return;
      }

      const url = URL.createObjectURL(res.blob);
      setDownloadUrl(url);
      setResult(res);
      setProgress(100);
      setStage("done");
    } catch (e: unknown) {
      console.error(e);
      setError(
        errorMessage(e, "Something went wrong while optimizing. Please try again.")
      );
      setStage("error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Optimizer
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your video never leaves this browser tab.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {(stage === "idle" || stage === "error") && !file && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all ${
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
            <p className="text-lg font-medium text-white">Drop your MP4 here</p>
            <p className="mt-1 text-sm text-zinc-500">or click to browse</p>
            <p className="mt-6 text-xs text-zinc-600">
              MP4 · Processed on your device · Video never leaves the browser
            </p>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
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
              {stage === "probing" && (
                <div className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="animate-spin" size={16} />
                  Reading file details…
                </div>
              )}
            </div>

            {(stage === "ready" || stage === "error") && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-300">
                  Optimization mode
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("lossless")}
                    className={`rounded-2xl border p-4 text-left transition ${
                      mode === "lossless"
                        ? "border-violet-400/40 bg-violet-500/10 glow-border"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        Lossless
                      </span>
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                        Recommended
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      Keeps original video and audio when possible. Cleans up the
                      container for smoother playback.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("compatibility")}
                    className={`rounded-2xl border p-4 text-left transition ${
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
                      Use when lossless isn’t possible. May change quality.
                    </p>
                    <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-200/80">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Can reduce quality.
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={startOptimize}
                  className="mt-2 w-full rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-100 glow-btn"
                >
                  Optimize
                </button>
              </div>
            )}

            {stage === "processing" && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    Processing on your device…
                  </p>
                  <span className="text-sm tabular-nums text-violet-300">
                    {progress}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-violet-400"
                    initial={{ width: 0 }}
                    animate={{ width: progress + "%" }}
                    transition={{ ease: "easeOut" }}
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
                  Large videos may take longer. Keep this tab open.
                </p>
              </div>
            )}

            {stage === "done" && result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <div
                  className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                    result.streamCopyUsed
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <CheckCircle2 size={18} />
                  {result.streamCopyUsed
                    ? "Lossless optimization completed — original quality kept"
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
                      Optimized
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
                          {result.streamCopyUsed ? "Lossless" : "Compatibility"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Quick-start</dt>
                        <dd className="text-zinc-200">
                          {result.fastStartVerified
                            ? "Verified"
                            : "Not confirmed"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href={downloadUrl || "#"}
                    download={
                      file.name.replace(/\.mp4$/i, "") + "-leiv-optimized.mp4"
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-medium text-black transition hover:bg-zinc-100 glow-btn"
                  >
                    <Download size={16} />
                    Download Optimized MP4
                  </a>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                  >
                    Optimize Another
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
                    setMode("compa
