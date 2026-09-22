// raymarched infinite lattice; the camera flies forward and twists with the bar
float sdBox(vec3 p, vec3 b) { vec3 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0); }
float map(vec3 p) {
  vec3 q = mod(p, 2.0) - 1.0;
  float r = 0.06 + uBass * 0.12 + uBeatPulse * 0.05;
  float a = sdBox(q, vec3(r, r, 1.0));
  float b = sdBox(q, vec3(1.0, r, r));
  float c = sdBox(q, vec3(r, 1.0, r));
  float node = length(q) - (0.12 + uSub * 0.2);
  return min(min(a, b), min(c, node));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float speed = 1.2 + uEnergy * 2.5 + uIntensity * 3.0;
  float twist = uTime * 0.15 * (1.0 + uIntensity * 2.0);
  vec3 ro = vec3(sin(uTime * 0.3) * 0.4, cos(uTime * 0.23) * 0.4, uTime * speed);
  vec3 rd = normalize(vec3(uv * rot(twist), 1.4 - uBeatPulse * 0.3));
  float t = 0.0, d = 0.0;
  float glow = 0.0;
  for (int i = 0; i < 70; i++) {
    vec3 p = ro + rd * t;
    p.xy *= rot(p.z * 0.08 + twist);
    d = map(p);
    glow += 0.008 / (0.03 + d * d * 14.0);
    if (d < 0.002 || t > 40.0) break;
    t += d * 0.85;
  }
  float fog = exp(-t * 0.09);
  vec3 col = uColBg;
  if (d < 0.002) {
    vec3 p = ro + rd * t;
    float stripe = smoothstep(0.4, 0.6, fract(p.z * 0.5 - uTime * 0.5));
    col = mix(uColA, uColB, stripe) * (0.3 + fog) + uColC * uBeatPulse * 0.4;
  }
  col += uColC * min(glow, 2.5) * (0.04 + uHigh * 0.12 + uBeatPulse * 0.08);
  col = mix(uColBg, col, fog + 0.15);
  gl_FragColor = vec4(col, 1.0);
}
