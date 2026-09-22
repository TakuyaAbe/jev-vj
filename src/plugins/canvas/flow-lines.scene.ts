import { defineCanvasScene } from '../api';

/**
 * Flow field: particles drift along a slowly morphing angle field and leave
 * long soft trails. Bass bends the field, each bar rotates it a little, and
 * intensity sets how many particles move and how fast.
 */
const MAX = 700;
const px = new Float32Array(MAX);
const py = new Float32Array(MAX);
const life = new Float32Array(MAX);
let inited = false;
let fieldRot = 0;
let fieldTarget = 0;
let lastBar = -1;
let clock = 0;
let lastBeat = -1;
let sinceWipe = 0;

function field(x: number, y: number, t: number, bend: number): number {
  return (
    Math.sin(x * 2.1 + t * 0.21) * 1.3 +
    Math.cos(y * 2.7 - t * 0.17) * 1.1 +
    Math.sin((x + y) * 4.3 + t * 0.4) * (0.35 + bend * 1.2)
  );
}

function respawn(i: number): void {
  px[i] = Math.random();
  py[i] = Math.random();
  life[i] = 2 + Math.random() * 6;
}

export default defineCanvasScene({
  id: 'flow_lines',
  name: 'Flow Lines',
  description:
    '風の流れを可視化したような流線。無数の細い線が見えない力場に沿ってゆっくり漂い、長い残像を描く。低音で流れがうねり、小節ごとに風向きが少しずつ変わる。静かで瞑想的、余白が多い。アンビエントなイントロ、アウトロ、パッドだけのブレイクに合う',
  short: '風のように漂う流線。静か・瞑想的。イントロ・アウトロ',
  group: '2d',
  reset() {
    inited = false;
    fieldRot = 0;
    fieldTarget = 0;
    lastBar = -1;
    clock = 0;
    lastBeat = -1;
    sinceWipe = 0;
  },
  render(ctx, input) {
    const { w, h, palette, intensity } = input;
    if (!inited) {
      for (let i = 0; i < MAX; i++) respawn(i);
      inited = true;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, w, h);
    }
    if (input.bar !== lastBar) {
      lastBar = input.bar;
      fieldTarget += (Math.random() - 0.5) * (0.4 + intensity);
    }
    fieldRot += (fieldTarget - fieldRot) * Math.min(1, input.dt * 0.8);
    clock += input.dt * (0.3 + intensity * 0.9);

    // long trails when calm, shorter when busy. A small per-frame fade alone leaves an 8-bit
    // residue (~0.5/alpha levels) that never clears, so ghosts of the previous scene linger;
    // a stronger wipe on each beat (or every 0.6 s without a beat) clears it and breathes with the music.
    ctx.globalCompositeOperation = 'source-over';
    sinceWipe += input.dt;
    const wipe = input.beat !== lastBeat || sinceWipe > 0.6;
    lastBeat = input.beat;
    if (wipe) sinceWipe = 0;
    ctx.globalAlpha = wipe ? 0.2 : 0.02 + 0.07 * intensity;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    const n = Math.floor(MAX * (0.3 + 0.7 * intensity));
    const speed = (0.06 + 0.14 * intensity) * (1 + input.bass * 0.8 + input.beatPulse * 0.6 * intensity);
    const aspect = w / h;
    const bend = input.bass;
    const step = Math.min(0.05, input.dt) * speed;
    const colors = [palette.a, palette.b, palette.c];
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let c = 0; c < 3; c++) {
      ctx.strokeStyle = colors[c]!;
      ctx.lineWidth = (c === 2 ? 1.2 + input.high * 1.5 : 1.8 + input.mid * 1.5) * Math.max(1, h / 1080);
      ctx.globalAlpha = c === 2 ? 0.75 + 0.25 * input.beatPulse : 0.8;
      ctx.beginPath();
      for (let i = c; i < n; i += 3) {
        const x = px[i]!;
        const y = py[i]!;
        const a = field(x * aspect, y, clock, bend) + fieldRot;
        const nx = x + Math.cos(a) * step / aspect;
        const ny = y + Math.sin(a) * step;
        ctx.moveTo(x * w, y * h);
        ctx.lineTo(nx * w, ny * h);
        px[i] = nx;
        py[i] = ny;
        life[i] = life[i]! - input.dt;
        if (life[i]! <= 0 || nx < -0.02 || nx > 1.02 || ny < -0.02 || ny > 1.02) respawn(i);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
});
