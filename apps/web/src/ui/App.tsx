import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Slider from '@radix-ui/react-slider';
import * as Select from '@radix-ui/react-select';
import * as Switch from '@radix-ui/react-switch';
import { parseHexList } from '@core/palette';
import { patternPresets, findPattern } from '@core/patterns';
import { EDClient } from '../lib/edClient';
import { GLRenderer } from '@gpu/renderer';
import { samplePaletteFromImageBitmap } from '../lib/palette';
import { resolveLospecInput } from '../lib/lospec';
import { loadOfflinePalettes, type OfflinePalettes } from '../lib/offlinePalettes';
import { PaletteBrowser } from './PaletteBrowser';
import { PalettePanel } from './PalettePanel';
import { Subheading } from './Subheading';
import { useToast } from './ToastProvider';
import { ExportDialog } from './ExportDialog';
import { IconButton } from './IconButton';
import { ExportIcon, BatchIcon, StarIcon, SearchIcon } from './icons';
import { PresetManager } from './PresetManager';
import { parsePreset } from '../lib/preset';
import { BatchExport } from './BatchExport';
import { PatternBrowser } from './PatternBrowser';
// Video batch temporarily removed due to decoding issues

export default function App(){
  const { push } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<EDClient | null>(null);
  const glRef = useRef<GLRenderer | null>(null);
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [palette, setPalette] = useState<string[]>(['#000000', '#ffffff']);
  const [paletteLocks, setPaletteLocks] = useState<boolean[]>([false, false]);
  const [mode, setMode] = useState<'indexed'|'rgb'|'grayscale'>('indexed');
  const [previewMode, setPreviewMode] = useState<'gpu'|'cpu'>('gpu');
  const [serpentine, setSerpentine] = useState(true);
  const [diffusionStrength, setDiffusionStrength] = useState(1);
  const [thresholdBias, setThresholdBias] = useState(0);
  const [pixelate, setPixelate] = useState(1);
  const [kernel, setKernel] = useState('floyd-steinberg');
  const [algorithm, setAlgorithm] = useState<'bayer2'|'bayer4'|'bayer8'|'pattern'>('bayer8');
  const [patternId, setPatternId] = useState<string>('bayer8');
  const [patternScale, setPatternScale] = useState<number>(1);
  const [patternAngle, setPatternAngle] = useState<number>(0);
  const [grade, setGrade] = useState({ exposure: 1, contrast: 1, gamma: 1, saturation: 1 });
  // A/B compare
  const [abCompare, setAbCompare] = useState(false);
  const [abSplit, setAbSplit] = useState(0.5);
  const [abVertical, setAbVertical] = useState(true);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState<OfflinePalettes | null>(null);
  const [offlineQuery, setOfflineQuery] = useState('');
  const [showPaletteBrowser, setShowPaletteBrowser] = useState(false);
  const [showPatternBrowser, setShowPatternBrowser] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cpuDirty, setCpuDirty] = useState(false);
  const [cpuRenderTick, setCpuRenderTick] = useState(0);
  const lastCpuKeyRef = useRef<string>('');
  const cpuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cpuImageRef = useRef<ImageData | null>(null);
  const [cpuAuto, setCpuAuto] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showBatchExport, setShowBatchExport] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  // const [showBatchVideo, setShowBatchVideo] = useState(false);
  const importPresetInputRef = useRef<HTMLInputElement | null>(null);

  function download(filename: string, data: Blob){ const url=URL.createObjectURL(data); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000); }
  const AUTOSAVE_KEY = 'dp2_autosave_v1';

  function buildPreset(){
    return {
      version: 1,
      palette,
      paletteLocks,
      grade,
      view: { mode },
      preview: { algorithm, patternId, patternScale, patternAngle, thresholdBias, pixelate, abCompare, abSplit, abVertical },
      exportCPU: { kernel, serpentine, diffusionStrength, thresholdBias, pixelate }
    };
  }

  function applyPreset(json: any){
    const p = parsePreset(json);
    if(!p) return false;
    try {
      if(Array.isArray(p.palette)) setPalette(p.palette.slice(0,256));
      if(Array.isArray(p.paletteLocks)) setPaletteLocks(p.paletteLocks.map(Boolean).slice(0, Math.min(256, (p.palette||[]).length||256)));
      if(p.grade && typeof p.grade==='object') setGrade((g)=>({
        exposure: p.grade?.exposure ?? g.exposure,
        contrast: p.grade?.contrast ?? g.contrast,
        gamma: p.grade?.gamma ?? g.gamma,
        saturation: p.grade?.saturation ?? g.saturation,
      }));
      if(p.view && p.view.mode) setMode(p.view.mode);
      if(p.preview && typeof p.preview==='object'){
        if(p.preview.algorithm) setAlgorithm(p.preview.algorithm);
        if(typeof p.preview.patternId==='string') setPatternId(p.preview.patternId);
        if(p.preview.patternScale!==undefined) setPatternScale(p.preview.patternScale);
        if(p.preview.patternAngle!==undefined) setPatternAngle(p.preview.patternAngle);
        if(p.preview.thresholdBias!==undefined) setThresholdBias(p.preview.thresholdBias);
        if(p.preview.pixelate!==undefined) setPixelate(p.preview.pixelate|0);
        if(p.preview.abCompare!==undefined) setAbCompare(!!p.preview.abCompare);
        if(p.preview.abSplit!==undefined) setAbSplit(Math.max(0, Math.min(1, p.preview.abSplit)));
        if(p.preview.abVertical!==undefined) setAbVertical(!!p.preview.abVertical);
      }
      if(p.exportCPU && typeof p.exportCPU==='object'){
        if(typeof p.exportCPU.kernel==='string') setKernel(p.exportCPU.kernel);
        if(typeof p.exportCPU.serpentine==='boolean') setSerpentine(!!p.exportCPU.serpentine);
        if(p.exportCPU.diffusionStrength!==undefined) setDiffusionStrength(p.exportCPU.diffusionStrength);
        if(p.exportCPU.thresholdBias!==undefined) setThresholdBias(p.exportCPU.thresholdBias);
        if(p.exportCPU.pixelate!==undefined) setPixelate(p.exportCPU.pixelate|0);
      }
      return true;
    } catch(err){ console.error(err); return false; }
  }
  function savePreset(){
    const preset = buildPreset();
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    download('preset.json', blob);
    push('Saved preset JSON', 'success');
  }
  async function loadPresetFromFile(file: File){
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if(!applyPreset(json)) throw new Error('Invalid preset');
      push('Loaded preset', 'success');
    } catch(err){ console.error(err); push('Failed to load preset', 'error'); }
  }

  // Autosave: restore on mount
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if(raw){ const json = JSON.parse(raw); if(applyPreset(json)) push('Restored previous session', 'success'); }
    } catch(err){ console.warn('Autosave restore failed', err); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave: persist on changes (debounced)
  useEffect(()=>{
    const id = setTimeout(()=>{
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildPreset())); } catch {}
    }, 300);
    return ()=> clearTimeout(id);
  }, [palette, paletteLocks, grade, mode, algorithm, patternId, patternScale, patternAngle, thresholdBias, pixelate, kernel, serpentine, diffusionStrength, abCompare, abSplit, abVertical]);
  useEffect(()=>{ clientRef.current = new EDClient(); return ()=> clientRef.current?.dispose(); }, []);
  // Init GL renderer
  useEffect(()=>{
    if(!canvasRef.current) return; const glr = new GLRenderer(canvasRef.current); glRef.current = glr;
    // Push current state immediately so first image shows without further interaction
    if(imageBitmap) glr.setSource(imageBitmap);
    glr.setPalette(palette);
    glr.setParams({ pixelate, thresholdBias, algorithm, patternScale: 1, patternAngle: 0, mode: 'indexed' });
    return ()=> glr.dispose();
  }, []);

  // Load offline palettes JSON
  useEffect(()=>{ (async ()=>{ const data = await loadOfflinePalettes(); setOffline(data); })(); }, []);

  // DPR + container resize (letterbox to image aspect)
  useEffect(()=>{
    const container = containerRef.current, canvas = canvasRef.current; if(!container||!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1; const cw = container.clientWidth||1; const ch = container.clientHeight||1;
      let dispW = cw, dispH = ch;
      const bmp = imageBitmap; if(bmp && bmp.width>0 && bmp.height>0){
        const ratio = bmp.width / bmp.height; const contRatio = cw / ch;
        if(contRatio > ratio){ dispH = ch; dispW = Math.round(ch * ratio); } else { dispW = cw; dispH = Math.round(cw / ratio); }
      }
      canvas.style.width = dispW+'px'; canvas.style.height = dispH+'px';
      const pw = Math.max(1, Math.round(dispW*dpr)); const ph = Math.max(1, Math.round(dispH*dpr));
      if(canvas.width!==pw||canvas.height!==ph){ canvas.width=pw; canvas.height=ph; glRef.current?.requestFrame(); }
      // CPU canvas mirrors GL sizing
      const cc = cpuCanvasRef.current;
      if(cc){
        cc.style.width = dispW+'px'; cc.style.height = dispH+'px';
        if(cc.width!==pw || cc.height!==ph){ cc.width = pw; cc.height = ph; }
        // Redraw last CPU image if present
        const img = cpuImageRef.current;
        if(img){ const ctx = cc.getContext('2d')!; ctx.imageSmoothingEnabled = false;
          // Draw scaled to canvas
          const off = document.createElement('canvas'); off.width = img.width; off.height = img.height; off.getContext('2d')!.putImageData(img, 0, 0);
          ctx.clearRect(0,0,cc.width,cc.height);
          ctx.drawImage(off, 0, 0, cc.width, cc.height);
        }
      }
    };
    const ro = new ResizeObserver(resize); ro.observe(container); resize(); return ()=> ro.disconnect();
  }, [imageBitmap]);

  // Push state to GPU renderer whenever inputs change (GPU mode)
  useEffect(()=>{
    const glr = glRef.current; if(!glr || previewMode!=='gpu') return;
    if(imageBitmap) glr.setSource(imageBitmap);
    glr.setPalette(palette);
    // If algorithm is pattern, ensure a pattern texture is uploaded
    if(algorithm === 'pattern'){
      const p = findPattern(patternId) || patternPresets[0];
      if(p) glr.setPattern(p.size, p.data);
    }
    glr.setParams({ pixelate, thresholdBias, algorithm, patternScale, patternAngle, mode, applyGrade: true, passthrough: false, abCompare, abSplit, abVertical });
    glr.setGrade(grade);
  }, [previewMode, mode, imageBitmap, palette, pixelate, thresholdBias, algorithm, patternId, patternScale, patternAngle, grade, abCompare, abSplit, abVertical]);

  // Pattern thumbnails (for Select items)
  const thumbCache = useRef<Map<string, string>>(new Map());
  function typeOfPattern(id: string){
    const key = id.toLowerCase();
    if(key.startsWith('bayer')) return 'Bayer';
    if(key.startsWith('cdot')) return 'Clustered Dot';
    if(key.startsWith('lines')) return 'Lines';
    if(key.startsWith('radial')) return 'Radial';
    if(key.startsWith('diamond')) return 'Diamond';
    if(key.startsWith('square')) return 'Square';
    if(key.startsWith('spiral')) return 'Spiral';
    if(key.startsWith('sine')) return 'Sine';
    if(key.startsWith('checker')) return 'Checker';
    if(key.startsWith('grid')) return 'Grid';
    return 'Other';
  }
  function makePatternThumb(id: string){
    const cached = thumbCache.current.get(id); if(cached) return cached;
    const p = findPattern(id); if(!p) return '';
    const W=96, H=32; const n=p.size; const data=p.data;
    const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d')!;
    const img = ctx.createImageData(W,H);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const tx=((x % n)+n)%n, ty=((y % n)+n)%n; const v=data[ty*n+tx]||0; const g=Math.round(v*255); const i=(y*W+x)*4; img.data[i]=g; img.data[i+1]=g; img.data[i+2]=g; img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    const url=c.toDataURL('image/png'); thumbCache.current.set(id,url); return url;
  }
  const RECENT_KEY = 'dp2_recent_patterns';
  function loadRecent(): string[]{ try { const raw=localStorage.getItem(RECENT_KEY); const arr=raw?JSON.parse(raw):[]; return Array.isArray(arr)?arr.filter((s:string)=>typeof s==='string'):[]; } catch { return []; } }
  function pushRecent(id: string){ try{ const cur=loadRecent().filter((x)=>x!==id); cur.unshift(id); while(cur.length>6) cur.pop(); localStorage.setItem(RECENT_KEY, JSON.stringify(cur)); } catch {}
  }

  // Compute a key of CPU preview inputs to decide staleness
  function cpuParamsKey(){
    return JSON.stringify({
      src: imageBitmap ? [imageBitmap.width, imageBitmap.height] : null,
      palette,
      serpentine,
      diffusionStrength,
      thresholdBias,
      pixelate,
      kernel,
      grade,
    });
  }

  // Mark CPU preview dirty only when inputs differ from last render
  useEffect(()=>{
    if(previewMode!=='cpu') return;
    const key = cpuParamsKey();
    if(key !== lastCpuKeyRef.current){ setCpuDirty(true); }
  }, [previewMode, imageBitmap, palette, serpentine, diffusionStrength, thresholdBias, pixelate, kernel, grade]);

  // CPU preview: render ED via worker on demand (tick)
  useEffect(()=>{
    if(previewMode!=='cpu') return;
    let cancelled = false;
    const run = async () => {
      if(!imageBitmap){ return; }
      const glr = glRef.current; const client = clientRef.current;
      if(!client){ return; }
      setBusy(true);
      try{
        const w=imageBitmap.width, h=imageBitmap.height;
        const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h; const tctx=tmp.getContext('2d',{willReadFrequently:true})!; tctx.drawImage(imageBitmap,0,0);
        const src=tctx.getImageData(0,0,w,h);
        const out = await client.runED({ width:w, height:h, data: src.data, palette, serpentine, diffusionStrength, thresholdBias, pixelate, kernelName: kernel, grade });
        if(cancelled) return;
        // Draw to CPU canvas (dedicated) without GL passthrough
        cpuImageRef.current = out;
        const cc = cpuCanvasRef.current; if(cc){ const ctx = cc.getContext('2d')!; ctx.imageSmoothingEnabled = false;
          // Ensure canvas sized by resize effect; then draw scaled
          const off = document.createElement('canvas'); off.width = out.width; off.height = out.height; off.getContext('2d')!.putImageData(out, 0, 0);
          ctx.clearRect(0,0,cc.width,cc.height);
          ctx.drawImage(off, 0, 0, cc.width, cc.height);
        }
        setCpuDirty(false);
        lastCpuKeyRef.current = cpuParamsKey();
        push('CPU preview updated', 'success');
      } catch(err){ console.error(err); push('CPU preview failed', 'error'); }
      finally { if(!cancelled) setBusy(false); }
    };
    run();
    return ()=>{ cancelled = true; };
  }, [previewMode, cpuRenderTick]);

  // Auto-render CPU preview when dirty and enabled
  useEffect(()=>{
    if(previewMode!=='cpu' || !cpuAuto) return;
    if(cpuDirty && !busy && imageBitmap){ renderCpuPreview(); }
  }, [previewMode, cpuAuto, cpuDirty, busy, imageBitmap]);

  function renderCpuPreview(){ setCpuRenderTick((x)=>x+1); }
  // Keyboard shortcuts: Export (e), Batch (b), Presets (p), GPU (g), CPU (c), Toggle mode (m), Toggle A/B (a), CPU render (r), adjust split (arrows)
  useEffect(()=>{
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if(tag && /INPUT|TEXTAREA|SELECT/.test(tag)) return;
      const delta = e.shiftKey ? 0.01 : 0.05;
      if(e.key === 'e'){ setShowExport(true); e.preventDefault(); return; }
      if(e.key === 'b'){ setShowBatchExport(true); e.preventDefault(); return; }
      if(e.key === 'p'){ setShowPresets(true); e.preventDefault(); return; }
      if(e.key === 'g'){ setPreviewMode('gpu'); e.preventDefault(); return; }
      if(e.key === 'c'){ setPreviewMode('cpu'); e.preventDefault(); return; }
      if(e.key === 'm'){ setPreviewMode(previewMode==='gpu'?'cpu':'gpu'); e.preventDefault(); return; }
      if(e.key === 'a' && previewMode==='gpu'){ setAbCompare(v=>!v); e.preventDefault(); return; }
      if(e.key === 'r' && previewMode==='cpu'){
        if(imageBitmap && !busy){ renderCpuPreview(); push('Rendering CPU preview…'); }
        e.preventDefault(); return;
      }
      if(previewMode==='gpu' && abCompare){
        if(abVertical){
          if(e.key === 'ArrowLeft'){ const t = Math.max(0, Math.min(1, abSplit - delta)); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
          if(e.key === 'ArrowRight'){ const t = Math.max(0, Math.min(1, abSplit + delta)); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
        } else {
          if(e.key === 'ArrowUp'){ const t = Math.max(0, Math.min(1, abSplit - delta)); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
          if(e.key === 'ArrowDown'){ const t = Math.max(0, Math.min(1, abSplit + delta)); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return ()=> window.removeEventListener('keydown', onKeyDown);
  }, [previewMode, abCompare, abVertical, abSplit, imageBitmap, busy]);
  // Handle A/B drag
  useEffect(()=>{
    if(!draggingSplit) return;
    const onMove = (e: MouseEvent)=>{
      const el = containerRef.current; if(!el) return; const rect = el.getBoundingClientRect();
      let t = 0.5;
      if(abVertical){ t = (e.clientX - rect.left) / Math.max(1, rect.width); }
      else { t = (e.clientY - rect.top) / Math.max(1, rect.height); }
      t = Math.max(0, Math.min(1, t));
      setAbSplit(t); glRef.current?.setParams({ abSplit: t });
    };
    const onUp = ()=> setDraggingSplit(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp as any); };
  }, [draggingSplit, abVertical]);
  return (
    <Tooltip.Provider delayDuration={300}>
    <div className="h-screen w-screen grid grid-cols-[300px_1fr_360px] grid-rows-[auto_1fr]" style={{ gridTemplateAreas: `'hdr hdr hdr' 'left center right'` }}>
      <header className="col-span-3 border-b border-zinc-800 bg-zinc-950 text-zinc-100 sticky top-0 z-20" style={{ gridArea:'hdr' }}>
        <div className="px-4 py-2 flex items-center gap-3">
          <b>Dither Pro</b><span className="text-zinc-400">Rewrite</span>
          <div className="grow" />
          <IconButton label="Export" variant="primary" onClick={()=> setShowExport(true)}>
            <ExportIcon />
          </IconButton>
          <IconButton label="Batch Export" onClick={()=> setShowBatchExport(true)}>
            <BatchIcon />
          </IconButton>
          <IconButton label="Presets" onClick={()=> setShowPresets(true)}>
            <StarIcon />
          </IconButton>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
            if(!imageBitmap){ alert('Load an image first'); return; }
            const n = Number(prompt('Sample how many colors? (1-64)', '16')||'16')|0;
            const count = Math.max(1, Math.min(64, n));
            const sampled = await samplePaletteFromImageBitmap(imageBitmap, count);
            const cur = palette.slice(); const locks = paletteLocks.slice();
            const targetLen = Math.max(count, cur.length);
            const next: string[] = []; const nextLocks: boolean[] = [];
            let si = 0;
            for(let i=0;i<targetLen;i++){
              if(i<cur.length && locks[i]){ next[i] = cur[i]; nextLocks[i] = true; }
              else { next[i] = sampled[si++] || '#000000'; nextLocks[i] = false; }
            }
            setPalette(next); setPaletteLocks(nextLocks); push(`Sampled ${count} colors from image`, 'success');
          }}>Sample Palette</button>
          <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
            const src = prompt('Paste Lospec slug (e.g., "nyx8") or JSON'); if(!src) return;
            try {
              const { colors, name } = await resolveLospecInput(src);
              if(colors && colors.length){ setPalette(colors.slice(0,256)); setPaletteLocks(Array(Math.min(256, colors.length)).fill(false)); push(`Imported palette${name?`: ${name}`:''}`, 'success'); }
              else alert('No colors found in palette');
            } catch(err){ console.error(err); push('Failed to load palette from Lospec API','error'); }
          }}>Import Lospec</button>
          <IconButton label="Browse Palettes" onClick={()=> setShowPaletteBrowser(true)}>
            <SearchIcon />
          </IconButton>
        </div>
        {showPaletteBrowser && (
          <PaletteBrowser
            open={showPaletteBrowser}
            offline={offline}
            onClose={()=> setShowPaletteBrowser(false)}
            onApply={(colors)=>{ setPalette(colors.slice(0,256)); setPaletteLocks(Array(Math.min(256, colors.length)).fill(false)); }}
          />
        )}
        
      </header>
      {showExport && (
        <ExportDialog
          open={showExport}
          onClose={()=> setShowExport(false)}
          canvasRef={canvasRef}
          imageBitmap={imageBitmap}
          palette={palette}
          grade={grade}
          cpuOpts={{ serpentine, diffusionStrength, thresholdBias, pixelate, kernelName: kernel }}
        />
      )}
      {showBatchExport && (
        <BatchExport
          open={showBatchExport}
          onClose={()=> setShowBatchExport(false)}
          palette={palette}
          grade={grade}
          cpuOpts={{ serpentine, diffusionStrength, thresholdBias, pixelate, kernelName: kernel }}
        />
      )}
      {showPresets && (
        <PresetManager
          open={showPresets}
          onClose={()=> setShowPresets(false)}
          onApply={(p)=>{ applyPreset(p); setShowPresets(false); push('Preset applied', 'success'); }}
          getCurrent={()=> buildPreset() as any}
        />
      )}
      {showPatternBrowser && (
        <PatternBrowser
          open={showPatternBrowser}
          onClose={()=> setShowPatternBrowser(false)}
          onApply={(id)=>{ setPatternId(id); const p = findPattern(id); if(p) glRef.current?.setPattern(p.size, p.data); }}
        />
      )}
      {/* Video batch dialog removed for now */}
      <aside className="border-r border-zinc-800 p-3" style={{ gridArea:'left' }}>
        <Accordion.Root type="multiple" defaultValue={["src"]} className="space-y-2">
          <Accordion.Item value="src" className="border border-zinc-800 rounded">
            <Accordion.Trigger className="w-full text-left px-3 py-2 bg-zinc-900 text-zinc-200 text-sm font-semibold">Source & Preview</Accordion.Trigger>
            <Accordion.Content className="p-3 space-y-2">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Import Image</label>
                <input type="file" accept="image/*" onChange={async (e)=>{
                  const f = e.target.files?.[0]; if(!f) return; const bmp = await createImageBitmap(f);
                  setImageBitmap(bmp); push('Image loaded','success');
                }} />
              </div>
              <div>
                <div className="text-sm text-zinc-400 mb-1 flex items-center gap-1"><span>Preview</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">GPU is instant (ordered). CPU renders exact error diffusion.</Tooltip.Content></Tooltip.Root></div>
                <div className="inline-flex rounded border border-zinc-800 overflow-hidden">
                  <button className={`px-3 py-1 ${previewMode==='gpu'?'bg-zinc-700 text-white':'bg-zinc-900 text-zinc-300'}`} onClick={()=> setPreviewMode('gpu')}>GPU</button>
                  <button className={`px-3 py-1 border-l border-zinc-800 ${previewMode==='cpu'?'bg-zinc-700 text-white':'bg-zinc-900 text-zinc-300'}`} onClick={()=> setPreviewMode('cpu')}>CPU</button>
                </div>
                {previewMode==='gpu' && (
                  <>
                <div className="mt-2 flex items-center gap-2">
                      <span id="lbl-ab-compare" className="text-zinc-400">A/B Compare</span>
                      <Switch.Root aria-labelledby="lbl-ab-compare" className="w-10 h-6 bg-zinc-800 rounded px-0.5 data-[state=checked]:bg-sky-400" checked={abCompare} onCheckedChange={(v)=> setAbCompare(!!v)}>
                        <Switch.Thumb className="block w-5 h-5 bg-white rounded translate-x-0.5 data-[state=checked]:translate-x-4 transition-transform" />
                      </Switch.Root>
                    </div>
                    {abCompare && (
                      <div className="mt-2">
                        <div className="text-zinc-400 mb-1 flex items-center gap-2">
                          <span>Split</span>
                          <span className="text-zinc-500 text-xs">({abVertical?'Vertical':'Horizontal'})</span>
                          <button className="px-2 py-0.5 text-xs rounded bg-zinc-800 border border-zinc-700" onClick={()=>{ const v=!abVertical; setAbVertical(v); glRef.current?.setParams({ abVertical: v }); }}>Toggle</button>
                        </div>
                        <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[abSplit]} max={1} min={0} step={0.01} onValueChange={(v)=>{ const val=v[0]??0.5; setAbSplit(val); glRef.current?.setParams({ abSplit: val }); }}>
                          <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                          <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="A/B Split" />
                        </Slider.Root>
                      </div>
                    )}
                  </>
                )}
                {previewMode==='cpu' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" disabled={!imageBitmap || busy} onClick={()=>{ renderCpuPreview(); push('Rendering CPU preview…'); }}>Render CPU Preview</button>
                      <label className="flex items-center gap-2 text-zinc-400 text-sm">
                        <input type="checkbox" checked={cpuAuto} onChange={(e)=> setCpuAuto(e.target.checked)} /> Auto
                      </label>
                      {busy && <span className="text-xs text-sky-400">Rendering…</span>}
                      {cpuDirty && <span className="text-xs text-amber-400">Preview out of date</span>}
                    </div>
                    {!imageBitmap && <div className="text-xs text-zinc-500">Load an image to enable CPU preview.</div>}
                    <div className="sr-only" aria-live="polite">{busy ? 'Rendering CPU preview' : (cpuDirty ? 'CPU preview out of date' : 'CPU preview up to date')}</div>
                  </div>
                )}
              </div>
              <div>
                <div className="text-zinc-400 mb-1 flex items-center gap-1"><span>Mode</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Indexed maps to palette, RGB bypasses palette, Grayscale uses luminance.</Tooltip.Content></Tooltip.Root></div>
                <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full" value={mode} onChange={(e)=> setMode(e.target.value as any)}>
                  <option value="indexed">Indexed</option>
                  <option value="rgb">RGB</option>
                  <option value="grayscale">Grayscale</option>
                </select>
              </div>
              <div>
                <div className="text-zinc-400 mb-1 flex items-center gap-1"><span>Pixelate</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Downsamples before dithering to simulate low-res inputs.</Tooltip.Content></Tooltip.Root></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[pixelate]} max={32} min={1} step={1} onValueChange={(v)=>{ const val=v[0]||1; setPixelate(val); glRef.current?.setParams({ pixelate: val }); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Pixelate" />
                </Slider.Root>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="dither" className="border border-zinc-800 rounded">
            <Accordion.Trigger className="w-full text-left px-3 py-2 bg-zinc-900 text-zinc-200 text-sm font-semibold">Dither (Preview)</Accordion.Trigger>
            <Accordion.Content className="p-3 space-y-2">
              <div>
                <div className="text-sm text-zinc-400 mb-1 flex items-center gap-1"><span>Algorithm</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Choose ordered Bayer or a pattern map for preview.</Tooltip.Content></Tooltip.Root></div>
                <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full" value={algorithm} onChange={(e)=>{ setAlgorithm(e.target.value as any); }}>
                  <option value="bayer2">Bayer 2×2</option>
                  <option value="bayer4">Bayer 4×4</option>
                  <option value="bayer8">Bayer 8×8</option>
                  <option value="pattern">Pattern</option>
                </select>
              </div>
              {algorithm==='pattern' && (
                <>
                  <div>
                    <Subheading>Pattern</Subheading>
                    <div className="flex items-center gap-2">
                      <Select.Root value={patternId} onValueChange={(id)=>{ setPatternId(id); const p=findPattern(id); if(p) glRef.current?.setPattern(p.size, p.data); pushRecent(id); }}>
                        <Select.Trigger aria-label="Pattern" className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full flex items-center justify-between">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="bg-zinc-950 border border-zinc-800 rounded shadow-lg text-zinc-100">
                            <Select.Viewport className="p-1 max-h-[50vh] overflow-auto">
                              {/* Recent group */}
                              {(()=>{ const recent=loadRecent().map(id=> findPattern(id)).filter(Boolean) as any[]; if(recent.length===0) return null; return (
                                <Select.Group>
                                  <Select.Label className="px-2 py-1 text-xs text-zinc-500">Recent</Select.Label>
                                  {recent.map((p)=> (
                                    <Select.Item key={`recent-${p.id}`} value={p.id} className="px-2 py-1 flex items-center gap-2 rounded hover:bg-zinc-800 focus:bg-zinc-800">
                                      <img alt="" src={makePatternThumb(p.id)} className="w-16 h-5 object-cover rounded bg-black" />
                                      <Select.ItemText>{p.name}</Select.ItemText>
                                    </Select.Item>
                                  ))}
                                </Select.Group>
                              ); })()}
                              {['Bayer','Clustered Dot','Lines','Radial','Diamond','Square','Spiral','Sine','Checker','Grid','Other'].map(group=>{
                                const items = patternPresets.filter(p=> typeOfPattern(p.id)===group);
                                if(items.length===0) return null;
                                return (
                                  <Select.Group key={group}>
                                    <Select.Label className="px-2 py-1 text-xs text-zinc-500">{group}</Select.Label>
                                    {items.map((p)=> (
                                      <Select.Item key={p.id} value={p.id} className="px-2 py-1 flex items-center gap-2 rounded hover:bg-zinc-800 focus:bg-zinc-800">
                                        <img alt="" src={makePatternThumb(p.id)} className="w-16 h-5 object-cover rounded bg-black" />
                                        <Select.ItemText>{p.name}</Select.ItemText>
                                      </Select.Item>
                                    ))}
                                  </Select.Group>
                                );
                              })}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                      <IconButton label="Browse Patterns" onClick={()=> setShowPatternBrowser(true)}>
                        <SearchIcon />
                      </IconButton>
                    </div>
                  </div>
                  <div>
                    <Subheading>Pattern Scale</Subheading>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[patternScale]} max={8} min={1} step={1} onValueChange={(v)=>{ const val=v[0]||1; setPatternScale(val); glRef.current?.setParams({ patternScale: val }); }}>
                      <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                      <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Pattern Scale" />
                    </Slider.Root>
                  </div>
                  <div>
                    <Subheading>Pattern Angle</Subheading>
                    <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[patternAngle]} max={3.1416} min={-3.1416} step={0.001} onValueChange={(v)=>{ const val=v[0]??0; setPatternAngle(val); glRef.current?.setParams({ patternAngle: val }); }}>
                      <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                      <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Pattern Angle" />
                    </Slider.Root>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <span id="lbl-serpentine" className="text-sm text-zinc-400">Serpentine</span>
                <Switch.Root aria-labelledby="lbl-serpentine" className="w-10 h-6 bg-zinc-800 rounded px-0.5 data-[state=checked]:bg-sky-400" checked={serpentine} onCheckedChange={(v)=>{ setSerpentine(!!v); }}>
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded translate-x-0.5 data-[state=checked]:translate-x-4 transition-transform" />
                </Switch.Root>
              </div>
              <div>
                <div className="text-sm text-zinc-400 mb-1">Diffusion</div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[diffusionStrength]} max={1} min={0} step={0.01} onValueChange={(v)=>{ setDiffusionStrength(v[0]??1); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Diffusion" />
                </Slider.Root>
              </div>
              <div>
                <div className="text-sm text-zinc-400 mb-1">Threshold Bias</div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[thresholdBias]} max={1} min={-1} step={0.01} onValueChange={(v)=>{ const val=v[0]??0; setThresholdBias(val); glRef.current?.setParams({ thresholdBias: val }); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Threshold Bias" />
                </Slider.Root>
              </div>
              <div>
                <div className="text-sm text-zinc-400 mb-1">CPU Kernel (export/CPU preview)</div>
                <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full" value={kernel} onChange={(e)=>{ setKernel(e.target.value); }}>
                  {['floyd-steinberg','jjn','stucki','atkinson','burkes','sierra-lite','sierra-2-4a','sierra-3','stevenson-arce'].map(k=> <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="palette" className="border border-zinc-800 rounded">
            <Accordion.Trigger className="w-full text-left px-3 py-2 bg-zinc-900 text-zinc-200 text-sm font-semibold">Palette</Accordion.Trigger>
            <Accordion.Content className="p-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
                  if(!imageBitmap){ alert('Load an image first'); return; }
                  const n = Number(prompt('Sample how many colors? (1-64)', '16')||'16')|0;
                  const count = Math.max(1, Math.min(64, n));
                  const sampled = await samplePaletteFromImageBitmap(imageBitmap, count);
                  const cur = palette.slice(); const locks = paletteLocks.slice();
                  const targetLen = Math.max(count, cur.length);
                  const next: string[] = []; const nextLocks: boolean[] = [];
                  let si = 0;
                  for(let i=0;i<targetLen;i++){
                    if(i<cur.length && locks[i]){ next[i] = cur[i]; nextLocks[i] = true; }
                    else { next[i] = sampled[si++] || '#000000'; nextLocks[i] = false; }
                  }
                  setPalette(next); setPaletteLocks(nextLocks);
                }}>Sample Palette</button>
                <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={async ()=>{
                  const src = prompt('Paste Lospec slug (e.g., "nyx8") or JSON'); if(!src) return;
                  try {
                    const { colors } = await resolveLospecInput(src);
                    if(colors && colors.length){ setPalette(colors.slice(0,256)); setPaletteLocks(Array(Math.min(256, colors.length)).fill(false)); }
                    else alert('No colors found in palette');
                  } catch(err){ console.error(err); alert('Failed to load palette from Lospec API.'); }
                }}>Import Lospec</button>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button aria-label="Browse Palettes" className="w-9 h-9 grid place-items-center rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" onClick={()=> setShowPaletteBrowser(true)}>🔎</button>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Browse Palettes</Tooltip.Content>
          </Tooltip.Root>
              </div>
              <div>
                <div className="text-sm text-zinc-400 mb-1">Palette (comma/space/newline)</div>
                <textarea className="bg-zinc-900 border border-zinc-800 rounded w-full h-20 p-2" placeholder="#000,#fff,#ff00ff" onBlur={(e)=>{
                  const hexes = parseHexList(e.target.value); if(hexes.length){ const pal=hexes.slice(0,256); setPalette(pal); setPaletteLocks(Array(pal.length).fill(false)); }
                }} defaultValue={palette.join(',')} />
              </div>
              <PalettePanel palette={palette} locks={paletteLocks} onChange={({ palette: p, locks: l })=>{
                if(p){ setPalette(p); }
                if(l){ const len = (p ? p.length : palette.length); const ll = l.slice(0, len); while(ll.length < len) ll.push(false); setPaletteLocks(ll); }
              }} />
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </aside>
      <main className="bg-black flex items-center justify-center" style={{ gridArea:'center' }}>
        <div ref={containerRef} className={`w-full h-full relative ${isDragging ? 'outline outline-2 outline-sky-500' : ''}`}
          onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; }}
          onDragEnter={(e)=>{ e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e)=>{ e.preventDefault(); setIsDragging(false); }}
          onDrop={async (e)=>{
            e.preventDefault(); setIsDragging(false);
            const f = e.dataTransfer.files?.[0]; if(!f) return;
            if(!f.type.startsWith('image/')){ alert('Please drop an image file'); return; }
            const bmp = await createImageBitmap(f); setImageBitmap(bmp); push('Image loaded','success');
          }}>
          {/* GPU canvas (hidden in CPU mode) */}
          <canvas ref={canvasRef} className={`${previewMode==='gpu' ? 'block' : 'hidden'} w-full h-full`} />
          {/* A/B draggable divider (GPU mode only) */}
          {previewMode==='gpu' && abCompare && (
            <div
              className="absolute inset-0 pointer-events-none"
            >
              {/* Hit area */}
              {abVertical ? (
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: `${Math.round(abSplit*100)}%`, transform: 'translateX(-50%)', width: 1 }}
                >
                  <div
                    className="absolute -inset-y-2 -inset-x-2 pointer-events-auto cursor-col-resize"
                    tabIndex={0}
                    role="slider"
                    aria-label="A/B split"
                    aria-orientation="vertical"
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={Number(abSplit.toFixed(2))}
                    onKeyDown={(e)=>{
                      const step = e.shiftKey ? 0.01 : 0.05;
                      if(e.key==='ArrowLeft'){ const t=Math.max(0,abSplit-step); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
                      if(e.key==='ArrowRight'){ const t=Math.min(1,abSplit+step); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
                    }}
                    onMouseDown={(e)=>{ e.preventDefault(); setDraggingSplit(true); }}
                  />
                  <div className="absolute inset-y-0 left-0 w-px bg-sky-500" />
                  <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-sky-500/30 border border-sky-500 pointer-events-none" />
                </div>
              ) : (
                <div
                  className="absolute left-0 right-0"
                  style={{ top: `${Math.round(abSplit*100)}%`, transform: 'translateY(-50%)', height: 1 }}
                >
                  <div
                    className="absolute -inset-x-2 -inset-y-2 pointer-events-auto cursor-row-resize"
                    tabIndex={0}
                    role="slider"
                    aria-label="A/B split"
                    aria-orientation="horizontal"
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={Number(abSplit.toFixed(2))}
                    onKeyDown={(e)=>{
                      const step = e.shiftKey ? 0.01 : 0.05;
                      if(e.key==='ArrowUp'){ const t=Math.max(0,abSplit-step); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
                      if(e.key==='ArrowDown'){ const t=Math.min(1,abSplit+step); setAbSplit(t); glRef.current?.setParams({ abSplit: t }); e.preventDefault(); }
                    }}
                    onMouseDown={(e)=>{ e.preventDefault(); setDraggingSplit(true); }}
                  />
                  <div className="absolute inset-x-0 top-0 h-px bg-sky-500" />
                  <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-sky-500/30 border border-sky-500 pointer-events-none" />
                </div>
              )}
            </div>
          )}
          {/* CPU canvas (shown in CPU mode) */}
          <canvas ref={cpuCanvasRef} className={`${previewMode==='cpu' ? 'block' : 'hidden'} absolute inset-0`} />
          {isDragging && <div className="absolute inset-0 bg-sky-500/10 pointer-events-none flex items-center justify-center text-sky-400">Drop image to load</div>}
          {busy && previewMode==='cpu' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-sky-400">
              Rendering…
            </div>
          )}
        </div>
      </main>
      <aside className="border-l border-zinc-800 p-3" style={{ gridArea:'right' }}>
        <Accordion.Root type="multiple" defaultValue={["grade"]} className="space-y-2">
          <Accordion.Item value="grade" className="border border-zinc-800 rounded">
            <Accordion.Trigger className="w-full text-left px-3 py-2 bg-zinc-900 text-zinc-200 text-sm font-semibold">Grade</Accordion.Trigger>
            <Accordion.Content className="p-3 space-y-2">
              <div>
          <div className="text-sm text-zinc-400 mb-1 flex items-center gap-1"><span>Exposure</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Linear gain before contrast/gamma.</Tooltip.Content></Tooltip.Root></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[grade.exposure]} max={2} min={0} step={0.01} onValueChange={(v)=>{ const val=v[0]??1; setGrade(g=>({...g, exposure: val})); glRef.current?.setGrade({ exposure: val }); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Exposure" />
                </Slider.Root>
              </div>
              <div>
          <div className="text-sm text-zinc-400 mb-1 flex items-center gap-1"><span>Contrast</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Scales around mid-grey (0.5).</Tooltip.Content></Tooltip.Root></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[grade.contrast]} max={2} min={0} step={0.01} onValueChange={(v)=>{ const val=v[0]??1; setGrade(g=>({...g, contrast: val})); glRef.current?.setGrade({ contrast: val }); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Contrast" />
                </Slider.Root>
              </div>
              <div>
          <div className="text-sm text-zinc-400 mb-1 flex items-center gap-1"><span>Gamma</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Exponent applied after grading.</Tooltip.Content></Tooltip.Root></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[grade.gamma]} max={2.5} min={0.1} step={0.01} onValueChange={(v)=>{ const val=v[0]??1; setGrade(g=>({...g, gamma: val})); glRef.current?.setGrade({ gamma: val }); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Gamma" />
                </Slider.Root>
              </div>
              <div>
          <div className="text-sm text-zinc-400 mb-1 flex items-center gap-1"><span>Saturation</span><Tooltip.Root><Tooltip.Trigger asChild><span className="text-zinc-500 cursor-help">?</span></Tooltip.Trigger><Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">Mix between luminance and color.</Tooltip.Content></Tooltip.Root></div>
                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[grade.saturation]} max={2} min={0} step={0.01} onValueChange={(v)=>{ const val=v[0]??1; setGrade(g=>({...g, saturation: val})); glRef.current?.setGrade({ saturation: val }); }}>
                  <Slider.Track className="bg-zinc-800 relative grow rounded h-1"><Slider.Range className="absolute bg-zinc-400 rounded h-full" /></Slider.Track>
                  <Slider.Thumb className="block w-4 h-4 bg-white rounded shadow" aria-label="Saturation" />
                </Slider.Root>
              </div>
              {busy && <div className="text-sky-400">Rendering…</div>}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </aside>
    </div>
    </Tooltip.Provider>
  );
}
