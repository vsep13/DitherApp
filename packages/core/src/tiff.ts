// Minimal baseline TIFF encoder for 8-bit paletted (Photometric=PaletteColor) images.
// Little-endian, single strip, no compression.
import { hexToRgb } from './color';

function writeShortLE(buf: Uint8Array, off: number, v: number){ buf[off] = v & 0xff; buf[off+1] = (v>>>8)&0xff; }
function writeLongLE(buf: Uint8Array, off: number, v: number){ buf[off] = v & 0xff; buf[off+1] = (v>>>8)&0xff; buf[off+2] = (v>>>16)&0xff; buf[off+3] = (v>>>24)&0xff; }

function paletteToColorMap(palette: string[], size = 256): Uint16Array {
  const n = Math.min(size, Math.max(1, palette.length));
  const r = new Uint16Array(size), g = new Uint16Array(size), b = new Uint16Array(size);
  for(let i=0;i<n;i++){ const [rr,gg,bb] = hexToRgb(palette[i]||'#000000'); r[i] = (rr/255)*65535|0; g[i] = (gg/255)*65535|0; b[i] = (bb/255)*65535|0; }
  // Fill rest with zeros
  const out = new Uint16Array(size*3);
  out.set(r, 0); out.set(g, size); out.set(b, size*2);
  return out;
}

// Returns a Uint8Array representing a TIFF file
export function encodeTIFF8Indexed(width: number, height: number, indices: Uint8Array, paletteHex: string[]): Uint8Array {
  if(indices.length !== width*height) throw new Error('indices size mismatch');
  const BPS = 8; // bits per sample
  const colorMap = paletteToColorMap(paletteHex, 256);
  const colormapBytes = new Uint8Array(colorMap.buffer);
  // Layout: header (8) | pixel data | color map | IFD
  const headerSize = 8;
  const pixelOffset = headerSize;
  const pixelSize = indices.length;
  const colorMapOffset = pixelOffset + pixelSize;
  const colorMapSize = colormapBytes.length; // 3*256*2 = 1536
  const ifdOffset = colorMapOffset + colorMapSize;
  const entryCount = 11;
  const ifdSize = 2 + entryCount*12 + 4;
  const total = ifdOffset + ifdSize;
  const buf = new Uint8Array(total);
  // Header: II 42 IFDOffset
  buf[0] = 0x49; buf[1] = 0x49; // little-endian
  writeShortLE(buf, 2, 42);
  writeLongLE(buf, 4, ifdOffset);
  // Pixel data (single strip, uncompressed)
  buf.set(indices, pixelOffset);
  // ColorMap data (Uint16 LE)
  // Already little-endian in the typed array view; but ensure byte order OK
  buf.set(colormapBytes, colorMapOffset);

  const TYPE_SHORT = 3, TYPE_LONG = 4;
  function writeEntry(base: number, idx: number, tag: number, type: number, count: number, value: number){
    const off = base + 2 + idx*12; // after count field
    writeShortLE(buf, off-2, tag);
    writeShortLE(buf, off, type);
    writeLongLE(buf, off+2, count);
    writeLongLE(buf, off+6, value);
  }
  // IFD
  writeShortLE(buf, ifdOffset, entryCount);
  let i = 0;
  // ImageWidth (256) LONG 1
  writeEntry(ifdOffset, i++, 256, TYPE_LONG, 1, width);
  // ImageLength (257) LONG 1
  writeEntry(ifdOffset, i++, 257, TYPE_LONG, 1, height);
  // BitsPerSample (258) SHORT 1 -> value 8 packed in value field
  writeEntry(ifdOffset, i++, 258, TYPE_SHORT, 1, BPS);
  // Compression (259) SHORT 1 -> 1 (no compression)
  writeEntry(ifdOffset, i++, 259, TYPE_SHORT, 1, 1);
  // PhotometricInterpretation (262) SHORT 1 -> 3 (palette color)
  writeEntry(ifdOffset, i++, 262, TYPE_SHORT, 1, 3);
  // StripOffsets (273) LONG 1 -> pixelOffset
  writeEntry(ifdOffset, i++, 273, TYPE_LONG, 1, pixelOffset);
  // SamplesPerPixel (277) SHORT 1 -> 1
  writeEntry(ifdOffset, i++, 277, TYPE_SHORT, 1, 1);
  // RowsPerStrip (278) LONG 1 -> height
  writeEntry(ifdOffset, i++, 278, TYPE_LONG, 1, height);
  // StripByteCounts (279) LONG 1 -> pixelSize
  writeEntry(ifdOffset, i++, 279, TYPE_LONG, 1, pixelSize);
  // PlanarConfiguration (284) SHORT 1 -> 1 (chunky)
  writeEntry(ifdOffset, i++, 284, TYPE_SHORT, 1, 1);
  // ColorMap (320) SHORT 3*256 -> offset to colorMap
  writeEntry(ifdOffset, i++, 320, TYPE_SHORT, 3*256, colorMapOffset);
  // Next IFD offset = 0
  writeLongLE(buf, ifdOffset + 2 + entryCount*12, 0);
  return buf;
}

export function blobFromTIFF(data: Uint8Array): Blob { return new Blob([data], { type: 'image/tiff' }); }

// RGBA 8-bit per sample (32-bit) uncompressed TIFF with ExtraSamples=Unassociated Alpha
export function encodeTIFFRGBA32(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if(rgba.length !== width*height*4) throw new Error('rgba size mismatch');
  const headerSize = 8;
  const pixelOffset = headerSize;
  const pixelSize = rgba.length;
  // BitsPerSample array (4x SHORT = 8 bytes)
  const bpsOffset = pixelOffset + pixelSize;
  const bpsSize = 8;
  const ifdOffset = bpsOffset + bpsSize;
  // IFD entries
  const entryCount = 12; // includes ExtraSamples
  const ifdSize = 2 + entryCount*12 + 4;
  const total = ifdOffset + ifdSize;
  const buf = new Uint8Array(total);
  // Header II*
  buf[0]=0x49; buf[1]=0x49; buf[2]=42; buf[3]=0; // 42 little-endian
  writeLongLE(buf, 4, ifdOffset);
  // Pixel data
  buf.set(rgba, pixelOffset);
  // BitsPerSample values: 8,8,8,8 (little-endian shorts)
  writeShortLE(buf, bpsOffset+0, 8);
  writeShortLE(buf, bpsOffset+2, 8);
  writeShortLE(buf, bpsOffset+4, 8);
  writeShortLE(buf, bpsOffset+6, 8);
  const TYPE_SHORT=3, TYPE_LONG=4;
  function writeEntry(base: number, idx: number, tag: number, type: number, count: number, value: number){
    const off = base + 2 + idx*12;
    writeShortLE(buf, off+0, tag);
    writeShortLE(buf, off+2, type);
    writeLongLE(buf, off+4, count);
    writeLongLE(buf, off+8, value);
  }
  writeShortLE(buf, ifdOffset, entryCount);
  let i=0;
  // Width/Length
  writeEntry(ifdOffset, i++, 256, TYPE_LONG, 1, width);
  writeEntry(ifdOffset, i++, 257, TYPE_LONG, 1, height);
  // BitsPerSample SHORT[4] -> offset
  writeEntry(ifdOffset, i++, 258, TYPE_SHORT, 4, bpsOffset);
  // Compression = 1 (none)
  writeEntry(ifdOffset, i++, 259, TYPE_SHORT, 1, 1);
  // PhotometricInterpretation = 2 (RGB)
  writeEntry(ifdOffset, i++, 262, TYPE_SHORT, 1, 2);
  // StripOffsets -> pixelOffset
  writeEntry(ifdOffset, i++, 273, TYPE_LONG, 1, pixelOffset);
  // SamplesPerPixel = 4
  writeEntry(ifdOffset, i++, 277, TYPE_SHORT, 1, 4);
  // RowsPerStrip = height
  writeEntry(ifdOffset, i++, 278, TYPE_LONG, 1, height);
  // StripByteCounts = pixelSize
  writeEntry(ifdOffset, i++, 279, TYPE_LONG, 1, pixelSize);
  // PlanarConfiguration = 1
  writeEntry(ifdOffset, i++, 284, TYPE_SHORT, 1, 1);
  // ExtraSamples tag (338) SHORT[1] value=2 (Unassociated alpha)
  writeEntry(ifdOffset, i++, 338, TYPE_SHORT, 1, 2);
  writeLongLE(buf, ifdOffset + 2 + entryCount*12, 0);
  return buf;
}
