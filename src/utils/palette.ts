import { rgbToHex } from './color';

export async function samplePaletteFromImageBitmap(bmp: ImageBitmap, count: number = 16): Promise<string[]> {
  const maxW = 128, maxH = 128;
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const hasOffscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas: OffscreenCanvas | HTMLCanvasElement = hasOffscreen
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = (canvas as any).getContext('2d', { willReadFrequently: true })! as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = (ctx as any).getImageData(0, 0, w, h).data as Uint8ClampedArray;
  const map = new Map<number, number>();
  for (let i = 0; i < img.length; i += 4) {
    const r = img[i], g = img[i + 1], b = img[i + 2];
    // Quantize to 5-6-5 bins to reduce variety
    const rq = r & 0xF8, gq = g & 0xFC, bq = b & 0xF8;
    const key = (rq << 16) | (gq << 8) | bq;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, count);
  return entries.map(([k]) => {
    const r = (k >> 16) & 0xff; const g = (k >> 8) & 0xff; const b = k & 0xff;
    return rgbToHex(r, g, b);
  });
}
