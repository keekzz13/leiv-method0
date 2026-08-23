"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let usingMultiThread = false;

export function isMultiThreadActive() {
  return usingMultiThread;
}

function hasSharedArrayBuffer() {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Bulletproof File/Blob → Uint8Array.
 * Never uses fetchFile for local Files (that path throws Code=-1 on many browsers).
 */
function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  // 1) Native
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  // 2) FileReader
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      if (fr.result instanceof ArrayBuffer) resolve(fr.result);
      else reject(new Error("FileReader returned non-ArrayBuffer"));
    };
    fr.onerror = () => {
      const code = (fr.error && (fr.error as DOMException).code) ?? -1;
      reject(new Error(`FileReader failed (code=${code})`));
    };
    fr.onabort = () => reject(new Error("FileReader aborted"));
    fr.readAsArrayBuffer(blob);
  });
}

async function fileToUint8(file: File | Blob): Promise<Uint8Array> {
  if (!file || file.size === 0) {
    throw new Error("This file is empty or invalid. Pick another MP4.");
  }

  // Soft size warning path still attempts read (WASM may OOM later)
  const size = file.size;

  // A) Full arrayBuffer
  try {
    const buf = await readBlobAsArrayBuffer(file);
    if (buf && buf.byteLength > 0) {
      return new Uint8Array(buf);
    }
  } catch {
    // continue
  }

  // B) Full slice
  try {
    const buf = await readBlobAsArrayBuffer(file.slice(0, size));
    if (buf && buf.byteLength > 0) {
      return new Uint8Array(buf);
    }
  } catch {
    // continue
  }

  // C) Chunked read (helps flaky mobile / cloud-drive File handles)
  try {
    const chunkSize = 4 * 1024 * 1024; // 4MB
    const out = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      const end = Math.min(offset + chunkSize, size);
      const chunkBuf = await readBlobAsArrayBuffer(file.slice(offset, end));
      const chunk = new Uint8Array(chunkBuf);
      if (chunk.byteLength === 0) {
        throw new Error(`Empty chunk at offset ${offset}`);
      }
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (out.byteLength > 0) return out;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not read this video (${detail}). Tips: use Chrome/Edge, download the file fully to device first (not cloud-only), re-export as MP4, or try a smaller clip.`
    );
  }

  throw new Error(
    "Could not read this video (empty data). Re-save as MP4 and try again."
  );
}

type LoadAttempt = {
  name: string;
  multi: boolean;
  run: (ffmpeg: FFmpeg) => Promise<void>;
};

async function loadSingle(
  ffmpeg: FFmpeg,
  base: string,
  kind: "umd" | "esm" | "direct"
) {
  if (kind === "direct") {
    await ffmpeg.load({
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
    });
    return;
  }
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(
    `${base}/ffmpeg-core.wasm`,
    "application/wasm"
  );
  await ffmpeg.load({ coreURL, wasmURL });
}

async function loadMulti(ffmpeg: FFmpeg, base: string) {
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(
    `${base}/ffmpeg-core.wasm`,
    "application/wasm"
  );
  const workerURL = await toBlobURL(
    `${base}/ffmpeg-core.worker.js`,
    "text/javascript"
  );
  await ffmpeg.load({ coreURL, wasmURL, workerURL });
}

function buildAttempts(): LoadAttempt[] {
  const list: LoadAttempt[] = [];

  // Multi-thread first when SharedArrayBuffer is available (uses more CPU cores)
  if (hasSharedArrayBuffer()) {
    list.push(
      {
        name: "core-mt-jsdelivr-esm",
        multi: true,
        run: (f) =>
          loadMulti(
            f,
            "https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm"
          ),
      },
      {
        name: "core-mt-unpkg-esm",
        multi: true,
        run: (f) =>
          loadMulti(f, "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm"),
      }
    );
  }

  // Single-thread fallbacks
  list.push(
    {
      name: "local-umd",
      multi: false,
      run: (f) => loadSingle(f, "/ffmpeg", "umd"),
    },
    {
      name: "core-jsdelivr-umd-blob",
      multi: false,
      run: (f) =>
        loadSingle(
          f,
          "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd",
          "umd"
        ),
    },
    {
      name: "core-unpkg-umd-blob",
      multi: false,
      run: (f) =>
        loadSingle(f, "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd", "umd"),
    },
    {
      name: "core-jsdelivr-esm-blob",
      multi: false,
      run: (f) =>
        loadSingle(
          f,
          "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
          "esm"
        ),
    },
    {
      name: "core-jsdelivr-umd-direct",
      multi: false,
      run: (f) =>
        loadSingle(
          f,
          "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd",
          "direct"
        ),
    }
  );

  return list;
}

export async function getFFmpeg(
  onProgress?: (ratio: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const errors: string[] = [];
    const attempts = buildAttempts();

    for (const attempt of attempts) {
      const ffmpeg = new FFmpeg();
      if (onProgress) {
        ffmpeg.on("progress", ({ progress }) => onProgress(progress));
      }

      try {
        await attempt.run(ffmpeg);
        if (ffmpeg.loaded) {
          ffmpegInstance = ffmpeg;
          usingMultiThread = attempt.multi;
          return ffmpeg;
        }
        errors.push(`${attempt.name}: loaded=false`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${attempt.name}: ${msg}`);
      }
    }

    loadingPromise = null;
    throw new Error(
      `Engine could not start. Try Chrome/Edge, disable ad-block. Details: ${errors.slice(0, 3).join(" | ")}`
    );
  })();

  return loadingPromise;
}

export async function resetFFmpeg(): Promise<void> {
  try {
    if (ffmpegInstance) ffmpegInstance.terminate();
  } catch {
    // ignore
  }
  ffmpegInstance = null;
  loadingPromise = null;
  usingMultiThread = false;
}

export interface MediaInfo {
  duration?: number;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  size: number;
  name: string;
  hasMoov?: boolean;
}

export function verifyFastStart(data: Uint8Array): boolean {
  if (data.length < 16) return false;
  let offset = 0;
  let moovPos = -1;
  let mdatPos = -1;

  while (offset + 8 <= data.length) {
    const size =
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3];
    const type = String.fromCharCode(
      data[offset + 4],
      data[offset + 5],
      data[offset + 6],
      data[offset + 7]
    );
    if (type === "moov" && moovPos < 0) moovPos = offset;
    if (type === "mdat" && mdatPos < 0) mdatPos = offset;
    if (size === 0) break;
    if (size === 1) {
      if (offset + 16 > data.length) break;
      const high =
        (data[offset + 8] << 24) |
        (data[offset + 9] << 16) |
        (data[offset + 10] << 8) |
        data[offset + 11];
      const low =
        (data[offset + 12] << 24) |
        (data[offset + 13] << 16) |
        (data[offset + 14] << 8) |
        data[offset + 15];
      const bigSize = high * 0x100000000 + (low >>> 0);
      if (bigSize < 16) break;
      offset += bigSize;
      continue;
    }
    if (size < 8) break;
    offset += size;
    if (moovPos >= 0 && mdatPos >= 0) break;
  }
  if (moovPos < 0) return false;
  if (mdatPos < 0) return true;
  return moovPos < mdatPos;
}

export async function probeFile(
  ffmpeg: FFmpeg,
  file: File
): Promise<MediaInfo> {
  const name = "probe_input.mp4";
  const data = await fileToUint8(file);
  await ffmpeg.writeFile(name, data);

  let logBuffer = "";
  const logHandler = ({ message }: { message: string }) => {
    logBuffer += message + "\n";
  };
  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.exec([
      "-hide_banner",
      "-i",
      name,
      "-vframes",
      "0",
      "-f",
      "null",
      "-",
    ]);
  } catch {
    // ok
  }
  ffmpeg.off("log", logHandler);

  const info: MediaInfo = { size: file.size, name: file.name };

  const durationMatch = logBuffer.match(
    /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/
  );
  if (durationMatch) {
    info.duration =
      parseInt(durationMatch[1], 10) * 3600 +
      parseInt(durationMatch[2], 10) * 60 +
      parseFloat(durationMatch[3]);
  }

  const videoLine = logBuffer.match(
    /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*Video:\s*([^\s,(]+)[^]*?(?:(\d{2,5})x(\d{2,5}))?[^]*?(?:([\d.]+)\s*(?:fps|tbr))?/i
  );
  if (videoLine) {
    info.videoCodec = videoLine[1].replace(/,$/, "");
    if (videoLine[2] && videoLine[3]) {
      info.width = parseInt(videoLine[2], 10);
      info.height = parseInt(videoLine[3], 10);
    }
    if (videoLine[4]) info.fps = parseFloat(videoLine[4]);
  } else {
    const simple = logBuffer.match(/Video:\s*([a-zA-Z0-9_]+)/i);
    if (simple) info.videoCodec = simple[1];
    const res = logBuffer.match(/(\d{3,5})x(\d{3,5})/);
    if (res) {
      info.width = parseInt(res[1], 10);
      info.height = parseInt(res[2], 10);
    }
    const fps = logBuffer.match(/([\d.]+)\s*fps/i);
    if (fps) info.fps = parseFloat(fps[1]);
  }

  const audioMatch = logBuffer.match(
    /Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*Audio:\s*([a-zA-Z0-9_]+)/i
  );
  if (audioMatch) info.audioCodec = audioMatch[1];
  else {
    const simpleA = logBuffer.match(/Audio:\s*([a-zA-Z0-9_]+)/i);
    if (simpleA) info.audioCodec = simpleA[1];
  }

  const bitrateMatch = logBuffer.match(/bitrate:\s*(\d+)\s*kb\/s/i);
  if (bitrateMatch) info.bitrate = parseInt(bitrateMatch[1], 10) * 1000;

  try {
    const head = new Uint8Array(
      await file.slice(0, Math.min(file.size, 4 * 1024 * 1024)).arrayBuffer()
    );
    info.hasMoov = verifyFastStart(head);
  } catch {
    // ignore
  }

  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // ignore
  }

  return info;
}

export type OptimizeMode = "lossless" | "tiktok" | "compatibility";

export interface OptimizeResult {
  blob: Blob;
  mode: OptimizeMode;
  streamCopyUsed: boolean;
  fastStartVerified: boolean;
  videoEncoderUsed?: string;
  multiThread?: boolean;
  outputSize: number;
  logs: string[];
  error?: string;
}

/**
 * Fast + max quality for TikTok:
 * - Keep 60 fps (not 30)
 * - High bitrate (15 Mbps) so TikTok has more data after re-encode
 * - ultrafast preset = fastest x264 in WASM (still quality via bitrate)
 * - Threads when multi-core core is loaded
 */
async function runTikTokEncode(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  log: (m: string) => void
): Promise<{ ok: boolean; encoder?: string }> {
  const threads = usingMultiThread ? ["-threads", "0"] : []; // 0 = auto all cores

  const attempts: { label: string; args: string[] }[] = [
    {
      // Primary: FAST + MAX QUALITY (high bitrate, 60fps, ultrafast)
      label: "fast-max-1080p60",
      args: [
        "-i",
        inputName,
        ...threads,
        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=60",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "fastdecode",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "60",
        "-b:v",
        "15M",
        "-maxrate",
        "18M",
        "-bufsize",
        "30M",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ],
    },
    {
      // Same quality target, no pad (if pad filter fails)
      label: "fast-max-scale-60",
      args: [
        "-i",
        inputName,
        ...threads,
        "-vf",
        "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease,fps=60",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "60",
        "-b:v",
        "15M",
        "-maxrate",
        "18M",
        "-bufsize",
        "30M",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ],
    },
    {
      // High bitrate, keep source fps if 60 filter fails
      label: "fast-max-nobr-force",
      args: [
        "-i",
        inputName,
        ...threads,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-b:v",
        "15M",
        "-maxrate",
        "18M",
        "-bufsize",
        "30M",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ],
    },
    {
      label: "crf-fast",
      args: [
        "-i",
        inputName,
        ...threads,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "16",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ],
    },
  ];

  for (const attempt of attempts) {
    log(`[·] Leiv Method (${attempt.label})…`);
    try {
      await ffmpeg.exec(attempt.args);
      try {
        const probe = await ffmpeg.readFile(outputName);
        if (probe && (probe as Uint8Array).byteLength > 0) {
          log(`[✓] Succeeded (${attempt.label})`);
          return { ok: true, encoder: attempt.label };
        }
      } catch {
        log(`[!] Output missing after ${attempt.label}`);
      }
    } catch {
      log(`[!] Path unavailable — trying next`);
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }
  }

  return { ok: false };
}

async function runCompatibilityEncode(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  log: (m: string) => void
): Promise<{ ok: boolean; encoder?: string }> {
  const threads = usingMultiThread ? ["-threads", "0"] : [];
  const attempts: { label: string; args: string[] }[] = [
    {
      label: "standard",
      args: [
        "-i",
        inputName,
        ...threads,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ],
    },
  ];

  for (const attempt of attempts) {
    log(`[·] Compatibility (${attempt.label})…`);
    try {
      await ffmpeg.exec(attempt.args);
      const probe = await ffmpeg.readFile(outputName);
      if (probe && (probe as Uint8Array).byteLength > 0) {
        log(`[✓] Compatibility succeeded`);
        return { ok: true, encoder: attempt.label };
      }
    } catch {
      log(`[!] Failed`);
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }
  }
  return { ok: false };
}

export async function optimizeMp4(
  file: File,
  mode: OptimizeMode,
  onLog: (msg: string) => void,
  onProgress: (ratio: number) => void
): Promise<OptimizeResult> {
  const logs: string[] = [];
  const log = (m: string) => {
    logs.push(m);
    onLog(m);
  };

  try {
    log("[·] Preparing Leiv Method…");
    const ffmpeg = await getFFmpeg(onProgress);

    if (usingMultiThread) {
      log("[✓] Multi-core engine active (uses more CPU — faster encode)");
    } else {
      log(
        "[!] Single-core engine (browser limit). Encode feels slow but PC stays smooth — normal for WASM."
      );
      if (!hasSharedArrayBuffer()) {
        log(
          "[!] SharedArrayBuffer missing — multi-core needs Chrome/Edge + site headers. Deploy with COOP/COEP."
        );
      }
    }

    const inputName = "input.mp4";
    const outputName = "output.mp4";

    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }

    log("[·] Reading video…");
    let fileData: Uint8Array;
    try {
      fileData = await fileToUint8(file);
    } catch (e) {
      return {
        blob: new Blob(),
        mode,
        streamCopyUsed: false,
        fastStartVerified: false,
        multiThread: usingMultiThread,
        outputSize: 0,
        logs,
        error:
          e instanceof Error
            ? e.message
            : "File could not be read. Try another browser.",
      };
    }

    log(`[✓] Read ${formatBytes(fileData.byteLength)}`);
    await ffmpeg.writeFile(inputName, fileData);
    log("[✓] Loaded on this device");

    let streamCopyUsed = false;
    let videoEncoderUsed: string | undefined;
    let success = false;

    if (mode === "lossless") {
      log("[·] Lossless container cleanup…");
      try {
        await ffmpeg.exec([
          "-i",
          inputName,
          "-map",
          "0",
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          "-y",
          outputName,
        ]);
        streamCopyUsed = true;
        success = true;
        log("[✓] Lossless done");
      } catch {
        try {
          await ffmpeg.deleteFile(inputName);
        } catch {
          // ignore
        }
        return {
          blob: new Blob(),
          mode,
          streamCopyUsed: false,
          fastStartVerified: false,
          multiThread: usingMultiThread,
          outputSize: 0,
          logs,
          error: "Lossless isn’t possible. Try Leiv Method instead.",
        };
      }
    } else if (mode === "tiktok") {
      log(
        "[·] Fast + max quality: 1080×1920 · 60 fps · H.264 · ~15 Mbps · ultrafast"
      );
      const result = await runTikTokEncode(ffmpeg, inputName, outputName, log);
      if (!result.ok) {
        try {
          await ffmpeg.deleteFile(inputName);
        } catch {
          // ignore
        }
        return {
          blob: new Blob(),
          mode,
          streamCopyUsed: false,
          fastStartVerified: false,
          multiThread: usingMultiThread,
          outputSize: 0,
          logs,
          error:
            "Encode failed. Try a shorter clip, Chrome/Edge, or Compatibility mode.",
        };
      }
      success = true;
      videoEncoderUsed = result.encoder;
    } else {
      log("[·] Compatibility…");
      const result = await runCompatibilityEncode(
        ffmpeg,
        inputName,
        outputName,
        log
      );
      if (!result.ok) {
        try {
          await ffmpeg.deleteFile(inputName);
        } catch {
          // ignore
        }
        return {
          blob: new Blob(),
          mode,
          streamCopyUsed: false,
          fastStartVerified: false,
          multiThread: usingMultiThread,
          outputSize: 0,
          logs,
          error: "Compatibility failed. Original not modified.",
        };
      }
      success = true;
      videoEncoderUsed = result.encoder;
    }

    if (!success) {
      return {
        blob: new Blob(),
        mode,
        streamCopyUsed: false,
        fastStartVerified: false,
        multiThread: usingMultiThread,
        outputSize: 0,
        logs,
        error: "Something went wrong.",
      };
    }

    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore
    }

    log("[·] Finalizing…");
    let data: Uint8Array | string;
    try {
      data = await ffmpeg.readFile(outputName);
    } catch (e) {
      return {
        blob: new Blob(),
        mode,
        streamCopyUsed: false,
        fastStartVerified: false,
        multiThread: usingMultiThread,
        outputSize: 0,
        logs,
        error: `Could not read output (${e instanceof Error ? e.message : e}).`,
      };
    }

    const uint8 =
      data instanceof Uint8Array
        ? data
        : new TextEncoder().encode(String(data));

    if (!uint8.byteLength) {
      return {
        blob: new Blob(),
        mode,
        streamCopyUsed: false,
        fastStartVerified: false,
        multiThread: usingMultiThread,
        outputSize: 0,
        logs,
        error: "Output was empty. Try another clip.",
      };
    }

    const fastStartVerified = verifyFastStart(uint8);
    log(
      fastStartVerified
        ? "[✓] Quick-start verified"
        : "[!] Quick-start not confirmed"
    );

    const bytes = new Uint8Array(uint8.byteLength);
    bytes.set(uint8);
    const blob = new Blob([bytes], { type: "video/mp4" });
    log(`[✓] Ready (${formatBytes(blob.size)})`);

    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }

    return {
      blob,
      mode,
      streamCopyUsed,
      fastStartVerified,
      videoEncoderUsed,
      multiThread: usingMultiThread,
      outputSize: blob.size,
      logs,
    };
  } catch (e: unknown) {
    try {
      await resetFFmpeg();
    } catch {
      // ignore
    }
    return {
      blob: new Blob(),
      mode,
      streamCopyUsed: false,
      fastStartVerified: false,
      multiThread: usingMultiThread,
      outputSize: 0,
      logs,
      error:
        e instanceof Error
          ? e.message
          : "Something went wrong while optimizing.",
    };
  }
}

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}
