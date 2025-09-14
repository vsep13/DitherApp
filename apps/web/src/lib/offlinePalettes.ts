export type OfflinePalettes = {
  generatedAt?: string;
  count?: number;
  palettes: { slug: string; name: string; author?: string; colors: string[] }[];
};

export async function loadOfflinePalettes(url: string = '/lospec-palettes.json'): Promise<OfflinePalettes | null> {
  try {
    const resp = await fetch(url, { cache: 'no-cache' });
    if(!resp.ok) return null;
    const json = await resp.json();
    if(!json || !Array.isArray(json.palettes)) return null;
    return json as OfflinePalettes;
  } catch {
    return null;
  }
}

