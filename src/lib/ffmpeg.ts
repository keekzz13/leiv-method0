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
      if (process.env.NODE_ENV === "development") {
        console.debug("[ffmpeg]", message);
      }
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
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
  const name = "probe_input" + getExt(file.name);
  await ffmpeg.writeFile(name, await fetchFile(file));

  let logBuffer = "";
  const logHandler = ({ message }: { message: string }) => {
    logBuffer += message + "\n";
  };
  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.exec(["-hide_banner", "-i", name, "-f", "null", "-"]);
  } catch {
    // null muxer often exits non-zero
  }

  ffmpeg.off("log", logHandler);

  const info: MediaInfo = {
    size: file.size,
    name: file.name,
  };

  const durationMatch = logBuffer.match(
    /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/
  );
  if (durationMatch) {
    const h = parseInt(durationMatch[1], 10);
    const m = parseInt(durationMatch[2], 10);
    const s = parseFloat(durationMatch[3]);
    info.duration = h * 3600 + m * 60 + s;
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
  if (audioMatch) {
    info.audioCodec = audioMatch[1];
  } else {
    const simpleA = logBuffer.match(/Audio:\s*([a-zA-Z0-9_]+)/i);
    if (simpleA) info.audioCodec = simpleA[1];
  }

  const bitrateMatch = logBuffer.match(/bitrate:\s*(\d+)\s*kb\/s/i);
  if (bitrateMatch) info.bitrate = parseInt(bitrateMatch[1], 10) * 1000;

  try {
    const headSize = Math.min(file.size, 4 * 1024 * 1024);
    const head = new Uint8Array(await file.slice(0, headSize).arrayBuffer());
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

function getExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : ".mp4";
}

export type OptimizeMode = "lossless" | "compatibility";

export interface OptimizeResult {
  blob: Blob;
  mode: OptimizeMode;
  streamCopyUsed: boolean;
  fastStartVerified: boolean;
  videoEncoderUsed?: string;
  outputSize: number;
  logs: string[];
  error?: string;
}

async function runCompatibilityEncode(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  log: (m: string) => void
): Promise<{ ok: boolean; encoder?: string }> {
  const attempts: { label: string; args: string[] }[] = [
    {
      label: "libx264+aac",
      args: [
        "-i",
        inputName,
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
    {
      label: "mpeg4+aac",
      args: [
        "-i",
        inputName,
        "-c:v",
        "mpeg4",
        "-q:v",
        "5",
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
    {
      label: "mpeg4+audio-copy",
      args: [
        "-i",
        inputName,
        "-c:v",
        "mpeg4",
        "-q:v",
        "5",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ],
    },
  ];

  for (const attempt of attempts) {
    log(`[·] Trying encoder: ${attempt.label}`);
    try {
      await ffmpeg.exec(attempt.args);
      log(`[✓] Encode succeeded with ${attempt.label}`);
      return { ok: true, encoder: attempt.label };
    } catch {
      log(`[!] ${attempt.label} failed`);
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }
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

  const ffmpeg = await getFFmpeg(onProgress);
  const inputName = "input.mp4";
  const outputName = "output.mp4";

  log("[·] Loading FFmpeg engine…");
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  log("[✓] File loaded into memory");

  let streamCopyUsed = false;
  let videoEncoderUsed: string | undefined;
  let success = false;

  if (mode === "lossless") {
    log("[·] Attempting lossless stream copy…");
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
      log("[✓] Stream copy succeeded");
    } catch {
      log("[!] Stream copy failed — container or codec may be incompatible");
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
        outputSize: 0,
        logs,
        error:
          "Lossless stream copy is not possible for this file. Try Compatibility mode if you accept possible re-encoding.",
      };
    }
  } else {
    log("[·] Compatibility mode — may re-encode");
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
        outputSize: 0,
        logs,
        error:
          "Compatibility processing failed. No available encoder succeeded for this file.",
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
      outputSize: 0,
      logs,
      error: "Unknown failure",
    };
  }

  log("[·] Reading output…");
  const data = await ffmpeg.readFile(outputName);
  const uint8 =
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data));

  const fastStartVerified = verifyFastStart(uint8);
  if (fastStartVerified) {
    log("[✓] Fast-start verified (moov before mdat)");
  } else {
    log("[!] Fast-start not detected in output — moov may still be at end");
  }

  const bytes = new Uint8Array(uint8.byteLength);
  bytes.set(uint8);
  const blob = new Blob([bytes], { type: "video/mp4" });
  log(`[✓] Output ready (${formatBytes(blob.size)})`);

  try {
    await ffmpeg.deleteFile(inputName);
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
    outputSize: blob.size,
    logs,
  };
}

function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}
