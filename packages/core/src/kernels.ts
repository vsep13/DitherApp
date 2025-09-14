export type KernelOffset = { dx: number; dy: number; w: number };
export type Kernel = { denom: number; offsets: KernelOffset[] };

export const Kernels: Record<string, Kernel> = {
  'floyd-steinberg': { denom: 16, offsets: [
    { dx: 1, dy: 0, w: 7 }, { dx: -1, dy: 1, w: 3 }, { dx: 0, dy: 1, w: 5 }, { dx: 1, dy: 1, w: 1 }
  ]},
  jjn: { denom: 48, offsets: [
    { dx: 1, dy: 0, w: 7 }, { dx: 2, dy: 0, w: 5 },
    { dx: -2, dy: 1, w: 3 }, { dx: -1, dy: 1, w: 5 }, { dx: 0, dy: 1, w: 7 }, { dx: 1, dy: 1, w: 5 }, { dx: 2, dy: 1, w: 3 },
    { dx: -2, dy: 2, w: 1 }, { dx: -1, dy: 2, w: 3 }, { dx: 0, dy: 2, w: 5 }, { dx: 1, dy: 2, w: 3 }, { dx: 2, dy: 2, w: 1 },
  ]},
  stucki: { denom: 42, offsets: [
    { dx: 1, dy: 0, w: 8 }, { dx: 2, dy: 0, w: 4 },
    { dx: -2, dy: 1, w: 2 }, { dx: -1, dy: 1, w: 4 }, { dx: 0, dy: 1, w: 8 }, { dx: 1, dy: 1, w: 4 }, { dx: 2, dy: 1, w: 2 },
    { dx: -2, dy: 2, w: 1 }, { dx: -1, dy: 2, w: 2 }, { dx: 0, dy: 2, w: 4 }, { dx: 1, dy: 2, w: 2 }, { dx: 2, dy: 2, w: 1 },
  ]},
  atkinson: { denom: 8, offsets: [
    { dx: 1, dy: 0, w: 1 }, { dx: 2, dy: 0, w: 1 }, { dx: -1, dy: 1, w: 1 }, { dx: 0, dy: 1, w: 1 }, { dx: 1, dy: 1, w: 1 }, { dx: 0, dy: 2, w: 1 },
  ]},
  burkes: { denom: 32, offsets: [
    { dx: 1, dy: 0, w: 8 }, { dx: 2, dy: 0, w: 4 }, { dx: -2, dy: 1, w: 2 }, { dx: -1, dy: 1, w: 4 }, { dx: 0, dy: 1, w: 8 }, { dx: 1, dy: 1, w: 4 }, { dx: 2, dy: 1, w: 2 },
  ]},
  'sierra-lite': { denom: 4, offsets: [
    { dx: 1, dy: 0, w: 2 }, { dx: -1, dy: 1, w: 1 }, { dx: 0, dy: 1, w: 1 },
  ]},
  'sierra-2-4a': { denom: 16, offsets: [
    { dx: 1, dy: 0, w: 4 }, { dx: 2, dy: 0, w: 3 }, { dx: -2, dy: 1, w: 1 }, { dx: -1, dy: 1, w: 2 }, { dx: 0, dy: 1, w: 3 }, { dx: 1, dy: 1, w: 2 }, { dx: 2, dy: 1, w: 1 },
  ]},
  'sierra-3': { denom: 32, offsets: [
    { dx: 1, dy: 0, w: 5 }, { dx: 2, dy: 0, w: 3 }, { dx: -2, dy: 1, w: 2 }, { dx: -1, dy: 1, w: 4 }, { dx: 0, dy: 1, w: 5 }, { dx: 1, dy: 1, w: 4 }, { dx: 2, dy: 1, w: 2 }, { dx: -2, dy: 2, w: 2 }, { dx: -1, dy: 2, w: 3 }, { dx: 0, dy: 2, w: 2 },
  ]},
  'stevenson-arce': { denom: 200, offsets: [
    { dx: 2, dy: 0, w: 32 }, { dx: -3, dy: 1, w: 12 }, { dx: -1, dy: 1, w: 26 }, { dx: 1, dy: 1, w: 30 }, { dx: 3, dy: 1, w: 16 }, { dx: -2, dy: 2, w: 12 }, { dx: 0, dy: 2, w: 26 }, { dx: 2, dy: 2, w: 12 }, { dx: -3, dy: 3, w: 5 }, { dx: -1, dy: 3, w: 12 }, { dx: 1, dy: 3, w: 12 }, { dx: 3, dy: 3, w: 5 },
  ]},
};

