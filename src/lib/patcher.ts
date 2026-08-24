"use client";

/**
 * Leiv Method – standards-compliant MP4 container optimizer
 *
 * Goals:
 *  - Leave every encoded video/audio sample byte-for-byte untouched
 *  - No re-encoding
 *  - Preserve duration, timing, FPS, A/V sync
 *  - Produce a structurally valid ISO-BMFF file
 *  - Fast-start layout (moov before mdat) with correct chunk offsets
 *  - Strip non-essential atoms that some upload pipelines dislike
 *
 * What was removed from the previous implementation (and why):
 *  - Inflating stsz sample_count to ~6.67× original
 *  - Appending only one 8-byte fake sample while claiming many
 *  - Adding many stco/co64 entries that all point at the same address
 *  - Leaving stts unchanged while changing stsz/stsc
 *    → these produced internally inconsistent sample tables.
 *      Parsers that trust stsz.sample_count then discover that
 *      stts, stsc and the actual mdat bytes disagree.  Upload
 *      platforms fall into a slow “repair / full re-index /
 *      suspicious-file” path, which is exactly the delay you saw.
 */

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

// ─── binary helpers ───────────────────────────────────────────────────────────

const dv = (buf: ArrayBuffer | Uint8Array) =>
  new DataView(
    buf instanceof ArrayBuffer ? buf : buf.buffer,
    (buf as Uint8Array).byteOffset ?? 0,
    buf.byteLength
  );

function u32(data: Uint8Array, off: number) {
  return dv(data).getUint32(off, false);
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

// ─── box model ────────────────────────────────────────────────────────────────

class Box {
  constructor(
    public type: string,
    public start: number,
    public end: number,
    public size: number,
    public header: number,
    public children: Box[] | null = null
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
    if (btype === "meta") childStart += 4; // version+flags
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
function stszInfo(data: Uint8Array, b: Box) {
  const p = payload(data, b);
  return { sampleSize: u32(p, 4), count: u32(p, 8) };
}

// ─── lightweight, standards-safe patches ──────────────────────────────────────

/** Normalize media language code (und = 0x55C4). Harmless, keeps some probes happy. */
function patchMdhd(data: Uint8Array, b: Box) {
  const p = new Uint8Array(payload(data, b));
  const langOff = p[0] === 1 ? 28 : 16;
  if (langOff + 2 <= p.length) {
    // 0x55C4 = "und"
    p[langOff] = 0x55;
    p[langOff + 1] = 0xc4;
  }
  return makeBox("mdhd", p);
}

/** Give video/audio handlers canonical names. Does not change sample data. */
function patchHdlr(data: Uint8Array, b: Box) {
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
  // trailing NUL already zero-filled
  return makeBox("hdlr", newP);
}

/**
 * Rewrite every chunk offset by a constant delta.
 * This is the only change required when the absolute position of mdat moves
 * (fast-start reorder or removal of free/skip atoms).
 * Sample counts, sizes and timing tables are left completely untouched.
 */
function patchChunkOffsets(
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
    if (is64) {
      newP.set(w64(next), 8 + i * 8);
    } else {
      // If the new offset no longer fits in 32 bits we would need co64,
      // but for typical files (<4 GiB) this never happens.
      newP.set(w32(next >>> 0), 8 + i * 4);
    }
    off += entrySize;
  }
  return makeBox(is64 ? "co64" : "stco", newP);
}

// ─── moov rebuild ─────────────────────────────────────────────────────────────

/**
 * Recursively rebuild a moov (or any container) subtree.
 * - Drops udta / free / uuid (non-essential, sometimes trigger extra scanning)
 * - Applies mdhd language + hdlr name normalizations
 * - Applies the constant offset delta to every stco / co64 (all tracks)
 * - Leaves stts, stsz, stsc, stss, ctts, … completely unchanged
 */
function rebuildMoov(
  data: Uint8Array,
  node: Box,
  delta: number
): Uint8Array | null {
  const btype = node.type;

  // Strip atoms that are not required for playback and that some
  // upload pipelines treat as “extra work”.
  if (btype === "udta" || btype === "free" || btype === "uuid") return null;

  if (btype === "mdhd") return patchMdhd(data, node);
  if (btype === "hdlr") return patchHdlr(data, node);

  if (btype === "stco") return patchChunkOffsets(data, node, delta, false);
  if (btype === "co64") return patchChunkOffsets(data, node, delta, true);

  // Everything else that has children: rebuild recursively
  if (node.children) {
    const parts: Uint8Array[] = [];
    if (btype === "meta") {
      // preserve version+flags that sit before the child boxes
      parts.push(payload(data, node).slice(0, 4));
    }
    for (const child of node.children) {
      const rebuilt = rebuildMoov(data, child, delta);
      if (rebuilt !== null) parts.push(rebuilt);
    }
    return makeBox(btype, concat(...parts));
  }

  // Leaf boxes we don’t specially handle – copy verbatim
  return rawBox(data, node);
}

// ─── public entry point ───────────────────────────────────────────────────────

export function tikquickPatch(inputBytes: Uint8Array) {
  const data = inputBytes;
  const topBoxes = parseBoxes(data, 0, data.length);

  let moov: Box | null = null;
  let mdat: Box | null = null;
  let ftyp: Box | null = null;
  const other: Box[] = [];

  for (const b of topBoxes) {
    if (b.type === "moov") moov = b;
    else if (b.type === "mdat") mdat = b;
    else if (b.type === "ftyp") ftyp = b;
    else if (!["free", "skip", "uuid"].includes(b.type)) other.push(b);
  }

  if (!moov || !mdat) throw new Error("Invalid MP4: missing moov or mdat");
  if (!ftyp) throw new Error("Invalid MP4: missing ftyp");

  // Optional diagnostics – original sample count (unchanged by this patcher)
  const traks = (moov.children || []).filter((c) => c.type === "trak");
  let origSamples = 0;
  for (const t of traks) {
    if (!isVideoTrak(data, t)) continue;
    const stbl = childPath(t, ["mdia", "minf", "stbl"]);
    const stszBox = stbl ? findChild(stbl, "stsz") : null;
    if (stszBox) origSamples = stszInfo(data, stszBox).count;
    break;
  }

  // ── 1. Measure the size of a rebuilt moov with delta = 0
  //        (only structural changes: stripped atoms + mdhd/hdlr patches).
  //        Chunk offsets are still the original absolute values at this stage.
  const moovProbe = rebuildMoov(data, moov, 0)!;
  const moovSize = moovProbe.length;

  // ── 2. Decide final layout: ftyp | other | moov | mdat   (classic fast-start)
  const ftypBytes = rawBox(data, ftyp);
  const otherBytes = other.map((b) => rawBox(data, b));
  const otherTotal = otherBytes.reduce((s, b) => s + b.length, 0);

  const sizeBeforeMdat = ftypBytes.length + otherTotal + moovSize;

  // mdat header size in the *output* (same rule as original)
  const mdatPayloadLen = mdat.end - (mdat.start + mdat.header);
  const mdatHeaderSize = mdatPayloadLen + 8 > 0xffffffff ? 16 : 8;

  const newMdatDataStart = sizeBeforeMdat + mdatHeaderSize;
  const origMdatDataStart = mdat.start + mdat.header;
  const delta = newMdatDataStart - origMdatDataStart;

  // ── 3. Rebuild moov for real, now applying the constant offset delta
  //        to every stco / co64 in every track.
  const finalMoov = rebuildMoov(data, moov, delta)!;

  // ── 4. Emit the new file
  //        mdat payload is copied verbatim – zero quality loss.
  let mdatOut: Uint8Array;
  if (mdatHeaderSize === 16) {
    const header = new Uint8Array(16);
    header.set(w32(1), 0);
    for (let i = 0; i < 4; i++) header[4 + i] = "mdat".charCodeAt(i);
    header.set(w64(mdatPayloadLen + 16), 8);
    mdatOut = concat(header, data.slice(mdat.start + mdat.header, mdat.end));
  } else {
    const header = new Uint8Array(8);
    header.set(w32(mdatPayloadLen + 8), 0);
    for (let i = 0; i < 4; i++) header[4 + i] = "mdat".charCodeAt(i);
    mdatOut = concat(header, data.slice(mdat.start + mdat.header, mdat.end));
  }

  const parts: Uint8Array[] = [ftypBytes, ...otherBytes, finalMoov, mdatOut];
  const output = concat(...parts);

  return {
    output,
    fakeCount: 0, // no synthetic samples – tables stay consistent
    moovSize: finalMoov.length,
    origSamples,
  };
}

/** Robust File → Uint8Array (handles permission / mobile edge cases) */
export async function fileToUint8(file: File): Promise<Uint8Array> {
  try {
    const buf = await file.arrayBuffer();
    if (buf && buf.byteLength > 0) return new Uint8Array(buf);
  } catch {
    // fall through
  }
  try {
    const buf = await file.slice(0, file.size).arrayBuffer();
    if (buf && buf.byteLength > 0) return new Uint8Array(buf);
  } catch {
    // fall through
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer && reader.result.byteLength > 0) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Could not read file"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsArrayBuffer(file);
  });
}
