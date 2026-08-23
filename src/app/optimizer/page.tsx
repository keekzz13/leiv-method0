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
} from "lucide-react";
import { processVideo } from "@/lib/patcher";

type Stage = "idle" | "selected" | "processing" | "done" | "error";

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

export default function OptimizerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fakeCount, setFakeCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setStage("idle");
    setProgress(0);
    setLogs([]);
    setError(null);
    setDownloadUrl(null);
    setFakeCount(0);
    if (inputRef.current) inputRef.current.value = "";
  }, [downloadUrl]);

  const handleFile = useCallback(
    (f: File) => {
      if (!f.type.includes("mp4") && !f.name.toLowerCase().endsWith(".mp4")) {
        setError("Please select an MP4 file.");
        setStage("error");
        return;
      }

      setFile(f);
      setStage("selected");
      setError(null);
      setLogs([]);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
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

  const startPatch = async () => {
    if (!file) return;
    setStage("processing");
    setProgress(10);
    setLogs(["Reading file into memory..."]);
    setError(null);

    try {
      setProgress(30);
      setLogs((prev) => [...prev, "Parsing MP4 structure..."]);

      const { blob, fakeCount, origSamples } = await processVideo(file);

      setProgress(90);
      setLogs((prev) => [
        ...prev,
        `Fake samples added: +${fakeCount.toLocaleString()}`,
        `Original samples: ${origSamples.toLocaleString()}`,
        "Patch complete ✓",
      ]);

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setFakeCount(fakeCount);
      setProgress(100);
      setStage("done");
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e instanceof Error ? e.message : "Something went wrong while patching.";
      setError(msg);
      setStage("error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Leiv Method
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pure structure patch · Zero re-encoding · Video never leaves this tab
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
              MP4 · Instant structure patch · Zero quality loss
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {file && stage !== "idle" && (
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
                </p>
              </div>
              {stage !== "processing" && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>

          {stage === "selected" && (
            <button
              onClick={startPatch}
              className="w-full rounded-2xl bg-violet-600 py-4 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Patch File
            </button>
          )}

          {stage === "processing" && (
            <div className="space-y-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-violet-400"
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="rounded-xl bg-black/40 p-4 font-mono text-xs text-zinc-400">
                {logs.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          )}

          {stage === "done" && downloadUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={18} />
                <span className="text-sm font-medium">
                  Patch complete · +{fakeCount.toLocaleString()} fake samples
                </span>
              </div>
              <a
                href={downloadUrl}
                download={file.name.replace(/\.mp4$/i, "") + "_leiv.mp4"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                <Download size={16} />
                Download Patched File
              </a>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
