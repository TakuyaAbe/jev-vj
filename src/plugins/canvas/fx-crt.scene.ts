import { defineCanvasEffect } from '../api';

/**
 * CRT look: horizontal scanlines, a rolling brighter band, a slight flicker on
 * highs and a dark vignette. Pattern and gradient are cached per size so the
 * cost is a few full-screen fills.
 */
let pattern: CanvasPattern | null = null;
let patternCtx: CanvasRenderingContext2D | null = null;
let patternPitch = 0;
let vignette: CanvasGradient | null = null;
let vigKey = '';
let roll = 0;

function scanPattern(ctx: CanvasRenderingContext2D, pitch: number): CanvasPattern | null {
  if (pattern && patternCtx === ctx && patternPitch === pitch) return pattern;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = pitch;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#000';
  g.fillRect(0, pitch - Math.max(1, Math.floor(pitch / 3)), 4, Math.max(1, Math.floor(pitch / 3)));
  pattern = ctx.createPattern(c, 'repeat');
  patternCtx = ctx;
  patternPitch = pitch;
  return pattern;
}

export default defineCanvasEffect({
  id: 'crt_scan',
  name: 'CRT Scanlines',
  description: 'ブラウン管モニター風。走査線、ゆっくり流れる明るい帯、高域でのちらつき、四隅の減光。懐かしくローファイな質感。ローファイ、チル、シンセウェイヴ、イントロに合う',
  short: 'ブラウン管の走査線と減光。ローファイ・チル',
  apply(ctx, input, amount) {
    const { w, h } = input;
    const pitch = Math.max(3, Math.round(h / 270));
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // scanlines
    const pat = scanPattern(ctx, pitch);
    if (pat) {
      ctx.globalAlpha = 0.45 * amount;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }

    // rolling band
    roll = (roll + input.dt * (0.08 + 0.2 * input.intensity)) % 1.2;
    const by = (roll - 0.1) * h;
    const bh = h * 0.12;
    const band = ctx.createLinearGradient(0, by - bh, 0, by + bh);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,1)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.05 * amount;
    ctx.fillStyle = band;
    ctx.fillRect(0, by - bh, w, bh * 2);

    // flicker on highs / beat
    const flick = (Math.random() - 0.5) * input.high * 0.08 + input.beatPulse * 0.03 * input.intensity;
    if (Math.abs(flick) > 0.005) {
      ctx.globalCompositeOperation = flick > 0 ? 'lighter' : 'source-over';
      ctx.globalAlpha = Math.abs(flick) * amount;
      ctx.fillStyle = flick > 0 ? input.palette.a : '#000';
      ctx.fillRect(0, 0, w, h);
    }

    // vignette
    const key = `${w}x${h}`;
    if (!vignette || vigKey !== key) {
      vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.56);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.7, 'rgba(0,0,0,0.45)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.95)');
      vigKey = key;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = amount;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  },
  reset() {
    roll = 0;
  },
});
