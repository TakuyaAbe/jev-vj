import { defineCanvasEffect } from '../api';

/**
 * Beat zoom-punch: the finished stage is redrawn onto itself slightly scaled up
 * (with a faint larger echo) so every kick "hits" the camera. The punch follows
 * beatPulse; `amount` is the strength. Scaled around the centre, tiny tilt on
 * alternate beats.
 */
let copy: HTMLCanvasElement | null = null;
let cctx: CanvasRenderingContext2D | null = null;

function snapshot(src: HTMLCanvasElement): HTMLCanvasElement | null {
  if (!copy) {
    copy = document.createElement('canvas');
    cctx = copy.getContext('2d');
  }
  if (!cctx) return null;
  if (copy.width !== src.width || copy.height !== src.height) {
    copy.width = src.width;
    copy.height = src.height;
  }
  cctx.globalCompositeOperation = 'copy';
  cctx.drawImage(src, 0, 0);
  return copy;
}

export default defineCanvasEffect({
  id: 'zoom_punch',
  name: 'Zoom Punch',
  description: 'ビートごとに画面全体がズームで殴られるように跳ねる。キックの重さが体感できる。4つ打ちのドロップ、ヒップホップのキックに合う',
  short: 'キックで画面がズームパンチ。ドロップ',
  apply(ctx, input, amount) {
    const p = input.beatPulse * input.beatPulse;
    const z = amount * (0.012 + p * (0.05 + 0.05 * input.bass));
    if (z < 0.002) return;
    const src = snapshot(ctx.canvas);
    if (!src) return;
    const { w, h } = input;
    const tilt = (input.beat % 2 === 0 ? 1 : -1) * p * amount * 0.012 * input.intensity;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(tilt);
    ctx.scale(1 + z, 1 + z);
    ctx.globalAlpha = 1;
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    // radial motion-blur echo
    ctx.scale(1 + z * 0.8, 1 + z * 0.8);
    ctx.globalAlpha = 0.28 * Math.min(1, p * 1.5);
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  },
});
