import type { Palette, PaletteId, RenderInput, Scene, SceneId } from '../types';
import { GL_SCENES } from '../gl/scenes';
import { HINA_2D } from './hina';

export const PALETTES: Record<PaletteId, Palette> = {
  warm: { bg: '#12060a', a: '#ff4d2e', b: '#ffb020', c: '#ffe8c0' },
  cold: { bg: '#050a16', a: '#2e7dff', b: '#20e0ff', c: '#d8f4ff' },
  neon: { bg: '#0a0412', a: '#ff2ea6', b: '#39ff88', c: '#fff45c' },
  mono: { bg: '#050505', a: '#ffffff', b: '#bbbbbb', c: '#666666' },
  acid: { bg: '#0a0f04', a: '#c8ff00', b: '#ff7a00', c: '#00ffd0' },
  hina: { bg: '#1a0b12', a: '#ff9fbf', b: '#a3d39c', c: '#fff3d6' },
};

const TAU = Math.PI * 2;

function fade(ctx: CanvasRenderingContext2D, input: RenderInput, alpha: number): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = input.palette.bg;
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, input.w, input.h);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- particles
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  k: number;
}
const parts: P[] = [];
function seedParticles(w: number, h: number): void {
  parts.length = 0;
  for (let i = 0; i < 420; i++) {
    parts.push({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, k: i % 3 });
  }
}
const particles: Scene = {
  id: 'particles',
  name: 'Particles',
  group: '2d',
  description: '粒子が中心から舞い、ビートで弾ける。中程度の強さ。安定した進行やグルーヴに合う',
  render(ctx, input) {
    const { w, h, dt, palette } = input;
    if (parts.length === 0) seedParticles(w, h);
    fade(ctx, input, 0.12 + 0.1 * (1 - input.intensity));
    const cx = w / 2;
    const cy = h / 2;
    const burst = input.beatPulse * (0.6 + input.bass) * (0.4 + input.intensity) * 900;
    const swirl = 0.6 + input.intensity * 2;
    const colors = [palette.a, palette.b, palette.c];
    for (const p of parts) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy) + 1;
      // pull toward the center, push out on the beat, swirl around it
      p.vx += ((-dx / d) * 60 + (dx / d) * burst + (-dy / d) * swirl * 40) * dt;
      p.vy += ((-dy / d) * 60 + (dy / d) * burst + (dx / d) * swirl * 40) * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt * 60 * 0.05;
      p.y += p.vy * dt * 60 * 0.05;
      if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        p.x = cx + (Math.random() - 0.5) * 40;
        p.y = cy + (Math.random() - 0.5) * 40;
        p.vx = p.vy = 0;
      }
      ctx.fillStyle = colors[p.k]!;
      const r = 1.2 + input.energy * 3 + (p.k === 2 ? input.high * 3 : 0);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    // core
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 + input.bass * 200);
    g.addColorStop(0, palette.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.25 + input.beatPulse * 0.5;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ------------------------------------------------------------------ tunnel
let tunnelZ = 0;
let tunnelRot = 0;
const tunnel: Scene = {
  id: 'tunnel',
  name: 'Tunnel',
  group: '2d',
  description: '奥へ進み続けるトンネル。速度は音圧に連動し、前進感と高揚感がある。ビルドアップやドロップに合う',
  render(ctx, input) {
    const { w, h, dt, palette } = input;
    fade(ctx, input, 0.35);
    const speed = 0.4 + input.energy * 1.6 + input.intensity * 1.2 + input.beatPulse * 1.5;
    tunnelZ = (tunnelZ + speed * dt) % 1;
    tunnelRot += dt * (0.15 + input.intensity * 0.8) * (input.mid > 0.5 ? 1.5 : 1);
    const cx = w / 2 + Math.sin(input.t * 0.7) * 40 * input.intensity;
    const cy = h / 2 + Math.cos(input.t * 0.5) * 30 * input.intensity;
    const rings = 22;
    const maxR = Math.hypot(w, h) * 0.6;
    ctx.lineCap = 'round';
    for (let i = rings - 1; i >= 0; i--) {
      const z = ((i + tunnelZ) / rings) ** 2.2;
      const r = z * maxR;
      const alpha = Math.min(1, z * 1.6);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = i % 2 === 0 ? palette.a : palette.b;
      ctx.lineWidth = 1 + z * (6 + input.bass * 14);
      ctx.beginPath();
      const sides = 6;
      for (let s = 0; s <= sides; s++) {
        const a = tunnelRot + (s / sides) * TAU + i * 0.05;
        const rr = r * (1 + 0.08 * Math.sin(a * 3 + input.t * 2) * input.high);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (input.beatPulse > 0.6) {
      ctx.fillStyle = palette.c;
      ctx.globalAlpha = (input.beatPulse - 0.6) * 0.5 * input.intensity;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + input.sub * 60, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },
};

// -------------------------------------------------------------------- grid
const gridLit = new Map<number, number>();
const grid: Scene = {
  id: 'grid',
  name: 'Grid',
  group: '2d',
  description: '格子状のブロックが低域で脈動し、ビートでランダムに点灯する。硬質でミニマル。テクノの安定した進行に合う',
  render(ctx, input) {
    const { w, h, palette } = input;
    fade(ctx, input, 0.5);
    const cols = 24;
    const rows = Math.max(6, Math.round((cols * h) / w));
    const cw = w / cols;
    const ch = h / rows;
    if (input.beatPulse > 0.9) {
      const n = Math.round(2 + input.intensity * 14 + input.bass * 6);
      for (let i = 0; i < n; i++) gridLit.set(Math.floor(Math.random() * cols * rows), input.t);
    }
    if (input.onset && input.intensity > 0.5) gridLit.set(Math.floor(Math.random() * cols * rows), input.t);
    const wave = 2 + input.intensity * 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const phase = Math.sin(c * 0.5 + input.t * wave) * Math.cos(r * 0.6 - input.t * wave * 0.7);
        const base = 0.25 + 0.5 * input.bass * input.beatPulse + 0.15 * phase;
        const lit = gridLit.get(i);
        const litAmt = lit === undefined ? 0 : Math.max(0, 1 - (input.t - lit) * 4);
        const size = Math.max(0.05, Math.min(0.95, base + litAmt * 0.5));
        ctx.fillStyle = litAmt > 0.3 ? palette.c : (c + r) % 2 === 0 ? palette.a : palette.b;
        ctx.globalAlpha = 0.35 + 0.65 * Math.max(size, litAmt);
        const sw = cw * size;
        const sh = ch * size;
        ctx.fillRect(c * cw + (cw - sw) / 2, r * ch + (ch - sh) / 2, sw, sh);
      }
    }
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ strobe
let strobeLastFlash = -1;
let strobeLastBeat = -1;
const strobe: Scene = {
  id: 'strobe',
  name: 'Strobe',
  group: '2d',
  description: '白黒の強烈なストロボと回転する放射線。最大エネルギーのドロップ専用。長く使うと疲れる',
  maxBars: 8,
  render(ctx, input) {
    const { w, h, palette } = input;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const beatNow = input.beatPulse > 0.95;
    // flash on every beat; at high intensity also on 8ths and onsets
    const eighth = Math.abs(input.beatPhase - 0.5) < 0.03;
    if ((beatNow && input.t - strobeLastBeat > 0.1) || (input.intensity > 0.75 && eighth) || (input.intensity > 0.9 && input.onset)) {
      strobeLastFlash = input.t;
      if (beatNow) strobeLastBeat = input.t;
    }
    const since = input.t - strobeLastFlash;
    const flash = since >= 0 && since < 0.06;
    const cx = w / 2;
    const cy = h / 2;
    const rays = 24;
    const rot = input.t * (1 + input.intensity * 3);
    ctx.strokeStyle = flash ? '#000' : palette.a;
    ctx.lineWidth = 2 + input.bass * 10;
    ctx.globalAlpha = flash ? 1 : 0.5 + input.energy * 0.5;
    if (flash) {
      ctx.fillStyle = palette.c;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.beginPath();
    for (let i = 0; i < rays; i++) {
      const a = rot + (i / rays) * TAU;
      const len = Math.hypot(w, h) * (0.3 + input.high * 0.7);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // hard-edged bars sweeping across
    const bars = 5;
    for (let i = 0; i < bars; i++) {
      const x = ((input.barPhase * 2 + i / bars) % 1) * w;
      ctx.fillStyle = flash ? '#000' : palette.b;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, 0, 6 + input.sub * 30, h);
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------- kaleido
let kaleidoCanvas: HTMLCanvasElement | null = null;
const kaleido: Scene = {
  id: 'kaleido',
  name: 'Kaleidoscope',
  group: '2d',
  description: '万華鏡。波形が鏡面対称に広がり、ゆっくり回転する。浮遊感があり、ブレイクダウンやイントロに合う',
  render(ctx, input) {
    const { w, h, palette, wave } = input;
    fade(ctx, input, 0.08 + 0.15 * input.intensity);
    const seg = 8;
    const R = Math.hypot(w, h) / 2;
    if (!kaleidoCanvas) kaleidoCanvas = document.createElement('canvas');
    const kc = kaleidoCanvas;
    if (kc.width !== Math.ceil(R) || kc.height !== Math.ceil(R)) {
      kc.width = Math.ceil(R);
      kc.height = Math.ceil(R);
    }
    const k = kc.getContext('2d')!;
    k.clearRect(0, 0, kc.width, kc.height);
    // draw one wedge's content: ribbons following the waveform
    k.lineCap = 'round';
    const ribbons = 3;
    for (let r = 0; r < ribbons; r++) {
      k.strokeStyle = [palette.a, palette.b, palette.c][r]!;
      k.lineWidth = 2 + input.bass * 6 + r;
      k.globalAlpha = 0.8 - r * 0.2;
      k.beginPath();
      const n = 64;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const wi = Math.floor(u * (wave.length - 1));
        const amp = (wave[wi] ?? 0) * (60 + input.energy * 200) * (1 + r * 0.5);
        const ang = u * (TAU / seg) * 1.2 + Math.sin(input.t * 0.4 + r) * 0.2;
        const rad = 40 + u * R * 0.9 + amp;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        if (i === 0) k.moveTo(x, y);
        else k.lineTo(x, y);
      }
      k.stroke();
    }
    k.globalAlpha = 0.9;
    k.fillStyle = palette.c;
    const orbs = 3;
    for (let o = 0; o < orbs; o++) {
      const ang = (input.t * (0.3 + o * 0.1)) % (TAU / seg);
      const rad = 80 + o * 90 + input.sub * 120;
      k.beginPath();
      k.arc(Math.cos(ang) * rad, Math.sin(ang) * rad, 4 + input.beatPulse * 14, 0, TAU);
      k.fill();
    }
    k.globalAlpha = 1;
    // mirror the wedge around the center
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(input.t * (0.05 + input.intensity * 0.3));
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < seg; s++) {
      ctx.save();
      ctx.rotate((s / seg) * TAU);
      if (s % 2 === 1) ctx.scale(1, -1);
      ctx.drawImage(kc, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ------------------------------------------------------------------- waves
const waves: Scene = {
  id: 'waves',
  name: 'Waves',
  group: '2d',
  description: '音の波形が何本ものリボンとして横に流れる。有機的で柔らかい。ボーカルやメロディが前に出る場面、緩やかな展開に合う',
  render(ctx, input) {
    const { w, h, palette, wave } = input;
    fade(ctx, input, 0.2);
    const lines = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const colors = [palette.a, palette.b, palette.c];
    for (let l = 0; l < lines; l++) {
      const yBase = (h * (l + 1)) / (lines + 1);
      const amp = h * 0.12 * (0.3 + input.energy) * (1 + input.beatPulse * 0.8) * (1 + input.intensity);
      ctx.strokeStyle = colors[l % 3]!;
      ctx.lineWidth = 1.5 + input.bass * 5;
      ctx.globalAlpha = 0.4 + 0.6 * (1 - Math.abs(l - (lines - 1) / 2) / lines);
      ctx.beginPath();
      const n = 160;
      const shift = (input.t * (40 + input.intensity * 200) + l * 50) % w;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const wi = Math.floor(((u + l * 0.13) % 1) * (wave.length - 1));
        const x = u * w;
        const y = yBase + (wave[wi] ?? 0) * amp + Math.sin((x + shift) * 0.01 + l) * 12 * input.mid;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

export const SCENES: Scene[] = [particles, tunnel, grid, strobe, kaleido, waves, ...GL_SCENES, ...HINA_2D];
export const SCENE_BY_ID: Record<SceneId, Scene> = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<SceneId, Scene>;

export function resetSceneState(): void {
  parts.length = 0;
  gridLit.clear();
  tunnelZ = 0;
}
