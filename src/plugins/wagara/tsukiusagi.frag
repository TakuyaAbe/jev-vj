// @name Tsuki Usagi Pattern
// @description お月見の夜、群青の夜空に「月に兎」の丸紋が市松に並び、その間をすすきの穂が風にそよぐ。金の縁取りの満月の中には座った兎の影。低音で月がふくらみ、すすきが揺れる。キックのたびにいくつかの兎がぴょんと跳ね、その月がふわりと明るむ。高音で星がまたたき、縁がきらめく。ほのぼのと愛らしく、のんびりした秋の夜。ミドルテンポのチルやローファイ、ゆるいヒップホップに合う
// @short 9月・月に兎とすすきの柄。ほのぼの愛らしい。チル・ローファイ
// @group wagara
// @month 9
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

float tuEll(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }

// sitting rabbit facing left (-x), ears leaning back
float tuRabbit(vec2 q) {
  float d = tuEll(q - vec2(0.03, -0.09), vec2(0.15, 0.11));
  d = min(d, length(q - vec2(-0.10, 0.02)) - 0.075);
  d = min(d, tuEll(rot(-0.35) * (q - vec2(-0.07, 0.175)), vec2(0.026, 0.085)));
  d = min(d, tuEll(rot(-0.80) * (q - vec2(-0.027, 0.146)), vec2(0.024, 0.08)));
  d = min(d, length(q - vec2(0.18, -0.07)) - 0.035);
  d = min(d, tuEll(q - vec2(-0.07, -0.18), vec2(0.06, 0.025)));
  return d;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 2.8 + uIntensity * 1.8;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p.x += uTime * (0.04 + uIntensity * 0.16);
  p.y += sin(uTime * 0.12) * 0.15;

  // night sky
  vec3 yoru = mix(vec3(0.06, 0.08, 0.22), uColBg, 0.35);
  vec3 col = yoru * (1.0 + 0.6 * uv.y);

  // twinkling stars on the highs (screen space)
  vec2 sg = uv * 90.0;
  vec2 sid = floor(sg);
  float star = step(0.986, hash1(sid)) * smoothstep(0.3, 0.0, length(fract(sg) - 0.5));
  star *= 0.3 + 0.7 * uHigh * step(0.45, hash1(sid + floor(uTime * 7.0)));
  col += vec3(1.0, 0.95, 0.8) * star;

  // susuki: stalks per row, bending in the wind, silver-gold plumes on top
  float row = floor(p.y);
  float ry = fract(p.y);
  float sway = (0.10 + 0.08 * uIntensity) * sin(uTime * 0.7 + p.x * 0.5 + row * 1.3) + uBass * 0.05;
  float sw = 0.17;
  float u = p.x - sway * ry * ry;
  float stId = floor(u / sw);
  float hs = hash1(vec2(stId, row));
  float lx = (fract(u / sw) - 0.5) * sw - (hs - 0.5) * 0.05;
  float present = step(0.4, hs);
  float hgt = 0.40 + 0.45 * hash1(vec2(stId + 3.1, row));
  float stem = smoothstep(px, -px, abs(lx) - 0.005) * step(ry, hgt) * present;
  vec3 stemCol = mix(vec3(0.42, 0.40, 0.28), yoru, 0.45);
  col = mix(col, stemCol, stem);
  float pt = (ry - (hgt - 0.28)) / 0.28;
  float pw = 0.035 * sin(3.14159 * clamp(pt, 0.0, 1.0)) + 0.004;
  pw *= 0.7 + 0.3 * noise(vec2(ry * 40.0, stId * 1.7));
  float plume = smoothstep(px, -px, abs(lx) - pw) * step(0.0, pt) * step(pt, 1.0) * present;
  vec3 hoCol = mix(vec3(0.86, 0.78, 0.58), uColC, 0.25) * (0.6 + 0.4 * pt);
  col = mix(col, hoCol, plume * 0.8);

  // tsuki-ni-usagi crests on a checkerboard
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float h = hash1(cell);
  float has = 1.0 - mod(cell.x + cell.y, 2.0);
  float R = 0.33 * (1.0 + uBass * 0.05);
  float d = length(f) - R;
  float cellFade = smoothstep(0.5, 0.4, max(abs(f.x), abs(f.y)));

  // beat: chosen rabbits hop and their moon brightens
  float sel = step(0.78 - uIntensity * 0.3, hash1(cell + floor(uBeat) * 0.37));
  float hop = sel * sin(3.14159 * clamp(uBeatPhase * 1.6, 0.0, 1.0)) * 0.075;
  float flash = sel * uBeatPulse;

  vec3 moon = mix(vec3(1.0, 0.90, 0.62), uColA, 0.25);
  vec3 kin = mix(vec3(0.92, 0.76, 0.40), uColC, 0.3);
  col += moon * exp(-max(d, 0.0) * 10.0) * (0.12 + 0.3 * flash + 0.08 * uBass) * cellFade * has;

  vec3 mc = moon * (0.88 + 0.12 * noise(f * 9.0 + cell * 3.1));
  mc *= 1.0 - 0.18 * pow(clamp(length(f) / R, 0.0, 1.0), 4.0);
  mc *= 0.92 + 0.08 * sin(h * 6.2832 + uBarPhase * 6.2832);
  mc += vec3(1.0, 0.95, 0.8) * flash * 0.25;
  // shadow on the moon shrinks while the rabbit is in the air
  float shD = tuEll(vec2(f.x, f.y + 0.215), vec2(0.13 - hop * 0.6, 0.022));
  mc *= 1.0 - 0.15 * smoothstep(px, -px, shD);

  float dir = h > 0.5 ? 1.0 : -1.0;
  vec2 q = vec2(f.x * dir, f.y - hop);
  float rd = tuRabbit(q);
  float rabbit = smoothstep(px, -px, max(rd, d));
  vec3 rabbitCol = mix(vec3(0.18, 0.20, 0.40), uColB, 0.2);
  vec3 crestCol = mix(mc, rabbitCol, rabbit);
  float eye = smoothstep(px, -px, length(q - vec2(-0.125, 0.035)) - 0.012);
  crestCol = mix(crestCol, mc, eye * rabbit);
  col = mix(col, crestCol, smoothstep(px, -px, d) * has);

  // golden frame ring, glinting on the highs
  float ringD = abs(length(f) - (R + 0.035)) - 0.008;
  float glint = step(0.7, hash1(floor(f * 30.0) + cell + floor(uTime * 9.0))) * uHigh;
  vec3 ringCol = kin * (0.8 + 0.3 * uHigh + 0.6 * flash) + vec3(1.0) * glint * 0.4;
  col = mix(col, ringCol, smoothstep(px, -px, ringD) * has);

  col = mix(col, uColA, 0.06 * uBass);
  gl_FragColor = vec4(col * (0.8 + 0.2 * uEnergy), 1.0);
}
