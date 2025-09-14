import { create } from 'zustand';

export type Mode = 'grayscale' | 'rgb' | 'indexed';
export type DitherAlgorithm = 'floyd-steinberg' | 'bayer2' | 'bayer4' | 'bayer8' | 'pattern';

export interface AppState {
  image: HTMLImageElement | null;
  imageBitmap: ImageBitmap | null;
  palette: string[]; // hex strings
  paletteLocks: boolean[]; // same length as palette
  pixelate: number; // 1..32
  mode: Mode;
  algorithm: DitherAlgorithm;
  serpentine: boolean;
  diffusionStrength: number; // 0..1
  thresholdBias: number; // -1..1
  patternScale: number; // ordered
  patternAngle: number; // radians
  patternId: string; // preset id
  seed: number;
  viewScale: number; // zoom factor
  viewOffset: { x: number; y: number }; // uv offset
  showGrid: boolean;
  abCompare: boolean;
  abSplit: number; // 0..1
  // Grade
  exposure: number; // 0..2 (1)
  contrast: number; // 0..2 (1)
  gamma: number; // 0..2 (1)
  saturation: number; // 0..2 (1)
  // CRT
  crtEnabled: boolean;
  crtScanline: number; // 0..1
  crtMaskStrength: number; // 0..1
  crtMaskType: number; // 0 none,1 aperture,2 shadow
  crtBarrel: number; // 0..0.3
  crtVignette: number; // 0..1
  // Glow
  glowEnabled: boolean;
  glowThreshold: number; // 0..1
  glowIntensity: number; // 0..4
  glowRadius: number; // 0..10 (base offset)
  glowIterations: number; // 1..6
  glowRGBSpread: number; // 0..2
  // CPU export kernel
  cpuKernel: 'floyd-steinberg' | 'jjn' | 'stucki' | 'atkinson' | 'burkes' | 'sierra-lite' | 'sierra-2-4a' | 'sierra-3' | 'stevenson-arce';
  set: <K extends keyof AppState>(k: K, v: AppState[K]) => void;
}

export const useStore = create<AppState>((set) => ({
  image: null,
  imageBitmap: null,
  palette: ['#000000', '#ffffff'],
  paletteLocks: [false, false],
  pixelate: 1,
  mode: 'indexed',
  algorithm: 'floyd-steinberg',
  serpentine: true,
  diffusionStrength: 1,
  thresholdBias: 0,
  patternScale: 1,
  patternAngle: 0,
  patternId: 'bayer8',
  seed: 1337,
  viewScale: 1,
  viewOffset: { x: 0, y: 0 },
  showGrid: false,
  abCompare: false,
  abSplit: 0.5,
  exposure: 1,
  contrast: 1,
  gamma: 1,
  saturation: 1,
  crtEnabled: false,
  crtScanline: 0.4,
  crtMaskStrength: 0.3,
  crtMaskType: 1,
  crtBarrel: 0.05,
  crtVignette: 0.2,
  glowEnabled: false,
  glowThreshold: 0.85,
  glowIntensity: 0.8,
  glowRadius: 2.0,
  glowIterations: 3,
  glowRGBSpread: 0.0,
  cpuKernel: 'floyd-steinberg',
  set: (k, v) => set((s)=>{
    if(k==='palette'){
      const arr = v as unknown as string[];
      const locks = s.paletteLocks.slice(0, arr.length);
      while(locks.length < arr.length) locks.push(false);
      return { palette: arr, paletteLocks: locks } as any;
    }
    if(k==='paletteLocks'){
      const arr = v as unknown as boolean[];
      const locks = arr.slice(0, s.palette.length);
      while(locks.length < s.palette.length) locks.push(false);
      return { paletteLocks: locks } as any;
    }
    return { [k]: v } as any;
  })
}));
