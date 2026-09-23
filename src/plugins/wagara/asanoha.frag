// @name Asanoha Pattern
// @description 七五三の晴れ着の定番、麻の葉。正三角形の格子に金の線が走り、紅と桃の切子面が光を受けて立体的に並ぶ。キックのたびにあちこちの星（六枚の葉）がぱっと点り、千歳飴の紅白縞に染まる。低音で模様がふくらみ、高音で金の線がきらめく。可憐で健やか、弾むように明るい。跳ねるポップやかわいいボーカル曲、テンポの良いサビに合う
// @short 11月・麻の葉の柄。可憐で健やか。跳ねるポップ
// @group wagara
// @month 11
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

float asaSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// skewed lattice coords -> world (equilateral triangles of side 1)
vec2 asaW(vec2 v) { return vec2(v.x + 0.5 * v.y, v.y * 0.8660254); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 4.0 + uIntensity * 2.5 - uBass * 0.4;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p += vec2(uTime * (0.10 + uIntensity * 0.30), -uTime * (0.04 + uIntensity * 0.12));

  // triangle grid: which triangle, its vertices and barycentrics
  vec2 b = vec2(p.x - p.y * 0.5773503, p.y * 1.1547005);
  vec2 cell = floor(b);
  vec2 f = fract(b);
  float up = step(1.0, f.x + f.y);
  vec2 vA = cell + mix(vec2(0.0, 0.0), vec2(1.0, 1.0), up);
  vec2 vB = cell + mix(vec2(1.0, 0.0), vec2(0.0, 1.0), up);
  vec2 vC = cell + mix(vec2(0.0, 1.0), vec2(1.0, 0.0), up);
  vec3 bc = up < 0.5 ? vec3(1.0 - f.x - f.y, f.x, f.y) : vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y);
  vec2 wA = asaW(vA);
  vec2 wB = asaW(vB);
  vec2 wC = asaW(vC);
  vec2 G = (wA + wB + wC) / 3.0;

  // asanoha lines: triangle edges + centroid-to-vertex spokes
  float dEdge = min(asaSeg(p, wA, wB), min(asaSeg(p, wB, wC), asaSeg(p, wC, wA)));
  float dSpoke = min(asaSeg(p, G, wA), min(asaSeg(p, G, wB), asaSeg(p, G, wC)));

  // facet = sub-triangle opposite the smallest barycentric; lit like a faceted cut
  float bmin = min(bc.x, min(bc.y, bc.z));
  float bmax = max(bc.x, max(bc.y, bc.z));
  vec2 wMin = bc.x <= bmin ? wA : (bc.y <= bmin ? wB : wC);
  vec2 M = (wA + wB + wC - wMin) * 0.5;
  vec2 lightDir = normalize(vec2(cos(0.6 + sin(uTime * 0.2) * 0.4), sin(0.6 + sin(uTime * 0.2) * 0.4)));
  float shade = 0.5 + 0.5 * dot(normalize(M - G), lightDir);

  // star = the lattice vertex this point belongs to (largest barycentric)
  vec2 star = bc.x >= bmax ? vA : (bc.y >= bmax ? vB : vC);
  float bmid = 1.0 - bmax - bmin;
  float kiteAA = smoothstep(0.0, px * 1.6, bmax - bmid);
  float hs = hash1(star);

  vec3 beni = mix(vec3(0.84, 0.12, 0.24), uColA, 0.25);
  vec3 momo = mix(vec3(1.0, 0.72, 0.78), uColB, 0.2);
  vec3 shiro = vec3(1.0, 0.96, 0.92);
  vec3 kin = mix(vec3(0.96, 0.78, 0.36), uColC, 0.3);

  vec3 dark = mix(uColBg, beni, 0.72);
  vec3 light = mix(beni, momo, 0.55);
  vec3 wdark = mix(momo, beni, 0.25);
  float whiteStar = step(0.78, hs) * kiteAA;
  vec3 col = mix(mix(dark, light, shade), mix(wdark, shiro, shade), whiteStar);
  col *= 0.88 + 0.12 * sin(hs * 6.2832 + uBarPhase * 6.2832);

  // beat: stars pop and fill with chitose-ame red/white candy stripes
  float lit = step(0.80 - uIntensity * 0.25, hash1(star + floor(uBeat) * 0.61)) * uBeatPulse * kiteAA;
  float sv = fract((p.x + p.y) * 2.2 - uTime * 0.6);
  float spx = px * 2.2 * 1.4142;
  float stripe = smoothstep(0.5 - spx, 0.5 + spx, sv) * (1.0 - smoothstep(1.0 - spx, 1.0, sv));
  vec3 candy = mix(shiro, mix(vec3(0.9, 0.1, 0.2), uColA, 0.2), stripe);
  col = mix(col, candy, lit);

  // gold lines, spokes thinner; sparkle on the highs
  float wE = 0.030 + uBeatPulse * 0.010;
  float wS = 0.016;
  float lineE = 1.0 - smoothstep(wE, wE + px, dEdge);
  float lineS = 1.0 - smoothstep(wS, wS + px, dSpoke);
  float line = max(lineE, lineS);
  float spark = step(0.965, hash1(floor(p * 9.0) + floor(uTime * 12.0))) * uHigh;
  vec3 lineCol = kin * (0.85 + 0.35 * uHigh) + shiro * spark * 0.8 + kin * lit * 0.5;
  col = mix(col, lineCol, line);

  col = mix(col, uColA, 0.08 * uBass);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
