import * as THREE from 'three';
import type { RenderInput, Scene } from '../types';
import { GlContext } from './context';
import { makeShaderScene } from './shader-scene';
import { makeHinaDan3d } from './hina3d';
import { makeAudioUniforms, updateAudioUniforms, type BeatCounter } from './uniforms';
import common from './shaders/common.glsl?raw';
import warpFrag from './shaders/warp.frag?raw';
import latticeFrag from './shaders/lattice.frag?raw';
import juliaFrag from './shaders/julia.frag?raw';
import voronoiFrag from './shaders/voronoi.frag?raw';
import mochiFrag from './shaders/mochi.frag?raw';
import seigaihaFrag from './shaders/seigaiha.frag?raw';

const frag = (body: string): string => `${common}\n${body}`;

export const warp = makeShaderScene({
  id: 'warp',
  group: 'gl',
  name: 'Warp (GLSL)',
  description: '流体のように歪む煙とインクの模様。有機的でサイケデリック、低域で歪みが深まる。ディープな進行やブレイクダウンに合う',
  frag: frag(warpFrag),
});

export const lattice = makeShaderScene({
  id: 'lattice',
  group: 'gl',
  name: 'Lattice (GLSL)',
  description: '無限に続く3D格子の中を突き進むレイマーチ。速度と回転が音圧に連動し、前進感が強い。ビルドアップやドロップに合う',
  frag: frag(latticeFrag),
});

export const julia = makeShaderScene({
  id: 'julia',
  group: 'gl',
  name: 'Julia (GLSL)',
  description: 'フラクタル（ジュリア集合）が呼吸するように変形しズームする。幾何学的で催眠的。安定した進行やディープな場面に合う',
  frag: frag(juliaFrag),
});

export const voronoi = makeShaderScene({
  id: 'voronoi',
  group: 'gl',
  name: 'Voronoi (GLSL)',
  description: '細胞状のセルがビートでランダムに点灯し、境界線が高域で光る。硬質でデジタル。テクノ寄りの進行やドロップに合う',
  frag: frag(voronoiFrag),
});

// ------------------------------------------------------------- galaxy (points)
const GALAXY_VERT = /* glsl */ `
uniform float uTime, uBass, uSub, uEnergy, uBeatPulse, uIntensity;
attribute vec4 aSeed; // radius, angle, height, random
varying float vR;
varying float vRnd;
void main() {
  float r = aSeed.x;
  float spin = uTime * (0.08 + uIntensity * 0.25) / (0.25 + r);
  float arm = floor(aSeed.w * 3.0) * 2.0943951;
  float a = aSeed.y * 0.35 + arm + r * 2.2 + spin;
  float rr = r * (2.6 + uBass * 0.5 + uBeatPulse * 0.25 * uIntensity);
  vec3 p = vec3(cos(a) * rr, aSeed.z * (1.0 - r) * 0.5 + sin(uTime * 0.5 + aSeed.w * 6.28) * 0.03 * uSub, sin(a) * rr);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.7 + uEnergy * 1.3 + uBeatPulse * 0.9) * (64.0 / -mv.z);
  vR = r;
  vRnd = aSeed.w;
}
`;
const GALAXY_FRAG = /* glsl */ `
uniform vec3 uColA, uColB, uColC;
uniform float uBeatPulse, uHigh;
varying float vR;
varying float vRnd;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float m = smoothstep(0.5, 0.05, length(d));
  vec3 col = mix(uColA, uColB, vR);
  float flash = step(0.97 - uHigh * 0.05, vRnd) * uBeatPulse;
  col = mix(col, uColC, flash);
  gl_FragColor = vec4(col * m * (0.12 + 0.3 * (1.0 - vR)) * (1.0 + flash * 2.0), m * 0.6);
}
`;

function makeGalaxy(): Scene {
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  const uniforms = makeAudioUniforms();
  const bc: BeatCounter = { count: 0, wasHigh: false };
  const ensure = (): void => {
    if (scene) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    const n = 60000;
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const r = Math.pow(Math.random(), 0.6);
      seeds[i * 4] = r;
      seeds[i * 4 + 1] = (Math.random() - 0.5) * 2 * Math.PI;
      seeds[i * 4 + 2] = (Math.random() - 0.5) * 2 * Math.pow(Math.random(), 2);
      seeds[i * 4 + 3] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: GALAXY_VERT,
      fragmentShader: GALAXY_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(geo, mat));
  };
  return {
    id: 'galaxy',
    group: 'gl',
    name: 'Galaxy (three.js)',
    description: '6万個の粒子が銀河のように渦を巻き、ビートで広がり低域で膨らむ。壮大で浮遊感がある。ブレイクダウンからの盛り上がりや、深いグルーヴに合う',
    render(ctx, input) {
      ensure();
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      updateAudioUniforms(uniforms, input, gl.w, gl.h, bc);
      camera!.aspect = gl.w / gl.h;
      camera!.updateProjectionMatrix();
      const orbit = input.t * (0.05 + input.intensity * 0.2);
      const tilt = 0.9 + Math.sin(input.t * 0.1) * 0.3;
      camera!.position.set(Math.sin(orbit) * 5.2, 1.4 + tilt, Math.cos(orbit) * 5.2);
      camera!.lookAt(0, 0, 0);
      gl.renderer.setClearColor(new THREE.Color(input.palette.bg), 1);
      gl.renderer.render(scene!, camera!);
      gl.blit(ctx, input.w, input.h);
    },
  };
}

// ---------------------------------------------------------- terrain (wireframe)
function makeTerrain(): Scene {
  const cols = 72;
  const rows = 56;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  let sun: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null = null;
  let heights = new Float32Array(cols * rows);
  let lastRowT = 0;
  const ensure = (): void => {
    if (scene) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 60);
    const geo = new THREE.PlaneGeometry(10, 14, cols - 1, rows - 1);
    mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true }));
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    sun = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    sun.position.set(0, 1.6, -8);
    scene.add(sun);
    scene.fog = new THREE.Fog('#000000', 3, 16);
  };
  const pushRow = (input: RenderInput): void => {
    // shift everything one row toward the camera, then write a fresh far row from the waveform
    heights.copyWithin(cols, 0, cols * (rows - 1));
    const wave = input.wave;
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const wi = Math.floor(u * (wave.length - 1));
      let s = 0;
      for (let k = -6; k <= 6; k++) s += Math.abs(wave[Math.min(wave.length - 1, Math.max(0, wi + k))] ?? 0);
      const ridge = Math.exp(-Math.pow((u - 0.5) * 3.2, 2)); // keep a valley in the middle
      heights[c] = (s / 13) * (1.2 + input.energy * 3.5) * (1.2 - ridge) + input.bass * 0.3 * (1 - ridge) + input.beatPulse * 0.2;
    }
  };
  return {
    id: 'terrain',
    group: 'gl',
    name: 'Terrain (three.js)',
    description: '波形が作る地形の上を飛ぶワイヤーフレームと地平線の太陽。レトロでシンセウェーブ的。中程度の強さ、安定した進行やメロディックな場面に合う',
    render(ctx, input) {
      ensure();
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      const rowInterval = 1 / (18 + input.intensity * 30);
      if (input.t - lastRowT > rowInterval) {
        lastRowT = input.t;
        pushRow(input);
      }
      const pos = mesh!.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < cols * rows; i++) pos.setZ(i, heights[i]!);
      pos.needsUpdate = true;
      mesh!.material.color.set(input.palette.a);
      sun!.material.color.set(input.palette.b);
      sun!.scale.setScalar(1 + input.sub * 0.25 + input.beatPulse * 0.1);
      (scene!.fog as THREE.Fog).color.set(input.palette.bg);
      camera!.aspect = gl.w / gl.h;
      camera!.updateProjectionMatrix();
      camera!.position.set(Math.sin(input.t * 0.2) * 0.6, 1.7 + input.bass * 0.2, 7.2);
      camera!.lookAt(0, 0.6 + input.intensity * 0.4, -4);
      gl.renderer.setClearColor(new THREE.Color(input.palette.bg), 1);
      gl.renderer.render(scene!, camera!);
      gl.blit(ctx, input.w, input.h);
    },
  };
}

export const hinaMochi = makeShaderScene({
  id: 'hina_mochi',
  group: 'hina',
  month: 3,
  name: 'Hishimochi (GLSL)',
  description: 'ひな祭り素材。菱餅の三色（桃・白・緑）の菱形タイルが流れ、ビートでめくれて縁が光る。ポップで硬質。ドロップや安定した進行に合う',
  frag: frag(mochiFrag),
});

export const seigaiha = makeShaderScene({
  id: 'seigaiha',
  group: 'hina',
  name: 'Seigaiha (GLSL)',
  description: 'ひな祭り素材。青海波の和文様が上へ流れ、低域で波紋が呼吸し、ビートで一つの波が光る。落ち着いた和の雰囲気。イントロやブレイクダウン、静かな場面に合う',
  frag: frag(seigaihaFrag),
});

export const galaxy = makeGalaxy();
export const terrain = makeTerrain();
export const hinaDan3d = makeHinaDan3d();
export const GL_SCENES: Scene[] = [warp, lattice, julia, voronoi, galaxy, terrain, hinaMochi, seigaiha, hinaDan3d];
