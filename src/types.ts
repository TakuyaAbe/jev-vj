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

export type SceneId =
  | 'particles'
  | 'tunnel'
  | 'grid'
  | 'strobe'
  | 'kaleido'
  | 'waves'
  | 'warp'
  | 'lattice'
  | 'julia'
  | 'voronoi'
  | 'galaxy'
  | 'terrain'
  | 'hina_petals'
  | 'hina_dan'
  | 'hina_mochi'
  | 'seigaiha'
  | 'hina_dan3d';
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
}

export interface Scene {
  id: SceneId;
  name: string;
  /** Japanese description sent to Jev as the choice criterion */
  description: string;
  /** code-side cap: force a switch after this many bars (default 32) */
  maxBars?: number;
  /** picker grouping: '2d' canvas, 'gl' shader / three.js, 'hina' ひな祭り素材 */
  group: '2d' | 'gl' | 'hina';
  render(ctx: CanvasRenderingContext2D, input: RenderInput): void;
}
