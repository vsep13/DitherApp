import * as Comlink from 'comlink';
import { ditherErrorDiffusion } from '@cpu/dither';

export type RunOptions = {
  width: number; height: number; data: Uint8ClampedArray;
  palette: string[];
  serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number;
  kernelName: string;
  grade: { exposure: number; contrast: number; gamma: number; saturation: number };
};

export type PlainImageData = { width: number; height: number; data: Uint8ClampedArray };

const api = {
  runED(opts: RunOptions): PlainImageData {
    const img = new ImageData(opts.data, opts.width, opts.height);
    const out = ditherErrorDiffusion(img, opts.palette, {
      serpentine: opts.serpentine,
      diffusionStrength: opts.diffusionStrength,
      thresholdBias: opts.thresholdBias,
      pixelate: opts.pixelate,
      kernelName: opts.kernelName as any,
      grade: opts.grade,
    });
    return { width: out.width, height: out.height, data: out.data };
  }
};

Comlink.expose(api);
