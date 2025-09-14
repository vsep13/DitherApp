// Indexed-color PNG encoder with optional sRGB and gAMA chunks

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
  for (let i = 0; i < buf.length; i++) { a = (a + buf[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}

function be32(v: number): Uint8Array { const b = new Uint8Array(4); b[0] = (v>>>24)&255; b[1]=(v>>>16)&255; b[2]=(v>>>8)&255; b[3]=v&255; return b; }
function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type);
  const len = be32(data.length);
  const crcIn = new Uint8Array(t.length + data.length); crcIn.set(t, 0); crcIn.set(data, t.length);
  const crc = be32(crc32(crcIn));
  const out = new Uint8Array(4 + 4 + data.length + 4);
  out.set(len, 0); out.set(t, 4); out.set(data, 8); out.set(crc, 8 + data.length);
  return out;
}

function zlibStore(raw: Uint8Array): Uint8Array {
  const header = new Uint8Array([0x78, 0x01]);
  const blocks: Uint8Array[] = [];
  let pos = 0; const n = raw.length;
  while (pos < n) {
    const chunkLen = Math.min(65535, n - pos);
    const bfinal = (pos + chunkLen >= n) ? 1 : 0;
    const hdr = new Uint8Array(5);
    hdr[0] = bfinal; hdr[1] = chunkLen & 0xff; hdr[2] = (chunkLen>>>8)&0xff; const nlen=(~chunkLen)&0xffff; hdr[3]=nlen&0xff; hdr[4]=(nlen>>>8)&0xff;
    const data = raw.subarray(pos, pos + chunkLen);
    const blk = new Uint8Array(hdr.length + data.length);
    blk.set(hdr, 0); blk.set(data, hdr.length); blocks.push(blk); pos += chunkLen;
  }
  const ad = be32(adler32(raw));
  const total = header.length + blocks.reduce((s,b)=>s+b.length,0) + 4;
  const out = new Uint8Array(total); let off=0; out.set(header,off); off+=header.length; for(const b of blocks){ out.set(b,off); off+=b.length; } out.set(ad,off);
  return out;
}

export function encodePNG8(width: number, height: number, indices: Uint8Array, paletteRGB: Uint8Array, paletteAlpha?: Uint8Array, withSRGB=true): Uint8Array {
  if (paletteRGB.length % 3 !== 0) throw new Error('paletteRGB length must be multiple of 3');
  if (indices.length !== width * height) throw new Error('indices size mismatch');
  const pngSig = new Uint8Array([137,80,78,71,13,10,26,10]);
  const ihdr = new Uint8Array(13);
  ihdr.set(be32(width), 0); ihdr.set(be32(height), 4); ihdr[8]=8; ihdr[9]=3; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const IHDR = chunk('IHDR', ihdr);
  // Optional sRGB and gAMA chunks for better consistency
  const sRGB = withSRGB ? chunk('sRGB', new Uint8Array([0])) : null; // rendering intent: perceptual
  const gAMA = withSRGB ? chunk('gAMA', be32(45455)) : null; // ~1/2.2
  const PLTE = chunk('PLTE', paletteRGB);
  let TRNS: Uint8Array | null = null;
  if (paletteAlpha && paletteAlpha.length > 0) {
    let last = paletteAlpha.length - 1; while (last>=0 && paletteAlpha[last]===255) last--; if(last>=0){ TRNS = chunk('tRNS', paletteAlpha.slice(0,last+1)); }
  }
  const raw = new Uint8Array(height * (1 + width));
  let rp = 0, ip = 0; for(let y=0;y<height;y++){ raw[rp++]=0; raw.set(indices.subarray(ip, ip+width), rp); rp+=width; ip+=width; }
  const zdat = zlibStore(raw);
  const IDAT = chunk('IDAT', zdat);
  const IEND = chunk('IEND', new Uint8Array(0));
  const parts: Uint8Array[] = [pngSig, IHDR]; if(sRGB) parts.push(sRGB); if(gAMA) parts.push(gAMA); parts.push(PLTE); if(TRNS) parts.push(TRNS); parts.push(IDAT, IEND);
  const total = parts.reduce((s,p)=>s+p.length,0); const out = new Uint8Array(total); let off=0; for(const p of parts){ out.set(p,off); off+=p.length; }
  return out;
}

export function blobFromUint8(data: Uint8Array, mime='image/png'): Blob { return new Blob([data], { type: mime }); }

