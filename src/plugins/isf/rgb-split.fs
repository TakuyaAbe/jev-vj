/*{
  "ISFVSN": "2",
  "NAME": "RGB Split",
  "DESCRIPTION": "色収差。RGB をずらし、低域でわずかにズームする。どのシーンにも重ねられる",
  "CREDIT": "jev-vj",
  "CATEGORIES": ["Filter", "Stylize"],
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "amount", "TYPE": "float", "DEFAULT": 0.006, "MIN": 0.0, "MAX": 0.03 },
    { "NAME": "bass", "TYPE": "float", "DEFAULT": 0.0, "MIN": 0.0, "MAX": 1.0 }
  ],
  "JEVJ": { "bind": { "amount": { "src": "beatPulse", "min": 0.002, "max": 0.02 } } }
}*/

void main() {
  vec2 uv = isf_FragNormCoord;
  vec2 c = uv - 0.5;
  uv = 0.5 + c * (1.0 - bass * 0.03);
  vec2 dir = normalize(c + 1e-4) * amount;
  float r = IMG_NORM_PIXEL(inputImage, uv + dir).r;
  float g = IMG_NORM_PIXEL(inputImage, uv).g;
  float b = IMG_NORM_PIXEL(inputImage, uv - dir).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
