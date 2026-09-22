// @name Truchet Pulse
// @description 四分円のタイルがつながって迷路のような曲線網を描き、光の粒が線に沿って流れる。小節ごとに一部のタイルが反転して道筋が組み替わり、線の太さがスペクトラムで脈打つ。幾何学的で遊び心のあるグルーヴ。テックハウスやファンキーなブレイクビーツ、ミドルテンポの展開部に合う
// @short 曲線タイルの迷路を光が流れる。幾何・遊び心。グルーヴ展開
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float zoom = mix(5.0, 9.0, uIntensity) * (1.0 - uBeatPulse * 0.04);
  uv *= rot(0.12 * sin(uTime * 0.07));
  vec2 p = uv * zoom + vec2(uTime * 0.25, uTime * 0.1);
  vec2 id = floor(p);
  vec2 q = fract(p) - 0.5;

  // flip each tile by hash; a few tiles re-roll on every bar so the paths rewire
  float h = hash1(id);
  float reroll = step(0.8, hash1(id + 17.0)) * floor(uBar);
  float flip = step(0.5, fract(h + reroll * 0.618));
  if (flip > 0.5) q.x = -q.x;

  // distance to the two quarter arcs centred on opposite corners
  vec2 c1 = q - vec2(0.5, 0.5);
  vec2 c2 = q + vec2(0.5, 0.5);
  float d1 = abs(length(c1) - 0.5);
  float d2 = abs(length(c2) - 0.5);
  float d = min(d1, d2);
  vec2 cc = d1 < d2 ? c1 : c2;

  // arc parameter for the flowing dashes; checker parity keeps the flow continuous across tiles
  float a = atan(cc.y, cc.x) / 1.5708;
  float par = mod(id.x + id.y, 2.0) * 2.0 - 1.0;
  float flowDir = (d1 < d2 ? 1.0 : -1.0) * par * (flip > 0.5 ? -1.0 : 1.0);
  float flow = fract(a * flowDir * 2.0 - uTime * (0.6 + uIntensity * 1.4));

  float band = fft(fract(h * 3.7) * 0.6 + 0.02);
  float width = 0.04 + band * 0.07 * (0.3 + uIntensity) + uBeatPulse * 0.03;
  float line = smoothstep(width, width - 0.02, d);
  float halo = exp(-d * 18.0) * 0.35;

  vec3 tileCol = mix(uColA, uColB, mod(id.x + id.y, 2.0));
  vec3 col = uColBg;
  col += tileCol * (line * (0.55 + band * 0.8) + halo * (0.2 + 0.8 * uIntensity));
  float dash = smoothstep(0.12, 0.0, abs(flow - 0.5) - 0.02) * line;
  col += uColC * dash * (0.4 + 0.9 * uIntensity);
  // faint tile grid for low-intensity calm sections
  vec2 g = abs(fract(p) - 0.5);
  col += uColC * 0.04 * smoothstep(0.48, 0.5, max(g.x, g.y));
  col *= 1.0 - 0.35 * dot(uv, uv);
  gl_FragColor = vec4(col, 1.0);
}
