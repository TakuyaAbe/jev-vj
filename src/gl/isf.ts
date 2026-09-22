import * as THREE from 'three';
import type { Effect, RenderInput, Scene } from '../types';
import { GlContext } from './context';
import { AudioTextures, noiseTexture, updateAudioTextures } from './audio-texture';
import { copyTexture, FULLSCREEN_VERT, fullscreenCamera, fullscreenScene, makeTarget } from './fullscreen';
import { stripDirectives, type PluginMeta } from '../plugins/meta';

/**
 * ISF (Interactive Shader Format, https://isf.video) runtime on three.js.
 *
 * Supported: the JSON header, TIME / TIMEDELTA / FRAMEINDEX / RENDERSIZE / DATE /
 * PASSINDEX, inputs float / bool / long / event / color / point2D / image / audio /
 * audioFFT, multi-pass PASSES with TARGET / PERSISTENT / FLOAT / WIDTH / HEIGHT,
 * and the IMG_* macros. Generators become scenes; files with an `inputImage`
 * input (filters) become stage effects.
 *
 * Jev extension (ignored by other ISF hosts):
 *   "JEVJ": { "short": "...", "maxBars": 8, "bind": { "zoom": "bass", "amt": { "src": "intensity", "min": 0.2, "max": 1 } } }
 * Bind sources: energy sub bass mid high beatPulse beatPhase barPhase intensity onset beat
 * (bool/event: > 0.5 = true; color: "a" | "b" | "c" | "bg" | "default").
 * Without a bind, color inputs follow the palette (a, b, c, bg in order),
 * event inputs fire on the beat, and floats named after a band follow it.
 */

interface IsfInput {
  NAME: string;
  TYPE: string;
  DEFAULT?: unknown;
  MIN?: unknown;
  MAX?: unknown;
  IDENTITY?: unknown;
  VALUES?: number[];
}
interface IsfPass {
  TARGET?: string;
  PERSISTENT?: boolean | number | string;
  FLOAT?: boolean | number | string;
  WIDTH?: string | number;
  HEIGHT?: string | number;
}
export interface IsfHeader {
  ISFVSN?: string;
  NAME?: string;
  DESCRIPTION?: string;
  CREDIT?: string;
  CATEGORIES?: string[];
  INPUTS?: IsfInput[];
  PASSES?: IsfPass[];
  IMPORTED?: unknown;
  JEVJ?: PluginMeta & { bind?: Record<string, BindSpec>; palette?: boolean };
}
type BindSpec = string | { src: string; min?: number; max?: number };

type AudioKey = 'energy' | 'sub' | 'bass' | 'mid' | 'high' | 'beatPulse' | 'beatPhase' | 'barPhase' | 'intensity' | 'onset' | 'beat';
const AUDIO_KEYS = new Set<AudioKey>(['energy', 'sub', 'bass', 'mid', 'high', 'beatPulse', 'beatPhase', 'barPhase', 'intensity', 'onset', 'beat']);

function audioValue(input: RenderInput, key: AudioKey, beatEdge: boolean): number {
  switch (key) {
    case 'onset':
      return input.onset ? 1 : 0;
    case 'beat':
      return beatEdge ? 1 : 0;
    default:
      return input[key];
  }
}

const truthy = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true';

/** Split `/*{ json }*\/ glsl` and parse the JSON leniently (trailing commas, // comments). */
export function parseIsf(src: string): { header: IsfHeader; body: string } {
  const m = /^\s*\/\*([\s\S]*?)\*\//.exec(src);
  if (!m) throw new Error('ISF: JSON header comment not found');
  const json = m[1]!
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  let header: IsfHeader;
  try {
    header = JSON.parse(json) as IsfHeader;
  } catch (e) {
    throw new Error(`ISF: header JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { header, body: src.slice(m[0].length) };
}

/** Evaluate "$WIDTH/2", "floor($HEIGHT*0.5)" etc. without eval on arbitrary text. */
function evalSize(expr: string | number | undefined, vars: Record<string, number>, fallback: number): number {
  if (expr === undefined) return fallback;
  if (typeof expr === 'number') return Math.max(1, Math.round(expr));
  let e = expr.replace(/\$(\w+)/g, (_, k: string) => String(vars[k] ?? 0));
  e = e.replace(/\b(floor|ceil|round|max|min|abs|pow|sqrt)\b/g, 'Math.$1');
  if (!/^[\d\s+\-*/().,]*$/.test(e.replace(/Math\.(floor|ceil|round|max|min|abs|pow|sqrt)\b/g, ''))) return fallback;
  try {
    const v = Number(new Function(`return (${e});`)());
    return Number.isFinite(v) ? Math.max(1, Math.round(v)) : fallback;
  } catch {
    return fallback;
  }
}

/** Replace IMG_*(...) macro calls; handles nested parentheses in the coordinate argument. */
function expandImgMacros(src: string): string {
  const names = ['IMG_THIS_NORM_PIXEL', 'IMG_THIS_PIXEL', 'IMG_NORM_PIXEL', 'IMG_PIXEL', 'IMG_SIZE'];
  let out = '';
  let i = 0;
  const re = new RegExp(`\\b(${names.join('|')})\\s*\\(`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const start = m.index;
    let depth = 1;
    let j = re.lastIndex;
    const args: string[] = [];
    let argStart = j;
    for (; j < src.length && depth > 0; j++) {
      const c = src[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      if ((c === ',' && depth === 1) || depth === 0) {
        args.push(src.slice(argStart, j).trim());
        argStart = j + 1;
      }
    }
    const [img = '', coord = ''] = args;
    let rep: string;
    switch (m[1]) {
      case 'IMG_THIS_NORM_PIXEL':
      case 'IMG_THIS_PIXEL':
        rep = `texture2D(${img}, isf_FragNormCoord)`;
        break;
      case 'IMG_NORM_PIXEL':
        rep = `texture2D(${img}, ${coord})`;
        break;
      case 'IMG_PIXEL':
        rep = `texture2D(${img}, (${coord}) / _${img}_imgSize)`;
        break;
      default:
        rep = `_${img}_imgSize`;
    }
    out += src.slice(i, start) + rep;
    i = j;
    re.lastIndex = j;
  }
  return out + src.slice(i);
}

const GLSL_TYPE: Record<string, string> = {
  float: 'float',
  bool: 'bool',
  long: 'int',
  event: 'bool',
  color: 'vec4',
  point2D: 'vec2',
  image: 'sampler2D',
  audio: 'sampler2D',
  audioFFT: 'sampler2D',
};

interface Binding {
  input: IsfInput;
  apply(u: THREE.IUniform, input: RenderInput, beatEdge: boolean): void;
}

function bandHeuristic(name: string): AudioKey | null {
  const n = name.toLowerCase();
  if (/(^|_)(bass|kick|low)/.test(n)) return 'bass';
  if (/(treble|high|hat)/.test(n)) return 'high';
  if (/(^|_)mid/.test(n)) return 'mid';
  if (/(level|volume|energy|loudness)/.test(n)) return 'energy';
  if (/intensity/.test(n)) return 'intensity';
  return null;
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function makeBinding(inp: IsfInput, spec: BindSpec | undefined, paletteIdx: number, usePalette: boolean): Binding | null {
  const lo = num(inp.MIN, 0);
  const hi = num(inp.MAX, 1);
  if (inp.TYPE === 'color') {
    const which = typeof spec === 'string' ? spec : usePalette ? (['a', 'b', 'c', 'bg'] as const)[paletteIdx % 4]! : 'default';
    if (which === 'default' || !['a', 'b', 'c', 'bg'].includes(which)) return null;
    const alpha = Array.isArray(inp.DEFAULT) ? num(inp.DEFAULT[3], 1) : 1;
    const tmp = new THREE.Color();
    return {
      input: inp,
      apply(u, input) {
        // palette hex is authored in sRGB; hand it to the shader unconverted like ISF hosts do
        tmp.setStyle(input.palette[which as 'a' | 'b' | 'c' | 'bg'], THREE.LinearSRGBColorSpace);
        (u.value as THREE.Vector4).set(tmp.r, tmp.g, tmp.b, alpha);
      },
    };
  }
  if (inp.TYPE === 'event' && spec === undefined) {
    return { input: inp, apply: (u, _i, edge) => (u.value = edge) };
  }
  let src: AudioKey | null = null;
  let min = lo;
  let max = hi;
  if (typeof spec === 'string') src = AUDIO_KEYS.has(spec as AudioKey) ? (spec as AudioKey) : null;
  else if (spec) {
    src = AUDIO_KEYS.has(spec.src as AudioKey) ? (spec.src as AudioKey) : null;
    min = spec.min ?? lo;
    max = spec.max ?? hi;
  } else if (inp.TYPE === 'float') src = bandHeuristic(inp.NAME);
  if (!src) return null;
  const key = src;
  if (inp.TYPE === 'bool' || inp.TYPE === 'event') return { input: inp, apply: (u, i, e) => (u.value = audioValue(i, key, e) > 0.5) };
  if (inp.TYPE === 'long') return { input: inp, apply: (u, i, e) => (u.value = Math.round(min + (max - min) * audioValue(i, key, e))) };
  if (inp.TYPE === 'float') return { input: inp, apply: (u, i, e) => (u.value = min + (max - min) * audioValue(i, key, e)) };
  return null;
}

function defaultValue(inp: IsfInput): unknown {
  const d = inp.DEFAULT;
  switch (inp.TYPE) {
    case 'float':
      return num(d, (num(inp.MIN, 0) + num(inp.MAX, 1)) / 2);
    case 'bool':
    case 'event':
      return truthy(d);
    case 'long':
      return Math.round(num(d, inp.VALUES?.[0] ?? 0));
    case 'color': {
      const a = Array.isArray(d) ? d : [1, 1, 1, 1];
      return new THREE.Vector4(num(a[0], 1), num(a[1], 1), num(a[2], 1), num(a[3], 1));
    }
    case 'point2D': {
      const a = Array.isArray(d) ? d : [0.5, 0.5];
      return new THREE.Vector2(num(a[0], 0.5), num(a[1], 0.5));
    }
    default:
      return null;
  }
}

interface Buffer {
  name: string;
  pass: IsfPass;
  rt: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  read: 0 | 1;
}

/** One compiled ISF file. Renders into the GL canvas at the GL context's size. */
export class IsfProgram {
  readonly header: IsfHeader;
  readonly isFilter: boolean;
  readonly isTransition: boolean;
  private readonly body: string;
  private scene: THREE.Scene | null = null;
  private mat: THREE.ShaderMaterial | null = null;
  private uniforms: Record<string, THREE.IUniform> = {};
  private bindings: Binding[] = [];
  private buffers: Buffer[] = [];
  private frame = 0;
  private lastT = -1;
  private beatSeen = -1;
  error: string | null = null;

  constructor(src: string) {
    const { header, body } = parseIsf(src);
    this.header = header;
    this.body = body;
    const inputs = header.INPUTS ?? [];
    this.isFilter = inputs.some((i) => i.NAME === 'inputImage' && i.TYPE === 'image');
    this.isTransition = inputs.some((i) => i.NAME === 'startImage') && inputs.some((i) => i.NAME === 'endImage');
  }

  private build(): void {
    const h = this.header;
    const decl: string[] = [
      'uniform float TIME;',
      'uniform float TIMEDELTA;',
      'uniform int FRAMEINDEX;',
      'uniform int PASSINDEX;',
      'uniform vec2 RENDERSIZE;',
      'uniform vec4 DATE;',
      'varying vec2 isf_FragNormCoord;',
      '#define vv_FragNormCoord isf_FragNormCoord',
    ];
    const u: Record<string, THREE.IUniform> = {
      TIME: { value: 0 },
      TIMEDELTA: { value: 0 },
      FRAMEINDEX: { value: 0 },
      PASSINDEX: { value: 0 },
      RENDERSIZE: { value: new THREE.Vector2(1, 1) },
      DATE: { value: new THREE.Vector4() },
    };
    const binds = h.JEVJ?.bind ?? {};
    const usePalette = h.JEVJ?.palette !== false;
    let colorIdx = 0;
    const samplers: string[] = [];
    for (const inp of h.INPUTS ?? []) {
      const t = GLSL_TYPE[inp.TYPE];
      if (!t) continue;
      decl.push(`uniform ${t} ${inp.NAME};`);
      if (t === 'sampler2D') {
        samplers.push(inp.NAME);
        u[inp.NAME] = { value: inp.TYPE === 'audio' ? null : inp.TYPE === 'audioFFT' ? null : noiseTexture() };
        continue;
      }
      u[inp.NAME] = { value: defaultValue(inp) };
      const b = makeBinding(inp, binds[inp.NAME], inp.TYPE === 'color' ? colorIdx++ : 0, usePalette);
      if (b) this.bindings.push(b);
    }
    for (const p of h.PASSES ?? []) {
      if (!p.TARGET || samplers.includes(p.TARGET)) continue;
      samplers.push(p.TARGET);
      decl.push(`uniform sampler2D ${p.TARGET};`);
      u[p.TARGET] = { value: null };
    }
    for (const s of samplers) {
      decl.push(`uniform vec2 _${s}_imgSize;`);
      u[`_${s}_imgSize`] = { value: new THREE.Vector2(1, 1) };
    }
    this.uniforms = u;
    // some ISF files write `varying vec2 isf_FragNormCoord;` themselves; drop the duplicate
    const body = expandImgMacros(stripDirectives(this.body)).replace(/^\s*varying\s+vec2\s+(isf|vv)_FragNormCoord\s*;/gm, '');
    this.mat = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: `${decl.join('\n')}\n${body}`,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = fullscreenScene(this.mat).scene;
    this.buffers = (h.PASSES ?? [])
      .filter((p): p is IsfPass & { TARGET: string } => !!p.TARGET)
      .map((p) => ({ name: p.TARGET, pass: p, rt: [makeTarget(4, 4, truthy(p.FLOAT)), makeTarget(4, 4, truthy(p.FLOAT))], read: 0 }));
  }

  prepare(): string | null {
    if (this.error) return this.error;
    try {
      if (!this.scene) this.build();
    } catch (e) {
      return (this.error = e instanceof Error ? e.message : String(e));
    }
    this.error = GlContext.get().tryCompile(this.scene!, fullscreenCamera());
    return this.error;
  }

  reset(): void {
    this.frame = 0;
    const r = GlContext.get().renderer;
    const prev = r.getRenderTarget();
    for (const b of this.buffers) {
      for (const rt of b.rt) {
        r.setRenderTarget(rt);
        r.clear();
      }
    }
    r.setRenderTarget(prev);
  }

  /** Render all passes; the final image lands in the GL canvas. */
  render(input: RenderInput, inputImage: THREE.Texture | null): void {
    if (!this.scene) this.build();
    const gl = GlContext.get();
    const r = gl.renderer;
    const u = this.uniforms;
    const W = gl.w;
    const H = gl.h;
    const at = updateAudioTextures(input);
    const beatEdge = input.beat !== this.beatSeen;
    this.beatSeen = input.beat;
    u.TIMEDELTA!.value = this.lastT < 0 ? 0 : Math.max(0, input.t - this.lastT);
    this.lastT = input.t;
    u.TIME!.value = input.t;
    u.FRAMEINDEX!.value = this.frame++;
    const d = new Date();
    (u.DATE!.value as THREE.Vector4).set(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000);
    for (const b of this.bindings) b.apply(u[b.input.NAME]!, input, beatEdge);
    for (const inp of this.header.INPUTS ?? []) {
      if (inp.TYPE === 'audio') u[inp.NAME]!.value = at.wave;
      else if (inp.TYPE === 'audioFFT') u[inp.NAME]!.value = at.fft;
      else if (inp.TYPE === 'image' && inp.NAME === 'inputImage' && inputImage) u[inp.NAME]!.value = inputImage;
      if (GLSL_TYPE[inp.TYPE] === 'sampler2D') {
        const tex = u[inp.NAME]!.value as THREE.Texture | null;
        const img = tex?.image as { width?: number; height?: number } | undefined;
        (u[`_${inp.NAME}_imgSize`]!.value as THREE.Vector2).set(img?.width ?? W, img?.height ?? H);
      }
    }
    const vars: Record<string, number> = { WIDTH: W, HEIGHT: H };
    for (const inp of this.header.INPUTS ?? []) if (typeof u[inp.NAME]?.value === 'number') vars[inp.NAME] = u[inp.NAME]!.value as number;
    for (const b of this.buffers) {
      const w = evalSize(b.pass.WIDTH, vars, W);
      const h = evalSize(b.pass.HEIGHT, vars, H);
      for (const rt of b.rt) if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    }
    const passes = this.header.PASSES?.length ? this.header.PASSES : [{} as IsfPass];
    const bind = (): void => {
      for (const b of this.buffers) {
        u[b.name]!.value = b.rt[b.read].texture;
        (u[`_${b.name}_imgSize`]!.value as THREE.Vector2).set(b.rt[b.read].width, b.rt[b.read].height);
      }
    };
    let final: THREE.Texture | null = null;
    passes.forEach((p, idx) => {
      u.PASSINDEX!.value = idx;
      bind();
      const buf = p.TARGET ? this.buffers.find((b) => b.name === p.TARGET) : undefined;
      if (buf) {
        const write = buf.rt[buf.read === 0 ? 1 : 0];
        (u.RENDERSIZE!.value as THREE.Vector2).set(write.width, write.height);
        r.setRenderTarget(write);
        r.render(this.scene!, fullscreenCamera());
        buf.read = buf.read === 0 ? 1 : 0;
        final = write.texture;
      } else {
        (u.RENDERSIZE!.value as THREE.Vector2).set(W, H);
        r.setRenderTarget(null);
        r.render(this.scene!, fullscreenCamera());
        final = null;
      }
    });
    r.setRenderTarget(null);
    // the last pass wrote into a buffer: show it
    if (final) copyTexture(r, final);
  }
}

export interface IsfOptions {
  id: string;
  source: string;
  group?: string;
  fallbackName: string;
}

function describe(h: IsfHeader, fallbackName: string): { name: string; description: string } {
  const name = h.JEVJ?.name ?? h.NAME ?? fallbackName;
  const credit = h.CREDIT ? `（${h.CREDIT}）` : '';
  const description = h.JEVJ?.description ?? h.DESCRIPTION ?? `ISF シェーダー ${name}${credit}`;
  return { name, description };
}

export function makeIsfScene(src: string, opts: IsfOptions): Scene {
  const prog = new IsfProgram(src);
  const h = prog.header;
  const { name, description } = describe(h, opts.fallbackName);
  const scene: Scene = {
    id: h.JEVJ?.id ?? opts.id,
    name: `${name} (ISF)`,
    description,
    short: h.JEVJ?.short,
    maxBars: h.JEVJ?.maxBars,
    group: h.JEVJ?.group ?? opts.group ?? 'isf',
    source: opts.source,
    prepare: () => {
      const err = prog.prepare();
      scene.error = err ?? undefined;
      return err;
    },
    reset: () => prog.reset(),
    render(ctx, input) {
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      prog.render(input, null);
      gl.blit(ctx, input.w, input.h);
    },
  };
  if (prog.isTransition) scene.error = 'ISF transition (startImage/endImage) is not supported';
  return scene;
}

/** An ISF filter as a stage effect: the 2D stage is uploaded as `inputImage` and replaced by the result. */
export function makeIsfEffect(src: string, opts: IsfOptions): Effect {
  const prog = new IsfProgram(src);
  const h = prog.header;
  const { name, description } = describe(h, opts.fallbackName);
  let stageTex: THREE.CanvasTexture | null = null;
  const fx: Effect = {
    id: h.JEVJ?.id ?? opts.id,
    name,
    description,
    short: h.JEVJ?.short,
    source: opts.source,
    prepare: () => {
      const err = prog.prepare();
      fx.error = err ?? undefined;
      return err;
    },
    reset: () => prog.reset(),
    apply(ctx, input, amount) {
      if (amount <= 0.001) return;
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      if (!stageTex || stageTex.image !== ctx.canvas) {
        stageTex = new THREE.CanvasTexture(ctx.canvas as HTMLCanvasElement);
        stageTex.minFilter = THREE.LinearFilter;
        stageTex.generateMipmaps = false;
        stageTex.colorSpace = THREE.NoColorSpace;
      }
      stageTex.needsUpdate = true;
      prog.render(input, stageTex);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, amount);
      ctx.drawImage(gl.canvas, 0, 0, input.w, input.h);
      ctx.restore();
    },
  };
  return fx;
}

export { AudioTextures };
