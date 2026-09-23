// @name Chochin Pattern
// @description 夏祭りの夜、紺の夜空に紅白の祭り提灯が縄に連なって並び、段ごとに互い違いの向きへゆっくり流れていく。提灯はそよ風に揺れ、低音に合わせて灯りが息づく。キックのたびにいくつかの提灯がぱっと明るく灯り、その背後で小さな花火が菊の形に開いて散る。高音で夜空に火の粉がきらめく。粋で陽気、縁日の浮き立つ高揚感。盆踊りのように縦にノれるアッパーな四つ打ちやお祭りハウスに合う
// @short 8月・祭り提灯と花火の柄。粋で陽気。アッパーな縦ノリ
// @group wagara
// @month 8
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

float chEll(vec2 q, vec2 r) { return (length(q / r) - 1.0) * min(r.x, r.y); }

float chBox(vec2 q, vec2 b) {
  vec2 d = abs(q) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.0 + uIntensity * 2.0;
  float px = scale / uRes.y;
  vec2 p = uv * scale;
  p.y += sin(uTime * 0.13) * 0.12;

  // rows of lanterns drift in alternating directions
  float row = floor(p.y);
  float odd = mod(row, 2.0);
  p.x += (odd * 2.0 - 1.0) * uTime * (0.08 + uIntensity * 0.30) + odd * 0.5;
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float h = hash1(cell);
  float edgeF = smoothstep(0.0, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));

  // night sky with a warm festival glow from below
  vec3 kon = mix(vec3(0.05, 0.07, 0.18), uColBg, 0.4);
  vec3 col = kon * (1.0 + 0.5 * uv.y) + vec3(0.22, 0.07, 0.02) * max(-uv.y, 0.0) * 0.6;

  // embers on the highs (screen space)
  vec2 sg = uv * 110.0;
  vec2 sid = floor(sg);
  float ember = step(0.985, hash1(sid)) * smoothstep(0.35, 0.0, length(fract(sg) - 0.5));
  ember *= 0.25 + 0.75 * uHigh * step(0.4, hash1(sid + floor(uTime * 8.0)));
  col += vec3(1.0, 0.75, 0.45) * ember * 0.8;

  // beat: chosen lanterns flare and a chrysanthemum firework opens behind them
  float sel = step(0.78 - uIntensity * 0.3, hash1(cell + floor(uBeat) * 0.37));
  float flare = sel * uBeatPulse;
  vec2 bq = f - vec2(0.5, 0.42);
  float br = length(bq);
  float ba = atan(bq.y, bq.x) + h * 6.2832;
  float sec = 6.2831853 / 16.0;
  float la = mod(ba + sec * 0.5, sec) - sec * 0.5;
  vec2 qq = br * vec2(cos(la), sin(la));
  float ph = clamp(uBeatPhase, 0.0, 1.0);
  float rr = 0.18 + 0.29 * sqrt(ph);
  float dotD = length(qq - vec2(rr, 0.0)) - 0.022 * (1.0 - ph * 0.5);
  float tx = clamp(qq.x, rr - 0.14, rr);
  float trailD = length(qq - vec2(tx, 0.0)) - 0.005;
  float bi = sel * pow(1.0 - ph, 1.5) * edgeF;
  float hc = hash1(cell + 4.1);
  vec3 fire = hc < 0.4 ? mix(vec3(1.0, 0.80, 0.35), uColC, 0.3) : (hc < 0.75 ? mix(vec3(1.0, 0.45, 0.65), uColA, 0.25) : mix(vec3(0.45, 0.85, 1.0), uColB, 0.25));
  col += fire * (smoothstep(px, -px, dotD) + 0.6 * smoothstep(px, -px, trailD)) * bi;
  col += fire * exp(-abs(br - rr) * 18.0) * 0.18 * bi;

  // festival rope sagging between lanterns
  float ys = 0.86 - 0.08 * sin(3.14159 * f.x);
  float rope = 1.0 - smoothstep(0.008, 0.008 + px, abs(f.y - ys));
  col = mix(col, vec3(0.20, 0.12, 0.08) + vec3(0.25, 0.12, 0.04) * uBass, rope);

  // lantern hangs from the rope and sways
  float sw = sin(uTime * (0.9 + 0.4 * uIntensity) + cell.x * 0.9 + row * 1.7) * (0.03 + 0.07 * uIntensity);
  vec2 q = rot(sw) * (f - vec2(0.5, 0.78));
  q.y += 0.36;
  q /= 1.0 + uBass * 0.05;

  float body = chEll(q, vec2(0.25, 0.30));
  float cap = min(chBox(q - vec2(0.0, 0.30), vec2(0.11, 0.035)), chBox(q + vec2(0.0, 0.30), vec2(0.11, 0.035)));
  cap = min(cap, chBox(q - vec2(0.0, 0.36), vec2(0.012, 0.035)));

  float white = step(0.7, h);
  vec3 aka = mix(vec3(0.86, 0.12, 0.10), uColA, 0.25);
  vec3 shiro = mix(vec3(1.0, 0.95, 0.85), uColB, 0.15);
  vec3 base = mix(aka, shiro, white);

  // soft halo around each lantern
  col += base * exp(-max(body, 0.0) * 12.0) * (0.06 + 0.3 * flare + 0.08 * uBass) * edgeF;

  vec2 qe = q / vec2(0.25, 0.30);
  float glow = 1.0 - clamp(dot(qe, qe), 0.0, 1.0);
  vec3 bodyCol = base * (0.42 + 0.7 * glow * (0.85 + 0.25 * uBass));
  bodyCol += vec3(1.0, 0.75, 0.35) * glow * (0.12 + flare * 0.9);
  bodyCol *= 0.9 + 0.1 * sin(h * 6.2832 + uBarPhase * 6.2832);
  // bamboo ribs
  float ribDist = (0.5 - abs(fract(q.y * 15.0) - 0.5)) / 15.0;
  bodyCol *= 1.0 - 0.28 * (1.0 - smoothstep(0.004, 0.004 + px, ribDist));
  // black bands near top and bottom
  float band = 1.0 - smoothstep(0.022, 0.022 + px, abs(abs(q.y) - 0.23));
  vec3 sumi = vec3(0.08, 0.05, 0.05);
  bodyCol = mix(bodyCol, sumi, band * 0.8);
  // round crest in the middle: red ring on white lanterns, dark ring on red ones
  float monD = abs(length(q) - 0.10) - 0.018;
  vec3 monCol = mix(sumi, aka * 0.9, white) * (0.8 + 0.6 * glow);
  bodyCol = mix(bodyCol, monCol, smoothstep(px, -px, monD) * 0.85);

  col = mix(col, bodyCol, smoothstep(px, -px, body));
  vec3 capCol = vec3(0.10, 0.08, 0.07) + vec3(0.25, 0.15, 0.05) * flare;
  col = mix(col, capCol, smoothstep(px, -px, cap));

  col = mix(col, uColA, 0.06 * uBass);
  gl_FragColor = vec4(col * (0.8 + 0.2 * uEnergy), 1.0);
}
