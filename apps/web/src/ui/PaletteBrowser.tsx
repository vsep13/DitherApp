import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { loadOfflinePalettes, type OfflinePalettes } from '../lib/offlinePalettes';

function makeThumb(colors: string[], w = 160, h = 32): string {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const n = Math.max(1, colors.length);
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i] || '#000000';
    ctx.fillRect(Math.floor(i * sw), 0, Math.ceil(sw), h);
  }
  return canvas.toDataURL('image/png');
}

type SizeFilter = 'all' | '2-8' | '9-16' | '17-32' | '33+';

export function PaletteBrowser({
  open,
  onClose,
  onApply,
  offline: initialOffline,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (colors: string[]) => void;
  offline?: OfflinePalettes | null;
}) {
  const [offline, setOffline] = useState<OfflinePalettes | null>(initialOffline ?? null);
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<SizeFilter>('all');
  const [page, setPage] = useState(1);
  const pageSize = 36;

  useEffect(() => {
    if (!offline) loadOfflinePalettes().then(setOffline);
  }, [offline]);

  const items = useMemo(() => {
    const list = offline?.palettes || [];
    const q = query.trim().toLowerCase();
    const sized = list.filter((p) => {
      const n = p.colors.length;
      if (size === 'all') return true;
      if (size === '2-8') return n >= 2 && n <= 8;
      if (size === '9-16') return n >= 9 && n <= 16;
      if (size === '17-32') return n >= 17 && n <= 32;
      return n >= 33;
    });
    const filtered = q
      ? sized.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      : sized;
    return filtered;
  }, [offline, query, size]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [query, size, open]);

  if (!open) return null;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,95vw)] max-h-[85vh] overflow-auto bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl text-zinc-100">
          <div className="flex items-center gap-3 mb-3">
            <Dialog.Title className="font-semibold">Palette Browser</Dialog.Title>
            <Dialog.Description className="sr-only">Browse, search, and apply a palette to the image.</Dialog.Description>
            <div className="grow" />
            <Dialog.Close asChild>
              <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">Close</button>
            </Dialog.Close>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 w-full" placeholder="Search name or slug..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1" value={size} onChange={(e) => setSize(e.target.value as SizeFilter)}>
              <option value="all">All sizes</option>
              <option value="2-8">2–8</option>
              <option value="9-16">9–16</option>
              <option value="17-32">17–32</option>
              <option value="33+">33+</option>
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pageItems.map((p) => {
              const thumb = makeThumb(p.colors, 200, 36);
              return (
                <div key={p.slug} className="group border border-zinc-800 rounded-md p-2 bg-zinc-900 hover:border-sky-500 text-left">
                  <img src={thumb} alt={p.name} className="w-full h-9 object-cover rounded" />
                  <div className="mt-2 text-sm text-zinc-200 truncate" title={p.name}>{p.name}</div>
                  <div className="text-xs text-zinc-500 truncate">{p.slug} • {p.colors.length} colors{p.author ? ` • by ${p.author}` : ''}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" onClick={() => { onApply(p.colors.slice(0, 256)); onClose(); }}>Apply</button>
                    <a className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" href={`https://lospec.com/palette-list/${encodeURIComponent(p.slug)}`} target="_blank" rel="noreferrer">Open</a>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" disabled={page<=1} onClick={()=> setPage((p)=> Math.max(1, p-1))}>Prev</button>
            <div className="text-zinc-400 text-sm">Page {page}/{totalPages}</div>
            <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50" disabled={page>=totalPages} onClick={()=> setPage((p)=> Math.min(totalPages, p+1))}>Next</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
