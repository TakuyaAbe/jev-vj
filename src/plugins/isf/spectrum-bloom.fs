/*{
  "ISFVSN": "2",
  "NAME": "Spectrum Bloom",
  "DESCRIPTION": "スペクトラムが円環状に咲き、前のフレームが回転しながら奥へ溶けていくフィードバック。華やかで広がりがある。ビルドアップやメロディックなドロップに合う",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Generator", "Audio Reactive"],
  "INPUTS": [
    { "NAME": "fftImage", "TYPE": "audioFFT" },
    { "NAME": "colA", "TYPE": "color", "DEFAULT": [1.0, 0.3, 0.6, 1.0] },
    { "NAME": "colB", "TYPE": "color", "DEFAULT": [0.2, 0.8, 1.0, 1.0] },
    { "NAME": "colC", "TYPE": "color", "DEFAULT": [1.0, 1.0, 0.8, 1.0] },
    { "NAME": "bg", "TYPE": "color", "DEFAULT": [0.0, 0.0, 0.0, 1.0] },
    { "NAME": "decay", "TYPE": "float", "DEFAULT": 0.92, "MIN": 0.8, "MAX": 0.985 },
    { "NAME": "spin", "TYPE": "float", "DEFAULT": 0.02, "MIN": 0.0, "MAX": 0.08 },
    { "NAME": "bass", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "kick", "TYPE": "event" }
  ],
  "PASSES": [
    { "TARGET": "trail", "PERSISTENT": true },
    {}
  ],
  "JEVJ": {
    "short": "スペクトラムの花とフィードバック（ISF）。華やか。ビルド・ドロップ",
    "bind": { "decay": { "src": "intensity", "min": 0.86, "max": 0.975 }, "spin": { "src": "intensity", "min": 0.005, "max": 0.05 } }
  }
}*/

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void main() {
  vec2 uv = isf_FragNormCoord;
  vec2 p = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / RENDERSIZE.y;
  if (PASSINDEX == 0) {
    // feedback: sample last frame slightly zoomed in and rotated
    vec2 q = rot2(spin * (kick ? 3.0 : 1.0)) * p * (0.985 - bass * 0.02);
    vec2 fuv = q * vec2(RENDERSIZE.y / RENDERSIZE.x, 1.0) + 0.5;
    vec3 prev = IMG_NORM_PIXEL(trail, fuv).rgb * decay;
    float a = atan(p.y, p.x) / 6.2831853 + 0.5;
    float fold = abs(fract(a * 3.0) * 2.0 - 1.0); // mirrored spectrum, 3 petals
    float mag = IMG_NORM_PIXEL(fftImage, vec2(0.02 + fold * 0.5, 0.5)).r;
    float r = length(p);
    float ring = smoothstep(0.012, 0.0, abs(r - (0.12 + mag * 0.33)));
    vec3 col = mix(colA.rgb, colB.rgb, fold) * ring * (0.6 + mag);
    col += colC.rgb * smoothstep(0.05, 0.0, r) * (kick ? 1.0 : 0.2);
    gl_FragColor = vec4(max(prev, col), 1.0);
  } else {
    vec3 t = IMG_NORM_PIXEL(trail, uv).rgb;
    gl_FragColor = vec4(bg.rgb + t, 1.0);
  }
}
