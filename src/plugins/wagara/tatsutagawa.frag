// @name Tatsutagawa Pattern
// @description 紅葉の名所・龍田川。藍と浅葱の観世水が白い線で渦を巻きながら流れ、その上を紅・朱・黄の楓がくるくる回りながら流されていく。低音で渦が深く巻き、葉がふくらむ。キックのたびにいくつかの楓がひらりと裏返って金色に光り、水面に波紋が広がる。高音で水の線がきらめく。流麗で艶やか、しっとりとした秋の情緒。メロディアスなブレイクや歌ものの間奏、ゆったりしたビルドに合う
// @short 10月・龍田川の柄。流麗で艶やか。メロディアスなブレイク
// @group wagara
// @month 10
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

float ttSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// seven-lobed maple leaf, tip up, smaller lobes toward the stem
float ttLeaf(vec2 q, float R) {
  float a = atan(q.x, q.y + 0.00001);
  float lobe = pow(0.5 + 0.5 * cos(a * 7.0), 2.5);
  float low = smoothstep(3.14159, 1.6, abs(a));
  float r = R * (0.42 + 0.58 * lobe) * (0.55 + 0.45 * low);
  r *= 1.0 + 0.03 * sin(a * 35.0);
  return length(q) - r;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.0 + uIntensity * 2.0;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  float flow = uTime * (0.10 + uIntensity * 0.35);

  // kanzemizu: flowing bands, twirled into one curl per 2x1 cell
  vec2 wp = p + vec2(flow, 0.0);
  vec2 sc = vec2(2.0, 1.0);
  vec2 swId = floor(wp / sc);
  vec2 cen = (swId + 0.5) * sc + (hash2(swId) - 0.5) * vec2(0.6, 0.08);
  vec2 sq = wp - cen;
  float fall = smoothstep(0.44, 0.0, length(sq));
  float sh = hash1(swId + 11.0);
  float tw = (sh > 0.5 ? 1.0 : -1.0) * (2.4 + uBass * 0.9 + 0.4 * sin(uTime * 0.3 + sh * 6.2832)) * fall * fall;
  vec2 wq = cen + rot(tw) * sq;
  float w = wq.y + 0.08 * sin(wq.x * 1.4 + uTime * 0.3) + 0.04 * sin(wq.x * 3.1 - uTime * 0.5);
  float bands = w * 3.5;
  float bIdx = floor(bands);
  float bDist = (0.5 - abs(fract(bands) - 0.5)) / 3.5;

  vec3 ai = mix(mix(vec3(0.07, 0.17, 0.38), uColB, 0.25), uColBg, 0.3);
  vec3 asagi = mix(mix(vec3(0.30, 0.56, 0.66), uColB, 0.25), uColBg, 0.2);
  vec3 shiro = vec3(0.96, 0.95, 0.90);
  float lw = 0.012 + uHigh * 0.004;
  float line = 1.0 - smoothstep(lw, lw + px * 1.5, bDist);
  float spark = step(0.97, hash1(floor(wq * vec2(6.0, 20.0)) + floor(uTime * 10.0))) * uHigh;
  vec3 col = mix(ai, asagi, mod(bIdx, 2.0));
  col = mix(col, shiro * (0.85 + 0.6 * spark), line * 0.9);

  // maple leaves drifting a little faster than the water
  vec2 lp = p + vec2(flow * 1.25, 0.0);
  lp.y += 0.05 * sin(lp.x * 1.3 + uTime * 0.6);
  float row = floor(lp.y);
  lp.x += mod(row, 2.0) * 0.5;
  vec2 cell = floor(lp);
  vec2 f = fract(lp) - 0.5;
  float h = hash1(cell + 3.7);
  float present = step(0.3, h);
  vec2 o = (hash2(cell + 1.3) - 0.5) * 0.16;
  float spin = (h > 0.6 ? 1.0 : -1.0) * uTime * (0.2 + 0.3 * uIntensity);
  mat2 lr = rot(h * 6.2832 + spin);
  float R = 0.24 * (1.0 + uBass * 0.06) * (0.85 + 0.3 * hash1(cell + 9.0));

  // beat: chosen leaves flip over (squash through zero width) and a ripple spreads
  float sel = step(0.78 - uIntensity * 0.3, hash1(cell + floor(uBeat) * 0.37)) * present;
  float sx = cos(3.14159 * uBeatPulse * sel);
  float back = step(sx, 0.0);
  float ax = max(abs(sx), 0.08);
  float pxl = px / max(abs(sx), 0.3);

  // soft shadow on the water
  vec2 qs = lr * (f - o - vec2(0.03, -0.04));
  qs.x /= ax;
  float ds = ttLeaf(qs, R);
  col *= 1.0 - 0.3 * smoothstep(0.04, -0.02, ds) * present;

  // ripple ring
  float cellFade = smoothstep(0.5, 0.42, max(abs(f.x), abs(f.y)));
  float ph = clamp(uBeatPhase, 0.0, 1.0);
  float rip = abs(length(f - o) - (0.14 + ph * 0.30));
  col += shiro * (1.0 - smoothstep(0.006, 0.006 + px * 1.5, rip)) * sel * (1.0 - ph) * cellFade * 0.6;

  vec2 q = lr * (f - o);
  q.x /= ax;
  float d = ttLeaf(q, R);
  float hc = hash1(cell + 5.0);
  vec3 beni = mix(vec3(0.82, 0.12, 0.10), uColA, 0.25);
  vec3 shu = mix(vec3(0.95, 0.42, 0.08), uColA, 0.25);
  vec3 ki = mix(vec3(0.96, 0.72, 0.20), uColC, 0.25);
  vec3 leafCol = hc < 0.55 ? beni : (hc < 0.85 ? shu : ki);
  float rn = clamp(length(q) / R, 0.0, 1.0);
  vec3 front = leafCol * (0.72 + 0.38 * (1.0 - rn));
  front *= 0.9 + 0.1 * sin(h * 6.2832 + uBarPhase * 6.2832);
  // veins toward each lobe tip
  float a = atan(q.x, q.y + 0.00001);
  float sec = 6.2831853 / 7.0;
  float al = a - floor(a / sec + 0.5) * sec;
  float vein = (1.0 - smoothstep(0.005, 0.005 + pxl, length(q) * abs(sin(al)))) * step(rn, 0.85);
  front *= 1.0 - 0.3 * vein;
  vec3 backCol = mix(leafCol, vec3(1.0, 0.85, 0.55), 0.45) + uColC * uBeatPulse * 0.3;
  vec3 lc = mix(front, backCol, back);
  col = mix(col, lc, smoothstep(pxl * 1.5, -pxl * 1.5, d) * present);

  float stemD = ttSeg(q, vec2(0.0, -0.25 * R), vec2(0.06 * R, -1.12 * R)) - 0.010;
  col = mix(col, leafCol * 0.6, smoothstep(pxl, -pxl, stemD) * present);

  col = mix(col, uColA, 0.06 * uBass);
  gl_FragColor = vec4(col * (0.8 + 0.2 * uEnergy), 1.0);
}
