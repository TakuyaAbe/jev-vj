import type { BarSummary, FrameFeatures } from './types';

export type JumpKind = 'drop' | 'cut';

export interface Jump {
  kind: JumpKind;
  /** true when the kick returns after a gap bar: safe to fire a pre-armed cut */
  strong: boolean;
}

interface Acc {
  n: number;
  rms: number;
  rawRms: number;
  bassSamples: number[];
  sub: number;
  bass: number;
  lowmid: number;
  mid: number;
  high: number;
  centroid: number;
  onsets: number;
}

const emptyAcc = (): Acc => ({ n: 0, rms: 0, rawRms: 0, bassSamples: [], sub: 0, bass: 0, lowmid: 0, mid: 0, high: 0, centroid: 0, onsets: 0 });

/**
 * Folds 50 Hz frames into per-bar summaries and watches the bar in progress
 * for sudden energy jumps (drop / cut) that should trigger code-side actions
 * before the next scheduled Jev call.
 */
export class BarAggregator {
  readonly history: BarSummary[] = [];
  private acc = emptyAcc();
  private currentBar = -1;
  private jumpFiredForBar = -1;
  /** loudest bar energy seen so far (slowly decays) */
  peakEnergy = 0.2;
  peakBass = 0.2;

  reset(): void {
    this.history.length = 0;
    this.acc = emptyAcc();
    this.currentBar = -1;
    this.jumpFiredForBar = -1;
    this.peakEnergy = 0.2;
    this.peakBass = 0.2;
    this.high = false;
    this.highLevel = 0;
  }

  /** Returns a completed BarSummary when the bar index advances. */
  push(f: FrameFeatures, bar: number): BarSummary | null {
    let completed: BarSummary | null = null;
    if (bar !== this.currentBar) {
      if (this.currentBar >= 0 && this.acc.n > 0) {
        completed = this.finish(this.currentBar);
      }
      this.currentBar = bar;
      this.acc = emptyAcc();
    }
    const a = this.acc;
    a.n++;
    a.rms += f.rms;
    a.rawRms += f.rawRms;
    a.sub += f.sub;
    a.bass += f.bass;
    a.bassSamples.push(f.bass);
    a.lowmid += f.lowmid;
    a.mid += f.mid;
    a.high += f.high;
    a.centroid += f.centroid;
    if (f.onset) a.onsets++;
    return completed;
  }

  private finish(bar: number): BarSummary {
    const a = this.acc;
    const s: BarSummary = {
      bar,
      energy: a.rms / a.n,
      rawRms: a.rawRms / a.n,
      sub: a.sub / a.n,
      bass: a.bass / a.n,
      bassFloor: percentile(a.bassSamples, 0.2),
      lowmid: a.lowmid / a.n,
      mid: a.mid / a.n,
      high: a.high / a.n,
      centroid: a.centroid / a.n,
      onsets: a.onsets,
    };
    this.history.push(s);
    if (this.history.length > 64) this.history.shift();
    this.peakEnergy = Math.max(s.energy, this.peakEnergy * 0.995);
    this.peakBass = Math.max(s.bass, this.peakBass * 0.995);
    return s;
  }

  /** Partial summary of the bar in progress (null until it has enough frames). */
  partial(): BarSummary | null {
    const a = this.acc;
    if (a.n < 12) return null;
    return {
      bar: this.currentBar,
      energy: a.rms / a.n,
      rawRms: a.rawRms / a.n,
      sub: a.sub / a.n,
      bass: a.bass / a.n,
      bassFloor: percentile(a.bassSamples, 0.2),
      lowmid: a.lowmid / a.n,
      mid: a.mid / a.n,
      high: a.high / a.n,
      centroid: a.centroid / a.n,
      onsets: a.onsets,
    };
  }

  /**
   * Detects a sudden change in the bar in progress relative to the last 4
   * completed bars. Fires at most once per bar.
   */
  /** last detector evaluation, for debugging */
  probe: { bar: number; n: number; ratioE: number; ratioB: number; pBass: number } | null = null;
  /** hysteresis: are we in a high-energy state, and at what level did we enter it */
  private high = false;
  private highLevel = 0;

  detectJump(): Jump | null {
    if (this.jumpFiredForBar === this.currentBar) return null;
    const p = this.partial();
    if (!p || this.history.length < 4) return null;
    const recent = this.history.slice(-4);
    const avgE = recent.reduce((s, b) => s + b.energy, 0) / recent.length;
    const avgB = recent.reduce((s, b) => s + b.bass, 0) / recent.length;
    if (avgE < 0.05) return null;
    const ratioE = p.energy / avgE;
    const ratioB = avgB > 0.05 ? p.bass / avgB : 1;
    this.probe = { bar: this.currentBar, n: this.acc.n, ratioE, ratioB, pBass: p.bass };
    // the kick comes back after a roll / gap bar: the classic drop signature (always reported)
    const prev = this.history[this.history.length - 1]!;
    const kickReturns = prev.sub < 0.55 && p.sub > 0.55 && p.sub - prev.sub > 0.2 && p.bass > 0.4;
    const surge = ratioE > 1.25 && ratioB > 1.2 && p.bass > 0.4;
    const cut = ratioE < 0.6 || (ratioB < 0.5 && avgB > 0.3);
    let jump: Jump | null = null;
    // hysteresis: a surge only counts when entering the high state (or climbing another 25% above
    // the level we entered at); a cut only counts when leaving it. Otherwise a rising build would
    // report a "drop" every single bar.
    if (kickReturns) {
      jump = { kind: 'drop', strong: true };
      this.high = true;
      this.highLevel = p.energy;
    } else if (surge && (!this.high || p.energy > this.highLevel * 1.25)) {
      jump = { kind: 'drop', strong: false };
      this.high = true;
      this.highLevel = p.energy;
    } else if (cut && this.high) {
      jump = { kind: 'cut', strong: ratioE < 0.5 };
      this.high = false;
    }
    if (jump) this.jumpFiredForBar = this.currentBar;
    return jump;
  }

  /** Slope of a summary field over the last n bars, in units per bar. */
  trend(n = 8, key: keyof BarSummary = 'energy'): number {
    const h = this.history.slice(-n);
    if (h.length < 3) return 0;
    const m = h.length;
    const xm = (m - 1) / 2;
    const mean = h.reduce((s, x) => s + x[key], 0) / m;
    let num = 0;
    let den = 0;
    h.forEach((b, i) => {
      num += (i - xm) * (b[key] - mean);
      den += (i - xm) * (i - xm);
    });
    return den === 0 ? 0 : num / den;
  }
}

function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}
