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
} from "lucide-react";
import { prepareForTikTok } from "@/lib/prepare";

type Stage = "idle" | "loading" | "selected" | "processing" | "done" | "error";
type Mode = "encode" | "remux";

const ease = [0.22, 1, 0.36, 1] as const;

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

export default function OptimizerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outSize, setOutSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<Mode>("encode");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [previewUrl, downloadUrl]);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    fileRef.current = null;
    setFileName("");
    setFileSize(0);
    setPreviewUrl(null);
    setStage("idle");
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
    setOutSize(0);
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl, downloadUrl]);

  const handleFile = useCallback(
    async (f: File) => {
      const name = (f.name || "").toLowerCase();
      const okType =
        f.type.includes("mp4") ||
        f.type.includes("quicktime") ||
        name.endsWith(".mp4") ||
        name.endsWith(".mov") ||
        name.endsWith(".m4v");

      if (!okType) {
        setError("Please select an MP4 / MOV file.");
        setStage("error");
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);

      fileRef.current = f;
      setFileName(f.name);
      setFileSize(f.size);
      setStage("selected");
      setProgress(0);
      setError(null);
      setDownloadUrl(null);
      setOutSize(0);

      try {
        const previewBlob = f.slice(0, f.size, f.type || "video/mp4");
        setPreviewUrl(URL.createObjectURL(previewBlob));
      } catch {
        /* preview optional */
      }
    },
    [previewUrl, downloadUrl]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const startPrepare = async () => {
    const file = fileRef.current;
    if (!file) {
      setError("No video loaded. Please re-select the file.");
      setStage("error");
      return;
    }

    setStage("processing");
    setProgress(2);
    setError(null);

    try {
      const result = await prepareForTikTok(file, {
        mode,
        maxHeight: 1080,
        fps: 60,
        videoBitrate: "10M",
        onProgress: (p) => setProgress(p),
      });

      setProgress(100);
      // Plain ArrayBuffer-backed copy so Blob accepts it under strict TS DOM types
      const out = new Uint8Array(result.output.byteLength);
      out.set(result.output);
      const blob = new Blob([out.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setOutSize(result.outputBytes);
      setStage("done");
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : "Prepare failed. Try a different MP4 or Remux mode.";
      setError(msg);
      setStage("error");
      setProgress(0);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="mb-10 text-center"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Leiv Method
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Prepare for TikTok · High-quality encode · Upload on desktop web
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
            1080p60 · ~10 Mbps
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
            Fast-start MP4
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
            In-browser
          </span>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {(stage === "idle" || (stage === "error" && !fileName)) && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.55, ease }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all ${
              dragOver
                ? "border-white/40 bg-white/5"
                : "border-white/10 bg-white/[0.02] duration-500 ease-out hover:border-white/20 hover:bg-white/[0.04]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Upload className="text-zinc-300" size={24} />
            </div>
            <p className="text-lg font-medium text-white">Drop your MP4 here</p>
            <p className="mt-1 text-sm text-zinc-500">or click to browse</p>
            <p className="mt-6 text-xs text-zinc-600">
              Encode shrinks big files · then post on tiktok.com (desktop)
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-2 text-xs text-amber-100/80 underline underline-offset-2"
            >
              Try another file
            </button>
          </div>
        </motion.div>
      )}

      {fileName && stage !== "idle" && stage !== "loading" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <FileVideo className="text-zinc-300" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{fileName}</p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {formatBytes(fileSize)}
                  {outSize > 0 && stage === "done"
                    ? ` → ${formatBytes(outSize)}`
                    : ""}
                </p>
              </div>
              {stage !== "processing" && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg p-2 text-zinc-500 duration-500 ease-out hover:bg-white/5 hover:text-white"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>

            {previewUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease }}
                className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black"
              >
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="max-h-[360px] w-full object-contain"
                />
              </motion.div>
            )}
          </div>

          {stage === "selected" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("encode")}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    mode === "encode"
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400"
                  }`}
                >
                  <div className="font-semibold text-white">Encode</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Like ItzCrih ON · smaller file
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("remux")}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    mode === "remux"
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-zinc-400"
                  }`}
                >
                  <div className="font-semibold text-white">Remux only</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    Fast-start copy · already optimized
                  </div>
                </button>
              </div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                onClick={startPrepare}
                className="w-full rounded-2xl bg-white py-4 text-sm font-semibold text-black duration-500 ease-out hover:bg-zinc-100"
              >
                {mode === "encode" ? "Prepare for TikTok" : "Remux (fast-start)"}
              </motion.button>
            </>
          )}

          {stage === "processing" && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <p className="mb-3 text-center text-sm text-zinc-400">
                {mode === "encode"
                  ? "Encoding in browser… first run loads FFmpeg (may take a minute)"
                  : "Remuxing…"}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all duration-300"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <p className="mt-2 text-center text-xs text-zinc-500">
                {Math.min(100, Math.round(progress))}%
              </p>
            </div>
          )}

          {stage === "done" && downloadUrl && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-300/90">
                <CheckCircle2 size={18} />
                Ready — upload on tiktok.com (desktop), no in-app edits
              </div>
              <a
                href={downloadUrl}
                download={fileName.replace(/\.\w+$/, "") + "-tiktok.mp4"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-semibold text-black hover:bg-zinc-100"
              >
                <Download size={18} />
                Download prepared MP4
              </a>
              <button
                type="button"
                onClick={reset}
                className="w-full py-2 text-xs text-zinc-500 underline underline-offset-2"
              >
                Prepare another
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
