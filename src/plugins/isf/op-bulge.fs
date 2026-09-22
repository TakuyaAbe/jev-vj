/*{
  "ISFVSN": "2",
  "NAME": "Op Bulge",
  "DESCRIPTION": "市松模様と同心の縞が、見えない球に押されたように膨らみ歪むオプアート。キックで膨らみが跳ね、テンションが上がるほど縞が細かく速くなる。目が回るような錯視と緊張感があり、ビルドアップの詰めやブレイク明けの溜めに合う",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Generator", "Geometry"],
  "INPUTS": [
    { "NAME": "colA", "TYPE": "color", "DEFAULT": [1.0, 1.0, 1.0, 1.0] },
    { "NAME": "colB", "TYPE": "color", "DEFAULT": [0.9, 0.2, 0.3, 1.0] },
    { "NAME": "colC", "TYPE": "color", "DEFAULT": [0.2, 0.6, 1.0, 1.0] },
    { "NAME": "bg", "TYPE": "color", "DEFAULT": [0.0, 0.0, 0.0, 1.0] },
    { "NAME": "tension", "TYPE": "float", "DEFAULT": 0.5, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "punch", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "phase", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 }
  ],
  "JEVJ": {
    "short": "市松が膨らみ歪むオプアート（ISF）。錯視・緊張。ビルド終盤・溜め",
    "bind": {
      "tension": "intensity",
      "punch": "beatPulse",
      "phase": "barPhase"
    }
  }
}*/

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// displacement of a sphere-like lens centred at c with radius r
vec2 bulge(vec2 p, vec2 c, float r, float k) {
  vec2 d = p - c;
  float l = length(d);
  float f = smoothstep(r, 0.0, l);
  return p - d * f * f * k;
}

void main() {
  vec2 uv = isf_FragNormCoord;
  vec2 p = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / RENDERSIZE.y;
  float t = TIME * (0.15 + 0.5 * tension);

  // two wandering lenses plus a centre lens that jumps on the kick
  vec2 c1 = 0.35 * vec2(sin(t * 0.7), cos(t * 0.9));
  vec2 c2 = 0.3 * vec2(cos(t * 0.5 + 2.0), sin(t * 0.6 + 1.0));
  vec2 q = bulge(p, c1, 0.55, 0.55 + 0.25 * tension);
  q = bulge(q, c2, 0.45, 0.4);
  q = bulge(q, vec2(0.0), 0.7, 0.2 + 0.6 * punch * (0.3 + 0.7 * tension));
  q = rot(0.1 * sin(t * 0.4) + phase * 0.05) * q;

  // checkerboard whose cells shrink with tension
  float n = mix(7.0, 16.0, tension);
  vec2 g = q * n;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float checker = mod(cell.x + cell.y, 2.0);
  // antialias the edges
  vec2 aa = fwidth(g);
  vec2 e = smoothstep(vec2(0.0), aa * 1.5, 0.5 - abs(f));
  float edge = min(e.x, e.y);
  float chk = mix(0.5, checker, edge);

  // concentric stripes through the lens, flipping the checker inside a ring
  float r = length(q);
  float rings = sin(r * n * 3.14159 - t * 4.0);
  float rw = fwidth(rings) + 1e-3;
  float ring = smoothstep(-rw, rw, rings);
  float zone = smoothstep(0.02, -0.02, abs(r - 0.35 - 0.05 * sin(t)) - 0.12);
  float v = mix(chk, abs(chk - ring), zone);

  vec3 dark = mix(bg.rgb, colB.rgb, 0.25 * tension);
  vec3 col = mix(dark, colA.rgb, v);
  // lens shading gives the fake depth
  float shade = 1.0 - 0.35 * smoothstep(0.1, 0.9, length(p - c1));
  col *= shade;
  col += colC.rgb * zone * ring * 0.25 * punch;
  // at low tension fade toward a quieter contrast
  col = mix(mix(bg.rgb, col, 0.55), col, smoothstep(0.0, 0.5, tension));
  gl_FragColor = vec4(col, 1.0);
}
