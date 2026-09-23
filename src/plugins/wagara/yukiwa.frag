// @name Yukiwa Pattern
// @description 大晦日の夜、藍と墨の市松に白い雪輪紋が整然と並び、ゆっくり降りてくる。小節の頭ごとに除夜の鐘が鳴るように金の同心円が一点から広がり、波が通った雪輪がほのかに金色に光る。キックでいくつかの雪輪がひと刻みくるりと回って光り、高音で輪郭に霜のきらめきが走る。凛として静か、一年を締めくくる余韻。アウトロや終盤の締めくくり、ミニマルで間のある展開に合う
// @short 12月・雪輪と市松の柄。凛と静か。アウトロ・締めくくり
// @group wagara
// @month 12
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

// snow-ring crest: six overlapping round lobes with sharp notches, round hole in the middle
float ykCrest(vec2 q, float R) {
  float a = atan(q.y, q.x);
  float sec = 1.0471976;
  float ang = mod(a + sec * 0.5, sec) - sec * 0.5;
  vec2 qq = length(q) * vec2(cos(ang), sin(ang));
  float lobes = length(qq - vec2(R * 0.62, 0.0)) - R * 0.40;
  float hole = R * 0.30 - length(q);
  return max(lobes, hole);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.2 + uIntensity * 2.2;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p.y += uTime * (0.06 + uIntensity * 0.22);
  p.x += sin(uTime * 0.15) * 0.3;

  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float par = mod(cell.x + cell.y, 2.0);
  float h = hash1(cell);

  // ichimatsu: indigo / sumi squares, blended across the seam for clean edges
  vec3 ai = mix(vec3(0.10, 0.17, 0.36), uColA, 0.2);
  vec3 sumi = mix(uColBg, vec3(0.13, 0.14, 0.18), 0.6);
  float e = 0.5 - max(abs(f.x), abs(f.y));
  float own = 0.5 + 0.5 * smoothstep(0.0, px, e);
  vec3 sqA = mix(ai, sumi, par);
  vec3 sqB = mix(sumi, ai, par);
  vec3 col = mix(sqB, sqA, own);

  // bell toll: golden concentric rings from one point per bar
  vec2 o = (hash2(vec2(uBar, 7.0)) - 0.5) * vec2(1.2, 0.6);
  float dist = length(uv - o);
  float ph = uBarPhase;
  float fade = pow(1.0 - ph, 1.5) * (0.5 + 0.5 * uEnergy);
  float ringLine = 0.0;
  float wave = 0.0;
  float pxs = 1.0 / uRes.y;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float fr = ph * 1.8 - fk * 0.12;
    float amp = fade * (1.0 - fk * 0.22) * step(0.0, fr);
    ringLine += amp * (1.0 - smoothstep(0.003, 0.003 + pxs * 1.5, abs(dist - fr)));
    wave += amp * exp(-abs(dist - fr) * 14.0);
  }

  // crest: spins one notch (60 deg, so it lands where it started) on the beat
  float flip = step(0.82 - uIntensity * 0.25, hash1(cell + floor(uBeat) * 0.37));
  float ang = flip * 1.0471976 * (1.0 - uBeatPulse) + (h - 0.5) * 0.2;
  vec2 q = rot(ang) * f;
  float R = 0.36 * (1.0 + uBass * 0.08);
  float d = ykCrest(q, R);
  float crest = smoothstep(px, -px, d);
  vec3 snow = mix(vec3(0.95, 0.97, 1.0), uColA, 0.15);
  vec3 frost = mix(vec3(0.72, 0.80, 0.92), uColB, 0.2);
  vec3 kane = mix(vec3(0.96, 0.76, 0.40), uColC, 0.3);
  vec3 crestCol = mix(snow, frost, par);
  crestCol = mix(crestCol, kane, clamp(wave * 1.2, 0.0, 0.85));
  crestCol += uColC * flip * uBeatPulse * 0.5;
  col = mix(col, crestCol, crest);

  // frost sparkle along the crest outline on the highs
  float rim = 1.0 - smoothstep(0.0, px * 2.0, abs(d));
  float tw = step(0.6, hash1(floor(q * 40.0) + floor(uTime * 8.0)));
  col += snow * rim * tw * uHigh * 0.6;

  // tiny dot in the hole, glowing with the bell
  float dotD = length(q) - R * 0.07;
  col = mix(col, mix(frost, kane, clamp(wave, 0.0, 1.0)), smoothstep(px, -px, dotD) * (0.4 + 0.6 * clamp(wave, 0.0, 1.0)));

  col = mix(col, kane, clamp(ringLine, 0.0, 1.0) * 0.8);
  col *= 0.9 + 0.1 * sin(h * 6.2832 + uTime * 0.5);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
