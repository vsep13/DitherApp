export type PatternCategory = 'bayer'|'dot'|'diamond'|'lines'|'diag'|'checker'|'radial'|'spiral'|'noise';

export type PatternPreset = {
  id: string;
  name: string;
  size: number; // square NxN
  data: Float32Array; // normalized 0..1 thresholds, length = size*size
  category: PatternCategory;
};

function bayer(n: number): Float32Array {
  function build(m: number): number[][] {
    if (m === 2) return [[0,2],[3,1]];
    const prev = build(m/2);
    const out = Array.from({ length: m }, () => Array(m).fill(0));
    for(let y=0;y<m/2;y++) for(let x=0;x<m/2;x++){
      const v = prev[y][x]*4;
      out[y][x] = v;
      out[y][x+m/2] = v+2;
      out[y+m/2][x] = v+3;
      out[y+m/2][x+m/2] = v+1;
    }
    return out;
  }
  const m = build(n);
  const out = new Float32Array(n*n);
  const denom = n*n;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) out[y*n+x] = m[y][x]/denom;
  return out;
}

function clusterDot(n: number): Float32Array {
  const cx=(n-1)/2, cy=(n-1)/2;
  const coords: {x:number,y:number, d:number}[] = [];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const dx=x-cx, dy=y-cy; const d=Math.hypot(dx,dy);
    coords.push({x,y,d});
  }
  coords.sort((a,b)=>a.d-b.d);
  const out = new Float32Array(n*n);
  const denom = n*n;
  coords.forEach((p,i)=>{ out[p.y*n+p.x] = i/denom; });
  return out;
}

function diamond(n: number): Float32Array {
  const cx=(n-1)/2, cy=(n-1)/2;
  const coords: {x:number,y:number, d:number}[] = [];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const d = Math.abs(x-cx)+Math.abs(y-cy);
    coords.push({x,y,d});
  }
  coords.sort((a,b)=>a.d-b.d);
  const out = new Float32Array(n*n);
  const denom = n*n;
  coords.forEach((p,i)=>{ out[p.y*n+p.x] = i/denom; });
  return out;
}

function lines(n: number, dir: 'h'|'v'|'d1'|'d2'): Float32Array {
  const out = new Float32Array(n*n);
  const denom = n*n;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    let v = 0;
    if(dir==='h') v = y*n + x;
    else if(dir==='v') v = x*n + y;
    else if(dir==='d1') v = ((x+y)%n)*n + y; // /
    else v = ((x - y + n + n)%n)*n + y; // \
    out[y*n+x] = v/denom;
  }
  return out;
}

function linesAngle(n: number, deg: number): Float32Array {
  const out = new Float32Array(n*n);
  const rad = deg*Math.PI/180;
  const ca=Math.cos(rad), sa=Math.sin(rad);
  let min=Infinity, max=-Infinity;
  const vals:number[]=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const v = x*ca + y*sa;
    vals.push(v); if(v<min)min=v; if(v>max)max=v;
  }
  const range = max-min || 1;
  for(let i=0;i<vals.length;i++) out[i] = (vals[i]-min)/range;
  return out;
}

function radial(n: number): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2; let maxd=0;
  const dists:number[]=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const d = Math.hypot(x-cx,y-cy); dists.push(d); if(d>maxd)maxd=d;
  }
  for(let i=0;i<dists.length;i++) out[i] = dists[i]/(maxd||1);
  return out;
}

function squareRadial(n: number): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2; let maxd=0; const vals:number[]=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const d = Math.max(Math.abs(x-cx), Math.abs(y-cy)); vals.push(d); if(d>maxd)maxd=d;
  }
  for(let i=0;i<vals.length;i++) out[i] = vals[i]/(maxd||1);
  return out;
}

function diamondRadial(n: number): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2; let maxd=0; const vals:number[]=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const d = Math.abs(x-cx)+Math.abs(y-cy); vals.push(d); if(d>maxd)maxd=d;
  }
  for(let i=0;i<vals.length;i++) out[i] = vals[i]/(maxd||1);
  return out;
}

function spiral(n: number, turns=1): Float32Array {
  const out = new Float32Array(n*n);
  const cx=(n-1)/2, cy=(n-1)/2; const vals:number[]=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const dx=x-cx, dy=y-cy; const r=Math.hypot(dx,dy); const a=Math.atan2(dy,dx);
    vals.push((a+Math.PI)/(2*Math.PI) + turns*(r/(Math.SQRT2*cx||1)));
  }
  let min=Infinity, max=-Infinity; for(const v of vals){ if(v<min)min=v; if(v>max)max=v; }
  const range=max-min || 1; for(let i=0;i<vals.length;i++) out[i]=(vals[i]-min)/range;
  return out;
}

function checker(n: number, cells: number): Float32Array{
  const out = new Float32Array(n*n);
  const cell = Math.max(1, Math.floor(n/cells));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const cx = Math.floor(x/cell), cy = Math.floor(y/cell);
    const v = (cx + cy) & 1; // 0/1
    out[y*n+x] = v;
  }
  const idx = out.map((v,i)=>({v,i} as any));
  idx.sort((a:any,b:any)=>a.v-b.v);
  for(let rank=0;rank<idx.length;rank++) out[idx[rank].i] = rank/(idx.length-1);
  return out;
}

function permutedNoise(n: number, seed=1337): Float32Array{
  function hash(i:number){
    let x = (i + seed) | 0; x ^= x<<13; x ^= x>>>17; x ^= x<<5; return (x>>>0)/0xffffffff;
  }
  const out = new Float32Array(n*n); const pairs:{v:number,i:number}[]=[];
  for(let i=0;i<n*n;i++) pairs.push({v:hash(i), i});
  pairs.sort((a,b)=>a.v-b.v);
  for(let rank=0;rank<pairs.length;rank++) out[pairs[rank].i] = rank/(pairs.length-1);
  return out;
}

// Simple 8x8 blue-ish noise matrix (hand-tuned values 0..63 then normalized)
const blue8Vals = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21
];

function fromList(n: number, list: number[]): Float32Array{
  const out = new Float32Array(n*n);
  const denom = n*n;
  for(let i=0;i<list.length;i++) out[i] = list[i]/denom;
  return out;
}

export const patternPresets: PatternPreset[] = [
  { id:'bayer2', name:'Bayer 2×2', size:2, data: bayer(2), category:'bayer' },
  { id:'bayer4', name:'Bayer 4×4', size:4, data: bayer(4), category:'bayer' },
  { id:'bayer8', name:'Bayer 8×8', size:8, data: bayer(8), category:'bayer' },
  { id:'cdot3', name:'Clustered Dot 3×3', size:3, data: clusterDot(3), category:'dot' },
  { id:'cdot4', name:'Clustered Dot 4×4', size:4, data: clusterDot(4), category:'dot' },
  { id:'cdot5', name:'Clustered Dot 5×5', size:5, data: clusterDot(5), category:'dot' },
  { id:'cdot6', name:'Clustered Dot 6×6', size:6, data: clusterDot(6), category:'dot' },
  { id:'cdot7', name:'Clustered Dot 7×7', size:7, data: clusterDot(7), category:'dot' },
  { id:'cdot8', name:'Clustered Dot 8×8', size:8, data: clusterDot(8), category:'dot' },
  { id:'cdot10', name:'Clustered Dot 10×10', size:10, data: clusterDot(10), category:'dot' },
  { id:'diamond5', name:'Diamond 5×5', size:5, data: diamond(5), category:'diamond' },
  { id:'diamond7', name:'Diamond 7×7', size:7, data: diamond(7), category:'diamond' },
  { id:'diamond9', name:'Diamond 9×9', size:9, data: diamond(9), category:'diamond' },
  { id:'diamond11', name:'Diamond 11×11', size:11, data: diamond(11), category:'diamond' },
  { id:'linesH4', name:'Lines H 4×4', size:4, data: lines(4,'h'), category:'lines' },
  { id:'linesV4', name:'Lines V 4×4', size:4, data: lines(4,'v'), category:'lines' },
  { id:'linesH8', name:'Lines H 8×8', size:8, data: lines(8,'h'), category:'lines' },
  { id:'linesV8', name:'Lines V 8×8', size:8, data: lines(8,'v'), category:'lines' },
  { id:'diag1-8', name:'Diagonal / 8×8', size:8, data: lines(8,'d1'), category:'diag' },
  { id:'diag2-8', name:'Diagonal \\ 8×8', size:8, data: lines(8,'d2'), category:'diag' },
  { id:'lines15', name:'Lines 15° 16×16', size:16, data: linesAngle(16, 15), category:'lines' },
  { id:'lines30', name:'Lines 30° 16×16', size:16, data: linesAngle(16, 30), category:'lines' },
  { id:'lines45', name:'Lines 45° 16×16', size:16, data: linesAngle(16, 45), category:'lines' },
  { id:'lines60', name:'Lines 60° 16×16', size:16, data: linesAngle(16, 60), category:'lines' },
  { id:'lines75', name:'Lines 75° 16×16', size:16, data: linesAngle(16, 75), category:'lines' },
  { id:'checker4', name:'Checker 4×4', size:4, data: checker(4, 2), category:'checker' },
  { id:'checker8', name:'Checker 8×8', size:8, data: checker(8, 4), category:'checker' },
  { id:'radial6', name:'Radial 6×6', size:6, data: radial(6), category:'radial' },
  { id:'radial8', name:'Radial 8×8', size:8, data: radial(8), category:'radial' },
  { id:'square8', name:'Square Radial 8×8', size:8, data: squareRadial(8), category:'radial' },
  { id:'diamondRad8', name:'Diamond Radial 8×8', size:8, data: diamondRadial(8), category:'radial' },
  { id:'spiral8', name:'Spiral 8×8', size:8, data: spiral(8, 0.5), category:'spiral' },
  { id:'spiral12', name:'Spiral 12×12', size:12, data: spiral(12, 0.75), category:'spiral' },
  { id:'bluenoise8', name:'Blue Noise 8×8', size:8, data: fromList(8, blue8Vals), category:'noise' },
  { id:'bluenoise16', name:'Blue-ish 16×16', size:16, data: permutedNoise(16, 7), category:'noise' },
];

export function findPattern(id: string): PatternPreset | undefined{
  return patternPresets.find(p=>p.id===id);
}
