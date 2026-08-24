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
import { tikquickPatch } from "@/lib/patcher";

type Stage = "idle" | "loading" | "selected" | "processing" | "done" | "error";

const ease = [0.22, 1, 0.36, 1] as const;

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * Chrome-safe file reader.
 * Chrome sometimes fails file.arrayBuffer() (especially after drag-drop).
 * FileReader is more reliable on Chrome.
 */
function readFileChromeSafe(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // Fresh copy helps on Chrome
    const blob = file.slice(0, file.size, file.type || "video/mp4");

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result;
        if (result instanceof ArrayBuffer && result.byteLength > 0) {
          resolve(new Uint8Array(result));
          return;
        }
        reject(new Error("Empty file data"));
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      // Fallback: try arrayBuffer on the sliced blob
      blob
        .arrayBuffer()
        .then((buf) => {
          if (buf && buf.byteLength > 0) {
            resolve(new Uint8Array(buf));
          } else {
            reject(new Error("Could not read file bytes"));
          }
        })
        .catch(() => reject(new Error("Could not read file bytes")));
    };

    reader.onabort = () => reject(new Error("File read was aborted"));

    try {
      reader.readAsArrayBuffer(blob);
    } catch {
      // Last resort
      blob
        .arrayBuffer()
        .then((buf) => {
          if (buf && buf.byteLength > 0) resolve(new Uint8Array(buf));
          else reject(new Error("Could not read file bytes"));
        })
        .catch(() => reject(new Error("Could not read file bytes")));
    }
  });
}

export default function OptimizerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [previewUrl, downloadUrl]);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    bytesRef.current = null;
    setFileName("");
    setFileSize(0);
    setPreviewUrl(null);
    setStage("idle");
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
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

      setFileName(f.name);
      setFileSize(f.size);
      setStage("loading");
      setProgress(0);
      setError(null);
      setDownloadUrl(null);
      bytesRef.current = null;

      // Preview from a sliced blob (Chrome-friendly)
      try {
        const previewBlob = f.slice(0, f.size, f.type || "video/mp4");
        const url = URL.createObjectURL(previewBlob);
        setPreviewUrl(url);
      } catch {
        // preview is optional
      }

      // Read bytes immediately with Chrome-safe method
      try {
        const bytes = await readFileChromeSafe(f);
        if (!bytes || bytes.byteLength === 0) {
          throw new Error("Empty file");
        }
        bytesRef.current = bytes;
        setStage("selected");
      } catch (e) {
        console.error("File read failed:", e);
        setError(
          "Chrome blocked reading this file. Try: 1) Incognito mode  2) Disable extensions  3) Use Edge  4) Re-select the file"
        );
        setStage("error");
        bytesRef.current = null;
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

  const startPatch = async () => {
    const bytes = bytesRef.current;
    if (!bytes || bytes.length === 0) {
      setError("No video data loaded. Please re-select the file.");
      setStage("error");
      return;
    }

    setStage("processing");
    setProgress(8);
    setError(null);

    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) return p;
        return p + Math.random() * 5 + 1.5;
      });
    }, 220);

    try {
      await new Promise((r) => setTimeout(r, 40));

      // Clone so we don't mutate the stored buffer
      const input = new Uint8Array(bytes);
      const result = tikquickPatch(input);

      clearInterval(tick);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 350));

      const blob = new Blob([result.output], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStage("done");
    } catch (e: unknown) {
      clearInterval(tick);
      console.error(e);
      const msg =
        e instanceof Error ? e.message : "Patch failed. Try a different MP4.";
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
          Zero quality loss · Pure structure patch · Video never leaves this tab
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
            99% Faster
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
            No Encoding Needed
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-300">
            Always Free
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
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
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
                // reset input so same file can be re-selected
                e.target.value = "";
              }}
            />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Upload className="text-zinc-300" size={24} />
            </div>
            <p className="text-lg font-medium text-white">Drop your MP4 here</p>
            <p className="mt-1 text-sm text-zinc-500">or click to browse</p>
            <p className="mt-6 text-xs text-zinc-600">
              Instant structure patch · Zero quality loss
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

      {stage === "loading" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center"
        >
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-zinc-400">Reading file…</p>
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
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              onClick={startPatch}
              className="w-full rounded-2xl bg-white py-4 text-sm font-semibold text-black transition hover:bg-zinc-100"
            >
              Patch File
            </motion.button>
          )}

          {stage === "processing" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="space-y-5 rounded-2xl border border-white/8 bg-white/[0.02] p-6"
            >
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Patching structure…</span>
                  <span className="tabular-nums text-zinc-300">
                    {Math.min(100, Math.round(progress))}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, progress)}%` }}
                    transition={{ ease: "easeOut", duration: 0.35 }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-white/10" />
                    <div
                      className="h-3 animate-pulse rounded bg-white/10"
                      style={{ width: `${55 + i * 12}%` }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {stage === "done" && downloadUrl && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="space-y-5"
            >
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 size={18} />
                <span className="text-sm font-medium">Patch complete</span>
              </div>

              <a
                href={downloadUrl}
                download={
                  fileName.replace(/\.(mp4|mov|m4v)$/i, "") + "_leiv.mp4"
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-semibold text-black transition hover:bg-zinc-100"
              >
                <Download size={16} />
                Download Patched File
              </a>

              <p className="text-center text-sm text-zinc-500">
                Enjoy the tool? Follow{" "}
                <a
                  href="https://www.tiktok.com/@vennngod1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-zinc-200"
                >
                  @vennngod1
                </a>{" "}
                to support
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease }}
            className="rounded-2xl border border-white/8 bg-white/[0.02] p-6"
          >
            <h3 className="text-sm font-semibold text-white">
              Method upload for maximizing quality
            </h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
              <li>
                Open your phone/PC and go to{" "}
                <strong className="text-zinc-200">Edge</strong> (on phone: turn
                on desktop mode).
              </li>
              <li>
                Go to{" "}
                <a
                  href="https://www.tiktok.com/upload"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4"
                >
                  tiktok.com/upload
                </a>
              </li>
              <li>Upload the patched file here.</li>
              <li>Turn on HD mode (default) and post.</li>
            </ol>
            <p className="mt-4 text-sm text-zinc-500">Enjoy!</p>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
