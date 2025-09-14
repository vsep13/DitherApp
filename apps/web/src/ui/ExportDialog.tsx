import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { exportPNGFromGL, exportIndexedPNGViaCPU, exportSwatchMasksZip, exportIndexedTIFFViaCPU, exportTIFFRGBAFromGL } from '../lib/export';

export function ExportDialog({ open, onClose, canvasRef, imageBitmap, palette, grade, cpuOpts, cropRect, view }:{
  open: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageBitmap: ImageBitmap | null;
  palette: string[];
  grade: { exposure: number; contrast: number; gamma: number; saturation: number };
  cpuOpts: { serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number; kernelName: string };
  cropRect?: { x: number; y: number; w: number; h: number } | null;
  view?: { scale: number; offset: { x: number; y: number } };
}){
  const [pngScale, setPngScale] = useState<number>(1);
  const [pngBg, setPngBg] = useState<string>('#000000');
  const [idxScale, setIdxScale] = useState<number>(1);
  const [transparentIndex, setTransparentIndex] = useState<string>('none');
  const [tiffScale, setTiffScale] = useState<number>(1);
  const [tiffRGBAScale, setTiffRGBAScale] = useState<number>(1);
  if(!open) return null;
  return (
    <Dialog.Root open={open} onOpenChange={(v)=>{ if(!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,95vw)] max-h-[85vh] overflow-auto bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl text-zinc-100">
          <div className="flex items-center gap-3 mb-3">
            <Dialog.Title className="font-semibold">Export</Dialog.Title>
            <Dialog.Description className="sr-only">Configure image export options and formats.</Dialog.Description>
            <div className="grow" />
            <Dialog.Close asChild><button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">Close</button></Dialog.Close>
          </div>
          <div className="space-y-4">
            <section className="border border-zinc-800 rounded p-3">
              <div className="font-semibold mb-2">PNG (Preview)</div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="text-zinc-400">Scale</div>
                <input className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1" type="number" min={1} max={16} step={1} value={pngScale} onChange={(e)=> setPngScale(Math.max(1, Math.min(16, Number(e.target.value)||1)))} />
                <div className="text-zinc-400">Background</div>
                <input className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1" type="color" value={pngBg} onChange={(e)=> setPngBg(e.target.value)} />
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
                  const c = canvasRef.current; if(!c) return; await exportPNGFromGL(c, 'preview.png', { scale: pngScale, background: pngBg });
                }}>Export PNG</button>
                {!!cropRect && <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
                  const c = canvasRef.current; if(!c) return; await exportPNGFromGL(c, 'preview-crop.png', { scale: pngScale, background: pngBg, crop: cropRect });
                }}>Export PNG (Crop)</button>}
                <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
                  const c = canvasRef.current; if(!c) return; await exportTIFFRGBAFromGL(c, 'dither-rgba.tiff', { scale: tiffRGBAScale });
                }}>Export TIFF (RGBA)</button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 items-center">
                <div className="text-zinc-400">TIFF RGBA Scale</div>
                <input className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1" type="number" min={1} max={16} step={1} value={tiffRGBAScale} onChange={(e)=> setTiffRGBAScale(Math.max(1, Math.min(16, Number(e.target.value)||1)))} />
              </div>
            </section>
            <section className="border border-zinc-800 rounded p-3">
              <div className="font-semibold mb-2">Indexed PNG</div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="text-zinc-400">Scale</div>
                <input className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1" type="number" min={1} max={16} step={1} value={idxScale} onChange={(e)=> setIdxScale(Math.max(1, Math.min(16, Number(e.target.value)||1)))} />
                <div className="text-zinc-400">Transparent Index</div>
                <select className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1" value={transparentIndex} onChange={(e)=> setTransparentIndex(e.target.value)}>
                  <option value="none">None</option>
                  {palette.map((_,i)=> <option key={i} value={String(i)}>{i}</option>)}
                </select>
              </div>
              <div className="mt-3">
                <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" disabled={!imageBitmap} onClick={async ()=>{
                  if(!imageBitmap) return; const imageCrop = canvasCropToImageCrop(); await exportIndexedPNGViaCPU(imageBitmap, palette, grade, { ...cpuOpts, scale: idxScale, transparentIndex: transparentIndex==='none'? undefined : Number(transparentIndex) }, 'dither-indexed.png', imageCrop || undefined);
                }}>Export Indexed PNG</button>
              </div>
            </section>
            <section className="border border-zinc-800 rounded p-3">
              <div className="font-semibold mb-2">Indexed TIFF</div>
              <div className="text-zinc-400 text-sm mb-2">Baseline paletted TIFF (Photometric=Palette). Transparency is not widely supported in paletted TIFF and is omitted.</div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="text-zinc-400">Scale</div>
                <input className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1" type="number" min={1} max={16} step={1} value={tiffScale} onChange={(e)=> setTiffScale(Math.max(1, Math.min(16, Number(e.target.value)||1)))} />
              </div>
              <div className="mt-3">
                <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" disabled={!imageBitmap} onClick={async ()=>{
                  if(!imageBitmap) return; const imageCrop = canvasCropToImageCrop(); await exportIndexedTIFFViaCPU(imageBitmap, palette, grade, { ...cpuOpts, scale: tiffScale }, 'dither-indexed.tiff', imageCrop || undefined);
                }}>Export Indexed TIFF</button>
              </div>
            </section>
            <section className="border border-zinc-800 rounded p-3">
              <div className="font-semibold mb-2">Swatch Masks</div>
              <div className="text-zinc-400 mb-2">Exports one 1‑bit mask per palette color + manifest.json inside a ZIP.</div>
              <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" disabled={!imageBitmap} onClick={async ()=>{
                if(!imageBitmap) return; const imageCrop = canvasCropToImageCrop(); await exportSwatchMasksZip(imageBitmap, palette, grade, cpuOpts, imageCrop || undefined);
              }}>Export Masks ZIP</button>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
  function canvasCropToImageCrop(){
    if(!canvasRef.current || !imageBitmap || !cropRect) return null;
    const c = canvasRef.current;
    const css = c.getBoundingClientRect();
    const cw = css.width || 1, ch = css.height || 1;
    const x0_tl = cropRect.x / cw; const y0_tl = cropRect.y / ch;
    const x1_tl = (cropRect.x + cropRect.w) / cw; const y1_tl = (cropRect.y + cropRect.h) / ch;
    // Convert TL to BL for view mapping
    const uv0 = { x: x0_tl, y: 1 - y0_tl };
    const uv1 = { x: x1_tl, y: 1 - y1_tl };
    const s = Math.max(0.001, view?.scale ?? 1); const off = view?.offset ?? { x: 0, y: 0 };
    const applyView = (u:{x:number;y:number})=> ({ x: (u.x - 0.5)/s + 0.5 + off.x, y: (u.y - 0.5)/s + 0.5 + off.y });
    const img0_bl = applyView(uv0); const img1_bl = applyView(uv1);
    // Convert back to TL
    const img0 = { x: img0_bl.x, y: 1 - img0_bl.y }; const img1 = { x: img1_bl.x, y: 1 - img1_bl.y };
    // Clamp
    const clamp01 = (v:number)=> Math.max(0, Math.min(1, v));
    const ix0 = clamp01(img0.x), iy0 = clamp01(img0.y);
    const ix1 = clamp01(img1.x), iy1 = clamp01(img1.y);
    const sx = Math.floor(Math.min(ix0, ix1) * imageBitmap.width);
    const sy = Math.floor(Math.min(iy0, iy1) * imageBitmap.height);
    const ex = Math.ceil(Math.max(ix0, ix1) * imageBitmap.width);
    const ey = Math.ceil(Math.max(iy0, iy1) * imageBitmap.height);
    const w = Math.max(1, ex - sx); const h = Math.max(1, ey - sy);
    return { x: sx, y: sy, w, h };
  }
