// @name Arch Cathedral
// @description 光る輪のアーチが果てしなく続く回廊を前進する。アーチは1本ずつスペクトラムの帯に対応して灯り、小節ごとに光の波が奥へ走り抜ける。荘厳で儀式的な奥行き。トランスやプログレッシブの長いビルドアップ、ドロップ前の高揚に合う
// @short 光のアーチが続く回廊を前進（3D）。荘厳・高揚。ビルドアップ
// Shadertoy-compatible: iChannel0 = music input (row 0.25 FFT). Original raymarcher, 72 steps.

float gRing;
float gId;
float gSq;

float mapArch(vec3 p) {
  const float cz = 2.2;
  gId = floor(p.z / cz);
  vec3 q = p;
  q.z = mod(q.z, cz) - 0.5 * cz;
  vec2 xy = q.xy - vec2(0.0, -0.25);
  float r = mix(length(xy), max(abs(xy.x) * 0.92, abs(xy.y)), gSq);
  gRing = length(vec2(r - 1.75, q.z)) - 0.09;
  // thin keel rail running down the corridor ceiling
  float rib = length(p.xy - vec2(0.0, 1.38)) - 0.025;
  float flo = p.y + 1.35;
  return min(min(gRing, rib), flo);
}

vec3 archNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    mapArch(p + e.xyy) - mapArch(p - e.xyy),
    mapArch(p + e.yxy) - mapArch(p - e.yxy),
    mapArch(p + e.yyx) - mapArch(p - e.yyx)));
}

vec3 archEmit(float id) {
  float band = texture(iChannel0, vec2(fract(id * 0.0713) * 0.65 + 0.02, 0.25)).x;
  // a light wave that sweeps 8 arches deep once per bar
  float sweep = exp(-6.0 * fract(uBarPhase - id * 0.125));
  vec3 c = mix(uColA, uColB, mod(id, 2.0));
  return c * (band * band * 1.8 + sweep * (0.3 + 0.9 * uIntensity));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime;
  gSq = smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(t * 0.045));
  vec3 ro = vec3(sin(t * 0.31) * 0.35, cos(t * 0.23) * 0.18, t * 1.7);
  vec3 rd = normalize(vec3(p, 1.25 - uBeatPulse * 0.22 * (0.3 + uIntensity)));
  rd.xy *= mat2(cos(sin(t * 0.13) * 0.25), -sin(sin(t * 0.13) * 0.25), sin(sin(t * 0.13) * 0.25), cos(sin(t * 0.13) * 0.25));

  float tt = 0.0;
  float d = 1.0;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 72; i++) {
    vec3 pos = ro + rd * tt;
    d = mapArch(pos);
    glow += archEmit(gId) * exp(-gRing * 16.0) * 0.035;
    if (d < 0.001 || tt > 40.0) break;
    tt += d * 0.85;
  }

  vec3 col = uColBg;
  if (d < 0.01) {
    vec3 pos = ro + rd * tt;
    vec3 n = archNormal(pos);
    float id = gId;
    bool isFloor = pos.y < -1.33;
    vec3 base = isFloor ? uColBg * 1.4 + 0.03 : mix(uColBg, uColC, 0.25);
    if (isFloor) {
      vec2 g = abs(fract(pos.xz * vec2(1.0, 0.5)) - 0.5);
      base += uColC * 0.08 * smoothstep(0.47, 0.5, max(g.x, g.y));
    }
    vec3 l = normalize(vec3(0.3, 0.8, -0.4));
    float dif = max(dot(n, l), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col = base * (0.25 + 0.75 * dif) + rim * mix(uColA, uColB, 0.5) * 0.3;
    if (!isFloor) col += archEmit(id) * 0.6;
  }
  col = mix(col, uColBg, 1.0 - exp(-tt * 0.055));
  col += glow * (0.35 + 0.65 * uIntensity);
  col += uColC * uBeatPulse * 0.06 * uIntensity;
  col = col / (1.0 + col * 0.35);
  fragColor = vec4(col, 1.0);
}
