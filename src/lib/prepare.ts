"use client";

/**
 * ItzCrih-style prepare — browser FFmpeg.wasm
 * mode "encode" = re-encode H.264 (smaller file)
 * mode "remux"  = stream copy + faststart
 */

export type PrepareMode = "encode" | "remux";

export type PrepareOptions = {
  mode?: PrepareMode;
  maxHeight?: number;
  fps?: number;
  videoBitrate?: string;
  crf?: number;
  audioBitrate?: string;
  onProgress?: (pct: number) => void;
  onLog?: (line: string) => void;
};

export type PrepareResult = {
  output: Uint8Array;
  mode: PrepareMode;
  inputBytes: number;
  outputBytes: number;
  sizeRatio: number;
};

const CORE_BASE =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

let ffmpegSingleton: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
let loadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;
const logLines: string[] = [];

function pushLog(line: string, onLog?: (s: string) => void) {
  logLines.push(line);
  if (logLines.length > 80) logLines.shift();
  onLog?.(line);
}

async function getFFmpeg(onLog?: (line: string) => void) {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg");
        const { toBlobURL } = await import("@ffmpeg/util");
        const ffmpeg = new FFmpeg();

        ffmpeg.on("log", ({ message }) => {
          pushLog(message, onLog);
        });

        pushLog("Loading FFmpeg core…", onLog);
        const coreURL = await toBlobURL(
          `${CORE_BASE}/ffmpeg-core.js`,
          "text/javascript"
        );
        const wasmURL = await toBlobURL(
          `${CORE_BASE}/ffmpeg-core.wasm`,
          "application/wasm"
        );

        await ffmpeg.load({ coreURL, wasmURL });
        pushLog("FFmpeg ready", onLog);
        ffmpegSingleton = ffmpeg;
        return ffmpeg;
      } catch (e) {
        loadPromise = null;
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Could not load FFmpeg in the browser: ${msg}. Try Chrome/Edge, disable adblock, or use a stronger connection.`
        );
      }
    })();
  }

  return loadPromise;
}

function buildEncodeArgs(opts: {
  maxHeight: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  crf?: number;
}): string[] {
  const vf = `scale=-2:${opts.maxHeight}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;

  const rateArgs =
    opts.crf != null
      ? ["-crf", String(opts.crf)]
      : ["-b:v", opts.videoBitrate, "-maxrate", opts.videoBitrate, "-bufsize", "4M"];

  return [
    "-i",
    "input.mp4",
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "fastdecode",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(opts.fps),
    "-g",
    String(Math.max(30, opts.fps * 2)),
    ...rateArgs,
    "-c:a",
    "aac",
    "-b:a",
    opts.audioBitrate,
    "-ac",
    "2",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    "-y",
    "output.mp4",
  ];
}

function buildRemuxArgs(): string[] {
  return [
    "-i",
    "input.mp4",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-y",
    "output.mp4",
  ];
}

export async function prepareForTikTok(
  input: File | Uint8Array | ArrayBuffer,
  options: PrepareOptions = {}
): Promise<PrepareResult> {
  const mode: PrepareMode = options.mode ?? "encode";
  const maxHeight = options.maxHeight ?? 1080;
  const fps = options.fps ?? 60;
  const videoBitrate = options.videoBitrate ?? "10M";
  const audioBitrate = options.audioBitrate ?? "192k";
  const crf = options.crf;
  const onProgress = options.onProgress;
  const onLog = options.onLog;

  logLines.length = 0;

  let ffmpeg;
  try {
    ffmpeg = await getFFmpeg(onLog);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
      onProgress(pct);
    });
  }

  let bytes: Uint8Array;
  try {
    if (typeof File !== "undefined" && input instanceof File) {
      bytes = new Uint8Array(await input.arrayBuffer());
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else {
      bytes = input as Uint8Array;
    }
  } catch {
    throw new Error(
      "Could not read the file in this browser. Try Chrome, or re-select the file."
    );
  }

  if (!bytes || bytes.byteLength < 32) {
    throw new Error("File is empty or too small to be a valid video.");
  }

  const inputBytes = bytes.byteLength;
  pushLog(
    `[prepare] mode=${mode} size=${(inputBytes / 1e6).toFixed(2)} MB`,
    onLog
  );

  const inName = "input.mp4";
  const outName = "output.mp4";

  try {
    await ffmpeg.writeFile(inName, bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`FFmpeg write failed: ${msg}`);
  }

  const args =
    mode === "remux"
      ? buildRemuxArgs()
      : buildEncodeArgs({ maxHeight, fps, videoBitrate, audioBitrate, crf });

  pushLog(`[prepare] exec ${args.join(" ")}`, onLog);

  try {
    await ffmpeg.exec(args);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tail = logLines.slice(-12).join(" | ");
    throw new Error(
      `FFmpeg ${mode} failed: ${msg}${tail ? ` — ${tail}` : ""}`
    );
  }

  let out: Uint8Array | string;
  try {
    out = await ffmpeg.readFile(outName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const tail = logLines.slice(-12).join(" | ");
    throw new Error(
      `No output file after ${mode}. ${msg}${tail ? ` — ${tail}` : ""}`
    );
  }

  const output =
    typeof out === "string"
      ? new TextEncoder().encode(out)
      : new Uint8Array(out);

  if (output.byteLength < 32) {
    throw new Error(
      "Output was empty. The source codec may not be supported in-browser."
    );
  }

  try {
    await ffmpeg.deleteFile(inName);
    await ffmpeg.deleteFile(outName);
  } catch {
    /* ignore */
  }

  const outputBytes = output.byteLength;
  pushLog(
    `[prepare] done ${(inputBytes / 1e6).toFixed(2)} → ${(outputBytes / 1e6).toFixed(2)} MB`,
    onLog
  );

  return {
    output,
    mode,
    inputBytes,
    outputBytes,
    sizeRatio: inputBytes > 0 ? outputBytes / inputBytes : 1,
  };
}

export function downloadPrepared(
  data: Uint8Array,
  filename = "tiktok-ready.mp4"
) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const blob = new Blob([copy.buffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
