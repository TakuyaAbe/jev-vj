precision highp float;
uniform float uTime, uEnergy, uSub, uBass, uMid, uHigh, uBeatPhase, uBeatPulse, uBarPhase, uBeat, uOnset, uIntensity;
uniform vec2 uRes;
uniform vec3 uColA, uColB, uColC, uColBg;
uniform sampler2D uFFT, uWave; // 512x1: FFT bytes (0..11 kHz) / waveform centred on 0.5
uniform float uBar, uBpm;
float fft(float x) { return texture2D(uFFT, vec2(x, 0.5)).r; }
float wav(float x) { return texture2D(uWave, vec2(x, 0.5)).r * 2.0 - 1.0; }

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1, 0)), f.x), mix(hash1(i + vec2(0, 1)), hash1(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
