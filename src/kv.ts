/**
 * Standalone 1:1 key visual for "bakuro domino club presents HINAMATSURI" (/kv.html).
 * Three layers: the `hina_pizza` VJ shader (background, hina-dan and petals, with its own
 * pizza switched off) rendered with slow synthetic audio values, the animated hishimochi
 * pizza (public/models/hina_pizza_anim.glb, built by blender/hina_pizza.py) rendered live
 * with three.js, and the typography drawn with Canvas 2D.
 *
 * Everything is a pure function of the KV time `t`, so the slider, `?t=`, the PNG exports
 * and the WebM recording all show the same frame.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import common from './gl/shaders/common.glsl?raw';
import pizzaFrag from './gl/shaders/hina-pizza.frag?raw';
import { makeAudioUniforms } from './gl/uniforms';

/** All copy on the visual. Bracketed values are placeholders: replace them when the line-up is fixed. */
const COPY = {
  presents: 'bakuro domino club presents',
  kana: 'ひなまつり',
  title: ['HINA', 'MATSURI'],
  tiers: [
    { role: '内裏雛 HEADLINER', names: '[DJ] × [DJ]' },
    { role: '三人官女 DJ', names: '[DJ] / [DJ] / [DJ]' },
    { role: '五人囃子 LIVE · VJ', names: '[ACT] / VJ [NAME]' },
  ],
  info: '[2027.03.0X]  [OPEN — CLOSE]  @ [VENUE]',
};

const params = new URLSearchParams(location.search);

/**
 * The 3D pizza and the loop. These are the defaults; every numeric value can be changed
 * with the controls under the frame and is mirrored in the URL (?spin=-0.5&bobs=4 ...).
 */
const PIZZA_DEFAULTS = {
  /** turns of the whole pizza per loop: 0 = still, negative = reverse; whole numbers loop seamlessly */
  spin: 1,
  /** up-and-down bobs of the pulled slice per loop; whole numbers loop seamlessly */
  bobs: 2,
  /** how high the slice lifts, as a multiple of the baked animation (0 = stays down) */
  bobHeight: 1,
  /** length of the loop and of the recorded WebM, in seconds */
  loopSeconds: 10,
  /** where the centre of the pizza sits, in design px (drag the pizza in the frame to move it) */
  x: 965,
  y: 840,
  /** diameter of the pizza in design px (the lifted slice sweeps about 26% further out); wheel / pinch over the pizza to resize */
  scale: 860,
  /** how far the camera looks down from the horizon, in degrees (the Blender hero camera: 40) */
  tilt: 40,
};
/**
 * Turn offset of the turntable in degrees. With the default spin and bobs, 65 puts the two
 * lifts at the back and the front of the pizza (in frame) and brings the slice past the
 * hina-dan and the right edge while it is down.
 */
const PIZZA_PHASE_DEG = 65;
type PizzaKey = keyof typeof PIZZA_DEFAULTS;
const TOPPINGS = ['hishimochi', 'arare', 'chirashi'] as const;
type Topping = (typeof TOPPINGS)[number];
const PIZZA = {
  ...PIZZA_DEFAULTS,
  /** one model with all three topping sets; only the chosen set is shown */
  model: '/models/hina_pizza_variants.glb',
  /** what is on the pizza (?toppings=arare). Each set is a `toppings_<v>` node on the pizza plus a `toppings_<v>_pulled` node on the lifted slice */
  toppings: 'hishimochi' as Topping,
  /** faint pink halo that lifts the pizza off the dark background (0 = none) */
  glow: 0.14,
};
for (const key of Object.keys(PIZZA_DEFAULTS) as PizzaKey[]) {
  const v = Number(params.get(key));
  if (params.has(key) && Number.isFinite(v)) PIZZA[key] = v;
}
PIZZA.loopSeconds = Math.max(1, PIZZA.loopSeconds);

/** The neon title. Also set from the controls / URL (?palette=tricolor&ignite=static&glow=1.2&flicker=0.5). */
const NEON = {
  /** 'word': HINA pink, MATSURI green. 'tricolor': pink, white, green, letter by letter */
  palette: (params.get('palette') === 'tricolor' ? 'tricolor' : 'word') as 'word' | 'tricolor',
  /** 'loop': the letters ignite one by one at the start of every loop and dim out at its end. 'static': always on */
  ignite: (params.get('ignite') === 'static' ? 'static' : 'loop') as 'loop' | 'static',
  /** glow strength (0 = tubes only) */
  glow: 1,
  /** depth of the ignition stutter, the hum and the mid-loop flicker (0 = clean fade-on, steady light) */
  flicker: 1,
  /** tube width in design px */
  tube: 7,
};
const NEON_DEFAULTS = { ...NEON };

/**
 * Where the title and the date line sit. `pos` names the pattern; switching it moves only the
 * title, and "Apply layout for this pattern" then moves the pizza, the dan and the date to match.
 * Set from the controls / URL (?titlePos=bottom&titleY=745&titleLines=one&datePos=above ...).
 */
const TITLE = {
  pos: 'top' as 'top' | 'bottom',
  /** left edge of the title and the top of its first line's capitals, in design px */
  x: 66,
  y: 116,
  /** font size in design px (shrunk automatically if a line would run off the right edge) */
  size: 172,
  /** distance between the two lines, as a multiple of the font size */
  lineGap: 0.88,
  /** 'two': HINA / MATSURI. 'one': HINAMATSURI on a single line */
  lines: 'two' as 'two' | 'one',
  /** date / venue line: at the very bottom of the frame, or just above the title */
  datePos: 'bottom' as 'bottom' | 'above',
};
const TITLE_DEFAULTS = { ...TITLE };

/**
 * The picture as layers, top to bottom in draw order. Each can be hidden or faded; this
 * applies to the preview, the PNG exports and the recording alike. In the URL: ?hide=pizza,dan
 * and ?op_pizza=80 (percent). The tier names belong to the hina-dan, not to Text.
 */
const LAYER_IDS = ['title', 'text', 'pizza', 'dan', 'petals', 'bg'] as const;
type LayerId = (typeof LAYER_IDS)[number];
const LAYERS: Record<LayerId, { visible: boolean; opacity: number }> = {
  title: { visible: true, opacity: 100 },
  text: { visible: true, opacity: 100 },
  pizza: { visible: true, opacity: 100 },
  dan: { visible: true, opacity: 100 },
  petals: { visible: true, opacity: 100 },
  bg: { visible: true, opacity: 100 },
};
/** 0..1: what a layer is drawn with (0 when hidden) */
const layerAlpha = (id: LayerId): number => (LAYERS[id].visible ? LAYERS[id].opacity / 100 : 0);
for (const key of ['glow', 'flicker'] as const) {
  const v = Number(params.get(key));
  if (params.has(key) && Number.isFinite(v)) NEON[key] = Math.max(0, v);
}
/**
 * Entrance of the hina-dan: each tier (block, shadow and text) shoots in from the left after
 * the title has lit, and all three slip back out with the neon at the end of the loop.
 * Also set from the controls / URL (?enter=static&order=bottom&delay=2.1&stagger=0.12 ...).
 */
const DAN = {
  /** 'loop': slide in every loop. 'static': always in place */
  enter: (params.get('enter') === 'static' ? 'static' : 'loop') as 'loop' | 'static',
  /** which tier comes first */
  order: (params.get('order') === 'bottom' ? 'bottom' : 'top') as 'top' | 'bottom',
  /** when the first tier starts, in seconds (the title is fully lit at about 2 s) */
  delay: 2.1,
  /** seconds between tiers */
  stagger: 0.12,
  /** seconds a tier takes to land */
  duration: 0.4,
  /** how far a tier shoots past its place before settling (0 = none, 1.7 = a classic "back" ease) */
  overshoot: 0.6,
  /** strength of the speed streaks behind a moving tier (0..1) */
  streak: 0.8,
};
const DAN_DEFAULTS = { ...DAN };
const DAN_NUMBERS = ['delay', 'stagger', 'duration', 'overshoot', 'streak'] as const;
for (const key of DAN_NUMBERS) {
  const v = Number(params.get(key));
  if (params.has(key) && Number.isFinite(v)) DAN[key] = Math.max(0, v);
}
const NEON_COLORS = {
  pink: { tube: '#ff9fbf', core: '#ffe1ea' },
  white: { tube: '#fff3d6', core: '#ffffff' },
  green: { tube: '#8ee89a', core: '#eaffea' }, // #a3d39c pushed more saturated so it reads as neon
};

const SIZE = 1080;
/** every motion in the shader repeats after this many seconds of shader time (LOOP in hina-pizza.frag) */
const SHADER_LOOP = 10;
/** hina-dan geometry in design px; mirrors DAN_* in hina-pizza.frag */
const DAN_SHAPE = { tierH: 146, treadH: 40, w0: 284 };
/**
 * Placement and shape of the hina-dan. Set from the controls / URL (?danX=250&danAlign=0 ...)
 * or by shift-dragging the dan in the frame. The defaults match the DAN_* constants in the shader.
 */
const DAN_GEO_DEFAULTS = {
  /** x of the top tier's centre (the axis of the pyramid when centred), in design px */
  x: 250,
  /** y of the top of the dan */
  y: 570,
  /** overall scale (blocks and text) */
  scale: 0.8,
  /** 0 = the tiers share a left edge, 0.5 = centred pyramid, 1 = shared right edge */
  align: 0.5,
  /** how much wider each lower tier is, per side when centred, in the dan's own px (0 = all equal) */
  step: 44,
  /** horizontal shear of the whole stack (dx per dy); 0 = upright */
  skew: 0,
};
const DAN_GEO = { ...DAN_GEO_DEFAULTS };
const DAN_GEO_PARAMS = { x: 'danX', y: 'danY', scale: 'danScale', align: 'danAlign', step: 'danStep', skew: 'danSkew' } as const;
type DanGeoKey = keyof typeof DAN_GEO_DEFAULTS;
for (const key of Object.keys(DAN_GEO_DEFAULTS) as DanGeoKey[]) {
  const v = Number(params.get(DAN_GEO_PARAMS[key]));
  if (params.has(DAN_GEO_PARAMS[key]) && Number.isFinite(v)) DAN_GEO[key] = v;
}
DAN_GEO.scale = Math.max(0.2, DAN_GEO.scale);
/** half-width in design px of tier `k` (0 = top) */
const danHalfWidth = (k: number): number => (DAN_SHAPE.w0 / 2 + k * DAN_GEO.step) * DAN_GEO.scale;
/** x in design px of the centre of tier `k`, ignoring the shear */
const danCentre = (k: number): number => DAN_GEO.x + k * DAN_GEO.step * (1 - 2 * DAN_GEO.align) * DAN_GEO.scale;
/** how far the shear pushes the stack sideways at its top and bottom, in design px */
const danLean = (): number => Math.abs(DAN_GEO.skew) * 1.5 * DAN_SHAPE.tierH * DAN_GEO.scale;

const C = { cream: '#fff3d6', gold: '#e6c45a', pink: '#ffb0c8', bg: '#1a1014' };
const DISPLAY = '"Archivo Black", "Zen Kaku Gothic New", sans-serif';
const TEXT = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const view = $<HTMLCanvasElement>('kv');
const viewCtx = view.getContext('2d')!;
const playBtn = $<HTMLButtonElement>('play');
const slider = $<HTMLInputElement>('time');
const timeLabel = $<HTMLSpanElement>('timeLabel');
const recordBtn = $<HTMLButtonElement>('record');
const noteEl = $<HTMLSpanElement>('note');
const status = $<HTMLSpanElement>('status');

// --- shader ---------------------------------------------------------------

const glCanvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
const uniforms = makeAudioUniforms();
uniforms.uHidePizza = { value: 1 }; // the three.js pizza takes its place
const danX = new THREE.Vector3();
const danStreaks = new THREE.Vector3();
const danGeo = new THREE.Vector3();
const danShape = new THREE.Vector3();
uniforms.uDanGeo = { value: danGeo };
uniforms.uDanShape = { value: danShape };
const layerHide = new THREE.Vector4();
uniforms.uLayerHide = { value: layerHide };
uniforms.uDanX = { value: danX };
uniforms.uDanStreak = { value: danStreaks };

/** how far left of its place a tier waits: far enough to hide the widest tier and its shadow */
const danOff = (): number => Math.max(200, danCentre(2) + danHalfWidth(2) + danLean() + 60);
/** time the tiers take to slip out at the end of the loop (the neon's dim-out) */
const danExit = (): number => Math.min(0.35, PIZZA.loopSeconds * 0.05);

/** x offset in design px of tier `k` (0 = top) at KV time `t`; 0 once it has landed. */
function danOffset(k: number, t: number): number {
  if (DAN.enter === 'static') return 0;
  const loop = PIZZA.loopSeconds;
  const out = danExit();
  const DAN_OFF = danOff();
  if (t > loop - out) return -DAN_OFF * ((t - (loop - out)) / out) ** 3; // accelerate away
  const start = DAN.delay + (DAN.order === 'top' ? k : 2 - k) * DAN.stagger;
  const p = (t - start) / Math.max(0.01, DAN.duration);
  if (p <= 0) return -DAN_OFF;
  if (p >= 1) return 0;
  // easeOutBack with an adjustable overshoot
  const c = DAN.overshoot;
  const e = 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
  return -DAN_OFF * (1 - e);
}

/** Streak strength of tier `k`: proportional to how fast it is moving right. */
function danStreak(k: number, t: number): number {
  const v = (danOffset(k, t + 0.008) - danOffset(k, t - 0.008)) / 0.016; // px / s
  return Math.min(1, DAN.streak) * Math.max(0, Math.min(1, v / 1400));
}
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
scene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `${common}\n${pizzaFrag}`,
      depthTest: false,
      depthWrite: false,
    }),
  ),
);
renderer.debug.onShaderError = (gl, _program, _vs, fs) => {
  status.textContent = 'shader error (see console)';
  console.error(gl.getShaderInfoLog(fs));
};

/**
 * Slow stand-in for the audio analysis: four soft beats per loop, everything periodic.
 * `t` is shader time (0..SHADER_LOOP), whatever the KV's loop length is.
 */
function setSyntheticAudio(t: number): void {
  const LOOP = SHADER_LOOP;
  const ph = (t / LOOP) * Math.PI * 2;
  const beatPhase = (t / 2.5) % 1;
  uniforms.uTime.value = t;
  uniforms.uBeatPhase.value = beatPhase;
  uniforms.uBeatPulse.value = 0.4 * Math.exp(-5 * beatPhase);
  uniforms.uBeat.value = Math.floor(t / 2.5);
  uniforms.uBarPhase.value = (t / LOOP) % 1;
  uniforms.uEnergy.value = 0.5 + 0.1 * Math.sin(ph);
  uniforms.uBass.value = 0.3 + 0.2 * Math.sin(ph + 1);
  uniforms.uMid.value = 0.3;
  uniforms.uHigh.value = 0.25 + 0.15 * Math.sin(2 * ph);
  uniforms.uIntensity.value = 0;
}

function renderShader(size: number, t: number): void {
  if (glCanvas.width !== size || glCanvas.height !== size) renderer.setSize(size, size, false);
  uniforms.uRes.value.set(size, size);
  setSyntheticAudio((t / PIZZA.loopSeconds) * SHADER_LOOP);
  danX.set(danOffset(0, t), danOffset(1, t), danOffset(2, t));
  danStreaks.set(danStreak(0, t), danStreak(1, t), danStreak(2, t));
  danGeo.set(DAN_GEO.x, DAN_GEO.y, DAN_GEO.scale);
  danShape.set(DAN_GEO.align, DAN_GEO.step, DAN_GEO.skew);
  layerHide.set(1 - layerAlpha('dan'), 1 - layerAlpha('petals'), 1 - layerAlpha('bg'), 0);
  renderer.render(scene, camera);
}

// --- typography -------------------------------------------------------------

/** Shrink `px` until `text` fits `maxW` (line-ups get longer than the placeholders). */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, px: number, family: string, maxW: number): void {
  ctx.font = `${weight} ${px}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = `${weight} ${Math.floor((px * maxW * 10) / w) / 10}px ${family}`;
}

const hash = (i: number, k: number): number => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Brightness (0..1) of title letter `i` of `n` at KV time `t`. Deterministic: the letters
 * strike in order with a stutter, hold with a slight hum, one of them flickers mid-loop,
 * and all dim out just before the loop ends so the next ignition starts from dark.
 */
function neonLevel(i: number, n: number, t: number): number {
  if (NEON.ignite === 'static') return 1;
  const loop = PIZZA.loopSeconds;
  const f = Math.min(1, NEON.flicker);
  const lit = Math.min(2, loop * 0.3); // everything is on by here
  const dur = lit * (0.1 + 0.11 * hash(i, 1)); // some letters catch faster than others
  const start = lit * 0.06 + (i / n) * lit * 0.78 + lit * 0.02 * hash(i, 2);
  const p = (t - start) / dur;
  let b: number;
  if (p < 0) b = 0;
  else if (p >= 1) b = 1;
  else if (p < 0.12) b = 0.9;
  else if (p < 0.3) b = 1 - 0.95 * f;
  else if (p < 0.45) b = 1;
  else if (p < 0.6) b = hash(i, 3) > 0.4 ? 1 - 0.9 * f : 1;
  else b = 0.7 + 0.3 * ((p - 0.6) / 0.4);
  if (f === 0 && p >= 0 && p < 1) b = p; // no stutter: a plain fade-on
  // hum
  b *= 1 - 0.035 * NEON.flicker * (0.5 + 0.5 * Math.sin(t * 41 + i * 2.3)) * (0.6 + 0.4 * Math.sin(t * 13.7 + i));
  // one letter stutters briefly in the middle of the loop
  const q = (t - loop * 0.55) / 0.3;
  if (i === Math.floor(hash(7, 7) * n) && q >= 0 && q < 1) {
    b *= q < 0.2 ? 1 - 0.85 * f : q < 0.45 ? 1 : q < 0.65 ? 1 - 0.7 * f : 1;
  }
  // quick dim-out at the end of the loop
  const out = Math.min(0.35, loop * 0.05);
  if (t > loop - out) b *= ((loop - t) / out) ** 2;
  return Math.max(0, Math.min(1, b));
}

/**
 * The title as neon signage: every letter is the stroked outline of the display face, drawn
 * as dim glass, then (scaled by its brightness) a wide glow, a tight glow and a hot core.
 * Position, size and line spacing come from TITLE. Blur radii are multiplied by `scale` by hand because
 * canvas shadows ignore the transform.
 */
function drawNeonTitle(ctx: CanvasRenderingContext2D, scale: number, t: number, alpha: number): void {
  ctx.save();
  ctx.letterSpacing = '0em';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const titlePx = TITLE.size;
  const lines = TITLE.lines === 'one' ? [COPY.title.join('')] : COPY.title;
  const firstWord = COPY.title[0]!.length; // letters before this index belong to the first word
  const room = Math.max(100, SIZE - 66 - TITLE.x);
  ctx.font = `400 ${titlePx}px ${DISPLAY}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const px = widest > room ? Math.floor((titlePx * room) / widest) : titlePx;
  ctx.font = `400 ${px}px ${DISPLAY}`;
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const total = COPY.title.join('').length;
  const cycle = [NEON_COLORS.pink, NEON_COLORS.white, NEON_COLORS.green];
  let index = 0;
  lines.forEach((line, row) => {
    const baseline = TITLE.y + row * px * TITLE.lineGap + cap;
    const letters = [...line].map((ch) => {
      const i = index++;
      const col = NEON.palette === 'tricolor' ? cycle[i % 3]! : i < firstWord ? NEON_COLORS.pink : NEON_COLORS.green;
      return { ch, col, level: neonLevel(i, total, t), x: 0 };
    });
    // lay the letters out one by one, keeping the pair kerning of the whole word
    letters.forEach((l, k) => {
      l.x = TITLE.x + ctx.measureText(line.slice(0, k + 1)).width - ctx.measureText(l.ch).width;
    });
    // light spilling onto the wall under the word
    const mean = letters.reduce((a, l) => a + l.level, 0) / letters.length;
    if (NEON.glow > 0 && mean > 0) {
      const w = ctx.measureText(line).width;
      const spillCol = NEON.palette === 'tricolor' ? NEON_COLORS.white.tube : letters[0]!.col.tube;
      ctx.save();
      ctx.translate(TITLE.x + w / 2, baseline - cap * 0.35);
      ctx.scale(1, 0.34);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.62);
      g.addColorStop(0, spillCol);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = Math.min(0.3, 0.11 * NEON.glow) * mean * alpha;
      ctx.fillStyle = g;
      ctx.fillRect(-w, -w, w * 2, w * 2);
      ctx.restore();
    }
    for (const l of letters) {
      // unlit glass: readable before ignition
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.16 * alpha;
      ctx.lineWidth = NEON.tube;
      ctx.strokeStyle = l.col.tube;
      ctx.strokeText(l.ch, l.x, baseline);
      if (l.level <= 0) continue;
      ctx.shadowColor = l.col.tube;
      if (NEON.glow > 0) {
        ctx.globalAlpha = Math.min(1, 0.55 * NEON.glow) * l.level * alpha;
        ctx.shadowBlur = 46 * scale * NEON.glow;
        ctx.strokeText(l.ch, l.x, baseline);
        ctx.shadowBlur = 16 * scale * NEON.glow;
      }
      ctx.globalAlpha = l.level * alpha;
      ctx.strokeText(l.ch, l.x, baseline);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = l.level * l.level * alpha;
      ctx.lineWidth = NEON.tube * 0.4;
      ctx.strokeStyle = l.col.core;
      ctx.strokeText(l.ch, l.x, baseline);
    }
  });
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, scale: number, t: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';
  const textAlpha = layerAlpha('text');
  const danAlpha = layerAlpha('dan');

  // top row
  ctx.globalAlpha = textAlpha;
  ctx.font = `700 22px ${TEXT}`;
  ctx.letterSpacing = '0.12em';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.cream;
  ctx.fillText(COPY.presents, 66, 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.gold;
  ctx.fillText(COPY.kana, SIZE - 66 + 22 * 0.12, 64); // undo the trailing tracking

  if (layerAlpha('title') > 0) drawNeonTitle(ctx, scale, t, layerAlpha('title'));

  // tiers: gold role tag over cream names, centred on each tier's dark front face
  ctx.textAlign = 'center';
  const ds = DAN_GEO.scale;
  ctx.save();
  ctx.globalAlpha = danAlpha; // the names go with the hina-dan layer
  // lean with the stack: the same shear about the same mid height as the shader
  const pivot = DAN_GEO.y + 1.5 * DAN_SHAPE.tierH * ds;
  ctx.translate(0, pivot);
  ctx.transform(1, 0, -DAN_GEO.skew, 1, 0, 0);
  ctx.translate(0, -pivot);
  COPY.tiers.forEach((tier, k) => {
    const off = danOffset(k, t); // the same offset the shader moves the block by
    if (danAlpha <= 0 || off <= -danOff()) return;
    const w = danHalfWidth(k) * 2;
    const cx = danCentre(k) + off;
    const top = DAN_GEO.y + (k * DAN_SHAPE.tierH + DAN_SHAPE.treadH) * ds;
    ctx.letterSpacing = '0.14em';
    ctx.fillStyle = C.gold;
    fitFont(ctx, tier.role, 700, 18 * ds, TEXT, w - 36 * ds);
    ctx.fillText(tier.role, cx + 1, top + 43 * ds);
    ctx.letterSpacing = '0.04em';
    ctx.fillStyle = C.cream;
    fitFont(ctx, tier.names, 700, 27 * ds, TEXT, w - 36 * ds);
    ctx.fillText(tier.names, cx, top + 81 * ds);
  });
  ctx.restore();

  // date / venue
  ctx.globalAlpha = textAlpha;
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0.1em';
  ctx.fillStyle = C.cream;
  fitFont(ctx, COPY.info, 700, 22, TEXT, SIZE - 144);
  ctx.fillText(COPY.info, 72, TITLE.datePos === 'above' ? TITLE.y - 28 : 1044);
  ctx.restore();
}

// --- pizza (three.js) -----------------------------------------------------------

const pizzaCanvas = document.createElement('canvas');
const pizzaRenderer = new THREE.WebGLRenderer({ canvas: pizzaCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
pizzaRenderer.setPixelRatio(1);
pizzaRenderer.setClearColor(0x000000, 0);
pizzaRenderer.toneMapping = THREE.NeutralToneMapping;
pizzaRenderer.toneMappingExposure = 1.0;
pizzaRenderer.shadowMap.enabled = true;
pizzaRenderer.shadowMap.type = THREE.PCFShadowMap;

const pizzaScene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(pizzaRenderer);
pizzaScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pizzaScene.environmentIntensity = 0.55;
// studio rig in the camera's frame, like the Blender one: key from the upper left, fill, rim
const keyLight = new THREE.DirectionalLight(0xfff4ea, 2.3);
keyLight.position.set(2.0, 4.2, 3.4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -1.7;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = 1.7;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 12;
keyLight.shadow.bias = -0.0008;
keyLight.shadow.normalBias = 0.01;
keyLight.shadow.radius = 5;
const fillLight = new THREE.DirectionalLight(0xffe6f0, 0.7);
fillLight.position.set(3.2, 2.4, -3.2);
const rimLight = new THREE.DirectionalLight(0xffd9e6, 1.0);
rimLight.position.set(-4.0, 2.6, -1.0);
pizzaScene.add(keyLight, fillLight, rimLight, new THREE.HemisphereLight(0xfff0f4, 0x3a2030, 0.5));

const PIZZA_FOV = 28.84; // the Blender hero camera's 70 mm lens on a square frame
const PIZZA_CAM_DIST = 5;
const PIZZA_AZIMUTH = THREE.MathUtils.degToRad(8);
const PIZZA_TARGET = new THREE.Vector3(0.06, 0.05, -0.06);
const pizzaCamera = new THREE.PerspectiveCamera(PIZZA_FOV, 1, 0.1, 50);

/** Feathered black disc: opaque out to `inner` (fraction of the radius), gone at the rim. */
function shadowTexture(inner: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 128 * inner, 128, 128, 128);
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    grad.addColorStop(k, `rgba(0, 0, 0, ${1 - k * k * (3 - 2 * k)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function shadowBlob(inner: number, radius: number, opacity: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const mat = new THREE.MeshBasicMaterial({ map: shadowTexture(inner), transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(radius);
  mesh.renderOrder = -1;
  return mesh;
}
const SHADOW_OPACITY = 0.6;
const groundShadow = shadowBlob(0.76, 1.22, SHADOW_OPACITY);
groundShadow.position.y = -0.004;
pizzaScene.add(groundShadow);

interface PizzaModel {
  /** the nodes of each topping set (on the pizza and on the pulled slice) */
  toppings: Record<Topping, THREE.Object3D[]>;
  mixer: THREE.AnimationMixer;
  spin: THREE.AnimationAction[];
  bob: THREE.AnimationAction[];
  duration: number;
  slice: THREE.Object3D;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  /** how far the slice rises in the baked clip */
  lift: number;
  strands: THREE.Mesh | null;
  sliceShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}
let pizza: PizzaModel | null = null;

const loadStart = performance.now();
new GLTFLoader().load(
  PIZZA.model,
  (gltf) => {
    const root = gltf.scene;
    let strands: THREE.Mesh | null = null;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (mesh.morphTargetInfluences?.length) strands = mesh;
    });
    const slice = root.getObjectByName('slice_1');
    const turntable = root.getObjectByName('pizza_root');
    if (!slice || !turntable) {
      status.textContent = 'pizza model is missing slice_1 / pizza_root';
      return;
    }
    // the three clips (turntable, slice, strand morph) share one mixer; the turntable gets its
    // own clock so spin and bobs can be set independently
    const mixer = new THREE.AnimationMixer(root);
    const spin: THREE.AnimationAction[] = [];
    const bob: THREE.AnimationAction[] = [];
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      (clip.name === 'pizza_root' ? spin : bob).push(action);
    }
    const duration = Math.max(...gltf.animations.map((c) => c.duration));
    // rest pose (bottom of the bob) and the height of the baked lift, sampled from the clip
    for (const a of bob) a.time = 0;
    mixer.update(0);
    const restPos = slice.position.clone();
    const restQuat = slice.quaternion.clone();
    for (const a of bob) a.time = duration / 4;
    mixer.update(0);
    const lift = Math.max(1e-3, slice.position.y - restPos.y);
    // a second, smaller shadow rides round under the pulled slice
    const sliceShadow = shadowBlob(0.45, 0.6, SHADOW_OPACITY);
    const out = 0.62 + Math.hypot(restPos.x, restPos.z);
    const dir = new THREE.Vector3(restPos.x, 0, restPos.z).normalize();
    sliceShadow.position.set(dir.x * out, -0.002, dir.z * out);
    turntable.add(sliceShadow);
    const phase = new THREE.Group();
    phase.rotation.y = THREE.MathUtils.degToRad(PIZZA_PHASE_DEG);
    phase.add(root);
    pizzaScene.add(phase);
    root.getObjectByName('light_rig')?.removeFromParent(); // the page has its own lights
    const toppings = Object.fromEntries(
      TOPPINGS.map((v) => [v, [`toppings_${v}`, `toppings_${v}_pulled`].map((n) => root.getObjectByName(n)).filter((o) => o !== undefined)]),
    ) as Record<Topping, THREE.Object3D[]>;
    pizza = { mixer, spin, bob, duration, slice, restPos, restQuat, lift, strands, sliceShadow, toppings };
    const ms = Math.round(performance.now() - loadStart);
    document.documentElement.dataset.pizza = `ready ${ms}ms`;
    console.info(`[kv] pizza model ready in ${ms} ms`);
  },
  undefined,
  () => (status.textContent = `could not load ${PIZZA.model}`),
);

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Pose the model for KV time `t`: clip times come from t and the settings, never from a clock. */
function posePizza(t: number): void {
  if (!pizza) return;
  const { mixer, duration, slice, restPos, restQuat } = pizza;
  // show the chosen topping set only (both of its nodes); switching needs no reload
  for (const v of TOPPINGS) for (const node of pizza.toppings[v]) node.visible = v === PIZZA.toppings;
  const u = t / PIZZA.loopSeconds;
  for (const a of pizza.spin) a.time = mod(u * PIZZA.spin * duration, duration);
  // the clip holds two bobs, so bobs / 2 passes through it per loop
  for (const a of pizza.bob) a.time = mod(u * (PIZZA.bobs / 2) * duration, duration);
  mixer.update(0);
  // bobHeight scales the slice's offset from its rest pose and the strand stretch with it,
  // so the strands stay attached at both ends
  const h = PIZZA.bobHeight;
  if (h !== 1) {
    slice.position.sub(restPos).multiplyScalar(h).add(restPos);
    slice.quaternion.copy(restQuat.clone().slerp(slice.quaternion, h));
    const w = pizza.strands?.morphTargetInfluences;
    if (w) w[0] = (w[0] ?? 0) * h;
  }
  // higher slice: smaller, fainter shadow
  const up = THREE.MathUtils.clamp((slice.position.y - restPos.y) / pizza.lift, 0, 1.6);
  pizza.sliceShadow.scale.setScalar(0.6 - 0.1 * up);
  pizza.sliceShadow.material.opacity = SHADOW_OPACITY * Math.max(0.2, 1 - 0.5 * up);
}

/** Render the pizza layer at `size` px, natively (the view offset does the layout). */
function renderPizza(size: number, t: number): boolean {
  if (!pizza) return false;
  if (pizzaCanvas.width !== size || pizzaCanvas.height !== size) pizzaRenderer.setSize(size, size, false);
  posePizza(t);
  const el = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(PIZZA.tilt, 5, 89));
  pizzaCamera.position
    .set(Math.cos(el) * Math.cos(PIZZA_AZIMUTH), Math.sin(el), -Math.cos(el) * Math.sin(PIZZA_AZIMUTH))
    .multiplyScalar(PIZZA_CAM_DIST)
    .add(PIZZA_TARGET);
  pizzaCamera.lookAt(PIZZA_TARGET);
  // a virtual square frame with the pizza in its centre; the KV is a window onto it
  const k = size / SIZE;
  const full = PIZZA.scale * PIZZA_CAM_DIST * Math.tan(THREE.MathUtils.degToRad(PIZZA_FOV / 2));
  pizzaCamera.setViewOffset(full * k, full * k, (full / 2 - PIZZA.x) * k, (full / 2 - PIZZA.y) * k, size, size);
  pizzaRenderer.render(pizzaScene, pizzaCamera);
  return true;
}

function drawPizza(ctx: CanvasRenderingContext2D, size: number, t: number): void {
  const alpha = layerAlpha('pizza');
  if (alpha <= 0 || !renderPizza(size, t)) return; // hidden: no three.js render, no contact shadows
  ctx.save();
  ctx.globalAlpha = alpha;
  if (PIZZA.glow > 0) {
    // canvas shadows ignore the transform, so the blur is scaled by hand
    ctx.shadowColor = `rgba(255, 176, 200, ${PIZZA.glow})`;
    ctx.shadowBlur = (70 * size) / SIZE;
  }
  ctx.drawImage(pizzaCanvas, 0, 0, size, size);
  ctx.restore();
}

/** Shader, pizza and text into `ctx` at `size` px. */
function composite(ctx: CanvasRenderingContext2D, size: number, t: number): void {
  renderShader(size, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(glCanvas, 0, 0, size, size);
  drawPizza(ctx, size, t);
  drawText(ctx, size / SIZE, t);
}

// --- controls ---------------------------------------------------------------

let t = mod(Number(params.get('t')) || 0, PIZZA.loopSeconds);
let playing = !params.has('t') && params.get('paused') !== '1';
let recording = false;
let exporting = false;
let last = performance.now();
/** settings are frozen while a file is being written */
const busy = (): boolean => recording || exporting;

/** One setting in the panel: knows its URL param, its default and how to redraw itself. */
interface Control {
  param: string;
  isDefault(): boolean;
  value(): string;
  /** the default, as it would appear in a URL or a preset */
  def(): string;
  refresh(): void;
  reset(): void;
  /** set from a URL / preset string; undefined or junk falls back to the default */
  load(v: string | undefined): void;
  /** kept out of the URL under its own name (layer visibility travels as ?hide=a,b) */
  urlSkip?: boolean;
}
const controls: Control[] = [];

/** Mirror every setting that differs from its default (and the frame, when paused) in the URL. */
function syncUrl(): void {
  const q = new URLSearchParams();
  for (const c of controls) if (!c.urlSkip && !c.isDefault()) q.set(c.param, c.value());
  const hidden = LAYER_IDS.filter((id) => !LAYERS[id].visible);
  if (hidden.length) q.set('hide', hidden.join(','));
  if (!playing) q.set('t', t.toFixed(2));
  const qs = q.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
}

function syncControls(): void {
  slider.max = String(PIZZA.loopSeconds);
  slider.value = t.toFixed(2);
  timeLabel.textContent = `${t.toFixed(2)}s`;
  playBtn.textContent = playing ? 'Pause' : 'Play';
  if (!recording) recordBtn.textContent = `Record ${PIZZA.loopSeconds}s WebM`;
  const loose = [
    ...(Number.isInteger(PIZZA.spin) ? [] : ['回転 spin']),
    ...(Number.isInteger(PIZZA.bobs) ? [] : ['上下 bobs']),
  ];
  noteEl.textContent = loose.length
    ? `${loose.join(' / ')} が整数でないため、ループの継ぎ目で動きが飛びます (not a whole number: the loop will jump at the seam)`
    : '';
}

/** After any setting changes: keep t inside the loop, refresh the transport and the URL. */
function changed(): void {
  t = mod(t, PIZZA.loopSeconds);
  syncControls();
  syncUrl();
  renderPresets();
}

const bind = <T, K extends keyof T>(o: T, k: K): { get: () => T[K]; set: (v: T[K]) => void } => ({
  get: () => o[k],
  set: (v) => {
    o[k] = v;
  },
});

/** Label cell: Japanese name + English hint, a dot when changed, double-click to reset. */
function nameCell(ja: string, en: string, onReset: () => void): HTMLSpanElement {
  const name = document.createElement('span');
  name.className = 'name';
  const dot = document.createElement('i');
  dot.className = 'dot';
  const hint = document.createElement('small');
  hint.textContent = en;
  name.append(dot, ja, ' ', hint);
  name.addEventListener('dblclick', (e) => {
    e.preventDefault();
    onReset();
  });
  return name;
}

interface NumSpec {
  mount: string;
  param: string;
  get: () => number;
  set: (v: number) => void;
  def: number;
  ja: string;
  en: string;
  /** tooltip: what it does and what it means for the loop */
  title: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** snap to whole numbers unless "fine" is on; then this is the step */
  fineStep?: number;
}

/** A range slider with an editable readout, its unit, and (for snapping values) a fine toggle. */
function num(spec: NumSpec): void {
  const row = document.createElement('div');
  row.className = 'ctl';
  row.title = `${spec.title}\n(ラベルをダブルクリックで初期値 ${spec.def} に戻す / double-click the label to reset)`;
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(spec.min);
  range.max = String(spec.max);
  const box = document.createElement('input');
  box.type = 'number';
  box.className = 'val';
  box.min = String(spec.min);
  box.max = String(spec.max);
  const unit = document.createElement('span');
  unit.className = 'unit';
  unit.textContent = spec.unit;
  let fine = spec.fineStep !== undefined && !Number.isInteger(spec.get());
  const fineBox = document.createElement('input');
  fineBox.type = 'checkbox';
  const stepNow = (): number => (spec.fineStep === undefined ? spec.step : fine ? spec.fineStep : 1);
  const refresh = (): void => {
    range.step = box.step = String(stepNow());
    range.value = box.value = String(spec.get());
    fineBox.checked = fine;
    row.classList.toggle('changed', spec.get() !== spec.def);
  };
  const apply = (raw: number): void => {
    if (busy() || !Number.isFinite(raw)) {
      refresh();
      return;
    }
    const st = stepNow();
    const v = THREE.MathUtils.clamp(Math.round(raw / st) * st, spec.min, spec.max);
    spec.set(Number(v.toFixed(4)));
    refresh();
    changed();
  };
  const reset = (): void => {
    if (busy()) return;
    fine = false;
    spec.set(spec.def);
    refresh();
  };
  range.addEventListener('input', () => apply(Number(range.value)));
  box.addEventListener('change', () => {
    const v = Number(box.value);
    // a typed fraction on a snapping control switches "fine" on instead of being rounded away
    if (spec.fineStep !== undefined && box.value !== '' && !Number.isInteger(v)) fine = true;
    apply(box.value === '' ? spec.get() : v);
  });
  row.append(
    nameCell(spec.ja, spec.en, () => {
      reset();
      changed();
    }),
    range,
    box,
    unit,
  );
  if (spec.fineStep !== undefined) {
    const lab = document.createElement('label');
    lab.className = 'fine';
    lab.title = '小数を許可（ループの継ぎ目が合わなくなります） / allow fractions (the loop will no longer be seamless)';
    fineBox.addEventListener('change', () => {
      fine = fineBox.checked;
      apply(spec.get());
    });
    lab.append(fineBox, '微調整 fine');
    row.classList.add('snap');
    row.append(lab);
  }
  const load = (v: string | undefined): void => {
    const n = v === undefined || v === '' ? spec.def : Number(v);
    const ok = Number.isFinite(n);
    fine = spec.fineStep !== undefined && ok && !Number.isInteger(n);
    spec.set(ok ? THREE.MathUtils.clamp(n, spec.min, spec.max) : spec.def);
    refresh();
  };
  $(spec.mount).append(row);
  controls.push({ param: spec.param, isDefault: () => spec.get() === spec.def, value: () => String(spec.get()), def: () => String(spec.def), refresh, reset, load });
  if (params.has(spec.param)) load(params.get(spec.param) ?? undefined);
  else refresh();
}

/** An either / or setting as segmented buttons. */
function choice<V extends string>(spec: {
  mount: string;
  param: string;
  get: () => V;
  set: (v: V) => void;
  def: V;
  ja: string;
  en: string;
  title: string;
  options: [V, string][];
  /** runs after the user picks an option, before the URL is updated */
  after?: () => void;
}): void {
  const row = document.createElement('div');
  row.className = 'ctl choice';
  row.title = `${spec.title}\n(ラベルをダブルクリックで初期値に戻す / double-click the label to reset)`;
  const seg = document.createElement('div');
  seg.className = 'seg';
  const buttons = spec.options.map(([value, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (busy()) return;
      spec.set(value);
      refresh();
      spec.after?.();
      changed();
    });
    seg.append(b);
    return { value, b };
  });
  const refresh = (): void => {
    for (const { value, b } of buttons) b.classList.toggle('on', value === spec.get());
    row.classList.toggle('changed', spec.get() !== spec.def);
  };
  const reset = (): void => {
    if (busy()) return;
    spec.set(spec.def);
    refresh();
  };
  row.append(
    nameCell(spec.ja, spec.en, () => {
      reset();
      changed();
    }),
    seg,
  );
  const load = (v: string | undefined): void => {
    const hit = spec.options.find(([value]) => value === v);
    spec.set(hit ? hit[0] : spec.def);
    refresh();
  };
  $(spec.mount).append(row);
  controls.push({ param: spec.param, isDefault: () => spec.get() === spec.def, value: () => spec.get(), def: () => spec.def, refresh, reset, load });
  if (params.has(spec.param)) load(params.get(spec.param) ?? undefined);
  else refresh();
}

// レイヤー Layers: eye toggle + opacity per layer, listed in draw order
const EYE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path class="slash" d="M4 20L20 4" stroke="currentColor" stroke-width="2"/></svg>';
function layerRow(id: LayerId, ja: string, en: string, note: string, section: string | null): void {
  const L = LAYERS[id];
  const row = document.createElement('div');
  row.className = 'layer';
  const eye = document.createElement('button');
  eye.type = 'button';
  eye.className = 'eye';
  eye.innerHTML = EYE;
  const name = document.createElement('button');
  name.type = 'button';
  name.className = 'lname';
  const hint = document.createElement('small');
  hint.textContent = en;
  name.append(ja, ' ', hint);
  name.title = section ? `${note}\nクリックでこのレイヤーの設定へ / click to jump to this layer's settings` : `${note}\n(このレイヤーに個別の設定はありません / this layer has no settings of its own)`;
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.step = '1';
  range.title = '不透明度 / opacity';
  const box = document.createElement('input');
  box.type = 'number';
  box.className = 'val';
  box.min = '0';
  box.max = '100';
  const unit = document.createElement('span');
  unit.className = 'unit';
  unit.textContent = '%';
  const refresh = (): void => {
    row.classList.toggle('off', !L.visible);
    row.classList.toggle('changed', !L.visible || L.opacity !== 100);
    eye.title = L.visible ? '表示中。クリックで隠す / shown; click to hide' : '非表示。クリックで表示 / hidden; click to show';
    eye.setAttribute('aria-pressed', String(L.visible));
    range.value = box.value = String(L.opacity);
  };
  const setOpacity = (raw: number): void => {
    if (!busy() && Number.isFinite(raw)) L.opacity = THREE.MathUtils.clamp(Math.round(raw), 0, 100);
    refresh();
    changed();
  };
  eye.addEventListener('click', () => {
    if (busy()) return;
    L.visible = !L.visible;
    refresh();
    changed();
  });
  name.addEventListener('click', () => {
    if (!section) return;
    const target = $<HTMLDetailsElement>(section);
    target.open = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  range.addEventListener('input', () => setOpacity(Number(range.value)));
  box.addEventListener('change', () => setOpacity(box.value === '' ? L.opacity : Number(box.value)));
  row.append(eye, name, range, box, unit);
  $('m-layers').append(row);
  controls.push({
    param: `vis_${id}`,
    urlSkip: true,
    isDefault: () => L.visible,
    value: () => (L.visible ? '1' : '0'),
    def: () => '1',
    refresh,
    reset: () => {
      if (!busy()) L.visible = true;
      refresh();
    },
    load: (v) => {
      L.visible = v !== '0';
      refresh();
    },
  });
  const loadOpacity = (v: string | undefined): void => {
    const n = Number(v);
    L.opacity = v === undefined || v === '' || !Number.isFinite(n) ? 100 : THREE.MathUtils.clamp(Math.round(n), 0, 100);
    refresh();
  };
  controls.push({
    param: `op_${id}`,
    isDefault: () => L.opacity === 100,
    value: () => String(L.opacity),
    def: () => '100',
    refresh,
    reset: () => {
      if (!busy()) L.opacity = 100;
      refresh();
    },
    load: loadOpacity,
  });
  if (params.has(`op_${id}`)) loadOpacity(params.get(`op_${id}`) ?? undefined);
  if ((params.get('hide') ?? '').split(',').includes(id)) L.visible = false;
  refresh();
}
layerRow('title', 'タイトル', 'Title', 'ネオンのタイトル / the neon title', 'sec-title');
layerRow('text', 'テキスト', 'Text', '「presents」の行、ひなまつり、日付の行 / the presents line, ひなまつり and the date line', 'sec-title');
layerRow('pizza', 'ピザ', 'Pizza', 'ピザと、その下の影 / the pizza and its contact shadows', 'sec-pizza');
layerRow('dan', 'ひな壇', 'Hina-dan', '段、影、スピード線、段の上の名前 / the tiers, their shadow and streaks, and the names on them', 'sec-dan');
layerRow('petals', '花びら', 'Petals', '舞っている桃の花びら / the drifting peach petals', null);
layerRow('bg', '背景', 'Background', '三角形の模様。隠すと #1a1014 の無地 / the triangle mesh; hidden leaves plain #1a1014', null);

// 再生・書き出し Playback & export
num({ mount: 'm-play', param: 'loopSeconds', ...bind(PIZZA, 'loopSeconds'), def: PIZZA_DEFAULTS.loopSeconds, ja: 'ループ長', en: 'Loop', title: 'ループ全体の長さ。WebM の長さもこれになる / length of the loop and of the recorded WebM', min: 2, max: 30, step: 1, unit: 's' });

// タイトル（ネオン） Title
choice({ mount: 'm-title', param: 'palette', ...bind(NEON, 'palette'), def: NEON_DEFAULTS.palette, ja: '配色', en: 'Palette', title: '単語別: HINA 桃 / MATSURI 緑。三色: 一文字ごとに桃・白・緑 / word: pink HINA, green MATSURI. tricolor: pink, white, green letter by letter', options: [['word', '単語別 Word'], ['tricolor', '三色 Tricolor']] });
choice({ mount: 'm-title', param: 'ignite', ...bind(NEON, 'ignite'), def: NEON_DEFAULTS.ignite, ja: '点灯', en: 'Ignite', title: 'ループ: 毎ループ一文字ずつ点灯し、最後に消える。常時: つきっぱなし / loop: letters strike one by one each loop and dim out at the end. static: always on', options: [['loop', 'ループ Loop'], ['static', '常時 Static']] });
num({ mount: 'm-title', param: 'glow', ...bind(NEON, 'glow'), def: NEON_DEFAULTS.glow, ja: '光の強さ', en: 'Glow', title: 'ネオンのにじみの強さ（0 = 管だけ） / strength of the neon glow (0 = tubes only)', min: 0, max: 3, step: 0.05, unit: '×' });
num({ mount: 'm-title', param: 'flicker', ...bind(NEON, 'flicker'), def: NEON_DEFAULTS.flicker, ja: 'ちらつき', en: 'Flicker', title: '点灯時のまたたき・ハム・途中のちらつきの深さ（0 = なめらかに点灯） / depth of the ignition stutter, hum and mid-loop flicker (0 = clean fade-on)', min: 0, max: 2, step: 0.05, unit: '×' });

// タイトル配置 Title layout
choice({ mount: 'm-title-layout', param: 'titlePos', ...bind(TITLE, 'pos'), def: TITLE_DEFAULTS.pos, ja: '位置', en: 'Position', title: 'タイトルを上に置くか下に置くか。切り替えるとタイトルだけ動く。ピザやひな壇も合わせるには下のボタン / title at the top or the bottom. Switching moves only the title; use the button below to move the pizza and the dan to match', options: [['top', '上 Top'], ['bottom', '下 Bottom']], after: () => applyPattern(['titleX', 'titleY', 'titleSize', 'titleGap']) });
choice({ mount: 'm-title-layout', param: 'titleLines', ...bind(TITLE, 'lines'), def: TITLE_DEFAULTS.lines, ja: '行数', en: 'Lines', title: '2 行: HINA / MATSURI。1 行: HINAMATSURI（幅に収まるよう自動で縮む） / two lines, or HINAMATSURI on one line (shrunk to fit the width)', options: [['two', '2 行 Two'], ['one', '1 行 One']] });
num({ mount: 'm-title-layout', param: 'titleX', ...bind(TITLE, 'x'), def: TITLE_DEFAULTS.x, ja: '横位置', en: 'X', title: 'タイトルの左端 / left edge of the title', min: 0, max: 600, step: 1, unit: 'px' });
num({ mount: 'm-title-layout', param: 'titleY', ...bind(TITLE, 'y'), def: TITLE_DEFAULTS.y, ja: '縦位置', en: 'Y', title: '1 行目の大文字の上端 / top of the first line\'s capitals', min: 0, max: 1000, step: 1, unit: 'px' });
num({ mount: 'm-title-layout', param: 'titleSize', ...bind(TITLE, 'size'), def: TITLE_DEFAULTS.size, ja: '文字サイズ', en: 'Size', title: 'タイトルの文字サイズ（右端からはみ出す場合は自動で縮む） / title font size (shrunk automatically if a line would run off the right edge)', min: 60, max: 260, step: 1, unit: 'px' });
num({ mount: 'm-title-layout', param: 'titleGap', ...bind(TITLE, 'lineGap'), def: TITLE_DEFAULTS.lineGap, ja: '行間', en: 'Line gap', title: 'HINA と MATSURI の行の間隔（文字サイズに対する倍率） / distance between the HINA and MATSURI lines, as a multiple of the font size', min: 0.7, max: 1.4, step: 0.01, unit: '×' });
choice({ mount: 'm-title-layout', param: 'datePos', ...bind(TITLE, 'datePos'), def: TITLE_DEFAULTS.datePos, ja: '日付の位置', en: 'Date line', title: '日付・会場の行を一番下に置くか、タイトルのすぐ上に置くか / date and venue line at the very bottom, or just above the title', options: [['bottom', '最下部 Bottom'], ['above', 'タイトルの上 Above']] });

// ひな壇 Hina-dan: layout
num({ mount: 'm-dan-layout', param: 'danX', ...bind(DAN_GEO, 'x'), def: DAN_GEO_DEFAULTS.x, ja: '横位置', en: 'X', title: '最上段の中心の x（Shift+ドラッグでも動かせる） / x of the top tier\'s centre (or shift-drag the dan)', min: -200, max: 1280, step: 1, unit: 'px' });
num({ mount: 'm-dan-layout', param: 'danY', ...bind(DAN_GEO, 'y'), def: DAN_GEO_DEFAULTS.y, ja: '縦位置', en: 'Y', title: 'ひな壇の上端の y / y of the top of the dan', min: 0, max: 1080, step: 1, unit: 'px' });
num({ mount: 'm-dan-layout', param: 'danScale', ...bind(DAN_GEO, 'scale'), def: DAN_GEO_DEFAULTS.scale, ja: '大きさ', en: 'Scale', title: 'ひな壇全体（文字も）の倍率 / scale of the whole dan, text included', min: 0.3, max: 2, step: 0.01, unit: '×' });
num({ mount: 'm-dan-layout', param: 'danAlign', ...bind(DAN_GEO, 'align'), def: DAN_GEO_DEFAULTS.align, ja: '揃え', en: 'Align', title: '0 = 左揃え（段差は右だけ）、0.5 = 中央のピラミッド、1 = 右揃え / 0 = left-aligned (steps on the right only), 0.5 = centred pyramid, 1 = right-aligned', min: 0, max: 1, step: 0.01, unit: '' });
num({ mount: 'm-dan-layout', param: 'danStep', ...bind(DAN_GEO, 'step'), def: DAN_GEO_DEFAULTS.step, ja: '段の幅', en: 'Step', title: '下の段がどれだけ広くなるか（0 = 全段同じ幅） / how much wider each lower tier is (0 = all the same width)', min: 0, max: 88, step: 1, unit: 'px' });
num({ mount: 'm-dan-layout', param: 'danSkew', ...bind(DAN_GEO, 'skew'), def: DAN_GEO_DEFAULTS.skew, ja: '傾き', en: 'Skew', title: 'ひな壇全体を横に傾ける（0 = まっすぐ） / lean the whole stack sideways (0 = upright)', min: -0.3, max: 0.3, step: 0.01, unit: '' });

// ひな壇 Hina-dan: entrance
choice({ mount: 'm-dan-enter', param: 'enter', ...bind(DAN, 'enter'), def: DAN_DEFAULTS.enter, ja: '登場', en: 'Enter', title: 'ループ: 毎ループ左から滑り込み、最後に出ていく。固定: 最初から置いてある / loop: slides in from the left each loop and leaves at the end. static: always in place', options: [['loop', 'ループ Loop'], ['static', '固定 Static']] });
choice({ mount: 'm-dan-enter', param: 'order', ...bind(DAN, 'order'), def: DAN_DEFAULTS.order, ja: '順番', en: 'Order', title: 'どの段から入ってくるか / which tier comes in first', options: [['top', '上から Top'], ['bottom', '下から Bottom']] });
num({ mount: 'm-dan-enter', param: 'delay', ...bind(DAN, 'delay'), def: DAN_DEFAULTS.delay, ja: '開始', en: 'Delay', title: '最初の段が動き出す時刻（タイトルは約 2 秒で点灯し終わる） / when the first tier starts (the title is fully lit at about 2 s)', min: 0, max: 8, step: 0.05, unit: 's' });
num({ mount: 'm-dan-enter', param: 'stagger', ...bind(DAN, 'stagger'), def: DAN_DEFAULTS.stagger, ja: 'ずらし', en: 'Stagger', title: '段と段の時間差 / time between one tier and the next', min: 0, max: 0.6, step: 0.01, unit: 's' });
num({ mount: 'm-dan-enter', param: 'duration', ...bind(DAN, 'duration'), def: DAN_DEFAULTS.duration, ja: '速さ', en: 'Duration', title: '一段が着地するまでの時間（短いほど速い） / time one tier takes to land (shorter = faster)', min: 0.1, max: 1.5, step: 0.01, unit: 's' });
num({ mount: 'm-dan-enter', param: 'overshoot', ...bind(DAN, 'overshoot'), def: DAN_DEFAULTS.overshoot, ja: '行き過ぎ', en: 'Overshoot', title: '着地前にどれだけ行き過ぎて戻るか（0 = なし） / how far a tier shoots past its place before settling (0 = none)', min: 0, max: 2, step: 0.05, unit: '×' });
num({ mount: 'm-dan-enter', param: 'streak', ...bind(DAN, 'streak'), def: DAN_DEFAULTS.streak, ja: 'シュッ', en: 'Streak', title: '動いている段のスピード線の濃さ（0 = なし） / strength of the speed streaks on a moving tier (0 = none)', min: 0, max: 1, step: 0.05, unit: '' });

// ピザ Pizza: layout
num({ mount: 'm-pizza-layout', param: 'x', ...bind(PIZZA, 'x'), def: PIZZA_DEFAULTS.x, ja: '横位置', en: 'X', title: 'ピザの中心の x（ピザをドラッグしても動かせる） / x of the pizza\'s centre (or drag the pizza)', min: -200, max: 1500, step: 1, unit: 'px' });
num({ mount: 'm-pizza-layout', param: 'y', ...bind(PIZZA, 'y'), def: PIZZA_DEFAULTS.y, ja: '縦位置', en: 'Y', title: 'ピザの中心の y / y of the pizza\'s centre', min: -200, max: 1500, step: 1, unit: 'px' });
num({ mount: 'm-pizza-layout', param: 'scale', ...bind(PIZZA, 'scale'), def: PIZZA_DEFAULTS.scale, ja: '直径', en: 'Size', title: 'ピザの直径（ピザの上でホイール / ピンチでも変えられる） / diameter of the pizza (or wheel / pinch over it)', min: 200, max: 1600, step: 2, unit: 'px' });
num({ mount: 'm-pizza-layout', param: 'tilt', ...bind(PIZZA, 'tilt'), def: PIZZA_DEFAULTS.tilt, ja: '俯角', en: 'Tilt', title: 'カメラが見下ろす角度（大きいほど真上から） / how far the camera looks down (larger = more top-down)', min: 10, max: 85, step: 1, unit: '°' });

// ピザ Pizza: motion
num({ mount: 'm-pizza-motion', param: 'spin', ...bind(PIZZA, 'spin'), def: PIZZA_DEFAULTS.spin, ja: '回転', en: 'Spin', title: '1 ループでピザが回る回数。0 = 止める、マイナス = 逆回転。整数ならループが継ぎ目なくつながる / turns of the pizza per loop. 0 = still, negative = reverse. Whole numbers loop seamlessly', min: -4, max: 4, step: 1, unit: '/loop', fineStep: 0.05 });
num({ mount: 'm-pizza-motion', param: 'bobs', ...bind(PIZZA, 'bobs'), def: PIZZA_DEFAULTS.bobs, ja: '上下', en: 'Bobs', title: '1 ループで一切れが上下する回数。整数ならループが継ぎ目なくつながる / up-and-down bobs of the pulled slice per loop. Whole numbers loop seamlessly', min: 0, max: 8, step: 1, unit: '/loop', fineStep: 0.1 });
num({ mount: 'm-pizza-motion', param: 'bobHeight', ...bind(PIZZA, 'bobHeight'), def: PIZZA_DEFAULTS.bobHeight, ja: '高さ', en: 'Lift', title: '一切れが持ち上がる高さ（0 = 上がらない） / how high the slice lifts (0 = stays down)', min: 0, max: 1.5, step: 0.05, unit: '×' });

// --- presets ------------------------------------------------------------------

type PresetValues = Record<string, string>;
interface Preset {
  name: string;
  values: PresetValues;
  builtin?: boolean;
}

/** Every setting as strings, keyed by URL param (the same form the URL uses). */
const snapshot = (): PresetValues => Object.fromEntries(controls.map((c) => [c.param, c.value()]));
const defaults = (): PresetValues => Object.fromEntries(controls.map((c) => [c.param, c.def()]));

/** The title-at-the-bottom arrangement: title low, date just above it, pizza and dan moved up. */
const TITLE_BOTTOM: PresetValues = {
  titlePos: 'bottom',
  titleY: '745',
  datePos: 'above',
  x: '820',
  y: '430',
  scale: '700',
  danX: '230',
  danY: '240',
};
const BUILTINS: Preset[] = [
  { name: 'Default', values: defaults(), builtin: true },
  { name: 'Title bottom', values: { ...defaults(), ...TITLE_BOTTOM }, builtin: true },
];

const STORE_KEY = 'hinamatsuri-kv-presets';
const STORE_VERSION = 1;
/** Saved presets; an unreadable or missing store is just an empty list. */
function readStore(): Preset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as { version?: number; presets?: unknown } | null;
    return parsePresets(raw);
  } catch {
    return [];
  }
}
/** Accept anything shaped like our export; drop entries that are not name + string values. */
function parsePresets(raw: { version?: number; presets?: unknown } | null): Preset[] {
  if (!raw || !Array.isArray(raw.presets)) return [];
  const out: Preset[] = [];
  for (const p of raw.presets as { name?: unknown; values?: unknown }[]) {
    if (typeof p?.name !== 'string' || !p.name.trim() || typeof p.values !== 'object' || !p.values) continue;
    const values: PresetValues = {};
    for (const [k, v] of Object.entries(p.values as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') values[k] = String(v);
    }
    out.push({ name: p.name.trim(), values });
  }
  return out;
}
let saved: Preset[] = readStore();
let storageOk = true;
function writeStore(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: STORE_VERSION, presets: saved.map(({ name, values }) => ({ name, values })) }));
    storageOk = true;
  } catch {
    storageOk = false; // private mode / quota: presets still work until the page is closed
  }
}

/** name of the preset the current values came from, if any */
let currentPreset: string | null = null;
const findPreset = (name: string): Preset | undefined => [...BUILTINS, ...saved].find((p) => p.name === name);
/** A preset matches when every setting equals its value (keys an old preset lacks count as default). */
const matches = (p: Preset): boolean => controls.every((c) => (p.values[c.param] ?? c.def()) === c.value());

/** Set every control from `values`; anything missing goes back to its default. */
function applyValues(values: PresetValues, only?: string[]): void {
  for (const c of controls) {
    if (only && !only.includes(c.param)) continue;
    c.load(values[c.param]);
  }
  syncLayout();
}

function loadPreset(name: string): void {
  const p = findPreset(name);
  if (busy() || !p) return;
  currentPreset = name;
  applyValues(p.values);
  status.textContent = `プリセット「${name}」を読み込みました / loaded preset "${name}"`;
}

/** The parts of the built-in arrangement for the current title position (top / bottom). */
function applyPattern(only: string[]): void {
  const base = BUILTINS[TITLE.pos === 'bottom' ? 1 : 0]!;
  applyValues(base.values, only);
}
$('applyPattern').addEventListener('click', () => {
  if (busy()) return;
  applyPattern(['titleX', 'titleY', 'titleSize', 'titleGap', 'datePos', 'x', 'y', 'scale', 'tilt', ...Object.values(DAN_GEO_PARAMS)]);
});

const presetName = $<HTMLInputElement>('presetName');
const presetList = $<HTMLDivElement>('presetList');

function savePreset(name: string, values = snapshot()): boolean {
  name = name.trim();
  if (!name) {
    status.textContent = '名前を入力してください / enter a name first';
    return false;
  }
  if (BUILTINS.some((p) => p.name === name)) {
    status.textContent = `「${name}」は組み込みプリセットの名前です。別の名前にしてください / "${name}" is a built-in; pick another name`;
    return false;
  }
  const existing = saved.find((p) => p.name === name);
  if (existing) {
    if (!confirm(`「${name}」を今の設定で上書きしますか？ / Overwrite "${name}" with the current settings?`)) return false;
    existing.values = values;
  } else saved.push({ name, values });
  writeStore();
  status.textContent = storageOk ? `「${name}」を保存しました / saved "${name}"` : `「${name}」を保存しましたが、このブラウザには残せません / saved "${name}" for this session only (storage unavailable)`;
  return true;
}

function smallButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

/** A free name: "name copy", "name copy 2", ... */
function freeName(base: string): string {
  let name = `${base} copy`;
  for (let i = 2; findPreset(name); i++) name = `${base} copy ${i}`;
  return name;
}

function renderPresets(): void {
  presetList.textContent = '';
  for (const p of [...BUILTINS, ...saved]) {
    const row = document.createElement('div');
    row.className = 'preset';
    const isCurrent = p.name === currentPreset;
    row.classList.toggle('current', isCurrent);
    const load = smallButton(p.name, 'クリックで読み込む / click to load', () => {
      loadPreset(p.name);
    });
    load.className = 'pname';
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = p.builtin ? '組み込み built-in' : '';
    if (isCurrent) mark.textContent = matches(p) ? '● 使用中 loaded' : '● 変更あり modified';
    const tools = document.createElement('span');
    tools.className = 'tools';
    if (!p.builtin) {
      tools.append(
        smallButton('上書き', '今の設定で上書き / overwrite with the current settings', () => {
          if (savePreset(p.name)) currentPreset = p.name;
          renderPresets();
        }),
        smallButton('名前', '名前を変える / rename', () => {
          const next = prompt(`「${p.name}」の新しい名前 / new name for "${p.name}"`, p.name)?.trim();
          if (!next || next === p.name) return;
          if (findPreset(next)) {
            status.textContent = `「${next}」は既にあります / "${next}" already exists`;
            return;
          }
          if (currentPreset === p.name) currentPreset = next;
          p.name = next;
          writeStore();
          renderPresets();
        }),
      );
    }
    tools.append(
      smallButton('複製', '複製する / duplicate', () => {
        saved.push({ name: freeName(p.name), values: { ...p.values } });
        writeStore();
        renderPresets();
      }),
    );
    if (!p.builtin) {
      tools.append(
        smallButton('削除', '削除する / delete', () => {
          if (!confirm(`「${p.name}」を削除しますか？ / Delete "${p.name}"?`)) return;
          saved = saved.filter((q) => q !== p);
          if (currentPreset === p.name) currentPreset = null;
          writeStore();
          renderPresets();
        }),
      );
    }
    row.append(load, mark, tools);
    presetList.append(row);
  }
}

$('presetSave').addEventListener('click', () => {
  if (busy()) return;
  if (savePreset(presetName.value)) {
    currentPreset = presetName.value.trim();
    presetName.value = '';
  }
  renderPresets();
});
presetName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('presetSave').click();
});

$('presetExport').addEventListener('click', () => {
  const body = JSON.stringify({ version: STORE_VERSION, presets: saved.map(({ name, values }) => ({ name, values })) }, null, 2);
  download(new Blob([body], { type: 'application/json' }), 'hinamatsuri-kv-presets.json');
  status.textContent = `${saved.length} 件を書き出しました / exported ${saved.length} preset(s)`;
});

/** Merge presets from an exported file; ask before replacing one with the same name. */
function importPresets(text: string): void {
  let incoming: Preset[] = [];
  try {
    incoming = parsePresets(JSON.parse(text) as { presets?: unknown });
  } catch {
    incoming = [];
  }
  if (!incoming.length) {
    status.textContent = 'プリセットが見つかりませんでした / no presets found in that file';
    return;
  }
  let added = 0;
  for (const p of incoming) {
    if (BUILTINS.some((b) => b.name === p.name)) p.name = freeName(p.name);
    const clash = saved.find((q) => q.name === p.name);
    if (clash) {
      if (!confirm(`「${p.name}」は既にあります。読み込んだもので置き換えますか？ / "${p.name}" already exists. Replace it with the imported one?`)) continue;
      clash.values = p.values;
    } else saved.push(p);
    added++;
  }
  writeStore();
  renderPresets();
  status.textContent = `${added} 件を読み込みました / imported ${added} preset(s)`;
}
const presetFile = $<HTMLInputElement>('presetFile');
$('presetImport').addEventListener('click', () => presetFile.click());
presetFile.addEventListener('change', () => {
  const file = presetFile.files?.[0];
  presetFile.value = '';
  if (file) void file.text().then(importPresets);
});

$('copyUrl').addEventListener('click', () => {
  syncUrl();
  navigator.clipboard?.writeText(location.href).then(
    () => (status.textContent = 'URL をコピーしました / URL copied'),
    () => (status.textContent = `コピーできませんでした。アドレスバーの URL を使ってください / could not copy; use the URL in the address bar`),
  ) ?? (status.textContent = 'アドレスバーの URL を使ってください / use the URL in the address bar');
});

renderPresets();

// ピザ Pizza: toppings
choice({ mount: 'm-pizza-toppings', param: 'toppings', ...bind(PIZZA, 'toppings'), def: 'hishimochi', ja: '具', en: 'Toppings', title: 'ピザにのせる具。菱餅 / ひなあられ / ちらし寿司 / what is on the pizza: hishimochi, hina-arare or chirashi-zushi', options: [['hishimochi', '菱餅 Hishimochi'], ['arare', 'ひなあられ Arare'], ['chirashi', 'ちらし寿司 Chirashi']] });

const LAYOUT_PARAMS = new Set(['x', 'y', 'scale', ...Object.values(DAN_GEO_PARAMS)]);

/** Redraw every control from its value (after a drag, a pinch or a reset) and update the URL. */
function syncLayout(): void {
  for (const c of controls) c.refresh();
  changed();
}

$('resetLayout').addEventListener('click', () => {
  if (busy()) return;
  for (const c of controls) if (LAYOUT_PARAMS.has(c.param)) c.reset();
  syncLayout();
});
$('resetAll').addEventListener('click', () => {
  if (busy()) return;
  for (const c of controls) c.reset();
  syncLayout();
});

// --- direct manipulation: drag the pizza, wheel / pinch to resize it, shift-drag the dan ---

const toDesign = (e: MouseEvent): { x: number; y: number } => {
  const r = view.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * SIZE) / r.width, y: ((e.clientY - r.top) * SIZE) / r.height };
};
/** Roughly the pizza's footprint: its ellipse plus the room the lifted slice sweeps. */
function overPizza(p: { x: number; y: number }): boolean {
  const rx = (PIZZA.scale / 2) * 1.3;
  const ry = rx * Math.sin(THREE.MathUtils.degToRad(PIZZA.tilt)) + 0.12 * PIZZA.scale;
  return ((p.x - PIZZA.x) / rx) ** 2 + ((p.y - PIZZA.y) / ry) ** 2 <= 1;
}
function overDan(p: { x: number; y: number }): boolean {
  const lean = danLean();
  const left = Math.min(danCentre(0) - danHalfWidth(0), danCentre(2) - danHalfWidth(2)) - lean;
  const right = Math.max(danCentre(0) + danHalfWidth(0), danCentre(2) + danHalfWidth(2)) + lean;
  return p.x >= left && p.x <= right && p.y >= DAN_GEO.y && p.y <= DAN_GEO.y + 3 * DAN_SHAPE.tierH * DAN_GEO.scale;
}
view.style.touchAction = 'none';
view.addEventListener('pointerdown', (e) => {
  if (busy() || e.button !== 0) return;
  const start = toDesign(e);
  // shift picks the dan; otherwise the pizza (which may overlap the dan's edge) wins
  // a hidden layer has no hit box
  const target = e.shiftKey ? (LAYERS.dan.visible && overDan(start) ? DAN_GEO : null) : LAYERS.pizza.visible && overPizza(start) ? PIZZA : null;
  if (!target) return;
  e.preventDefault();
  const origin = { x: target.x, y: target.y };
  view.style.cursor = 'grabbing';
  const move = (ev: PointerEvent): void => {
    if (busy()) return;
    const p = toDesign(ev);
    target.x = Math.round(origin.x + p.x - start.x);
    target.y = Math.round(origin.y + p.y - start.y);
    syncLayout();
  };
  const up = (): void => {
    view.style.cursor = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});
view.addEventListener(
  'wheel',
  (e) => {
    if (busy() || !LAYERS.pizza.visible || !overPizza(toDesign(e))) return;
    e.preventDefault();
    // a trackpad pinch arrives as a ctrl+wheel with small deltas
    const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    PIZZA.scale = Math.round(THREE.MathUtils.clamp(PIZZA.scale * k, 100, 3000));
    syncLayout();
  },
  { passive: false },
);

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (recording) return; // the recorder drives its own frames
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    t = (t + dt) % PIZZA.loopSeconds;
    syncControls();
  }
  composite(viewCtx, SIZE, t);
}

playBtn.addEventListener('click', () => {
  if (recording) return;
  playing = !playing;
  syncControls();
  syncUrl();
});
slider.addEventListener('input', () => {
  if (recording) return;
  t = Number(slider.value) % PIZZA.loopSeconds;
  playing = false;
  syncControls();
  syncUrl();
});

function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

function exportPng(size: number): void {
  if (busy()) return;
  exporting = true; // layout edits wait until the file is written
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  composite(out.getContext('2d')!, size, t);
  out.toBlob((blob) => {
    exporting = false;
    if (!blob) {
      status.textContent = 'PNG export failed';
      return;
    }
    download(blob, `hinamatsuri-kv-${size}.png`);
    status.textContent = `saved ${size}px @ ${t.toFixed(2)}s`;
  }, 'image/png');
}
$('png1080').addEventListener('click', () => exportPng(1080));
$('png2160').addEventListener('click', () => exportPng(2160));

/** One loop of the visible canvas as WebM; with whole-number spin and bobs the clip loops. */
function record(): void {
  if (recording) return;
  if (typeof MediaRecorder === 'undefined' || !view.captureStream) {
    status.textContent = 'recording is not supported in this browser';
    return;
  }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) {
    status.textContent = 'WebM is not supported in this browser';
    return;
  }
  const rec = new MediaRecorder(view.captureStream(60), { mimeType: mime, videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    clearInterval(timer);
    recording = false;
    last = performance.now();
    recordBtn.disabled = false;
    download(new Blob(chunks, { type: 'video/webm' }), `hinamatsuri-kv-${PIZZA.loopSeconds}s.webm`);
    status.textContent = `saved ${PIZZA.loopSeconds}s WebM`;
    syncControls();
  };
  recording = true;
  recordBtn.disabled = true;
  playing = true;
  status.textContent = 'recording…';
  // Frames come from a timer, not requestAnimationFrame, so the take does not stall when the
  // page is not being painted; t is the time since the take began, so it covers exactly one loop.
  const began = performance.now();
  const draw = (): void => {
    const elapsed = (performance.now() - began) / 1000;
    if (elapsed >= PIZZA.loopSeconds) {
      if (rec.state === 'recording') rec.stop();
      return;
    }
    t = elapsed;
    syncControls();
    composite(viewCtx, SIZE, t);
  };
  draw();
  rec.start();
  const timer = setInterval(draw, 1000 / 60);
}
recordBtn.addEventListener('click', record);

// Draw straight away with fallback fonts, then again every frame once the web fonts are in
// (the text is redrawn per frame, so loading only needs to be triggered).
const allText = [COPY.presents, COPY.kana, COPY.info, ...COPY.tiers.flatMap((x) => [x.role, x.names])].join('');
void Promise.all([
  document.fonts.load('400 172px "Archivo Black"', COPY.title.join('')),
  document.fonts.load('700 22px "Zen Kaku Gothic New"', allText),
  document.fonts.load('500 22px "Zen Kaku Gothic New"', allText),
]).then(
  () => (document.documentElement.dataset.fonts = 'ready'),
  () => (status.textContent = 'web fonts failed to load; using fallbacks'),
);

syncControls();
requestAnimationFrame(frame);
