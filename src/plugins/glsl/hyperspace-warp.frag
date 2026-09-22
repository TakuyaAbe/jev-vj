// @name Hyperspace Warp
// @description 星が光の筋になって後方へ流れ去る超光速航行。キックのたびに空間がぐっと引き伸ばされ筋が伸び、中心の光が低音で脈打つ。速度感と解放感、一気に突き抜ける爽快さ。ドロップ直後の解放やハイテンポのトランス、ドラムンベースの疾走パートに合う
// @short 星が光の筋になる超光速航行。疾走・解放。ドロップ直後・疾走
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(uv);
  // beat warp: space bulges outward on each kick
  float warp = uBeatPulse * (0.15 + 0.35 * uIntensity);
  uv *= 1.0 - warp * exp(-r * 2.5);
  uv *= rot(uTime * 0.03);
  r = length(uv);
  vec2 dir = uv / max(r, 1e-4);
  float stretch = 0.02 + uIntensity * 0.12 + uBeatPulse * 0.25;

  vec3 col = uColBg;
  const int LAYERS = 6;
  for (int i = 0; i < LAYERS; i++) {
    float fi = float(i);
    // each layer approaches the viewer and loops (constant clock so layers never jump)
    float z = fract(fi / float(LAYERS) + uTime * 0.12);
    float scale = mix(18.0, 0.8, z);
    float fade = smoothstep(0.0, 0.25, z) * smoothstep(1.0, 0.85, z);
    vec2 sp = uv * scale + fi * 7.31;
    vec2 cell = floor(sp);
    vec2 jitter = hash2(cell + fi) * 0.4 + 0.3;
    vec2 star = cell + jitter;
    vec2 d = sp - star;
    // stars fly outward, so the streak trails back toward the centre (radial direction of this pixel)
    float along = dot(d, dir);
    float across = dot(d, vec2(-dir.y, dir.x));
    float len = min(stretch * scale * (0.3 + r * 2.0) * 12.0, 9.0);
    along = along < 0.0 ? along / (1.0 + len) : along;
    float s = exp(-(along * along + across * across) * 900.0 / (1.0 + z * 3.0));
    float bright = step(0.35, hash1(cell - fi)) * fade;
    float hi = fft(0.1 + hash1(cell) * 0.5);
    vec3 sc = mix(uColA, uColB, hash1(cell + 3.0));
    col += sc * s * bright * (0.6 + hi * 1.5) * (0.4 + 0.6 * uIntensity);
  }
  // central glow and tunnel rim
  col += uColC * exp(-r * 6.0) * (0.25 + uBass * 0.8 + uBeatPulse * 0.4);
  col += mix(uColA, uColB, 0.5) * exp(-abs(r - 0.9 - warp) * 10.0) * 0.08 * uIntensity;
  col = col / (1.0 + col * 0.3);
  gl_FragColor = vec4(col, 1.0);
}
