import { defineThreeScene } from '../api';

/**
 * 端午の節句 (May): a tall pole against a blue sky flying 吹き流し, 真鯉, 緋鯉
 * and two 子鯉, with a 矢車 spinning at the top faster as the energy rises and
 * a gold ball finial. The carp are open tubes deformed in the vertex shader:
 * a travelling ripple whose size follows the bass, a droop that lifts as the
 * wind (intensity + energy) picks up, and a beat bulge. A lacquered 兜 with
 * gold 鍬形 sits on a red stand in the foreground among iris leaves.
 * Signature moment: on every beat a puff of wind enters each carp's mouth and
 * travels to the tail as a swelling of the body, the 矢車 kicks; on the bar
 * downbeat the 鍬形 flashes gold.
 */

type T3 = typeof import('three');

const WIND_COMMON = /* glsl */ `
uniform float uTime, uAmp, uFreq, uSpeed, uPhase, uLen, uSag, uGustPos, uGustAmt;
vec3 windOff(float x) {
  float u = clamp(x / uLen, 0.0, 1.3);
  float w = u * u * 0.6 + u * 0.4;
  float a = uTime * uSpeed + uPhase;
  float y = sin(u * uFreq - a) * uAmp * w - uSag * u * u * uLen;
  float z = sin(u * uFreq * 0.7 - a * 0.8 + 1.3) * uAmp * 0.6 * w;
  return vec3(0.0, y, z);
}
float windBulge(float x) {
  float u = clamp(x / uLen, 0.0, 1.3);
  float d = (u - uGustPos) * 5.0;
  return 1.0 + uGustAmt * exp(-d * d) + 0.04 * sin(u * 9.0 - uTime * uSpeed * 1.7 + uPhase);
}
`;

interface WindUniforms {
  uTime: { value: number };
  uAmp: { value: number };
  uFreq: { value: number };
  uSpeed: { value: number };
  uPhase: { value: number };
  uLen: { value: number };
  uSag: { value: number };
  uGustPos: { value: number };
  uGustAmt: { value: number };
}

function windMaterial(THREE: T3, params: import('three').MeshStandardMaterialParameters, u: WindUniforms): import('three').MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...params });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_COMMON}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        {
          float e = uLen * 0.02;
          vec3 dd = (windOff(position.x + e) - windOff(position.x - e)) / (2.0 * e);
          objectNormal.x -= dot(objectNormal.yz, dd.yz);
          objectNormal = normalize(objectNormal);
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.yz *= windBulge(position.x);
        transformed += windOff(position.x);`,
      );
  };
  return m;
}

/** koinobori skin: body/belly/back gradient around, scale arcs, gill line and eyes by the mouth */
function koiTexture(THREE: T3, body: string, belly: string, back: string, ink: string): import('three').CanvasTexture {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // u: 0 = +z side, 0.25 = belly, 0.5 = -z side, 0.75 = back
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, body);
  grad.addColorStop(0.25, belly);
  grad.addColorStop(0.5, body);
  grad.addColorStop(0.75, back);
  grad.addColorStop(1, body);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // scales (canvas top = tail, bottom = mouth)
  g.strokeStyle = ink;
  g.lineWidth = 3;
  const rowH = 26;
  for (let row = 0, y = 40; y < 410; row++, y += rowH) {
    const off = row % 2 === 0 ? 0 : 16;
    for (let x = -32 + off; x < W + 32; x += 32) {
      g.beginPath();
      g.arc(x, y, 16, 0, Math.PI, false);
      g.stroke();
    }
  }
  // tail end fades
  const tail = g.createLinearGradient(0, 0, 0, 40);
  tail.addColorStop(0, back);
  tail.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = tail;
  g.fillRect(0, 0, W, 40);
  // face: gill arcs on both sides
  g.lineWidth = 7;
  g.strokeStyle = ink;
  for (const cx of [0, 128, 256]) {
    g.beginPath();
    g.arc(cx, 470, 56, Math.PI * 1.05, Math.PI * 1.95, false);
    g.stroke();
  }
  // eyes at u = 0 (wraps) and u = 0.5
  for (const cx of [0, 128, 256]) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx, 478, 20, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#e6b53a';
    g.stroke();
    g.fillStyle = '#111111';
    g.beginPath();
    g.arc(cx, 480, 10, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function fukinagashiTexture(THREE: T3): import('three').CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const cols = ['#1f55c8', '#d8202e', '#f2c21a', '#fafafa', '#1a1a20'];
  const n = cols.length * 2;
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i % cols.length]!;
    g.fillRect((i * 256) / n, 0, 256 / n + 1, 256);
  }
  // gold band at the mouth with a cloud-ish wave
  g.fillStyle = '#e6c45a';
  g.fillRect(0, 216, 256, 40);
  g.strokeStyle = '#b8862a';
  g.lineWidth = 3;
  for (let x = 0; x < 256; x += 32) {
    g.beginPath();
    g.arc(x + 16, 236, 10, Math.PI, 0);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dotTexture(THREE: T3): import('three').CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export default defineThreeScene({
  id: 'nenju_tango',
  name: 'Tango Koinobori 3D (three.js)',
  month: 5,
  group: 'nenju',
  description:
    '端午の節句素材（3D）。青空に高い竿が立ち、吹き流し・真鯉・緋鯉・子鯉が風に泳ぐ。鯉の胴は低域に合わせて波打ち、盛り上がるほど風が強まって垂れていた鯉が真横に泳ぎ出し、竿の先の矢車が勢いよく回る。ビートごとに風が鯉の口から尾へ吹き抜けて胴がふくらみ、小節頭には手前の兜の鍬形が金色に光る。カメラは見上げながらゆっくり回り込む。ビルドアップや明るく前向きな盛り上がりに向く',
  short: '5月・鯉のぼり（3D）。爽快・上昇感。ビルドアップ',
  fov: 52,
  setup({ THREE, scene, camera }) {
    // --- sky dome + fog to the horizon colour
    const skyU = {
      uTop: { value: new THREE.Color(0x2f7fe0) },
      uHor: { value: new THREE.Color(0xd6ecff) },
      uGnd: { value: new THREE.Color(0x9fc890) },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: skyU,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `uniform vec3 uTop, uHor, uGnd; varying vec3 vDir;
          void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(uHor, uTop, pow(clamp(y * 1.6, 0.0, 1.0), 0.7)) : mix(uHor, uGnd, clamp(-y * 6.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);
    const fog = new THREE.Fog(0xd6ecff, 40, 120);
    scene.fog = fog;

    // --- lights
    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a8a4a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.8);
    sun.position.set(8, 14, 10);
    scene.add(sun);
    const gleam = new THREE.PointLight(0xffd070, 0, 6, 1.5);
    scene.add(gleam);

    // --- ground, hills, clouds
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x5f9a3e, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 });
    for (const [x, z, s] of [[-40, -70, 22], [-5, -85, 30], [35, -75, 24], [70, -60, 18]] as const) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillMat);
      h.scale.set(s * 1.8, s * 0.45, s);
      h.position.set(x, -s * 0.1, z);
      scene.add(h);
    }
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.25 });
    const puffGeo = new THREE.SphereGeometry(1, 14, 10);
    const clouds: import('three').Group[] = [];
    for (let i = 0; i < 7; i++) {
      const cg = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const p = new THREE.Mesh(puffGeo, cloudMat);
        const s = 1.6 + Math.random() * 1.8;
        p.scale.set(s * 1.3, s * 0.8, s);
        p.position.set((k - 2) * 2.0 + Math.random(), Math.random() * 0.8 - (Math.abs(k - 2) * 0.4), Math.random() * 1.5);
        cg.add(p);
      }
      cg.position.set(-60 + i * 18 + Math.random() * 6, 16 + Math.random() * 10, -30 - Math.random() * 20);
      scene.add(cg);
      clouds.push(cg);
    }

    // --- the pole and its rig (turned a little so the carp stream toward the camera)
    const rig = new THREE.Group();
    rig.rotation.y = -0.35;
    scene.add(rig);
    const POLE_H = 14.2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, POLE_H, 12), new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.6 }));
    pole.position.y = POLE_H / 2;
    rig.add(pole);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe6c45a, metalness: 0.85, roughness: 0.28, emissive: 0x3a2a08 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), goldMat);
    ball.position.y = POLE_H + 0.5;
    rig.add(ball);

    // 矢車: eight arrows with coloured fletchings around a gold hub, spinning about the wind axis
    const yaguruma = new THREE.Group();
    yaguruma.position.y = POLE_H - 0.05;
    yaguruma.rotation.y = -0.9;
    rig.add(yaguruma);
    const wheel = new THREE.Group();
    yaguruma.add(wheel);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), goldMat);
    wheel.add(hub);
    const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6);
    const fletchGeo = new THREE.BoxGeometry(0.02, 0.32, 0.16);
    const fletchCols = [0xd8202e, 0xfafafa, 0x1f55c8, 0xf2c21a];
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
      const arm = new THREE.Group();
      arm.rotation.x = (i / 8) * Math.PI * 2;
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.position.y = 0.52;
      arm.add(shaft);
      const fl = new THREE.Mesh(fletchGeo, new THREE.MeshStandardMaterial({ color: fletchCols[i % 4]!, roughness: 0.6, side: THREE.DoubleSide }));
      fl.position.set(0, 0.8, 0.05);
      fl.rotation.x = 0.35;
      arm.add(fl);
      wheel.add(arm);
    }

    // --- windsocks: 吹き流し + carp
    const uTime = { value: 0 };
    interface Sock {
      group: import('three').Group;
      u: WindUniforms;
      len: number;
      flutter: number;
      droopMul: number;
      yaw: number;
    }
    const socks: Sock[] = [];
    const makeSock = (len: number, radius: number, y: number, map: import('three').Texture, finColor: number | null, flutter: number, phase: number): Sock => {
      const u: WindUniforms = {
        uTime,
        uAmp: { value: 0 },
        uFreq: { value: 7 },
        uSpeed: { value: 3 },
        uPhase: { value: phase },
        uLen: { value: len },
        uSag: { value: 0 },
        uGustPos: { value: 2 },
        uGustAmt: { value: 0 },
      };
      const geo = new THREE.CylinderGeometry(radius, radius, len, 24, 28, true);
      geo.rotateZ(-Math.PI / 2);
      geo.translate(len / 2, 0, 0);
      if (finColor !== null) {
        // carp body profile: mouth a bit narrow, fullest at a quarter, tapering to the tail
        const p = geo.attributes.position as import('three').BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          const uu = p.getX(i) / len;
          const f = uu < 0.25 ? 0.85 + 0.15 * Math.sin((uu / 0.25) * Math.PI * 0.5) : 1.0 - ((uu - 0.25) / 0.75) * 0.62;
          p.setY(i, p.getY(i) * f);
          p.setZ(i, p.getZ(i) * f);
        }
        geo.computeVertexNormals();
      }
      const group = new THREE.Group();
      group.position.set(0.12, y, 0);
      group.add(new THREE.Mesh(geo, windMaterial(THREE, { map, roughness: 0.55 }, u)));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * (finColor !== null ? 0.85 : 1.0), 0.03, 8, 28), goldMat);
      ring.rotation.y = Math.PI / 2;
      group.add(ring);
      const cordGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4);
      const cordL = new THREE.Mesh(cordGeo, shaftMat);
      cordL.rotation.z = Math.PI / 2;
      cordL.position.x = -0.08;
      group.add(cordL);
      if (finColor !== null) {
        // forked tail fin, deformed with the same wind as the body
        const r = radius * 0.38;
        const s = new THREE.Shape();
        s.moveTo(0, r * 0.9);
        s.quadraticCurveTo(len * 0.1, r * 1.6, len * 0.2, r * 2.6);
        s.quadraticCurveTo(len * 0.13, r * 0.6, len * 0.12, 0);
        s.quadraticCurveTo(len * 0.13, -r * 0.6, len * 0.2, -r * 2.6);
        s.quadraticCurveTo(len * 0.1, -r * 1.6, 0, -r * 0.9);
        s.closePath();
        const fg = new THREE.ShapeGeometry(s, 8);
        fg.translate(len - 0.05, 0, 0);
        const fin = new THREE.Mesh(fg, windMaterial(THREE, { color: finColor, roughness: 0.6 }, u));
        group.add(fin);
      }
      rig.add(group);
      const sk: Sock = { group, u, len, flutter, droopMul: 1, yaw: (Math.random() - 0.5) * 0.25 };
      socks.push(sk);
      return sk;
    };
    const fk = makeSock(5.0, 0.42, 12.9, fukinagashiTexture(THREE), null, 1.5, 0.0);
    fk.u.uFreq.value = 10;
    fk.droopMul = 1.3;
    makeSock(5.4, 0.56, 11.2, koiTexture(THREE, '#1c2233', '#e8e0cc', '#0a0c14', '#d4a83a'), 0x14161f, 1.0, 1.1); // 真鯉
    makeSock(4.4, 0.47, 9.5, koiTexture(THREE, '#e0283a', '#ffe4d6', '#a0101e', '#fff2d8'), 0xb8101e, 1.05, 2.3); // 緋鯉
    makeSock(3.5, 0.38, 8.0, koiTexture(THREE, '#2a6fe0', '#e4f0ff', '#18409a', '#ffffff'), 0x1a4fb0, 1.15, 3.6); // 子鯉 (青)
    makeSock(3.0, 0.33, 6.7, koiTexture(THREE, '#2aa860', '#e8ffe8', '#16703c', '#ffffff'), 0x178a48, 1.2, 4.7); // 子鯉 (緑)

    // --- 兜 on a red stand in the foreground
    const kabuto = new THREE.Group();
    kabuto.position.set(-3.5, 0, 8.6);
    kabuto.rotation.y = 0.45;
    kabuto.scale.setScalar(1.25);
    scene.add(kabuto);
    const redLacquer = new THREE.MeshStandardMaterial({ color: 0x8a0e1a, roughness: 0.3, metalness: 0.1 });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 1.3), redLacquer);
    stand.position.y = 0.18;
    kabuto.add(stand);
    const standTrim = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.04, 1.34), goldMat);
    standTrim.position.y = 0.36;
    kabuto.add(standTrim);
    const navy = new THREE.MeshStandardMaterial({ color: 0x1a2238, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
    const odoshi = new THREE.MeshStandardMaterial({ color: 0xc8401a, roughness: 0.55, side: THREE.DoubleSide });
    const base = 0.38 + 0.42; // bottom of the bowl
    // しころ: three flared bands around the back
    const bands: [number, number, number][] = [[0.56, 0.7, base], [0.68, 0.84, base - 0.13], [0.8, 0.96, base - 0.26]];
    bands.forEach(([rt, rb, y], i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 0.14, 28, 1, true, Math.PI / 4, Math.PI * 1.5), i === 1 ? odoshi : navy);
      b.position.y = y - 0.07;
      kabuto.add(b);
    });
    // 鉢 with gold ribs and a top rivet
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.56, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), navy);
    bowl.position.y = base;
    bowl.scale.y = 0.92;
    kabuto.add(bowl);
    const ribGeo = new THREE.TorusGeometry(0.565, 0.011, 4, 24, Math.PI);
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(ribGeo, goldMat);
      rib.position.y = base;
      rib.scale.y = 0.92;
      rib.rotation.y = (i / 6) * Math.PI;
      kabuto.add(rib);
    }
    const tehen = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 12), goldMat);
    tehen.position.y = base + 0.53;
    kabuto.add(tehen);
    // 眉庇 visor and 吹返し flaps
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.08, 24, 1, true, -Math.PI / 3, (Math.PI * 2) / 3), navy);
    visor.position.y = base - 0.02;
    kabuto.add(visor);
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.03), odoshi);
      flap.position.set(side * 0.66, base - 0.12, 0.38);
      flap.rotation.y = side * 0.95;
      flap.rotation.z = side * -0.25;
      kabuto.add(flap);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.035), goldMat);
      edge.position.set(side * 0.66, base - 0.0, 0.38);
      edge.rotation.y = side * 0.95;
      edge.rotation.z = side * -0.25;
      kabuto.add(edge);
    }
    // 鍬形: two tall gold horns + 前立 disc
    const kuwaMat = new THREE.MeshStandardMaterial({ color: 0xf0cc5a, metalness: 0.9, roughness: 0.22, emissive: 0xffc040, emissiveIntensity: 0.1, side: THREE.DoubleSide });
    const horn = new THREE.Shape();
    horn.moveTo(0.04, 0);
    horn.quadraticCurveTo(0.55, 0.15, 0.6, 1.25);
    horn.lineTo(0.5, 1.28);
    horn.quadraticCurveTo(0.42, 0.32, 0.02, 0.14);
    horn.closePath();
    const hornGeo = new THREE.ExtrudeGeometry(horn, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 16 });
    const kuwagata = new THREE.Group();
    kuwagata.position.set(0, base + 0.02, 0.56);
    kuwagata.rotation.x = -0.22;
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(hornGeo, kuwaMat);
      h.scale.x = side;
      kuwagata.add(h);
    }
    const maedate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 28), kuwaMat);
    maedate.rotation.x = Math.PI / 2;
    maedate.position.set(0, 0.2, 0.03);
    kuwagata.add(maedate);
    kabuto.add(kuwagata);
    gleam.position.set(-3.1, 2.6, 10.2);
    // 菖蒲 leaves and a few iris flowers behind the stand
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a32, roughness: 0.8 });
    const leafGeo = new THREE.ConeGeometry(0.07, 1.6, 4);
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x6a3aa8, roughness: 0.6 });
    const irisGeo = new THREE.SphereGeometry(0.1, 10, 8);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.z = 0.25;
      leaf.position.set(-0.9 + i * 0.22, 0.8, -0.75 - (i % 2) * 0.12);
      leaf.rotation.z = (i - 4) * 0.07;
      leaf.rotation.y = Math.random() * 0.6;
      kabuto.add(leaf);
      if (i % 3 === 1) {
        for (let k = 0; k < 3; k++) {
          const pet = new THREE.Mesh(irisGeo, irisMat);
          pet.scale.set(0.6, 1.3, 0.35);
          const a = (k / 3) * Math.PI * 2;
          pet.position.set(-0.9 + i * 0.22 + Math.sin(a) * 0.08, 1.6, -0.75 + Math.cos(a) * 0.08);
          pet.rotation.z = Math.sin(a) * 0.7;
          pet.rotation.x = Math.cos(a) * 0.7;
          kabuto.add(pet);
        }
      }
    }

    // --- wind streaks drifting across the sky
    const STREAKS = 600;
    const sPos = new Float32Array(STREAKS * 3);
    const sSpd = new Float32Array(STREAKS);
    for (let i = 0; i < STREAKS; i++) {
      sPos[i * 3] = (Math.random() - 0.5) * 50;
      sPos[i * 3 + 1] = 1 + Math.random() * 18;
      sPos[i * 3 + 2] = (Math.random() - 0.5) * 22;
      sSpd[i] = 0.6 + Math.random() * 0.8;
    }
    const sGeo = new THREE.BufferGeometry();
    const sAttr = new THREE.BufferAttribute(sPos, 3);
    sAttr.setUsage(THREE.DynamicDrawUsage);
    sGeo.setAttribute('position', sAttr);
    const sMat = new THREE.PointsMaterial({ size: 0.12, map: dotTexture(THREE), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    const streaks = new THREE.Points(sGeo, sMat);
    streaks.frustumCulled = false;
    scene.add(streaks);

    // --- per-frame scratch
    const cPal = new THREE.Color();
    const cSkyTop = new THREE.Color(0x2f7fe0);
    const cSkyHor = new THREE.Color(0xd6ecff);
    const cWhite = new THREE.Color(0xffffff);
    const cGold = new THREE.Color(0xffd070);
    const look = new THREE.Vector3(2.2, 7.2, 0);
    let wind = 0.3;
    let spin = 0;
    let flash = 0;
    let lastBar = -1;

    // integrated phases: an intensity change never makes the camera jump
    let camPh = 0;
    return {
      reset() {
        wind = 0.3;
        lastBar = -1;
        flash = 0;
      },
      update(input) {
        const t = input.t;
        const dt = Math.min(input.dt, 0.1);
        const I = input.intensity;
        uTime.value = t;

        // wind builds with intensity and energy (smoothed so it swells, never snaps)
        const target = Math.min(1, 0.22 + I * 0.5 + input.energy * 0.3 + input.bass * 0.15);
        wind += (target - wind) * (1 - Math.exp(-dt * 1.5));

        // bar downbeat: the 鍬形 flashes
        if (input.bar !== lastBar) {
          if (lastBar >= 0) flash = 0.5 + 0.5 * I;
          lastBar = input.bar;
        }
        flash *= Math.exp(-dt * 3.5);

        // camera: looking up at the pole, slow swing; lifts a little as things build
        camPh += dt * (0.04 + I * 0.05);
        const a = -0.12 + Math.sin(camPh) * 0.3;
        const r = 17 - input.beatPulse * 0.45 * I;
        camera.position.set(Math.sin(a) * r + 1, 1.8 + Math.sin(t * 0.11) * 0.35 + I * 0.5, Math.cos(a) * r);
        camera.lookAt(look);
        camera.fov = 52 - input.beatPulse * 1.2 * I;
        camera.updateProjectionMatrix();

        // carp: droop lifts with the wind, bass drives the ripple, the beat puff travels mouth to tail
        const pulse = input.beatPulse;
        const gustAmt = 0.32 * (0.35 + 0.65 * I) * Math.min(1, pulse * 2.5);
        const gustPos = (1 - pulse) * 1.15 - 0.05;
        for (let i = 0; i < socks.length; i++) {
          const s = socks[i]!;
          const droop = (1 - wind) * 0.75 * s.droopMul;
          s.group.rotation.z = -droop + Math.sin(t * 0.7 + i) * 0.04 * wind;
          s.group.rotation.y = s.yaw + Math.sin(t * 0.33 + i * 1.7) * 0.12 * wind;
          s.u.uSag.value = (1 - wind) * 0.12;
          s.u.uAmp.value = s.len * s.flutter * (0.025 + 0.05 * wind + 0.09 * input.bass * (0.4 + 0.6 * I));
          s.u.uSpeed.value = (2 + wind * 5) * s.flutter;
          s.u.uGustAmt.value = gustAmt;
          s.u.uGustPos.value = gustPos - i * 0.04;
        }

        // 矢車 spins with the energy and kicks on the beat
        spin += dt * (0.6 + wind * 5 + input.energy * 4) + pulse * dt * 8 * (0.3 + I);
        wheel.rotation.x = spin;

        // 鍬形 gleam
        kuwaMat.emissiveIntensity = 0.08 + flash * 1.4 + input.high * 0.35;
        gleam.intensity = flash * 6;
        cPal.set(input.palette.a);
        gleam.color.copy(cGold).lerp(cPal, 0.3);

        // sky follows the palette a little: top toward palette.a, horizon toward palette.bg
        skyU.uTop.value.copy(cSkyTop).lerp(cPal, 0.25);
        cPal.set(input.palette.bg);
        skyU.uHor.value.copy(cSkyHor).lerp(cPal, 0.2);
        fog.color.copy(skyU.uHor.value);
        cPal.set(input.palette.c);
        cloudMat.emissive.copy(cWhite).lerp(cPal, 0.35);

        // clouds drift, wind streaks blow through
        for (const c of clouds) {
          c.position.x += dt * (0.3 + wind * 1.2);
          if (c.position.x > 70) c.position.x -= 140;
        }
        const sv = 2 + wind * 10 + pulse * 4 * I;
        for (let i = 0; i < STREAKS; i++) {
          const k = i * 3;
          let x = sPos[k]! + sv * sSpd[i]! * dt;
          if (x > 25) x -= 50;
          sPos[k] = x;
          sPos[k + 1] = sPos[k + 1]! + Math.sin(t * 1.3 + i) * 0.3 * dt;
        }
        sAttr.needsUpdate = true;
        cPal.set(input.palette.b);
        sMat.color.copy(cWhite).lerp(cPal, 0.5);
        sMat.opacity = 0.15 + wind * 0.3 + input.high * 0.35;
        sMat.size = 0.08 + input.high * 0.08;
      },
    };
  },
});
