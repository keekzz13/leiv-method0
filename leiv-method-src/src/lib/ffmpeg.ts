"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(
  onProgress?: (ratio: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onProgress) {
      ffmpeg.on("progress", ({ progress }) => onProgress(progress));
    }
    ffmpeg.on("log", ({ message }) => {
      // optional: surface logs
      if (process.env.NODE_ENV === "development") {
        console.debug("[ffmpeg]", message);
      }
    });

    // Load from CDN (unpkg) so we don't ship large WASM in the main bundle
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
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
}

/** Probe metadata using a short ffprobe-like approach via ffmpeg */
export async function probeFile(
  ffmpeg: FFmpeg,
  file: File
): Promise<MediaInfo> {
  const name = "input" + getExt(file.name);
  await ffmpeg.writeFile(name, await fetchFile(file));

  // Use -i and capture stderr for metadata (ffmpeg prints stream info)
  // We run a null output to force analysis
  let logBuffer = "";
  const logHandler = ({ message }: { message: string }) => {
    logBuffer += message + "\n";
  };
  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.exec(["-i", name, "-f", "null", "-"]);
  } catch {
    // expected — null muxer often exits non-zero
  }

  ffmpeg.off("log", logHandler);

  const info: MediaInfo = {
    size: file.size,
    name: file.name,
  };

  // Parse common patterns from log
  const durationMatch = logBuffer.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  if (durationMatch) {
    const h = parseInt(durationMatch[1], 10);
    const m = parseInt(durationMatch[2], 10);
    const s = parseFloat(durationMatch[3]);
    info.duration = h * 3600 + m * 60 + s;
  }

  const videoMatch = logBuffer.match(
    /Video:\s*(\w+)[^,]*,.*?(\d{2,5})x(\d{2,5}).*?([\d.]+)\s*fps/i
  );
  if (videoMatch) {
    info.videoCodec = videoMatch[1];
    info.width = parseInt(videoMatch[2], 10);
    info.height = parseInt(videoMatch[3], 10);
    info.fps = parseFloat(videoMatch[4]);
  } else {
    // fallback simpler
    const simple = logBuffer.match(/Video:\s*(\w+)/i);
    if (simple) info.videoCodec = simple[1];
    const res = logBuffer.match(/(\d{3,5})x(\d{3,5})/);
    if (res) {
      info.width = parseInt(res[1], 10);
      info.height = parseInt(res[2], 10);
    }
  }

  const audioMatch = logBuffer.match(/Audio:\s*(\w+)/i);
  if (audioMatch) info.audioCodec = audioMatch[1];

  const bitrateMatch = logBuffer.match(/bitrate:\s*(\d+)\s*kb\/s/i);
  if (bitrateMatch) info.bitrate = parseInt(bitrateMatch[1], 10) * 1000;

  // cleanup input
  try {
    await ffmpeg.deleteFile(name);
  } catch {}

  return info;
}

function getExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : ".mp4";
}

export type OptimizeMode = "lossless" | "compatibility";

export interface OptimizeResult {
  blob: Blob;
  mode: OptimizeMode;
  streamCopyUsed: boolean;
  outputSize: number;
  logs: string[];
  error?: string;
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

  const ffmpeg = await getFFmpeg(onProgress);
  const inputName = "input.mp4";
  const outputName = "output.mp4";

  log("[·] Loading FFmpeg engine…");
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  log("[✓] File loaded into memory");

  let streamCopyUsed = false;
  let success = false;

  if (mode === "lossless") {
    log("[·] Attempting lossless stream copy…");
    try {
      // Classic faststart remux
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
      log("[✓] Stream copy succeeded");
      log("[✓] Fast-start metadata applied");
    } catch (e) {
      log("[!] Stream copy failed — container or codec may be incompatible");
      log("[·] Falling back is not automatic in lossless mode");
      // Do not fall through to re-encode in lossless mode
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {}
      return {
        blob: new Blob(),
        mode,
        streamCopyUsed: false,
        outputSize: 0,
        logs,
        error:
          "Lossless stream copy is not possible for this file. Try Compatibility mode if you accept possible re-encoding.",
      };
    }
  } else {
    // Compatibility: re-encode to widely supported H.264 + AAC
    log("[·] Compatibility mode — may re-encode");
    try {
      await ffmpeg.exec([
        "-i",
        inputName,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ]);
      success = true;
      log("[✓] Compatibility encode completed");
    } catch (e) {
      log("[✗] Processing failed");
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {}
      return {
        blob: new Blob(),
        mode,
        streamCopyUsed: false,
        outputSize: 0,
        logs,
        error: "Processing failed. The file may be corrupted or unsupported.",
      };
    }
  }

  if (!success) {
    return {
      blob: new Blob(),
      mode,
      streamCopyUsed: false,
      outputSize: 0,
      logs,
      error: "Unknown failure",
    };
  }

  log("[·] Reading output…");
  const data = await ffmpeg.readFile(outputName);
  const uint8 =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const blob = new Blob([uint8], { type: "video/mp4" });
  log(`[✓] Output ready (${formatBytes(blob.size)})`);

  // cleanup
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch {}

  return {
    blob,
    mode,
    streamCopyUsed,
    outputSize: blob.size,
    logs,
  };
}

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}
