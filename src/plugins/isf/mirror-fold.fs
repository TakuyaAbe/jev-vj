/*{
  "ISFVSN": "2",
  "NAME": "Mirror Fold",
  "DESCRIPTION": "画面を扇状に折り返す万華鏡ミラー。小節に合わせてゆっくり回転し、キックで一瞬ズームする。強度が低いと元の映像にうっすら重なる程度で、高いと完全な対称模様になる",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Filter", "Tile Effect"],
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "sides", "TYPE": "float", "DEFAULT": 6.0, "MIN": 2.0, "MAX": 12.0 },
    { "NAME": "blend", "TYPE": "float", "DEFAULT": 1.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "turn", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "punch", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 }
  ],
  "JEVJ": {
    "short": "扇状に折り返す万華鏡ミラー。対称・陶酔。ブレイク・メロディ",
    "bind": {
      "sides": { "src": "intensity", "min": 4.0, "max": 8.0 },
      "blend": { "src": "intensity", "min": 0.2, "max": 1.0 },
      "turn": "barPhase",
      "punch": "beatPulse"
    }
  }
}*/

void main() {
  vec2 uv = isf_FragNormCoord;
  vec2 res = RENDERSIZE;
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  float n = floor(sides + 0.5);
  float seg = 6.2831853 / n;
  float a = atan(p.y, p.x) + TIME * 0.05 + turn * seg;
  float r = length(p) * (1.0 - 0.12 * punch);
  // fold the angle into one mirrored wedge
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r;
  // map the wedge back onto the source, clamped with a mirror at the borders
  vec2 suv = q / vec2(res.x / res.y, 1.0) + 0.5;
  suv = 1.0 - abs(1.0 - mod(suv, 2.0));
  vec4 k = IMG_NORM_PIXEL(inputImage, suv);
  vec4 src = IMG_NORM_PIXEL(inputImage, uv);
  gl_FragColor = vec4(mix(src.rgb, k.rgb, blend), 1.0);
}
