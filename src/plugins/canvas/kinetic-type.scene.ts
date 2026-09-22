import { defineCanvasScene } from '../api';

/**
 * Kinetic typography: one huge word slams in on every beat; each bar switches
 * layout (giant centre word / scrolling repeated rows / hex dump with a word cut in).
 * Low intensity only flips words every bar and keeps the hex dump dim.
 */
const WORDS = ['低音', '踊れ', 'もっと', '上げろ', '夜明け', '重低音', '鳴らせ', '跳べ', 'JEV', 'BASS', 'DROP', '爆音', '限界', '今夜', 'LOUD', '反響'];
const FONT = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif';

let lastBeat = -1;
let lastBar = -1;
let wordIdx = 0;
let layout = 0;
let punch = 0;
let scroll = 0;
let hexLines: string[] = [];
let hexSeed = 1;

function rnd(): number {
  hexSeed = (hexSeed * 1664525 + 1013904223) >>> 0;
  return hexSeed / 4294967296;
}

function hexLine(addr: number, spectrum: Uint8Array, off: number): string {
  let s = (addr & 0xffff).toString(16).padStart(4, '0').toUpperCase() + '  ';
  for (let i = 0; i < 8; i++) {
    const v = (spectrum[(off + i * 7) & 1023] ?? 0) ^ Math.floor(rnd() * 64);
    s += v.toString(16).padStart(2, '0').toUpperCase() + ' ';
  }
  return s;
}

function pickWord(): void {
  let n = Math.floor(rnd() * WORDS.length);
  if (n === wordIdx) n = (n + 1) % WORDS.length;
  wordIdx = n;
}

export default defineCanvasScene({
  id: 'kinetic_type',
  name: 'Kinetic Type',
  description:
    'キネティック・タイポグラフィ。「低音」「踊れ」「DROP」などの言葉がビートごとに画面いっぱいに叩きつけられ、小節ごとに巨大文字・流れる文字列・16進ダンプへ切り替わる。挑発的でクラブの煽りそのもの。ボーカルのないビルドアップの煽りや、声ネタが刺さるドロップに合う',
  short: 'ビートで叩きつける巨大な文字。煽り。ビルド・声ネタのドロップ',
  group: '2d',
  maxBars: 16,
  reset() {
    lastBeat = -1;
    lastBar = -1;
    wordIdx = 0;
    layout = 0;
    punch = 0;
    scroll = 0;
    hexLines = [];
    hexSeed = 1;
  },
  render(ctx, input) {
    const { w, h, palette, intensity } = input;
    const busy = intensity > 0.35;
    if (input.bar !== lastBar) {
      lastBar = input.bar;
      layout = intensity < 0.3 ? 2 : Math.floor(rnd() * 3);
      if (!busy) {
        pickWord();
        punch = 0.6;
      }
    }
    if (input.beat !== lastBeat) {
      lastBeat = input.beat;
      if (busy) {
        pickWord();
        punch = 1;
      }
    }
    punch = Math.max(0, punch - input.dt * (2 + 4 * intensity));
    scroll += input.dt * (40 + 400 * intensity) * (1 + input.bass);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    const word = WORDS[wordIdx] ?? 'JEV';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // background hex dump (always present, dim; layout 2 makes it the main element)
    const lh = Math.max(14, Math.round(h / 34));
    const rows = Math.ceil(h / lh) + 1;
    if (hexLines.length !== rows || (input.beat & 1) === 0) {
      // refresh a few lines per frame so the dump shimmers without rebuilding everything
      while (hexLines.length < rows) hexLines.push('');
      hexLines.length = rows;
      const n = 1 + Math.floor(intensity * 5 + input.high * 4);
      for (let k = 0; k < n; k++) {
        const r = Math.floor(rnd() * rows);
        hexLines[r] = hexLine(input.beat * 16 + r * 16, input.spectrum, Math.floor(rnd() * 1024));
      }
    }
    ctx.font = `500 ${lh * 0.8}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = palette.b;
    ctx.globalAlpha = layout === 2 ? 0.55 : 0.14 + 0.1 * intensity;
    const yOff = (scroll * 0.2) % lh;
    for (let r = 0; r < rows; r++) {
      const line = hexLines[r];
      if (!line) continue;
      ctx.fillText(line, lh, r * lh - yOff);
      if (w > 900) ctx.fillText(line, w * 0.55, r * lh - yOff);
    }
    ctx.textAlign = 'center';

    const k = 1 + punch * punch * (0.25 + 0.35 * intensity);
    if (layout === 1) {
      // repeated rows scrolling in alternating directions
      const size = h / 5.2;
      ctx.font = `900 ${size}px ${FONT}`;
      const tw = Math.max(1, ctx.measureText(word + '　').width);
      for (let r = 0; r < 5; r++) {
        const y = (r + 0.5) * (h / 5);
        const dir = r % 2 === 0 ? 1 : -1;
        let x0 = ((scroll * dir * (0.6 + r * 0.15)) % tw) - tw;
        ctx.fillStyle = r === 2 ? palette.c : r % 2 === 0 ? palette.a : palette.b;
        ctx.globalAlpha = r === 2 ? 0.7 + 0.3 * punch : 0.35 + 0.3 * input.beatPulse;
        ctx.textAlign = 'left';
        for (; x0 < w; x0 += tw) ctx.fillText(word, x0, y);
      }
      ctx.textAlign = 'center';
    } else {
      // giant centre word; outline echo trails behind it
      const size = Math.min(w / Math.max(2, word.length * 0.95), h * 0.62) * (layout === 2 ? 0.55 : 1);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const skew = (input.beatPhase < 0.5 ? 1 : -1) * punch * 0.15 * intensity;
      ctx.transform(1, 0, skew, 1, 0, 0);
      ctx.scale(k, k);
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.lineWidth = Math.max(1.5, size * 0.012);
      for (let e = 3; e >= 1; e--) {
        ctx.strokeStyle = e === 1 ? palette.b : palette.a;
        ctx.globalAlpha = (0.12 + 0.25 * punch) / e;
        const s = 1 + e * 0.08 * (0.3 + input.bass);
        ctx.save();
        ctx.scale(s, s);
        ctx.strokeText(word, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 0.85 + 0.15 * punch;
      ctx.fillStyle = punch > 0.85 && intensity > 0.7 ? palette.c : palette.a;
      ctx.fillText(word, 0, 0);
      ctx.restore();
    }

    // HUD strip: bpm / bar counter
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = palette.c;
    ctx.font = `700 ${lh}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'left';
    const bpm = input.bpm > 0 ? input.bpm.toFixed(1) : '---.-';
    ctx.fillText(`${bpm} BPM  BAR ${String(input.bar).padStart(4, '0')}  ${'■'.repeat(1 + Math.floor(input.barPhase * 4))}`, lh, h - lh);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  },
});
