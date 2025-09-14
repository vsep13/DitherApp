export async function fetchLospecPalette(slug: string): Promise<{ name?: string; colors: string[] }>{
  const apiUrl = `https://lospec.com/palettes/api/palette/${encodeURIComponent(slug)}`;
  const resp = await fetch(apiUrl, { mode: 'cors' });
  if(resp.ok){
    const json = await resp.json();
    const colors = (json.colors || []).map((x: string)=> x.startsWith('#')?x:'#'+x);
    return { name: json.title || json.name || slug, colors };
  }
  // Fallback to legacy endpoint if API fails
  const legacy = `https://lospec.com/palette-list/${encodeURIComponent(slug)}.json`;
  const r2 = await fetch(legacy, { mode: 'cors' });
  if(r2.ok){
    const json = await r2.json();
    const colors = (json.colors || []).map((x: string)=> x.startsWith('#')?x:'#'+x);
    return { name: json.title || json.name || slug, colors };
  }
  throw new Error(`Failed to fetch Lospec palette for slug: ${slug}`);
}

export async function resolveLospecInput(input: string): Promise<{ name?: string; colors: string[] }>{
  const src = input.trim();
  if(!src) throw new Error('Empty input');
  if(src.startsWith('{') || src.startsWith('[')){
    const json = JSON.parse(src);
    const colors = (json.colors || json.palette || []).map((x: string)=> x.startsWith('#')?x:'#'+x);
    const name = json.title || json.name;
    if(!Array.isArray(colors) || colors.length===0) throw new Error('No colors found in JSON');
    return { name, colors };
  }
  return fetchLospecPalette(src);
}

