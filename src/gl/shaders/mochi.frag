// hishimochi: true diamond tiles (rotated grid) with horizontal pink / white / green bands
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.2 + uIntensity * 2.5;
  vec2 p = uv * scale;
  p += vec2(uTime * (0.12 + uIntensity * 0.35), uTime * 0.08);
  // 45° grid → diamonds in screen space; bands stay horizontal like a real hishimochi
  mat2 R = rot(0.7853982);
  mat2 Ri = rot(-0.7853982);
  vec2 r = R * p;
  vec2 cell = floor(r);
  vec2 f = fract(r);
  vec2 center = Ri * (cell + 0.5);
  float h = hash1(cell);
  float dy = p.y - center.y; // -0.707 .. 0.707 inside the diamond
  float band = floor(clamp((dy + 0.7071) / 1.4142, 0.0, 0.999) * 3.0);
  float flip = step(0.72 - uIntensity * 0.3, hash1(cell + floor(uBeat) * 0.37)) * uBeatPulse;
  band = mix(band, 2.0 - band, step(0.5, flip));
  vec3 pink = vec3(1.0, 0.70, 0.79);
  vec3 white = vec3(1.0, 0.97, 0.92);
  vec3 green = vec3(0.62, 0.83, 0.60);
  vec3 col = band < 0.5 ? green : (band < 1.5 ? white : pink);
  // bevel toward the diamond edges + thin dark seam between the bands
  float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float bevel = smoothstep(0.0, 0.1, edge);
  float seam = smoothstep(0.03, 0.0, abs(fract((dy + 0.7071) / 1.4142 * 3.0) - 0.5) - 0.47);
  col *= (0.72 + 0.28 * bevel) * (1.0 - 0.35 * seam);
  col *= 0.85 + 0.15 * sin(h * 6.28 + uTime * 0.8 + uBarPhase * 6.28);
  col += uColC * (1.0 - bevel) * (0.12 + uBeatPulse * 0.45 + uHigh * 0.35);
  col = mix(col, uColA, 0.1 * uBass);
  gl_FragColor = vec4(col * (0.75 + 0.25 * uEnergy), 1.0);
}
