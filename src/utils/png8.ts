// Minimal PNG encoder for indexed-color (palette) images (color type 3)
// - Writes IHDR, PLTE, IDAT (zlib with uncompressed DEFLATE blocks), IEND
// - No interlace, no ancillary chunks

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function be32(v: number): Uint8Array { const b = new Uint8Array(4); b[0] = (v>>>24)&255; b[1]=(v>>>16)&255; b[2]=(v>>>8)&255; b[3]=v&255; return b; }
function be16(v: number): Uint8Array { const b = new Uint8Array(2); b[0] = (v>>>8)&255; b[1]=v&255; return b; }

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type);
  const len = be32(data.length);
  const crcInput = new Uint8Array(t.length + data.length);
  crcInput.set(t, 0); crcInput.set(data, t.length);
  const crc = be32(crc32(crcInput));
  const out = new Uint8Array(4 + 4 + data.length + 4);
  out.set(len, 0); out.set(t, 4); out.set(data, 8); out.set(crc, 8 + data.length);
  return out;
}

// Build zlib stream with uncompressed deflate blocks (type=0)
function zlibStore(raw: Uint8Array): Uint8Array {
  const header = new Uint8Array([0x78, 0x01]); // CMF/FLG (no compression)
  const blocks: Uint8Array[] = [];
  let pos = 0; const n = raw.length;
  while (pos < n) {
    const chunkLen = Math.min(65535, n - pos);
    const bfinal = (pos + chunkLen >= n) ? 1 : 0;
    const headerBytes = new Uint8Array(5); // 3 header + 2 little-endian len? Actually 5: 1 type + 2 LEN + 2 NLEN
    headerBytes[0] = bfinal; // BFINAL=1 for last, BTYPE=00
    headerBytes[1] = chunkLen & 0xff;
    headerBytes[2] = (chunkLen >>> 8) & 0xff;
    const nlen = (~chunkLen) & 0xffff;
    headerBytes[3] = nlen & 0xff;
    headerBytes[4] = (nlen >>> 8) & 0xff;
    const data = raw.subarray(pos, pos + chunkLen);
    const blk = new Uint8Array(headerBytes.length + data.length);
    blk.set(headerBytes, 0); blk.set(data, headerBytes.length);
    blocks.push(blk);
    pos += chunkLen;
  }
  const ad = be32(adler32(raw));
  const totalLen = header.length + blocks.reduce((s, b) => s + b.length, 0) + 4;
  const out = new Uint8Array(totalLen);
  let off = 0; out.set(header, off); off += header.length;
  for (const blk of blocks) { out.set(blk, off); off += blk.length; }
  out.set(ad, off);
  return out;
}

export function encodePNG8(width: number, height: number, indices: Uint8Array, paletteRGB: Uint8Array, paletteAlpha?: Uint8Array): Uint8Array {
  if (paletteRGB.length % 3 !== 0) throw new Error('paletteRGB length must be multiple of 3');
  if (indices.length !== width * height) throw new Error('indices size mismatch');
  const pngSig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  ihdr.set(be32(width), 0);
  ihdr.set(be32(height), 4);
  ihdr[8] = 8; // bit depth: 8 bits per sample
  ihdr[9] = 3; // color type: indexed-color
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  const IHDR = chunk('IHDR', ihdr);
  const PLTE = chunk('PLTE', paletteRGB);
  let TRNS: Uint8Array | null = null;
  if (paletteAlpha && paletteAlpha.length > 0) {
    // Trim trailing 255 alphas per PNG spec
    let last = paletteAlpha.length - 1;
    while (last >= 0 && paletteAlpha[last] === 255) last--;
    if (last >= 0) {
      const al = paletteAlpha.slice(0, last + 1);
      TRNS = chunk('tRNS', al);
    }
  }
  // Build raw filtered image: each row starts with filter type 0
  const raw = new Uint8Array(height * (1 + width));
  let rp = 0, ip = 0;
  for (let y = 0; y < height; y++) {
    raw[rp++] = 0; // filter: None
    raw.set(indices.subarray(ip, ip + width), rp);
    rp += width; ip += width;
  }
  const zdat = zlibStore(raw);
  const IDAT = chunk('IDAT', zdat);
  const IEND = chunk('IEND', new Uint8Array(0));
  const total = pngSig.length + IHDR.length + PLTE.length + (TRNS ? TRNS.length : 0) + IDAT.length + IEND.length;
  const out = new Uint8Array(total);
  let off = 0;
  out.set(pngSig, off); off += pngSig.length;
  out.set(IHDR, off); off += IHDR.length;
  out.set(PLTE, off); off += PLTE.length;
  if (TRNS) { out.set(TRNS, off); off += TRNS.length; }
  out.set(IDAT, off); off += IDAT.length;
  out.set(IEND, off);
  return out;
}

export function blobFromUint8(data: Uint8Array, mime = 'image/png'): Blob {
  return new Blob([data], { type: mime });
}
