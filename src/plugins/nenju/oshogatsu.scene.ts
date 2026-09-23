import type * as T from 'three';
import { defineThreeScene } from '../api';

/**
 * お正月 (January). On a red felt stage in front of the sea: a pair of kadomatsu
 * (three slant-cut bamboos, pine and nanten berries, a straw base with rope
 * bands), kagami-mochi with a daidai on a sanpō, and a red lacquer shishi-mai
 * head in its green karakusa cloth. Behind them the first sunrise of the year
 * climbs out of the sea past a Fuji silhouette, laying a shimmering road of
 * light on the water, while gold grains drift up through the air.
 *
 * Signature beat moment: the shishi's jaw opens across each beat and snaps shut
 * on the beat (kachi!); on every bar downbeat the head nods deep, a spray of
 * gold grains bursts from its mouth and the sun's rays flash.
 */
export default defineThreeScene({
  id: 'nenju_oshogatsu',
  name: 'Oshogatsu 3D (three.js)',
  month: 1,
  group: 'nenju',
  description:
    'お正月素材（3D）。海の向こうから初日の出がゆっくり昇り、手前には門松一対と三方に載った鏡餅、赤い獅子舞の頭。獅子の口が拍ごとにカチッと閉じ、小節頭で大きく頷いて金の粒を吹き上げ、日の光が放射状に瞬く。紅白と金。オープニングや年明けの決め場に向く',
  short: '1月・お正月（3D）。晴れやか・めでたい。オープニング・幕開け',
  fov: 45,
  setup({ THREE, scene, camera }) {
    camera.far = 1000;
    const fog = new THREE.Fog('#000000', 40, 420);
    scene.fog = fog;

    // ---------- helpers ----------
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): T.CanvasTexture => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d')!;
      draw(g);
      const tex = new THREE.CanvasTexture(cv);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const std = (color: number, roughness = 0.7, metalness = 0, extra: T.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

    const glowTex = canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });

    // ---------- lights ----------
    const ambient = new THREE.AmbientLight(0xffe8d8, 0.35);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xffc080, 0.8);
    scene.add(sunLight);
    const fill = new THREE.DirectionalLight(0xfff0e6, 0.55);
    fill.position.set(3, 8, 10);
    scene.add(fill);
    const shishiLight = new THREE.PointLight(0xff6040, 4, 8, 1.6);
    shishiLight.position.set(1.8, 2.2, 2.4);
    scene.add(shishiLight);
    const mochiLight = new THREE.PointLight(0xffd090, 3, 7, 1.6);
    mochiLight.position.set(-1.4, 2.0, 2.2);
    scene.add(mochiLight);
    const rimLight = new THREE.PointLight(0xff9040, 4, 14, 1.4);
    rimLight.position.set(0, 3.5, -4);
    scene.add(rimLight);

    // ---------- sky, sea, mountains ----------
    const SUN_X = 12;
    const SUN_Z = -220;
    const dawnTex = canvasTex(4, 256, (g) => {
      const gr = g.createLinearGradient(0, 256, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 256);
    });
    const dawnMat = new THREE.MeshBasicMaterial({ map: dawnTex, color: 0xff7a30, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const dawn = new THREE.Mesh(new THREE.PlaneGeometry(1400, 180), dawnMat);
    dawn.position.set(0, 80, -300);
    scene.add(dawn);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 700), std(0x0c1a33, 0.3, 0.4));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -1, -345);
    scene.add(sea);

    const mountMat = std(0x1d2238, 0.95, 0, { flatShading: true });
    const snowMat = std(0xe8ecf4, 0.8, 0, { flatShading: true });
    const fuji = new THREE.Mesh(new THREE.ConeGeometry(70, 42, 9, 1, true), mountMat);
    fuji.position.set(-80, 20, -190);
    scene.add(fuji);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(18.6, 11, 9, 1, true), snowMat);
    cap.position.set(-80, 35.6, -190);
    scene.add(cap);
    for (const [x, z, r, h] of [
      [-150, -230, 60, 22],
      [110, -210, 70, 18],
      [170, -250, 60, 26],
    ] as const) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true), mountMat);
      m.position.set(x, h / 2 - 1, z);
      scene.add(m);
    }

    // the sun: disc + halo sprite + slowly turning rays
    const sunGroup = new THREE.Group();
    sunGroup.position.set(SUN_X, -20, SUN_Z);
    scene.add(sunGroup);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f, fog: false });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(11, 40, 20), sunMat);
    sunGroup.add(sun);
    const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(80);
    sunGroup.add(halo);
    const rayTex = canvasTex(16, 256, (g) => {
      const gr = g.createLinearGradient(0, 256, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(3, 256);
      g.lineTo(13, 256);
      g.lineTo(8, 0);
      g.closePath();
      g.fill();
    });
    const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, color: 0xffd080, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const rays = new THREE.Group();
    const RAYS = 16;
    const rayGeo = new THREE.PlaneGeometry(9, 150);
    rayGeo.translate(0, 75 + 10, 0);
    for (let i = 0; i < RAYS; i++) {
      const r = new THREE.Mesh(rayGeo, rayMat);
      r.rotation.z = (i / RAYS) * Math.PI * 2;
      r.scale.y = i % 2 === 0 ? 1 : 0.65;
      rays.add(r);
    }
    rays.position.z = -2;
    sunGroup.add(rays);

    // the road of light on the water
    const roadTex = canvasTex(64, 512, (g) => {
      g.clearRect(0, 0, 64, 512);
      for (let i = 0; i < 260; i++) {
        const y = Math.random() * 512;
        const w = 4 + Math.random() * 40;
        const x = 32 - w / 2 + (Math.random() - 0.5) * 18;
        g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
        g.fillRect(x, y, w, 1 + Math.random() * 2);
      }
    });
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, 3);
    const roadMat = new THREE.MeshBasicMaterial({ map: roadTex, color: 0xffa050, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 215), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(SUN_X * 0.5, -0.97, -112);
    road.rotation.z = Math.atan2(SUN_X, -SUN_Z) * -1;
    scene.add(road);

    // ---------- red felt stage ----------
    const stage = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 5.2), std(0xa80f22, 0.95));
    stage.position.set(0, -0.2, 0.8);
    scene.add(stage);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(14.05, 0.05, 0.06), std(0xe6c45a, 0.3, 0.8));
    edge.position.set(0, 0.0, 3.42);
    scene.add(edge);

    // ---------- kadomatsu ----------
    const bambooMat = std(0x3d7a36, 0.45, 0.05);
    const cutMat = std(0xeae2b4, 0.7);
    const nodeMat = std(0x2d5e28, 0.5);
    const strawMat = std(0xc9a45c, 1);
    const ropeMat = std(0x6b4a22, 0.9);
    const pineMat = std(0x1d4a28, 0.8, 0, { flatShading: true });
    const berryMat = std(0xd8141e, 0.35, 0, { emissive: 0x3a0000 });
    const makeBamboo = (h: number, r: number): T.Mesh => {
      const geo = new THREE.CylinderGeometry(r, r, h, 20, 1, false);
      const p = geo.attributes.position as T.BufferAttribute;
      const k = 1.1; // slant of the cut: back is higher, the cut opens toward the viewer
      for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2 - 1e-4) p.setY(i, h / 2 - p.getZ(i) * k);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, [bambooMat, cutMat, bambooMat]);
      const node = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, r * 0.08, 6, 20), nodeMat);
      node.rotation.x = Math.PI / 2;
      node.position.y = -h * 0.12;
      m.add(node);
      return m;
    };
    const makeKadomatsu = (side: number): T.Group => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.8, 24), strawMat);
      base.position.y = 0.4;
      g.add(base);
      for (const y of [0.15, 0.4, 0.65]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.585 - y * 0.08, 0.035, 6, 28), ropeMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        g.add(band);
      }
      const bamboo: [number, number, number][] = [
        [2.5, 0, -0.12],
        [2.05, -0.2, 0.14],
        [1.7, 0.2, 0.14],
      ];
      for (const [h, x, z] of bamboo) {
        const b = makeBamboo(h, 0.11);
        b.position.set(x, 0.55 + h / 2 - 0.3, z);
        g.add(b);
      }
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const pine = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 7), pineMat);
        pine.position.set(Math.cos(a) * 0.38, 0.95 + (i % 3) * 0.08, Math.sin(a) * 0.38);
        pine.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        g.add(pine);
      }
      for (let i = 0; i < 7; i++) {
        const a = side * 0.8 + (i / 7) * 1.6;
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), berryMat);
        berry.position.set(Math.cos(a) * 0.5, 1.02 + (i % 2) * 0.06, Math.sin(a) * 0.35 + 0.18);
        g.add(berry);
      }
      g.position.set(side * 3.6, 0, 0.9);
      g.rotation.y = -side * 0.25;
      return g;
    };
    const kadoL = makeKadomatsu(-1);
    const kadoR = makeKadomatsu(1);
    scene.add(kadoL, kadoR);

    // ---------- kagami-mochi on a sanpō ----------
    const kagami = new THREE.Group();
    const woodMat = std(0xd8b779, 0.6);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 1.25), woodMat);
    tray.position.y = 0.62;
    kagami.add(tray);
    const rimGeo = new THREE.BoxGeometry(1.25, 0.1, 0.04);
    for (let i = 0; i < 4; i++) {
      const rim = new THREE.Mesh(rimGeo, woodMat);
      const a = (i * Math.PI) / 2;
      rim.position.set(Math.sin(a) * 0.605, 0.7, Math.cos(a) * 0.605);
      rim.rotation.y = a;
      kagami.add(rim);
    }
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.58, 4, 1, false, Math.PI / 4), woodMat);
    stand.position.y = 0.29;
    kagami.add(stand);
    const shihoTex = canvasTex(128, 128, (g) => {
      g.fillStyle = '#d0142a';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#fbf8f0';
      g.fillRect(12, 12, 104, 104);
    });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshStandardMaterial({ map: shihoTex, roughness: 0.9 }));
    paper.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    paper.position.y = 0.665;
    kagami.add(paper);
    const fernMat = std(0x2f6a32, 0.7, 0, { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const fern = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), fernMat);
      fern.scale.set(1.1, 0.05, 0.35);
      fern.position.set(s * 0.32, 0.7, 0.05);
      fern.rotation.y = s * 0.35;
      kagami.add(fern);
    }
    const mochiMat = std(0xfbf7ee, 0.55);
    const mochi1 = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 16), mochiMat);
    mochi1.scale.set(1, 0.45, 1);
    mochi1.position.y = 0.87;
    kagami.add(mochi1);
    const mochi2 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 16), mochiMat);
    mochi2.scale.set(1, 0.5, 1);
    mochi2.position.y = 1.2;
    kagami.add(mochi2);
    const daidai = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), std(0xff7f16, 0.45, 0, { emissive: 0x401800 }));
    daidai.scale.set(1, 0.9, 1);
    daidai.position.y = 1.54;
    kagami.add(daidai);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), std(0x2a7a2e, 0.5));
    leaf.scale.set(1.2, 0.15, 0.5);
    leaf.position.set(0.1, 1.69, 0);
    leaf.rotation.z = 0.4;
    kagami.add(leaf);
    kagami.position.set(-1.45, 0, 1.3);
    kagami.rotation.y = 0.35;
    scene.add(kagami);

    // ---------- shishi-mai head ----------
    const shishi = new THREE.Group();
    const head = new THREE.Group(); // nods
    shishi.add(head);
    const lacquer = std(0xb3121b, 0.28, 0.25);
    const gold = std(0xe6c45a, 0.28, 0.85, { emissive: 0x3a2a08 });
    const black = std(0x111111, 0.35);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 20), lacquer);
    skull.scale.set(1.05, 0.72, 0.95);
    skull.position.set(0, 0.22, 0);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.3, 0.5), lacquer);
    snout.position.set(0, 0.06, 0.38);
    head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), lacquer);
    nose.scale.set(1.8, 0.9, 1);
    nose.position.set(0, 0.2, 0.62);
    head.add(nose);
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), gold);
      nostril.position.set(s * 0.1, 0.17, 0.72);
      head.add(nostril);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), gold);
      eye.position.set(s * 0.24, 0.36, 0.4);
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), black);
      pupil.position.set(s * 0.25, 0.37, 0.51);
      head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.1), black);
      brow.position.set(s * 0.25, 0.53, 0.38);
      brow.rotation.z = -s * 0.35;
      head.add(brow);
      const browGold = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI * 1.5), gold);
      browGold.position.set(s * 0.4, 0.58, 0.36);
      head.add(browGold);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lacquer);
      ear.scale.set(0.5, 1, 0.3);
      ear.position.set(s * 0.52, 0.45, -0.05);
      ear.rotation.z = -s * 0.6;
      head.add(ear);
    }
    const toothGeo = new THREE.BoxGeometry(0.1, 0.09, 0.06);
    for (let i = 0; i < 6; i++) {
      const tooth = new THREE.Mesh(toothGeo, gold);
      tooth.position.set(-0.3 + i * 0.12, -0.1, 0.6);
      head.add(tooth);
    }
    const mouthIn = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.5), std(0x3a0508, 0.9));
    mouthIn.position.set(0, -0.12, 0.3);
    head.add(mouthIn);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.12, 0.0);
    head.add(jaw);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.66), lacquer);
    jawMesh.position.set(0, -0.1, 0.32);
    jaw.add(jawMesh);
    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(toothGeo, gold);
      tooth.position.set(-0.24 + i * 0.1, 0.0, 0.56);
      jaw.add(tooth);
    }
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), std(0xe0405a, 0.6));
    tongue.scale.set(1.2, 0.3, 1.2);
    tongue.position.set(0, 0.0, 0.3);
    jaw.add(tongue);
    // white mane fringe
    const maneMat = std(0xf4f0e8, 0.9);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), maneMat);
      tuft.position.set(Math.sin(a) * 0.5, 0.25 + Math.cos(a) * 0.2, -0.32);
      tuft.rotation.set(-1.9, 0, -a * 0.8);
      head.add(tuft);
    }
    // karakusa cloth body draped behind
    const karakusaTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#1f6b3a';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = '#f4f0e8';
      g.lineWidth = 5;
      g.lineCap = 'round';
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * 64 + (y % 2) * 32 + 16;
          const cy = y * 64 + 32;
          g.beginPath();
          for (let k = 0; k < 40; k++) {
            const a = k * 0.32;
            const r = 3 + k * 0.55;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.stroke();
        }
    });
    karakusaTex.wrapS = karakusaTex.wrapT = THREE.RepeatWrapping;
    karakusaTex.repeat.set(3, 2);
    const cloth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.9, 2.2, 28, 1, true, Math.PI / 2, Math.PI),
      new THREE.MeshStandardMaterial({ map: karakusaTex, roughness: 0.85, side: THREE.DoubleSide }),
    );
    cloth.rotation.set(Math.PI / 2 - 0.25, 0, 0);
    cloth.position.set(0, -0.05, -1.2);
    shishi.add(cloth);
    shishi.position.set(1.55, 0.95, 1.3);
    shishi.rotation.y = -0.3;
    shishi.scale.setScalar(1.05);
    scene.add(shishi);
    // spot where grains fly out of the mouth (world space, fixed)
    const mouthPos = new THREE.Vector3(0, -0.05, 0.8);
    shishi.updateMatrixWorld(true);
    mouthPos.applyMatrix4(shishi.matrixWorld);

    // ---------- gold grains ----------
    const N = 1600;
    const gPos = new Float32Array(N * 3);
    const gVel = new Float32Array(N * 3);
    const spawnAmbient = (i: number, anywhere: boolean): void => {
      gPos[i * 3] = (Math.random() - 0.5) * 18;
      gPos[i * 3 + 1] = anywhere ? Math.random() * 8 : -0.2;
      gPos[i * 3 + 2] = -5 + Math.random() * 10;
      gVel[i * 3] = (Math.random() - 0.5) * 0.15;
      gVel[i * 3 + 1] = 0.15 + Math.random() * 0.35;
      gVel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    };
    for (let i = 0; i < N; i++) spawnAmbient(i, true);
    const grainGeo = new THREE.BufferGeometry();
    const grainAttr = new THREE.BufferAttribute(gPos, 3);
    grainAttr.setUsage(THREE.DynamicDrawUsage);
    grainGeo.setAttribute('position', grainAttr);
    const grainMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffd060, size: 0.09, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const grains = new THREE.Points(grainGeo, grainMat);
    grains.frustumCulled = false;
    scene.add(grains);
    let cursor = 0;
    const burst = (count: number, power: number): void => {
      for (let n = 0; n < count; n++) {
        const i = cursor;
        cursor = (cursor + 1) % N;
        gPos[i * 3] = mouthPos.x;
        gPos[i * 3 + 1] = mouthPos.y;
        gPos[i * 3 + 2] = mouthPos.z;
        const a = Math.random() * Math.PI * 2;
        const u = Math.random();
        const sp = power * (0.5 + Math.random() * 0.8);
        gVel[i * 3] = Math.cos(a) * u * sp * 0.8 - 0.4;
        gVel[i * 3 + 1] = (0.6 + Math.random() * 0.8) * sp;
        gVel[i * 3 + 2] = Math.sin(a) * u * sp * 0.6 + sp * 0.4;
      }
    };

    // ---------- per-frame state (no allocations below) ----------
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const tmp = new THREE.Color();
    const sunLow = new THREE.Color(0xff4a18);
    const sunHigh = new THREE.Color(0xffe0a0);
    const goldC = new THREE.Color(0xffd060);
    const look = new THREE.Vector3();
    let life = 0;
    let lastBar = -1;
    let barHit = 0;
    let rayFlash = 0;
    const smooth = (a: number, b: number, x: number): number => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };

    // integrated phases: an intensity change never makes the camera jump
    let camPh = 0;
    let colPh = 0;
    return {
      reset() {
        life = 0;
        lastBar = -1;
        barHit = 0;
        for (let i = 0; i < N; i++) spawnAmbient(i, true);
      },
      update(input) {
        const t = input.t;
        const dt = Math.min(0.05, input.dt);
        const I = input.intensity;
        cA.set(input.palette.a);
        cB.set(input.palette.b);
        cC.set(input.palette.c);
        fog.color.set(input.palette.bg);

        // bar downbeat: nod + burst + ray flash
        if (input.bar !== lastBar) {
          if (lastBar >= 0) {
            barHit = 1;
            rayFlash = 1;
            burst(Math.round(50 + 220 * I), 2.2 + 2.6 * I);
          }
          lastBar = input.bar;
        }
        barHit *= Math.exp(-dt * 4);
        rayFlash *= Math.exp(-dt * 2.2);

        // sunrise: climbs out of the sea, then holds with a gentle breathing
        life += dt * (0.5 + I * 0.9);
        const rise = smooth(0, 70, life);
        sunGroup.position.y = -22 + 64 * rise + Math.sin(t * 0.2) * 0.6;
        sunMat.color.copy(sunLow).lerp(sunHigh, rise);
        tmp.copy(sunMat.color).lerp(cA, 0.25);
        haloMat.color.copy(tmp);
        const sunSwell = 1 + input.bass * 0.18 + input.beatPulse * 0.06 * I;
        halo.scale.setScalar((70 + rise * 40) * sunSwell);
        haloMat.opacity = 0.35 + rise * 0.35 + input.bass * 0.2;
        rays.rotation.z = t * 0.03;
        rayMat.color.copy(tmp);
        rayMat.opacity = (0.06 + rise * 0.14 + input.high * 0.12 + rayFlash * 0.35) * smooth(0.05, 0.25, rise);
        rays.scale.setScalar(1 + rayFlash * 0.15);
        dawnMat.color.copy(sunLow).lerp(cA, 0.3);
        dawnMat.opacity = 0.18 + rise * 0.3 + input.bass * 0.08;
        roadMat.color.copy(tmp);
        roadMat.opacity = smooth(0.12, 0.4, rise) * (0.55 + input.high * 0.45);
        colPh = (colPh + dt * (0.02 + I * 0.05)) % 1;
        roadTex.offset.y = colPh;

        // light follows the sun
        sunLight.position.set(SUN_X, sunGroup.position.y, SUN_Z).normalize().multiplyScalar(10);
        sunLight.color.copy(sunMat.color);
        sunLight.intensity = 0.35 + rise * 1.0;
        rimLight.color.copy(sunMat.color).lerp(cA, 0.3);
        rimLight.intensity = 2 + rise * 4 + input.bass * 5;
        const glow = 0.5 + input.bass * 1.4 + input.beatPulse * 1.0;
        shishiLight.color.setRGB(1, 0.35, 0.25).lerp(cB, 0.45);
        shishiLight.intensity = 1.5 + glow * 3;
        mochiLight.color.setRGB(1, 0.85, 0.6).lerp(cC, 0.4);
        mochiLight.intensity = 1.5 + glow * 2;
        ambient.color.setRGB(1, 0.92, 0.86).lerp(cA, 0.15);

        // shishi: jaw opens across the beat and snaps shut on it
        const ph = input.beatPhase;
        const openShape = smooth(0.0, 0.3, ph) * (1 - smooth(0.82, 1.0, ph));
        const jawOpen = openShape * (0.12 + 0.43 * I) + (1 - input.beatPulse) * 0.02;
        jaw.rotation.x = jawOpen;
        head.rotation.x = -jawOpen * 0.35 + barHit * 0.3 * (0.4 + I) - input.beatPulse * 0.04;
        head.rotation.y = Math.sin(t * 0.7) * 0.18 * (0.3 + I);
        head.rotation.z = Math.sin(t * 1.1) * 0.05 * (0.3 + I);
        head.position.y = input.beatPulse * 0.05 * (0.3 + I) - barHit * 0.08;

        // kadomatsu and kagami-mochi breathe very slightly with the beat
        const pulse = 1 + input.beatPulse * 0.025 * (0.3 + I);
        kadoL.scale.set(1, pulse, 1);
        kadoR.scale.set(1, pulse, 1);
        kagami.position.y = input.beatPulse * 0.03 * I;

        // gold grains: buoyant drift, bursts slow down under drag
        const drag = Math.exp(-dt * 1.4);
        for (let i = 0; i < N; i++) {
          const o = i * 3;
          let vx = gVel[o]! * drag;
          let vy = gVel[o + 1]! * drag + dt * 0.12;
          let vz = gVel[o + 2]! * drag;
          if (vy < 0.08) vy += dt * 0.3;
          vx += Math.sin(t * 0.8 + i) * dt * 0.05;
          gVel[o] = vx;
          gVel[o + 1] = vy;
          gVel[o + 2] = vz;
          const sp = 0.6 + I * 0.8;
          const x = gPos[o]! + vx * dt * sp;
          const y = gPos[o + 1]! + vy * dt * sp;
          const z = gPos[o + 2]! + vz * dt * sp;
          gPos[o] = x;
          gPos[o + 1] = y;
          gPos[o + 2] = z;
          if (y > 9 || x > 12 || x < -12 || z > 9 || z < -8) spawnAmbient(i, false);
        }
        grainAttr.needsUpdate = true;
        grainMat.color.copy(goldC).lerp(cA, 0.25);
        grainMat.size = 0.07 + input.high * 0.07 + input.beatPulse * 0.02;
        grainMat.opacity = 0.55 + input.high * 0.35 + barHit * 0.1;

        // camera: slow sway in front of the stage, the beat leans it in
        camPh += dt * (0.05 + I * 0.08);
        const sw = camPh;
        camera.position.set(Math.sin(sw) * 3.6, 2.5 + Math.sin(t * 0.13) * 0.35, 9.6 - input.beatPulse * 0.35 * I - barHit * 0.25 * I);
        look.set(Math.sin(sw) * 0.8, 2.6 + rise * 1.2, -30);
        camera.lookAt(look);
        camera.fov = 45 - input.beatPulse * 1.2 * I;
        camera.updateProjectionMatrix();
      },
    };
  },
});
