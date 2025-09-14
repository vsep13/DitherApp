import { describe, it, expect } from 'vitest';
import { nearestPaletteRGB, bayer8 } from '@/utils/quantize';

describe('nearestPaletteRGB', () => {
  it('chooses nearest color in Euclidean RGB', () => {
    const p = ['#000000', '#ffffff', '#ff0000'];
    expect(nearestPaletteRGB([20,10,10], p)).toEqual([0,0,0]);
    expect(nearestPaletteRGB([250,250,250], p)).toEqual([255,255,255]);
    expect(nearestPaletteRGB([200,20,20], p)).toEqual([255,0,0]);
  });
});

describe('bayer8', () => {
  it('returns in [0,1) and varies per cell', () => {
    const seen = new Set<number>();
    for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
      const v = bayer8(x,y);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(Math.round(v*64));
    }
    expect(seen.size).toBe(64);
  });
});

