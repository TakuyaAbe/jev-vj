import { defineCanvasEffect } from '../api';

/**
 * Slice glitch: on onsets (and hard beats) the stage is cut into horizontal
 * slabs that jump sideways and decay back over a few frames; some slabs get a
 * palette-coloured 'difference' tint. Reads the stage through an offscreen copy.
 */
interface Slice {
  y: number;
  h: number;
  dx: number;
  tint: boolean;
}

let copy: HTMLCanvasElement | null = null;
let cctx: CanvasRenderingContext2D | null = null;
let slices: Slice[] = [];
let life = 0;
let lastBeat = -1;

function trigger(w: number, h: number, strength: number): void {
  const n = 3 + Math.floor(Math.random() * (4 + 8 * strength));
  slices = [];
  for (let i = 0; i < n; i++) {
    const sh = h * (0.01 + Math.random() * 0.09);
    slices.push({
      y: Math.random() * (h - sh),
      h: sh,
      dx: (Math.random() - 0.5) * w * (0.03 + 0.22 * strength),
      tint: Math.random() < 0.25,
    });
  }
  life = 1;
}

export default defineCanvasEffect({
  id: 'slice_glitch',
  name: 'Slice Glitch',
  description: '音の立ち上がりで画面が横長の短冊に切れて左右にずれ、一部が反転色に染まる。デジタルの破綻感、攻撃的。グリッチ、ブレイクビーツ、ベースミュージックのフィルやドロップ直前に合う',
  short: '立ち上がりで画面が横にずれるグリッチ。フィル・ドロップ前',
  apply(ctx, input, amount) {
    const { w, h } = input;
    const strength = Math.min(1, amount * (0.4 + 0.8 * input.intensity));
    const beatHit = input.beat !== lastBeat && input.bass > 0.7 && input.intensity > 0.5;
    lastBeat = input.beat;
    if ((input.onset && Math.random() < 0.35 + 0.5 * strength) || beatHit) trigger(w, h, strength);
    life = Math.max(0, life - input.dt * (6 - 3 * input.intensity));
    if (life <= 0.01 || slices.length === 0) return;

    if (!copy) {
      copy = document.createElement('canvas');
      cctx = copy.getContext('2d');
    }
    if (!cctx) return;
    if (copy.width !== ctx.canvas.width || copy.height !== ctx.canvas.height) {
      copy.width = ctx.canvas.width;
      copy.height = ctx.canvas.height;
    }
    cctx.globalCompositeOperation = 'copy';
    cctx.drawImage(ctx.canvas, 0, 0);

    const sx = copy.width / w;
    const sy = copy.height / h;
    const k = life * life * amount;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const s of slices) {
      const dx = s.dx * k;
      ctx.drawImage(copy, 0, s.y * sy, copy.width, s.h * sy, dx, s.y, w, s.h);
      // fill the gap the shift exposes with the opposite edge (wraparound)
      if (dx > 0) ctx.drawImage(copy, (w - dx) * sx, s.y * sy, dx * sx, s.h * sy, 0, s.y, dx, s.h);
      else if (dx < 0) ctx.drawImage(copy, 0, s.y * sy, -dx * sx, s.h * sy, w + dx, s.y, -dx, s.h);
    }
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = input.palette.c;
    ctx.globalAlpha = Math.min(1, k * 1.2);
    for (const s of slices) if (s.tint) ctx.fillRect(0, s.y, w, s.h);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
  reset() {
    slices = [];
    life = 0;
    lastBeat = -1;
  },
});
