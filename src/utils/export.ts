export async function exportCanvasPNG(canvas: HTMLCanvasElement, filename = 'dither.png'){
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res as any, 'image/png'));
  if(!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(obj: any, filename = 'preset.json'){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export async function exportImageDataPNG(image: ImageData, filename = 'dither-indexed.png'){
  // Use HTMLCanvas for broadest compatibility; fall back to toDataURL if toBlob fails
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  ctx.putImageData(image, 0, 0);
  const blob: Blob | null = await new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b as Blob | null), 'image/png');
    } catch {
      resolve(null);
    }
  });
  if(blob instanceof Blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    return;
  }
  // Fallback data URL path
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename; a.click();
}
