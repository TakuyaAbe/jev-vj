import { defineCanvasScene } from '../api';

/**
 * Bouncy geometric shapes: circles, triangles, squares and crosses fall and
 * bounce off the floor and walls. Each beat drops a new shape and squashes the
 * rest; kicks throw everything upward. Intensity sets gravity and population.
 */
type Kind = 0 | 1 | 2 | 3;
interface Shape {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  kind: Kind;
  col: number;
  pop: number;
  squash: number;
}

const MAX = 36;
let shapes: Shape[] = [];
let lastBeat = -1;
let lastBar = -1;
let kick = 0;

function spawn(w: number, h: number, big: boolean): Shape {
  const r = Math.min(w, h) * (big ? 0.07 + Math.random() * 0.05 : 0.025 + Math.random() * 0.04);
  return {
    x: r + Math.random() * (w - 2 * r),
    y: -r,
    vx: (Math.random() - 0.5) * w * 0.4,
    vy: Math.random() * h * 0.2,
    r,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 4,
    kind: Math.floor(Math.random() * 4) as Kind,
    col: Math.floor(Math.random() * 3),
    pop: 1,
    squash: 0,
  };
}

function path(ctx: CanvasRenderingContext2D, k: Kind, r: number): void {
  if (k === 0) {
    ctx.moveTo(r, 0);
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else if (k === 1) {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      if (i === 0) ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
      else ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
    }
    ctx.closePath();
  } else if (k === 2) {
    ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
  } else {
    const t = r * 0.34;
    ctx.moveTo(-t, -r);
    ctx.lineTo(t, -r);
    ctx.lineTo(t, -t);
    ctx.lineTo(r, -t);
    ctx.lineTo(r, t);
    ctx.lineTo(t, t);
    ctx.lineTo(t, r);
    ctx.lineTo(-t, r);
    ctx.lineTo(-t, t);
    ctx.lineTo(-r, t);
    ctx.lineTo(-r, -t);
    ctx.lineTo(-t, -t);
    ctx.closePath();
  }
}

export default defineCanvasScene({
  id: 'beat_shapes',
  name: 'Beat Shapes',
  description:
    '丸・三角・四角・十字のカラフルな図形がビートごとに降ってきて、床や壁で弾む。キックで全体が跳ね上がり、着地でむにっと潰れる。ポップで陽気、おもちゃ箱のような楽しさ。ポップス、ファンキーハウス、ディスコなど明るく跳ねるグルーヴのサビや安定部に合う',
  short: 'ポップな図形が弾んで跳ねる。陽気。ポップ・ファンキーなサビ',
  group: '2d',
  maxBars: 24,
  reset() {
    shapes = [];
    lastBeat = -1;
    lastBar = -1;
    kick = 0;
  },
  render(ctx, input) {
    const { w, h, palette, intensity } = input;
    const dt = Math.min(0.05, input.dt);
    const target = Math.round(6 + intensity * (MAX - 6));

    if (input.beat !== lastBeat) {
      lastBeat = input.beat;
      if (shapes.length < target && (intensity > 0.3 || input.beat % 2 === 0)) shapes.push(spawn(w, h, input.bass > 0.6));
      else if (shapes.length > target) shapes.shift();
      for (const s of shapes) s.pop = 1;
      // kick: throw grounded shapes up, harder with bass and intensity
      kick = input.bass * (0.4 + intensity);
      for (const s of shapes) if (s.y > h - s.r * 1.5) s.vy -= h * (0.6 + 1.4 * kick) * (0.5 + Math.random() * 0.5);
    }
    if (input.bar !== lastBar) {
      lastBar = input.bar;
      // recolour one kind per bar so the palette rotates through the crowd
      const k = input.bar % 4;
      for (const s of shapes) if (s.kind === k) s.col = (s.col + 1) % 3;
    }

    const g = h * (0.6 + 2.2 * intensity);
    for (const s of shapes) {
      s.vy += g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt * (0.4 + intensity);
      if (s.y > h - s.r) {
        s.y = h - s.r;
        if (s.vy > h * 0.2) s.squash = Math.min(1, s.vy / (h * 2));
        s.vy = -s.vy * 0.62;
        s.vx *= 0.96;
      }
      if (s.x < s.r) {
        s.x = s.r;
        s.vx = Math.abs(s.vx);
      } else if (s.x > w - s.r) {
        s.x = w - s.r;
        s.vx = -Math.abs(s.vx);
      }
      s.pop = Math.max(0, s.pop - dt * 5);
      s.squash = Math.max(0, s.squash - dt * 4);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    // floor line pulses with the beat
    ctx.fillStyle = palette.b;
    ctx.globalAlpha = 0.25 + 0.5 * input.beatPulse;
    ctx.fillRect(0, h - 3 - 6 * input.beatPulse, w, 3 + 6 * input.beatPulse);

    const cols = [palette.a, palette.b, palette.c];
    // shadows first (one path), then bodies grouped by colour
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = palette.b;
    ctx.beginPath();
    for (const s of shapes) {
      const d = Math.max(0.2, 1 - (h - s.y) / h);
      ctx.ellipse(s.x, h - 4, s.r * d, s.r * 0.18 * d, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = cols[c]!;
      ctx.strokeStyle = cols[(c + 1) % 3]!;
      ctx.lineWidth = 3;
      for (const s of shapes) {
        if (s.col !== c) continue;
        const sc = 1 + s.pop * s.pop * 0.25 * (0.4 + intensity);
        const sq = s.squash * 0.45;
        ctx.save();
        ctx.translate(s.x, s.y + s.r * sq * 0.5);
        ctx.scale(sc * (1 + sq), sc * (1 - sq));
        ctx.rotate(s.rot);
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        path(ctx, s.kind, s.r);
        ctx.fill();
        if (s.pop > 0.5) {
          ctx.globalAlpha = s.pop;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },
});
