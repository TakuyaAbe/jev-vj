// @name Aurora Veil
// @description 夜空にオーロラのカーテンがゆらめき、高域でひだが細かくきらめく。地平線の水面にぼんやり映り込み、低音でほのかに明るむ。静かで神秘的、呼吸するような流れ。アンビエントやブレイクダウン、曲の余韻や静かなイントロに合う
// @short 夜空に揺れるオーロラの幕。神秘・静寂。ブレイクダウン・余韻
// Shadertoy-compatible: iChannel0 = music input (row 0.25 FFT). Original domain-warped curtains.

float avHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
float avNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(avHash(i), avHash(i + vec2(1.0, 0.0)), f.x), mix(avHash(i + vec2(0.0, 1.0)), avHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float avFbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * avNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// one curtain layer: returns brightness at uv
float curtain(vec2 uv, float t, float seed, float shimmer) {
  vec2 w = vec2(avFbm(vec2(uv.x * 0.9 + seed, t * 0.07)), avFbm(vec2(uv.x * 0.6 - t * 0.05, seed)));
  float x = uv.x + (w.x - 0.5) * 1.2;
  float baseY = 0.05 + (w.y - 0.5) * 0.5 + seed * 0.04;
  float h = uv.y - baseY;
  float body = smoothstep(-0.02, 0.02, h) * exp(-max(h, 0.0) * (2.2 + seed * 0.5));
  float folds = avNoise(vec2(x * (18.0 + seed * 6.0), t * 0.35 + seed));
  folds = pow(folds, 2.5 - shimmer * 1.3);
  float edge = exp(-abs(h) * 30.0);
  return body * (0.35 + folds * 1.4) + edge * folds * 0.8;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * (0.6 + uIntensity * 0.6);
  float hi = texture(iChannel0, vec2(0.55, 0.25)).x;
  float lo = texture(iChannel0, vec2(0.03, 0.25)).x;
  float horizon = -0.28;
  bool water = uv.y < horizon;
  vec2 q = uv;
  if (water) {
    q.y = 2.0 * horizon - uv.y;
    q.x += (avNoise(vec2(uv.x * 6.0, uv.y * 40.0 + iTime)) - 0.5) * 0.03;
  }
  vec2 sky = vec2(q.x, q.y - horizon);

  vec3 col = mix(uColBg, uColBg * 0.4, smoothstep(0.0, 0.7, sky.y));
  // stars
  vec2 sg = floor(fragCoord / 3.0);
  vec3 s3 = fract(vec3(sg.xyx) * vec3(0.1031, 0.1030, 0.0973));
  s3 += dot(s3, s3.yzx + 33.33);
  float sh = fract((s3.x + s3.y) * s3.z);
  float st = step(0.996, sh) * (0.5 + 0.5 * sin(iTime * 2.0 + sh * 6283.0));
  if (!water) col += vec3(st) * 0.6 * smoothstep(0.0, 0.3, sky.y);

  float shimmer = clamp(hi * 1.6, 0.0, 1.0);
  vec3 aur = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 lp = vec2(sky.x * (1.0 + fi * 0.35) + fi * 3.1, sky.y * (1.0 + fi * 0.2));
    float c = curtain(lp, t + fi * 11.0, fi, shimmer);
    vec3 tint = mix(uColA, uColB, smoothstep(0.0, 0.45, sky.y + fi * 0.08));
    tint = mix(tint, uColC, fi * 0.25);
    aur += tint * c * (1.0 - fi * 0.25);
  }
  float breath = 0.45 + 0.55 * (0.4 + uIntensity * 0.6) + lo * 0.35 + uBeatPulse * 0.08 * uIntensity;
  col += aur * breath * 0.55;
  if (water) col *= 0.45 * (0.7 + 0.3 * avNoise(vec2(uv.x * 30.0, uv.y * 90.0 - iTime * 2.0)));
  col += uColC * exp(-abs(uv.y - horizon) * 60.0) * 0.08;
  col = col / (1.0 + col * 0.4);
  fragColor = vec4(col, 1.0);
}
