"use client";

/**
 * Leiv Method core — based on tiktok-quality (BastienGimbert)
 * https://github.com/BastienGimbert/tiktok-quality (MIT)
 *
 * Improvements over classic Zilem inflate:
 *  - stts preserves original runs, then appends ghost timing (delta 0)
 *    so declared duration stays equal to the real media timeline
 *  - stsz / stsc / stco describe a contiguous pad region (legal ISO-BMFF)
 *  - Default 10× frame inflation (configurable)
 *  - Ghost samples = padCount × 8-byte filler NALs in one new chunk
 *  - Fast-start layout (ftyp + moov + mdat)
 *  - ftyp brand normalized toward isom
 *  - mdhd / tkhd / mvhd durations left unchanged (no timeline inflation)
 *
 * Original video/audio bitstreams are not re-encoded.
 * TikTok still re-encodes on upload; this only rewrites container metadata.
 */

const PADDING_NAL = new Uint8Array([
  0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00,
]);
const PADDING_SIZE = 8;
const DEFAULT_MULTIPLIER = 10;

const CONTAINERS = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "dinf",
  "stbl",
  "edts",
  "udta",
  "meta",
  "mvex",
]);

// ── binary helpers ───────────────────────────────────────────────────────────

const dv = (buf: ArrayBuffer | Uint8Array) =>
  new DataView(
    buf instanceof ArrayBuffer ? buf : buf.buffer,
    (buf as Uint8Array).byteOffset ?? 0,
    buf.byteLength
  );

function u32(data: Uint8Array, off: number) {
  return dv(data).getUint32(off, false);
}
function u16(data: Uint8Array, off: number) {
  return dv(data).getUint16(off, false);
}
function u64(data: Uint8Array, off: number) {
  const hi = dv(data).getUint32(off, false);
  const lo = dv(data).getUint32(off + 4, false);
  return hi * 0x100000000 + lo;
}
function w32(val: number) {
  const b = new Uint8Array(4);
  dv(b).setUint32(0, val >>> 0, false);
  return b;
}
function w16(val: number) {
  const b = new Uint8Array(2);
  dv(b).setUint16(0, val & 0xffff, false);
  return b;
}
function w64(val: number) {
  const b = new Uint8Array(8);
  dv(b).setUint32(0, Math.floor(val / 0x100000000) >>> 0, false);
  dv(b).setUint32(4, val >>> 0, false);
  return b;
}
function asciiSlice(data: Uint8Array, off: number, len: number) {
  return String.fromCharCode(...data.slice(off, off + len));
}
function makeBox(type: string, payload: Uint8Array) {
  const size = payload.length + 8;
  const out = new Uint8Array(size);
  out.set(w32(size), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}
function concat(...bufs: Uint8Array[]) {
  const total = bufs.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const b of bufs) {
    out.set(b, pos);
    pos += b.length;
  }
  return out;
}

// ── box model ────────────────────────────────────────────────────────────────

class Box {
  children: Box[] | null = null;
  constructor(
    public type: string,
    public start: number,
    public end: number,
    public size: number,
    public header: number
  ) {}
}

function parseBoxes(data: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let boxSize = u32(data, pos);
    let hdr = 8;
    if (boxSize === 1) {
      if (pos + 16 > end) break;
      boxSize = u64(data, pos + 8);
      hdr = 16;
    } else if (boxSize === 0) {
      boxSize = end - pos;
    }
    if (!boxSize || pos + boxSize > end) break;
    const btype = asciiSlice(data, pos + 4, 4);
    const b = new Box(btype, pos, pos + boxSize, boxSize, hdr);
    let childStart = pos + hdr;
    if (btype === "meta") childStart += 4;
    if (CONTAINERS.has(btype) && childStart < pos + boxSize) {
      b.children = parseBoxes(data, childStart, pos + boxSize);
    }
    boxes.push(b);
    pos += boxSize;
  }
  return boxes;
}

const rawBox = (data: Uint8Array, b: Box) => data.slice(b.start, b.end);
const payload = (data: Uint8Array, b: Box) =>
  data.slice(b.start + b.header, b.end);

function findChild(parent: Box, name: string) {
  if (!parent.children) return null;
  return parent.children.find((c) => c.type === name) ?? null;
}
function childPath(root: Box, path: string[]) {
  let node: Box | null = root;
  for (const name of path) {
    if (!node) return null;
    node = findChild(node, name);
  }
  return node;
}
function isVideoTrak(data: Uint8Array, trak: Box) {
  const hdlr = childPath(trak, ["mdia", "hdlr"]);
  if (!hdlr) return false;
  const p = payload(data, hdlr);
  return p.length >= 12 && asciiSlice(p, 8, 4) === "vide";
}
function isAudioTrak(data: Uint8Array, trak: Box) {
  const hdlr = childPath(trak, ["mdia", "hdlr"]);
  if (!hdlr) return false;
  const p = payload(data, hdlr);
  return p.length >= 12 && asciiSlice(p, 8, 4) === "soun";
}

function parseStts(data: Uint8Array, b: Box): [number, number][] {
  const p = payload(data, b);
  const entryCount = u32(p, 4);
  const out: [number, number][] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 8 <= p.length; i++, off += 8) {
    out.push([u32(p, off), u32(p, off + 4)]);
  }
  return out;
}
function parseStsz(data: Uint8Array, b: Box): number[] {
  const p = payload(data, b);
  const uniform = u32(p, 4);
  const count = u32(p, 8);
  if (uniform !== 0) return Array(count).fill(uniform);
  const sizes: number[] = [];
  let off = 12;
  for (let i = 0; i < count && off + 4 <= p.length; i++, off += 4) {
    sizes.push(u32(p, off));
  }
  return sizes;
}
function parseStsc(data: Uint8Array, b: Box): [number, number, number][] {
  const p = payload(data, b);
  const entryCount = u32(p, 4);
  const out: [number, number, number][] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 12 <= p.length; i++, off += 12) {
    out.push([u32(p, off), u32(p, off + 4), u32(p, off + 8)]);
  }
  return out;
}
function parseStco(data: Uint8Array, b: Box): number[] {
  const p = payload(data, b);
  const entryCount = u32(p, 4);
  const out: number[] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 4 <= p.length; i++, off += 4) {
    out.push(u32(p, off));
  }
  return out;
}
function parseCo64(data: Uint8Array, b: Box): number[] {
  const p = payload(data, b);
  const entryCount = u32(p, 4);
  const out: number[] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 8 <= p.length; i++, off += 8) {
    out.push(u64(p, off));
  }
  return out;
}

// ── builders (tiktok-quality style) ──────────────────────────────────────────

function buildStts(entries: [number, number][]) {
  const body = new Uint8Array(8 + entries.length * 8);
  body.set(w32(0), 0);
  body.set(w32(entries.length), 4);
  for (let i = 0; i < entries.length; i++) {
    body.set(w32(entries[i][0]), 8 + i * 8);
    body.set(w32(entries[i][1]), 12 + i * 8);
  }
  return makeBox("stts", body);
}

function buildStsz(sizes: number[]) {
  const body = new Uint8Array(12 + sizes.length * 4);
  body.set(w32(0), 0); // version+flags
  body.set(w32(0), 4); // sample_size = 0 → table
  body.set(w32(sizes.length), 8);
  for (let i = 0; i < sizes.length; i++) {
    body.set(w32(sizes[i]), 12 + i * 4);
  }
  return makeBox("stsz", body);
}

function buildStsc(entries: [number, number, number][]) {
  const body = new Uint8Array(8 + entries.length * 12);
  body.set(w32(0), 0);
  body.set(w32(entries.length), 4);
  for (let i = 0; i < entries.length; i++) {
    const base = 8 + i * 12;
    body.set(w32(entries[i][0]), base);
    body.set(w32(entries[i][1]), base + 4);
    body.set(w32(entries[i][2]), base + 8);
  }
  return makeBox("stsc", body);
}

function buildStco(offsets: number[]) {
  const body = new Uint8Array(8 + offsets.length * 4);
  body.set(w32(0), 0);
  body.set(w32(offsets.length), 4);
  for (let i = 0; i < offsets.length; i++) {
    body.set(w32(offsets[i] >>> 0), 8 + i * 4);
  }
  return makeBox("stco", body);
}

function buildCo64(offsets: number[]) {
  const body = new Uint8Array(8 + offsets.length * 8);
  body.set(w32(0), 0);
  body.set(w32(offsets.length), 4);
  for (let i = 0; i < offsets.length; i++) {
    body.set(w64(offsets[i]), 8 + i * 8);
  }
  return makeBox("co64", body);
}

function buildFtypIsom() {
  // brand isom, minor 512, compatible isom/iso2/avc1/mp41
  const brands = "isomiso2avc1mp41";
  const content = new Uint8Array(8 + brands.length);
  content.set([0x69, 0x73, 0x6f, 0x6d], 0); // isom
  content.set(w32(512), 4);
  for (let i = 0; i < brands.length; i++) content[8 + i] = brands.charCodeAt(i);
  return makeBox("ftyp", content);
}

function patchMdhdLang(data: Uint8Array, b: Box) {
  const p = new Uint8Array(payload(data, b));
  const langOff = p[0] === 1 ? 28 : 16;
  if (langOff + 2 <= p.length) {
    // und = 0x55C4
    p[langOff] = 0x55;
    p[langOff + 1] = 0xc4;
  }
  return makeBox("mdhd", p);
}

function patchHdlrName(data: Uint8Array, b: Box) {
  const p = payload(data, b);
  if (p.length < 12) return rawBox(data, b);
  const ht = asciiSlice(p, 8, 4);
  let name: string | null = null;
  if (ht === "vide") name = "VideoHandler";
  else if (ht === "soun") name = "SoundHandler";
  else return rawBox(data, b);
  const newP = new Uint8Array(24 + name.length + 1);
  newP.set(p.slice(0, 24), 0);
  for (let i = 0; i < name.length; i++) newP[24 + i] = name.charCodeAt(i);
  return makeBox("hdlr", newP);
}

function patchChunkOffsetsOnly(
  data: Uint8Array,
  b: Box,
  delta: number,
  is64: boolean
) {
  const p = payload(data, b);
  const flagsVer = p.slice(0, 4);
  const entryCount = u32(p, 4);
  const entrySize = is64 ? 8 : 4;
  const newP = new Uint8Array(8 + entryCount * entrySize);
  newP.set(flagsVer, 0);
  newP.set(w32(entryCount), 4);
  let off = 8;
  for (let i = 0; i < entryCount; i++) {
    const old = is64 ? u64(p, off) : u32(p, off);
    const next = old + delta;
    if (is64) newP.set(w64(next), 8 + i * 8);
    else newP.set(w32(next >>> 0), 8 + i * 4);
    off += entrySize;
  }
  return makeBox(is64 ? "co64" : "stco", newP);
}

// ── moov rebuild with ghost-frame tables (video track only) ──────────────────

type GhostPlan = {
  padCount: number;
  /** Original stts runs preserved exactly */
  origStts: [number, number][];
  origSizes: number[];
  origChunks: number[];
  origStsc: [number, number, number][];
  useCo64: boolean;
};

function rebuildMoovWithGhosts(
  data: Uint8Array,
  node: Box,
  videoTrak: Box,
  plan: GhostPlan | null,
  /** absolute file offset of the shared padding NAL in the OUTPUT file */
  padAbs: number,
  /** constant added to every original chunk offset */
  offsetDelta: number,
  currentTrak: [Box | null]
): Uint8Array | null {
  const btype = node.type;

  if (btype === "udta" || btype === "free" || btype === "uuid") return null;
  if (btype === "mdhd") return patchMdhdLang(data, node);
  if (btype === "hdlr") return patchHdlrName(data, node);

  const isVideo = currentTrak[0] === videoTrak && plan !== null;

  if (isVideo && plan) {
    if (btype === "stts") {
      // Preserve every original run (VFR / multi-entry safe), then append
      // ghost samples with sample_delta = 0 so mdhd/mvhd duration stays valid.
      return buildStts([
        ...plan.origStts,
        [plan.padCount, 0],
      ]);
    }
    if (btype === "stsz") {
      const sizes = plan.origSizes.concat(
        Array(plan.padCount).fill(PADDING_SIZE)
      );
      return buildStsz(sizes);
    }
    if (btype === "stsc") {
      const entries = plan.origStsc.slice();
      const lastDesc = entries.length ? entries[entries.length - 1][2] : 1;
      // ONE new chunk holding all padCount ghost samples contiguously.
      // samples_per_chunk = padCount matches a single stco entry at padAbs.
      entries.push([plan.origChunks.length + 1, plan.padCount, lastDesc]);
      return buildStsc(entries);
    }
    if (btype === "stco" || btype === "co64") {
      // Original chunks (shifted) + exactly one chunk for the pad region.
      const offsets = plan.origChunks.map((o) => o + offsetDelta);
      offsets.push(padAbs);
      return plan.useCo64 || btype === "co64"
        ? buildCo64(offsets)
        : buildStco(offsets);
    }
  }

  // Non-video tracks: only apply constant offset delta to their chunk tables
  if (!isVideo && (btype === "stco" || btype === "co64")) {
    return patchChunkOffsetsOnly(data, node, offsetDelta, btype === "co64");
  }

  if (node.children) {
    const parts: Uint8Array[] = [];
    if (btype === "meta") parts.push(payload(data, node).slice(0, 4));
    for (const child of node.children) {
      const saved = currentTrak[0];
      if (child.type === "trak") currentTrak[0] = child;
      const rebuilt = rebuildMoovWithGhosts(
        data,
        child,
        videoTrak,
        plan,
        padAbs,
        offsetDelta,
        currentTrak
      );
      currentTrak[0] = saved;
      if (rebuilt !== null) parts.push(rebuilt);
    }
    return makeBox(btype, concat(...parts));
  }
  return rawBox(data, node);
}

// ── public API ───────────────────────────────────────────────────────────────

export type PatchOptions = {
  /** Frame inflation multiplier (default 10, matching tiktok-quality) */
  multiplier?: number;
};

export function tikquickPatch(
  inputBytes: Uint8Array,
  options: PatchOptions = {}
) {
  const multiplier = Math.max(2, Math.floor(options.multiplier ?? DEFAULT_MULTIPLIER));
  const data =
    inputBytes instanceof Uint8Array
      ? inputBytes
      : new Uint8Array(inputBytes as ArrayBuffer);

  const topBoxes = parseBoxes(data, 0, data.length);
  let moov: Box | null = null;
  let mdat: Box | null = null;
  let ftyp: Box | null = null;

  for (const b of topBoxes) {
    if (b.type === "moov") moov = b;
    else if (b.type === "mdat") mdat = b;
    else if (b.type === "ftyp") ftyp = b;
  }
  if (!moov || !mdat) throw new Error("Invalid MP4: missing moov or mdat");

  const traks = (moov.children || []).filter((c) => c.type === "trak");
  let videoTrak: Box | null = null;
  for (const t of traks) {
    if (isVideoTrak(data, t)) {
      videoTrak = t;
      break;
    }
  }
  if (!videoTrak) throw new Error("No video track found");

  const stbl = childPath(videoTrak, ["mdia", "minf", "stbl"]);
  if (!stbl) throw new Error("Missing stbl");

  const stszBox = findChild(stbl, "stsz");
  const stscBox = findChild(stbl, "stsc");
  const sttsBox = findChild(stbl, "stts");
  const stcoBox = findChild(stbl, "stco");
  const co64Box = findChild(stbl, "co64");
  const offBox = stcoBox || co64Box;
  if (!stszBox || !stscBox || !sttsBox || !offBox) {
    throw new Error("Missing sample tables (need stts/stsz/stsc/stco)");
  }

  const origSizes = parseStsz(data, stszBox);
  const origStsc = parseStsc(data, stscBox);
  const origStts = parseStts(data, sttsBox);
  const useCo64 = !!co64Box && !stcoBox;
  const origChunks = useCo64
    ? parseCo64(data, co64Box!)
    : parseStco(data, stcoBox!);

  const origFrames = origSizes.length;
  if (origFrames < 1) throw new Error("Empty video sample table");

  // Ghost samples get sample_delta = 0 so sum(stts) == original media duration.
  // mdhd / tkhd / mvhd are intentionally left unchanged.
  const padCount = origFrames * (multiplier - 1);

  const plan: GhostPlan = {
    padCount,
    origStts,
    origSizes,
    origChunks,
    origStsc,
    useCo64,
  };

  // ── Measure rebuilt moov size with placeholder padAbs=0, delta=0 ───────────
  const ctRef: [Box | null] = [null];
  const moovProbe = rebuildMoovWithGhosts(
    data,
    moov,
    videoTrak,
    plan,
    0,
    0,
    ctRef
  )!;
  const moovSize = moovProbe.length;

  // Fast-start layout: ftyp | moov | mdat(+contiguous pad region)
  const ftypBytes = buildFtypIsom();
  const sizeBeforeMdat = ftypBytes.length + moovSize;

  // Contiguous pad: padCount × 8-byte NALs. One stco entry + stsc
  // samples_per_chunk=padCount → legal ISO-BMFF (no shared-offset tricks).
  const origPayloadLen = mdat.end - (mdat.start + mdat.header);
  const padRegionBytes = plan.padCount * PADDING_SIZE;
  const mdatContentLen = origPayloadLen + padRegionBytes;
  // size field is 32-bit total box length when ≤ 0xFFFFFFFF
  const mdatHeaderSize = mdatContentLen + 8 > 0xffffffff ? 16 : 8;
  const newMdatDataStart = sizeBeforeMdat + mdatHeaderSize;
  const padAbs = newMdatDataStart + origPayloadLen;

  const origMdatDataStart = mdat.start + mdat.header;
  const offsetDelta = newMdatDataStart - origMdatDataStart;

  // Rebuild moov with correct padAbs + offsetDelta
  ctRef[0] = null;
  const finalMoov = rebuildMoovWithGhosts(
    data,
    moov,
    videoTrak,
    plan,
    padAbs,
    offsetDelta,
    ctRef
  )!;

  // Build contiguous padding region (padCount copies of the 8-byte NAL)
  const padRegion = new Uint8Array(padRegionBytes);
  for (let i = 0; i < plan.padCount; i++) {
    padRegion.set(PADDING_NAL, i * PADDING_SIZE);
  }

  // Build mdat: original payload + contiguous pad region
  const origPayload = data.slice(mdat.start + mdat.header, mdat.end);
  let mdatOut: Uint8Array;
  if (mdatHeaderSize === 16) {
    // 64-bit largesize: [size=1][type][largesize=16+content]
    const header = new Uint8Array(16);
    header.set(w32(1), 0);
    for (let i = 0; i < 4; i++) header[4 + i] = "mdat".charCodeAt(i);
    header.set(w64(16 + mdatContentLen), 8);
    mdatOut = concat(header, origPayload, padRegion);
  } else {
    const header = new Uint8Array(8);
    header.set(w32(8 + mdatContentLen), 0);
    for (let i = 0; i < 4; i++) header[4 + i] = "mdat".charCodeAt(i);
    mdatOut = concat(header, origPayload, padRegion);
  }

  const output = concat(ftypBytes, finalMoov, mdatOut);

  return {
    output,
    fakeCount: padCount,
    moovSize: finalMoov.length,
    origSamples: origFrames,
    declaredSamples: origFrames + padCount,
    multiplier,
  };
}

/** Robust File → Uint8Array */
export async function fileToUint8(file: File): Promise<Uint8Array> {
  try {
    const buf = await file.arrayBuffer();
    if (buf && buf.byteLength > 0) return new Uint8Array(buf);
  } catch {
    /* fall through */
  }
  try {
    const buf = await file.slice(0, file.size).arrayBuffer();
    if (buf && buf.byteLength > 0) return new Uint8Array(buf);
  } catch {
    /* fall through */
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (
        reader.result instanceof ArrayBuffer &&
        reader.result.byteLength > 0
      ) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Could not read file"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsArrayBuffer(file);
  });
}
