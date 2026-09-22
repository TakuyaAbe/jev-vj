#!/usr/bin/env node
/**
 * Synthesises the video's music bed and sound effects from scratch (no samples, no licences) into
 * public/audio/:
 *
 *   bgm.wav     seamless 40 s loop — warm pad, plucked arpeggio, sub bass, soft kick/hat (96 BPM, C major).
 *               Plays under the title / overview / keys / outro cards; during the app footage the
 *               composition prefers demo-track.wav (the app's own 128 BPM demo, exported by capture.mjs).
 *   tap.wav     soft UI click (every click in the capture)
 *   pop.wav     small bubble (key presses)
 *   whoosh.wav  filtered-noise sweep (chapter slates, card transitions)
 *
 * Everything is deterministic (seeded noise), 44.1 kHz stereo 16-bit; levels live in remotion/theme.ts.
 *
 * Run:  node audio.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, 'public', 'audio')
const SR = 44100
const TAU = Math.PI * 2

/* ------------------------------------------------------------------ primitives */

/** Deterministic PRNG (mulberry32) so every run writes byte-identical files. */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12)
const buf = (seconds) => [new Float32Array(Math.ceil(seconds * SR)), new Float32Array(Math.ceil(seconds * SR))]

function addMono(out, start, seconds, pan, fn) {
  const s0 = Math.round(start * SR)
  const n = Math.round(seconds * SR)
  const gl = Math.cos(((pan + 1) * Math.PI) / 4)
  const gr = Math.sin(((pan + 1) * Math.PI) / 4)
  for (let i = 0; i < n; i++) {
    const j = s0 + i
    if (j < 0 || j >= out[0].length) continue
    const v = fn(i / SR, i)
    out[0][j] += v * gl
    out[1][j] += v * gr
  }
}

function lowpass(ch, cutoff) {
  const k = 1 - Math.exp((-TAU * cutoff) / SR)
  let y = 0
  for (let i = 0; i < ch.length; i++) {
    y += k * (ch[i] - y)
    ch[i] = y
  }
}

function bandpassSweep(x, centreAt, q) {
  const y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const w = (TAU * centreAt(i / SR)) / SR
    const alpha = Math.sin(w) / (2 * q)
    const a0 = 1 + alpha
    const b0 = alpha / a0
    const b2 = -alpha / a0
    const a1 = (-2 * Math.cos(w)) / a0
    const a2 = (1 - alpha) / a0
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v
    y[i] = v
  }
  return y
}

/** Freeverb-style reverb (8 damped combs + 4 all-passes per channel), returns wet stereo. */
function reverb([l, r], { room = 0.82, damp = 0.45, spread = 23 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const aps = [556, 441, 341, 225]
  const scale = SR / 44100
  const run = (x, offset) => {
    const out = new Float32Array(x.length)
    for (const base of combs) {
      const len = Math.round((base + offset) * scale)
      const line = new Float32Array(len)
      let idx = 0, store = 0
      for (let i = 0; i < x.length; i++) {
        const o = line[idx]
        store = o * (1 - damp) + store * damp
        line[idx] = x[i] * 0.015 + store * room
        out[i] += o
        idx = (idx + 1) % len
      }
    }
    for (const base of aps) {
      const len = Math.round((base + offset) * scale)
      const line = new Float32Array(len)
      let idx = 0
      for (let i = 0; i < out.length; i++) {
        const b = line[idx]
        const v = -out[i] + b
        line[idx] = out[i] + b * 0.5
        out[i] = v
        idx = (idx + 1) % len
      }
    }
    return out
  }
  return [run(l, 0), run(r, spread)]
}

function mixInto(dst, src, gain = 1, offset = 0) {
  for (let c = 0; c < 2; c++) for (let i = 0; i < src[c].length && i + offset < dst[c].length; i++) dst[c][i + offset] += src[c][i] * gain
}

function normalise(st, peakDb) {
  let peak = 0
  for (const ch of st) for (const v of ch) peak = Math.max(peak, Math.abs(v))
  const g = peak > 0 ? 10 ** (peakDb / 20) / peak : 1
  for (const ch of st) for (let i = 0; i < ch.length; i++) ch[i] *= g
}

function edges(st, fadeIn = 0.002, fadeOut = 0.02) {
  const n = st[0].length
  const fi = Math.round(fadeIn * SR)
  const fo = Math.round(fadeOut * SR)
  for (const ch of st) {
    for (let i = 0; i < fi && i < n; i++) ch[i] *= i / fi
    for (let i = 0; i < fo && i < n; i++) ch[n - 1 - i] *= i / fo
  }
}

function writeWav(name, [l, r]) {
  const n = l.length
  const data = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), i * 4)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), i * 4 + 2)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22)
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  writeFileSync(join(OUT, name), Buffer.concat([head, data]))
  console.log(`${name.padEnd(12)} ${(n / SR).toFixed(2)}s`)
}

/* ------------------------------------------------------------------ sound effects */

function tap() {
  const out = buf(0.14)
  const noise = rng(7)
  addMono(out, 0, 0.14, 0, (t) => {
    const body = Math.exp(-t / 0.014) * (Math.sin(TAU * 1150 * t) + 0.35 * Math.sin(TAU * 2310 * t))
    const thock = Math.exp(-t / 0.03) * Math.sin(TAU * 190 * t) * 0.5
    const tick = Math.exp(-t / 0.0025) * (noise() * 2 - 1) * 0.35
    return (body + thock + tick) * Math.min(1, t / 0.0006)
  })
  edges(out, 0.0005, 0.03)
  normalise(out, -3)
  return out
}

function pop() {
  const out = buf(0.22)
  addMono(out, 0, 0.22, 0, (t) => {
    const f = 520 + 700 * Math.exp(-t / 0.018)
    return Math.exp(-t / 0.04) * Math.sin(TAU * f * t) * Math.min(1, t / 0.001)
  })
  const wet = reverb(out, { room: 0.5, damp: 0.6 })
  mixInto(out, wet, 0.12)
  edges(out, 0.0005, 0.05)
  normalise(out, -3)
  return out
}

function whoosh() {
  const seconds = 1.0
  const n = Math.round(seconds * SR)
  const r = rng(5)
  const white = new Float32Array(n)
  for (let i = 0; i < n; i++) white[i] = r() * 2 - 1
  lowpass(white, 4000)
  const centre = (t) => {
    const x = t / seconds
    return 350 * (x < 0.55 ? (2800 / 350) ** (x / 0.55) : (2800 / 350) ** (1 - (x - 0.55) / 0.45 * 0.6))
  }
  const swept = bandpassSweep(white, centre, 1.1)
  const env = (t) => {
    const x = t / seconds
    return x < 0.55 ? (x / 0.55) ** 2.2 : Math.max(0, 1 - (x - 0.55) / 0.45) ** 1.6
  }
  const out = buf(seconds)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const pan = -0.7 + 1.4 * (t / seconds)
    const v = swept[i] * env(t)
    out[0][i] = v * Math.cos(((pan + 1) * Math.PI) / 4)
    out[1][i] = v * Math.sin(((pan + 1) * Math.PI) / 4)
  }
  const wet = reverb(out, { room: 0.6, damp: 0.5 })
  mixInto(out, wet, 0.15)
  edges(out, 0.005, 0.05)
  normalise(out, -3)
  return out
}

/* ------------------------------------------------------------------ music bed */

function karplus(freq, seconds, seed, brightness = 0.5) {
  const n = Math.round(seconds * SR)
  const len = Math.max(2, Math.round(SR / freq))
  const r = rng(seed)
  const line = new Float32Array(len)
  for (let i = 0; i < len; i++) line[i] = r() * 2 - 1
  for (let k = 0; k < 2; k++) for (let i = 1; i < len; i++) line[i] = line[i] * brightness + line[i - 1] * (1 - brightness)
  const out = new Float32Array(n)
  let idx = 0
  for (let i = 0; i < n; i++) {
    const cur = line[idx]
    const next = line[(idx + 1) % len]
    line[idx] = (cur + next) * 0.5 * 0.9965
    out[i] = cur
    idx = (idx + 1) % len
  }
  return out
}

function bgm() {
  const BPM = 96
  const beat = 60 / BPM
  const bar = beat * 4
  const C = {
    Cmaj9: [[48, 55, 59, 62, 64], 36],
    Am9: [[45, 52, 55, 59, 60], 33],
    Fmaj7: [[41, 48, 52, 57, 60], 29],
    Gsus: [[43, 50, 55, 60, 62], 31],
    G: [[43, 50, 55, 59, 62], 31],
    Am7: [[45, 52, 55, 60, 64], 33],
    CG: [[43, 52, 55, 60, 64], 31],
    Dm9: [[50, 53, 57, 60, 64], 38],
  }
  const prog = ['Cmaj9', 'Am9', 'Fmaj7', 'Gsus', 'Cmaj9', 'Am9', 'Fmaj7', 'G',
                'Am7', 'Fmaj7', 'CG', 'G', 'Am7', 'Fmaj7', 'Dm9', 'Gsus']
  const loop = prog.length * bar
  const tail = 6
  const out = buf(loop + tail)
  const pads = buf(loop + tail)
  const plucks = buf(loop + tail)

  prog.forEach((name, b) => {
    const [voicing, root] = C[name]
    const t0 = b * bar
    voicing.forEach((m, vi) => {
      const f = midiHz(m)
      const pan = -0.5 + (vi / (voicing.length - 1)) * 1.0
      addMono(pads, t0 - 0.35, bar + 1.6, pan, (t) => {
        const a = Math.min(1, t / 0.9)
        const rel = t > bar + 0.35 ? Math.max(0, 1 - (t - bar - 0.35) / 1.2) : 1
        const tone = Math.sin(TAU * f * t) + Math.sin(TAU * f * 1.0035 * t + 1.3) * 0.8 + Math.sin(TAU * f * 0.9968 * t + 2.1) * 0.8
          + 0.18 * Math.sin(TAU * f * 2 * t) + 0.06 * Math.sin(TAU * f * 3 * t)
        return tone * a * rel * 0.05
      })
    })
    const hits = b % 2 ? [0, 2] : [0, 1.5, 2]
    hits.forEach((h) => {
      const f = midiHz(root)
      addMono(out, t0 + h * beat, beat * 2, 0, (t) => {
        const a = Math.min(1, t / 0.012)
        return a * Math.exp(-t / 0.9) * (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2 * t)) * 0.2
      })
    })
    const pattern = b % 4 === 3 ? [0, 2, 4, 3, 2, 4, 3, 1] : [0, 2, 1, 3, 2, 4, 3, 2]
    pattern.forEach((p, k) => {
      const m = voicing[p] + 12
      const pl = karplus(midiHz(m), 1.4, 100 + b * 8 + k, 0.45)
      const pan = k % 2 ? 0.35 : -0.35
      const vel = k === 0 ? 0.13 : 0.085 + (k % 2 ? 0 : 0.015)
      addMono(plucks, t0 + k * beat * 0.5, 1.4, pan, (_, i) => pl[i] * vel)
    })
    const noise = rng(1000 + b)
    for (const h of [0, 2]) {
      addMono(out, t0 + h * beat, 0.35, 0, (t) => {
        const f = 45 + 70 * Math.exp(-t / 0.03)
        return Math.exp(-t / 0.12) * Math.sin(TAU * f * t) * 0.32
      })
    }
    for (let k = 0; k < 8; k++) {
      const off = k % 2 === 1
      addMono(out, t0 + k * beat * 0.5, 0.08, off ? 0.25 : -0.2, (t) => {
        const hp = noise() * 2 - 1
        return hp * Math.exp(-t / (off ? 0.028 : 0.012)) * (off ? 0.05 : 0.018)
      })
    }
  })

  const d = Math.round(beat * 0.75 * SR)
  const echo = [new Float32Array(plucks[0].length), new Float32Array(plucks[1].length)]
  for (let i = 0; i < plucks[0].length; i++) {
    const a = i >= d ? echo[1][i - d] * 0.38 + plucks[0][i - d] : 0
    const bb = i >= d ? echo[0][i - d] * 0.38 + plucks[1][i - d] : 0
    echo[0][i] = a
    echo[1][i] = bb
  }
  mixInto(plucks, echo, 0.3)
  for (const ch of pads) lowpass(ch, 2400)
  const bus = buf(loop + tail)
  mixInto(bus, pads, 1)
  mixInto(bus, plucks, 1)
  const wet = reverb(bus, { room: 0.84, damp: 0.4 })
  mixInto(out, bus, 1)
  mixInto(out, wet, 0.35)

  const n = Math.round(loop * SR)
  const looped = [out[0].slice(0, n), out[1].slice(0, n)]
  for (let c = 0; c < 2; c++) for (let i = n; i < out[c].length; i++) looped[c][(i - n) % n] += out[c][i]
  normalise(looped, -3)
  return looped
}

/* ------------------------------------------------------------------ main */

mkdirSync(OUT, { recursive: true })
writeWav('tap.wav', tap())
writeWav('pop.wav', pop())
writeWav('whoosh.wav', whoosh())
writeWav('bgm.wav', bgm())
