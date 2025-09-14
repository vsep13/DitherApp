import React, { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { runFS } from '@/workers/fsClient';
import { encodeIndexedPNGFromImage } from '@/utils/indexed';
import { downloadZip } from '@/utils/zip';

async function imageDataToPNGBlob(image: ImageData): Promise<Blob> {
  // Use HTMLCanvas (works in browsers consistently)
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(image, 0, 0);
  const blob: Blob | null = await new Promise((resolve)=> canvas.toBlob((b)=> resolve(b), 'image/png'));
  if(!blob) throw new Error('toBlob failed');
  return blob;
}

export default function BatchExport({ open, onClose }: { open: boolean; onClose: () => void }){
  const state = useStore();
  const [files, setFiles] = useState<File[]>([]);
  const [useIndexed, setUseIndexed] = useState(true);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const disabled = progress !== null;

  async function start(){
    if(files.length === 0){ alert('Select image files first'); return; }
    setCancelled(false);
    setProgress({ current: 0, total: files.length });
    const entries: { name: string; data: Uint8Array }[] = [];
    for(let i=0;i<files.length;i++){
      if(cancelled) break;
      const f = files[i];
      const bmp = await createImageBitmap(await (await fetch(URL.createObjectURL(f))).blob());
      const img = await runFS({
        imageBitmap: bmp,
        palette: state.palette,
        serpentine: state.serpentine,
        diffusionStrength: state.diffusionStrength,
        thresholdBias: state.thresholdBias,
        pixelate: state.pixelate,
        grade: { exposure: state.exposure, contrast: state.contrast, gamma: state.gamma, saturation: state.saturation },
        kernel: state.cpuKernel,
      });
      let blob: Blob;
      if(useIndexed){
        blob = encodeIndexedPNGFromImage(img, state.palette);
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
      downloadZip(entries, 'batch-output.zip');
    }
    setProgress(null);
    onClose();
  }

  if(!open) return null;
  return (
    <div className="modal">
      <div className="modal-content">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <strong>Batch Export</strong>
          <div style={{ flex:1 }} />
          <button className="button" onClick={onClose} disabled={disabled}>Close</button>
        </div>
        <div className="row">
          <div className="label">Files</div>
          <input className="input" type="file" multiple accept="image/*" onChange={(e)=> setFiles(Array.from(e.target.files||[]))} disabled={disabled} />
        </div>
        <div className="row">
          <div className="label">Indexed PNG</div>
          <input type="checkbox" checked={useIndexed} onChange={(e)=> setUseIndexed(e.target.checked)} disabled={disabled} />
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button className="button" onClick={start} disabled={disabled}>Start</button>
          <button className="button" onClick={()=> setCancelled(true)} disabled={!disabled}>Cancel</button>
          {progress && <div style={{ color:'var(--muted)' }}>Processed {progress.current}/{progress.total}</div>}
        </div>
      </div>
    </div>
  );
}

