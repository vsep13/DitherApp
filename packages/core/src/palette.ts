import { hexToRgb, rgbToOklab, deltaEOklab } from './color';

export function nearestPaletteOKLab(r: number, g: number, b: number, palette: string[]): [number, number, number] {
  if (palette.length === 0) return [r, g, b];
  const src = rgbToOklab(r, g, b);
  let best = Infinity; let out: [number, number, number] = [r, g, b];
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = hexToRgb(palette[i] || '#000000');
    const d = deltaEOklab(src, rgbToOklab(pr, pg, pb));
    if (d < best) { best = d; out = [pr, pg, pb]; }
  }
  return out;
}

export function parseHexList(input: string): string[] {
  const tokens = input.split(/[^#a-fA-F0-9]+/g).filter(Boolean);
  return tokens.map((t) => (t.startsWith('#') ? t : `#${t}`));
}

