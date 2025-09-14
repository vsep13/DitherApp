#!/usr/bin/env node
// Fetch palettes from Lospec and write a combined JSON file.
// Usage: node scripts/fetch-lospec.js [--out presets/lospec-palettes.json] [--slugs presets/lospec-slugs.txt]

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function getArg(name, def){ const i=args.indexOf(name); return i>=0 ? args[i+1] : def; }
const outPath = getArg('--out', 'presets/lospec-palettes.json');
const slugFile = getArg('--slugs', 'presets/lospec-slugs.txt');
const concurrency = Number(getArg('--concurrency', '6')) || 6;

async function fetchLospecPalette(slug){
  const urlApi = `https://lospec.com/palettes/api/palette/${encodeURIComponent(slug)}`;
  const urlLegacy = `https://lospec.com/palette-list/${encodeURIComponent(slug)}.json`;
  let res;
  try {
    res = await fetch(urlApi, { headers: { 'accept': 'application/json' } });
    if(res.ok){
      const json = await res.json();
      return {
        slug,
        name: json.title || json.name || slug,
        author: json.author || json.user || undefined,
        colors: (json.colors||[]).map((x)=> x.startsWith('#')?x:'#'+x),
      };
    }
  } catch {}
  // Fallback
  const res2 = await fetch(urlLegacy, { headers: { 'accept': 'application/json' } });
  if(!res2.ok){ throw new Error(`Failed to fetch palette ${slug}`); }
  const json2 = await res2.json();
  return {
    slug,
    name: json2.title || json2.name || slug,
    author: json2.author || undefined,
    colors: (json2.colors||[]).map((x)=> x.startsWith('#')?x:'#'+x),
  };
}

async function main(){
  let slugs = [];
  if(fs.existsSync(slugFile)){
    const raw = fs.readFileSync(slugFile, 'utf8');
    slugs = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  } else {
    console.warn(`[warn] Slug file not found: ${slugFile}. Using a small default set.`);
    slugs = ['nyx8','endesga-32','pico-8','sweetie-16','dawnbringer-16','gb-4'];
  }
  const results = [];
  let inFlight = 0, idx = 0;
  await new Promise((resolve) => {
    const next = () => {
      if (idx >= slugs.length && inFlight === 0) return resolve();
      while (inFlight < concurrency && idx < slugs.length) {
        const slug = slugs[idx++];
        inFlight++;
        process.stdout.write(`Fetching ${slug}... `);
        fetchLospecPalette(slug)
          .then((p) => {
            results.push(p);
            console.log(`ok (${p.colors.length} colors)`);
          })
          .catch(() => console.log('failed'))
          .finally(() => { inFlight--; next(); });
      }
    };
    next();
  });
  // Sort by name then by color count
  results.sort((a,b)=> (a.name||a.slug).localeCompare(b.name||b.slug) || (a.colors.length - b.colors.length));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: results.length, palettes: results }, null, 2));
  console.log(`Wrote ${results.length} palettes to ${outPath}`);
}

main().catch((err)=>{ console.error(err); process.exit(1); });
