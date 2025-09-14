import React from 'react';

export function PalettePanel({
  palette,
  locks,
  onChange,
}: {
  palette: string[];
  locks: boolean[];
  onChange: (next: { palette?: string[]; locks?: boolean[] }) => void;
}) {
  return (
    <div>
      <div className="text-sm text-zinc-400 mb-1">Palette ({palette.length})</div>
      <div className="flex flex-col gap-1.5">
        {palette.map((c, i) => (
          <div key={i} className="flex items-center gap-2 min-h-[32px]">
            <div className="w-6 h-6 rounded border border-zinc-700" style={{ background: c }} />
            <input
              type="color"
              className="w-8 h-8 p-0 rounded border border-zinc-700"
              value={/^#([0-9a-fA-F]{6})$/.test(c) ? c : '#000000'}
              onChange={(e) => {
                const arr = palette.slice(); arr[i] = e.target.value; onChange({ palette: arr });
              }}
            />
            <label className="text-zinc-400 text-sm flex items-center gap-1 select-none">
              <input
                type="checkbox"
                checked={!!locks[i]}
                onChange={(e) => {
                  const lk = locks.slice(); lk[i] = e.target.checked; onChange({ locks: lk });
                }}
              />
              Lock
            </label>
            <div className="grow" />
            <button
              className="w-8 h-8 grid place-items-center rounded bg-zinc-800 border border-zinc-700"
              onClick={() => {
                if (i <= 0) return; const arr = palette.slice(); const lk = locks.slice();
                [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; [lk[i - 1], lk[i]] = [lk[i], lk[i - 1]]; onChange({ palette: arr, locks: lk });
              }}
              title="Move up"
            >↑</button>
            <button
              className="w-8 h-8 grid place-items-center rounded bg-zinc-800 border border-zinc-700"
              onClick={() => {
                if (i >= palette.length - 1) return; const arr = palette.slice(); const lk = locks.slice();
                [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; [lk[i + 1], lk[i]] = [lk[i], lk[i + 1]]; onChange({ palette: arr, locks: lk });
              }}
              title="Move down"
            >↓</button>
            <button
              className="w-8 h-8 grid place-items-center rounded bg-zinc-800 border border-zinc-700"
              onClick={() => {
                if (palette.length <= 1) return; const arr = palette.slice(); const lk = locks.slice();
                arr.splice(i, 1); lk.splice(i, 1); onChange({ palette: arr, locks: lk });
              }}
              title="Remove"
            >✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
          onClick={() => {
            if (palette.length >= 256) return; const arr = palette.slice(); const lk = locks.slice();
            arr.push('#ffffff'); lk.push(false); onChange({ palette: arr, locks: lk });
          }}
        >Add Color</button>
        <button
          className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700"
          onClick={() => onChange({ palette: ['#000000', '#ffffff'], locks: [false, false] })}
        >Reset 2-color</button>
      </div>
    </div>
  );
}
