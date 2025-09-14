export function hexToRgb(hex: string): [number, number, number]{
  const h = hex.replace('#','').trim();
  const norm = h.length === 3 ? h.split('').map(ch => ch+ch).join('') : h;
  const r = parseInt(norm.slice(0,2),16);
  const g = parseInt(norm.slice(2,4),16);
  const b = parseInt(norm.slice(4,6),16);
  return [r,g,b];
}

export function rgbToHex(r: number, g: number, b: number): string{
  const to = (v:number)=>v.toString(16).padStart(2,'0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToRgba(hex: string): [number, number, number, number]{
  const h = hex.replace('#','').trim();
  if(h.length === 4){
    // #RGBA
    const r = parseInt(h[0]+h[0], 16);
    const g = parseInt(h[1]+h[1], 16);
    const b = parseInt(h[2]+h[2], 16);
    const a = parseInt(h[3]+h[3], 16);
    return [r,g,b,a];
  }
  if(h.length === 8){
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    const a = parseInt(h.slice(6,8),16);
    return [r,g,b,a];
  }
  const [r,g,b] = hexToRgb(hex);
  return [r,g,b,255];
}
