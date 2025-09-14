import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { GLRenderer } from '@/gpu/glRenderer';
import { samplePaletteFromImageBitmap } from '@/utils/palette';
import { CONSOLE_PRESETS } from '@/palettes/presets';
import { patternPresets, findPattern } from '@/patterns/presets';
import PatternBrowser from '@/ui/PatternBrowser';
import BatchExport from '@/ui/BatchExport';
// Video batch temporarily removed due to decoding issues

function LeftPanel() {
  const set = useStore((s) => s.set);
  const palette = useStore((s) => s.palette);
  const imageBitmap = useStore((s) => s.imageBitmap);
  const paletteLocks = useStore((s)=> s.paletteLocks);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.decode = img.decode || ((() => Promise.resolve()) as any);
    img.onload = async () => {
      const bmp = await createImageBitmap(img);
      set('image', img);
      set('imageBitmap', bmp);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function onPastePalette() {
    const txt = prompt('Paste HEX list (comma/space/newline separated):');
    if (!txt) return;
    const tokens = txt.split(/[^#a-fA-F0-9]+/g).filter(Boolean);
    const hexes = tokens.map((t) => (t.startsWith('#') ? t : `#${t}`));
    if (hexes.length) useStore.getState().set('palette', hexes.slice(0, 64));
  }

  return (
    <div className="left">
      <div className="grid">
        <label className="button">
          Import Image
          <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={onFile} />
        </label>
        <button className="button" onClick={async ()=>{
          if(!imageBitmap) return alert('Load an image first');
          const n = Number(prompt('Sample how many colors? (1-64)','16')||'16');
          const count = Math.min(64, Math.max(1, n|0));
          const sampled = await samplePaletteFromImageBitmap(imageBitmap, count);
          // Respect locks: fill unlocked positions sequentially with sampled colors
          const cur = useStore.getState().palette;
          const locks = useStore.getState().paletteLocks;
          const targetLen = Math.min(64, Math.max(1, count));
          const next: string[] = [];
          const nextLocks: boolean[] = [];
          let si = 0;
          for(let i=0;i<targetLen;i++){
            if(i<cur.length && locks[i]){ next[i] = cur[i]; nextLocks[i] = true; }
            else { next[i] = sampled[si++] || '#000000'; nextLocks[i] = false; }
          }
          set('palette', next);
          set('paletteLocks', nextLocks);
        }}>Sample Palette from Image</button>
        <button className="button" onClick={onPastePalette}>Paste HEX Palette</button>
        <div className="row">
          <div className="label">Presets</div>
          <select className="input" onChange={(e)=>{
            const id = e.target.value; if(!id) return;
            const preset = CONSOLE_PRESETS.find(p=>p.id===id);
            if(preset){ set('palette', preset.colors.slice(0,64)); }
            e.currentTarget.selectedIndex = 0;
          }}>
            <option value="">Select preset…</option>
            {CONSOLE_PRESETS.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="button" onClick={async ()=>{
          const src = prompt('Paste Lospec ID (e.g., "nyx8") or JSON');
          if(!src) return;
          let colors: string[] | null = null;
          try {
            if(src.trim().startsWith('{') || src.trim().startsWith('[')){
              const json = JSON.parse(src);
              colors = (json.colors || json.palette || []).map((x: string)=> x.startsWith('#')?x:'#'+x);
            } else {
              const id = src.trim();
              const url = `https://lospec.com/palette-list/${id}.json`;
              const resp = await fetch(url);
              if(resp.ok){ const json = await resp.json(); colors = (json.colors||[]).map((x: string)=> x.startsWith('#')?x:'#'+x); }
              else alert('Failed to fetch Lospec palette. Try pasting JSON instead.');
            }
          } catch(err){ alert('Invalid input. Paste a Lospec ID (e.g., nyx8) or JSON with a colors array.'); }
          if(colors && colors.length){ set('palette', colors.slice(0,64)); }
        }}>Import Lospec (ID/JSON)</button>
        <div>
          <div style={{ marginBottom: 6, color: 'var(--muted)' }}>Palette ({palette.length})</div>
          <div className="swatches">
            {palette.map((c, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div className="swatch" title={c} style={{ background: c }} />
                <input type="color" value={/^#([0-9a-fA-F]{6})$/.test(c)?c:'#000000'} onChange={(e)=>{
                  const arr = useStore.getState().palette.slice(); arr[i] = e.target.value; set('palette', arr);
                }} />
                <label style={{ display:'flex', alignItems:'center', gap:4, color:'var(--muted)' }}>
                  <input type="checkbox" checked={paletteLocks[i]||false} onChange={(e)=>{
                    const locks = useStore.getState().paletteLocks.slice(); locks[i]=e.target.checked; set('paletteLocks', locks);
                  }} /> lock
                </label>
                <button className="button" onClick={()=>{
                  if(i<=0) return; const arr = useStore.getState().palette.slice(); const locks = useStore.getState().paletteLocks.slice();
                  [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; [locks[i-1], locks[i]] = [locks[i], locks[i-1]]; set('palette', arr); set('paletteLocks', locks);
                }}>↑</button>
                <button className="button" onClick={()=>{
                  const arr = useStore.getState().palette.slice(); const locks = useStore.getState().paletteLocks.slice();
                  if(i>=arr.length-1) return; [arr[i+1], arr[i]] = [arr[i], arr[i+1]]; [locks[i+1], locks[i]] = [locks[i], locks[i+1]]; set('palette', arr); set('paletteLocks', locks);
                }}>↓</button>
                <button className="button" onClick={()=>{
                  const arr = useStore.getState().palette.slice(); const locks = useStore.getState().paletteLocks.slice();
                  if(arr.length<=1) return; arr.splice(i,1); locks.splice(i,1); set('palette', arr); set('paletteLocks', locks);
                }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, display:'flex', gap:6 }}>
            <button className="button" onClick={()=>{
              const arr = useStore.getState().palette.slice(); const locks = useStore.getState().paletteLocks.slice();
              if(arr.length>=64) return; arr.push('#ffffff'); locks.push(false); set('palette', arr); set('paletteLocks', locks);
            }}>Add Color</button>
            <button className="button" onClick={()=>{ set('palette', ['#000000','#ffffff']); set('paletteLocks', [false,false]); }}>Reset 2-color</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanel({ renderer, onOpenPatternBrowser }: { renderer: GLRenderer | null; onOpenPatternBrowser: () => void }) {
  const { algorithm, pixelate, serpentine, diffusionStrength, thresholdBias, patternScale, patternAngle, patternId, mode, showGrid, abCompare, abSplit, viewScale, exposure, contrast, gamma, saturation, crtEnabled, crtScanline, crtMaskStrength, crtMaskType, crtBarrel, crtVignette, glowEnabled, glowThreshold, glowIntensity, glowRadius, glowIterations, glowRGBSpread, cpuKernel } = useStore();
  const set = useStore((s) => s.set);

  useEffect(() => {
    renderer?.requestFrame();
  }, [renderer, algorithm, pixelate, serpentine, diffusionStrength, thresholdBias, patternScale, patternAngle, patternId, mode, showGrid, abCompare, abSplit, viewScale, exposure, contrast, gamma, saturation, crtEnabled, crtScanline, crtMaskStrength, crtMaskType, crtBarrel, crtVignette, glowEnabled, glowThreshold, glowIntensity, glowRadius, glowIterations, glowRGBSpread, cpuKernel]);

  return (
    <div className="right">
      <div className="tabs" role="tablist">
        <div className="tab active">Dither</div>
      </div>
      <div className="controls">
        <div className="row">
          <div className="label">Mode</div>
          <select className="input" value={mode} onChange={(e) => set('mode', e.target.value as any)}>
            <option value="indexed">Indexed</option>
            <option value="rgb">RGB</option>
            <option value="grayscale">Grayscale</option>
          </select>
        </div>
        <div className="row">
          <div className="label">Zoom</div>
          <input className="input" type="range" min={0.125} max={16} step={0.005} value={viewScale} onChange={(e)=> set('viewScale', Number(e.target.value))} />
          <div>{Math.round(viewScale*100)}%</div>
        </div>
        <div className="row">
          <div className="label">Algorithm</div>
          <select className="input" value={algorithm} onChange={(e) => set('algorithm', e.target.value as any)}>
            <option value="floyd-steinberg">Floyd–Steinberg</option>
            <option value="bayer2">Bayer 2×2</option>
            <option value="bayer4">Bayer 4×4</option>
            <option value="bayer8">Bayer 8×8</option>
            <option value="pattern">Pattern Map</option>
          </select>
        </div>
        <div className="row">
          <div className="label">CPU Kernel (Export)</div>
          <select className="input" value={cpuKernel} onChange={(e)=> set('cpuKernel', e.target.value as any)}>
            <option value="floyd-steinberg">Floyd–Steinberg</option>
            <option value="jjn">Jarvis–Judice–Ninke</option>
            <option value="stucki">Stucki</option>
            <option value="atkinson">Atkinson</option>
            <option value="burkes">Burkes</option>
            <option value="sierra-lite">Sierra Lite</option>
            <option value="sierra-2-4a">Sierra 2-4A</option>
            <option value="sierra-3">Sierra 3</option>
            <option value="stevenson-arce">Stevenson–Arce</option>
          </select>
        </div>
        {algorithm==='pattern' && <>
        <div className="row">
          <div className="label">Pattern</div>
          <select className="input" value={patternId} onChange={(e)=>{
            const id = e.target.value; set('patternId', id);
            const p = findPattern(id);
            if(p && renderer){ (renderer as any).setPattern(p.size, p.data); }
          }}>
            {patternPresets.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="button" onClick={onOpenPatternBrowser}>Browse…</button>
        </div>
        <div className="row">
          <div className="label">Pattern Angle</div>
          <input className="input" type="range" min={-3.1416} max={3.1416} step={0.001} value={patternAngle} onChange={(e)=> set('patternAngle', Number(e.target.value))} />
          <div>{Math.round(patternAngle*180/Math.PI)}°</div>
        </div>
        </>}
        <div className="row">
          <div className="label">Pixelate</div>
          <input className="input" type="range" min={1} max={32} value={pixelate} onChange={(e) => set('pixelate', Number(e.target.value))} />
          <div>{pixelate}×</div>
        </div>
        <div className="row">
          <div className="label">Serpentine</div>
          <input type="checkbox" checked={serpentine} onChange={(e) => set('serpentine', e.target.checked)} />
        </div>
        <div className="row">
          <div className="label">Diffusion</div>
          <input className="input" type="range" min={0} max={1} step={0.01} value={diffusionStrength} onChange={(e) => set('diffusionStrength', Number(e.target.value))} />
          <div>{diffusionStrength.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Threshold Bias</div>
          <input className="input" type="range" min={-1} max={1} step={0.01} value={thresholdBias} onChange={(e) => set('thresholdBias', Number(e.target.value))} />
          <div>{thresholdBias.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Pattern Scale</div>
          <input className="input" type="range" min={1} max={8} step={1} value={patternScale} onChange={(e) => set('patternScale', Number(e.target.value))} />
          <div>{patternScale}×</div>
        </div>
        <div className="row">
          <div className="label">Grid Overlay</div>
          <input type="checkbox" checked={showGrid} onChange={(e)=>set('showGrid', e.target.checked)} />
        </div>
        <div className="row">
          <div className="label">A/B Compare</div>
          <input type="checkbox" checked={abCompare} onChange={(e)=>set('abCompare', e.target.checked)} />
        </div>
        <div className="row">
          <div className="label">A/B Split</div>
          <input className="input" type="range" min={0} max={1} step={0.01} value={abSplit} onChange={(e)=>set('abSplit', Number(e.target.value))} />
          <div>{Math.round(abSplit*100)}%</div>
        </div>
        <div className="row">
          <div className="label">Zoom Presets</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[0.25,0.5,1,2,4].map((z)=> (
              <button key={z} className="button" onClick={()=> set('viewScale', z)}>{Math.round(z*100)}%</button>
            ))}
            <button className="button" onClick={()=>{
              const bmp = useStore.getState().imageBitmap;
              const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
              if(bmp && canvas){
                const scale = Math.min(canvas.width / bmp.width, canvas.height / bmp.height);
                set('viewScale', Math.max(0.125, Math.min(16, scale)));
                set('viewOffset', { x: 0, y: 0 });
              }
            }}>Fit</button>
            <button className="button" onClick={()=>{
              const bmp = useStore.getState().imageBitmap;
              const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
              if(bmp && canvas){
                const scale = Math.max(canvas.width / bmp.width, canvas.height / bmp.height);
                set('viewScale', Math.max(0.125, Math.min(16, scale)));
                set('viewOffset', { x: 0, y: 0 });
              }
            }}>Fill</button>
          </div>
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Grade</div>
        <div className="row">
          <div className="label">Exposure</div>
          <input className="input" type="range" min={0} max={2} step={0.01} value={exposure} onChange={(e)=> set('exposure', Number(e.target.value))} />
          <div>{exposure.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Contrast</div>
          <input className="input" type="range" min={0} max={2} step={0.01} value={contrast} onChange={(e)=> set('contrast', Number(e.target.value))} />
          <div>{contrast.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Gamma</div>
          <input className="input" type="range" min={0.1} max={2.5} step={0.01} value={gamma} onChange={(e)=> set('gamma', Number(e.target.value))} />
          <div>{gamma.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Saturation</div>
          <input className="input" type="range" min={0} max={2} step={0.01} value={saturation} onChange={(e)=> set('saturation', Number(e.target.value))} />
          <div>{saturation.toFixed(2)}</div>
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        <div style={{ color: 'var(--muted)', marginBottom: 6 }}>CRT</div>
        <div className="row">
          <div className="label">Enable CRT</div>
          <input type="checkbox" checked={crtEnabled} onChange={(e)=> set('crtEnabled', e.target.checked)} />
        </div>
        <div className="row">
          <div className="label">Scanlines</div>
          <input className="input" type="range" min={0} max={1} step={0.01} value={crtScanline} onChange={(e)=> set('crtScanline', Number(e.target.value))} />
          <div>{crtScanline.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Mask Strength</div>
          <input className="input" type="range" min={0} max={1} step={0.01} value={crtMaskStrength} onChange={(e)=> set('crtMaskStrength', Number(e.target.value))} />
          <div>{crtMaskStrength.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Mask Type</div>
          <select className="input" value={crtMaskType} onChange={(e)=> set('crtMaskType', Number(e.target.value))}>
            <option value={0}>None</option>
            <option value={1}>Aperture</option>
            <option value={2}>Shadow</option>
          </select>
        </div>
        <div className="row">
          <div className="label">Barrel</div>
          <input className="input" type="range" min={0} max={0.3} step={0.001} value={crtBarrel} onChange={(e)=> set('crtBarrel', Number(e.target.value))} />
          <div>{crtBarrel.toFixed(3)}</div>
        </div>
        <div className="row">
          <div className="label">Vignette</div>
          <input className="input" type="range" min={0} max={1} step={0.01} value={crtVignette} onChange={(e)=> set('crtVignette', Number(e.target.value))} />
          <div>{crtVignette.toFixed(2)}</div>
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Glow</div>
        <div className="row">
          <div className="label">Enable Glow</div>
          <input type="checkbox" checked={glowEnabled} onChange={(e)=> set('glowEnabled', e.target.checked)} />
        </div>
        <div className="row">
          <div className="label">Threshold</div>
          <input className="input" type="range" min={0} max={1} step={0.01} value={glowThreshold} onChange={(e)=> set('glowThreshold', Number(e.target.value))} />
          <div>{glowThreshold.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Intensity</div>
          <input className="input" type="range" min={0} max={4} step={0.01} value={glowIntensity} onChange={(e)=> set('glowIntensity', Number(e.target.value))} />
          <div>{glowIntensity.toFixed(2)}</div>
        </div>
        <div className="row">
          <div className="label">Radius</div>
          <input className="input" type="range" min={0} max={10} step={0.1} value={glowRadius} onChange={(e)=> set('glowRadius', Number(e.target.value))} />
          <div>{glowRadius.toFixed(1)}</div>
        </div>
        <div className="row">
          <div className="label">Iterations</div>
          <input className="input" type="range" min={1} max={6} step={1} value={glowIterations} onChange={(e)=> set('glowIterations', Number(e.target.value))} />
          <div>{glowIterations}</div>
        </div>
        <div className="row">
          <div className="label">RGB Spread</div>
          <input className="input" type="range" min={0} max={2} step={0.01} value={glowRGBSpread} onChange={(e)=> set('glowRGBSpread', Number(e.target.value))} />
          <div>{glowRGBSpread.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

function CenterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderer, setRenderer] = useState<GLRenderer | null>(null);
  const imageBitmap = useStore((s) => s.imageBitmap);
  const palette = useStore((s) => s.palette);
  const patternId = useStore((s)=>s.patternId);
  const set = useStore((s)=>s.set);
  const viewScale = useStore((s)=>s.viewScale);
  const viewOffset = useStore((s)=>s.viewOffset);

  useEffect(() => {
    if (!canvasRef.current) return;
    const glr = new GLRenderer(canvasRef.current);
    setRenderer(glr);
    return () => glr.dispose();
  }, []);

  useEffect(() => {
    renderer?.setPalette(palette);
  }, [renderer, palette]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setSource(imageBitmap || null);
  }, [renderer, imageBitmap]);

  // Initialize pattern texture and update on selection
  useEffect(()=>{
    if(!renderer) return;
    const p = findPattern(patternId) || patternPresets[2]; // default Bayer 8x8
    if(p) (renderer as any).setPattern(p.size, p.data);
  }, [renderer, patternId]);

  const [showBrowser, setShowBrowser] = useState(false);
  const closeBrowser = () => setShowBrowser(false);
  const Browser = useMemo(() => <PatternBrowser open={showBrowser} onClose={closeBrowser} />, [showBrowser]);

  useEffect(()=>{
    renderer?.requestFrame();
  }, [renderer, viewScale, viewOffset]);

  // Responsive canvas with devicePixelRatio scaling
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const dpr = (window.devicePixelRatio || 1);
      const cw = container.clientWidth || 1;
      const ch = container.clientHeight || 1;
      let dispW = cw, dispH = ch;
      const bmp = useStore.getState().imageBitmap;
      if (bmp && bmp.width > 0 && bmp.height > 0) {
        const ratio = bmp.width / bmp.height;
        const contRatio = cw / ch;
        if (contRatio > ratio) {
          // container is wider; limit by height
          dispH = ch;
          dispW = Math.round(ch * ratio);
        } else {
          // container is taller; limit by width
          dispW = cw;
          dispH = Math.round(cw / ratio);
        }
      }
      canvas.style.width = dispW + 'px';
      canvas.style.height = dispH + 'px';
      const pw = Math.max(1, Math.round(dispW * dpr));
      const ph = Math.max(1, Math.round(dispH * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        renderer?.requestFrame();
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    return () => ro.disconnect();
  }, [renderer, imageBitmap]);

  return (
    <div className="center">
      <div className="canvas-wrap" ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <canvas
          ref={canvasRef}
          className="canvas"
          // width/height are managed dynamically for DPR scaling
          onWheel={(e)=>{
            e.preventDefault();
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const sx = (e.clientX - rect.left)/rect.width;
            const sy = (e.clientY - rect.top)/rect.height;
            const s1 = useStore.getState().viewScale;
            const s2 = Math.min(16, Math.max(0.125, s1 * (e.deltaY>0 ? 0.9 : 1.1)));
            const dx = (sx - 0.5)*(1/s1 - 1/s2);
            const dy = (sy - 0.5)*(1/s1 - 1/s2);
            set('viewScale', s2);
            const vo = useStore.getState().viewOffset;
            set('viewOffset', { x: vo.x + dx, y: vo.y + dy });
          }}
          onPointerDown={(e)=>{
            const canvas = e.currentTarget;
            canvas.setPointerCapture(e.pointerId);
            let lastX = e.clientX, lastY = e.clientY;
            const move = (ev: PointerEvent)=>{
              const dx = (ev.clientX - lastX)/canvas.width;
              const dy = (ev.clientY - lastY)/canvas.height;
              lastX = ev.clientX; lastY = ev.clientY;
              const s = useStore.getState().viewScale;
              const vo = useStore.getState().viewOffset;
              set('viewOffset', { x: vo.x - dx/s, y: vo.y - dy/s });
            };
            const up = (ev: PointerEvent)=>{
              canvas.releasePointerCapture(e.pointerId);
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        />
      </div>
      <RightPanel renderer={renderer} onOpenPatternBrowser={() => setShowBrowser(true)} />
      {Browser}
    </div>
  );
}

import { exportCanvasPNG, downloadJSON, exportImageDataPNG } from '@/utils/export';
import { encodeIndexedPNGFromImage, indicesFromImage, paletteToRGBBytes, encodeMaskPNGFromIndices } from '@/utils/indexed';
import { downloadZip } from '@/utils/zip';
import { runFS } from '@/workers/fsClient';

export default function App() {
  const state = useStore();
  const set = useStore((s)=>s.set);
  async function onExportPNG(){
    const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
    if(canvas) await exportCanvasPNG(canvas, 'dither.png');
  }
  async function onExportCPUFS(){
    if(!state.imageBitmap){ alert('Load an image first'); return; }
    const img = await runFS({
      imageBitmap: state.imageBitmap,
      palette: state.palette,
      serpentine: state.serpentine,
      diffusionStrength: state.diffusionStrength,
      thresholdBias: state.thresholdBias,
      pixelate: state.pixelate,
      grade: { exposure: state.exposure, contrast: state.contrast, gamma: state.gamma, saturation: state.saturation },
      kernel: state.cpuKernel
    });
    await exportImageDataPNG(img, 'dither-cpu-fs.png');
  }
  async function onExportIndexedPNG(){
    if(!state.imageBitmap){ alert('Load an image first'); return; }
    // Always use CPU FS result as the source to avoid any GPU/canvas color management differences
    const img = await runFS({
      imageBitmap: state.imageBitmap,
      palette: state.palette,
      serpentine: state.serpentine,
      diffusionStrength: state.diffusionStrength,
      thresholdBias: state.thresholdBias,
      pixelate: state.pixelate,
      grade: { exposure: state.exposure, contrast: state.contrast, gamma: state.gamma, saturation: state.saturation },
      kernel: state.cpuKernel
    });
    const blob = encodeIndexedPNGFromImage(img, state.palette);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dither-indexed.png'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }
  async function onExportSwatchMasks(){
    if(!state.imageBitmap){ alert('Load an image first'); return; }
    const img = await runFS({
      imageBitmap: state.imageBitmap,
      palette: state.palette,
      serpentine: state.serpentine,
      diffusionStrength: state.diffusionStrength,
      thresholdBias: state.thresholdBias,
      pixelate: state.pixelate,
      grade: { exposure: state.exposure, contrast: state.contrast, gamma: state.gamma, saturation: state.saturation },
      kernel: state.cpuKernel
    });
    const idx = indicesFromImage(img, state.palette);
    const entries: { name: string; data: Uint8Array }[] = [];
    for(let i=0;i<state.palette.length && i<64;i++){
      const hex = state.palette[i].replace('#','');
      const blob = encodeMaskPNGFromIndices(img.width, img.height, idx, i);
      const arr = new Uint8Array(await blob.arrayBuffer());
      entries.push({ name: `mask_${String(i).padStart(2,'0')}_${hex}.png`, data: arr });
    }
    const manifest = {
      width: img.width,
      height: img.height,
      palette: state.palette.map((hex, i) => ({ index: i, hex })),
      files: entries.map(e => e.name)
    };
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    entries.push({ name: 'manifest.json', data: manifestBytes });
    downloadZip(entries, 'swatch-masks.zip');
  }
  function onSavePreset(){
    const preset = {
      version: 1,
      // Core
      mode: state.mode,
      algorithm: state.algorithm,
      pixelate: state.pixelate,
      serpentine: state.serpentine,
      diffusionStrength: state.diffusionStrength,
      thresholdBias: state.thresholdBias,
      seed: state.seed,
      cpuKernel: state.cpuKernel,
      // Palette
      palette: state.palette,
      paletteLocks: state.paletteLocks,
      // Pattern/ordered params
      patternId: state.patternId,
      patternScale: state.patternScale,
      patternAngle: state.patternAngle,
      // View/UI
      viewScale: state.viewScale,
      viewOffset: state.viewOffset,
      showGrid: state.showGrid,
      abCompare: state.abCompare,
      abSplit: state.abSplit,
      // Grade
      grade: {
        exposure: state.exposure,
        contrast: state.contrast,
        gamma: state.gamma,
        saturation: state.saturation,
      },
      // CRT
      crt: {
        enabled: state.crtEnabled,
        scanline: state.crtScanline,
        maskStrength: state.crtMaskStrength,
        maskType: state.crtMaskType,
        barrel: state.crtBarrel,
        vignette: state.crtVignette,
      },
      // Glow
      glow: {
        enabled: state.glowEnabled,
        threshold: state.glowThreshold,
        intensity: state.glowIntensity,
        radius: state.glowRadius,
        iterations: state.glowIterations,
        rgbSpread: state.glowRGBSpread,
      },
    } as const;
    downloadJSON(preset, 'preset.json');
  }
  const [showBatch, setShowBatch] = useState(false);
  // const [showBatchVideo, setShowBatchVideo] = useState(false);
  // Autosave state
  useEffect(()=>{
    const unsub = useStore.subscribe((s)=>{
      const save = { ...s } as any;
      delete save.image; delete save.imageBitmap; // don't persist heavy objects
      localStorage.setItem('ditherpusher_state', JSON.stringify(save));
    });
    // hydrate
    try {
      const raw = localStorage.getItem('ditherpusher_state');
      if(raw){
        const parsed = JSON.parse(raw);
        for(const k of Object.keys(parsed)){
          if(k in state){ (set as any)(k, (parsed as any)[k]); }
        }
      }
    } catch {}
    return () => unsub();
  }, []);
  // Keyboard shortcuts
  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{
      if(e.key === 'r' || e.key === 'R'){
        set('viewScale', 1); set('viewOffset', { x: 0, y: 0 });
      } else if(e.key === 'b' || e.key === 'B'){
        set('abCompare', !useStore.getState().abCompare);
      } else if(e.key === '+' || e.key === '='){
        const s = useStore.getState().viewScale;
        set('viewScale', Math.min(16, s * 1.1));
      } else if(e.key === '-' || e.key === '_'){
        const s = useStore.getState().viewScale;
        set('viewScale', Math.max(0.125, s * 0.9));
      } else if(e.key === '0'){
        set('viewScale', 1);
      } else if(e.key === '1'){
        set('viewScale', 1);
      } else if(e.key === 'f' || e.key === 'F'){
        const bmp = useStore.getState().imageBitmap;
        const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
        if(bmp && canvas){
          const scale = Math.min(canvas.width / bmp.width, canvas.height / bmp.height);
          set('viewScale', Math.max(0.125, Math.min(16, scale)));
          set('viewOffset', { x: 0, y: 0 });
        }
      } else if(e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown'){
        const s = useStore.getState().viewScale;
        const vo = useStore.getState().viewOffset;
        const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
        const step = canvas ? (10 / canvas.width) : 0.01;
        if(e.key === 'ArrowLeft') set('viewOffset', { x: vo.x + step/s, y: vo.y });
        if(e.key === 'ArrowRight') set('viewOffset', { x: vo.x - step/s, y: vo.y });
        if(e.key === 'ArrowUp') set('viewOffset', { x: vo.x, y: vo.y + step/s });
        if(e.key === 'ArrowDown') set('viewOffset', { x: vo.x, y: vo.y - step/s });
      }
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="app">
      <div className="header">
        <strong>Dither Pusher (Web)</strong>
        <span style={{ color: 'var(--muted)' }}>Prototype</span>
        <div style={{ flex: 1 }} />
        <button className="button" onClick={()=>{ set('viewScale', 1); set('viewOffset', { x: 0, y: 0 }); }}>Reset View (R)</button>
        <button className="button" onClick={()=> set('viewScale', Math.max(0.125, useStore.getState().viewScale*0.9))}>Zoom Out (-)</button>
        <button className="button" onClick={()=> set('viewScale', Math.min(16, useStore.getState().viewScale*1.1))}>Zoom In (+)</button>
        <button className="button" onClick={()=>{
          const bmp = useStore.getState().imageBitmap;
          const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
          if(bmp && canvas){
            const scale = Math.min(canvas.width / bmp.width, canvas.height / bmp.height);
            set('viewScale', Math.max(0.125, Math.min(16, scale)));
            set('viewOffset', { x: 0, y: 0 });
          }
        }}>Fit (F)</button>
        <button className="button" onClick={()=>{
          const bmp = useStore.getState().imageBitmap;
          const canvas = document.querySelector('canvas.canvas') as HTMLCanvasElement | null;
          if(bmp && canvas){
            const scale = Math.max(canvas.width / bmp.width, canvas.height / bmp.height);
            set('viewScale', Math.max(0.125, Math.min(16, scale)));
            set('viewOffset', { x: 0, y: 0 });
          }
        }}>Fill</button>
        <button className="button" onClick={()=> setShowBatch(true)}>Batch Export</button>
        {/* Batch Video disabled for now */}
        <button className="button" onClick={onSavePreset}>Save Preset</button>
        <button className="button" onClick={onExportCPUFS}>Export (CPU Dither)</button>
        <button className="button" onClick={onExportIndexedPNG}>Export Indexed PNG</button>
        <button className="button" onClick={onExportSwatchMasks}>Export Swatch Masks</button>
        <button className="button primary" onClick={onExportPNG}>Export PNG</button>
      </div>
      <LeftPanel />
      <CenterCanvas />
      {showBatch && <BatchExport open={showBatch} onClose={()=> setShowBatch(false)} />}
      {/* Batch Video dialog removed for now */}
    </div>
  );
}
