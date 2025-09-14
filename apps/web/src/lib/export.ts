import { encodeIndexedPNGFromImage, paletteToRGBAndAlpha, indicesFromImage } from '@core/indexed';
import { makeZip, type ZipEntry, downloadZip } from './zip';
import { EDClient } from './edClient';

function downloadBlob(blob: Blob, filename: string){
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export async function exportPNGFromGL(canvas: HTMLCanvasElement, filename='dither.png', opts?: { scale?: number; background?: string }){
  const gl = canvas.getContext('webgl2'); if(!gl) return;
  const w = canvas.width, h = canvas.height; const pixels = new Uint8Array(w*h*4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // Flip vertically
  const row = w*4; for(let y=0;y<h/2;y++){ const a=y*row, b=(h-1-y)*row; for(let i=0;i<row;i++){ const t = pixels[a+i]; pixels[a+i]=pixels[b+i]; pixels[b+i]=t; } }
  const imgData = new ImageData(new Uint8ClampedArray(pixels.buffer), w, h);
  // Draw into staging canvas, then composite + scale into final
  const stage = document.createElement('canvas'); stage.width=w; stage.height=h; const sctx=stage.getContext('2d')!; sctx.putImageData(imgData, 0, 0);
  const scale = Math.max(1, Math.floor(opts?.scale || 1));
  const outW = w*scale, outH = h*scale;
  const out = document.createElement('canvas'); out.width=outW; out.height=outH; const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  if(opts?.background){ octx.fillStyle = opts.background; octx.fillRect(0,0,outW,outH); }
  octx.drawImage(stage, 0, 0, outW, outH);
  const blob: Blob | null = await new Promise((res)=> out.toBlob((b)=>res(b), 'image/png'));
  if(blob) downloadBlob(blob, filename);
}

export async function exportTIFFRGBAFromGL(canvas: HTMLCanvasElement, filename='dither-rgba.tiff', opts?: { scale?: number }){
  const gl = canvas.getContext('webgl2'); if(!gl) return;
  const w = canvas.width, h = canvas.height; const pixels = new Uint8Array(w*h*4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // Flip vertically
  const row = w*4; for(let y=0;y<h/2;y++){ const a=y*row, b=(h-1-y)*row; for(let i=0;i<row;i++){ const t = pixels[a+i]; pixels[a+i]=pixels[b+i]; pixels[b+i]=t; } }
  // Scale if needed using canvas 2D
  const scale = Math.max(1, Math.floor(opts?.scale || 1));
  let outW = w, outH = h, outData = pixels;
  if(scale !== 1){
    const stage = document.createElement('canvas'); stage.width=w; stage.height=h; const sctx=stage.getContext('2d')!; sctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), w, h), 0, 0);
    const out = document.createElement('canvas'); out.width=w*scale; out.height=h*scale; const octx=out.getContext('2d')!; octx.imageSmoothingEnabled=false; octx.drawImage(stage, 0, 0, out.width, out.height);
    const img = octx.getImageData(0, 0, out.width, out.height);
    outW = img.width; outH = img.height; outData = new Uint8Array(img.data.buffer);
  }
  const { encodeTIFFRGBA32, blobFromTIFF } = await import('@core/tiff');
  const tiff = encodeTIFFRGBA32(outW, outH, outData);
  const blob = blobFromTIFF(tiff);
  downloadBlob(blob, filename);
}

export async function exportIndexedPNGViaCPU(
  bmp: ImageBitmap,
  palette: string[],
  grade: { exposure: number; contrast: number; gamma: number; saturation: number },
  opts: { serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number; kernelName: string; scale?: number; transparentIndex?: number },
  filename='dither-indexed.png'){
  if(!palette || palette.length===0) { alert('Please provide a palette first'); return; }
  const client = new EDClient();
  try {
    const w=bmp.width, h=bmp.height;
    const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h; const tctx=tmp.getContext('2d', { willReadFrequently:true })!; tctx.drawImage(bmp,0,0);
    const src=tctx.getImageData(0,0,w,h);
    const out = await client.runED({ width:w, height:h, data: src.data, palette, serpentine: opts.serpentine, diffusionStrength: opts.diffusionStrength, thresholdBias: opts.thresholdBias, pixelate: opts.pixelate, kernelName: opts.kernelName, grade });
    // Optional scale
    const scale = Math.max(1, Math.floor(opts.scale || 1));
    let img = out;
    if(scale !== 1){
      const sc = document.createElement('canvas'); sc.width = out.width*scale; sc.height = out.height*scale;
      const sctx = sc.getContext('2d')!; sctx.imageSmoothingEnabled = false; sctx.putImageData(out, 0, 0); // draw to tmp then scale via drawImage for nearest
      const sc2 = document.createElement('canvas'); sc2.width = out.width*scale; sc2.height = out.height*scale; const sctx2 = sc2.getContext('2d')!; sctx2.imageSmoothingEnabled = false;
      sctx2.drawImage(sc, 0, 0, sc2.width, sc2.height);
      img = sctx2.getImageData(0, 0, sc2.width, sc2.height);
    }
    let blob: Blob;
    if(typeof opts.transparentIndex === 'number' && opts.transparentIndex >= 0 && opts.transparentIndex < palette.length){
      const { rgb, alpha } = paletteToRGBAndAlpha(palette);
      alpha[opts.transparentIndex] = 0;
      const idx = indicesFromImage(img, palette);
      const png = (await import('@core/png8')).encodePNG8(img.width, img.height, idx, rgb, alpha, true);
      blob = new Blob([png], { type: 'image/png' });
    } else {
      blob = encodeIndexedPNGFromImage(img, palette);
    }
    downloadBlob(blob, filename);
  } catch(err){
    console.error('Indexed export failed', err);
    alert('Indexed export failed. See console for details.');
  } finally { client.dispose(); }
}

export async function exportSwatchMasksZip(
  bmp: ImageBitmap,
  palette: string[],
  grade: { exposure: number; contrast: number; gamma: number; saturation: number },
  opts: { serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number; kernelName: string }
){
  const client = new EDClient();
  try {
    const w = bmp.width, h = bmp.height;
    const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h; const tctx=tmp.getContext('2d', { willReadFrequently: true })!; tctx.drawImage(bmp, 0, 0);
    const src=tctx.getImageData(0,0,w,h);
    const out = await client.runED({ width:w, height:h, data: src.data, palette, serpentine: opts.serpentine, diffusionStrength: opts.diffusionStrength, thresholdBias: opts.thresholdBias, pixelate: opts.pixelate, kernelName: opts.kernelName, grade });
    const idx = indicesFromImage(out, palette);
    const entries: ZipEntry[] = [];
    for(let i=0;i<palette.length && i<64;i++){
      const hex = palette[i].replace('#','');
      const mask = new Uint8Array(w*h);
      for(let p=0;p<idx.length;p++) mask[p] = (idx[p]===i) ? 1 : 0;
      const paletteRGB = new Uint8Array([0,0,0, 255,255,255]);
      const { encodePNG8 } = await import('@core/png8');
      const png = encodePNG8(w, h, mask, paletteRGB);
      entries.push({ name: `mask_${String(i).padStart(2,'0')}_${hex}.png`, data: png });
    }
    const manifest = {
      width: w,
      height: h,
      palette: palette.map((hex, i)=> ({ index: i, hex })),
      files: entries.map(e=> e.name)
    };
    entries.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
    const zip = makeZip(entries);
    downloadZip(zip, 'swatch-masks.zip');
  } finally { client.dispose(); }
}

export async function exportIndexedTIFFViaCPU(
  bmp: ImageBitmap,
  palette: string[],
  grade: { exposure: number; contrast: number; gamma: number; saturation: number },
  opts: { serpentine: boolean; diffusionStrength: number; thresholdBias: number; pixelate: number; kernelName: string; scale?: number },
  filename='dither-indexed.tiff'){
  if(!palette || palette.length===0) { alert('Please provide a palette first'); return; }
  const client = new EDClient();
  try {
    const w=bmp.width, h=bmp.height;
    const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h; const tctx=tmp.getContext('2d', { willReadFrequently:true })!; tctx.drawImage(bmp,0,0);
    const src=tctx.getImageData(0,0,w,h);
    const out = await client.runED({ width:w, height:h, data: src.data, palette, serpentine: opts.serpentine, diffusionStrength: opts.diffusionStrength, thresholdBias: opts.thresholdBias, pixelate: opts.pixelate, kernelName: opts.kernelName, grade });
    // Optional scale
    const scale = Math.max(1, Math.floor(opts.scale || 1));
    let img = out;
    if(scale !== 1){
      const sc = document.createElement('canvas'); sc.width = out.width*scale; sc.height = out.height*scale;
      const sctx = sc.getContext('2d')!; sctx.imageSmoothingEnabled = false; sctx.putImageData(out, 0, 0);
      const sc2 = document.createElement('canvas'); sc2.width = out.width*scale; sc2.height = out.height*scale; const sctx2 = sc2.getContext('2d')!; sctx2.imageSmoothingEnabled = false;
      sctx2.drawImage(sc, 0, 0, sc2.width, sc2.height);
      img = sctx2.getImageData(0, 0, sc2.width, sc2.height);
    }
    const { indicesFromImage } = await import('@core/indexed');
    const idx = indicesFromImage(img, palette);
    const { encodeTIFF8Indexed, blobFromTIFF } = await import('@core/tiff');
    const data = encodeTIFF8Indexed(img.width, img.height, idx, palette);
    const blob = blobFromTIFF(data);
    downloadBlob(blob, filename);
  } finally { client.dispose(); }
}
