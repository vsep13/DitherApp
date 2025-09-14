import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { parsePreset, type PresetV1 } from '../lib/preset';

type NamedPreset = { id: string; name: string; data: PresetV1; updatedAt: number };
const STORE_KEY = 'dp2_named_presets_v1';

function loadPresets(): NamedPreset[] {
  try { const raw = localStorage.getItem(STORE_KEY); if(!raw) return []; const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
function savePresets(list: NamedPreset[]){ try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {} }

function uid(){ return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

export function PresetManager({ open, onClose, onApply, getCurrent }: {
  open: boolean;
  onClose: () => void;
  onApply: (preset: PresetV1) => void;
  getCurrent: () => PresetV1;
}){
  const [list, setList] = useState<NamedPreset[]>([]);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(()=>{ if(open) setList(loadPresets()); }, [open]);

  const shown = useMemo(()=>{
    const q = filter.trim().toLowerCase();
    const arr = list.slice().sort((a,b)=> b.updatedAt - a.updatedAt);
    if(!q) return arr;
    return arr.filter(p=> p.name.toLowerCase().includes(q));
  }, [list, filter]);

  function updateList(next: NamedPreset[]){ setList(next); savePresets(next); }

  function saveCurrentAs(){
    const name = prompt('Preset name?'); if(!name) return;
    const data = getCurrent();
    const now = Date.now();
    const existing = list.find(p=> p.name === name);
    if(existing){
      const next = list.map(p=> p.name===name ? { ...p, data, updatedAt: now } : p);
      updateList(next);
    } else {
      const next = [{ id: uid(), name, data, updatedAt: now }, ...list];
      updateList(next);
    }
  }

  function exportOne(p: NamedPreset){
    const blob = new Blob([JSON.stringify(p.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${p.name.replace(/[^a-z0-9_ -]+/gi,'_')||'preset'}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }
  function exportAll(){
    const payload = list.map(({ name, data })=> ({ name, data }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='presets.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }
  async function importFile(f: File){
    try {
      const txt = await f.text();
      // Try array import first
      const raw = JSON.parse(txt);
      if(Array.isArray(raw)){
        let imported = 0;
        const next = list.slice();
        for(const item of raw){
          const preset = parsePreset(item?.data ?? item);
          const name: string = item?.name || 'Imported';
          if(preset){ next.unshift({ id: uid(), name, data: preset, updatedAt: Date.now() }); imported++; }
        }
        if(imported>0){ updateList(next); alert(`Imported ${imported} preset(s).`); }
        else alert('No valid presets found in file.');
        return;
      }
      const p = parsePreset(raw);
      if(!p){ alert('Invalid preset file'); return; }
      const name = prompt('Name for imported preset?', f.name.replace(/\.json$/i,'') || 'Imported'); if(!name) return;
      updateList([{ id: uid(), name, data: p, updatedAt: Date.now() }, ...list]);
    } catch { alert('Failed to import preset'); }
  }

  function rename(id: string, nextName: string){ updateList(list.map(p=> p.id===id ? { ...p, name: nextName, updatedAt: Date.now() } : p)); }
  function remove(id: string){ if(confirm('Delete this preset?')) updateList(list.filter(p=> p.id!==id)); }

  if(!open) return null;
  return (
    <Dialog.Root open={open} onOpenChange={(v)=>{ if(!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,95vw)] max-h-[85vh] overflow-auto bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl text-zinc-100">
          <div className="flex items-center gap-3 mb-3">
            <Dialog.Title className="font-semibold">Presets</Dialog.Title>
            <Dialog.Description className="sr-only">Manage named presets: save, load, rename, import, export.</Dialog.Description>
            <div className="grow" />
            <Dialog.Close asChild><button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">Close</button></Dialog.Close>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600" onClick={saveCurrentAs}>Save Current…</button>
            <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={()=> fileRef.current?.click()}>Import…</button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display:'none' }} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) importFile(f); e.currentTarget.value=''; }} />
            <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={exportAll} disabled={list.length===0}>Export All</button>
            <div className="grow" />
            <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1" placeholder="Filter…" value={filter} onChange={(e)=> setFilter(e.target.value)} />
          </div>
          <div className="grid gap-2">
            {shown.length===0 && <div className="text-zinc-400">No presets yet.</div>}
            {shown.map(p=> (
              <div key={p.id} className="flex items-center gap-2 border border-zinc-800 rounded p-2 bg-zinc-900">
                {editingId===p.id ? (
                  <input autoFocus className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 min-w-[200px]" defaultValue={p.name} onBlur={(e)=>{ const v=e.target.value.trim(); if(v && v!==p.name) rename(p.id, v); setEditingId(null); }} onKeyDown={(e)=>{ if(e.key==='Enter'){ (e.target as HTMLInputElement).blur(); } if(e.key==='Escape'){ setEditingId(null); } }} />
                ) : (
                  <div className="min-w-[200px] truncate" title={p.name}><strong>{p.name}</strong></div>
                )}
                <div className="text-xs text-zinc-500">{new Date(p.updatedAt).toLocaleString()}</div>
                <div className="grow" />
                <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={()=> onApply(p.data)}>Load</button>
                <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={()=> setEditingId(p.id)}>Rename</button>
                <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={()=> exportOne(p)}>Export</button>
                <button className="px-2 py-1 rounded bg-red-900/60 border border-red-800" onClick={()=> remove(p.id)}>Delete</button>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

