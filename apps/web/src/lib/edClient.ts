import * as Comlink from 'comlink';
// Vite worker import (module worker)
// @ts-ignore
import DitherWorker from '@worker/worker?worker';

export type RunOpts = {
  width: number; height: number; data: Uint8ClampedArray;
  palette: string[];
  serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number;
  kernelName: string;
  grade: { exposure: number; contrast: number; gamma: number; saturation: number };
};

export type WorkerApi = {
  runED(opts: RunOpts): { width: number; height: number; data: Uint8ClampedArray };
};

export class EDClient {
  private worker: Worker;
  private api: Comlink.Remote<WorkerApi>;
  constructor(){
    this.worker = new DitherWorker();
    this.api = Comlink.wrap<WorkerApi>(this.worker);
  }
  async runED(opts: RunOpts): Promise<ImageData> {
    // Transfer the pixel buffer for performance
    const data = opts.data;
    const res = await (this.api as any).runED(Comlink.transfer({ ...opts, data }, [data.buffer]));
    // Reconstruct ImageData from plain object
    const out = new ImageData(res.data, res.width, res.height);
    return out;
  }
  dispose(){ this.worker.terminate(); }
}
