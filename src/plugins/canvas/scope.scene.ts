import { defineCanvasScene } from '../api';

let phase = 0;

/** XY oscilloscope: the waveform against a delayed copy of itself, with phosphor persistence. */
export default defineCanvasScene({
  id: 'scope',
  name: 'Oscilloscope',
  description: 'オシロスコープの XY 表示。波形と少し遅らせた波形で描くリサジュー図形が蛍光体の残像を残す。レトロで音そのものが見える。ミニマル、イントロ、ブレイクダウンに合う',
  short: 'オシロスコープのリサジュー。音が見える。イントロ・ブレイク',
  group: '2d',
  reset() {
    phase = 0;
  },
  render(ctx, input) {
    const { w, h, palette, wave } = input;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.18 + 0.2 * (1 - input.intensity);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    phase += input.dt * (0.2 + input.intensity);
    const s = Math.min(w, h) * (0.32 + input.energy * 0.25);
    const lag = 24 + Math.floor(40 * (0.5 + 0.5 * Math.sin(phase)));
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(phase * 0.3);
    ctx.globalCompositeOperation = 'lighter';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? palette.a : palette.c;
      ctx.lineWidth = pass === 0 ? 5 + input.bass * 8 : 1.2;
      ctx.globalAlpha = pass === 0 ? 0.25 : 0.9;
      ctx.beginPath();
      for (let i = 0; i < wave.length - lag; i += 2) {
        const x = (wave[i] ?? 0) * s * 2.2;
        const y = (wave[i + lag] ?? 0) * s * 2.2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
});
