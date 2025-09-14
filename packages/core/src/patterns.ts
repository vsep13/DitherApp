export type PatternPreset = {
  id: string;
  name: string;
  size: number; // NxN
  data: Float32Array; // normalized 0..1
};

function bayer(n: number): Float32Array {
  function build(m: number): number[][] {
    if (m === 2) return [[0, 2], [3, 1]];
    const prev = build(m / 2);
    const out = Array.from({ length: m }, () => Array(m).fill(0));
    for (let y = 0; y < m / 2; y++) for (let x = 0; x < m / 2; x++) {
      const v = prev[y][x] * 4;
      out[y][x] = v;
      out[y][x + m / 2] = v + 2;
      out[y + m / 2][x] = v + 3;
      out[y + m / 2][x + m / 2] = v + 1;
    }
    return out;
  }
  const m = build(n);
  const out = new Float32Array(n * n);
  const denom = n * n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = m[y][x] / denom;
  return out;
}

function clusterDot(n: number): Float32Array {
  const cx = (n - 1) / 2, cy = (n - 1) / 2;
  const pts: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - cx, y - cy);
    pts.push({ x, y, d });
  }
  pts.sort((a, b) => a.d - b.d);
  const out = new Float32Array(n * n);
  const denom = n * n;
  pts.forEach((p, i) => { out[p.y * n + p.x] = i / denom; });
  return out;
}

function linesAngle(n: number, deg: number): Float32Array {
  const out = new Float32Array(n * n);
  const rad = deg * Math.PI / 180;
  const ca = Math.cos(rad), sa = Math.sin(rad);
  let min = Infinity, max = -Infinity;
  const vals: number[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = x * ca + y * sa; vals.push(v); if (v < min) min = v; if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < vals.length; i++) out[i] = (vals[i] - min) / range;
  return out;
}

function radial(n: number): Float32Array {
  const out = new Float32Array(n * n);
  const cx = (n - 1) / 2, cy = (n - 1) / 2; let maxd = 0; const vals: number[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - cx, y - cy); vals.push(d); if (d > maxd) maxd = d;
  }
  for (let i = 0; i < vals.length; i++) out[i] = vals[i] / (maxd || 1);
  return out;
}

function normalize(out: Float32Array){
  let min=Infinity, max=-Infinity; for(let i=0;i<out.length;i++){ const v=out[i]; if(v<min) min=v; if(v>max) max=v; }
  const range = max-min || 1; for(let i=0;i<out.length;i++) out[i] = (out[i]-min)/range;
  return out;
}

function diamond(n: number): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const d = Math.abs(x-cx) + Math.abs(y-cy);
    out[y*n+x] = d;
  }
  return normalize(out);
}

function squareDot(n: number): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const d = Math.max(Math.abs(x-cx), Math.abs(y-cy));
    out[y*n+x] = d;
  }
  return normalize(out);
}

function spiral(n: number, turns=2): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2; let rmax=0; const rs=new Float32Array(n*n); const as=new Float32Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const dx=x-cx, dy=y-cy; const r=Math.hypot(dx,dy); const a=Math.atan2(dy,dx); rs[y*n+x]=r; as[y*n+x]=a; if(r>rmax) rmax=r;
  }
  const k = turns/(2*Math.PI);
  for(let i=0;i<out.length;i++){
    const r = rs[i]/(rmax||1);
    const ang = (as[i]+Math.PI); // 0..2pi
    out[i] = r + k*ang;
  }
  return normalize(out);
}

function sine(n: number, ax: 'x'|'y'|'xy'|'diag' = 'x', freq=4): Float32Array {
  const out = new Float32Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    let v=0;
    if(ax==='x') v = Math.sin(2*Math.PI*freq*x/n);
    else if(ax==='y') v = Math.sin(2*Math.PI*freq*y/n);
    else if(ax==='diag') v = Math.sin(2*Math.PI*freq*(x+y)/(2*n));
    else v = 0.5*(Math.sin(2*Math.PI*freq*x/n)+Math.sin(2*Math.PI*freq*y/n));
    out[y*n+x] = v;
  }
  return normalize(out);
}

function checker(n: number): Float32Array {
  const out = new Float32Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) out[y*n+x] = ((x^y)&1) ? 1 : 0;
  return out;
}

function grid(n: number, spacing: number): Float32Array {
  const out = new Float32Array(n*n);
  const s = Math.max(1, Math.min(n, spacing|0));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const dx = Math.min(x % s, s - (x % s));
    const dy = Math.min(y % s, s - (y % s));
    const d = Math.min(dx, dy);
    out[y*n+x] = -d; // invert so grid lines are low thresholds
  }
  return normalize(out);
}

export const patternPresets: PatternPreset[] = [
  { id: 'bayer2', name: 'Bayer 2×2', size: 2, data: bayer(2) },
  { id: 'bayer4', name: 'Bayer 4×4', size: 4, data: bayer(4) },
  { id: 'bayer8', name: 'Bayer 8×8', size: 8, data: bayer(8) },
  { id: 'cdot5', name: 'Clustered Dot 5×5', size: 5, data: clusterDot(5) },
  { id: 'cdot8', name: 'Clustered Dot 8×8', size: 8, data: clusterDot(8) },
  { id: 'lines45', name: 'Lines 45° 16×16', size: 16, data: linesAngle(16, 45) },
  { id: 'radial8', name: 'Radial 8×8', size: 8, data: radial(8) },
  // Additional presets
  { id: 'lines0', name: 'Lines 0° 16×16', size: 16, data: linesAngle(16, 0) },
  { id: 'lines90', name: 'Lines 90° 16×16', size: 16, data: linesAngle(16, 90) },
  { id: 'lines30', name: 'Lines 30° 16×16', size: 16, data: linesAngle(16, 30) },
  { id: 'lines60', name: 'Lines 60° 16×16', size: 16, data: linesAngle(16, 60) },
  { id: 'cdot12', name: 'Clustered Dot 12×12', size: 12, data: clusterDot(12) },
  { id: 'cdot16', name: 'Clustered Dot 16×16', size: 16, data: clusterDot(16) },
  { id: 'radial12', name: 'Radial 12×12', size: 12, data: radial(12) },
  { id: 'radial16', name: 'Radial 16×16', size: 16, data: radial(16) },
  { id: 'diamond8', name: 'Diamond 8×8', size: 8, data: diamond(8) },
  { id: 'diamond16', name: 'Diamond 16×16', size: 16, data: diamond(16) },
  { id: 'square8', name: 'Square 8×8', size: 8, data: squareDot(8) },
  { id: 'square16', name: 'Square 16×16', size: 16, data: squareDot(16) },
  { id: 'spiral8', name: 'Spiral 8×8', size: 8, data: spiral(8, 2) },
  { id: 'spiral16', name: 'Spiral 16×16', size: 16, data: spiral(16, 3) },
  { id: 'sineX16', name: 'Sine X 16×16', size: 16, data: sine(16, 'x', 4) },
  { id: 'sineY16', name: 'Sine Y 16×16', size: 16, data: sine(16, 'y', 4) },
  { id: 'sineDiag16', name: 'Sine Diag 16×16', size: 16, data: sine(16, 'diag', 4) },
  { id: 'sineXY16', name: 'Sine XY 16×16', size: 16, data: sine(16, 'xy', 4) },
  { id: 'checker8', name: 'Checker 8×8', size: 8, data: checker(8) },
  { id: 'grid8-4', name: 'Grid 8×8 (4px)', size: 8, data: grid(8, 4) },
  { id: 'grid16-4', name: 'Grid 16×16 (4px)', size: 16, data: grid(16, 4) },
  { id: 'grid16-8', name: 'Grid 16×16 (8px)', size: 16, data: grid(16, 8) },
];

export function findPattern(id: string): PatternPreset | undefined {
  return patternPresets.find(p => p.id === id);
}
