import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { patternPresets, type PatternPreset } from '@core/patterns';

function makePatternThumb(p: PatternPreset, W = 160, H = 120): string {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const n = p.size; const data = p.data;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const tx = ((x % n) + n) % n; const ty = ((y % n) + n) % n;
      const v = data[ty*n + tx] || 0;
      const g = Math.round(v * 255);
      const i = (y*W + x) * 4; img.data[i] = g; img.data[i+1] = g; img.data[i+2] = g; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

type TypeFilter = 'all' | 'favorites' | 'bayer' | 'lines' | 'cdot' | 'radial' | 'diamond' | 'square' | 'spiral' | 'sine' | 'checker' | 'grid';
type SizeFilter = 'all' | '2-4' | '5-8' | '9-16' | '17+';

function typeOfPattern(id: string): TypeFilter {
  const key = id.toLowerCase();
  if(key.startsWith('bayer')) return 'bayer';
  if(key.startsWith('lines')) return 'lines';
  if(key.startsWith('cdot')) return 'cdot';
  if(key.startsWith('radial')) return 'radial';
  if(key.startsWith('diamond')) return 'diamond';
  if(key.startsWith('square')) return 'square';
  if(key.startsWith('spiral')) return 'spiral';
  if(key.startsWith('sine')) return 'sine';
  if(key.startsWith('checker')) return 'checker';
  if(key.startsWith('grid')) return 'grid';
  return 'all';
}

const FAV_KEY = 'dp2_pattern_favorites';
function loadFavs(): Set<string> {
  try { const raw = localStorage.getItem(FAV_KEY); if(!raw) return new Set(); const arr = JSON.parse(raw); return new Set(Array.isArray(arr)?arr:[]); } catch { return new Set(); }
}
function saveFavs(favs: Set<string>){ try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favs))); } catch {} }

export function PatternBrowser({ open, onClose, onApply }: {
  open: boolean;
  onClose: () => void;
  onApply: (patternId: string) => void;
}){
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [size, setSize] = useState<SizeFilter>('all');
  const [favs, setFavs] = useState<Set<string>>(loadFavs());

  useEffect(()=>{ if(!open){ setQuery(''); setType('all'); setSize('all'); } }, [open]);

  const items = useMemo(()=>{
    const q = query.trim().toLowerCase();
    let list = patternPresets.slice();
    if(type === 'favorites'){ list = list.filter(p=> favs.has(p.id)); }
    else if(type !== 'all'){ list = list.filter(p=> typeOfPattern(p.id) === type); }
    if(size !== 'all'){
      list = list.filter(p=> size==='2-4' ? p.size<=4 : size==='5-8' ? (p.size>=5 && p.size<=8) : size==='9-16' ? (p.size>=9 && p.size<=16) : (p.size>=17));
    }
    if(q) list = list.filter(p=> p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    return list;
  }, [query, type, size, favs]);

  function toggleFav(id: string){ const nf = new Set(favs); if(nf.has(id)) nf.delete(id); else nf.add(id); setFavs(nf); saveFavs(nf); }

  if(!open) return null;
  return (
    <Dialog.Root open={open} onOpenChange={(v)=>{ if(!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,95vw)] max-h-[85vh] overflow-auto bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl text-zinc-100">
          <div className="flex items-center gap-3 mb-3">
            <Dialog.Title className="font-semibold">Pattern Browser</Dialog.Title>
            <Dialog.Description className="sr-only">Browse, search, and apply an ordered pattern map.</Dialog.Description>
            <div className="grow" />
            <Dialog.Close asChild><button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">Close</button></Dialog.Close>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-[min(360px,60vw)]" placeholder="Search name or id..." value={query} onChange={(e)=> setQuery(e.target.value)} />
            <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1" value={type} onChange={(e)=> setType(e.target.value as TypeFilter)}>
              <option value="all">All types</option>
              <option value="favorites">★ Favorites</option>
              <option value="bayer">Bayer</option>
              <option value="cdot">Clustered Dot</option>
              <option value="lines">Lines</option>
              <option value="radial">Radial</option>
              <option value="diamond">Diamond</option>
              <option value="square">Square</option>
              <option value="spiral">Spiral</option>
              <option value="sine">Sine</option>
              <option value="checker">Checker</option>
              <option value="grid">Grid</option>
            </select>
            <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1" value={size} onChange={(e)=> setSize(e.target.value as SizeFilter)}>
              <option value="all">All sizes</option>
              <option value="2-4">2–4</option>
              <option value="5-8">5–8</option>
              <option value="9-16">9–16</option>
              <option value="17+">17+</option>
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map(p=>{
              const thumb = makePatternThumb(p, 200, 140);
              const fav = favs.has(p.id);
              return (
                <div key={p.id} className="group border border-zinc-800 rounded-md p-2 bg-zinc-900 hover:border-sky-500">
                  <img src={thumb} alt={p.name} className="w-full h-24 object-cover rounded bg-black" />
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-sm text-zinc-200 truncate" title={p.name}>{p.name}</div>
                    <span className="text-xs text-zinc-500">{p.size}×{p.size}</span>
                    <div className="grow" />
                    <button className={`text-sm ${fav?'text-amber-400':'text-zinc-500'} hover:text-amber-400`} title={fav?'Unfavorite':'Favorite'} onClick={()=> toggleFav(p.id)}>★</button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" onClick={()=>{ onApply(p.id); onClose(); }}>Use</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

