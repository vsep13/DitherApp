import { z } from 'zod';

export const ModeEnum = z.enum(['indexed','rgb','grayscale']);
export const AlgorithmEnum = z.enum(['bayer2','bayer4','bayer8','pattern']);

export const GradeSchema = z.object({
  exposure: z.coerce.number().optional(),
  contrast: z.coerce.number().optional(),
  gamma: z.coerce.number().optional(),
  saturation: z.coerce.number().optional(),
}).partial();

export const PreviewSchema = z.object({
  algorithm: AlgorithmEnum.optional(),
  patternId: z.string().optional(),
  patternScale: z.coerce.number().optional(),
  patternAngle: z.coerce.number().optional(),
  thresholdBias: z.coerce.number().optional(),
  pixelate: z.coerce.number().int().optional(),
  // A/B compare options
  abCompare: z.coerce.boolean().optional(),
  abSplit: z.coerce.number().optional(),
  abVertical: z.coerce.boolean().optional(),
}).partial();

export const ExportCPUSchema = z.object({
  kernel: z.string().optional(),
  serpentine: z.coerce.boolean().optional(),
  diffusionStrength: z.coerce.number().optional(),
  thresholdBias: z.coerce.number().optional(),
  pixelate: z.coerce.number().int().optional(),
}).partial();

export const PresetSchemaV1 = z.object({
  version: z.coerce.number().default(1),
  palette: z.array(z.string()).default(['#000000','#ffffff']).optional(),
  paletteLocks: z.array(z.coerce.boolean()).optional(),
  grade: GradeSchema.optional(),
  view: z.object({ mode: ModeEnum }).optional(),
  preview: PreviewSchema.optional(),
  exportCPU: ExportCPUSchema.optional(),
});

export type PresetV1 = z.infer<typeof PresetSchemaV1>;

export function clamp(val: number, lo: number, hi: number){ return Math.max(lo, Math.min(hi, val)); }

export function normalizePreset(p: PresetV1): PresetV1 {
  const out: PresetV1 = { ...p, version: 1 };
  if(out.palette) out.palette = out.palette.slice(0,256);
  if(out.paletteLocks && out.palette) out.paletteLocks = out.paletteLocks.slice(0, out.palette.length);
  if(out.grade){
    out.grade = {
      exposure: out.grade.exposure!==undefined ? clamp(+out.grade.exposure, 0, 2) : undefined,
      contrast: out.grade.contrast!==undefined ? clamp(+out.grade.contrast, 0, 2) : undefined,
      gamma: out.grade.gamma!==undefined ? clamp(+out.grade.gamma, 0.1, 2.5) : undefined,
      saturation: out.grade.saturation!==undefined ? clamp(+out.grade.saturation, 0, 2) : undefined,
    };
  }
  if(out.preview){
    out.preview = {
      ...out.preview,
      patternScale: out.preview.patternScale!==undefined ? clamp(+out.preview.patternScale, 1, 8) : undefined,
      patternAngle: out.preview.patternAngle!==undefined ? +out.preview.patternAngle : undefined,
      thresholdBias: out.preview.thresholdBias!==undefined ? clamp(+out.preview.thresholdBias, -1, 1) : undefined,
      pixelate: out.preview.pixelate!==undefined ? clamp((+out.preview.pixelate|0), 1, 32) : undefined,
      abCompare: out.preview.abCompare!==undefined ? !!out.preview.abCompare : undefined,
      abSplit: out.preview.abSplit!==undefined ? clamp(+out.preview.abSplit, 0, 1) : undefined,
      abVertical: out.preview.abVertical!==undefined ? !!out.preview.abVertical : undefined,
    };
  }
  if(out.exportCPU){
    out.exportCPU = {
      ...out.exportCPU,
      diffusionStrength: out.exportCPU.diffusionStrength!==undefined ? clamp(+out.exportCPU.diffusionStrength, 0, 1) : undefined,
      thresholdBias: out.exportCPU.thresholdBias!==undefined ? clamp(+out.exportCPU.thresholdBias, -1, 1) : undefined,
      pixelate: out.exportCPU.pixelate!==undefined ? clamp((+out.exportCPU.pixelate|0), 1, 32) : undefined,
    };
  }
  return out;
}

export function parsePreset(raw: unknown): PresetV1 | null {
  try {
    // Basic migration hook: treat missing version as v1
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const parsed = PresetSchemaV1.parse(obj);
    return normalizePreset(parsed);
  } catch {
    return null;
  }
}
