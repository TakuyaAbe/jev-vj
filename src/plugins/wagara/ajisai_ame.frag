// @name Ajisai Rain Pattern
// @description 梅雨の紫陽花。四枚の萼をもつ小花が互い違いにびっしり並び、青・紫・薄紅へとゆっくり色が移ろう。その上を細い雨筋が斜めに降り続ける。キックのたびにあちこちへ雨粒が落ちて水の輪が広がり、輪が通った花がふっと明るむ。低音で花がふくらみ、高音で雨粒がきらめく。瑞々しく涼やか。ミッドテンポのハウスやオーガニックなグルーヴ、じわじわ続く中盤に合う
// @short 6月・紫陽花と雨の柄。瑞々しく涼やか。ミッドテンポの揺れ
// @group wagara
// @month 6
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

// four-sepal hydrangea floret: union of four round sepals
float ajFloret(vec2 q, float R) {
  float d = 1e5;
  for (int k = 0; k < 4; k++) {
    float a = float(k) * 1.5707963 + 0.7853982;
    vec2 c = vec2(cos(a), sin(a)) * R * 0.46;
    d = min(d, length(q - c) - R * 0.50);
  }
  return d;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 5.0 + uIntensity * 3.0;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p += vec2(uTime * (0.05 + uIntensity * 0.18), -uTime * (0.03 + uIntensity * 0.06));

  vec3 moss = mix(uColBg, vec3(0.08, 0.16, 0.14), 0.6);
  vec3 col = moss * (0.9 + 0.1 * noise(p * 0.7));

  // beat: raindrops hit and ripple rings spread (drop grid is coarser than the floret grid)
  vec2 rp = p * 0.5;
  vec2 rc = floor(rp);
  float rpx = px * 0.5;
  float ringR = uBeatPhase * 0.95;
  float ringA = (1.0 - uBeatPhase) * (1.0 - uBeatPhase);
  float ripple = 0.0;
  float rwave = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 n = rc + vec2(float(i), float(j));
      float act = step(0.62 - uIntensity * 0.30, hash1(n + floor(uBeat) * 0.37));
      vec2 c = n + 0.2 + 0.6 * hash2(n + floor(uBeat) * 0.71);
      float dd = length(rp - c);
      float r1 = abs(dd - ringR);
      float r2 = abs(dd - ringR * 0.6);
      float lineW = 0.012;
      ripple += act * ringA * ((1.0 - smoothstep(lineW, lineW + rpx * 1.5, r1)) + 0.6 * (1.0 - smoothstep(lineW, lineW + rpx * 1.5, r2)));
      rwave += act * ringA * exp(-r1 * 10.0) * step(dd, ringR + 0.1);
    }
  }
  ripple = clamp(ripple, 0.0, 1.0);
  rwave = clamp(rwave, 0.0, 1.0);

  // florets on a staggered (brick) grid
  float row = floor(p.y);
  vec2 bp = vec2(p.x + 0.5 * mod(row, 2.0), p.y);
  vec2 cell = floor(bp);
  vec2 f = fract(bp) - 0.5;
  float h = hash1(cell);
  float ang = h * 6.2832 + sin(uTime * 0.4 + h * 9.0) * 0.12;
  vec2 q = rot(ang) * (f + (hash2(cell) - 0.5) * 0.06);
  float R = 0.46 * (0.88 + 0.12 * h) * (1.0 + 0.07 * uBass);
  float d = ajFloret(q, R);
  float fl = smoothstep(px, -px, d);

  // soil-pH colour drift: blue -> violet -> pale pink across the field
  float ph = noise(cell * 0.18 + vec2(uTime * 0.04, 0.0));
  vec3 ao = mix(vec3(0.33, 0.50, 0.92), uColA, 0.25);
  vec3 murasaki = mix(vec3(0.58, 0.42, 0.86), uColB, 0.25);
  vec3 usubeni = mix(vec3(0.93, 0.60, 0.78), uColA, 0.2);
  vec3 petal = ph < 0.5 ? mix(ao, murasaki, ph * 2.0) : mix(murasaki, usubeni, ph * 2.0 - 1.0);
  petal *= 0.88 + 0.24 * h;
  // sepal shading: paler at the tips, a soft crease between sepals
  float rr = length(q) / R;
  float crease = smoothstep(0.10, 0.0, min(abs(q.x), abs(q.y)) / R) * smoothstep(0.1, 0.5, rr);
  petal = mix(petal * 0.82, mix(petal, vec3(1.0), 0.25), smoothstep(0.1, 0.95, rr));
  petal *= 1.0 - 0.18 * crease;
  // rims darken slightly so neighbours read apart
  petal *= 1.0 - 0.25 * smoothstep(-px * 4.0, 0.0, d);
  petal = mix(petal, mix(petal, vec3(1.0), 0.55), rwave);
  col = mix(col, petal, fl);

  // tiny centre bud
  float bud = smoothstep(px, -px, length(q) - R * 0.09);
  col = mix(col, mix(vec3(0.95, 0.96, 0.85), uColC, 0.25), bud * 0.85);

  // slanted rain streaks, falling
  vec2 rv = uv;
  rv.x += rv.y * 0.18;
  float colId = floor(rv.x * 70.0);
  float hc = hash1(vec2(colId, 3.0));
  float fall = rv.y * (1.2 + hc) + uTime * (1.6 + hc * 1.4 + uIntensity * 1.8) + hc * 10.0;
  float seg = fract(fall);
  float xin = abs(fract(rv.x * 70.0) - 0.5);
  float thin = 1.0 - smoothstep(0.06, 0.06 + 70.0 / uRes.y, xin);
  float streak = smoothstep(0.0, 0.05, seg) * (1.0 - smoothstep(0.05, 0.35 + 0.2 * hc, seg));
  float dens = step(0.55 - uIntensity * 0.25, hash1(vec2(colId, floor(fall))));
  vec3 rainCol = mix(vec3(0.80, 0.88, 0.98), uColC, 0.2);
  col += rainCol * thin * streak * dens * (0.18 + 0.25 * uIntensity + 0.5 * uHigh);

  // raindrop glints on the highs
  float spark = step(0.975, hash1(floor(p * 7.0) + floor(uTime * 9.0))) * uHigh;
  col += rainCol * spark * fl * 0.7;

  col = mix(col, rainCol, ripple * (0.55 + 0.3 * uEnergy));
  col *= 0.92 + 0.08 * sin(uBarPhase * 6.2832 + h * 6.2832);
  col = mix(col, uColA, 0.07 * uBass);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
