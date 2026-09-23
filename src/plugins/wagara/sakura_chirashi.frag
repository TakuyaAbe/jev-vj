// @name Sakura Chirashi Pattern
// @description 花見の頃の桜散らし。浅葱の流水の上に、薄紅・白・紅の五弁の桜紋が大小ばらばらに散らされ、花筏のように斜めへ流れていく。キックのたびにいくつかの桜紋がくるりとひと回りしながらふわっと咲きひらいて光り、はらはら舞う花びらもひるがえる。低音で花がふくらみ、高音で花びらの縁がきらめく。うららかで軽やか、春の昼下がりの浮き立つ気分。ハウスや爽やかなグルーヴ、明るいボーカルの歌ものに合う
// @short 4月・桜散らしと流水の柄。うららかで軽やか。ハウス・爽やかなグルーヴ
// @group wagara
// @month 4
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

// five-petal sakura crest: separate oval petals with a notch at each tip
float skCrest(vec2 q, float R) {
  float a = atan(q.y, q.x);
  float sec = 1.2566371;
  float ang = mod(a + sec * 0.5, sec) - sec * 0.5;
  vec2 qq = length(q) * vec2(cos(ang), sin(ang));
  vec2 e = (qq - vec2(R * 0.55, 0.0)) / vec2(R * 0.46, R * 0.36);
  float petal = (length(e) - 1.0) * R * 0.36;
  float notch = R * 0.17 - length(qq - vec2(R * 1.02, 0.0));
  float core = length(q) - R * 0.2;
  return min(max(petal, notch), core);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.4 + uIntensity * 2.2;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  vec2 flow = vec2(uTime * (0.10 + uIntensity * 0.30), -uTime * (0.03 + uIntensity * 0.08));

  vec3 asagi = mix(vec3(0.32, 0.62, 0.66), uColA, 0.25);
  vec3 bg = mix(uColBg, asagi, 0.65);
  vec3 usubeni = mix(vec3(1.0, 0.78, 0.84), uColA, 0.2);
  vec3 shiro = vec3(1.0, 0.97, 0.97);
  vec3 beni = mix(vec3(0.92, 0.42, 0.56), uColA, 0.25);
  vec3 shin = mix(vec3(0.78, 0.16, 0.30), uColB, 0.25);
  vec3 kin = mix(vec3(0.98, 0.84, 0.46), uColC, 0.3);

  // ryusui: pairs of soft flowing water lines
  vec2 wp = p + flow * 1.3;
  float w = wp.y + 0.18 * sin(wp.x * 1.3 + uTime * 0.5) + 0.10 * sin(wp.x * 2.9 - uTime * 0.3);
  float wf = fract(w * 1.2);
  float wl = min(abs(wf - 0.45), abs(wf - 0.55));
  float wpx = px * 1.2 * 1.3;
  float water = 1.0 - smoothstep(0.012, 0.012 + wpx, wl);
  vec3 col = mix(bg, mix(bg, shiro, 0.45), water * (0.6 + 0.2 * sin(wp.x * 0.7 + uTime)));
  col *= 0.94 + 0.06 * sin(w * 7.5398);

  // scattered crests
  vec2 cp = p + flow;
  vec2 cell = floor(cp);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float h = hash1(c);
      if (h < 0.28) continue;
      float sel = step(0.78 - uIntensity * 0.3, hash1(c + floor(uBeat) * 0.37));
      float pop = sel * uBeatPulse;
      vec2 ctr = c + 0.5 + (hash2(c) - 0.5) * 0.5;
      float R = (0.20 + 0.16 * hash1(c + 7.7)) * (1.0 + uBass * 0.07 + pop * 0.25);
      float ang = h * 6.2832 + uTime * 0.2 * (h - 0.6) + sel * 1.2566371 * (1.0 - uBeatPulse);
      vec2 q = rot(ang) * (cp - ctr);
      float d = skCrest(q, R);

      // soft drop shadow
      float ds = skCrest(rot(ang) * (cp - ctr - vec2(0.03, -0.04)), R);
      col *= 1.0 - 0.22 * (1.0 - smoothstep(-0.01, 0.06, ds));

      float kind = floor(hash1(c + 3.3) * 3.0);
      vec3 pc = kind < 0.5 ? usubeni : (kind < 1.5 ? shiro : beni);
      float rr = length(q) / R;
      pc = mix(pc * 0.86, pc, smoothstep(0.2, 0.9, rr));
      // flower heart and five stamens
      float a = atan(q.y, q.x) + 0.6283185;
      float sec = 1.2566371;
      float sa = mod(a + sec * 0.5, sec) - sec * 0.5;
      vec2 sq = length(q) * vec2(cos(sa), sin(sa));
      float stamen = 1.0 - smoothstep(R * 0.045, R * 0.045 + px, length(sq - vec2(R * 0.3, 0.0)));
      float heart = 1.0 - smoothstep(R * 0.12, R * 0.12 + px, length(q));
      pc = mix(pc, shin, max(heart, stamen) * 0.85);
      pc += kin * pop * 0.35;
      // glowing rim on the beat, sparkle on the highs
      float rim = 1.0 - smoothstep(0.0, px * 2.0 + 0.02, abs(d));
      float tw = step(0.7, hash1(floor(q * 30.0) + floor(uTime * 9.0)));
      pc += uColC * rim * (0.1 + pop * 0.6) + shiro * rim * tw * uHigh * 0.5;

      float cov = 1.0 - smoothstep(-px, px, d);
      col = mix(col, pc, cov);
    }
  }

  // loose fluttering petals: they flip over on each beat
  vec2 fp2 = p * 1.6 + flow * 2.2 + vec2(0.0, uTime * 0.15);
  vec2 pc2 = floor(fp2);
  vec2 pf = fract(fp2) - 0.5;
  float ph = hash1(pc2 + 21.0);
  if (ph > 0.62) {
    vec2 po = (hash2(pc2 + 5.0) - 0.5) * 0.5;
    float t = uTime * (1.2 + ph) + ph * 30.0 + uBeatPulse * 1.5 * step(0.5, hash1(pc2 + floor(uBeat)));
    vec2 q = rot(sin(t * 0.7) * 1.4 + ph * 6.2832) * (pf - po);
    float squash = 0.25 + 0.75 * abs(cos(t));
    q.x /= squash;
    vec2 e = q / vec2(0.10, 0.07);
    float dp = (length(e) - 1.0) * 0.07 * squash;
    float nt = 0.025 - length(q - vec2(0.105, 0.0));
    dp = max(dp, nt * squash);
    float ppx = px * 1.6;
    float pcov = (1.0 - smoothstep(-ppx, ppx, dp)) * (0.55 + 0.45 * uIntensity);
    vec3 petalCol = mix(usubeni, shiro, 0.3 + 0.3 * abs(cos(t)));
    col = mix(col, petalCol, pcov);
  }

  col = mix(col, uColA, 0.07 * uBass);
  gl_FragColor = vec4(col * (0.8 + 0.2 * uEnergy), 1.0);
}
