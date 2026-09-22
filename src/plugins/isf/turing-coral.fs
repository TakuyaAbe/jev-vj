/*{
  "ISFVSN": "2",
  "NAME": "Turing Coral",
  "DESCRIPTION": "反応拡散（Gray-Scott）の模様が珊瑚や迷路のように有機的に増殖する。キックのたびに新しい種が落ち、低域で成長が速まる。じわじわ変化する生き物のような質感で、展開の中盤やディープな長いグルーヴに合う",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Generator", "Audio Reactive", "Simulation"],
  "INPUTS": [
    { "NAME": "colA", "TYPE": "color", "DEFAULT": [1.0, 0.35, 0.55, 1.0] },
    { "NAME": "colB", "TYPE": "color", "DEFAULT": [0.25, 0.85, 1.0, 1.0] },
    { "NAME": "colC", "TYPE": "color", "DEFAULT": [1.0, 0.95, 0.8, 1.0] },
    { "NAME": "bg", "TYPE": "color", "DEFAULT": [0.02, 0.02, 0.05, 1.0] },
    { "NAME": "speed", "TYPE": "float", "DEFAULT": 0.6, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "growth", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "glow", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "drop", "TYPE": "event" }
  ],
  "PASSES": [
    { "TARGET": "rd0", "PERSISTENT": true, "FLOAT": true, "WIDTH": "floor($WIDTH/2)", "HEIGHT": "floor($HEIGHT/2)" },
    { "TARGET": "rd1", "PERSISTENT": true, "FLOAT": true, "WIDTH": "floor($WIDTH/2)", "HEIGHT": "floor($HEIGHT/2)" },
    { "TARGET": "rd2", "PERSISTENT": true, "FLOAT": true, "WIDTH": "floor($WIDTH/2)", "HEIGHT": "floor($HEIGHT/2)" },
    { "TARGET": "rd3", "PERSISTENT": true, "FLOAT": true, "WIDTH": "floor($WIDTH/2)", "HEIGHT": "floor($HEIGHT/2)" },
    {}
  ],
  "JEVJ": {
    "short": "反応拡散の珊瑚模様が有機的に増殖（ISF）。じわじわ。中盤・ディープ",
    "bind": {
      "speed": { "src": "intensity", "min": 0.25, "max": 1.0 },
      "growth": "bass",
      "glow": "beatPulse"
    }
  }
}*/

// Buffer layout: r = 1 - A (so a cleared buffer means A = 1), g = B.
// Four simulation steps per frame run as a chain rd3 -> rd0 -> rd1 -> rd2 -> rd3, one
// buffer per pass (portable across ISF hosts); rd3 carries the state to the next frame.

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 state(vec2 uv) {
  vec2 s;
  if (PASSINDEX == 0) s = IMG_NORM_PIXEL(rd3, uv).rg;
  else if (PASSINDEX == 1) s = IMG_NORM_PIXEL(rd0, uv).rg;
  else if (PASSINDEX == 2) s = IMG_NORM_PIXEL(rd1, uv).rg;
  else s = IMG_NORM_PIXEL(rd2, uv).rg;
  return vec2(1.0 - s.r, s.g);
}

void main() {
  vec2 uv = isf_FragNormCoord;
  if (PASSINDEX < 4) {
    vec2 px = 1.0 / RENDERSIZE;
    vec2 c = state(uv);
    // 3x3 Laplacian (center -1, edges 0.2, corners 0.05)
    vec2 lap = -c;
    lap += 0.2 * (state(uv + vec2(px.x, 0.0)) + state(uv - vec2(px.x, 0.0)) + state(uv + vec2(0.0, px.y)) + state(uv - vec2(0.0, px.y)));
    lap += 0.05 * (state(uv + px) + state(uv - px) + state(uv + vec2(px.x, -px.y)) + state(uv + vec2(-px.x, px.y)));

    // feed / kill drift slowly across the screen so coral, maze and spots coexist
    vec2 p = uv - 0.5;
    float drift = 0.5 + 0.5 * sin(TIME * 0.05 + p.x * 3.0 + p.y * 2.0);
    float feed = mix(0.037, 0.055, drift) + growth * 0.006;
    float kill = mix(0.060, 0.062, drift);
    float dt = mix(0.35, 1.0, speed);

    float A = c.x;
    float B = c.y;
    float abb = A * B * B;
    A += dt * (1.0 * lap.x - abb + feed * (1.0 - A));
    B += dt * (0.5 * lap.y + abb - (kill + feed) * B);

    // seeds: scattered specks on the first frames, a burst on each beat
    vec2 cell = uv * RENDERSIZE;
    if (FRAMEINDEX < 3 && h21(floor(cell / 6.0)) > 0.985) B = 0.9;
    if (drop && PASSINDEX == 0) {
      float k = floor(TIME * 7.0);
      vec2 at = vec2(h21(vec2(k, 1.7)), h21(vec2(3.1, k)));
      vec2 d = (uv - at) * vec2(RENDERSIZE.x / RENDERSIZE.y, 1.0);
      if (length(d) < 0.012 + growth * 0.01) B = 0.8;
    }
    gl_FragColor = vec4(1.0 - clamp(A, 0.0, 1.0), clamp(B, 0.0, 1.0), 0.0, 1.0);
  } else {
    vec2 px = 1.0 / vec2(IMG_SIZE(rd3));
    float b = IMG_NORM_PIXEL(rd3, uv).g;
    float bx = IMG_NORM_PIXEL(rd3, uv + vec2(px.x, 0.0)).g - IMG_NORM_PIXEL(rd3, uv - vec2(px.x, 0.0)).g;
    float by = IMG_NORM_PIXEL(rd3, uv + vec2(0.0, px.y)).g - IMG_NORM_PIXEL(rd3, uv - vec2(0.0, px.y)).g;
    vec3 n = normalize(vec3(-bx * 6.0, -by * 6.0, 1.0));
    float light = clamp(dot(n, normalize(vec3(-0.4, 0.5, 0.8))), 0.0, 1.0);
    float t = smoothstep(0.08, 0.38, b);
    vec3 body = mix(colA.rgb, colB.rgb, smoothstep(0.2, 0.6, b + 0.1 * sin(TIME * 0.3 + uv.x * 4.0)));
    vec3 col = mix(bg.rgb, body * (0.55 + 0.6 * light), t);
    float rim = smoothstep(0.02, 0.0, abs(b - 0.2));
    col += colC.rgb * rim * (0.15 + 0.6 * glow);
    col += colC.rgb * pow(light, 24.0) * t * 0.35;
    float vig = smoothstep(1.1, 0.3, length(uv - 0.5));
    gl_FragColor = vec4(col * mix(0.7, 1.0, vig), 1.0);
  }
}
