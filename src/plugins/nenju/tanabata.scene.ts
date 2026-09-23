import type * as T from 'three';
import { defineThreeScene } from '../api';

/**
 * 七夕 (July). Two bamboo stalks with leafy branches carry colourful tanzaku
 * (CanvasTexture wish kanji) and two fukinagashi streamers; overhead the Milky
 * Way is a dense river of twinkling points. Orihime (Vega) and Hikoboshi
 * (Altair) glide toward each other across the river over each bar and meet on
 * the downbeat, when a magpie bridge of sparks flares between them.
 */

const WISHES = ['願', '夢', '恋', '星', '幸', '笑', '祈', '光'];
// 五色 plus a few festive extras: [paper, ink]
const PAPERS: [string, string][] = [
  ['#2f5fb3', '#f6f1e4'],
  ['#c8323c', '#fff4e0'],
  ['#e8c040', '#3a2410'],
  ['#f4f0e6', '#20202a'],
  ['#6a3d9a', '#f6ecff'],
  ['#3f8f4f', '#f4fff0'],
  ['#e67fa0', '#3a1020'],
  ['#e8843a', '#2a1406'],
];
const RIBBON_COLS = [0x2f5fb3, 0xc8323c, 0xe8c040, 0xf4f0e6, 0x6a3d9a, 0xe67fa0];

function tanzakuTexture(THREE: typeof T, kanji: string, paper: string, ink: string): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 448;
  const x = c.getContext('2d')!;
  x.fillStyle = paper;
  x.fillRect(0, 0, 128, 448);
  // washi fibres
  x.globalAlpha = 0.08;
  x.fillStyle = ink;
  for (let i = 0; i < 60; i++) x.fillRect(Math.random() * 128, Math.random() * 448, 1 + Math.random() * 2, 6 + Math.random() * 20);
  x.globalAlpha = 1;
  x.strokeStyle = ink;
  x.globalAlpha = 0.35;
  x.lineWidth = 3;
  x.strokeRect(8, 8, 112, 432);
  x.globalAlpha = 1;
  // punch hole
  x.fillStyle = '#000000';
  x.beginPath();
  x.arc(64, 26, 6, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = ink;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 96px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
  x.fillText(kanji, 64, 200);
  x.font = '30px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
  x.fillText('七', 64, 330);
  x.fillText('夕', 64, 370);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(THREE: typeof T): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  // four-point flare
  x.globalCompositeOperation = 'lighter';
  const bars: [number, number][] = [
    [128, 3],
    [3, 128],
  ];
  for (const [w, h] of bars) {
    const lg = x.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = lg;
    x.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  return new THREE.CanvasTexture(c);
}

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aSel;
attribute float aSat;
attribute float aAlpha;
uniform float uTime;
uniform float uHigh;
uniform float uBoost;
uniform float uPx;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.7 + 0.3 * sin(uTime * (1.2 + aPhase * 3.0) + aPhase * 40.0);
  tw += uHigh * 0.9 * step(0.72, fract(aPhase * 7.31));
  vec3 pal = aSel < 0.5 ? uColA : (aSel < 1.5 ? uColB : uColC);
  vCol = mix(vec3(1.0, 0.97, 0.92), pal, aSat);
  vA = aAlpha * tw * (0.75 + uBoost * 0.6);
  gl_PointSize = aSize * uPx * (1.0 + uBoost * 0.35);
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vCol * vA * a, 1.0);
}`;

export default defineThreeScene({
  id: 'nenju_tanabata',
  name: 'Tanabata 3D (three.js)',
  month: 7,
  group: 'nenju',
  description:
    '七夕素材（3D）。夜空を見上げる構図で、笹に色とりどりの短冊（願・夢・恋などの文字入り）と吹き流しが下がり、風と低域でさらさら揺れる。頭上には天の川がきらめく星の帯となって流れ、高域で瞬きが増す。織姫と彦星の二つの明るい星が小節ごとに天の川を挟んで近づき、小節頭で出会うとかささぎの橋が光って天の川が輝く。ロマンチックできらびやかで、メロディアスなビルドや盛り上がっていく場面に向く',
  short: '7月・七夕（3D）。ロマンチック・きらめき。メロディアスなビルド',
  fov: 55,
  setup({ THREE, scene, camera, renderer }) {
    const fog = new THREE.Fog('#070a18', 12, 48);
    scene.fog = fog;

    scene.add(new THREE.HemisphereLight(0x5a70b0, 0x0c120c, 0.5));
    const moon = new THREE.DirectionalLight(0xbfd0ff, 0.5);
    moon.position.set(4, 10, -6);
    scene.add(moon);
    const lampA = new THREE.PointLight(0xffc080, 4, 12, 1.5);
    lampA.position.set(-2.2, 3.2, 1.8);
    const lampB = new THREE.PointLight(0xff90c0, 3, 12, 1.5);
    lampB.position.set(2.4, 5.4, 1.2);
    const starLight = new THREE.PointLight(0xa0c0ff, 2, 16, 1.2);
    starLight.position.set(0, 10.5, -1);
    scene.add(lampA, lampB, starLight);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: 0x0f1712, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // --- bamboo ---
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 0.45 });
    const nodeMat = new THREE.MeshStandardMaterial({ color: 0x4d7a2c, roughness: 0.5 });
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x6f9a44, roughness: 0.6 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a32, roughness: 0.5, side: THREE.DoubleSide });
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.075, 0.16, 0, 0.48);
    leafShape.quadraticCurveTo(-0.075, 0.16, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
    const segGeo = new THREE.CylinderGeometry(0.1, 0.115, 1, 12);
    const nodeGeo = new THREE.TorusGeometry(0.115, 0.018, 6, 16);

    interface Branch {
      g: T.Group;
      pitch: number;
      phase: number;
      len: number;
    }
    interface Anchor {
      branch: Branch;
      local: T.Vector3;
    }
    const stalks: T.Group[] = [];
    const branches: Branch[] = [];
    const anchors: Anchor[] = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();

    const STALK_H = 9.6;
    const SEGS = 11;
    for (const [sx, sz, lean, yaw0] of [
      [-0.5, 0.2, 0.06, 0],
      [0.6, -0.3, -0.08, 1.9],
    ] as [number, number, number, number][]) {
      const stalk = new THREE.Group();
      stalk.position.set(sx, 0, sz);
      stalk.rotation.z = lean;
      stalk.userData.lean = lean;
      const segLen = STALK_H / SEGS;
      for (let i = 0; i < SEGS; i++) {
        const seg = new THREE.Mesh(segGeo, stalkMat);
        const taper = 1 - (i / SEGS) * 0.55;
        seg.scale.set(taper, segLen, taper);
        seg.position.y = segLen * (i + 0.5);
        stalk.add(seg);
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.rotation.x = Math.PI / 2;
        node.scale.setScalar(taper);
        node.position.y = segLen * (i + 1);
        stalk.add(node);
      }
      // branches from the upper half, spiralling round the stalk
      const NB = 9;
      for (let b = 0; b < NB; b++) {
        const g = new THREE.Group();
        g.rotation.order = 'YXZ';
        const y = STALK_H * (0.38 + (b / NB) * 0.58);
        g.position.y = y;
        g.rotation.y = yaw0 + b * 2.35;
        const pitch = 0.95 + Math.random() * 0.35 - (b / NB) * 0.3;
        g.rotation.z = -pitch;
        const len = 2.4 - (b / NB) * 1.2 + Math.random() * 0.3;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, len, 5), branchMat);
        stick.position.y = len / 2;
        g.add(stick);
        const NL = 24;
        const lv = new THREE.InstancedMesh(leafGeo, leafMat, NL);
        for (let k = 0; k < NL; k++) {
          const u = 0.2 + (k / NL) * 0.85;
          v.set((Math.random() - 0.5) * 0.06, u * len, (Math.random() - 0.5) * 0.06);
          // leaves fan out sideways and droop toward the ground
          e.set(Math.PI * 0.55 + (Math.random() - 0.5) * 0.7, (k % 2 === 0 ? 1 : -1) * (0.7 + Math.random() * 0.6), pitch + (Math.random() - 0.5) * 0.5, 'YXZ');
          q.setFromEuler(e);
          sc.setScalar(0.8 + Math.random() * 0.5);
          m4.compose(v, q, sc);
          lv.setMatrixAt(k, m4);
        }
        g.add(lv);
        stalk.add(g);
        const br: Branch = { g, pitch, phase: Math.random() * 6.28, len };
        branches.push(br);
        const nT = b < 2 ? 1 : 2 + (b % 2);
        for (let k = 0; k < nT; k++) anchors.push({ branch: br, local: new THREE.Vector3(0, len * (0.4 + (k / Math.max(1, nT)) * 0.55 + Math.random() * 0.08), 0) });
      }
      // crown leaves
      const crown = new THREE.InstancedMesh(leafGeo, leafMat, 30);
      for (let k = 0; k < 30; k++) {
        v.set((Math.random() - 0.5) * 0.2, STALK_H - Math.random() * 0.6, (Math.random() - 0.5) * 0.2);
        e.set(0.4 + Math.random() * 1.6, Math.random() * Math.PI * 2, 0, 'YXZ');
        q.setFromEuler(e);
        sc.setScalar(0.9 + Math.random() * 0.6);
        m4.compose(v, q, sc);
        crown.setMatrixAt(k, m4);
      }
      stalk.add(crown);
      scene.add(stalk);
      stalks.push(stalk);
    }

    // --- tanzaku (hang vertically from branch anchors) ---
    const tanzakuMats = WISHES.map((w, i) => {
      const [paper, ink] = PAPERS[i % PAPERS.length]!;
      const tex = tanzakuTexture(THREE, w, paper, ink);
      return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.8, side: THREE.DoubleSide });
    });
    const tanzakuGeo = new THREE.PlaneGeometry(0.17, 0.6);
    const stringGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xe8e0c8 });
    interface Tanzaku {
      pivot: T.Group;
      anchor: Anchor;
      th: number;
      om: number;
      ph: number;
      twist: number;
    }
    // two anchors become streamers, the rest tanzaku
    const streamerAnchors: Anchor[] = [];
    const tanzaku: Tanzaku[] = [];
    anchors.forEach((a, i) => {
      if ((i === 5 || i === anchors.length - 7) && streamerAnchors.length < 2) {
        streamerAnchors.push(a);
        return;
      }
      const pivot = new THREE.Group();
      const str = new THREE.Mesh(stringGeo, stringMat);
      str.position.y = -0.07;
      pivot.add(str);
      const card = new THREE.Mesh(tanzakuGeo, tanzakuMats[i % tanzakuMats.length]!);
      card.position.y = -0.14 - 0.3;
      pivot.add(card);
      pivot.rotation.order = 'YXZ';
      scene.add(pivot);
      tanzaku.push({ pivot, anchor: a, th: 0, om: 0, ph: Math.random() * 6.28, twist: Math.random() * 6.28 });
    });

    // --- fukinagashi streamers: kusudama ball + ribbons updated on the CPU ---
    interface Streamer {
      g: T.Group;
      anchor: Anchor;
      geo: T.BufferGeometry;
      pos: Float32Array;
      ph: number;
    }
    const R = 14;
    const S = 18;
    const L = 2.3;
    const RW = 0.075;
    const ribbonMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xffffff });
    const ballMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, emissive: 0x332211 });
    const ribPhase = new Float32Array(R);
    for (let r = 0; r < R; r++) ribPhase[r] = Math.random() * 6.28;
    const streamers: Streamer[] = [];
    for (const anchor of streamerAnchors) {
      const g = new THREE.Group();
      const ballGeo = new THREE.IcosahedronGeometry(0.26, 1).toNonIndexed();
      const bc = new Float32Array(ballGeo.attributes.position!.count * 3);
      const tc = new THREE.Color();
      for (let f = 0; f < bc.length / 9; f++) {
        tc.setHex(f % 3 === 0 ? 0xe6c45a : RIBBON_COLS[Math.floor(Math.random() * RIBBON_COLS.length)]!);
        for (let k = 0; k < 3; k++) bc.set([tc.r, tc.g, tc.b], f * 9 + k * 3);
      }
      ballGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.y = -0.3;
      g.add(ball);
      const pos = new Float32Array(R * (S + 1) * 2 * 3);
      const colr = new Float32Array(pos.length);
      const idx: number[] = [];
      for (let r = 0; r < R; r++) {
        tc.setHex(RIBBON_COLS[r % RIBBON_COLS.length]!);
        for (let j = 0; j <= S; j++) {
          const base = (r * (S + 1) + j) * 2;
          colr.set([tc.r, tc.g, tc.b, tc.r, tc.g, tc.b], base * 3);
          if (j < S) {
            const a0 = base;
            const a1 = base + 1;
            const b0 = base + 2;
            const b1 = base + 3;
            idx.push(a0, b0, a1, a1, b0, b1);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      geo.setIndex(idx);
      const ribbons = new THREE.Mesh(geo, ribbonMat);
      ribbons.frustumCulled = false;
      ribbons.position.y = -0.48;
      g.add(ribbons);
      scene.add(g);
      streamers.push({ g, anchor, geo, pos, ph: Math.random() * 6.28 });
    }

    // --- sky: Milky Way band, glow, background stars (one Points, custom shader) ---
    const sky = new THREE.Group();
    scene.add(sky);
    const SKY_R = 60;
    const C = new THREE.Vector3(0, 0.616, -0.788).normalize();
    const V = new THREE.Vector3(0.55, 0.8, 0.62);
    V.addScaledVector(C, -V.dot(C)).normalize();
    const N = new THREE.Vector3().crossVectors(C, V).normalize();
    const BAND = 2200;
    const GLOW = 150;
    const BG = 350;
    const NS = BAND + GLOW + BG;
    const sPos = new Float32Array(NS * 3);
    const sSize = new Float32Array(NS);
    const sPhase = new Float32Array(NS);
    const sSel = new Float32Array(NS);
    const sSat = new Float32Array(NS);
    const sAlpha = new Float32Array(NS);
    const gauss = (): number => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < NS; i++) {
      if (i < BAND + GLOW) {
        const glow = i >= BAND;
        const th = (Math.random() * 2 - 1) * 1.55;
        const width = (glow ? 0.07 : 0.11) * (1 + 0.45 * Math.sin(th * 3.1 + 0.7));
        const w = gauss() * width;
        v.copy(C).multiplyScalar(Math.cos(th)).addScaledVector(V, Math.sin(th)).addScaledVector(N, w).normalize();
        sSize[i] = glow ? 38 + Math.random() * 40 : 1.2 + Math.random() * Math.random() * 3.2;
        sAlpha[i] = glow ? 0.05 + Math.random() * 0.05 : 0.5 + Math.random() * 0.5;
        sSat[i] = glow ? 0.7 : Math.random() * 0.55;
      } else {
        const az = Math.random() * Math.PI * 2;
        const el = Math.asin(Math.random() * 0.95 + 0.03);
        v.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
        sSize[i] = 1.2 + Math.random() * Math.random() * 3.5;
        sAlpha[i] = 0.4 + Math.random() * 0.6;
        sSat[i] = Math.random() * 0.3;
      }
      sPos[i * 3] = v.x * SKY_R;
      sPos[i * 3 + 1] = v.y * SKY_R;
      sPos[i * 3 + 2] = v.z * SKY_R;
      sPhase[i] = Math.random();
      sSel[i] = Math.floor(Math.random() * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
    starGeo.setAttribute('aSel', new THREE.BufferAttribute(sSel, 1));
    starGeo.setAttribute('aSat', new THREE.BufferAttribute(sSat, 1));
    starGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
    const starU = {
      uTime: { value: 0 },
      uHigh: { value: 0 },
      uBoost: { value: 0 },
      uPx: { value: 1 },
      uColA: { value: new THREE.Color() },
      uColB: { value: new THREE.Color() },
      uColC: { value: new THREE.Color() },
    };
    const starMat = new THREE.ShaderMaterial({
      uniforms: starU,
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.frustumCulled = false;
    sky.add(stars);

    // --- Orihime (Vega) and Hikoboshi (Altair) ---
    const glowTex = glowTexture(THREE);
    const mkStar = (): T.Sprite => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sky.add(s);
      return s;
    };
    const orihime = mkStar();
    const hikoboshi = mkStar();
    const C0 = new THREE.Vector3().copy(C).multiplyScalar(Math.cos(0.1)).addScaledVector(V, Math.sin(0.1)).normalize();
    const dirA = new THREE.Vector3();
    const dirB = new THREE.Vector3();
    // magpie bridge between them
    const BRIDGE = 90;
    const bPos = new Float32Array(BRIDGE * 3);
    const bridgeGeo = new THREE.BufferGeometry();
    bridgeGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    const bridgeMat = new THREE.PointsMaterial({ map: glowTex, size: 14, sizeAttenuation: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const bridge = new THREE.Points(bridgeGeo, bridgeMat);
    bridge.frustumCulled = false;
    sky.add(bridge);
    const bJit = new Float32Array(BRIDGE);
    for (let i = 0; i < BRIDGE; i++) bJit[i] = (Math.random() - 0.5) * 2;

    // --- glitter drifting down around the bamboo ---
    const DUST = 260;
    const dPos = new Float32Array(DUST * 3);
    const dCol = new Float32Array(DUST * 3);
    const dVel = new Float32Array(DUST);
    const dSel = new Uint8Array(DUST);
    for (let i = 0; i < DUST; i++) {
      dPos[i * 3] = (Math.random() - 0.5) * 9;
      dPos[i * 3 + 1] = Math.random() * 10;
      dPos[i * 3 + 2] = (Math.random() - 0.5) * 9;
      dVel[i] = 0.2 + Math.random() * 0.45;
      dSel[i] = Math.floor(Math.random() * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
    const dustMat = new THREE.PointsMaterial({ map: glowTex, size: 0.22, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // --- per-frame scratch ---
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const white = new THREE.Color(0xffffff);
    const warm = new THREE.Color(0xffc080);
    const vegaBase = new THREE.Color(0xdfe8ff);
    const altairBase = new THREE.Color(0xfff0d8);
    const bufSize = new THREE.Vector2();
    const wp = new THREE.Vector3();
    const smooth = (x: number): number => x * x * (3 - 2 * x);
    let lastBeat = -1;
    let lastBar = -1;
    let flash = 0;

    // integrated phases: an intensity change never makes the camera jump
    let camPh = 0;
    let colPh = 0;
    return {
      update(input) {
        const t = input.t;
        const dt = Math.min(input.dt, 0.05);
        const I = input.intensity;
        cA.set(input.palette.a);
        cB.set(input.palette.b);
        cC.set(input.palette.c);
        fog.color.set(input.palette.bg);

        const newBeat = input.beat !== lastBeat && lastBeat >= 0;
        const newBar = input.bar !== lastBar && lastBar >= 0;
        lastBeat = input.beat;
        lastBar = input.bar;
        if (newBar) flash = 1;
        flash *= Math.exp(-dt * 2.6);

        // camera circles the bamboo looking up; the sky turns with it so the river stays overhead
        camPh += dt * (0.035 + I * 0.09);
        const orbit = camPh;
        const radius = 8.6 - input.beatPulse * 0.3 * I - flash * 0.35 * I;
        camera.fov = 55 - flash * 1.6 * I;
        camera.updateProjectionMatrix();
        camera.position.set(Math.sin(orbit) * radius, 1.3 + Math.sin(t * 0.13) * 0.3, Math.cos(orbit) * radius);
        camera.lookAt(0, 5.3 + Math.sin(t * 0.07) * 0.4, 0);
        sky.position.copy(camera.position);
        sky.rotation.y = orbit + Math.sin(t * 0.05) * 0.06;

        // bamboo sways in the breeze, branches flutter with the bass
        const wind = Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.91 + 1.3) * 0.3;
        const amp = 0.25 + I * 0.75;
        for (let i = 0; i < stalks.length; i++) {
          const s = stalks[i]!;
          s.rotation.z = (s.userData.lean as number) + wind * 0.02 * amp + Math.sin(t * 0.6 + i) * 0.008;
          s.rotation.x = Math.sin(t * 0.43 + i * 2) * 0.012 * amp;
        }
        for (const b of branches) {
          b.g.rotation.z = -b.pitch + Math.sin(t * 1.1 + b.phase) * 0.05 * amp + input.bass * 0.05 * amp;
          b.g.rotation.x = Math.sin(t * 1.7 + b.phase * 1.3) * 0.04 * amp;
        }
        for (const s of stalks) s.updateMatrixWorld(true);

        // tanzaku: hang from their anchors, damped swing, flutter on the beat
        const kick = newBeat ? 0.6 + I * 1.4 : 0;
        const barKick = newBar ? 1 + I * 1.5 : 0;
        for (const tz of tanzaku) {
          wp.copy(tz.anchor.local);
          tz.anchor.branch.g.localToWorld(wp);
          tz.pivot.position.copy(wp);
          tz.om += (-18 * tz.th - tz.om * 2.2) * dt + (wind * 0.6 + Math.sin(t * 2.1 + tz.ph) * 0.4) * amp * dt;
          if (kick) tz.om += kick * (Math.sin(tz.ph + input.beat) > 0 ? 1 : -1) * 0.8;
          if (barKick) tz.om += barKick * 0.6;
          tz.th += tz.om * dt;
          tz.th = Math.max(-0.8, Math.min(0.8, tz.th));
          tz.twist += dt * (0.2 + I * 0.5) + Math.abs(tz.om) * dt * 0.3;
          tz.pivot.rotation.y = Math.sin(tz.twist + tz.ph) * 1.2 + sky.rotation.y;
          tz.pivot.rotation.x = tz.th;
          tz.pivot.rotation.z = Math.sin(t * 1.3 + tz.ph) * 0.05 * amp;
        }
        const sparkle = 0.18 + input.high * 0.7 + flash * 0.35 * (0.4 + I);
        for (const m of tanzakuMats) m.emissiveIntensity = sparkle;

        // streamers ripple with the bass
        colPh += dt * (0.15 + I * 0.3);
        const rAmp = (0.08 + input.bass * 0.3 + input.beatPulse * 0.08 * I) * (0.4 + amp);
        for (const st of streamers) {
          wp.copy(st.anchor.local);
          st.anchor.branch.g.localToWorld(wp);
          st.g.position.copy(wp);
          st.g.rotation.y = colPh + st.ph;
          const p = st.pos;
          for (let r = 0; r < R; r++) {
            const a = (r / R) * Math.PI * 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const ph = ribPhase[r]!;
            for (let j = 0; j <= S; j++) {
              const d = j / S;
              const dd = Math.pow(d, 1.3);
              const x = ca * (0.18 + d * 0.12) + Math.sin(t * 2.3 + d * 5 + ph) * rAmp * dd + wind * 0.25 * dd * amp;
              const z = sa * (0.18 + d * 0.12) + Math.cos(t * 1.9 + d * 4.2 + ph) * rAmp * 0.8 * dd;
              const y = -d * L;
              const o = (r * (S + 1) + j) * 6;
              p[o] = x - sa * RW;
              p[o + 1] = y;
              p[o + 2] = z + ca * RW;
              p[o + 3] = x + sa * RW;
              p[o + 4] = y;
              p[o + 5] = z - ca * RW;
            }
          }
          (st.geo.attributes.position as T.BufferAttribute).needsUpdate = true;
        }
        const lit = 0.55 + input.bass * 0.35 + flash * 0.15;
        ribbonMat.color.setScalar(lit);

        // lights breathe with the bass, tinted by the palette
        const glow = 0.5 + input.bass * 1.3 + input.beatPulse * 0.5 * I;
        lampA.color.copy(warm).lerp(cA, 0.45);
        lampA.intensity = 2.5 + glow * 3.5;
        lampB.color.copy(cB).lerp(white, 0.25);
        lampB.intensity = 2 + glow * 3;
        starLight.color.copy(cC).lerp(white, 0.4);
        starLight.intensity = 1.5 + input.high * 3 + flash * 4;

        // Milky Way twinkles; it flares when the lovers meet
        renderer.getDrawingBufferSize(bufSize);
        starU.uTime.value = t;
        starU.uHigh.value = input.high;
        starU.uBoost.value = flash * (0.5 + I * 0.8);
        starU.uPx.value = Math.max(0.5, bufSize.y / 900);
        starU.uColA.value.copy(cA);
        starU.uColB.value.copy(cB);
        starU.uColC.value.copy(cC);

        // Orihime and Hikoboshi: part just after the downbeat, glide together over the bar
        const bp = input.barPhase;
        const approach = bp < 0.12 ? 1 - smooth(bp / 0.12) : smooth((bp - 0.12) / 0.88);
        const sep = 0.27 + (0.035 + 0.04 * (1 - I) - 0.27) * approach;
        dirA.copy(C0).addScaledVector(N, sep).normalize();
        dirB.copy(C0).addScaledVector(N, -sep).normalize();
        orihime.position.copy(dirA).multiplyScalar(50);
        hikoboshi.position.copy(dirB).multiplyScalar(50);
        const pulse = 1 + input.beatPulse * 0.35 + flash * 0.8 + input.high * 0.2;
        orihime.scale.setScalar(3.2 * pulse);
        hikoboshi.scale.setScalar(3.0 * pulse);
        orihime.material.color.copy(vegaBase).lerp(cA, 0.35);
        hikoboshi.material.color.copy(altairBase).lerp(cB, 0.35);
        orihime.material.rotation = t * 0.1;
        hikoboshi.material.rotation = -t * 0.1;

        // magpie bridge: an arc of sparks that shows around the meeting
        const bridgeA = Math.max(flash, (approach - 0.8) * 2.5) * (0.35 + 0.65 * I);
        bridgeMat.opacity = Math.min(1, bridgeA);
        bridge.visible = bridgeMat.opacity > 0.01;
        if (bridge.visible) {
          bridgeMat.color.copy(cC).lerp(white, 0.35);
          const bulge = sep * 0.9 + 0.03;
          for (let i = 0; i < BRIDGE; i++) {
            const u = i / (BRIDGE - 1);
            wp.copy(dirA).lerp(dirB, u).addScaledVector(V, Math.sin(Math.PI * u) * bulge + bJit[i]! * 0.006 * (1 + input.high * 2)).normalize().multiplyScalar(49);
            bPos[i * 3] = wp.x;
            bPos[i * 3 + 1] = wp.y;
            bPos[i * 3 + 2] = wp.z;
          }
          (bridgeGeo.attributes.position as T.BufferAttribute).needsUpdate = true;
        }

        // glitter drifts down, sparkling in palette colours
        const fall = 0.6 + I * 0.8;
        const tw = 0.5 + input.high * 0.9 + flash * 0.5;
        for (let i = 0; i < DUST; i++) {
          let y = dPos[i * 3 + 1]! - dVel[i]! * fall * dt;
          if (y < 0) y += 10;
          dPos[i * 3 + 1] = y;
          dPos[i * 3] = dPos[i * 3]! + Math.sin(t * 0.8 + i) * dt * 0.15;
          const s = dSel[i]!;
          const c = s === 0 ? cA : s === 1 ? cB : cC;
          const k = tw * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7));
          dCol[i * 3] = c.r * k;
          dCol[i * 3 + 1] = c.g * k;
          dCol[i * 3 + 2] = c.b * k;
        }
        (dustGeo.attributes.position as T.BufferAttribute).needsUpdate = true;
        (dustGeo.attributes.color as T.BufferAttribute).needsUpdate = true;
      },
      reset() {
        lastBeat = -1;
        lastBar = -1;
        flash = 0;
        for (const tz of tanzaku) {
          tz.th = 0;
          tz.om = 0;
        }
      },
    };
  },
});
