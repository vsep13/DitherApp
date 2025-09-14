import { useStore } from '@/state/store';
import { hexToRgb } from '@/utils/color';

const vert = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
out vec2 v_uv;
void main(){
  v_uv=a_uv;
  gl_Position=vec4(a_pos,0.0,1.0);
}`;

const fragCommon = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 o;
in vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_paletteTex; // 1D texture of palette colors
uniform int u_paletteSize;
uniform int u_mode; // 0=indexed,1=rgb,2=grayscale
uniform int u_algorithm; // 0=fs,1=bayer2,2=bayer4,3=bayer8
uniform int u_pixelate; // 1..32
uniform float u_diffusionStrength;
uniform float u_thresholdBias;
uniform int u_serpentine;
uniform float u_patternScale;
uniform float u_patternAngle;
uniform sampler2D u_patternTex;
uniform vec2 u_patternSize;
uniform float u_viewScale;
uniform vec2 u_viewOffset;
uniform int u_showGrid;
uniform int u_abCompare;
uniform float u_abSplit;
// Grade
uniform float u_exposure;
uniform float u_contrast;
uniform float u_gamma;
uniform float u_saturation;
// CRT
uniform int u_crtEnabled;
uniform float u_crtScanline;
uniform float u_crtMaskStrength;
uniform int u_crtMaskType;
uniform float u_crtBarrel;
uniform float u_crtVignette;
uniform vec2 u_canvasSize;
// Glow
uniform int u_glowEnabled;
uniform float u_glowThreshold;
uniform float u_glowIntensity;
uniform float u_glowRadius;
uniform int u_glowIterations;
uniform float u_glowRGBSpread;

vec3 fetchSrc(vec2 uv){
  // Flip Y so HTML image top-left = uv(0,0)
  return texture(u_src, vec2(uv.x, 1.0 - uv.y)).rgb;
}

vec3 toGray(vec3 c){
  float y = dot(c, vec3(0.2126,0.7152,0.0722));
  return vec3(y);
}

vec3 applyGrade(vec3 c){
  // exposure
  c *= u_exposure;
  // contrast (simple pivot around 0.5 in linear space)
  c = (c - 0.5) * u_contrast + 0.5;
  // saturation in Y (BT.709 luma)
  float y = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(y), c, u_saturation);
  // gamma
  c = pow(max(c, 0.0), vec3(max(u_gamma, 0.001)));
  return clamp(c, 0.0, 1.0);
}

vec3 nearestPalette(vec3 c){
  float best=1e9; vec3 bestc=c;
  for(int i=0;i<256;i++){
    if(i>=u_paletteSize) break;
    float u=float(i)+0.5; float v=0.5;
    vec3 p=texture(u_paletteTex, vec2(u/256.0, v)).rgb;
    float d=dot(c-p,c-p);
    if(d<best){best=d;bestc=p;}
  }
  return bestc;
}

float bayer8(vec2 p){
  // 8x8 Bayer matrix normalized 0..1
  int x=int(mod(p.x,8.0));
  int y=int(mod(p.y,8.0));
  int m[64];
  m[0]=0; m[1]=48; m[2]=12; m[3]=60; m[4]=3; m[5]=51; m[6]=15; m[7]=63;
  m[8]=32; m[9]=16; m[10]=44; m[11]=28; m[12]=35; m[13]=19; m[14]=47; m[15]=31;
  m[16]=8; m[17]=56; m[18]=4; m[19]=52; m[20]=11; m[21]=59; m[22]=7; m[23]=55;
  m[24]=40; m[25]=24; m[26]=36; m[27]=20; m[28]=43; m[29]=27; m[30]=39; m[31]=23;
  m[32]=2; m[33]=50; m[34]=14; m[35]=62; m[36]=1; m[37]=49; m[38]=13; m[39]=61;
  m[40]=34; m[41]=18; m[42]=46; m[43]=30; m[44]=33; m[45]=17; m[46]=45; m[47]=29;
  m[48]=10; m[49]=58; m[50]=6; m[51]=54; m[52]=9; m[53]=57; m[54]=5; m[55]=53;
  m[56]=42; m[57]=26; m[58]=38; m[59]=22; m[60]=41; m[61]=25; m[62]=37; m[63]=21;
  int idx=y*8+x; float t=float(m[idx])/64.0; return t;
}

float bayer4(vec2 p){
  int x=int(mod(p.x,4.0));
  int y=int(mod(p.y,4.0));
  int m[16];
  m[0]=0; m[1]=8; m[2]=2; m[3]=10;
  m[4]=12; m[5]=4; m[6]=14; m[7]=6;
  m[8]=3; m[9]=11; m[10]=1; m[11]=9;
  m[12]=15; m[13]=7; m[14]=13; m[15]=5;
  int idx=y*4+x; return float(m[idx])/16.0;
}

float bayer2(vec2 p){
  int x=int(mod(p.x,2.0));
  int y=int(mod(p.y,2.0));
  int m[4]; m[0]=0; m[1]=2; m[2]=3; m[3]=1;
  int idx=y*2+x; return float(m[idx])/4.0;
}

vec2 applyView(vec2 uv){
  return (uv - 0.5) / max(u_viewScale, 1e-6) + 0.5 + u_viewOffset;
}

vec2 barrel(vec2 uv, float k){
  if(k<=0.0) return uv;
  vec2 c = uv*2.0-1.0; float r2 = dot(c,c); vec2 d = c*(1.0 + k*r2);
  return d*0.5+0.5;
}

vec3 applyCRT(vec3 c, vec2 uv){
  if(u_crtEnabled==0) return c;
  // Scanlines
  float y = uv.y * u_canvasSize.y;
  float s = 0.5 + 0.5*cos(3.14159*y);
  c *= mix(1.0, s, u_crtScanline);
  // Mask
  if(u_crtMaskType!=0){
    float x = uv.x * u_canvasSize.x;
    float phase = mod(x, 3.0);
    vec3 mask = (u_crtMaskType==1)
      ? vec3(phase<1.0?1.0:0.5, phase>=1.0&&phase<2.0?1.0:0.5, phase>=2.0?1.0:0.5)
      : vec3(mod(floor(x)+0.0,2.0), mod(floor(x)+1.0,2.0), mod(floor(x)+0.0,2.0))*0.5 + 0.5;
    c = mix(c, c*mask, u_crtMaskStrength);
  }
  // Vignette
  vec2 d = uv*2.0-1.0; float vig = 1.0 - u_crtVignette*dot(d,d);
  c *= clamp(vig, 0.0, 1.0);
  return c;
}

float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

vec3 applyGlow(vec2 uv){
  if(u_glowEnabled==0) return vec3(0.0);
  vec2 texel = 1.0 / vec2(textureSize(u_src,0));
  float radius = max(0.0, u_glowRadius);
  int iters = max(1, u_glowIterations);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for(int i=0;i<8;i++){
    if(i>=iters) break;
    float k = float(i+1);
    float off = radius * k;
    vec2 o1 = vec2(off, 0.0) * texel;
    vec2 o2 = vec2(0.0, off) * texel;
    // Per-channel fringe offsets
    vec2 fr = vec2(u_glowRGBSpread, 0.0) * texel;
    vec3 s0 = fetchSrc(uv + o1);
    vec3 s1 = fetchSrc(uv - o1);
    vec3 s2 = fetchSrc(uv + o2);
    vec3 s3 = fetchSrc(uv - o2);
    // Channel-shifted samples
    vec3 sr = fetchSrc(uv + o1 + fr);
    vec3 sg = fetchSrc(uv - o2 - fr);
    vec3 sb = fetchSrc(uv + o2 - fr);
    vec3 s = (s0+s1+s2+s3 + vec3(sr.r, sg.g, sb.b)) / 5.0;
    float m = max(0.0, luma(s) - u_glowThreshold);
    float w = 1.0 / (k*k + 1.0);
    acc += s * (m * w);
    wsum += w;
  }
  if(wsum>0.0) acc /= wsum;
  return acc * u_glowIntensity;
}

float patternThreshold(vec2 uv){
  // Map to pattern space, rotate, tile, and sample threshold texture
  vec2 dims = vec2(textureSize(u_src,0));
  vec2 p = uv * dims / max(u_patternScale, 1.0);
  float ca = cos(u_patternAngle), sa = sin(u_patternAngle);
  mat2 R = mat2(ca, -sa, sa, ca);
  vec2 q = R * p;
  vec2 tile = mod(q, u_patternSize);
  vec2 tuv = (tile + vec2(0.5)) / u_patternSize;
  return texture(u_patternTex, tuv).r;
}
`;

const fragOrdered = fragCommon + `
void main(){
  // Apply view transform
  vec2 uv=applyView(v_uv);
  uv = barrel(uv, u_crtBarrel);
  if(u_pixelate>1){
    vec2 dims=vec2(textureSize(u_src,0));
    vec2 p=uv*dims; p=floor(p/float(u_pixelate))*float(u_pixelate)+vec2(0.5);
    uv=p/dims;
  }
  vec3 c=applyGrade(fetchSrc(uv));
  if(u_mode==2){c=toGray(c);} // grayscale
  float base;
  if(u_algorithm==4){
    base = patternThreshold(uv);
  } else {
    vec2 ip = uv*vec2(textureSize(u_src,0))/u_patternScale;
    base = (u_algorithm==1? bayer2(ip) : (u_algorithm==2? bayer4(ip) : bayer8(ip)));
  }
  float t = base + u_thresholdBias*0.5; // 0..1
  // Ordered threshold per channel (or luminance if indexed)
  vec3 q;
  if(u_mode==1){ // rgb
    q=step(vec3(t), c);
  } else { // indexed or grayscale → quantize to palette
    vec3 dithered = c + (t-0.5)/255.0; // tiny perturb
    q = nearestPalette(dithered);
  }
  vec3 orig=c;
  vec3 outc = (u_abCompare==1 && v_uv.x < u_abSplit) ? orig : q;
  // Glow from source around current uv
  vec3 bloom = applyGlow(uv);
  outc = clamp(outc + bloom, 0.0, 1.0);
  outc = applyCRT(outc, v_uv);
  if(u_showGrid==1 && u_pixelate>1){
    vec2 dims=vec2(textureSize(u_src,0));
    vec2 p=uv*dims;
    vec2 f=fract(p/float(u_pixelate));
    float w = 1.0/float(u_pixelate);
    float gx = step(f.x, w) + step(1.0 - w, f.x);
    float gy = step(f.y, w) + step(1.0 - w, f.y);
    float g = clamp(gx + gy, 0.0, 1.0);
    outc = mix(outc, vec3(0.0,1.0,1.0), g*0.25);
  }
  o=vec4(outc,1.0);
}`;

const fragFS = fragCommon + `
// Simple single-pass approximation of error diffusion using precomputed noise offset to emulate scan (not exact CPU ED)
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);
}
void main(){
  vec2 dims = vec2(textureSize(u_src,0));
  vec2 uv_view = applyView(v_uv);
  vec2 p = uv_view*dims;
  if(u_pixelate>1){
    p=floor(p/float(u_pixelate))*float(u_pixelate)+vec2(0.5);
  }
  // Serpentine flip x index
  float sx = (u_serpentine==1 && int(mod(p.y,2.0))==1) ? (dims.x-1.0-p.x) : p.x;
  vec2 uv = vec2(sx, p.y)/dims;
  vec3 c = applyGrade(fetchSrc(uv));
  if(u_mode==2){c=toGray(c);} // grayscale
  // Stochastic error feedback (screen-space) to emulate FS look deterministically
  float n = rand(p + vec2(float(u_serpentine))) - 0.5;
  vec3 biased = clamp(c + n*u_diffusionStrength*0.1 + vec3(u_thresholdBias*0.1), 0.0, 1.0);
  vec3 q = (u_mode==1) ? c : nearestPalette(biased);
  vec3 outc = (u_abCompare==1 && v_uv.x < u_abSplit) ? c : q;
  vec3 bloom = applyGlow(uv);
  outc = clamp(outc + bloom, 0.0, 1.0);
  outc = applyCRT(outc, v_uv);
  if(u_showGrid==1 && u_pixelate>1){
    vec2 f=fract(p/float(u_pixelate));
    float w = 1.0/float(u_pixelate);
    float gx = step(f.x, w) + step(1.0 - w, f.x);
    float gy = step(f.y, w) + step(1.0 - w, f.y);
    float g = clamp(gx + gy, 0.0, 1.0);
    outc = mix(outc, vec3(0.0,1.0,1.0), g*0.25);
  }
  o = vec4(outc,1.0);
}`;

function createGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 not supported');
  return gl as WebGL2RenderingContext;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}

function program(gl: WebGL2RenderingContext, fsSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram()!;
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  gl.deleteShader(vs); gl.deleteShader(fs);
  return p;
}

function makeQuad(gl: WebGL2RenderingContext) {
  const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
  const vbo = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // pos(x,y), uv(x,y)
  const buf = new Float32Array([
    -1,-1, 0,0,
     1,-1, 1,0,
    -1, 1, 0,1,
     1, 1, 1,1,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  return { vao };
}

function createTexture(gl: WebGL2RenderingContext, w: number, h: number, internalFormat = gl.RGBA8) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}

function uploadImage(gl: WebGL2RenderingContext, bmp: ImageBitmap) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Keep native orientation; shader handles Y flip for consistency
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
  return tex;
}

export class GLRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private quad: { vao: WebGLVertexArrayObject; };
  private progFS: WebGLProgram;
  private progOrdered: WebGLProgram;
  private uniformsFS: Record<string, WebGLUniformLocation | null> = {};
  private uniformsOrdered: Record<string, WebGLUniformLocation | null> = {};
  private patternTex: WebGLTexture | null = null;
  private patternSz: [number, number] = [8,8];
  private srcTex: WebGLTexture | null = null;
  private paletteTex: WebGLTexture;
  private palette: Uint8Array = new Uint8Array(256 * 4);
  private paletteSize = 2;
  private raf = 0;

  constructor(canvas: HTMLCanvasElement){
    this.canvas = canvas;
    this.gl = createGL(canvas);
    this.quad = makeQuad(this.gl);
    this.progFS = program(this.gl, fragFS);
    this.progOrdered = program(this.gl, fragOrdered);
    this.initUniformCaches();
    this.paletteTex = this.createPaletteTex();
    this.setPalette(useStore.getState().palette);
    this.requestFrame();
  }

  dispose(){
    cancelAnimationFrame(this.raf);
  }

  private initUniformCaches(){
    const names = [
      'u_src','u_paletteTex','u_paletteSize','u_mode','u_algorithm','u_pixelate','u_diffusionStrength','u_thresholdBias','u_serpentine',
      'u_patternScale','u_patternAngle','u_patternTex','u_patternSize',
      'u_viewScale','u_viewOffset','u_showGrid','u_abCompare','u_abSplit',
      'u_exposure','u_contrast','u_gamma','u_saturation',
      'u_crtEnabled','u_crtScanline','u_crtMaskStrength','u_crtMaskType','u_crtBarrel','u_crtVignette','u_canvasSize',
      'u_glowEnabled','u_glowThreshold','u_glowIntensity','u_glowRadius','u_glowIterations','u_glowRGBSpread'
    ];
    const cache = (prog: WebGLProgram) => {
      const m: Record<string, WebGLUniformLocation | null> = {};
      for(const n of names){ m[n] = this.gl.getUniformLocation(prog, n); }
      return m;
    };
    this.uniformsFS = cache(this.progFS);
    this.uniformsOrdered = cache(this.progOrdered);
  }

  private createPaletteTex(){
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.palette);
    return tex;
  }

  setPalette(hexes: string[]){
    this.paletteSize = Math.min(256, Math.max(1, hexes.length));
    for(let i=0;i<256;i++){
      const hex = i<hexes.length ? hexes[i] : '#000000';
      const rgb = hexToRgb(hex);
      this.palette[i*4+0] = rgb[0];
      this.palette[i*4+1] = rgb[1];
      this.palette[i*4+2] = rgb[2];
      this.palette[i*4+3] = 255;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.palette);
    this.requestFrame();
  }

  setSource(bmp: ImageBitmap | null){
    const gl = this.gl;
    if(this.srcTex){ gl.deleteTexture(this.srcTex); this.srcTex = null; }
    if(bmp){ this.srcTex = uploadImage(gl, bmp); }
    this.requestFrame();
  }

  requestFrame(){
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.draw());
  }

  private draw(){
    const gl = this.gl;
    const { algorithm, pixelate, serpentine, diffusionStrength, thresholdBias, patternScale, mode, viewScale, viewOffset, showGrid, abCompare, abSplit } = useStore.getState();
    gl.viewport(0,0,this.canvas.width, this.canvas.height);
    gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
    if(!this.srcTex){ return; }
    const isOrdered = (algorithm==='bayer2'||algorithm==='bayer4'||algorithm==='bayer8'||algorithm==='pattern');
    const prog = isOrdered ? this.progOrdered : this.progFS;
    const uniforms = isOrdered ? this.uniformsOrdered : this.uniformsFS;
    gl.useProgram(prog);
    gl.bindVertexArray(this.quad.vao);
    // bind textures
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    if(uniforms['u_src']) gl.uniform1i(uniforms['u_src']!, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    if(uniforms['u_paletteTex']) gl.uniform1i(uniforms['u_paletteTex']!, 1);
    // uniforms
    if(uniforms['u_paletteSize']) gl.uniform1i(uniforms['u_paletteSize']!, this.paletteSize);
    if(uniforms['u_mode']) gl.uniform1i(uniforms['u_mode']!, mode==='indexed'?0: mode==='rgb'?1:2);
    const algo = algorithm==='bayer2'?1 : algorithm==='bayer4'?2 : algorithm==='bayer8'?3 : algorithm==='pattern'?4 : 0;
    if(uniforms['u_algorithm']) gl.uniform1i(uniforms['u_algorithm']!, algo);
    if(uniforms['u_pixelate']) gl.uniform1i(uniforms['u_pixelate']!, pixelate);
    if(uniforms['u_diffusionStrength']) gl.uniform1f(uniforms['u_diffusionStrength']!, diffusionStrength);
    if(uniforms['u_thresholdBias']) gl.uniform1f(uniforms['u_thresholdBias']!, thresholdBias);
    if(uniforms['u_serpentine']) gl.uniform1i(uniforms['u_serpentine']!, serpentine?1:0);
    if(uniforms['u_patternScale']) gl.uniform1f(uniforms['u_patternScale']!, Math.max(1.0, patternScale));
    if(uniforms['u_patternAngle']) gl.uniform1f(uniforms['u_patternAngle']!, useStore.getState().patternAngle);
    if(this.patternTex){
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.patternTex);
      if(uniforms['u_patternTex']) gl.uniform1i(uniforms['u_patternTex']!, 2);
      if(uniforms['u_patternSize']) gl.uniform2f(uniforms['u_patternSize']!, this.patternSz[0], this.patternSz[1]);
    }
    if(uniforms['u_viewScale']) gl.uniform1f(uniforms['u_viewScale']!, Math.max(0.01, viewScale));
    if(uniforms['u_viewOffset']) gl.uniform2f(uniforms['u_viewOffset']!, viewOffset.x, viewOffset.y);
    if(uniforms['u_showGrid']) gl.uniform1i(uniforms['u_showGrid']!, showGrid?1:0);
    if(uniforms['u_abCompare']) gl.uniform1i(uniforms['u_abCompare']!, abCompare?1:0);
    if(uniforms['u_abSplit']) gl.uniform1f(uniforms['u_abSplit']!, abSplit);
    // Grade uniforms
    const s = useStore.getState();
    if(uniforms['u_exposure']) gl.uniform1f(uniforms['u_exposure']!, s.exposure);
    if(uniforms['u_contrast']) gl.uniform1f(uniforms['u_contrast']!, s.contrast);
    if(uniforms['u_gamma']) gl.uniform1f(uniforms['u_gamma']!, s.gamma);
    if(uniforms['u_saturation']) gl.uniform1f(uniforms['u_saturation']!, s.saturation);
    // CRT uniforms
    if(uniforms['u_crtEnabled']) gl.uniform1i(uniforms['u_crtEnabled']!, useStore.getState().crtEnabled?1:0);
    if(uniforms['u_crtScanline']) gl.uniform1f(uniforms['u_crtScanline']!, useStore.getState().crtScanline);
    if(uniforms['u_crtMaskStrength']) gl.uniform1f(uniforms['u_crtMaskStrength']!, useStore.getState().crtMaskStrength);
    if(uniforms['u_crtMaskType']) gl.uniform1i(uniforms['u_crtMaskType']!, useStore.getState().crtMaskType);
    if(uniforms['u_crtBarrel']) gl.uniform1f(uniforms['u_crtBarrel']!, useStore.getState().crtBarrel);
    if(uniforms['u_crtVignette']) gl.uniform1f(uniforms['u_crtVignette']!, useStore.getState().crtVignette);
    if(uniforms['u_canvasSize']) gl.uniform2f(uniforms['u_canvasSize']!, this.canvas.width, this.canvas.height);
    // Glow uniforms
    if(uniforms['u_glowEnabled']) gl.uniform1i(uniforms['u_glowEnabled']!, useStore.getState().glowEnabled?1:0);
    if(uniforms['u_glowThreshold']) gl.uniform1f(uniforms['u_glowThreshold']!, useStore.getState().glowThreshold);
    if(uniforms['u_glowIntensity']) gl.uniform1f(uniforms['u_glowIntensity']!, useStore.getState().glowIntensity);
    if(uniforms['u_glowRadius']) gl.uniform1f(uniforms['u_glowRadius']!, useStore.getState().glowRadius);
    if(uniforms['u_glowIterations']) gl.uniform1i(uniforms['u_glowIterations']!, useStore.getState().glowIterations);
    if(uniforms['u_glowRGBSpread']) gl.uniform1f(uniforms['u_glowRGBSpread']!, useStore.getState().glowRGBSpread);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// Upload a square pattern texture (threshold values in 0..1)
export interface PatternPayload { size: number; data: Float32Array }

// Add method to GLRenderer prototype without altering class signature block
// (keeping patch minimal):
(GLRenderer as any).prototype.setPattern = function(this: GLRenderer, size: number, data: Float32Array){
  const gl = (this as any).gl as WebGL2RenderingContext;
  const tex = (this as any).patternTex || gl.createTexture()!;
  (this as any).patternTex = tex;
  const rgba = new Uint8Array(size*size*4);
  for(let i=0;i<size*size;i++){
    const v = Math.max(0, Math.min(1, data[i]));
    rgba[i*4+0] = Math.round(v*255);
    rgba[i*4+1] = 0; rgba[i*4+2] = 0; rgba[i*4+3] = 255;
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  (this as any).patternSz = [size, size];
  (this as any).requestFrame();
};
 
