import type { BeatInfo, FrameFeatures } from './types';

const RATE = 50; // analysis ticks per second
const RING = 512; // ~10 s
const MIN_BPM = 70;
const MAX_BPM = 180;

/**
 * Tempo + beat phase from the onset envelope: autocorrelation for the period,
 * a decaying comb filter for the beat phase, and a 4-beat comb on the bass
 * flux for the downbeat. Re-estimated every 0.5 s once 4 s of audio exist.
 */
export class BeatTracker {
  private env = new Float32Array(RING);
  private bassEnv = new Float32Array(RING);
  private times = new Float64Array(RING);
  private head = 0;
  private count = 0;
  private sinceEstimate = 0;

  private period = 60 / 128;
  private beatRef = 0;
  private downbeatRef = 0;
  private lastBeatIndex = -1;
  private lastPulseT = -1;
  private barCounter = 0;
  private lastBeatInBar = -1;
  private pendingDownbeat: number | null = null;
  private pendingVotes = 0;

  bpm = 0;
  confidence = 0;
  locked = false;
  onBeat: ((info: BeatInfo) => void) | null = null;
  onBar: ((info: BeatInfo) => void) | null = null;

  reset(): void {
    this.env.fill(0);
    this.bassEnv.fill(0);
    this.head = 0;
    this.count = 0;
    this.sinceEstimate = 0;
    this.bpm = 0;
    this.confidence = 0;
    this.locked = false;
    this.lastBeatIndex = -1;
    this.barCounter = 0;
    this.lastBeatInBar = -1;
    this.pendingDownbeat = null;
    this.pendingVotes = 0;
  }

  push(f: FrameFeatures): void {
    // kick-weighted onset envelope: quarter-note kicks dominate 8th-note hats
    this.env[this.head] = f.flux + 2.5 * f.bassFlux;
    this.bassEnv[this.head] = f.bassFlux;
    this.times[this.head] = f.t;
    this.head = (this.head + 1) % RING;
    if (this.count < RING) this.count++;
    this.sinceEstimate++;
    if (this.count >= RATE * 4 && this.sinceEstimate >= RATE / 2) {
      this.sinceEstimate = 0;
      this.estimate();
    }
  }

  private at(arr: Float32Array, i: number): number {
    // i = 0 is the newest sample
    return arr[(this.head - 1 - i + RING * 2) % RING]!;
  }

  private timeAt(i: number): number {
    return this.times[(this.head - 1 - i + RING * 2) % RING]!;
  }

  private estimate(): void {
    const N = Math.min(this.count, RATE * 8);
    const x = new Float32Array(N);
    let mean = 0;
    for (let i = 0; i < N; i++) {
      // triangular smoothing so sharp onsets tolerate fractional-sample lags
      const a = this.at(this.env, Math.max(0, i - 1));
      const b = this.at(this.env, i);
      const c = this.at(this.env, Math.min(RING - 1, i + 1));
      x[i] = 0.25 * a + 0.5 * b + 0.25 * c;
      mean += x[i]!;
    }
    mean /= N;
    for (let i = 0; i < N; i++) x[i] = x[i]! - mean;

    const minLag = Math.floor((60 / MAX_BPM) * RATE);
    const maxLag = Math.ceil((60 / MIN_BPM) * RATE);
    const ac = new Float32Array(maxLag * 2 + 2);
    let ac0 = 0;
    for (let i = 0; i < N; i++) ac0 += x[i]! * x[i]!;
    if (ac0 <= 0) return;
    for (let lag = minLag; lag <= maxLag * 2 + 1 && lag < N; lag++) {
      let s = 0;
      for (let i = lag; i < N; i++) s += x[i]! * x[i - lag]!;
      ac[lag] = s / (N - lag);
    }
    ac0 /= N;
    const acAt = (lag: number): number => {
      const i = Math.floor(lag);
      const fr = lag - i;
      const a = ac[i] ?? 0;
      const b = ac[i + 1] ?? a;
      return a + (b - a) * fr;
    };
    let bestLag = minLag;
    let bestScore = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpmHere = (60 * RATE) / lag;
      // mild prior toward dance tempos (log-Gaussian around 125 BPM)
      const prior = Math.exp(-0.5 * (Math.log2(bpmHere / 125) / 0.6) ** 2);
      const score = (acAt(lag) + 0.5 * acAt(lag * 2) + 0.25 * acAt(lag * 3)) * (0.6 + 0.4 * prior);
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    // parabolic interpolation around the peak for a fractional lag
    const l = ac[bestLag - 1] ?? ac[bestLag]!;
    const c = ac[bestLag]!;
    const r = ac[bestLag + 1] ?? ac[bestLag]!;
    const denom = l - 2 * c + r;
    const frac = denom !== 0 ? (0.5 * (l - r)) / denom : 0;
    const lag = bestLag + Math.max(-0.5, Math.min(0.5, frac));
    const newPeriod = lag / RATE;
    const newBpm = 60 / newPeriod;
    const conf = Math.max(0, Math.min(1, c / ac0));

    if (this.bpm > 0 && Math.abs(newBpm - this.bpm) / this.bpm < 0.04) {
      this.bpm = 0.7 * this.bpm + 0.3 * newBpm;
    } else {
      this.bpm = newBpm;
    }
    this.period = 60 / this.bpm;
    this.confidence = conf;
    this.locked = conf > 0.15;

    // beat phase: comb over the recent envelope, newest weighted highest
    const P = this.period * RATE;
    const combLen = Math.min(N, RATE * 6);
    let bestOff = 0;
    let bestSum = -Infinity;
    for (let off = 0; off < P; off++) {
      let s = 0;
      let w = 1;
      for (let k = 0; ; k++) {
        const idx = Math.round(off + k * P);
        if (idx >= combLen) break;
        s += w * (this.at(this.env, idx) + 0.5 * (this.at(this.env, Math.max(0, idx - 1)) + this.at(this.env, idx + 1)));
        w *= 0.93;
      }
      if (s > bestSum) {
        bestSum = s;
        bestOff = off;
      }
    }
    const newBeatRef = this.timeAt(bestOff);
    // keep the beat counter monotone: express the new ref so it stays near the old grid
    if (this.beatRef === 0) this.beatRef = newBeatRef;
    else {
      const k = Math.round((newBeatRef - this.beatRef) / this.period);
      const drift = newBeatRef - (this.beatRef + k * this.period);
      this.beatRef += k * this.period + 0.5 * drift; // ease toward the new phase
    }

    // downbeat: 4-beat comb on bass flux, anchored on the beat grid
    let bestDb = 0;
    let bestDbSum = -Infinity;
    for (let b = 0; b < 4; b++) {
      let s = 0;
      let w = 1;
      for (let k = 0; ; k++) {
        const idx = Math.round(bestOff + (b + 4 * k) * P);
        if (idx >= combLen) break;
        s += w * (this.at(this.bassEnv, idx) + this.at(this.env, idx) * 0.3);
        w *= 0.9;
      }
      if (s > bestDbSum) {
        bestDbSum = s;
        bestDb = b;
      }
    }
    const candidate = this.timeAt(bestOff) - bestDb * this.period;
    if (this.downbeatRef === 0) {
      this.downbeatRef = candidate;
    } else {
      // only move the downbeat when two consecutive estimates agree
      const curBeatOfCandidate = Math.round((candidate - this.downbeatRef) / this.period) % 4;
      if (((curBeatOfCandidate % 4) + 4) % 4 !== 0) {
        if (this.pendingDownbeat !== null && Math.abs(this.pendingDownbeat - candidate) < this.period * 0.5) {
          this.pendingVotes++;
        } else {
          this.pendingDownbeat = candidate;
          this.pendingVotes = 1;
        }
        if (this.pendingVotes >= 2) {
          this.downbeatRef = candidate;
          this.pendingDownbeat = null;
          this.pendingVotes = 0;
        }
      } else {
        this.pendingDownbeat = null;
        this.pendingVotes = 0;
      }
    }
  }

  /** Evaluate the beat grid at time t (call every frame). */
  info(t: number): BeatInfo {
    if (this.bpm === 0 || this.beatRef === 0) {
      return { bpm: 0, confidence: 0, beatPhase: 0, barPhase: 0, beatInBar: 0, bar: this.barCounter, beatPulse: 0, locked: false };
    }
    const beatsSince = (t - this.beatRef) / this.period;
    const beatIndex = Math.floor(beatsSince);
    const beatPhase = beatsSince - beatIndex;
    const dbBeats = (t - this.downbeatRef) / this.period;
    const beatInBar = ((Math.floor(dbBeats) % 4) + 4) % 4;
    const barPhase = ((dbBeats % 4) + 4) % 4 / 4;

    let fired = false;
    if (beatIndex !== this.lastBeatIndex) {
      this.lastBeatIndex = beatIndex;
      this.lastPulseT = t;
      fired = true;
      if (beatInBar !== this.lastBeatInBar) {
        if (beatInBar === 0 && this.lastBeatInBar !== -1) this.barCounter++;
        this.lastBeatInBar = beatInBar;
      }
    }
    const beatPulse = this.lastPulseT < 0 ? 0 : Math.exp(-(t - this.lastPulseT) * 10);
    const info: BeatInfo = {
      bpm: this.bpm,
      confidence: this.confidence,
      beatPhase,
      barPhase,
      beatInBar,
      bar: this.barCounter,
      beatPulse,
      locked: this.locked,
    };
    if (fired) {
      this.onBeat?.(info);
      if (beatInBar === 0) this.onBar?.(info);
    }
    return info;
  }
}
