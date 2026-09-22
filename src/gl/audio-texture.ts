import * as THREE from 'three';
import type { RenderInput } from '../types';

const N = 512;

function byteTexture(w: number, h: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Audio as textures, refreshed at most once per frame and shared by every
 * shader scene:
 *  - shadertoy: 512x2, row 0 = FFT, row 1 = waveform (Shadertoy's audio input layout)
 *  - fft / wave: 512x1 each (ISF `audioFFT` / `audio` inputs; wave centred on 0.5)
 * All four channels hold the same value so `.r` and `.x` both work.
 */
export const AudioTextures = {
  shadertoy: null as THREE.DataTexture | null,
  fft: null as THREE.DataTexture | null,
  wave: null as THREE.DataTexture | null,
  lastT: -1,
};

function put(data: Uint8Array, i: number, v: number): void {
  data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = data[i * 4 + 3] = v;
}

export function updateAudioTextures(input: RenderInput): typeof AudioTextures {
  const a = AudioTextures;
  a.shadertoy ??= byteTexture(N, 2);
  a.fft ??= byteTexture(N, 1);
  a.wave ??= byteTexture(N, 1);
  if (a.lastT === input.t) return a;
  a.lastT = input.t;
  const st = a.shadertoy.image.data as Uint8Array;
  const fft = a.fft.image.data as Uint8Array;
  const wv = a.wave.image.data as Uint8Array;
  const spec = input.spectrum;
  const wave = input.wave;
  // Shadertoy maps its 512 texels onto the lower half of a 2048 FFT (0..~11 kHz); do the same
  const specStep = spec.length / 2 / N;
  const waveStep = wave.length / N;
  for (let i = 0; i < N; i++) {
    const f = spec[Math.floor(i * specStep)] ?? 0;
    const w = Math.max(0, Math.min(255, ((wave[Math.floor(i * waveStep)] ?? 0) * 0.5 + 0.5) * 255));
    put(st, i, f);
    put(st, N + i, w);
    put(fft, i, f);
    put(wv, i, w);
  }
  a.shadertoy.needsUpdate = true;
  a.fft.needsUpdate = true;
  a.wave.needsUpdate = true;
  return a;
}

let noise: THREE.DataTexture | null = null;
/** 256x256 RGBA white noise, repeat-wrapped (stands in for Shadertoy's noise textures). */
export function noiseTexture(): THREE.DataTexture {
  if (noise) return noise;
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  let seed = 1234567;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = seed >> 23;
  }
  noise = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.minFilter = THREE.LinearFilter;
  noise.magFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  return noise;
}
