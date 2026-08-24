"use client";

/**
 * ItzCrih-style prepare path for TikTok
 *
 * This is NOT ghost-sample / fake-frame inflation.
 * It matches what actually produced your old result:
 *   ~100 MB master → ~10–15 MB file, same resolution/FPS target,
 *   then fast TikTok web upload.
 *
 * Two modes:
 *   1) encode  — real H.264 re-encode to a TikTok-friendly profile (size drops)
 *   2) remux   — stream-copy + fast-start only (size stays ~same; use if already HandBrake'd)
 *
 * Requires @ffmpeg/ffmpeg + @ffmpeg/util (client-side wasm).
 *   npm i @ffmpeg/ffmpeg @ffmpeg/util
 *
 * Workflow (same idea as itzCrih):
 *   Topaz / AE render → (optional HandBrake) → THIS step LAST → TikTok WEB only
 *   No in-app crop / music / editor after this file.
 */

export type PrepareMode = "encode" | "remux";

export type PrepareOptions = {
  /** encode = recompress (ItzCrih encoder ON). remux = copy streams (encoder OFF). */
  mode?: PrepareMode;
  /** Max output height (default 1080). Width auto, even dims. */
  maxHeight?: number;
  /** Target constant frame rate (default 60). Use 30 if source is 30. */
  fps?: number;
  /**
   * Target video bitrate for encode mode, e.g. "10M" or "8000k".
   * itzCrih / HandBrake ballpark for 1080p60 is ~8–12 Mbps.
   */
  videoBitrate?: string;
  /** CRF alternative to bitrate (18–23 = high quality). If set, bitrate is ignored. */
  crf?: number;
  /** Audio bitrate (default "192k") */
  audioBitrate?: string;
  /** Called with 0–100 progress when ffmpeg reports it */
  onProgress?: (pct: number) => void;
  /** Called with status strings */
  onLog?: (line: string) => void;
};

export type PrepareResult = {
  output: Uint8Array;
  mode: PrepareMode;
  inputBytes: number;
  outputBytes: number;
  /** Rough ratio output/input */
  sizeRatio: number;
};

const CORE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm";

let ffmpegSingleton: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
let loadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

async function getFFmpeg(
  onLog?: (line: string) => void
): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;

  if (!loadPromise) {
    loadPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();

      ffmpeg.on("log", ({ message }) => {
        onLog?.(message);
      });

      const coreURL = await toBlobURL(CORE_URL, "text/javascript");
      const wasmURL = await toBlobURL(WASM_URL, "application/wasm");

      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegSingleton = ffmpeg;
      return ffmpeg;
    })();
  }

  return loadPromise;
}

function even(n: number) {
  const x = Math.floor(n);
  return x % 2 === 0 ? x : x - 1;
}

/**
 * Build ffmpeg argv for ItzCrih-like encode.
 * Profile goals:
 *  - H.264 High, yuv420p (universal)
 *  - CFR fps
 *  - max 1080p (scale down only)
 *  - high bitrate or CRF ~20
 *  - AAC audio
 *  - +faststart (moov before mdat)
 */
function buildEncodeArgs(opts: Required<
  Pick<PrepareOptions, "maxHeight" | "fps" | "videoBitrate" | "audioBitrate">
> & { crf?: number }): string[] {
  const scale = `scale=-2:'min(${even(opts.maxHeight)},ih)':flags=lanczos`;

  const videoCodec = [
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-profile:v",
    "high",
    "-level",
    "4.2",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(opts.fps),
    "-g",
    String(opts.fps * 2), // ~2s GOP
    "-bf",
    "2",
    "-movflags",
    "+faststart",
  ];

  if (opts.crf != null) {
    videoCodec.push("-crf", String(opts.crf));
  } else {
    videoCodec.push("-b:v", opts.videoBitrate, "-maxrate", opts.videoBitrate, "-bufsize", "2M");
  }

  return [
    "-i",
    "input.mp4",
    "-vf",
    scale,
    ...videoCodec,
    "-c:a",
    "aac",
    "-b:a",
    opts.audioBitrate,
    "-ac",
    "2",
    "-ar",
    "48000",
    "-y",
    "output.mp4",
  ];
}

/** Stream copy + fast-start (encoder OFF equivalent). */
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

/**
 * Prepare a video for TikTok web upload (ItzCrih-style).
 *
 * @example
 * const { output } = await prepareForTikTok(file, {
 *   mode: "encode",
 *   maxHeight: 1080,
 *   fps: 60,
 *   videoBitrate: "10M",
 *   onProgress: setPct,
 * });
 * // download output as .mp4, then post on tiktok.com (desktop), no editor
 */
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

  const ffmpeg = await getFFmpeg(onLog);

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
      onProgress(pct);
    });
  }

  // Normalize input bytes
  let bytes: Uint8Array;
  if (input instanceof File) {
    bytes = new Uint8Array(await input.arrayBuffer());
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }

  const inputBytes = bytes.byteLength;
  onLog?.(`[prepare] mode=${mode} input=${(inputBytes / 1e6).toFixed(1)} MB`);

  await ffmpeg.writeFile("input.mp4", bytes);

  const args =
    mode === "remux"
      ? buildRemuxArgs()
      : buildEncodeArgs({ maxHeight, fps, videoBitrate, audioBitrate, crf });

  onLog?.(`[prepare] ffmpeg ${args.join(" ")}`);
  await ffmpeg.exec(args);

  const out = await ffmpeg.readFile("output.mp4");
  const output =
    out instanceof Uint8Array
      ? out
      : new Uint8Array(out as unknown as ArrayBuffer);

  // Cleanup virtual FS
  try {
    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile("output.mp4");
  } catch {
    /* ignore */
  }

  const outputBytes = output.byteLength;
  onLog?.(
    `[prepare] done ${(inputBytes / 1e6).toFixed(1)} MB → ${(outputBytes / 1e6).toFixed(1)} MB`
  );

  return {
    output,
    mode,
    inputBytes,
    outputBytes,
    sizeRatio: inputBytes > 0 ? outputBytes / inputBytes : 1,
  };
}

/** Trigger browser download of prepared bytes */
export function downloadPrepared(
  data: Uint8Array,
  filename = "tiktok-ready.mp4"
) {
  const blob = new Blob([data], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * CLI-equivalent strings (server or local ffmpeg binary).
 * Use these if you prefer Node/server encode instead of wasm.
 */
export function ffmpegCliCommand(
  inputPath: string,
  outputPath: string,
  options: PrepareOptions = {}
): string {
  const mode = options.mode ?? "encode";
  if (mode === "remux") {
    return `ffmpeg -y -i "${inputPath}" -c copy -movflags +faststart "${outputPath}"`;
  }
  const maxHeight = options.maxHeight ?? 1080;
  const fps = options.fps ?? 60;
  const vb = options.videoBitrate ?? "10M";
  const ab = options.audioBitrate ?? "192k";
  const crf = options.crf;
  const scale = `scale=-2:'min(${even(maxHeight)},ih)':flags=lanczos`;
  const rate = crf != null ? `-crf ${crf}` : `-b:v ${vb} -maxrate ${vb} -bufsize 2M`;
  return [
    "ffmpeg -y",
    `-i "${inputPath}"`,
    `-vf "${scale}"`,
    `-c:v libx264 -preset medium -profile:v high -level 4.2 -pix_fmt yuv420p`,
    `-r ${fps} -g ${fps * 2} -bf 2`,
    rate,
    `-c:a aac -b:a ${ab} -ac 2 -ar 48000`,
    `-movflags +faststart`,
    `"${outputPath}"`,
  ].join(" ");
}
