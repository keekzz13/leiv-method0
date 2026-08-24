"use client";

/**
 * Zilem / original Leiv Method core
 * Exact behavior restored from zilem.netlify.app (fake-sample inflation).
 *
 * targetCount = floor(originalSamples * 20 / 3)
 * Adds synthetic 8-byte samples, patches stsz / stsc / stco|co64,
 * leaves stts unchanged, appends one FAKE_SAMPLE to mdat.
 */

const FAKE_SAMPLE = new Uint8Array([
  0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00,
]);

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
function stszInfo(data: Uint8Array, b: Box) {
  const p = payload(data, b);
  return { sampleSize: u32(p, 4), count: u32(p, 8) };
}

// ── patches (Zilem / original behavior) ──────────────────────────────────────

function patchMdhd(data: Uint8Array, b: Box) {
  const p = new Uint8Array(payload(data, b));
  const langOff = p[0] === 1 ? 28 : 16;
  if (langOff + 2 <= p.length) {
    // original Zilem value 21956
    p[langOff] = (21956 >> 8) & 0xff;
    p[langOff + 1] = 21956 & 0xff;
  }
  return makeBox("mdhd", p);
}

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
  return makeBox("hdlr", newP);
}

function patchStsz(data: Uint8Array, b: Box, fakeCount: number) {
  if (fakeCount < 1) return rawBox(data, b);
  const p = payload(data, b);
  const flagsVer = p.slice(0, 4);
  const sampleSize = u32(p, 4);
  const count = u32(p, 8);
  const sizes: number[] = [];
  if (sampleSize !== 0) {
    for (let i = 0; i < count; i++) sizes.push(sampleSize);
  } else {
    let off = 12;
    for (let i = 0; i < count && off + 4 <= p.length; i++, off += 4) {
      sizes.push(u32(p, off));
    }
  }
  for (let i = 0; i < fakeCount; i++) sizes.push(8);
  const newP = new Uint8Array(12 + sizes.length * 4);
  newP.set(flagsVer, 0);
  newP.set(w32(0), 4); // force sample_size = 0 (table of sizes)
  newP.set(w32(sizes.length), 8);
  for (let i = 0; i < sizes.length; i++) {
    newP.set(w32(sizes[i]), 12 + i * 4);
  }
  return makeBox("stsz", newP);
}

function patchStsc(data: Uint8Array, b: Box, totalChunks: number) {
  if (totalChunks < 1) return rawBox(data, b);
  const p = payload(data, b);
  const flagsVer = p.slice(0, 4);
  const entryCount = u32(p, 4);
  const entries: [number, number, number][] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 12 <= p.length; i++, off += 12) {
    entries.push([u32(p, off), u32(p, off + 4), u32(p, off + 8)]);
  }
  const lastDesc = entries.length ? entries[entries.length - 1][2] : 1;
  entries.push([totalChunks + 1, 1, lastDesc]);
  const newP = new Uint8Array(8 + entries.length * 12);
  newP.set(flagsVer, 0);
  newP.set(w32(entries.length), 4);
  for (let i = 0; i < entries.length; i++) {
    const base = 8 + i * 12;
    newP.set(w32(entries[i][0]), base);
    newP.set(w32(entries[i][1]), base + 4);
    newP.set(w32(entries[i][2]), base + 8);
  }
  return makeBox("stsc", newP);
}

function patchStco(
  data: Uint8Array,
  b: Box,
  moovDelta: number,
  mdatPos: number,
  fakeCount: number
) {
  const p = payload(data, b);
  const flagsVer = p.slice(0, 4);
  const entryCount = u32(p, 4);
  const offsets: number[] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 4 <= p.length; i++, off += 4) {
    offsets.push(u32(p, off) + moovDelta);
  }
  for (let i = 0; i < fakeCount; i++) offsets.push(mdatPos);
  const newP = new Uint8Array(8 + offsets.length * 4);
  newP.set(flagsVer, 0);
  newP.set(w32(offsets.length), 4);
  for (let i = 0; i < offsets.length; i++) {
    newP.set(w32(offsets[i]), 8 + i * 4);
  }
  return makeBox("stco", newP);
}

function patchCo64(
  data: Uint8Array,
  b: Box,
  moovDelta: number,
  mdatPos: number,
  fakeCount: number
) {
  const p = payload(data, b);
  const flagsVer = p.slice(0, 4);
  const entryCount = u32(p, 4);
  const offsets: number[] = [];
  let off = 8;
  for (let i = 0; i < entryCount && off + 8 <= p.length; i++, off += 8) {
    offsets.push(u64(p, off) + moovDelta);
  }
  for (let i = 0; i < fakeCount; i++) offsets.push(mdatPos);
  const newP = new Uint8Array(8 + offsets.length * 8);
  newP.set(flagsVer, 0);
  newP.set(w32(offsets.length), 4);
  for (let i = 0; i < offsets.length; i++) {
    newP.set(w64(offsets[i]), 8 + i * 8);
  }
  return makeBox("co64", newP);
}

function rebuildMoov(
  data: Uint8Array,
  node: Box,
  videoTrak: Box,
  moovDelta: number,
  mdatPos: number,
  fakeCount: number,
  currentTrak: [Box | null]
): Uint8Array | null {
  const btype = node.type;
  if (btype === "udta" || btype === "free" || btype === "uuid") return null;
  if (btype === "mdhd") return patchMdhd(data, node);
  if (btype === "hdlr") return patchHdlr(data, node);

  const isVideo = currentTrak[0] === videoTrak;

  if (isVideo && btype === "stsz") return patchStsz(data, node, fakeCount);
  if (isVideo && btype === "stts") return rawBox(data, node); // left unchanged (Zilem behavior)

  if (isVideo && btype === "stsc" && fakeCount > 0) {
    const stbl = childPath(videoTrak, ["mdia", "minf", "stbl"]);
    const offBox = stbl
      ? findChild(stbl, "stco") || findChild(stbl, "co64")
      : null;
    const totChunks = offBox ? u32(payload(data, offBox), 4) : 0;
    return patchStsc(data, node, totChunks);
  }

  if (btype === "stco")
    return patchStco(data, node, moovDelta, mdatPos, fakeCount);
  if (btype === "co64")
    return patchCo64(data, node, moovDelta, mdatPos, fakeCount);

  if (node.children) {
    const parts: Uint8Array[] = [];
    if (btype === "meta") parts.push(payload(data, node).slice(0, 4));
    for (const child of node.children) {
      const saved = currentTrak[0];
      if (child.type === "trak") currentTrak[0] = child;
      const rebuilt = rebuildMoov(
        data,
        child,
        videoTrak,
        moovDelta,
        mdatPos,
        fakeCount,
        currentTrak
      );
      currentTrak[0] = saved;
      if (rebuilt !== null) parts.push(rebuilt);
    }
    return makeBox(btype, concat(...parts));
  }
  return rawBox(data, node);
}

// ── public entry (identical to Zilem tikquickPatch) ──────────────────────────

export function tikquickPatch(inputBytes: Uint8Array) {
  const data =
    inputBytes instanceof Uint8Array
      ? inputBytes
      : new Uint8Array(inputBytes as ArrayBuffer);

  const topBoxes = parseBoxes(data, 0, data.length);
  let moov: Box | null = null;
  let mdat: Box | null = null;
  for (const b of topBoxes) {
    if (b.type === "moov") moov = b;
    else if (b.type === "mdat") mdat = b;
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
  const offBox = findChild(stbl, "stco") || findChild(stbl, "co64");
  if (!stszBox || !stscBox || !offBox)
    throw new Error("Missing sample tables");

  const si = stszInfo(data, stszBox);
  // ── Zilem formula ──
  const targetCount = Math.floor((si.count * 20) / 3);
  const fakeCount = Math.max(0, targetCount - si.count);
  const ctRef: [Box | null] = [null];

  let totalBeforeMdat = 0;
  for (const b of topBoxes) {
    if (b.type === "mdat") break;
    if (b.type === "moov") {
      ctRef[0] = null;
      totalBeforeMdat += rebuildMoov(
        data,
        moov,
        videoTrak,
        0,
        mdat.end,
        fakeCount,
        ctRef
      )!.length;
    } else if (!["free", "skip", "uuid"].includes(b.type)) {
      totalBeforeMdat += rawBox(data, b).length;
    }
  }

  const finalDelta = totalBeforeMdat - mdat.start;
  const finalMdatPos = mdat.end + finalDelta;
  ctRef[0] = null;
  const finalMoov = rebuildMoov(
    data,
    moov,
    videoTrak,
    finalDelta,
    finalMdatPos,
    fakeCount,
    ctRef
  )!;

  const parts: Uint8Array[] = [];
  for (const b of topBoxes) {
    if (b.type === "ftyp") {
      parts.push(rawBox(data, b));
    } else if (b.type === "moov") {
      parts.push(finalMoov);
    } else if (b.type === "mdat") {
      const origMdat = rawBox(data, mdat);
      if (fakeCount > 0) {
        const newSize = origMdat.length + FAKE_SAMPLE.length;
        let header: Uint8Array;
        if (newSize > 0xffffffff) {
          header = new Uint8Array(16);
          header.set(w32(1), 0);
          for (let i = 0; i < 4; i++) header[4 + i] = "mdat".charCodeAt(i);
          header.set(w64(newSize), 8);
        } else {
          header = new Uint8Array(8);
          header.set(w32(newSize), 0);
          for (let i = 0; i < 4; i++) header[4 + i] = "mdat".charCodeAt(i);
        }
        const newMdat = new Uint8Array(newSize);
        newMdat.set(header, 0);
        newMdat.set(origMdat.slice(mdat.header), header.length);
        newMdat.set(FAKE_SAMPLE, newSize - FAKE_SAMPLE.length);
        parts.push(newMdat);
      } else {
        parts.push(origMdat);
      }
    } else if (!["free", "skip", "uuid"].includes(b.type)) {
      parts.push(rawBox(data, b));
    }
  }

  return {
    output: concat(...parts),
    fakeCount,
    moovSize: finalMoov.length,
    origSamples: si.count,
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
