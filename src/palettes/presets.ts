export type PalettePreset = { id: string; name: string; colors: string[] };

export const CONSOLE_PRESETS: PalettePreset[] = [
  {
    id: 'gameboy-4c',
    name: 'Game Boy (4-color)',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
  },
  {
    id: 'nes-54c',
    name: 'NES (subset)',
    // A compact subset of NES palette for brevity
    colors: ['#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400','#503000','#007800','#006800','#005800','#004058','#000000','#BCBCBC','#0078F8']
  },
  {
    id: 'c64-16c',
    name: 'C64 (16-color)',
    colors: ['#000000','#FFFFFF','#68372B','#70A4B2','#6F3D86','#588D43','#352879','#B8C76F','#6F4F25','#433900','#9A6759','#444444','#6C6C6C','#9AD284','#6C5EB5','#959595']
  },
  {
    id: 'atari2600-8c',
    name: 'Atari 2600 (8-color)',
    colors: ['#000000','#1A1A1A','#393939','#5B5B5B','#7E7E7E','#A2A2A2','#C7C7C7','#FFFFFF']
  },
  {
    id: 'pico8-16',
    name: 'PICO-8 (16)',
    colors: ['#000000','#1D2B53','#7E2553','#008751','#AB5236','#5F574F','#C2C3C7','#FFF1E8','#FF004D','#FFA300','#FFEC27','#00E436','#29ADFF','#83769C','#FF77A8','#FFCCAA']
  },
  {
    id: 'db16',
    name: "DawnBringer's 16",
    colors: ['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161','#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6']
  },
  {
    id: 'sweetie16',
    name: 'Sweetie 16',
    colors: ['#1a1c2c','#5d275d','#b13e53','#ef7d57','#ffcd75','#a7f070','#38b764','#257179','#29366f','#3b5dc9','#41a6f6','#73eff7','#94b0c2','#566c86','#333c57','#9badb7']
  },
  {
    id: 'endesga-32',
    name: 'ENDESGA 32',
    colors: ['#be4a2f','#d77643','#ead4aa','#e4a672','#b86f50','#733e39','#3e2731','#a22633','#e43b44','#f77622','#feae34','#fee761','#63c74d','#3e8948','#265c42','#193c3e','#124e89','#0099db','#2ce8f5','#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#181425','#ff0044','#68386c','#b55088','#f6757a','#e8b796','#c28569']
  },
  {
    id: 'cga-16',
    name: 'CGA (16)',
    colors: ['#000000','#0000AA','#00AA00','#00AAAA','#AA0000','#AA00AA','#AA5500','#AAAAAA','#555555','#5555FF','#55FF55','#55FFFF','#FF5555','#FF55FF','#FFFF55','#FFFFFF']
  },
  {
    id: 'zx-16',
    name: 'ZX Spectrum (approx 16)',
    colors: ['#000000','#0000CD','#CD0000','#CD00CD','#00CD00','#00CDCD','#CDCD00','#CDCDCD','#0000FF','#FF0000','#FF00FF','#00FF00','#00FFFF','#FFFF00','#FFFFFF','#7F7F7F']
  },
  {
    id: 'grayscale-8',
    name: 'Grayscale (8)',
    colors: ['#000000','#1f1f1f','#3f3f3f','#5f5f5f','#7f7f7f','#9f9f9f','#bfbfbf','#ffffff']
  },
  {
    id: 'pastel-8',
    name: 'Pastel (8)',
    colors: ['#ffd1dc','#ffe4e1','#e6e6fa','#d8bfd8','#c1ffc1','#c0ffff','#fffacd','#e0ffff']
  }
];
