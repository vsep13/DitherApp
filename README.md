# Dither Web — Prototype

A browser-based image ditherer inspired by the Dither Photoshop plugin. This prototype focuses on the core GPU pipeline, fast preview, and a minimal UI for iteration.

Status: prototype (GPU previews, CPU ED kernels, pixelate, palette editing, indexed PNG + masks, batch/image+video, unit tests)

## Tech Stack
- React + TypeScript + Vite
- WebGL2 fragment shaders (GPU-first)
- Zustand for state
- Vitest for unit tests

## Features Implemented (Prototype)
- Pixelate pre-stage (nearest) 1×–32×
- Dither modes:
  - Error diffusion (CPU): FS, JJN, Stucki, Atkinson, Burkes, Sierra lite/2-4a/3, Stevenson–Arce; serpentine + diffusion strength
  - Ordered (GPU preview): Bayer 2×2/4×4/8×8, pattern maps (clustered dot, lines, radial) with scale/angle and threshold bias
- Modes: Indexed, RGB, Grayscale (indexed quantizes to nearest palette color on-GPU)
- Palette:
  - Manual HEX list paste (up to 256 colors; target 64 for parity)
  - Live updates re-render in real-time
- UI layout: Left = Assets/Palettes, Center = Canvas, Right = Dither controls
- Export: flattened PNG, preset/state JSON, indexed PNG (embedded palette, optional transparent index), swatch masks ZIP (per-color masks + manifest)
- Batch: multi-image batch export (PNG or indexed PNG with scaling), video batch (ZIP frames or WebM/MP4 recording)
- Tests: nearest-palette selection, Bayer matrix coverage

## Roadmap to Parity (High-level)
- Error-diffusion: full 28 kernels (FS, JJN, Stucki, Atkinson, Burkes, Sierra variants, Stevenson–Arce, etc.) with serpentine and diffusion strength
- Ordered: add more pattern presets (diamond/hex/tri/spiral variants, multi-scale)
- Pattern browser (~50 presets): square/diamond/line/hex/tri, multi-scale
- Palette module: image sampling, Lospec ID/JSON import, locks, reorder/add/delete, console presets (GB, NES, C64, A2600)
- Grade stack: exposure/contrast/gamma/curves/sat/hue/HSL bands/sharpen/denoise (pre-dither)
- Spectrum glow: thresholded multi-pass bloom with chromatic spread
- CRT presets: scanlines, masks, bleed, barrel distortion, persistence
- Outputs: TIFF, 2-color SVG trace, GIF, advanced video encoding options, sequence automation
- Workers/WASM: CPU fallbacks and batch jobs using OffscreenCanvas + Web Workers; optional WASM quantization (median cut/k-means) and error diffusion
- PWA + autosave, accessibility polish, presets/examples, visual regression tests

## Getting Started
1. Install Node 18+
2. Install deps: `npm install`
3. Dev server: `npm run dev`
4. Open: http://localhost:5173

Build: `npm run build`, then `npm run preview`

## Usage
- Import an image (left panel)
- Paste a HEX palette (e.g., `#000,#fff,#00ff00,#ff00ff`)
- Adjust pixelate, algorithm, diffusion, serpentine, threshold bias, pattern scale
- Export PNG or save preset JSON from the header

## Notes on Performance
- GPU-first rendering; previews update immediately when controls change
- Palette is uploaded as a 1D texture; nearest-color search loops up to 256 entries in-shader (64 recommended for best performance). For parity, target ≤64 indexed colors.
- Pixelate stage runs on-GPU prior to dithering

## Tests
- Run `npm test`
- Covered: nearest-palette selection, Bayer 8×8 coverage

## Parity Checklist Mapping (Prototype)
- Dithering Algorithms: 2/34 implemented (FS-inspired ED, Bayer 8×8). Sliders: serpentine, diffusion, threshold bias, pattern scale
- Palette Module: manual HEX import, live updates
- Pre-Processing Grade: TODO
- Spectrum Glow: TODO
- CRT Presets: TODO
- Render Outputs: PNG (flattened), Preset JSON; TODO: indexed PNG, masks, SVG, GIF/Video
- Batch/Animation: basic batch stills + video implemented; extend with watch folders and job queue
- UI/UX: basic layout, no A/B yet; keyboard: TODO; autosave: TODO
- File Handling: image import; TODO: palette file formats (ASE/GPL/ACO), drag-drop sequences, project save/load
- Performance & Quality: GPU-first, sRGB canvas; deterministic shader path
- Accessibility & Polish: basic labels; TODO: tooltips, themes, PWA

## License
This prototype includes only original code in this repository.
