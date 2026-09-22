// @name Chrome Blobs
// @description 液体金属の玉がぬるりと融合と分裂を繰り返し、鏡面に空と光の縞が映り込む。玉の大きさはそれぞれの帯域で膨らみ、キックで全体がぷるんと弾む。官能的でなめらか、ラグジュアリー。ディープハウスやR&B、ダウンテンポのゆったりしたグルーヴや歌パートに合う
// @short 融け合う液体金属の玉。官能・なめらか。ディープなグルーヴ・歌
// Jev GLSL: uniforms and helpers from src/gl/shaders/common.glsl are already declared.

vec3 cbEnv(vec3 d) {
  // fake studio environment: dark floor, bright horizon line, graded sky, light strips and a key light
  float y = d.y;
  vec3 ground = mix(uColBg * 0.3, uColB * 0.9, smoothstep(-0.9, -0.02, y));
  vec3 sky = mix(uColA, uColBg * 0.7, smoothstep(0.02, 0.9, y));
  vec3 c = y < 0.0 ? ground : sky;
  c += uColC * exp(-abs(y) * 28.0) * 1.2;
  float strip = smoothstep(0.06, 0.0, abs(fract(d.x * 1.4 + 0.08 * uTime) - 0.5) - 0.4) * smoothstep(0.15, 0.6, y);
  c += vec3(1.0) * strip * 0.35;
  c += vec3(1.0) * pow(max(dot(d, normalize(vec3(0.5, 0.6, 0.6))), 0.0), 60.0) * 1.5;
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * (0.25 + 0.35 * uIntensity);
  float field = 0.0;
  vec2 grad = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c = 0.42 * vec2(sin(t * (0.7 + fi * 0.13) + fi * 2.1), cos(t * (0.55 + fi * 0.17) + fi * 1.3));
    c.x *= uRes.x / uRes.y * 0.8;
    float r = 0.085 + 0.045 * fft(0.03 + fi * 0.07) + uBeatPulse * 0.025 + uBass * 0.02;
    vec2 dv = uv - c;
    float dd = dot(dv, dv) + 1e-4;
    float k = r * r / dd;
    field += k;
    grad += -2.0 * k * dv / dd;
  }
  float edge = smoothstep(0.95, 1.05, field);
  // pseudo height from the field -> normal
  vec3 n = normalize(vec3(-grad * 0.05 / sqrt(field), 1.0));
  vec3 v = vec3(0.0, 0.0, -1.0);
  vec3 r = reflect(v, n);
  vec3 metal = cbEnv(r);
  float fres = pow(1.0 - max(n.z, 0.0), 2.0);
  metal = mix(metal * 0.85, cbEnv(vec3(r.xy * 1.3, r.z)) + 0.1, fres);
  // dark stage with a soft reflection pool under the blobs
  vec3 bg = uColBg + uColA * 0.05 * smoothstep(1.2, 0.0, length(uv));
  bg += mix(uColA, uColB, 0.5) * smoothstep(0.3, 0.9, field) * 0.12 * (0.4 + uIntensity);
  vec3 col = mix(bg, metal, edge);
  // thin iridescent rim where blobs meet the air
  col += uColC * smoothstep(0.12, 0.0, abs(field - 1.0)) * 0.25 * (0.3 + uIntensity);
  col = col / (1.0 + col * 0.25);
  gl_FragColor = vec4(col, 1.0);
}
