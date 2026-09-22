import { defineCanvasScene } from '../api';

/**
 * Retro hardware rack: two analog VU needles on top, a 32-band LED
 * spectrum analyzer with peak-hold below. Bars are batched into one path
 * per colour and the LED gaps are punched out afterwards.
 */
const BANDS = 32;
const SEGS = 18;
const level = new Float32Array(BANDS);
const peak = new Float32Array(BANDS);
const peakHold = new Float32Array(BANDS);
let needleL = 0;
let needleR = 0;
let velL = 0;
let velR = 0;
const edges: number[] = [];
for (let i = 0; i <= BANDS; i++) edges.push(Math.round(2 * Math.pow(700 / 2, i / BANDS)));

function bandValue(spec: Uint8Array, i: number): number {
  const a = edges[i]!;
  const b = Math.max(a + 1, edges[i + 1]!);
  let m = 0;
  for (let k = a; k < b; k++) m = Math.max(m, spec[k] ?? 0);
  // gentle tilt so highs are not always empty
  return Math.min(1, (m / 255) * (0.85 + (i / BANDS) * 0.45));
}

function drawNeedle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, v: number, input: { palette: { a: string; b: string; c: string; bg: string } }, label: string): void {
  const p = input.palette;
  const a0 = Math.PI * 1.22;
  const a1 = Math.PI * 1.78;
  // scale arc + ticks
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.strokeStyle = p.b;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * 0.72);
  ctx.stroke();
  ctx.strokeStyle = p.c;
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0 + (a1 - a0) * 0.72, a1);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.015);
  ctx.strokeStyle = p.b;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = a0 + ((a1 - a0) * i) / 10;
    const r0 = r * (i % 5 === 0 ? 0.84 : 0.9);
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.fillStyle = p.b;
  ctx.globalAlpha = 0.7;
  ctx.font = `600 ${Math.round(r * 0.13)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('VU', cx, cy - r * 0.35);
  ctx.fillText(label, cx, cy - r * 0.18);
  ctx.textAlign = 'start';
  // needle
  const a = a0 + (a1 - a0) * Math.max(0, Math.min(1.04, v));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.a;
  ctx.lineWidth = Math.max(1.5, r * 0.022);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02);
  ctx.stroke();
  ctx.fillStyle = p.a;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

export default defineCanvasScene({
  id: 'vu_rack',
  name: 'VU Rack',
  description:
    '70〜80年代のオーディオ機材を思わせるラック。上段にアナログ VU メーターの針が二本揺れ、下段では 32 バンドの LED スペクトラムアナライザーが点灯しピークが残る。実直でアナログ、機材好きの温かみ。ヒップホップやファンク、ディスコの安定したグルーヴ、生音寄りの曲に合う',
  short: 'レトロ機材のVU針とLEDメーター。温かい。ヒップホップ・ファンク',
  group: '2d',
  reset() {
    level.fill(0);
    peak.fill(0);
    peakHold.fill(0);
    needleL = needleR = velL = velR = 0;
  },
  render(ctx, input) {
    const { w, h, palette, intensity } = input;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    const m = Math.min(w, h) * 0.05;
    // panel frame + screws
    ctx.strokeStyle = palette.b;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
    ctx.fillStyle = palette.b;
    ctx.beginPath();
    for (const [sx, sy] of [
      [m * 1.6, m * 1.6],
      [w - m * 1.6, m * 1.6],
      [m * 1.6, h - m * 1.6],
      [w - m * 1.6, h - m * 1.6],
    ] as const) {
      ctx.moveTo(sx + m * 0.25, sy);
      ctx.arc(sx, sy, m * 0.25, 0, Math.PI * 2);
    }
    ctx.fill();

    // needles: spring-damper so they overshoot like real VU ballistics
    const wave = input.wave;
    let sL = 0;
    let sR = 0;
    const half = wave.length >> 1;
    for (let i = 0; i < half; i += 4) sL += Math.abs(wave[i] ?? 0);
    for (let i = half; i < wave.length; i += 4) sR += Math.abs(wave[i] ?? 0);
    const norm = 4 / Math.max(1, half);
    const tL = Math.min(1.05, sL * norm * 2.2 * (0.6 + intensity * 0.6) + input.bass * 0.25);
    const tR = Math.min(1.05, sR * norm * 2.2 * (0.6 + intensity * 0.6) + input.bass * 0.25);
    const dt = Math.min(0.05, input.dt);
    velL += ((tL - needleL) * 90 - velL * 11) * dt;
    velR += ((tR - needleR) * 90 - velR * 11) * dt;
    needleL += velL * dt;
    needleR += velR * dt;

    const topH = (h - 2 * m) * 0.42;
    const r = Math.min((w - 2 * m) * 0.2, topH * 0.8);
    drawNeedle(ctx, w * 0.3, m + topH * 0.95, r, needleL, input, 'L');
    drawNeedle(ctx, w * 0.7, m + topH * 0.95, r, needleR, input, 'R');

    // LED analyzer
    const ax = m * 2.2;
    const ay = m + topH + m * 0.8;
    const aw = w - ax * 2;
    const ah = h - ay - m * 2.2;
    const bw = aw / BANDS;
    const sh = ah / SEGS;
    const fall = dt * (0.8 + 1.6 * (1 - intensity));
    for (let i = 0; i < BANDS; i++) {
      const v = bandValue(input.spectrum, i) * (0.7 + 0.3 * intensity + 0.2 * input.beatPulse);
      level[i] = v > level[i]! ? v : Math.max(v, level[i]! - fall * 1.6);
      if (level[i]! >= peak[i]!) {
        peak[i] = level[i]!;
        peakHold[i] = 0.6;
      } else {
        peakHold[i] = peakHold[i]! - dt;
        if (peakHold[i]! < 0) peak[i] = Math.max(0, peak[i]! - fall * 0.6);
      }
    }
    // lit segments grouped by zone colour; unlit as dim ghost
    const zones: [number, number, string][] = [
      [0, Math.floor(SEGS * 0.6), palette.a],
      [Math.floor(SEGS * 0.6), Math.floor(SEGS * 0.85), palette.b],
      [Math.floor(SEGS * 0.85), SEGS, palette.c],
    ];
    // columns are drawn as solid bars, then the LED gaps are punched out with
    // background-coloured strips (~150 rects instead of one per segment)
    const gx = bw * 0.14;
    const gy = sh * 0.22;
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = palette.b;
    ctx.fillRect(ax, ay, aw, ah);
    ctx.globalAlpha = 1;
    for (const [z0, z1, col] of zones) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < BANDS; i++) {
        const top = Math.min(z1, Math.round(level[i]! * SEGS));
        if (top <= z0) continue;
        ctx.rect(ax + i * bw, ay + ah - top * sh, bw, (top - z0) * sh);
      }
      ctx.fill();
    }
    // peak-hold caps
    ctx.fillStyle = palette.c;
    ctx.beginPath();
    for (let i = 0; i < BANDS; i++) {
      const s = Math.min(SEGS - 1, Math.floor(peak[i]! * SEGS));
      if (s <= 0) continue;
      ctx.rect(ax + i * bw, ay + ah - (s + 1) * sh, bw, sh);
    }
    ctx.fill();
    ctx.fillStyle = palette.bg;
    ctx.beginPath();
    for (let s = 0; s <= SEGS; s++) ctx.rect(ax, ay + s * sh - gy, aw, gy * 2);
    for (let i = 0; i <= BANDS; i++) ctx.rect(ax + i * bw - gx, ay, gx * 2, ah);
    ctx.fill();

    // beat lamp + labels
    ctx.globalAlpha = 0.25 + 0.75 * input.beatPulse;
    ctx.fillStyle = palette.c;
    ctx.beginPath();
    ctx.arc(w - m * 2.6, m * 2.6, m * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = palette.b;
    ctx.font = `600 ${Math.round(m * 0.4)}px ui-monospace, Menlo, monospace`;
    ctx.fillText('JEV-VJ  SPECTRUM ANALYZER  MODEL 32', ax, ay - m * 0.3);
    ctx.fillText(`${input.bpm > 0 ? input.bpm.toFixed(1) : '---'} BPM`, w - m * 4.6, m * 2.75);
    ctx.globalAlpha = 1;
  },
});
