/*{
  "ISFVSN": "2",
  "NAME": "Dawn Haze",
  "DESCRIPTION": "朝靄のような柔らかい光の帯がゆっくり漂い、ぼけた光の粒がふわりと浮かぶ。コントラストは低く、中域でほのかに呼吸する。静かで余白のある空気感で、イントロの立ち上がりやアウトロ、ボーカルだけになる静かなブレイクに合う",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Generator", "Ambient"],
  "INPUTS": [
    { "NAME": "colA", "TYPE": "color", "DEFAULT": [1.0, 0.6, 0.45, 1.0] },
    { "NAME": "colB", "TYPE": "color", "DEFAULT": [0.45, 0.55, 1.0, 1.0] },
    { "NAME": "colC", "TYPE": "color", "DEFAULT": [1.0, 0.95, 0.85, 1.0] },
    { "NAME": "bg", "TYPE": "color", "DEFAULT": [0.03, 0.03, 0.06, 1.0] },
    { "NAME": "breath", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "lift", "TYPE": "float", "DEFAULT": 0.3, "MIN": 0.0, "MAX": 1.0 }
  ],
  "JEVJ": {
    "short": "朝靄の柔らかな光の帯とぼけた粒（ISF）。静穏。イントロ・アウトロ",
    "bind": {
      "breath": "mid",
      "lift": "intensity"
    }
  }
}*/

float h21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, -0.9);
    a *= 0.5;
  }
  return s;
}

void main() {
  vec2 uv = isf_FragNormCoord;
  vec2 p = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / RENDERSIZE.y;
  float t = TIME * (0.03 + 0.05 * lift);

  // vertical sky gradient
  vec3 col = mix(bg.rgb, mix(bg.rgb, colB.rgb, 0.35), smoothstep(-0.2, 0.9, uv.y));

  // soft drifting light bands, warped by slow noise
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float w = fbm3(vec2(p.x * 1.2 + t * (1.0 + fi * 0.4), fi * 3.1 + t * 0.5));
    float y = -0.15 + fi * 0.18 + (w - 0.5) * 0.35;
    float band = exp(-pow((p.y - y) / (0.07 + 0.05 * fi), 2.0));
    vec3 bc = mix(colA.rgb, colB.rgb, fi * 0.5);
    col += bc * band * (0.18 + 0.12 * lift) * (0.8 + 0.35 * breath);
  }

  // mist texture
  float mist = fbm3(p * 2.5 + vec2(t * 2.0, -t));
  col = mix(col, col + colC.rgb * 0.08, smoothstep(0.45, 0.8, mist));

  // bokeh motes: one per grid cell, slowly rising
  vec2 g = p * 5.0 + vec2(0.0, -TIME * (0.03 + 0.06 * lift));
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float rnd = h21(id);
  if (rnd > 0.55) {
    vec2 off = vec2(h21(id + 7.1), h21(id + 3.7)) - 0.5;
    off += 0.15 * vec2(sin(TIME * 0.3 + rnd * 20.0), cos(TIME * 0.25 + rnd * 11.0));
    float size = 0.08 + 0.12 * h21(id + 1.3);
    float d = length(f - off * 0.6);
    float disc = smoothstep(size, size * 0.6, d);
    float tw = 0.5 + 0.5 * sin(TIME * (0.4 + rnd) + rnd * 30.0);
    col += mix(colC.rgb, colA.rgb, rnd) * disc * 0.12 * tw * (0.6 + 0.6 * lift + 0.4 * breath);
  }

  // gentle vignette and grain-free tone curve
  col *= mix(0.75, 1.0, smoothstep(1.2, 0.2, length(p)));
  col = col / (1.0 + col * 0.35);
  gl_FragColor = vec4(col, 1.0);
}
