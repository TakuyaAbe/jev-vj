import { defineThreeScene } from '../api';

/**
 * A faceted night sea under a low moon. Swell height follows intensity (flat
 * calm → rolling), the bass lifts a slow ground swell, highs add chop; beats
 * send a soft ring of light across the water from the moon's reflection.
 * Faceted shading via screen derivatives, distance fog into the palette bg.
 */
const vert = /* glsl */ `
uniform float uTime, uIntensity, uBass, uHigh, uTravel, uSwellAmp;
varying vec3 vPos;
varying float vH;

float wave(vec2 p, vec2 dir, float freq, float speed) {
  return sin(dot(p, dir) * freq + uTime * speed);
}

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p = wp.xz + vec2(0.0, -uTravel);
  float amp = uSwellAmp;
  float h = wave(p, normalize(vec2(1.0, 0.6)), 0.35, 0.7) * 0.55
          + wave(p, normalize(vec2(-0.7, 1.0)), 0.52, 1.1) * 0.35
          + wave(p, normalize(vec2(0.2, -1.0)), 0.9, 1.6) * 0.18;
  h *= amp;
  // chop from the highs, only near the camera where it can be seen
  h += wave(p, normalize(vec2(1.0, -0.3)), 1.3, 3.1) * wave(p, normalize(vec2(0.4, 1.0)), 1.6, 2.4) * uHigh * 0.12 * (0.3 + uIntensity);
  wp.y += h;
  vH = h;
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3 uColA, uColB, uColC, uColBg;
uniform float uIntensity, uBeatPulse, uRing, uSwellAmp;
uniform vec3 uMoon;
varying vec3 vPos;
varying float vH;

void main() {
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  if (n.y < 0.0) n = -n;
  vec3 v = normalize(cameraPosition - vPos);
  vec3 L = normalize(uMoon - vPos);
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), v), 0.0), 24.0);
  vec3 deep = mix(uColBg, uColB, 0.35);
  vec3 col = mix(deep, uColA, dif * 0.55 + smoothstep(0.2, 0.9, vH / max(uSwellAmp, 0.2)) * 0.25);
  // moon glitter, brighter along the moon's column
  float column = exp(-abs(vPos.x - uMoon.x) * 0.25);
  col += uColC * spec * (0.6 + column * 1.2);
  // beat ring rolling outward from under the camera
  float d = length(vPos.xz - cameraPosition.xz);
  col += uColC * uRing * exp(-abs(d - (1.0 - uRing) * 30.0) * 0.8) * 0.5 * (0.3 + uIntensity);
  float fog = 1.0 - exp(-d * (0.045 - uIntensity * 0.015));
  col = mix(col, uColBg, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

export default defineThreeScene({
  id: 'lowpoly_sea',
  name: 'Lowpoly Sea (three.js)',
  description:
    '低い月が照らす夜の海を、角ばったローポリの波面ごとゆっくり進む。月の光の道がきらめき、ビートで光の輪が水面を渡る。静かで叙情的、余韻がある。イントロやアウトロ、ブレイクダウン、アンビエントな場面に合う。強さが上がると波が高くうねり出す',
  short: '月夜のローポリの海（3D）。静か・叙情的。イントロ・アウトロ',
  fov: 60,
  setup({ THREE, scene, uniforms }) {
    const moonPos = new THREE.Vector3(6, 7, -60);
    const uTravel = { value: 0 };
    const uSwellAmp = { value: 0.3 };
    const uRing = { value: 0 };
    const uMoon = { value: moonPos };

    const geo = new THREE.PlaneGeometry(90, 90, 110, 110);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -30);
    const sea = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uTravel, uSwellAmp, uRing, uMoon },
        vertexShader: vert,
        fragmentShader: frag,
      }),
    );
    sea.frustumCulled = false;
    scene.add(sea);

    const moonMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), moonMat);
    moon.position.copy(moonPos);
    scene.add(moon);
    const haloMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.RingGeometry(3.4, 6.5, 48, 1), haloMat);
    halo.position.copy(moonPos);
    scene.add(halo);

    let amp = 0.3;
    let ring = 0;
    let wasHigh = false;
    let sway = 0;
    return {
      update(input, { camera }) {
        const dt = Math.min(input.dt, 0.1);
        // flat calm at low intensity, rolling at high; bass adds a slow ground swell
        const targetAmp = 0.15 + input.intensity * 1.1 + input.bass * 0.35 * input.intensity;
        amp += (targetAmp - amp) * Math.min(1, dt * 0.6);
        uSwellAmp.value = amp;
        uTravel.value += dt * (0.6 + input.intensity * 2.4);
        // a ring of light per downbeat (every beat when it gets busy)
        const hit = input.beatPulse > 0.9 && !wasHigh;
        wasHigh = input.beatPulse > 0.9;
        if (hit && (input.intensity > 0.55 || input.barPhase < 0.2)) ring = 1;
        ring = Math.max(0, ring - dt * 0.35);
        uRing.value = ring;

        moonMat.color.set(input.palette.c);
        haloMat.color.set(input.palette.a);
        haloMat.opacity = 0.08 + input.beatPulse * 0.12 * (0.3 + input.intensity);
        halo.scale.setScalar(1 + input.beatPulse * 0.06);
        halo.lookAt(camera.position);
        moon.lookAt(camera.position);

        sway += (Math.sin(input.t * 0.17) * 0.06 * (0.3 + amp) - sway) * Math.min(1, dt * 1.5);
        camera.position.set(Math.sin(input.t * 0.05) * 1.5, 2.2 + amp * 0.8 + Math.sin(input.t * 0.4) * 0.08 * (0.5 + amp), 8);
        camera.lookAt(camera.position.x * 0.5, 1.4, -30);
        camera.rotation.z += sway;
        camera.fov = 60 - input.beatPulse * input.bass * 2 * input.intensity;
        camera.updateProjectionMatrix();
      },
      reset() {
        amp = 0.3;
        ring = 0;
        uTravel.value = 0;
      },
    };
  },
});
