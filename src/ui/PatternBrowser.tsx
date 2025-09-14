import React, { useMemo, useState } from 'react';
import { PatternPreset, patternPresets, PatternCategory } from '@/patterns/presets';
import { useStore } from '@/state/store';

function makeThumb(p: PatternPreset, px = 64): string {
  const canvas = document.createElement('canvas');
  const scale = Math.max(1, Math.floor(px / p.size));
  canvas.width = p.size * scale; canvas.height = p.size * scale;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < p.size; y++) {
    for (let x = 0; x < p.size; x++) {
      const v = Math.max(0, Math.min(1, p.data[y * p.size + x]));
      const g = Math.round(v * 255);
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const ix = x * scale + ox;
          const iy = y * scale + oy;
          const i = (iy * canvas.width + ix) * 4;
          img.data[i + 0] = g;
          img.data[i + 1] = g;
          img.data[i + 2] = g;
          img.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const cats: { value: 'all' | PatternCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bayer', label: 'Bayer' },
  { value: 'dot', label: 'Dot' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'lines', label: 'Lines' },
  { value: 'diag', label: 'Diagonal' },
  { value: 'checker', label: 'Checker' },
  { value: 'radial', label: 'Radial' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'noise', label: 'Noise' },
];

export default function PatternBrowser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<'all' | PatternCategory>('all');
  const set = useStore((s) => s.set);

  const items = useMemo(() => {
    const q = query.toLowerCase();
    return patternPresets
      .filter((p) => (cat === 'all' ? true : p.category === cat))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.id.includes(q) : true))
      .map((p) => ({ preset: p, thumb: makeThumb(p, 56) }));
  }, [query, cat]);

  if (!open) return null;
  return (
    <div className="modal">
      <div className="modal-content">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <strong>Pattern Browser</strong>
          <div style={{ flex: 1 }} />
          <button className="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="input" placeholder="Search patterns..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value as any)}>
            {cats.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="pattern-grid">
          {items.map(({ preset, thumb }) => (
            <button
              key={preset.id}
              className="pattern-card"
              title={preset.name}
              onClick={() => {
                set('patternId', preset.id);
                onClose();
              }}
            >
              <img src={thumb} width={56} height={56} alt={preset.name} />
              <div className="pattern-name">{preset.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

