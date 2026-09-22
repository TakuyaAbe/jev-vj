/**
 * Built-in demo track: a 128 BPM techno arrangement synthesized straight into
 * PCM so the demo runs without any audio file. The arrangement has clear
 * sections (intro → build → drop → breakdown → build → drop → outro) so the
 * feature summaries give Jev something to read.
 */
export const DEMO_BPM = 128;

export interface DemoSection {
  name: 'intro' | 'build' | 'drop' | 'breakdown' | 'outro';
  bars: number;
}

export const DEMO_SECTIONS: DemoSection[] = [
  { name: 'intro', bars: 8 },
  { name: 'build', bars: 8 },
  { name: 'drop', bars: 16 },
  { name: 'breakdown', bars: 8 },
  { name: 'build', bars: 8 },
  { name: 'drop', bars: 16 },
  { name: 'outro', bars: 4 },
];

const NOTE = (semi: number, base = 55): number => base * Math.pow(2, semi / 12); // A1 = 55 Hz

// A minor-ish bass line (semitones from A1), one note per beat
const BASS_LINE = [0, 0, 7, 0, 3, 0, 5, 3];
// lead arpeggio (semitones from A3), 16th notes
const LEAD_ARP = [0, 3, 7, 12, 7, 3, 0, 10, 12, 7, 3, 0, 5, 8, 12, 8];
const PAD_CHORDS: number[][] = [
  [0, 3, 7, 14],
  [-2, 3, 5, 12],
  [-4, 0, 3, 10],
  [-5, 0, 5, 12],
];

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    // xorshift32 → (-1, 1)
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return (this.s / 0xffffffff) * 2 - 1;
  }
}

export function renderDemoTrack(sampleRate: number): AudioBuffer {
  const beat = 60 / DEMO_BPM;
  const bar = beat * 4;
  const totalBars = DEMO_SECTIONS.reduce((a, s) => a + s.bars, 0);
  const length = Math.ceil((totalBars * bar + 2) * sampleRate);
  const kick = new Float32Array(length);
  const other = new Float32Array(length);
  const rng = new Rng(0x9e3779b9);

  const addKick = (t0: number, gain: number): void => {
    const start = Math.floor(t0 * sampleRate);
    const len = Math.floor(0.4 * sampleRate);
    let phase = 0;
    for (let i = 0; i < len && start + i < length; i++) {
      const t = i / sampleRate;
      const f = 42 + 130 * Math.exp(-t * 28);
      phase += (2 * Math.PI * f) / sampleRate;
      const env = Math.exp(-t * 7.5);
      const click = t < 0.004 ? rng.next() * 0.5 : 0;
      kick[start + i]! += gain * (Math.sin(phase) * env * 0.95 + click);
    }
  };

  const addNoiseHit = (t0: number, gain: number, decay: number, hp: boolean, tone?: number): void => {
    const start = Math.floor(t0 * sampleRate);
    const len = Math.floor((6 / decay) * sampleRate);
    let prev = 0;
    let phase = 0;
    for (let i = 0; i < len && start + i < length; i++) {
      const t = i / sampleRate;
      const n = rng.next();
      const v = hp ? n - prev : n;
      prev = n;
      let s = v * Math.exp(-t * decay);
      if (tone) {
        phase += (2 * Math.PI * tone) / sampleRate;
        s += Math.sin(phase) * Math.exp(-t * decay * 1.6) * 0.8;
      }
      other[start + i]! += gain * s;
    }
  };

  const addBass = (t0: number, len: number, freq: number, cutoff: number, gain: number): void => {
    const start = Math.floor(t0 * sampleRate);
    const n = Math.floor(len * sampleRate);
    let phase = 0;
    let y = 0;
    const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / sampleRate;
      phase += freq / sampleRate;
      if (phase >= 1) phase -= 1;
      const saw = phase * 2 - 1;
      const sq = phase < 0.5 ? 1 : -1;
      const x = saw * 0.7 + sq * 0.3;
      y += (x - y) * k;
      const env = Math.min(1, t * 200) * Math.exp(-t * 3) * (t > len - 0.01 ? (len - t) / 0.01 : 1);
      other[start + i]! += gain * y * env;
    }
  };

  const addLead = (t0: number, len: number, freq: number, cutoff: number, gain: number): void => {
    const start = Math.floor(t0 * sampleRate);
    const n = Math.floor(len * sampleRate);
    let p1 = 0;
    let p2 = 0;
    let y = 0;
    const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / sampleRate;
      p1 += (freq * 1.004) / sampleRate;
      p2 += (freq * 0.996) / sampleRate;
      if (p1 >= 1) p1 -= 1;
      if (p2 >= 1) p2 -= 1;
      const x = (p1 * 2 - 1) * 0.5 + (p2 * 2 - 1) * 0.5;
      y += (x - y) * k;
      const env = Math.min(1, t * 400) * Math.exp(-t * 6);
      other[start + i]! += gain * y * env;
    }
  };

  const addPad = (t0: number, len: number, semis: number[], gain: number): void => {
    const start = Math.floor(t0 * sampleRate);
    const n = Math.floor(len * sampleRate);
    const freqs = semis.map((s) => NOTE(s, 440));
    const phases = freqs.map(() => 0);
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / sampleRate;
      let s = 0;
      for (let v = 0; v < freqs.length; v++) {
        phases[v] = phases[v]! + (2 * Math.PI * freqs[v]!) / sampleRate;
        const vib = 1 + 0.003 * Math.sin(2 * Math.PI * 5 * t + v);
        s += Math.sin(phases[v]! * vib) + 0.3 * Math.sin(phases[v]! * 2 * vib);
      }
      const att = Math.min(1, t / 0.6);
      const rel = t > len - 0.8 ? Math.max(0, (len - t) / 0.8) : 1;
      other[start + i]! += gain * (s / freqs.length) * att * rel;
    }
  };

  const addRiser = (t0: number, len: number, gain: number): void => {
    const start = Math.floor(t0 * sampleRate);
    const n = Math.floor(len * sampleRate);
    let phase = 0;
    let y = 0;
    for (let i = 0; i < n && start + i < length; i++) {
      const u = i / n;
      const f = 150 * Math.pow(12, u);
      phase += (2 * Math.PI * f) / sampleRate;
      const k = 1 - Math.exp((-2 * Math.PI * (300 + 5000 * u)) / sampleRate);
      y += (rng.next() - y) * k;
      other[start + i]! += gain * u * u * (y * 0.7 + Math.sin(phase) * 0.15);
    }
  };

  // Schedule everything section by section
  let barIndex = 0;
  let lastKickTimes: number[] = [];
  for (const sec of DEMO_SECTIONS) {
    for (let b = 0; b < sec.bars; b++, barIndex++) {
      const bt = barIndex * bar;
      const prog = b / sec.bars;
      const isLastBar = b === sec.bars - 1;
      const secondHalf = b >= sec.bars / 2;

      // kick
      if (sec.name !== 'breakdown' && !(sec.name === 'build' && isLastBar)) {
        for (let q = 0; q < 4; q++) {
          const gain = sec.name === 'intro' ? 0.8 : 1;
          addKick(bt + q * beat, gain);
          lastKickTimes.push(bt + q * beat);
        }
      }
      // hats
      if (sec.name !== 'intro' || secondHalf) {
        for (let s = 0; s < 8; s++) {
          const t = bt + s * beat * 0.5;
          const open = s % 2 === 1;
          const g = sec.name === 'breakdown' ? 0.06 : open ? 0.14 : 0.1;
          addNoiseHit(t, g, open ? 25 : 90, true);
        }
        if (sec.name === 'drop') {
          for (let s = 0; s < 16; s++) addNoiseHit(bt + s * beat * 0.25, 0.04, 140, true);
        }
      }
      // snare / clap on 2 and 4
      if (sec.name === 'drop' || (sec.name === 'build' && !isLastBar)) {
        addNoiseHit(bt + beat, 0.35, 18, false, 190);
        addNoiseHit(bt + 3 * beat, 0.35, 18, false, 190);
      }
      // bass
      if (sec.name === 'drop' || (sec.name === 'build' && b >= 2 && !isLastBar) || sec.name === 'outro') {
        const cutoff = sec.name === 'drop' ? 900 : 300 + 600 * prog;
        for (let q = 0; q < 8; q++) {
          const semi = BASS_LINE[(barIndex * 8 + q) % BASS_LINE.length]!;
          addBass(bt + q * beat * 0.5, beat * 0.45, NOTE(semi, 55), cutoff, sec.name === 'outro' ? 0.25 : 0.45);
        }
      }
      // lead in drops (second half brighter)
      if (sec.name === 'drop') {
        const cutoff = secondHalf ? 3500 : 1800;
        for (let s = 0; s < 16; s++) {
          const semi = LEAD_ARP[s]!;
          addLead(bt + s * beat * 0.25, beat * 0.22, NOTE(semi, 220), cutoff, 0.16);
        }
      }
      // pads in intro / breakdown
      if (sec.name === 'breakdown' || sec.name === 'intro') {
        addPad(bt, bar, PAD_CHORDS[b % PAD_CHORDS.length]!, sec.name === 'breakdown' ? 0.22 : 0.1);
      }
      // build: riser over the whole section, snare roll in the last two bars
      if (sec.name === 'build') {
        if (b === 0) addRiser(bt, sec.bars * bar, 0.35);
        if (b === sec.bars - 2) for (let s = 0; s < 8; s++) addNoiseHit(bt + s * beat * 0.5, 0.3, 30, false, 200);
        if (isLastBar) {
          for (let s = 0; s < 16; s++) addNoiseHit(bt + s * beat * 0.25, 0.3 + 0.2 * (s / 16), 40, false, 220);
        }
      }
    }
  }

  // sidechain: duck everything that is not the kick right after each kick
  const out = new Float32Array(length);
  let ki = 0;
  lastKickTimes = lastKickTimes.sort((a, b) => a - b);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    while (ki + 1 < lastKickTimes.length && lastKickTimes[ki + 1]! <= t) ki++;
    const since = lastKickTimes.length ? t - lastKickTimes[ki]! : 10;
    const duck = since >= 0 && since < 0.3 ? 1 - 0.55 * Math.exp(-since * 14) : 1;
    const x = kick[i]! + other[i]! * duck;
    out[i] = Math.tanh(x * 1.3) * 0.9;
  }

  const ctx = new OfflineAudioContext(1, length, sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  buffer.copyToChannel(out, 0);
  return buffer;
}

/** Section name at a given bar index (for the HUD only; Jev never sees it). */
export function demoSectionAt(barIndex: number): string {
  let acc = 0;
  for (const s of DEMO_SECTIONS) {
    acc += s.bars;
    if (barIndex < acc) return s.name;
  }
  return 'end';
}
