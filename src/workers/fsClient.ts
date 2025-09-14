export type RunFSOptions = {
  imageBitmap: ImageBitmap;
  palette: string[]; // hex
  serpentine: boolean;
  diffusionStrength: number;
  thresholdBias: number;
  pixelate: number;
  grade: { exposure: number; contrast: number; gamma: number; saturation: number };
  kernel?: 'floyd-steinberg' | 'jjn' | 'stucki' | 'atkinson' | 'burkes' | 'sierra-lite' | 'sierra-2-4a' | 'sierra-3' | 'stevenson-arce';
};

function hexToRgb(hex: string): [number,number,number]{
  const h = hex.replace('#','');
  const n = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
  return [parseInt(n.slice(0,2),16), parseInt(n.slice(2,4),16), parseInt(n.slice(4,6),16)];
}

// Vite worker import (handles bundling and module worker support)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite provides worker types
import FSWorker from './fsWorker?worker';

function getCanvas(w: number, h: number): { canvas: HTMLCanvasElement | OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D }{
  const hasOffscreen = typeof OffscreenCanvas !== 'undefined';
  if(hasOffscreen){
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    return { canvas: c, ctx };
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  return { canvas: c, ctx };
}

export async function runFS({ imageBitmap, palette, serpentine, diffusionStrength, thresholdBias, pixelate, grade, kernel }: RunFSOptions): Promise<ImageData> {
  const w = imageBitmap.width, h = imageBitmap.height;
  const { ctx } = getCanvas(w, h);
  ctx.drawImage(imageBitmap, 0, 0);
  const img = (ctx as any).getImageData(0, 0, w, h) as ImageData;

  const palBytes = new Uint8Array(Math.min(256, palette.length) * 3);
  for(let i=0;i<palBytes.length/3;i++){
    const [r,g,b] = hexToRgb(palette[i] || '#000000');
    palBytes[i*3+0]=r; palBytes[i*3+1]=g; palBytes[i*3+2]=b;
  }

  const worker: Worker = new FSWorker();
  const params = { width: w, height: h, data: img.data, palette: palBytes, serpentine, diffusionStrength, thresholdBias, pixelate, grade, kernelName: kernel } as const;
  const result: ImageData = await new Promise((resolve, reject) => {
    worker.onmessage = (ev) => {
      const { type, rgba, width, height } = ev.data as { type: 'result'; rgba: Uint8ClampedArray; width: number; height: number };
      if(type === 'result'){
        const out = new ImageData(rgba, width, height);
        worker.terminate();
        resolve(out);
      }
    };
    worker.onerror = (e) => { worker.terminate(); reject(e); };
    worker.postMessage({ type: 'fs', params }, [img.data.buffer]);
  });
  return result;
}
