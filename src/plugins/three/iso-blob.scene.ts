import { defineThreeScene } from '../api';

/**
 * An icosphere displaced in the vertex shader: slow 3D noise for the body,
 * the FFT texture mapped by latitude (bass at the poles, highs at the equator)
 * for detail, and a beat-driven swell. Normals from displaced neighbours
 * plus a fresnel rim, with a faint wireframe shell around it.
 */
const vert = /* glsl */ `
uniform float uTime, uBass, uMid, uHigh, uBeatPulse, uIntensity, uSwell;
uniform sampler2D uFFT;
varying vec3 vPos;
varying vec3 vNrm;
varying float vDisp;

float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float dispAt(vec3 n, float t) {
  float body = n3(n * 1.6 + vec3(0.0, t, t * 0.7)) * 0.65 + n3(n * 3.7 - vec3(t * 1.3, 0.0, t)) * 0.35;
  // latitude -> spectrum band: poles carry the lows, the equator the highs
  float lat = abs(n.y);
  float band = pow(1.0 - lat, 1.6) * 0.45 + 0.02;
  // wide 5-tap average: neighbouring FFT bins differ a lot, and sampling them raw carves
  // sawtooth ridges between adjacent vertices
  float f = 0.0;
  for (int k = -2; k <= 2; k++) f += texture2D(uFFT, vec2(max(band + float(k) * 0.03, 0.004), 0.5)).r;
  f /= 5.0;
  // blend with the smooth band levels (lows at the poles, mids, highs at the equator)
  // (linear in latitude: a steep blend makes a shelf whose rim shows every facet)
  float broad = lat < 0.5 ? mix(uHigh, uMid, lat * 2.0) : mix(uMid, uBass, lat * 2.0 - 1.0);
  f = mix(broad, f, 0.3);
  float spikes = f * f * (0.08 + uIntensity * 0.3) * (0.3 + 0.7 * n3(n * 3.5 + t * 1.5));
  float d = (body - 0.45) * (0.18 + uIntensity * 0.32 + uBass * 0.2) + spikes;
  return d;
}

void main() {
  vec3 n = normalize(position);
  float t = uTime * (0.15 + uIntensity * 0.35);
  float d = dispAt(n, t);
  vDisp = d;
  // smooth normal from two displaced neighbours: derivative (flat) normals alias into
  // zigzag bands where the surface is seen at a grazing angle
  vec3 up = abs(n.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 ta = normalize(cross(n, up));
  vec3 tb = cross(n, ta);
  vec3 na = normalize(n + ta * 0.02);
  vec3 nb = normalize(n + tb * 0.02);
  vec3 p0 = n * (1.0 + d);
  vec3 nrm = normalize(cross(na * (1.0 + dispAt(na, t)) - p0, nb * (1.0 + dispAt(nb, t)) - p0));
  if (dot(nrm, n) < 0.0) nrm = -nrm;
  vNrm = normalize(mat3(modelMatrix) * nrm);
  vec3 p = n * (1.0 + d) * (1.0 + uSwell);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3 uColA, uColB, uColC, uColBg;
uniform float uIntensity, uBeatPulse, uHigh;
varying vec3 vPos;
varying vec3 vNrm;
varying float vDisp;

void main() {
  vec3 nrm = normalize(vNrm);
  vec3 v = normalize(cameraPosition - vPos);
  if (dot(nrm, v) < 0.0) nrm = -nrm;
  vec3 L = normalize(vec3(0.6, 0.8, 0.4));
  float dif = max(dot(nrm, L), 0.0);
  float fres = pow(1.0 - max(dot(nrm, v), 0.0), 2.5);
  vec3 base = mix(uColA, uColB, smoothstep(-0.15, 0.35, vDisp));
  vec3 col = base * (0.18 + 0.75 * dif);
  col += uColC * fres * (0.5 + uIntensity * 0.8 + uBeatPulse * 0.4);
  col += uColC * smoothstep(0.25, 0.6, vDisp) * (0.3 + uHigh * 0.7);
  gl_FragColor = vec4(col, 1.0);
}
`;

export default defineThreeScene({
  id: 'iso_blob',
  name: 'Iso Blob (three.js)',
  description:
    '宙に浮かぶ有機的な塊が低音で膨らみ、スペクトラムに合わせて表面がトゲ状に波打つ。ぬめりのある妖しさがあり、うねるベースラインのグルーヴや、ミドルテンポで粘る展開に合う。静かな場面ではゆっくり呼吸するだけになる',
  short: '低音で脈打つ有機的な塊（3D）。妖しく粘る。グルーヴ・ベースライン',
  fov: 50,
  setup({ THREE, scene, uniforms }) {
    const swell = { value: 0 };
    const geo = new THREE.IcosahedronGeometry(1, 40);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uSwell: swell },
      vertexShader: vert,
      fragmentShader: frag,
    });
    const blob = new THREE.Mesh(geo, mat);
    scene.add(blob);

    // faint wireframe shell sharing the same displacement, a touch larger
    const shellSwell = { value: 0 };
    const shellMat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uSwell: shellSwell },
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform vec3 uColC; uniform float uIntensity, uBeatPulse;
        void main() { gl_FragColor = vec4(uColC * (0.12 + uIntensity * 0.25 + uBeatPulse * 0.2), 1.0); }
      `,
      wireframe: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 6), shellMat);
    shell.scale.setScalar(1.35);
    scene.add(shell);

    let orbit = 0;
    let punch = 0;
    return {
      update(input, { camera }) {
        const dt = Math.min(input.dt, 0.1);
        // beat swell: follows the pulse, weighted by bass so hats alone don't pump it
        punch += (input.beatPulse * (0.35 + input.bass * 0.65) - punch) * Math.min(1, dt * 18);
        swell.value = punch * (0.04 + input.intensity * 0.1);
        shellSwell.value = swell.value * 1.6;
        blob.rotation.y += dt * (0.05 + input.intensity * 0.2);
        blob.rotation.x = Math.sin(input.t * 0.11) * 0.4;
        shell.rotation.y -= dt * (0.03 + input.mid * 0.1);
        shell.rotation.z += dt * 0.02;
        orbit += dt * (0.04 + input.intensity * 0.12);
        const r = 4.2 - input.intensity * 0.6;
        camera.position.set(Math.sin(orbit) * r, Math.sin(input.t * 0.07) * 1.2, Math.cos(orbit) * r);
        camera.lookAt(0, 0, 0);
        camera.fov = 50 - punch * 4 * (0.3 + input.intensity);
        camera.updateProjectionMatrix();
      },
      reset() {
        orbit = 0;
        punch = 0;
      },
    };
  },
});
