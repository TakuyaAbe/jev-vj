// @name Tanzaku Stars Pattern
// @description 七夕の笹飾り。夜空に張った笹の糸から青・赤・黄・白・紫の五色の短冊が段々に吊られ、風に揺れて並ぶ。背景には天の川が淡く流れ、星々が高音に合わせてまたたく。キックのたびにいくつかの短冊がくるりと裏返り、金の裏面を見せてから戻る。低音で揺れが大きくなる。夏祭りのように賑やかで弾ける。ディスコやファンク、ノリのいいグルーヴが続くパートに合う
// @short 7月・短冊と星の柄。賑やかで弾ける。ディスコ・ブギー
// @group wagara
// @month 7
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

float tzBox(vec2 q, vec2 hs) {
  vec2 d = abs(q) - hs;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  // night sky: indigo from the palette background, a faint milky way, twinkling stars
  vec3 yoru = mix(uColBg, vec3(0.04, 0.06, 0.18), 0.55);
  vec3 col = yoru * (0.85 + 0.3 * (0.5 - uv.y * 0.5));
  vec2 sv = uv + vec2(uTime * 0.01, 0.0);
  float bd = dot(uv, vec2(0.45, 0.89)) + 0.05;
  float band = exp(-bd * bd * 9.0);
  float milky = band * (0.35 + 0.65 * noise(sv * 3.0 + vec2(0.0, uTime * 0.02))) * (0.6 + 0.4 * noise(sv * 9.0));
  vec3 hoshi = mix(vec3(0.85, 0.90, 1.0), uColC, 0.25);
  col += mix(hoshi, uColB, 0.3) * milky * 0.22;
  float spx = 1.0 / uRes.y;
  for (int k = 0; k < 2; k++) {
    float gs = 22.0 + float(k) * 19.0;
    vec2 gp = sv * gs;
    vec2 g = floor(gp);
    float hs = hash1(g + float(k) * 17.0);
    vec2 sp = 0.2 + 0.6 * hash2(g + float(k) * 5.0);
    float sd = length(gp - g - sp) / gs;
    float tw = 0.5 + 0.5 * sin(uTime * (2.0 + hs * 5.0) + hs * 40.0);
    float on = step(0.62 - band * 0.3, hs);
    float amp = on * (0.25 + 0.45 * tw * (0.3 + uHigh)) * (1.0 - float(k) * 0.4);
    float rad = spx * (1.2 + hs * 1.5 + uHigh * 1.2);
    col += hoshi * amp * (1.0 - smoothstep(rad, rad + spx * 1.5, sd));
    col += hoshi * amp * 0.25 * exp(-sd / (spx * 5.0)) * step(0.9, hs);
  }

  // hanging tanzaku grid
  float scale = 3.0 + uIntensity * 2.2;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p.x += uTime * (0.06 + uIntensity * 0.20);
  vec2 cs = vec2(1.0, 1.25);
  float row = floor(p.y / cs.y);
  p.x += 0.5 * mod(row, 2.0);
  vec2 cell = vec2(floor(p.x), row);
  vec2 f = vec2(fract(p.x) - 0.5, p.y - (row + 0.5) * cs.y);
  float h = hash1(cell);

  // bamboo thread across the top of each row
  float pivotY = cs.y * 0.5 - 0.10;
  float thread = 1.0 - smoothstep(0.008, 0.008 + px, abs(f.y - pivotY - 0.015 * sin(p.x * 3.1416 * 2.0)));
  vec3 take = mix(vec3(0.45, 0.68, 0.40), uColB, 0.2);
  col = mix(col, take * 0.8, thread * 0.8);

  // sasa leaf between the strips
  vec2 lq = rot(0.5 + 0.15 * sin(uTime * 0.9 + h * 7.0)) * (f - vec2(0.36, pivotY - 0.04));
  float leaf = length(vec2(lq.x, lq.y * 4.2)) - 0.13;
  float leafM = smoothstep(px * 3.0, -px * 3.0, leaf) * step(0.35, h);
  col = mix(col, take * (0.75 + 0.35 * smoothstep(-0.03, 0.03, lq.y)), leafM);

  // sway around the pivot; the bass swings harder
  float sway = sin(uTime * (0.9 + h * 0.7) + h * 6.2832 + p.x * 0.3) * (0.05 + 0.14 * uIntensity + 0.10 * uBass);
  vec2 q = rot(sway) * (f - vec2(0.0, pivotY));

  // beat: some strips spin once around their vertical axis, gold side first
  float flip = step(0.78 - uIntensity * 0.25, hash1(cell + floor(uBeat) * 0.37));
  float fang = 3.1415927 * uBeatPulse * flip;
  float cf = cos(fang);
  float sx = max(abs(cf), 0.03);
  float back = step(cf, 0.0);

  float L = 0.78 + 0.08 * h;
  float gap = 0.10;
  float hw = 0.13;
  vec2 bq = vec2(q.x / sx, q.y + gap + L * 0.5);
  float d = tzBox(bq, vec2(hw, L * 0.5)) * sx;
  float strip = smoothstep(px, -px, d);
  float cord = (1.0 - smoothstep(0.004, 0.004 + px, abs(q.x))) * step(-gap, q.y) * step(q.y, 0.0);
  col = mix(col, vec3(0.92, 0.88, 0.80), cord * 0.8);

  // five colours of tanabata (goshiki), mixed with the palette
  float ci = floor(h * 5.0);
  vec3 c0 = vec3(0.22, 0.45, 0.88);
  vec3 c1 = vec3(0.90, 0.25, 0.30);
  vec3 c2 = vec3(0.98, 0.82, 0.30);
  vec3 c3 = vec3(0.97, 0.95, 0.90);
  vec3 c4 = vec3(0.56, 0.36, 0.78);
  vec3 paper = ci < 0.5 ? c0 : (ci < 1.5 ? c1 : (ci < 2.5 ? c2 : (ci < 3.5 ? c3 : c4)));
  paper = mix(paper, uColA, 0.25);
  float ly = clamp(-(q.y + gap) / L, 0.0, 1.0);
  paper *= 0.92 + 0.12 * (1.0 - ly) + 0.06 * sin(uBarPhase * 6.2832 + h * 6.2832);
  // a wish written down the middle: faint brush dashes
  float ink = (1.0 - smoothstep(0.018, 0.018 + px, abs(bq.x)))
    * step(0.6, fract(bq.y * 7.0 + h * 3.0)) * step(0.1, ly) * step(ly, 0.85);
  paper = mix(paper, paper * 0.45, ink * 0.6 * (1.0 - back));
  // gold back with a moving shine
  vec3 kin = mix(vec3(0.97, 0.78, 0.34), uColC, 0.3);
  vec3 gold = kin * (0.9 + 0.35 * smoothstep(0.3, 0.0, abs(fract(ly * 1.5 - uTime * 1.2) - 0.5)));
  paper = mix(paper, gold, back);
  paper *= 0.75 + 0.25 * sx;
  paper += kin * flip * uBeatPulse * 0.25;
  // soft shadow of the strip onto the sky
  float sh = smoothstep(0.08, 0.0, tzBox(bq - vec2(0.05, -0.04), vec2(hw, L * 0.5)) * sx);
  col *= 1.0 - 0.35 * sh * (1.0 - strip);
  col = mix(col, paper, strip);
  // edge glint on the highs
  float rim = 1.0 - smoothstep(0.0, px * 1.5, abs(d));
  col += hoshi * rim * uHigh * 0.35;

  col = mix(col, uColA, 0.06 * uBass);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
