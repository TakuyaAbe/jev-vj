import {staticFile} from 'remotion';

// Palette follows the app: near-black stage, mint accent (the panel's --acc), the MAGI orange, and
// the verdict colours of the CLI log.
export const COLORS = {
  bg: '#0a0b10',
  bg2: '#12141d',
  white: '#ffffff',
  fg: '#f2f2f7',
  dim: 'rgba(255,255,255,0.62)',
  line: 'rgba(255,255,255,0.12)',
  mint: '#7cf2c4',
  mintInk: '#06231a',
  orange: '#ff9a1f',
  red: '#ff3a2e',
  green: '#39ff88',
  amber: '#ffb547',
  yellow: '#ffe94d',
} as const;

// ---------------------------------------------------------------------------
// Font: one self-hosted variable TTF (public/fonts/NotoSansJP.ttf, fetched by
// `node fonts.mjs`) gated by <FontGate>, so every render worker draws every
// glyph with the same face (no per-frame fallback jitter).
// ---------------------------------------------------------------------------

export const FONT_FAMILY_NAME = 'Noto Sans JP Local';
export const FONT_FAMILY = `"${FONT_FAMILY_NAME}", "Hiragino Sans", sans-serif`;
export const MONO_FAMILY = `"SF Mono", Menlo, "${FONT_FAMILY_NAME}", monospace`;
export const FONT_FILE = 'fonts/NotoSansJP.ttf';

const FONT_FACE_STYLE_ID = 'jev-vj-noto-sans-jp-local';

const injectFontFace = () => {
  if (typeof document === 'undefined' || document.getElementById(FONT_FACE_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = FONT_FACE_STYLE_ID;
  style.textContent = `@font-face {
  font-family: "${FONT_FAMILY_NAME}";
  src: url("${staticFile(FONT_FILE)}") format("truetype");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}`;
  document.head.appendChild(style);
};

injectFontFace();

export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const FPS = 30;

/** The app is filmed at 1920x920; the caption band fills the 160 px below it. */
export const CAPTURE_HEIGHT = 920;
export const BAND_TOP = CAPTURE_HEIGHT;
export const BAND_HEIGHT = VIDEO_HEIGHT - CAPTURE_HEIGHT;

/** Cross-fade between the cards and the footage. */
export const TRANSITION_FRAMES = 15;
/** Narration starts this many frames into a card. */
export const NARRATION_DELAY_FRAMES = 10;
/** Narration starts this many frames into a step of the footage. */
export const STEP_NARRATION_DELAY_FRAMES = 6;
/** Chapter slate (the big chapter title over the footage) length. */
export const SLATE_FRAMES = 66;

// ---------------------------------------------------------------------------
// Audio levels (linear gain). Narration clips measure about -17 LUFS. The
// soft loop sits under the cards; the app's own demo track (exported by
// capture.mjs) takes over under the footage from the moment it is clicked.
// ---------------------------------------------------------------------------

export const AUDIO = {
  bgm: 0.2,
  bgmDucked: 0.08,
  demo: 0.2,
  demoDucked: 0.065,
  duckRampFrames: 9,
  sfx: {
    tap: 0.3,
    pop: 0.32,
    whoosh: 0.3,
  },
} as const;

export type SfxType = keyof typeof AUDIO.sfx;
