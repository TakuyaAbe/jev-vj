/*{
  "ISFVSN": "2",
  "NAME": "VHS Tape",
  "DESCRIPTION": "擦り切れたビデオテープ風。走査線、にじんだ色ずれ、流れていくトラッキングノイズの帯。キックで横方向のズレが走り、強度が低いと走査線がうっすら乗る程度のローファイな質感になる",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Filter", "Glitch", "Retro"],
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "wear", "TYPE": "float", "DEFAULT": 0.5, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "tear", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "hiss", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 }
  ],
  "JEVJ": {
    "short": "擦れたビデオテープの走査線と色にじみ。ローファイ・懐古。ヒップホップ・ブレイク",
    "bind": {
      "wear": "intensity",
      "tear": "beatPulse",
      "hiss": "high"
    }
  }
}*/

float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float h21(vec2 p) {
  p = fract(p * vec2(311.7, 183.3));
  p += dot(p, p + 31.13);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = isf_FragNormCoord;
  float t = TIME;
  float w = 0.15 + 0.85 * wear;

  // per-line horizontal wobble, plus big tears on the kick
  float line = floor(uv.y * 240.0);
  float wob = (h11(line + floor(t * 30.0)) - 0.5) * 0.0015 * w;
  float band = floor(uv.y * 14.0 + h11(floor(t * 8.0)) * 14.0);
  float tearOn = step(0.82, h11(band + floor(t * 10.0))) * tear * tear;
  wob += (h11(band * 3.7 + floor(t * 20.0)) - 0.5) * 0.08 * tearOn * w;

  // rolling tracking band near the bottom third
  float roll = fract(t * 0.07);
  float trk = smoothstep(0.03, 0.0, abs(uv.y - roll)) * w;
  wob += trk * 0.01 * sin(uv.y * 400.0 + t * 50.0);

  vec2 suv = vec2(uv.x + wob, uv.y);
  // chroma bleed: luma sharp, chroma smeared sideways
  float cs = (0.002 + 0.006 * w) * (1.0 + 2.0 * tearOn);
  vec3 c0 = IMG_NORM_PIXEL(inputImage, suv).rgb;
  vec3 cr = IMG_NORM_PIXEL(inputImage, suv + vec2(cs, 0.0)).rgb;
  vec3 cb = IMG_NORM_PIXEL(inputImage, suv - vec2(cs, 0.0)).rgb;
  vec3 col = vec3(cr.r, c0.g, cb.b);
  float luma = dot(c0, vec3(0.299, 0.587, 0.114));
  // slightly washed-out colour
  col = mix(col, vec3(luma), 0.15 * w);

  // scanlines at the output resolution
  float sl = 0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159 * 0.5);
  col *= 1.0 - 0.18 * w * sl;

  // tape hiss and the white noise in the tracking band
  float n = h21(gl_FragCoord.xy + fract(t * 7.0) * 100.0);
  col += (n - 0.5) * (0.03 + 0.06 * hiss) * w;
  col = mix(col, vec3(n), trk * 0.35);

  // soft edge darkening like a CRT
  vec2 d = uv - 0.5;
  col *= 1.0 - 0.4 * w * dot(d, d);
  gl_FragColor = vec4(col, 1.0);
}
