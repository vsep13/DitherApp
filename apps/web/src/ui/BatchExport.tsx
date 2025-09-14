import React, { useState } from 'react';
import { EDClient } from '../lib/edClient';
import { encodeIndexedPNGFromImage } from '@core/indexed';
import { makeZip, downloadZip } from '../lib/zip';

async function imageDataToPNGBlob(image: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(image, 0, 0);
  const blob: Blob | null = await new Promise((resolve)=> canvas.toBlob((b)=> resolve(b), 'image/png'));
  if(!blob) throw new Error('toBlob failed');
  return blob;
}

export function BatchExport({ open, onClose, palette, grade, cpuOpts }: {
  open: boolean;
  onClose: () => void;
  palette: string[];
  grade: { exposure: number; contrast: number; gamma: number; saturation: number };
  cpuOpts: { serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number; kernelName: string };
}){
  const [files, setFiles] = useState<File[]>([]);
  const [useIndexed, setUseIndexed] = useState(true);
  const [scale, setScale] = useState<number>(1);
  const [transparentIndex, setTransparentIndex] = useState<string>('none');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const disabled = progress !== null;

  async function start(){
    if(files.length === 0){ alert('Select image files first'); return; }
    setCancelled(false);
    setProgress({ current: 0, total: files.length });
    const entries: { name: string; data: Uint8Array }[] = [];
    const client = new EDClient();
    try {
      for(let i=0;i<files.length;i++){
        if(cancelled) break;
        const f = files[i];
        const bmp = await createImageBitmap(await f.arrayBuffer().then(buf=> new Blob([buf])));
        const w=bmp.width, h=bmp.height;
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
        tctx.drawImage(bmp, 0, 0);
        const src = tctx.getImageData(0, 0, w, h);
        const out = await client.runED({ width: w, height: h, data: src.data, palette, serpentine: cpuOpts.serpentine, diffusionStrength: cpuOpts.diffusionStrength, thresholdBias: cpuOpts.thresholdBias, pixelate: cpuOpts.pixelate, kernelName: cpuOpts.kernelName, grade });
        // Scale if requested
        let img = out;
        const s = Math.max(1, Math.floor(scale||1));
        if(s !== 1){
          const sc = document.createElement('canvas'); sc.width = out.width*s; sc.height = out.height*s; const sctx = sc.getContext('2d')!; sctx.imageSmoothingEnabled = false;
          const tmp2 = document.createElement('canvas'); tmp2.width = out.width; tmp2.height = out.height; tmp2.getContext('2d')!.putImageData(out, 0, 0);
          sctx.drawImage(tmp2, 0, 0, sc.width, sc.height);
          img = sctx.getImageData(0, 0, sc.width, sc.height);
        }
        let blob: Blob;
        if(useIndexed){
          if(transparentIndex !== 'none'){
            // Reuse encoder with transparent index via core/png8
            const { rgb, alpha } = await import('@core/indexed').then(m=> m.paletteToRGBAndAlpha(palette));
            alpha[Number(transparentIndex)] = 0;
            const { encodePNG8 } = await import('@core/png8');
            const indices = await import('@core/indexed').then(m=> m.indicesFromImage(img, palette));
            const data = encodePNG8(img.width, img.height, indices, rgb, alpha, true);
            blob = new Blob([data], { type: 'image/png' });
          } else {
            blob = encodeIndexedPNGFromImage(img, palette);
          }
        } else {
          blob = await imageDataToPNGBlob(img);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const base = f.name.replace(/\.[^.]+$/, '');
        const name = `${String(i+1).padStart(4,'0')}_${base}${useIndexed?'-idx':''}.png`;
        entries.push({ name, data: bytes });
        setProgress({ current: i+1, total: files.length });
      }
      if(entries.length>0 && !cancelled){
        const zip = makeZip(entries);
        downloadZip(zip, 'batch-output.zip');
      }
    } finally {
      client.dispose();
      setProgress(null);
      onClose();
    }
  }

  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl p-4 w-[min(720px,95vw)] max-h-[85vh] overflow-auto">
        <div className="flex items-center gap-2 mb-3">
          <strong>Batch Export</strong>
          <div className="grow" />
          <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={onClose} disabled={disabled}>Close</button>
        </div>
        <div className="grid gap-3">
          <div>
            <div className="text-zinc-400 mb-1">Files</div>
            <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full" type="file" multiple accept="image/*" onChange={(e)=> setFiles(Array.from(e.target.files||[]))} disabled={disabled} />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={useIndexed} onChange={(e)=> setUseIndexed(e.target.checked)} disabled={disabled} /> Indexed PNG</label>
            <div className="flex items-center gap-2"><span className="text-zinc-400">Scale</span><input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-20" type="number" min={1} max={16} value={scale} onChange={(e)=> setScale(Number(e.target.value)||1)} disabled={disabled} /></div>
            <div className="flex items-center gap-2"><span className="text-zinc-400">Transparent Index</span>
              <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1" value={transparentIndex} onChange={(e)=> setTransparentIndex(e.target.value)} disabled={!useIndexed || disabled}>
                <option value="none">None</option>
                {palette.map((_,i)=> <option key={i} value={String(i)}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50" onClick={start} disabled={disabled}>Start</button>
            <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" onClick={()=> setCancelled(true)} disabled={!disabled}>Cancel</button>
            {progress && <div className="text-zinc-400">Processed {progress.current}/{progress.total}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

