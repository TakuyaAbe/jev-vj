export interface FrameFeatures {
  /** AudioContext time in seconds */
  t: number;
  /** overall loudness 0..1, relative to the recent peak (auto-gain) */
  rms: number;
  /** overall loudness 0..1 on a fixed dB scale (no auto-gain) */
  rawRms: number;
  sub: number;
  bass: number;
  lowmid: number;
  mid: number;
  high: number;
  /** spectral centroid in Hz */
  centroid: number;
  /** spectral flux (onset strength), unnormalized */
  flux: number;
  /** flux restricted to < 250 Hz, for downbeat tracking */
  bassFlux: number;
  onset: boolean;
  wave: Float32Array;
  /** smoothed FFT magnitudes as bytes (like AnalyserNode.getByteFrequencyData), 1024 bins up to Nyquist */
  spectrum: Uint8Array;
}

export interface BeatInfo {
  bpm: number;
  confidence: number;
  /** 0..1 within the current beat */
  beatPhase: number;
  /** 0..1 within the current bar (4 beats) */
  barPhase: number;
  beatInBar: number;
  /** monotone bar counter since play start */
  bar: number;
  /** 1 on the beat, decays toward 0 */
  beatPulse: number;
  locked: boolean;
}

export interface BarSummary {
  bar: number;
  energy: number;
  rawRms: number;
  sub: number;
  bass: number;
  /** 20th percentile of bass within the bar: high = sustained bassline, low = kick only */
  bassFloor: number;
  lowmid: number;
  mid: number;
  high: number;
  centroid: number;
  onsets: number;
}

/** Built-in ids plus any plugin id (ISF / Shadertoy / GLSL / three.js / canvas files). */
export type SceneId = string;
/** picker grouping. Known: '2d' canvas, 'gl' shader / three.js, 'hina' ひな祭り素材, 'isf', 'shadertoy', 'user' (dropped at runtime) */
export type SceneGroup = string;
export type PaletteId = 'warm' | 'cold' | 'neon' | 'mono' | 'acid' | 'hina';
export type TransitionId = 'cut' | 'crossfade' | 'flash';
export type PhaseId = 'intro' | 'build' | 'drop' | 'breakdown' | 'steady' | 'outro';

export interface Palette {
  bg: string;
  a: string;
  b: string;
  c: string;
}

export interface RenderInput {
  t: number;
  dt: number;
  w: number;
  h: number;
  energy: number;
  sub: number;
  bass: number;
  mid: number;
  high: number;
  beatPhase: number;
  beatPulse: number;
  barPhase: number;
  onset: boolean;
  /** 0..1, from Jev's intensity score */
  intensity: number;
  palette: Palette;
  wave: Float32Array;
  /** 1024-bin FFT bytes (0..255), smoothed like Shadertoy's audio input */
  spectrum: Uint8Array;
  /** monotone bar / beat counters and tempo from the beat tracker */
  bar: number;
  beat: number;
  bpm: number;
}

export interface Scene {
  id: SceneId;
  name: string;
  /** Japanese description sent to Jev as the choice criterion */
  description: string;
  /** code-side cap: force a switch after this many bars (default 32) */
  maxBars?: number;
  group: SceneGroup;
  /** ~30-character criterion sent to Jev instead of the full description */
  short?: string;
  /** 年中行事 scenes: the month (1..12) the event belongs to; they also form the 'nenju' preset */
  month?: number;
  /** where it came from: bundled plugin file path or dropped file name (built-ins leave it unset) */
  source?: string;
  /** set when the scene failed to compile; the director skips it */
  error?: string;
  render(ctx: CanvasRenderingContext2D, input: RenderInput): void;
  /** clear per-set state (particles, feedback buffers) on a fresh start */
  reset?(): void;
  /** build GPU resources / compile shaders ahead of time; returns an error message or null */
  prepare?(): string | null;
}

/** A post-process over the whole stage (ISF filters, canvas effects). */
export interface Effect {
  id: string;
  name: string;
  description: string;
  short?: string;
  source?: string;
  error?: string;
  /** process the stage in place; amount 0..1 is the wet mix / strength */
  apply(ctx: CanvasRenderingContext2D, input: RenderInput, amount: number): void;
  reset?(): void;
  prepare?(): string | null;
}
