// @name Synth Highway
// @description 夜のネオン都市へ向かうハイウェイを滑走するシンセウェイヴ。地平線のビル群の高さがスペクトラムで伸び縮みし、縞の入った夕日が低音で膨らみ、路面のグリッドがキックで光る。レトロでノスタルジック、ドライブ感のある高揚。シンセウェイヴやニューディスコ、ノリの良いサビやグルーヴの続く中盤に合う
// @short ネオン都市へ走るハイウェイ。レトロ・ドライブ感。サビ・グルーヴ
// Shadertoy-compatible: iChannel0 = music input (row 0.25 FFT). Original, no raymarching.

float shHash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime;
  float horizon = -0.02;
  float bass = texture(iChannel0, vec2(0.02, 0.25)).x;
  vec3 col;

  if (uv.y > horizon) {
    float y = uv.y - horizon;
    // sky
    col = mix(uColB * 0.35 + uColBg, uColBg, smoothstep(0.0, 0.5, y));
    // sun with slatted lower half
    vec2 sp = uv - vec2(0.0, horizon + 0.27);
    float sr = 0.26 + bass * 0.03 + uBeatPulse * 0.015 * uIntensity;
    float sun = smoothstep(sr, sr - 0.006, length(sp));
    // slats get wider toward the bottom and scroll down slowly
    float slat = step(mix(0.5, 0.05, smoothstep(-0.26, 0.1, sp.y)), fract((sp.y - t * 0.03) * 20.0));
    sun *= max(slat, step(0.1, sp.y));
    vec3 sunCol = mix(uColA, uColC, smoothstep(-0.2, 0.25, sp.y));
    col = mix(col, sunCol, sun);
    col += sunCol * 0.25 * exp(-max(length(sp) - sr, 0.0) * 9.0);
    // skyline: building heights follow the spectrum, two parallax rows
    for (int row = 0; row < 2; row++) {
      float fr = float(row);
      float cols = 26.0 + fr * 18.0;
      float x = uv.x * cols + fr * 13.0 + t * (0.15 + fr * 0.1);
      float id = floor(x);
      float fx = fract(x);
      float band = texture(iChannel0, vec2(fract(abs(id) * 0.037) * 0.55 + 0.02, 0.25)).x;
      float h = (0.03 + shHash(id + fr * 50.0) * 0.1) * (1.0 - fr * 0.3) + band * band * 0.16 * (0.4 + uIntensity);
      float gap = step(0.06, fx) * step(fx, 0.94);
      if (y < h && gap > 0.5) {
        vec3 bcol = fr < 0.5 ? uColBg * 0.6 : uColBg * 0.25;
        vec2 wcell = floor(vec2(fx * 4.0, y * 90.0));
        float lit = step(0.72 - band * 0.3, shHash(wcell.x + wcell.y * 7.0 + id * 31.0 + floor(t * 0.5)));
        vec2 wf = fract(vec2(fx * 4.0, y * 90.0));
        lit *= step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y);
        bcol += mix(uColA, uColB, shHash(id)) * lit * (0.5 - fr * 0.2);
        bcol += uColC * smoothstep(0.004, 0.0, h - y) * 0.8; // neon rooftop line
        col = bcol;
      }
    }
  } else {
    // floor grid in perspective
    float dy = horizon - uv.y;
    float z = 0.25 / dy;
    float x = uv.x * z;
    float speed = 2.2;
    vec2 g = vec2(x * 1.2, z + t * speed);
    vec2 fw = fwidth(g);
    vec2 gl = abs(fract(g) - 0.5);
    float lx = 1.0 - smoothstep(0.0, fw.x * 1.6, 0.5 - gl.x);
    float lz = 1.0 - smoothstep(0.0, fw.y * 1.6, 0.5 - gl.y);
    float lines = max(lx, lz);
    // a pulse ring rolling toward the viewer on every beat
    float pulse = exp(-abs(fract(z * 0.12 - uBeatPhase) - 0.5) * 18.0) * uBeatPulse;
    vec3 gcol = mix(uColB, uColA, smoothstep(0.0, 0.6, dy));
    float fade = exp(-z * 0.08);
    col = uColBg * 0.6 + gcol * lines * fade * (0.45 + 0.35 * uIntensity + pulse * 1.2);
    // road stripes in the centre
    float road = smoothstep(0.9, 0.85, abs(x));
    float dash = step(0.5, fract((z + t * speed) * 0.5)) * smoothstep(0.05, 0.03, abs(x));
    col = mix(col, uColBg * 0.3, road * 0.6);
    col += uColC * dash * fade * 0.9;
    col += uColA * smoothstep(0.03, 0.0, abs(abs(x) - 0.88)) * fade * 0.7;
    col += mix(uColA, uColC, 0.5) * exp(-dy * 25.0) * 0.4;
  }
  col = col / (1.0 + col * 0.3);
  fragColor = vec4(col, 1.0);
}
