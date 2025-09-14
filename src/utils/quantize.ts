import { hexToRgb } from './color';

export function nearestPaletteRGB(color: [number,number,number], palette: string[]): [number,number,number]{
  let best = Infinity; let out: [number,number,number] = color;
  const [cr,cg,cb] = color;
  for(let i=0;i<palette.length && i<256;i++){
    const [r,g,b]=hexToRgb(palette[i]);
    const d=(cr-r)*(cr-r)+(cg-g)*(cg-g)+(cb-b)*(cb-b);
    if(d<best){ best=d; out=[r,g,b]; }
  }
  return out;
}

// Bayer 8x8 value 0..1 for integer pixel coords
export function bayer8(x: number, y: number): number{
  const m = [
    0,48,12,60,3,51,15,63,
    32,16,44,28,35,19,47,31,
    8,56,4,52,11,59,7,55,
    40,24,36,20,43,27,39,23,
    2,50,14,62,1,49,13,61,
    34,18,46,30,33,17,45,29,
    10,58,6,54,9,57,5,53,
    42,26,38,22,41,25,37,21
  ];
  const idx = (y%8)*8 + (x%8);
  return m[idx]/64;
}

