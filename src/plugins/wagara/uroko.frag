// @name Uroko Pattern
// @description 端午の節句、鯉のぼりの鱗と厄除けの鱗文様。紺から菖蒲の紫へ移ろう三角と白銀の三角が交互に並び、低音に合わせて鯉が泳ぐように模様全体がうねり、鱗に光の波が走る。キックのたびにいくつかの鱗がひるがえって朱と金に光る。高音で鱗の継ぎ目に金の粒がきらめく。勇ましく力強い。四つ打ちのハードなキック、押しの強いテクノやハウスのピークに合う
// @short 5月・鱗文様の柄。勇ましく力強い。ハードな四つ打ち
// @group wagara
// @month 5
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

// skewed lattice coords -> world (equilateral triangles of side 1)
vec2 urkW(vec2 v) { return vec2(v.x + 0.5 * v.y, v.y * 0.8660254); }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 4.2 + uIntensity * 2.8;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p += vec2(uTime * (0.12 + uIntensity * 0.40), uTime * 0.03);
  // the whole cloth undulates like a koinobori in the wind; the bass deepens the swim
  float swim = uTime * (1.2 + uIntensity * 1.6);
  p.y += sin(p.x * 0.55 - swim) * (0.05 + 0.10 * uIntensity + 0.16 * uBass);

  // triangle grid: which triangle and its barycentrics
  vec2 b = vec2(p.x - p.y * 0.5773503, p.y * 1.1547005);
  vec2 cell = floor(b);
  vec2 f = fract(b);
  float up = step(1.0, f.x + f.y); // 0 = pointing up, 1 = pointing down
  vec2 vA = cell + mix(vec2(0.0, 0.0), vec2(1.0, 1.0), up);
  vec2 vB = cell + mix(vec2(1.0, 0.0), vec2(0.0, 1.0), up);
  vec2 vC = cell + mix(vec2(0.0, 1.0), vec2(1.0, 0.0), up);
  vec3 bc = up < 0.5 ? vec3(1.0 - f.x - f.y, f.x, f.y) : vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y);
  vec2 G = (urkW(vA) + urkW(vB) + urkW(vC)) / 3.0;
  float bmin = min(bc.x, min(bc.y, bc.z));
  float dEdge = bmin * 0.8660254; // distance to the nearest triangle edge
  vec2 tid = cell + vec2(up * 0.53, up * 0.29);
  float h = hash1(tid);

  vec3 kon = mix(vec3(0.09, 0.14, 0.38), uColA, 0.25);
  vec3 shoubu = mix(vec3(0.46, 0.30, 0.68), uColB, 0.25);
  vec3 shiro = mix(vec3(0.95, 0.94, 0.90), uColA, 0.08);
  vec3 gin = vec3(0.70, 0.73, 0.80);
  vec3 shu = mix(vec3(0.92, 0.30, 0.17), uColA, 0.25);
  vec3 kin = mix(vec3(0.96, 0.76, 0.32), uColC, 0.3);

  // scale sheen: bright at the base, darker toward the apex (bc.z is the apex weight)
  float t = bc.z;
  float sheen = 1.0 - 0.35 * t;
  // light wave rolling along the body, stronger with the bass
  float wave = sin(G.x * 1.4 + G.y * 0.5 - swim * 1.3);
  float glint = smoothstep(0.55, 1.0, wave) * (0.25 + 0.6 * uBass);

  float band = 0.5 + 0.5 * sin(cell.y * 0.55 + uTime * 0.25);
  vec3 dark = mix(kon, shoubu, band);
  dark = mix(uColBg, dark, 0.85);
  vec3 light = mix(gin, shiro, 0.4 + 0.6 * (1.0 - t));
  vec3 col = up < 0.5 ? dark * sheen : light * (0.85 + 0.15 * sheen);
  col *= 0.9 + 0.1 * sin(h * 6.2832 + uBarPhase * 6.2832);
  col += mix(shiro, kin, 0.3) * glint * (up < 0.5 ? 0.45 : 0.2);

  // beat: some scales flip over and flash shu-red to gold
  float lit = step(0.80 - uIntensity * 0.25, hash1(tid + floor(uBeat) * 0.37)) * uBeatPulse;
  vec3 koi = mix(shu, kin, t * 0.8 + 0.2 * uBeatPulse);
  float inner = smoothstep(0.0, px * 1.5, dEdge - 0.02);
  col = mix(col, koi * (1.1 - 0.3 * t), lit * inner);

  // seams: thin dark line between scales, glinting gold on the highs
  float w = 0.018 + uBeatPulse * 0.006;
  float seam = 1.0 - smoothstep(w, w + px * 1.2, dEdge);
  float spark = step(0.955, hash1(floor(p * 8.0) + floor(uTime * 10.0))) * uHigh;
  vec3 seamCol = mix(mix(uColBg, kon, 0.4), kin, clamp(spark + lit * 0.6, 0.0, 1.0));
  col = mix(col, seamCol, seam);
  col += kin * spark * (1.0 - smoothstep(0.0, 0.06, dEdge)) * 0.5;

  col = mix(col, uColA, 0.08 * uBass);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
