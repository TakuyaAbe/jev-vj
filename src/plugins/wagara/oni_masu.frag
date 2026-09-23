// @name Oni Masu Pattern
// @description 節分の豆まき。鬼のパンツの黄と黒の虎縞がうねる地に、檜の升が市松に並び、中には煎り豆がころころ入っている。キックのたびにいくつかの升から豆が「鬼は外」とばかりに外へ弾け飛び、升の縁が赤く光る。低音で虎縞がうねり、高音で豆のつやがきらめく。やんちゃで痛快、ノリの良いファンクやブレイクビーツ、ドラムが前に出る展開に合う
// @short 2月・虎縞と升と豆の柄。やんちゃで痛快。ファンク・ブレイクビーツ
// @group wagara
// @month 2
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

float omBox(vec2 q, float b) { return max(abs(q.x), abs(q.y)) - b; }

// one roasted soybean; returns coverage, writes its colour
float omBean(vec2 q, vec2 pos, float rb, float ang, float px, vec3 mame, out vec3 bc) {
  vec2 bq = rot(ang) * (q - pos);
  float d = (length(bq / vec2(1.0, 0.86)) - rb) * 0.86;
  vec2 n = bq / rb;
  float shade = 0.72 + 0.35 * dot(n, vec2(-0.5, 0.6));
  float hl = 1.0 - smoothstep(0.0, 0.3, length(n - vec2(-0.32, 0.38)));
  bc = mame * shade + vec3(1.0, 0.95, 0.85) * hl * (0.25 + 0.6 * uHigh);
  // hilum: a small dark slit
  float slit = (1.0 - smoothstep(0.05, 0.05 + px / rb, abs(n.y + 0.1))) * (1.0 - smoothstep(0.25, 0.3, abs(n.x)));
  bc = mix(bc, mame * 0.45, slit * 0.7);
  return 1.0 - smoothstep(-px, px, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.4 + uIntensity * 2.0;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p.x += uTime * (0.10 + uIntensity * 0.30);
  p.y -= uTime * 0.05;

  vec3 ki = mix(vec3(0.98, 0.76, 0.10), uColA, 0.25);
  vec3 kuro = mix(uColBg, vec3(0.05, 0.04, 0.03), 0.6);
  vec3 aka = mix(vec3(0.88, 0.14, 0.10), uColA, 0.25);
  vec3 hinoki = mix(vec3(0.92, 0.78, 0.52), uColB, 0.15);
  vec3 mame = mix(vec3(0.90, 0.72, 0.44), uColB, 0.1);

  // tiger stripes: wavy, jagged, tapering to points
  float s = (p.x + p.y) * 0.9 + 0.35 * sin(p.y * 1.7 - p.x * 0.6 + uTime * 0.3) + (noise(p * 2.5) - 0.5) * 0.35;
  s += uBass * 0.12 * sin(p.x * 3.0 + uTime * 2.0);
  float sid = floor(s);
  float sf = fract(s);
  float along = (p.x - p.y) * 0.7;
  float wS = (0.30 + 0.16 * hash1(vec2(sid, 2.0)) + 0.06 * uBass) * clamp(0.35 + 0.8 * sin(along * 2.0 + hash1(vec2(sid, 5.0)) * 6.2832), 0.0, 1.0);
  float sp = px * 1.6;
  float lo = 0.5 - wS * 0.5;
  float hi = 0.5 + wS * 0.5;
  float stripe = smoothstep(lo - sp, lo + sp, sf) * (1.0 - smoothstep(hi - sp, hi + sp, sf)) * step(0.01, wS);
  vec3 col = mix(ki, kuro, stripe);

  // masu on a checkerboard
  float gs = 0.7;
  vec2 g = p * gs;
  float gpx = px * gs;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float par = mod(cell.x + cell.y, 2.0);
  float h = hash1(cell);
  float sel = step(0.74 - uIntensity * 0.3, hash1(cell + floor(uBeat) * 0.37));
  float pop = sel * uBeatPulse;
  vec2 q = rot((h - 0.5) * 0.3 + sin(uTime * 0.6 + h * 6.2832) * 0.04) * f;

  float B = 0.36 * (1.0 + 0.04 * uBass);
  if (par < 0.5) {
    float dS = omBox(q - vec2(0.05, -0.06), B);
    col *= 1.0 - 0.45 * (1.0 - smoothstep(-0.02, 0.07, dS));
    float dB = omBox(q, B);
    float box = 1.0 - smoothstep(-gpx, gpx, dB);
    float rimW = 0.075;
    float inner = 1.0 - smoothstep(-rimW - gpx, -rimW + gpx, dB);
    // wood grain running along each board
    float horiz = step(abs(q.x), abs(q.y));
    float gcoord = mix(q.y, q.x, horiz) * 60.0 + noise(q * 8.0 + h * 10.0) * 3.0;
    float grain = 0.9 + 0.1 * sin(gcoord);
    vec3 rimCol = hinoki * grain;
    // board joints at the corners
    float joint = (1.0 - smoothstep(0.004, 0.004 + gpx, abs(abs(q.x) - abs(q.y)))) * (1.0 - inner);
    rimCol *= 1.0 - 0.35 * joint;
    rimCol = mix(rimCol, aka, pop * 0.85);
    vec3 inCol = hinoki * 0.62 * (0.92 + 0.08 * sin(q.x * 50.0 + h * 9.0));
    // inner rim shadow
    inCol *= 0.75 + 0.25 * smoothstep(0.0, 0.08, -rimW - dB);
    vec3 m = mix(rimCol, inCol, inner);
    col = mix(col, m, box);
    float edge = 1.0 - smoothstep(0.0, 0.05, abs(dB));
    col += uColC * edge * (0.08 + pop * 0.6 + uHigh * 0.2);

    // five beans; they scatter outward and grow on the beat
    for (int j = 0; j < 5; j++) {
      float fj = float(j);
      vec2 base = j == 0 ? vec2(0.0, 0.0) : vec2(cos(fj * 1.5708 + 0.785), sin(fj * 1.5708 + 0.785)) * 0.19;
      base += (hash2(cell + fj * 1.7) - 0.5) * 0.06;
      vec2 pos = base * (1.0 + pop * 0.9); // stays inside the cell at the peak
      float rb = 0.07 * (1.0 + pop * 0.3);
      vec3 bc;
      float bcov = omBean(q, pos, rb, hash1(cell + fj) * 6.2832 + pop * 2.0, gpx, mame, bc);
      col = mix(col, bc, bcov);
    }
  } else {
    // a stray bean on the stripes now and then
    float hb = hash1(cell + 11.3);
    if (hb > 0.6) {
      vec2 pos = (hash2(cell + 4.2) - 0.5) * 0.5;
      vec3 bc;
      float dS = length(q - pos - vec2(0.012, -0.015)) - 0.07;
      col *= 1.0 - 0.35 * (1.0 - smoothstep(-0.01, 0.03, dS));
      float bcov = omBean(q, pos, 0.065, hb * 20.0, gpx, mame, bc);
      col = mix(col, bc, bcov);
    }
  }

  col *= 0.92 + 0.08 * sin(h * 6.2832 + uBarPhase * 6.2832);
  col = mix(col, uColA, 0.08 * uBass);
  gl_FragColor = vec4(col * (0.78 + 0.22 * uEnergy), 1.0);
}
