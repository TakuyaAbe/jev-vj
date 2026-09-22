// voronoi cells: random cells flash on each beat, borders glow with the highs
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 6.0 + uIntensity * 6.0;
  vec2 p = uv * scale + vec2(uTime * 0.15, uTime * 0.08);
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(i + g);
    o = 0.5 + 0.45 * sin(uTime * 0.6 + 6.2831 * o);
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; id = i + g; } else if (d < f2) { f2 = d; }
  }
  float edge = f2 - f1;
  float h = hash1(id + floor(uBeat));
  float lit = step(0.92 - uIntensity * 0.15 - uBass * 0.1, h) * (0.3 + uBeatPulse);
  float wave = 0.5 + 0.5 * sin(f1 * 6.0 - uTime * 2.0 + h * 6.28);
  vec3 col = mix(uColBg, mix(uColA, uColB, h), 0.25 + 0.35 * wave * uEnergy);
  col += uColC * lit;
  col += uColC * smoothstep(0.06, 0.0, edge) * (0.25 + uHigh * 0.9 + uOnset * 0.4);
  gl_FragColor = vec4(col, 1.0);
}
