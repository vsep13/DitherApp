// Web Worker: Exact Floyd–Steinberg error diffusion (CPU)

export type FSParams = {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, row-major
  palette: Uint8Array; // length = N*3, N<=256
  serpentine: boolean;
  diffusionStrength: number; // 0..1
  thresholdBias: number; // -1..1 (applied as 0..255 offset)
  pixelate: number; // 1..32
  grade: { exposure: number; contrast: number; gamma: number; saturation: number };
  kernelName?:
    | 'floyd-steinberg'
    | 'jjn'
    | 'stucki'
    | 'atkinson'
    | 'burkes'
    | 'sierra-lite'
    | 'sierra-2-4a'
    | 'sierra-3'
    | 'stevenson-arce';
};

type FSMessage = { type: 'fs'; params: FSParams };
type FSResult = { type: 'result'; rgba: Uint8ClampedArray; width: number; height: number };

function clamp255(x: number){ return x < 0 ? 0 : x > 255 ? 255 : x; }

function applyGrade(r: number, g: number, b: number, p: FSParams){
  // exposure
  r *= p.grade.exposure; g *= p.grade.exposure; b *= p.grade.exposure;
  // contrast around 0.5 (128)
  const c = p.grade.contrast;
  r = (r - 128) * c + 128;
  g = (g - 128) * c + 128;
  b = (b - 128) * c + 128;
  // saturation via luma
  const y = 0.2126*r + 0.7152*g + 0.0722*b;
  const s = p.grade.saturation;
  r = y + (r - y) * s;
  g = y + (g - y) * s;
  b = y + (b - y) * s;
  // gamma (apply in 0..1 then back)
  const gpow = Math.max(0.001, p.grade.gamma);
  r = Math.pow(Math.max(0, r/255), gpow) * 255;
  g = Math.pow(Math.max(0, g/255), gpow) * 255;
  b = Math.pow(Math.max(0, b/255), gpow) * 255;
  return [clamp255(r), clamp255(g), clamp255(b)] as [number,number,number];
}

function nearestPalette(r:number,g:number,b:number, pal: Uint8Array){
  let best = Infinity; let outR = r, outG = g, outB = b;
  const n = pal.length / 3 | 0;
  for(let i=0;i<n;i++){
    const pr = pal[i*3+0], pg = pal[i*3+1], pb = pal[i*3+2];
    const dr = r - pr, dg = g - pg, db = b - pb;
    const d = dr*dr + dg*dg + db*db;
    if(d < best){ best = d; outR = pr; outG = pg; outB = pb; }
  }
  return [outR, outG, outB] as [number,number,number];
}

type Kernel = { offsets: Array<{ dx: number; dy: number; w: number }>; denom: number };

function getKernel(name: NonNullable<FSParams['kernelName']> | undefined): Kernel {
  switch (name) {
    case 'jjn':
      return {
        denom: 48,
        offsets: [
          { dx: 1, dy: 0, w: 7 },
          { dx: 2, dy: 0, w: 5 },
          { dx: -2, dy: 1, w: 3 },
          { dx: -1, dy: 1, w: 5 },
          { dx: 0, dy: 1, w: 7 },
          { dx: 1, dy: 1, w: 5 },
          { dx: 2, dy: 1, w: 3 },
          { dx: -2, dy: 2, w: 1 },
          { dx: -1, dy: 2, w: 3 },
          { dx: 0, dy: 2, w: 5 },
          { dx: 1, dy: 2, w: 3 },
          { dx: 2, dy: 2, w: 1 },
        ],
      };
    case 'stucki':
      return {
        denom: 42,
        offsets: [
          { dx: 1, dy: 0, w: 8 },
          { dx: 2, dy: 0, w: 4 },
          { dx: -2, dy: 1, w: 2 },
          { dx: -1, dy: 1, w: 4 },
          { dx: 0, dy: 1, w: 8 },
          { dx: 1, dy: 1, w: 4 },
          { dx: 2, dy: 1, w: 2 },
          { dx: -2, dy: 2, w: 1 },
          { dx: -1, dy: 2, w: 2 },
          { dx: 0, dy: 2, w: 4 },
          { dx: 1, dy: 2, w: 2 },
          { dx: 2, dy: 2, w: 1 },
        ],
      };
    case 'atkinson':
      return {
        denom: 8,
        offsets: [
          { dx: 1, dy: 0, w: 1 },
          { dx: 2, dy: 0, w: 1 },
          { dx: -1, dy: 1, w: 1 },
          { dx: 0, dy: 1, w: 1 },
          { dx: 1, dy: 1, w: 1 },
          { dx: 0, dy: 2, w: 1 },
        ],
      };
    case 'burkes':
      return {
        denom: 32,
        offsets: [
          { dx: 1, dy: 0, w: 8 },
          { dx: 2, dy: 0, w: 4 },
          { dx: -2, dy: 1, w: 2 },
          { dx: -1, dy: 1, w: 4 },
          { dx: 0, dy: 1, w: 8 },
          { dx: 1, dy: 1, w: 4 },
          { dx: 2, dy: 1, w: 2 },
        ],
      };
    case 'sierra-lite':
      return {
        denom: 4,
        offsets: [
          { dx: 1, dy: 0, w: 2 },
          { dx: -1, dy: 1, w: 1 },
          { dx: 0, dy: 1, w: 1 },
        ],
      };
    case 'sierra-2-4a':
      return {
        denom: 16,
        offsets: [
          { dx: 1, dy: 0, w: 4 },
          { dx: 2, dy: 0, w: 3 },
          { dx: -2, dy: 1, w: 1 },
          { dx: -1, dy: 1, w: 2 },
          { dx: 0, dy: 1, w: 3 },
          { dx: 1, dy: 1, w: 2 },
          { dx: 2, dy: 1, w: 1 },
        ],
      };
    case 'sierra-3':
      return {
        denom: 32,
        offsets: [
          { dx: 1, dy: 0, w: 5 },
          { dx: 2, dy: 0, w: 3 },
          { dx: -2, dy: 1, w: 2 },
          { dx: -1, dy: 1, w: 4 },
          { dx: 0, dy: 1, w: 5 },
          { dx: 1, dy: 1, w: 4 },
          { dx: 2, dy: 1, w: 2 },
          { dx: -2, dy: 2, w: 2 },
          { dx: -1, dy: 2, w: 3 },
          { dx: 0, dy: 2, w: 2 },
        ],
      };
    case 'stevenson-arce':
      return {
        denom: 200,
        offsets: [
          { dx: 2, dy: 0, w: 32 },
          { dx: -3, dy: 1, w: 12 },
          { dx: -1, dy: 1, w: 26 },
          { dx: 1, dy: 1, w: 30 },
          { dx: 3, dy: 1, w: 16 },
          { dx: -2, dy: 2, w: 12 },
          { dx: 0, dy: 2, w: 26 },
          { dx: 2, dy: 2, w: 12 },
          { dx: -3, dy: 3, w: 5 },
          { dx: -1, dy: 3, w: 12 },
          { dx: 1, dy: 3, w: 12 },
          { dx: 3, dy: 3, w: 5 },
        ],
      };
    case 'floyd-steinberg':
    default:
      return {
        denom: 16,
        offsets: [
          { dx: 1, dy: 0, w: 7 },
          { dx: -1, dy: 1, w: 3 },
          { dx: 0, dy: 1, w: 5 },
          { dx: 1, dy: 1, w: 1 },
        ],
      };
  }
}

function ditherFS(params: FSParams): Uint8ClampedArray {
  const { width, height, data, serpentine, diffusionStrength, thresholdBias, pixelate, kernelName } = params;
  const out = new Uint8ClampedArray(width*height*4);
  // Work buffer in floats for error diffusion
  const bufR = new Float32Array(width*height);
  const bufG = new Float32Array(width*height);
  const bufB = new Float32Array(width*height);

  // Load source with grading applied and optional pixelate sampling
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const sx = pixelate>1 ? Math.floor(x/pixelate)*pixelate : x;
      const sy = pixelate>1 ? Math.floor(y/pixelate)*pixelate : y;
      const si = (sy*width + sx)*4;
      const r = data[si], g = data[si+1], b = data[si+2];
      const [rr,gg,bb] = applyGrade(r,g,b, params);
      const i = y*width + x;
      bufR[i] = rr; bufG[i] = gg; bufB[i] = bb;
    }
  }

  const pal = params.palette;
  const kernel = getKernel(kernelName);
  const bias = thresholdBias * 32; // small bias
  const w1 = 7/16, w2 = 3/16, w3 = 5/16, w4 = 1/16;
  for(let y=0;y<height;y++){
    const leftToRight = !serpentine || (y % 2 === 0);
    const xStart = leftToRight ? 0 : width - 1;
    const xEnd = leftToRight ? width : -1;
    const xStep = leftToRight ? 1 : -1;
    for(let x=xStart; x!=xEnd; x+=xStep){
      const i = y*width + x;
      let r = bufR[i] + bias, g = bufG[i] + bias, b = bufB[i] + bias;
      r = clamp255(r); g = clamp255(g); b = clamp255(b);
      const [qr,qg,qb] = nearestPalette(r,g,b, pal);
      out[i*4+0] = qr; out[i*4+1] = qg; out[i*4+2] = qb; out[i*4+3] = 255;
      const er = (r - qr) * diffusionStrength;
      const eg = (g - qg) * diffusionStrength;
      const eb = (b - qb) * diffusionStrength;
      // Distribute error using selected kernel
      for(const t of kernel.offsets){
        const dx = leftToRight ? t.dx : -t.dx;
        const dy = t.dy;
        const w = t.w / kernel.denom;
        const nx = x + dx; const ny = y + dy;
        if(nx>=0 && nx<width && ny>=0 && ny<height){
          const j = ny*width + nx;
          bufR[j] += er * w; bufG[j] += eg * w; bufB[j] += eb * w;
        }
      }
    }
  }
  return out;
}

self.onmessage = (ev: MessageEvent<FSMessage>) => {
  const msg = ev.data;
  if(msg.type === 'fs'){
    const rgba = ditherFS(msg.params);
    const res: FSResult = { type: 'result', rgba, width: msg.params.width, height: msg.params.height };
    // Transfer buffer to avoid copy
    (self as any).postMessage(res, [rgba.buffer]);
  }
};
