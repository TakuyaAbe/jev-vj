// julia set that breathes with the bass and zooms on the beat
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float zoom = 2.4 - uBeatPulse * 0.2 * uIntensity - uBass * 0.15;
  vec2 z = uv * zoom * rot(uTime * 0.05 * (1.0 + uIntensity));
  vec2 c = vec2(-0.77 + 0.12 * sin(uTime * 0.11), 0.16 + 0.1 * cos(uTime * 0.09)) + vec2(uBass * 0.06, uMid * 0.04);
  float n = 0.0;
  float m = 100.0;
  for (int i = 0; i < 64; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    m = min(m, length(z - vec2(0.3, 0.0)));
    if (dot(z, z) > 16.0) break;
    n += 1.0;
  }
  float s = n - log2(log2(dot(z, z) + 1.0)) + 4.0;
  float f = fract(s * 0.04 + uTime * 0.05 + uBarPhase * 0.25);
  vec3 col = mix(uColA, uColB, smoothstep(0.0, 0.5, f));
  col = mix(col, uColC, smoothstep(0.5, 1.0, f) * (0.4 + uHigh * 0.8));
  col *= (0.3 + 0.7 * smoothstep(0.0, 12.0, s)) * (0.55 + uEnergy * 0.6);
  if (n >= 64.0) {
    // interior: orbit-trap rings so the inside breathes instead of staying flat
    float trap = 0.5 + 0.5 * sin(m * 18.0 - uTime * 1.5 + uBarPhase * 6.28);
    col = mix(uColBg, mix(uColB, uColA, 0.5), smoothstep(1.4, 0.0, m) * (0.35 + 0.4 * trap) * (0.6 + uEnergy * 0.6));
    col += uColC * exp(-m * 6.0) * (0.3 + uBeatPulse);
  }
  gl_FragColor = vec4(col, 1.0);
}
