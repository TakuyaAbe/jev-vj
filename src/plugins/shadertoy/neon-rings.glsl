// @name Neon Rings
// @description 同心円のネオンリングがスペクトラムで揺れ、キックで外へ押し出される。クラブらしいネオン感。テクノ・ハウスの安定した進行やドロップに合う
// @short ネオンの同心円（Shadertoy）。クラブ感。安定・ドロップ
// Shadertoy-compatible: paste into shadertoy.com with iChannel0 = a music input and it runs there too.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float kick = texture(iChannel0, vec2(0.02, 0.25)).x;
  float wave = texture(iChannel0, vec2(fract(a / 6.2831 + 0.5), 0.75)).x - 0.5;
  float rr = r - iTime * 0.08 - kick * 0.06;
  float rings = abs(fract(rr * 7.0) - 0.5);
  float band = texture(iChannel0, vec2(fract(rr * 0.7) * 0.6, 0.25)).x;
  float line = smoothstep(0.06 + band * 0.08, 0.0, rings + wave * 0.15);
  vec3 col = mix(uColA, uColB, 0.5 + 0.5 * sin(rr * 10.0 + iTime));
  col *= line * (0.4 + band * 1.4) * smoothstep(1.2, 0.1, r);
  col += uColC * smoothstep(0.08, 0.0, r) * kick;
  fragColor = vec4(uColBg + col, 1.0);
}
