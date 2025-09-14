import { encodePNG8, blobFromUint8 } from './png8';
import { hexToRgb, hexToRgba } from './color';

export function paletteToRGBBytes(paletteHex: string[], max = 256): Uint8Array {
  const n = Math.min(max, paletteHex.length);
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = hexToRgb(paletteHex[i] || '#000000');
    out[i * 3 + 0] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}

export function paletteToRGBAndAlpha(paletteHex: string[], max = 256): { rgb: Uint8Array; alpha: Uint8Array } {
  const n = Math.min(max, paletteHex.length);
  const rgb = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = hexToRgba(paletteHex[i] || '#000000');
    rgb[i * 3 + 0] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    alpha[i] = a;
  }
  return { rgb, alpha };
}

export function indicesFromImage(image: ImageData, paletteHex: string[]): Uint8Array {
  const w = image.width, h = image.height;
  const data = image.data;
  const N = Math.min(256, Math.max(1, paletteHex.length));
  const map = new Map<number, number>();
  const pals: [number, number, number][] = new Array(N);
  for (let i = 0; i < N; i++) {
    const [r, g, b] = hexToRgb(paletteHex[i]);
    pals[i] = [r, g, b];
    const key = (r << 16) | (g << 8) | b;
    map.set(key, i);
  }
  const idx = new Uint8Array(w * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = data[p++]; const g = data[p++]; const b = data[p++]; p++; // skip a
      const key = (r << 16) | (g << 8) | b;
      let i = map.get(key);
      if (i === undefined) {
        // Fallback: nearest in RGB
        let best = Infinity, bi = 0;
        for (let j = 0; j < N; j++) {
          const [pr, pg, pb] = pals[j];
          const dr = r - pr, dg = g - pg, db = b - pb;
          const d = dr * dr + dg * dg + db * db;
          if (d < best) { best = d; bi = j; }
        }
        i = bi;
      }
      idx[y * w + x] = i as number;
    }
  }
  return idx;
}

export function encodeIndexedPNGFromImage(image: ImageData, paletteHex: string[]): Blob {
  const { rgb, alpha } = paletteToRGBAndAlpha(paletteHex);
  const idx = indicesFromImage(image, paletteHex);
  const hasTrans = alpha.some(a => a !== 255);
  const png = encodePNG8(image.width, image.height, idx, rgb, hasTrans ? alpha : undefined);
  return blobFromUint8(png, 'image/png');
}

export function encodeMaskPNGFromIndices(w: number, h: number, indices: Uint8Array, swatchIndex: number): Blob {
  const maskIdx = new Uint8Array(w * h);
  for (let i = 0; i < indices.length; i++) maskIdx[i] = indices[i] === swatchIndex ? 1 : 0;
  const palette = new Uint8Array([0, 0, 0, 255, 255, 255]); // black, white
  const png = encodePNG8(w, h, maskIdx, palette);
  return blobFromUint8(png, 'image/png');
}
