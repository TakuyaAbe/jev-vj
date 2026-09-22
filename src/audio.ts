import type { FrameFeatures } from './types';

export type SourceKind = 'demo' | 'file' | 'mic' | 'system';

export const isLive = (k: SourceKind | null): boolean => k === 'mic' || k === 'system';

const TICK_MS = 20;

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Owns the AudioContext, the current source, and the fixed-rate analysis
 * tick (50 Hz). Every tick produces one FrameFeatures for the beat tracker,
 * the bar aggregator, and the renderer.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly analyser: AnalyserNode;
  private readonly outGain: GainNode;
  private source: AudioNode | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private stream: MediaStream | null = null;
  private readonly freq: Float32Array<ArrayBuffer>;
  private readonly wave: Float32Array<ArrayBuffer>;
  private readonly mag: Float32Array;
  private readonly prevMag: Float32Array;
  /** smoothed dB → byte spectrum for shaders (Shadertoy / ISF audioFFT) */
  private readonly spectrum: Uint8Array;
  private readonly specDb: Float32Array;
  private readonly binHz: number;
  private timer: number | null = null;
  private fluxHist: number[] = [];
  private lastOnsetT = -1;
  private startedAt = 0;
  /** running peaks for auto-gain: rms, sub, bass, lowmid, mid, high */
  private peaks = new Float32Array([0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);

  kind: SourceKind | null = null;
  duration = 0;
  private _muted = false;
  latest: FrameFeatures | null = null;
  onFrame: ((f: FrameFeatures) => void) | null = null;
  onEnded: (() => void) | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.outGain = this.ctx.createGain();
    this.analyser.connect(this.outGain).connect(this.ctx.destination);
    const n = this.analyser.frequencyBinCount;
    this.freq = new Float32Array(n);
    this.wave = new Float32Array(this.analyser.fftSize);
    this.mag = new Float32Array(n);
    this.prevMag = new Float32Array(n);
    this.spectrum = new Uint8Array(n);
    this.specDb = new Float32Array(n).fill(-140);
    this.binHz = this.ctx.sampleRate / this.analyser.fftSize;
  }

  get playing(): boolean {
    return this.source !== null;
  }

  get muted(): boolean {
    return this._muted;
  }

  /** Silence the speakers without touching analysis (mic is always silent). */
  set muted(v: boolean) {
    this._muted = v;
    this.outGain.gain.value = v || isLive(this.kind) ? 0 : 1;
  }

  /** seconds since the buffer started (buffer sources only) */
  position(): number {
    if (!this.bufferSource) return 0;
    return this.ctx.currentTime - this.startedAt;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  async playBuffer(buffer: AudioBuffer, kind: SourceKind, offset = 0): Promise<void> {
    await this.resume();
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser);
    src.onended = () => {
      if (this.bufferSource === src) {
        this.stop();
        this.onEnded?.();
      }
    };
    this.outGain.gain.value = this._muted ? 0 : 1;
    const off = Math.max(0, Math.min(buffer.duration - 0.05, offset));
    src.start(0, off);
    this.startedAt = this.ctx.currentTime - off;
    this.duration = buffer.duration;
    this.buffer = buffer;
    this.bufferSource = src;
    this.source = src;
    this.kind = kind;
    this.startTick();
  }

  /** Jump within the current buffer (file / demo sources). */
  async seek(sec: number): Promise<void> {
    if (!this.buffer || !this.kind || isLive(this.kind)) return;
    await this.playBuffer(this.buffer, this.kind, sec);
  }

  async playFile(file: File): Promise<void> {
    const data = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(data);
    await this.playBuffer(buffer, 'file');
  }

  async startMic(deviceId?: string): Promise<void> {
    await this.resume();
    this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.attachStream(stream, 'mic');
  }

  /**
   * System audio through the screen-share picker (Chrome offers "share system
   * audio" on macOS when the whole screen is chosen). The video track is
   * dropped immediately; only the audio is analysed and never monitored.
   */
  async startSystemAudio(): Promise<void> {
    await this.resume();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    stream.getVideoTracks().forEach((t) => t.stop());
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('画面共有に音声が含まれていません（「システム音声を共有」を選ぶか、BlackHole 等の仮想デバイスを Mic / line-in で選択）');
    }
    this.stop();
    this.attachStream(new MediaStream(audioTracks), 'system');
  }

  private attachStream(stream: MediaStream, kind: 'mic' | 'system'): void {
    const src = this.ctx.createMediaStreamSource(stream);
    src.connect(this.analyser);
    this.outGain.gain.value = 0; // never monitor live input (feedback / doubling)
    this.stream = stream;
    this.source = src;
    this.kind = kind;
    this.duration = 0;
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (this.stream === stream) {
        this.stop();
        this.onEnded?.();
      }
    });
    this.startTick();
  }

  /** Audio inputs (labels are only available once a getUserMedia call was granted). */
  static async inputDevices(): Promise<{ deviceId: string; label: string }[]> {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `input ${i + 1}` }));
  }

  stop(): void {
    if (this.bufferSource) {
      try {
        this.bufferSource.onended = null;
        this.bufferSource.stop();
      } catch {
        /* already stopped */
      }
    }
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.bufferSource = null;
    this.source = null;
    this.stream = null;
    this.kind = null;
    this.stopTick();
  }

  private startTick(): void {
    this.stopTick();
    this.prevMag.fill(0);
    this.fluxHist = [];
    this.peaks.fill(0.3);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stopTick(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** Manual tick for tests / hidden tabs. */
  tick(): void {
    const { analyser, freq, wave, mag, prevMag, binHz, spectrum, specDb } = this;
    analyser.getFloatFrequencyData(freq);
    analyser.getFloatTimeDomainData(wave);
    const n = freq.length;
    let flux = 0;
    let bassFlux = 0;
    let centNum = 0;
    let centDen = 0;
    const bandPow = [0, 0, 0, 0, 0];
    const bandCnt = [0, 0, 0, 0, 0];
    const edges = [20, 60, 250, 1000, 4000, 16000];
    let band = 0;
    for (let i = 1; i < n; i++) {
      const hz = i * binHz;
      const db = freq[i]!;
      // fast attack, ~0.8 release per 20 ms tick: close to AnalyserNode's default smoothing
      specDb[i] = db > specDb[i]! ? db : specDb[i]! * 0.8 + db * 0.2;
      spectrum[i] = Math.max(0, Math.min(255, ((specDb[i]! + 100) / 70) * 255));
      const m = db <= -140 ? 0 : Math.pow(10, db / 20);
      mag[i] = m;
      const d = m - prevMag[i]!;
      if (d > 0) {
        flux += d;
        if (hz < 250) bassFlux += d;
      }
      prevMag[i] = m;
      centNum += hz * m;
      centDen += m;
      while (band < 5 && hz >= edges[band + 1]!) band++;
      if (band < 5 && hz >= edges[0]!) {
        bandPow[band]! += m * m;
        bandCnt[band]! += 1;
      }
    }
    const level = (p: number, c: number): number => {
      if (c === 0 || p === 0) return 0;
      const db = 10 * Math.log10(p / c);
      return clamp01((db + 65) / 55);
    };
    let sq = 0;
    for (let i = 0; i < wave.length; i++) sq += wave[i]! * wave[i]!;
    const rmsLin = Math.sqrt(sq / wave.length);
    const rms = rmsLin <= 0 ? 0 : clamp01((20 * Math.log10(rmsLin) + 40) / 38);

    // onset: flux above the recent mean + 1.5 sigma, with a refractory period
    const hist = this.fluxHist;
    hist.push(flux);
    if (hist.length > 50) hist.shift();
    let mean = 0;
    for (const v of hist) mean += v;
    mean /= hist.length;
    let varSum = 0;
    for (const v of hist) varSum += (v - mean) * (v - mean);
    const std = Math.sqrt(varSum / hist.length);
    const t = this.ctx.currentTime;
    const onset = hist.length > 10 && flux > mean + 1.5 * std && flux > 0.02 && t - this.lastOnsetT > 0.08;
    if (onset) this.lastOnsetT = t;

    // auto-gain per band: relative to a slowly decaying running peak so that
    // quiet sources and thin bands (mid/high) still span 0..1
    const raw = [rms, ...bandPow.map((p, i) => level(p, bandCnt[i]!))];
    const agc = (i: number): number => {
      const v = raw[i]!;
      const pk = this.peaks[i]!;
      this.peaks[i] = Math.max(v, pk * 0.9995, 0.02);
      return clamp01(v / this.peaks[i]!);
    };
    const f: FrameFeatures = {
      t,
      rms: agc(0),
      rawRms: rms,
      sub: agc(1),
      bass: agc(2),
      lowmid: agc(3),
      mid: agc(4),
      high: agc(5),
      centroid: centDen > 0 ? centNum / centDen : 0,
      flux,
      bassFlux,
      onset,
      wave,
      spectrum,
    };
    this.latest = f;
    this.onFrame?.(f);
  }
}
