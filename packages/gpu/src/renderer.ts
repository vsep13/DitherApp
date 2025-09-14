const vert = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
out vec2 v_uv;
void main(){ v_uv=a_uv; gl_Position=vec4(a_pos,0.,1.); }
`;

const frag = `#version 300 es
precision highp float; precision highp sampler2D;
out vec4 o; in vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_paletteTex; // 1D tex 256x1 RGBA
uniform int u_paletteSize;
uniform int u_mode; // 0=indexed,1=rgb,2=grayscale
uniform int u_algorithm; // 1=bayer2,2=bayer4,3=bayer8,4=pattern
uniform int u_pixelate; // 1..32
uniform float u_thresholdBias; // -1..1
uniform float u_patternScale; // >=1
uniform float u_patternAngle; // radians
uniform sampler2D u_patternTex; uniform vec2 u_patternSize;
// Grade
uniform float u_exposure; uniform float u_contrast; uniform float u_gamma; uniform float u_saturation;
// Flags
uniform int u_applyGrade; // 1=on,0=off
uniform int u_passthrough; // 1=display only
// A/B compare
uniform int u_abCompare; // 1=on,0=off
uniform float u_abSplit; // 0..1 (coordinate in UV space)
uniform int u_abVertical; // 1=vertical split (use x), 0=horizontal (use y)

vec3 fetchSrc(vec2 uv){ return texture(u_src, vec2(uv.x, 1.0-uv.y)).rgb; }
vec3 toGray(vec3 c){ float y=dot(c, vec3(0.2126,0.7152,0.0722)); return vec3(y); }
vec3 nearestPalette(vec3 c){ float best=1e9; vec3 bestc=c; for(int i=0;i<256;i++){ if(i>=u_paletteSize) break; float u=float(i)+0.5; vec3 p=texture(u_paletteTex, vec2(u/256.0, 0.5)).rgb; float d=dot(c-p,c-p); if(d<best){ best=d; bestc=p; } } return bestc; }

vec3 applyGrade(vec3 c){
  c *= u_exposure;
  c = (c - 0.5) * u_contrast + 0.5;
  float y = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(y), c, u_saturation);
  c = pow(max(c, 0.0), vec3(max(u_gamma, 0.001)));
  return clamp(c, 0.0, 1.0);
}

float bayer2(vec2 p){ int x=int(mod(p.x,2.0)); int y=int(mod(p.y,2.0)); int m[4]; m[0]=0; m[1]=2; m[2]=3; m[3]=1; int idx=y*2+x; return float(m[idx])/4.0; }
float bayer4(vec2 p){ int x=int(mod(p.x,4.0)); int y=int(mod(p.y,4.0)); int m[16]; m[0]=0; m[1]=8; m[2]=2; m[3]=10; m[4]=12; m[5]=4; m[6]=14; m[7]=6; m[8]=3; m[9]=11; m[10]=1; m[11]=9; m[12]=15; m[13]=7; m[14]=13; m[15]=5; int idx=y*4+x; return float(m[idx])/16.0; }
float bayer8(vec2 p){ int x=int(mod(p.x,8.0)); int y=int(mod(p.y,8.0)); int m[64];
  m[0]=0; m[1]=48; m[2]=12; m[3]=60; m[4]=3; m[5]=51; m[6]=15; m[7]=63;
  m[8]=32; m[9]=16; m[10]=44; m[11]=28; m[12]=35; m[13]=19; m[14]=47; m[15]=31;
  m[16]=8; m[17]=56; m[18]=4; m[19]=52; m[20]=11; m[21]=59; m[22]=7; m[23]=55;
  m[24]=40; m[25]=24; m[26]=36; m[27]=20; m[28]=43; m[29]=27; m[30]=39; m[31]=23;
  m[32]=2; m[33]=50; m[34]=14; m[35]=62; m[36]=1; m[37]=49; m[38]=13; m[39]=61;
  m[40]=34; m[41]=18; m[42]=46; m[43]=30; m[44]=33; m[45]=17; m[46]=45; m[47]=29;
  m[48]=10; m[49]=58; m[50]=6; m[51]=54; m[52]=9; m[53]=57; m[54]=5; m[55]=53;
  m[56]=42; m[57]=26; m[58]=38; m[59]=22; m[60]=41; m[61]=25; m[62]=37; m[63]=21;
  int idx=y*8+x; return float(m[idx])/64.0; }

float patternThreshold(vec2 uv){ vec2 dims = vec2(textureSize(u_src,0)); vec2 p = uv*dims/max(u_patternScale,1.0); float ca=cos(u_patternAngle), sa=sin(u_patternAngle); mat2 R=mat2(ca,-sa,sa,ca); vec2 q=R*p; vec2 tile=mod(q, u_patternSize); vec2 tuv=(tile+vec2(0.5))/u_patternSize; return texture(u_patternTex, tuv).r; }

void main(){
  vec2 uv=v_uv; vec2 dims=vec2(textureSize(u_src,0));
  if(u_pixelate>1){ vec2 p=uv*dims; p=floor(p/float(u_pixelate))*float(u_pixelate)+vec2(0.5); uv=p/dims; }
  vec3 s = fetchSrc(uv);
  vec3 c = (u_applyGrade==1) ? applyGrade(s) : s;
  if(u_passthrough==1){ o=vec4(c,1.0); return; }
  if(u_mode==2){ c=toGray(c); }
  float base; vec2 ip=uv*dims/max(u_patternScale,1.0);
  if(u_algorithm==1) base = bayer2(ip); else if(u_algorithm==2) base=bayer4(ip); else if(u_algorithm==3) base=bayer8(ip); else base=patternThreshold(uv);
  float t = base + u_thresholdBias*0.5;
  vec3 outc; if(u_mode==1){ outc=step(vec3(t), c); } else { vec3 dithered = c + (t-0.5)/255.0; outc = nearestPalette(dithered); }
  if(u_abCompare==1){
    float coord = (u_abVertical==1) ? v_uv.x : v_uv.y;
    vec3 before = fetchSrc(uv);
    vec3 finalc = mix(outc, before, step(coord, u_abSplit));
    o = vec4(finalc, 1.0);
  } else {
    o = vec4(outc,1.0);
  }
} 
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string){ const s=gl.createShader(type)!; gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; }
function link(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string){ const vs=compile(gl,gl.VERTEX_SHADER,vsSrc); const fs=compile(gl,gl.FRAGMENT_SHADER,fsSrc); const p=gl.createProgram()!; gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p); if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)||'link'); gl.deleteShader(vs); gl.deleteShader(fs); return p; }

export type Mode = 'indexed'|'rgb'|'grayscale';
export type Algorithm = 'bayer2'|'bayer4'|'bayer8'|'pattern';

export class GLRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private vao: WebGLVertexArrayObject | null = null;
  private prog: WebGLProgram | null = null;
  private raf = 0;
  private srcTex: WebGLTexture | null = null;
  private paletteTex: WebGLTexture | null = null;
  private paletteSize = 2;
  private patternTex: WebGLTexture | null = null;
  private patternSz: [number, number] = [8,8];
  private params: { mode: Mode; algorithm: Algorithm; pixelate: number; thresholdBias: number; patternScale: number; patternAngle: number; applyGrade: boolean; passthrough: boolean; abCompare: boolean; abSplit: number; abVertical: boolean } = {
    mode: 'indexed', algorithm: 'bayer8', pixelate: 1, thresholdBias: 0, patternScale: 1, patternAngle: 0, applyGrade: true, passthrough: false,
    abCompare: false, abSplit: 0.5, abVertical: true
  };
  private grade = { exposure: 1, contrast: 1, gamma: 1, saturation: 1 };

  constructor(canvas: HTMLCanvasElement){
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if(!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.init();
    this.requestFrame();
  }

  dispose(){ cancelAnimationFrame(this.raf); const gl=this.gl; if(this.vao) gl.deleteVertexArray(this.vao); if(this.prog) gl.deleteProgram(this.prog); if(this.srcTex) gl.deleteTexture(this.srcTex); if(this.paletteTex) gl.deleteTexture(this.paletteTex); if(this.patternTex) gl.deleteTexture(this.patternTex); }
  requestFrame(){ cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(()=> this.draw()); }

  private init(){
    const gl = this.gl; const prog = link(gl, vert, frag); this.prog = prog;
    const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const buf = new Float32Array([
      -1,-1, 0,0,
       1,-1, 1,0,
      -1, 1, 0,1,
       1, 1, 1,1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    this.vao = vao;
    // palette tex
    this.paletteTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const arr = new Uint8Array(256*4); for(let i=0;i<256;i++){ arr[i*4+3]=255; } gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, arr);
  }

  setSource(bmp: ImageBitmap | null){ const gl=this.gl; if(this.srcTex){ gl.deleteTexture(this.srcTex); this.srcTex=null; } if(bmp){ const tex=gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp); this.srcTex=tex; } this.requestFrame(); }

  setPalette(hexes: string[]){ const gl=this.gl; const tex=this.paletteTex!; this.paletteSize=Math.min(256, Math.max(1, hexes.length)); const buf=new Uint8Array(256*4); for(let i=0;i<256;i++){ const hex = i<hexes.length?hexes[i]:'#000000'; const r=parseInt(hex.slice(1,3)||'00',16); const g=parseInt(hex.slice(3,5)||'00',16); const b=parseInt(hex.slice(5,7)||'00',16); buf[i*4]=r; buf[i*4+1]=g; buf[i*4+2]=b; buf[i*4+3]=255; } gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); this.requestFrame(); }

  setParams(p: Partial<typeof this.params>){ this.params = { ...this.params, ...p }; this.requestFrame(); }
  setGrade(g: Partial<typeof this.grade>){ this.grade = { ...this.grade, ...g }; this.requestFrame(); }

  setPattern(size: number, data: Float32Array){ const gl=this.gl; const tex=this.patternTex || gl.createTexture()!; this.patternTex=tex; const rgba=new Uint8Array(size*size*4); for(let i=0;i<size*size;i++){ const v=Math.max(0, Math.min(1, data[i])); const g=Math.round(v*255); rgba[i*4]=g; rgba[i*4+1]=0; rgba[i*4+2]=0; rgba[i*4+3]=255; } gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba); this.patternSz=[size,size]; this.requestFrame(); }

  // Upload ImageData directly (used for CPU preview)
  setSourceImageData(img: ImageData){ const gl=this.gl; if(this.srcTex){ gl.deleteTexture(this.srcTex); this.srcTex=null; } const tex=gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data); this.srcTex=tex; this.requestFrame(); }

  private draw(){
    const gl = this.gl; gl.viewport(0,0,this.canvas.width,this.canvas.height); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
    if(!this.prog || !this.vao || !this.srcTex) return; gl.useProgram(this.prog); gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex); gl.uniform1i(gl.getUniformLocation(this.prog,'u_src'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.paletteTex); gl.uniform1i(gl.getUniformLocation(this.prog,'u_paletteTex'), 1);
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_paletteSize'), this.paletteSize);
    const algo = this.params.algorithm==='bayer2'?1:this.params.algorithm==='bayer4'?2:this.params.algorithm==='bayer8'?3:4;
    const mode = this.params.mode==='indexed'?0:this.params.mode==='rgb'?1:2;
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_mode'), mode);
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_algorithm'), algo);
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_pixelate'), this.params.pixelate|0);
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_thresholdBias'), this.params.thresholdBias);
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_patternScale'), Math.max(1, this.params.patternScale));
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_patternAngle'), this.params.patternAngle);
    // Grade uniforms
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_exposure'), this.grade.exposure);
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_contrast'), this.grade.contrast);
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_gamma'), this.grade.gamma);
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_saturation'), this.grade.saturation);
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_applyGrade'), this.params.applyGrade?1:0);
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_passthrough'), this.params.passthrough?1:0);
    // A/B uniforms
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_abCompare'), this.params.abCompare?1:0);
    gl.uniform1f(gl.getUniformLocation(this.prog,'u_abSplit'), Math.max(0, Math.min(1, this.params.abSplit)));
    gl.uniform1i(gl.getUniformLocation(this.prog,'u_abVertical'), this.params.abVertical?1:0);
    if(this.patternTex){ gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.patternTex); gl.uniform1i(gl.getUniformLocation(this.prog,'u_patternTex'), 2); gl.uniform2f(gl.getUniformLocation(this.prog,'u_patternSize'), this.patternSz[0], this.patternSz[1]); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
