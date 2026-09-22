/*{
  "ISFVSN": "2",
  "NAME": "Pulse Ridges",
  "DESCRIPTION": "直近の音のスペクトル（低域が中央）と波形が一本ずつ奥へ送られ、重なり合う山脈の稜線になる。手前ほど明るく、奥は霧に沈む。音の起伏がそのまま地形として流れていく内省的で端正な見た目。ミニマルテクノの中盤やボーカルの語りに合う",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Generator", "Audio Reactive"],
  "INPUTS": [
    { "NAME": "waveImage", "TYPE": "audio" },
    { "NAME": "fftImage", "TYPE": "audioFFT" },
    { "NAME": "colA", "TYPE": "color", "DEFAULT": [1.0, 1.0, 1.0, 1.0] },
    { "NAME": "colB", "TYPE": "color", "DEFAULT": [0.4, 0.7, 1.0, 1.0] },
    { "NAME": "colC", "TYPE": "color", "DEFAULT": [1.0, 0.4, 0.6, 1.0] },
    { "NAME": "bg", "TYPE": "color", "DEFAULT": [0.0, 0.0, 0.0, 1.0] },
    { "NAME": "gain", "TYPE": "float", "DEFAULT": 0.6, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "flash", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "tilt", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 }
  ],
  "PASSES": [
    { "TARGET": "hist", "PERSISTENT": true, "WIDTH": 256, "HEIGHT": 40 },
    {}
  ],
  "JEVJ": {
    "short": "波形の履歴が重なる山脈の稜線（ISF）。内省・端正。ミニマル・語り",
    "bind": {
      "gain": { "src": "intensity", "min": 0.25, "max": 1.0 },
      "flash": "beatPulse",
      "tilt": "bass"
    }
  }
}*/

#define ROWS 40.0

void main() {
  vec2 uv = isf_FragNormCoord;
  if (PASSINDEX == 0) {
    // row 0 = newest waveform; every other frame, shift everything one row back
    float row = floor(gl_FragCoord.y);
    bool advance = mod(float(FRAMEINDEX), 2.0) < 1.0;
    if (!advance) {
      gl_FragColor = IMG_NORM_PIXEL(hist, uv);
      return;
    }
    if (row < 0.5) {
      // mirrored spectrum (lows in the middle, highs at the sides) plus a little of the
      // rectified waveform for grain; smoothed so each ridge reads as a clean silhouette
      float f = abs(uv.x - 0.5) * 2.0;
      float w = 0.0;
      float wv = 0.0;
      for (int i = -3; i <= 3; i++) {
        float fo = clamp(f + float(i) / 70.0, 0.0, 1.0);
        float k = 1.0 - abs(float(i)) / 4.0;
        w += IMG_NORM_PIXEL(fftImage, vec2(0.01 + pow(fo, 1.7) * 0.45, 0.5)).r * k;
        wv += abs(IMG_NORM_PIXEL(waveImage, vec2(clamp(uv.x + float(i) / 128.0, 0.0, 1.0), 0.5)).r - 0.5) * 2.0 * k;
      }
      w = w / 4.0;
      wv = wv / 4.0;
      float amp = clamp(w * w * 1.2 + wv * 0.25, 0.0, 1.0);
      gl_FragColor = vec4(amp, 0.0, 0.0, 1.0);
    } else {
      gl_FragColor = IMG_NORM_PIXEL(hist, vec2(uv.x, (row - 0.5) / ROWS));
    }
    return;
  }

  float aspect = RENDERSIZE.x / RENDERSIZE.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  vec3 col = bg.rgb;
  float lineW = 2.4 / RENDERSIZE.y;
  // front (i = 0) to back: first ridge above the pixel occludes everything behind it
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    float depth = fi / ROWS;
    float persp = 1.0 / (1.0 + depth * 2.2);
    float base = 0.08 + (1.0 - persp) * 0.95 + tilt * 0.02 * (1.0 - depth);
    float xw = p.x / (persp * aspect * 0.9) + 0.5;
    if (xw < 0.0 || xw > 1.0) continue;
    float env = exp(-pow((xw - 0.5) * 3.2, 2.0));
    float scale = persp * (0.12 + 0.45 * gain);
    float amp = IMG_NORM_PIXEL(hist, vec2(xw, (fi + 0.5) / ROWS)).r;
    float h = base + env * (amp * scale + persp * 0.01);
    float d = p.y - h;
    if (d > 0.25) continue; // far above this ridge: cheap reject
    // slope-corrected distance so steep flanks keep a continuous line
    float ex = 2.0 / RENDERSIZE.x;
    float amp2 = IMG_NORM_PIXEL(hist, vec2(xw + ex / (persp * 0.9), (fi + 0.5) / ROWS)).r;
    float slope = env * (amp2 - amp) * scale / (ex * aspect);
    float dc = d / sqrt(1.0 + slope * slope);
    if (dc < lineW) {
      float fog = exp(-depth * 2.6);
      vec3 lc = mix(colA.rgb, colB.rgb, depth);
      lc = mix(lc, colC.rgb, flash * step(fi, 1.5));
      float line = smoothstep(lineW, 0.0, abs(dc));
      // faint body under the crest so nearer ridges read as solid silhouettes
      float body = smoothstep(-0.12, 0.0, d) * 0.08;
      col = mix(bg.rgb, lc, max(line, body) * fog * (0.55 + 0.45 * gain));
      break;
    }
  }
  // faint horizon haze
  col += colB.rgb * 0.06 * smoothstep(0.35, 1.0, uv.y) * (1.0 - uv.y) * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
