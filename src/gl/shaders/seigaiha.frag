// seigaiha: overlapping wave arcs, rising with time, rings breathing with the bass
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float scale = 3.2 + uIntensity * 2.0;
  vec2 p = uv * scale * rot(sin(uTime * 0.05) * 0.08);
  p.y += uTime * (0.25 + uIntensity * 0.6);
  // circles of radius 1 on rows 0.5 apart, staggered by 0.5; the lower (front) row covers the row behind
  float rowBase = floor(p.y / 0.5);
  vec3 col = uColBg;
  float found = 0.0;
  for (int j = 0; j < 4; j++) {
    float row = rowBase + 1.0 - float(j);
    float cy = row * 0.5;
    float off = mod(row, 2.0) * 0.5;
    float cx = floor(p.x - off + 0.5) + off;
    for (int k = -1; k <= 1; k++) {
      vec2 c = vec2(cx + float(k), cy);
      float d = length(p - c);
      if (d <= 1.0 && found < 0.5 && c.y <= p.y + 0.001) {
        float rings = 5.0 + uBass * 2.0 + uBeatPulse * 1.0;
        float r = d * rings;
        float ring = floor(r);
        float par = mod(ring, 2.0);
        float aa = smoothstep(0.45, 0.55, fract(r));
        vec3 a = mix(uColC, uColA, 0.85);
        vec3 b = mix(uColBg, uColB, 0.35 + 0.25 * uMid);
        col = mix(mix(a, b, par), mix(b, a, par), aa);
        // beat: a random arc lights up
        float flash = step(0.93 - uIntensity * 0.1, hash1(c + floor(uBeat) * 0.13)) * uBeatPulse;
        col += uColC * flash * 0.8;
        col += uColC * smoothstep(0.03, 0.0, abs(d - 1.0)) * (0.3 + uHigh * 0.7);
        found = 1.0;
      }
    }
  }
  gl_FragColor = vec4(col * (0.8 + 0.2 * uEnergy), 1.0);
}
