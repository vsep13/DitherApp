// sRGB <-> Linear and OKLab conversions (basics)

export function srgbToLinear(c: number): number {
  const cs = c / 255;
  const v = cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  return v;
}

export function linearToSrgb(f: number): number {
  const v = f <= 0.0031308 ? 12.92 * f : 1.055 * Math.pow(f, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, v)) * 255;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return [r, g, b];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Simple OKLab conversion for perceptual distance (we can refine later)
// https://bottosson.github.io/posts/oklab/
function srgbToLinear3(r: number, g: number, b: number) {
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const [lr, lg, lb] = srgbToLinear3(r, g, b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return [L, a, b2];
}

export function deltaEOklab(c1: [number,number,number], c2: [number,number,number]): number {
  const dL = c1[0]-c2[0]; const da = c1[1]-c2[1]; const db = c1[2]-c2[2];
  return Math.hypot(dL, da, db);
}

