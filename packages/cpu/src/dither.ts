import { Kernels } from '@core/kernels';
import { nearestPaletteOKLab } from '@core/palette';

export type Grade = { exposure: number; contrast: number; gamma: number; saturation: number };

function clamp255(x: number){ return x < 0 ? 0 : x > 255 ? 255 : x; }

function applyGrade(r: number, g: number, b: number, p: Grade){
  r *= p.exposure; g *= p.exposure; b *= p.exposure;
  r = (r - 128) * p.contrast + 128; g = (g - 128) * p.contrast + 128; b = (b - 128) * p.contrast + 128;
  const y = 0.2126*r + 0.7152*g + 0.0722*b; r = y + (r-y)*p.saturation; g = y + (g-y)*p.saturation; b = y + (b-y)*p.saturation;
  const gp = Math.max(0.001, p.gamma);
  r = Math.pow(Math.max(0, r/255), gp) * 255; g = Math.pow(Math.max(0, g/255), gp) * 255; b = Math.pow(Math.max(0, b/255), gp) * 255;
  return [clamp255(r), clamp255(g), clamp255(b)] as [number, number, number];
}

export function ditherErrorDiffusion(image: ImageData, palette: string[], opts: {
  serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number; kernelName: keyof typeof Kernels; grade: Grade;
}): ImageData {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(width*height*4);
  const bufR = new Float32Array(width*height);
  const bufG = new Float32Array(width*height);
  const bufB = new Float32Array(width*height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const sx = opts.pixelate>1 ? Math.floor(x/opts.pixelate)*opts.pixelate : x;
    const sy = opts.pixelate>1 ? Math.floor(y/opts.pixelate)*opts.pixelate : y;
    const si = (sy*width+sx)*4; const r=data[si], g=data[si+1], b=data[si+2];
    const [rr,gg,bb] = applyGrade(r,g,b, opts.grade); const i=y*width+x; bufR[i]=rr; bufG[i]=gg; bufB[i]=bb;
  }
  const kernel = Kernels[opts.kernelName] || Kernels['floyd-steinberg'];
  const bias = opts.thresholdBias * 32;
  for(let y=0;y<height;y++){
    const leftToRight = !opts.serpentine || (y%2===0);
    const xStart = leftToRight ? 0 : width-1; const xEnd = leftToRight ? width : -1; const step = leftToRight?1:-1;
    for(let x=xStart; x!=xEnd; x+=step){
      const idx = y*width+x; let r=bufR[idx]+bias, g=bufG[idx]+bias, b=bufB[idx]+bias; r=clamp255(r); g=clamp255(g); b=clamp255(b);
      const [qr,qg,qb] = nearestPaletteOKLab(r,g,b, palette);
      out[idx*4+0]=qr; out[idx*4+1]=qg; out[idx*4+2]=qb; out[idx*4+3]=255;
      const er=(r-qr)*opts.diffusionStrength, eg=(g-qg)*opts.diffusionStrength, eb=(b-qb)*opts.diffusionStrength;
      for(const t of kernel.offsets){ const dx=leftToRight? t.dx : -t.dx; const nx=x+dx; const ny=y+t.dy; if(nx<0||nx>=width||ny<0||ny>=height) continue; const j=ny*width+nx; const w=t.w/kernel.denom; bufR[j]+=er*w; bufG[j]+=eg*w; bufB[j]+=eb*w; }
    }
  }
  return new ImageData(out, width, height);
}

