// @name Suehiro Fan Pattern
// @description お正月の末広（扇）散らし。松葉色の地に金砂子とすやり霞が流れ、紅・白・金の扇が互い違いに並んでゆったり横へ流れる。キックのたびにいくつかの扇がぱっと大きく開いて金に光り、また閉じていく。低音で扇がふくらみ、高音で金砂子がきらめく。雅やかで悠々、腰の据わった横ノリ。ミッドテンポのグルーヴや和の香りのするトラック、落ち着いた中盤に合う
// @short 1月・末広の扇の柄。雅やかで悠々。腰の据わった横ノリ
// @group wagara
// @month 1
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.0 + uIntensity * 2.0;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p.x += uTime * (0.08 + uIntensity * 0.25);
  p.y += sin(uTime * 0.2) * 0.2;

  vec3 matsu = mix(vec3(0.07, 0.24, 0.18), uColA, 0.25);
  vec3 bg = mix(uColBg, matsu, 0.7);
  vec3 beni = mix(vec3(0.80, 0.10, 0.16), uColA, 0.25);
  vec3 shiro = vec3(1.0, 0.97, 0.90);
  vec3 kin = mix(vec3(0.95, 0.76, 0.33), uColC, 0.3);
  vec3 hone = mix(uColBg, vec3(0.30, 0.16, 0.08), 0.75);

  vec3 col = bg;

  // suyari-gasumi: long rounded mist bands in faint gold
  float bv = p.y * 0.5 + 0.25;
  float krow = floor(bv);
  float fy = fract(bv) - 0.5;
  float sx = p.x * 0.35 + hash1(vec2(krow, 1.0)) * 10.0;
  float kseg = floor(sx);
  float fx = fract(sx) - 0.5;
  vec2 kq = vec2(fx / 0.35, fy / 0.5);
  float kd = length(vec2(max(abs(kq.x) - 0.76, 0.0), kq.y)) - 0.24;
  float kasumi = step(0.45, hash1(vec2(kseg, krow))) * (1.0 - smoothstep(-px, px, kd));
  col = mix(col, mix(bg, kin, 0.22), kasumi);

  // kin-sunago: gold dust, sparkling on the highs
  vec2 gd = p * 7.0;
  vec2 gc = floor(gd);
  vec2 gf = fract(gd) - 0.5;
  vec2 go = (hash2(gc) - 0.5) * 0.6;
  float gh = hash1(gc + 3.1);
  float dustR = 0.05 + 0.08 * gh;
  float dust = step(0.72, gh) * (1.0 - smoothstep(dustR, dustR + px * 10.0, length(gf - go)));
  float tw = 0.5 + 0.5 * sin(uTime * 2.0 + gh * 40.0);
  float spark = step(0.85, hash1(gc + floor(uTime * 10.0))) * uHigh;
  col = mix(col, kin, clamp(dust * (0.3 + 0.4 * tw + spark), 0.0, 1.0));
  col += shiro * dust * spark * 0.4;

  // fans on a brick grid: pivot near the bottom of each cell, opening upward
  float row = floor(p.y);
  float xOff = mod(row, 2.0) * 0.5;
  float cellX = floor(p.x - xOff);
  for (int i = 0; i < 3; i++) {
    float dx = float(i) - 1.0;
    vec2 c = vec2(cellX + dx, row);
    float h = hash1(c);
    float sel = step(0.78 - uIntensity * 0.3, hash1(c + floor(uBeat) * 0.37));
    float pop = sel * uBeatPulse;
    vec2 pivot = vec2(c.x + 0.5 + xOff, row + 0.05);
    float tilt = (h - 0.5) * 0.3 * (0.4 + uIntensity) + sin(uTime * 0.7 + h * 6.2832) * 0.05;
    vec2 q = rot(tilt) * (p - pivot);

    float hw = 0.9 + 0.1 * uBass + pop * 0.45 + 0.06 * sin(uBarPhase * 6.2832 + h * 6.2832);
    hw = min(hw, 1.35); // keep the widest fan above its pivot so it never crosses into the row below
    float rOut = 0.84 + 0.04 * uBass + pop * 0.05;
    float rIn = 0.30;
    float r = length(q);
    float a = atan(q.x, q.y);
    vec2 qa = vec2(abs(q.x), q.y);
    float dA = qa.x * cos(hw) - qa.y * sin(hw);

    // soft shadow of the whole fan on what lies beneath
    float dFull = max(r - rOut, dA);
    float shadow = 1.0 - smoothstep(0.0, 0.08, dFull);
    col *= 1.0 - 0.3 * shadow;

    // folded paper (jigami)
    float dPaper = max(max(rIn - r, r - rOut), dA);
    float paper = 1.0 - smoothstep(-px, px, dPaper);
    float t = clamp(a / hw, -1.0, 1.0) * 6.0;
    float panel = floor(t);
    float fp = fract(t);
    float fold = mod(panel, 2.0) < 0.5 ? fp : 1.0 - fp;
    float kind = floor(h * 3.0);
    vec3 ground = kind < 0.5 ? beni : (kind < 1.5 ? shiro : kin);
    vec3 band = kind < 0.5 ? kin : (kind < 1.5 ? beni : beni);
    vec3 pc = ground;
    // hinomaru on the white fans
    float sun = (1.0 - smoothstep(0.16 - px, 0.16 + px, length(q - vec2(0.0, 0.58)))) * step(0.5, kind) * step(kind, 1.5);
    pc = mix(pc, beni, sun);
    // outer border band + thin inner line
    float outerB = smoothstep(rOut - 0.09 - px, rOut - 0.09 + px, r);
    float innerB = 1.0 - smoothstep(rIn + 0.02 - px, rIn + 0.02 + px, r);
    pc = mix(pc, band, max(outerB, innerB));
    pc *= 0.8 + 0.2 * fold;
    pc += uColC * outerB * (0.12 + pop * 0.6 + uHigh * 0.25);
    pc = mix(pc, pc + kin * 0.4, pop);

    // sticks below the paper, thick outer ribs, gold rivet
    float st = clamp(a / hw, -1.0, 1.0) * 3.0;
    float sfp = fract(st);
    float stickD = min(sfp, 1.0 - sfp) * (hw / 3.0) * r;
    float inWedge = 1.0 - smoothstep(-px, px, dA);
    float sticks = (1.0 - smoothstep(0.012, 0.012 + px, stickD)) * inWedge * (1.0 - smoothstep(rIn - px, rIn + px, r));
    float ribs = (1.0 - smoothstep(0.022, 0.022 + px, abs(dA))) * (1.0 - smoothstep(rOut - px, rOut + px, r)) * step(0.0, q.y);
    float kaname = 1.0 - smoothstep(0.035, 0.035 + px, r);

    col = mix(col, pc, paper);
    col = mix(col, hone, max(sticks, ribs));
    col = mix(col, kin, kaname);
  }

  col = mix(col, uColA, 0.08 * uBass);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
