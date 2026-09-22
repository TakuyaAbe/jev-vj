// domain-warped fbm: ink and smoke that thickens with the bass
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * (0.12 + uIntensity * 0.45);
  uv *= rot(t * 0.1);
  vec2 q = vec2(fbm(uv * 2.0 + t), fbm(uv * 2.0 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(uv * 2.0 + 4.0 * q + vec2(1.7, 9.2) + t * 0.6), fbm(uv * 2.0 + 4.0 * q + vec2(8.3, 2.8) + t * 0.4));
  float f = fbm(uv * 2.0 + 4.0 * r * (1.0 + uBass * 1.2));
  vec3 col = mix(uColBg, uColA, clamp(f * f * 2.6, 0.0, 1.0));
  col = mix(col, uColB, clamp(length(q) * 0.9, 0.0, 1.0));
  col = mix(col, uColC, clamp(r.x * uHigh * 1.8, 0.0, 1.0));
  col *= 0.55 + 0.7 * f + uBeatPulse * 0.35 * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
