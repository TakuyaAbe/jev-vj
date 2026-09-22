import { defineThreeScene } from '../api';

/**
 * A point cloud that holds a shape (sphere / torus knot / cube shell) and
 * blows apart when the music drops: a strong beat at high intensity, or a
 * sudden jump in Jev's intensity. It drifts back together and re-forms as
 * the next shape. Calm passages only breathe.
 */
const vert = /* glsl */ `
attribute vec3 aB;
attribute vec3 aC;
attribute vec4 aRnd; // xyz: burst direction, w: 0..1 random
uniform vec3 uW;     // shape weights (sphere, knot, cube)
uniform float uTime, uBurst, uKick, uIntensity, uHigh;
uniform vec2 uRes;
uniform sampler2D uFFT;
varying float vR;
varying float vB;

void main() {
  vec3 p = position * uW.x + aB * uW.y + aC * uW.z;
  float r = aRnd.w;
  float f = texture2D(uFFT, vec2(0.02 + r * 0.4, 0.5)).r;
  // breathing + spectral fuzz, tiny when calm
  p *= 1.0 + uKick + sin(uTime * 0.8 + r * 6.2831) * 0.015;
  p += aRnd.xyz * f * f * (0.05 + uIntensity * 0.2);
  // burst: fly out along a random direction, curling around y as it goes
  float b = uBurst * (1.5 + r * 4.0);
  p += aRnd.xyz * b;
  float a = uBurst * (r - 0.5) * 2.5;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = (1.4 + r * 1.6 + uHigh * 0.8 * step(0.85, r)) * (uRes.y / 720.0);
  gl_PointSize = size * (6.0 / max(-mv.z, 0.5));
  vR = r;
  vB = uBurst;
}
`;

const frag = /* glsl */ `
uniform vec3 uColA, uColB, uColC;
uniform float uIntensity;
varying float vR;
varying float vB;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float m = smoothstep(0.5, 0.1, length(d));
  if (m <= 0.0) discard;
  vec3 col = mix(uColA, uColB, smoothstep(0.3, 0.7, vR));
  col = mix(col, uColC, clamp(vB * 1.4, 0.0, 1.0) * step(0.6, vR));
  gl_FragColor = vec4(col * m * (0.45 + uIntensity * 0.45 + vB * 0.6), 1.0);
}
`;

export default defineThreeScene({
  id: 'point_burst',
  name: 'Point Burst (three.js)',
  description:
    '無数の点が球やトーラス結び目、立方体の形に集まって静かに呼吸し、ドロップの瞬間に一斉に爆散して、また別の形に再集結する。溜めてから解放する緊張と爽快感がある。ビルドアップの終わりからドロップの瞬間、落差の大きい展開に合う',
  short: '点群が形を成しドロップで爆散→再集結（3D）。溜め→解放。ドロップの瞬間',
  maxBars: 16,
  fov: 55,
  setup({ THREE, scene, uniforms }) {
    const N = 22000;
    const A = new Float32Array(N * 3);
    const B = new Float32Array(N * 3);
    const C = new Float32Array(N * 3);
    const R = new Float32Array(N * 4);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      // sphere shell (fibonacci)
      const y = 1 - (2 * (i + 0.5)) / N;
      const rr = Math.sqrt(1 - y * y);
      const th = golden * i;
      const rs = 1.25 * (0.97 + Math.random() * 0.06);
      A[i * 3] = Math.cos(th) * rr * rs;
      A[i * 3 + 1] = y * rs;
      A[i * 3 + 2] = Math.sin(th) * rr * rs;
      // (2,3) torus knot with a thin tube
      const t = (i / N) * Math.PI * 2;
      const kr = 0.8 + 0.35 * Math.cos(3 * t);
      const tube = 0.09 * Math.sqrt(Math.random());
      const ta = Math.random() * Math.PI * 2;
      B[i * 3] = kr * Math.cos(2 * t) + Math.cos(ta) * tube;
      B[i * 3 + 1] = 0.35 * Math.sin(3 * t) + Math.sin(ta) * tube;
      B[i * 3 + 2] = kr * Math.sin(2 * t) + Math.cos(ta + 1.3) * tube;
      // cube surface
      const face = i % 6;
      const u = Math.random() * 2 - 1;
      const v = Math.random() * 2 - 1;
      const s = face < 3 ? 1 : -1;
      const ax = face % 3;
      const cv: [number, number, number] = [0, 0, 0];
      cv[ax] = s;
      cv[(ax + 1) % 3] = u;
      cv[(ax + 2) % 3] = v;
      C[i * 3] = cv[0] * 0.95;
      C[i * 3 + 1] = cv[1] * 0.95;
      C[i * 3 + 2] = cv[2] * 0.95;
      // random unit direction for the burst
      const dz = Math.random() * 2 - 1;
      const da = Math.random() * Math.PI * 2;
      const dr = Math.sqrt(1 - dz * dz);
      R[i * 4] = Math.cos(da) * dr;
      R[i * 4 + 1] = dz;
      R[i * 4 + 2] = Math.sin(da) * dr;
      R[i * 4 + 3] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(A, 3));
    geo.setAttribute('aB', new THREE.BufferAttribute(B, 3));
    geo.setAttribute('aC', new THREE.BufferAttribute(C, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(R, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    const uW = { value: new THREE.Vector3(1, 0, 0) };
    const uBurst = { value: 0 };
    const uKick = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uW, uBurst, uKick },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);

    const target = new THREE.Vector3(1, 0, 0);
    let shape = 0;
    let burst = 0;
    let boom = 0;
    let cooldown = 0;
    let wasHigh = false;
    let slowInt = 0;
    let lastBar = -1;
    let orbit = 0;
    let punch = 0;
    const nextShape = () => {
      shape = (shape + 1) % 3;
      target.set(shape === 0 ? 1 : 0, shape === 1 ? 1 : 0, shape === 2 ? 1 : 0);
    };
    return {
      update(input, { camera: cam }) {
        const dt = Math.min(input.dt, 0.1);
        cooldown -= dt;
        const rising = input.beatPulse > 0.9 && !wasHigh;
        wasHigh = input.beatPulse > 0.9;
        // drop = downbeat-ish hit at high intensity, or intensity jumping well above its recent level
        const jump = input.intensity - slowInt > 0.25;
        slowInt += (input.intensity - slowInt) * Math.min(1, dt * 0.15);
        if (rising && cooldown <= 0 && ((input.intensity > 0.7 && input.bass > 0.65) || jump)) {
          boom = 1;
          cooldown = (240 / Math.max(60, input.bpm || 120)) * 4; // ~4 bars
          nextShape();
        }
        // envelope: boom jumps and decays, burst chases it with a ~80ms attack so nothing snaps
        boom *= Math.exp(-dt * (0.9 + (1 - input.intensity) * 0.6));
        burst += (boom - burst) * Math.min(1, dt * (boom > burst ? 12 : 30));
        uBurst.value = burst;
        // calm passages still change shape slowly, every 8 bars
        if (input.bar !== lastBar) {
          if (lastBar >= 0 && input.bar % 8 === 0 && burst < 0.05) nextShape();
          lastBar = input.bar;
        }
        uW.value.lerp(target, Math.min(1, dt * (burst > 0.2 ? 3 : 0.6)));

        punch += (input.beatPulse * input.bass - punch) * Math.min(1, dt * 18);
        uKick.value = punch * (0.02 + input.intensity * 0.08);
        pts.rotation.y += dt * (0.06 + input.intensity * 0.15 + burst * 0.4);
        pts.rotation.x = Math.sin(input.t * 0.09) * 0.3;

        orbit += dt * 0.05;
        const r = 4.4 + burst * 1.5;
        cam.position.set(Math.sin(orbit) * r, 0.8 + Math.sin(input.t * 0.13) * 0.6, Math.cos(orbit) * r);
        cam.lookAt(0, 0, 0);
        cam.fov = 55 + burst * 12 - punch * 3 * input.intensity;
        cam.updateProjectionMatrix();
      },
      reset() {
        burst = 0;
        boom = 0;
        cooldown = 0;
        slowInt = 0;
        lastBar = -1;
        shape = 0;
        target.set(1, 0, 0);
        uW.value.set(1, 0, 0);
      },
    };
  },
});
