import type { RenderInput, Scene } from '../types';

const TAU = Math.PI * 2;
const PINKS = ['#ffc2d4', '#ff9fbf', '#ffe1ea', '#ffb0c8'];
const RED = '#c8102e';
const RED_DARK = '#8a0b20';
const GOLD = '#e6c45a';
const CREAM = '#fff3d6';
const GREEN = '#a3d39c';

function fade(ctx: CanvasRenderingContext2D, input: RenderInput, alpha: number): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = input.palette.bg;
  ctx.fillRect(0, 0, input.w, input.h);
  ctx.globalAlpha = 1;
}

/** sakura / peach petal: teardrop with a notch at the tip */
function petalPath(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.9, -s * 0.9, s * 0.9, s * 0.5, 0, s * 0.35);
  ctx.lineTo(-s * 0.12, s * 0.15);
  ctx.lineTo(-s * 0.0, s * 0.35);
  ctx.bezierCurveTo(-s * 0.9, s * 0.5, -s * 0.9, -s * 0.9, 0, -s);
  ctx.closePath();
}

function flowerPath(ctx: CanvasRenderingContext2D, s: number): void {
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * TAU);
    ctx.translate(0, -s * 0.55);
    petalPath(ctx, s * 0.6);
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- petals
interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  s: number;
  c: number;
  phase: number;
}
interface Bloom {
  x: number;
  y: number;
  born: number;
  s: number;
}
const petals: Petal[] = [];
const blooms: Bloom[] = [];
let lastBloomBeat = -1;
function seedPetals(w: number, h: number): void {
  petals.length = 0;
  for (let i = 0; i < 220; i++) {
    petals.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 20 + Math.random() * 40,
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 3,
      s: 6 + Math.random() * 14,
      c: i % PINKS.length,
      phase: Math.random() * TAU,
    });
  }
}

export const hinaPetals: Scene = {
  id: 'hina_petals',
  name: 'Hina Petals',
  group: 'hina',
  description: 'ひな祭り素材。桃の花びらが舞い落ち、ビートで舞い上がって花が咲く。柔らかく華やか。春らしい場面や中程度までの盛り上がりに合う',
  render(ctx, input) {
    const { w, h, dt, t } = input;
    if (petals.length === 0) seedPetals(w, h);
    fade(ctx, input, 0.2);
    // warm glow
    const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.6);
    g.addColorStop(0, `rgba(255,170,200,${(0.12 + input.sub * 0.25).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const wind = Math.sin(t * 0.3) * 30 + input.mid * 60;
    const puff = input.beatPulse * (60 + input.bass * 240) * (0.3 + input.intensity);
    const scale = Math.min(w, h) / 900;
    for (const p of petals) {
      const sway = Math.sin(t * 1.5 + p.phase) * 25;
      p.vx += ((wind + sway - p.vx) * 0.8 - Math.sign(p.x - w / 2) * puff * 0.3) * dt;
      p.vy += ((30 + input.intensity * 60 - p.vy) * 0.6 - puff) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt * (1 + input.high * 3);
      if (p.y > h + 30) {
        p.y = -30;
        p.x = Math.random() * w;
      }
      if (p.y < -60) p.y = h + 20;
      if (p.x < -40) p.x = w + 30;
      if (p.x > w + 40) p.x = -30;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.6 + 0.4 * Math.abs(Math.cos(p.rot * 1.3)));
      ctx.fillStyle = PINKS[p.c]!;
      ctx.globalAlpha = 0.85;
      petalPath(ctx, p.s * scale * (1 + input.energy * 0.5));
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // blossoms bloom on beats
    const beatIdx = Math.floor(t / 0.001); // placeholder to keep TS happy about t use
    void beatIdx;
    if (input.beatPulse > 0.95 && t - lastBloomBeat > 0.2) {
      lastBloomBeat = t;
      const n = 1 + Math.round(input.intensity * 3);
      for (let i = 0; i < n; i++) blooms.push({ x: Math.random() * w, y: Math.random() * h, born: t, s: (30 + Math.random() * 50) * scale * (1 + input.bass) });
      while (blooms.length > 24) blooms.shift();
    }
    for (const b of blooms) {
      const age = t - b.born;
      const k = Math.min(1, age / 0.35);
      const alpha = Math.max(0, 1 - age / 2.2);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(age * 0.6);
      ctx.scale(k, k);
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = PINKS[1]!;
      flowerPath(ctx, b.s);
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(0, 0, b.s * 0.18, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ hina dan
const TIERS = 7;
const DOLLS_PER_TIER = [2, 3, 5, 2, 3, 0, 0];
const DOLL_COLORS = [
  ['#ffb0c8', '#ff7aa2', '#fff3d6', '#a3d39c'],
  ['#fff3d6', '#ff9fbf', '#ffd6e0', '#a3d39c'],
  ['#a3d39c', '#fff3d6', '#ff9fbf', '#ffd6e0'],
];
let danLastFlash = -1;

function drawDoll(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, variant: number, bob: number): void {
  const cols = DOLL_COLORS[variant % DOLL_COLORS.length]!;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 1 + bob * 0.08);
  // layered robe (juunihitoe) as stacked arcs
  for (let i = 3; i >= 0; i--) {
    ctx.fillStyle = cols[i]!;
    ctx.beginPath();
    const r = s * (0.55 + i * 0.12);
    ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(-r * 0.9, -s * 0.9 - i * s * 0.05, 0, -s * 1.05 - i * s * 0.05);
    ctx.quadraticCurveTo(r * 0.9, -s * 0.9 - i * s * 0.05, r, 0);
    ctx.closePath();
    ctx.fill();
  }
  // head
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(0, -s * 1.25, s * 0.28, 0, TAU);
  ctx.fill();
  // hair
  ctx.fillStyle = '#1a1014';
  ctx.beginPath();
  ctx.arc(0, -s * 1.3, s * 0.29, Math.PI, TAU);
  ctx.fill();
  // crown / fan accent
  ctx.fillStyle = GOLD;
  ctx.fillRect(-s * 0.06, -s * 1.68, s * 0.12, s * 0.16);
  ctx.restore();
}

function drawBonbori(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glow: number): void {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, -s * 0.9, 0, 0, -s * 0.9, s * 2.2);
  g.addColorStop(0, `rgba(255,220,150,${(0.5 + glow * 0.5).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-s * 2.2, -s * 3.1, s * 4.4, s * 4.4);
  ctx.fillStyle = `rgba(255,236,200,${(0.7 + glow * 0.3).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.3);
  ctx.lineTo(-s * 0.35, -s * 1.5);
  ctx.lineTo(s * 0.35, -s * 1.5);
  ctx.lineTo(s * 0.55, -s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a1a10';
  ctx.fillRect(-s * 0.06, -s * 0.3, s * 0.12, s * 1.1);
  ctx.fillRect(-s * 0.35, s * 0.7, s * 0.7, s * 0.12);
  ctx.restore();
}

export const hinaDan: Scene = {
  id: 'hina_dan',
  name: 'Hina Dan',
  group: 'hina',
  description: 'ひな祭り素材。金屏風の前、緋毛氈の七段飾りにお内裏様・三人官女・五人囃子が並び、ぼんぼりが低域で灯る。ビートで人形が揺れる。象徴的で見せ場や決め場に向く',
  render(ctx, input) {
    const { w, h, t } = input;
    fade(ctx, input, 0.6);
    const cx = w / 2 + Math.sin(t * 0.15) * w * 0.02;
    const zoom = 1 + input.sub * 0.04 + input.beatPulse * 0.02 * input.intensity;
    ctx.save();
    ctx.translate(cx, h * 0.5);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -h * 0.5);
    // gold folding screen
    const sw = w * 0.72;
    const sx = cx - sw / 2;
    const sy = h * 0.06;
    const sh = h * 0.5;
    const sg = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    sg.addColorStop(0, '#c9a13f');
    sg.addColorStop(0.5, `rgb(${Math.round(230 + input.high * 25)},${Math.round(196 + input.high * 30)},90)`);
    sg.addColorStop(1, '#8a6a1c');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(80,50,0,0.5)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      const x = sx + (sw * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x, sy + sh);
      ctx.stroke();
    }
    // tiers, back to front
    const top = h * 0.3;
    const bottom = h * 0.96;
    const tierH = (bottom - top) / TIERS;
    const scale = Math.min(w, h) / 900;
    for (let i = 0; i < TIERS; i++) {
      const y0 = top + i * tierH;
      const wTop = w * (0.36 + i * 0.07);
      const wBot = w * (0.36 + (i + 1) * 0.07);
      ctx.fillStyle = i % 2 === 0 ? RED : RED_DARK;
      ctx.beginPath();
      ctx.moveTo(cx - wTop / 2, y0);
      ctx.lineTo(cx + wTop / 2, y0);
      ctx.lineTo(cx + wBot / 2, y0 + tierH);
      ctx.lineTo(cx - wBot / 2, y0 + tierH);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      ctx.moveTo(cx - wTop / 2, y0);
      ctx.lineTo(cx + wTop / 2, y0);
      ctx.stroke();
      // dolls on this tier
      const n = DOLLS_PER_TIER[i]!;
      const dollS = (26 + (TIERS - i) * 2) * scale * 1.1;
      for (let d = 0; d < n; d++) {
        const u = n === 1 ? 0.5 : (d + 0.5) / n;
        const x = cx - wTop / 2 + wTop * (0.15 + 0.7 * u);
        const bob = input.beatPulse * (0.5 + 0.5 * Math.sin(d * 1.7 + i));
        drawDoll(ctx, x, y0 + tierH * 0.45, dollS, (i + d) % 3, bob);
      }
      // props on the lower tiers: hishimochi + peach / tachibana
      if (n === 0) {
        const m = 4;
        for (let k = 0; k < m; k++) {
          const x = cx - wTop / 2 + wTop * ((k + 0.5) / m);
          const y = y0 + tierH * 0.55;
          const s = 10 * scale;
          for (let b = 0; b < 3; b++) {
            ctx.fillStyle = [GREEN, CREAM, PINKS[1]!][b]!;
            ctx.beginPath();
            ctx.moveTo(x, y - b * s * 0.5 - s * 0.5);
            ctx.lineTo(x + s, y - b * s * 0.5);
            ctx.lineTo(x, y - b * s * 0.5 + s * 0.5);
            ctx.lineTo(x - s, y - b * s * 0.5);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
    // bonbori on the top tier
    const glow = Math.min(1, input.bass * 0.7 + input.beatPulse * 0.5);
    drawBonbori(ctx, cx - w * 0.2, top + tierH * 0.6, 22 * scale, glow);
    drawBonbori(ctx, cx + w * 0.2, top + tierH * 0.6, 22 * scale, glow);
    ctx.restore();
    // gold flash on strong onsets
    if (input.onset && input.intensity > 0.6 && t - danLastFlash > 0.25) danLastFlash = t;
    const since = t - danLastFlash;
    if (since >= 0 && since < 0.12) {
      ctx.globalAlpha = (1 - since / 0.12) * 0.35;
      ctx.fillStyle = GOLD;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    // a few petals in front
    if (petals.length === 0) seedPetals(w, h);
    for (let i = 0; i < 60; i++) {
      const p = petals[i]!;
      p.y += (20 + input.intensity * 40) * input.dt;
      p.x += Math.sin(t + p.phase) * 20 * input.dt;
      p.rot += p.vr * input.dt;
      if (p.y > h + 20) p.y = -20;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = PINKS[p.c]!;
      ctx.globalAlpha = 0.6;
      petalPath(ctx, p.s * scale * 0.7);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
};

export const HINA_2D: Scene[] = [hinaPetals, hinaDan];
