export type ZipEntry = { name: string; data: Uint8Array };

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function le16(v: number): Uint8Array { const b = new Uint8Array(2); b[0] = v & 255; b[1] = (v >>> 8) & 255; return b; }
function le32(v: number): Uint8Array { const b = new Uint8Array(4); b[0] = v & 255; b[1] = (v >>> 8) & 255; b[2] = (v >>> 16) & 255; b[3] = (v >>> 24) & 255; return b; }

export function makeZip(entries: ZipEntry[]): Uint8Array {
  const localHeaders: { nameBytes: Uint8Array; header: Uint8Array; data: Uint8Array; offset: number; crc: number }[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name);
    const sig = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const ver = le16(20), flags = le16(0), comp = le16(0), mtime = le16(0), mdate = le16(0);
    const crc = crc32(e.data), csize = le32(e.data.length), usize = le32(e.data.length);
    const nlen = le16(nameBytes.length), elen = le16(0);
    const header = new Uint8Array(30);
    header.set(sig, 0);
    header.set(ver, 4); header.set(flags, 6); header.set(comp, 8); header.set(mtime, 10); header.set(mdate, 12);
    header.set(le32(crc), 14); header.set(csize, 18); header.set(usize, 22); header.set(nlen, 26); header.set(elen, 28);
    localHeaders.push({ nameBytes, header, data: e.data, offset, crc });
    offset += header.length + nameBytes.length + e.data.length;
  }
  const centralParts: Uint8Array[] = [];
  let cdSize = 0; const cdOffset = offset;
  for (const lh of localHeaders) {
    const sig = new Uint8Array([0x50, 0x4b, 0x01, 0x02]);
    const verMade = le16(20), verNeed = le16(20), flags = le16(0), comp = le16(0);
    const mtime = le16(0), mdate = le16(0);
    const crc = le32(lh.crc), csize = le32(lh.data.length), usize = le32(lh.data.length);
    const nlen = le16(lh.nameBytes.length), elen = le16(0), clen = le16(0);
    const disk = le16(0), iattr = le16(0), eattr = le32(0);
    const off = le32(lh.offset);
    const header = new Uint8Array(46);
    header.set(sig, 0);
    header.set(verMade, 4); header.set(verNeed, 6); header.set(flags, 8); header.set(comp, 10);
    header.set(mtime, 12); header.set(mdate, 14); header.set(crc, 16); header.set(csize, 20); header.set(usize, 24);
    header.set(nlen, 28); header.set(elen, 30); header.set(clen, 32); header.set(disk, 34); header.set(iattr, 36); header.set(eattr, 38); header.set(off, 42);
    const rec = new Uint8Array(header.length + lh.nameBytes.length);
    rec.set(header, 0); rec.set(lh.nameBytes, header.length);
    centralParts.push(rec); cdSize += rec.length;
  }
  const eocd = new Uint8Array(22);
  eocd.set([0x50, 0x4b, 0x05, 0x06], 0);
  eocd.set(le16(0), 4); eocd.set(le16(0), 6); eocd.set(le16(entries.length), 8); eocd.set(le16(entries.length), 10);
  eocd.set(le32(cdSize), 12); eocd.set(le32(cdOffset), 16); eocd.set(le16(0), 20);
  let total = 0; for (const lh of localHeaders) total += lh.header.length + lh.nameBytes.length + lh.data.length; for (const cp of centralParts) total += cp.length; total += eocd.length;
  const out = new Uint8Array(total); let off = 0;
  for (const lh of localHeaders) { out.set(lh.header, off); off += lh.header.length; out.set(lh.nameBytes, off); off += lh.nameBytes.length; out.set(lh.data, off); off += lh.data.length; }
  for (const cp of centralParts) { out.set(cp, off); off += cp.length; }
  out.set(eocd, off);
  return out;
}

export function downloadZip(zipBytes: Uint8Array, filename = 'files.zip'){
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

