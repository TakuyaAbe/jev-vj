/*{
  "ISFVSN": "2",
  "NAME": "Echo Trails",
  "DESCRIPTION": "前のフレームを少しずつ拡大・回転させながら残し、動くものに残像の尾を引かせるフィードバック。低域で奥へ吸い込まれ、残像は徐々に色味を変えて消える。強度が低いとわずかな余韻、高いと長く渦を巻く残像になる",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Filter", "Feedback"],
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "decay", "TYPE": "float", "DEFAULT": 0.85, "MIN": 0.0, "MAX": 0.97 },
    { "NAME": "zoom", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "swirl", "TYPE": "float", "DEFAULT": 0.3, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "tint", "TYPE": "color", "DEFAULT": [0.6, 0.8, 1.0, 1.0] }
  ],
  "PASSES": [
    { "TARGET": "echo", "PERSISTENT": true },
    {}
  ],
  "JEVJ": {
    "short": "残像が渦を巻いて尾を引くフィードバック。余韻・サイケ。ブレイク・ビルド",
    "bind": {
      "decay": { "src": "intensity", "min": 0.55, "max": 0.93 },
      "zoom": "bass",
      "swirl": { "src": "intensity", "min": 0.0, "max": 1.0 },
      "tint": "b"
    }
  }
}*/

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void main() {
  vec2 uv = isf_FragNormCoord;
  vec3 src = IMG_NORM_PIXEL(inputImage, uv).rgb;
  if (PASSINDEX == 0) {
    vec2 aspect = vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
    vec2 c = (uv - 0.5) * aspect;
    // sample the previous frame pulled toward the centre with a slow twist
    float scale = 1.004 + 0.02 * zoom;
    float ang = 0.004 * swirl * sin(TIME * 0.2) + 0.006 * swirl;
    vec2 q = rot(ang) * c * scale;
    vec2 puv = q / aspect + 0.5;
    vec3 prev = IMG_NORM_PIXEL(echo, puv).rgb;
    // fade and shift the trail toward the tint colour
    prev = max(mix(prev, prev * tint.rgb * 1.15, 0.08) * decay - 0.006, 0.0); // the bias stops 8-bit trails from sticking
    float edge = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
    gl_FragColor = vec4(max(src, prev * edge), 1.0);
  } else {
    vec3 e = IMG_NORM_PIXEL(echo, uv).rgb;
    gl_FragColor = vec4(max(src, e), 1.0);
  }
}
