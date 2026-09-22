/*{
  "ISFVSN": "2",
  "NAME": "Beat Mosaic",
  "DESCRIPTION": "キックの瞬間に画面が粗いモザイクへ砕け、拍の間に元の解像度へ戻っていく。ブロックは拍の減衰に合わせて段階的に細かくなり、色数も一瞬落ちる。強度が低いと細かいざらつき程度、高いと大胆なデジタル崩し",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Filter", "Stylize", "Glitch"],
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "pulse", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "reach", "TYPE": "float", "DEFAULT": 0.5, "MIN": 0.0, "MAX": 1.0 }
  ],
  "JEVJ": {
    "short": "キックで粗いモザイクに砕けて戻る。デジタル・ビート強調。テクノ・ドロップ",
    "bind": {
      "pulse": "beatPulse",
      "reach": "intensity"
    }
  }
}*/

float h21(vec2 p) {
  p = fract(p * vec2(443.9, 397.3));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = isf_FragNormCoord;
  vec2 px = uv * RENDERSIZE;
  // snap strength: sharp attack, quantised so the grid visibly steps back down
  float s = pulse * pulse * reach;
  float level = floor(s * 6.0 + 0.5) / 6.0;
  float maxBlock = mix(0.008, 0.075, reach) * RENDERSIZE.y;
  float block = max(1.0, floor(level * maxBlock / 2.0 + 0.5) * 2.0);
  vec2 cell = floor(px / block);
  // some cells hold a stale neighbour for a glitchy bite
  vec2 jitter = vec2(0.0);
  if (level > 0.3 && h21(cell + floor(TIME * 12.0)) > 0.93) jitter = vec2(block * (h21(cell) > 0.5 ? 1.0 : -1.0), 0.0);
  vec2 center = (cell + 0.5) * block + jitter;
  vec3 col = IMG_NORM_PIXEL(inputImage, clamp(center / RENDERSIZE, 0.0, 1.0)).rgb;
  // palette crush while the snap is strong
  float steps = mix(48.0, 5.0, level);
  col = mix(col, floor(col * steps + 0.5) / steps, step(0.01, level));
  // thin grid lines on large blocks
  vec2 f = fract(px / block);
  float grid = step(8.0, block) * (1.0 - step(1.0 / block, min(f.x, f.y)));
  col *= 1.0 - 0.35 * grid;
  gl_FragColor = vec4(col, 1.0);
}
