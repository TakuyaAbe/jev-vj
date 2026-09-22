// @name Moire
// @description 2 つの同心円パターンが干渉してモアレを生む。低域で中心が離れ、ビートで干渉が強まる。錯視的で硬質。ミニマルやテクノの長い展開に合う
// @short モアレ干渉（GLSL）。錯視・硬質。ミニマル・テクノ
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float sep = 0.15 + uBass * 0.25 + 0.05 * sin(uTime * 0.3);
  vec2 c1 = vec2(-sep, 0.0) * rot(uTime * 0.1);
  vec2 c2 = -c1;
  float freq = 60.0 + uIntensity * 60.0;
  float a = sin(length(uv - c1) * freq - uTime * 2.0);
  float b = sin(length(uv - c2) * freq + uTime * 1.5);
  float m = a * b;
  float lines = smoothstep(0.0, 0.2 + uBeatPulse * 0.3, m);
  vec3 col = mix(uColBg, mix(uColA, uColB, 0.5 + 0.5 * a), lines * (0.5 + uEnergy));
  col += uColC * pow(max(0.0, m), 8.0) * uBeatPulse;
  gl_FragColor = vec4(col, 1.0);
}
