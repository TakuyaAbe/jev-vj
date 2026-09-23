import type * as T from 'three';
import { defineThreeScene } from '../api';

/**
 * 節分 (February). A tatami room at night with a back-lit shoji wall: a red oni
 * (two horns) and a blue oni (one horn) in tiger-striped loincloths, curly hair,
 * fangs and studded kanabō, stand either side. A wooden masu marked 福 sits in
 * front, and a hiiragi-iwashi (holly sprig skewering a sardine head) hangs on
 * the doorpost.
 *
 * Signature beat moment: on every beat the masu kicks and a burst of roasted
 * beans flies at one oni, alternating red / blue ("oni wa soto!"); the beans
 * bounce off the target (it flinches, squashes and leans back) and rattle down
 * onto the tatami with simple gravity-and-bounce physics, piling up on the floor.
 */
export default defineThreeScene({
  id: 'nenju_setsubun',
  name: 'Setsubun 3D (three.js)',
  month: 2,
  group: 'nenju',
  description:
    '節分素材（3D）。障子明かりの和室に赤鬼と青鬼が金棒を構え、手前に「福」の升、柱には柊鰯。拍ごとに升から豆がバラッと飛び、赤鬼・青鬼に交互に当たって跳ね返り、畳に転がって積もる。当たった鬼はのけぞり、鬼の灯りが低域で脈打つ。コミカルで勢いがある。ドロップやノリのいいグルーヴに向く',
  short: '2月・節分（3D）。コミカル・パンチ強め。跳ねるドロップ',
  fov: 50,
  setup({ THREE, scene, camera }) {
    const fog = new THREE.Fog('#000000', 12, 34);
    scene.fog = fog;

    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): T.CanvasTexture => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      draw(cv.getContext('2d')!);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const std = (color: number, roughness = 0.7, metalness = 0, extra: T.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

    // ---------- lights ----------
    const ambient = new THREE.AmbientLight(0xfff0e0, 0.4);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff2e0, 1.0);
    key.position.set(2, 8, 7);
    scene.add(key);
    const redLight = new THREE.PointLight(0xff3020, 5, 7, 1.6);
    redLight.position.set(-2.6, 3.2, 0.8);
    scene.add(redLight);
    const blueLight = new THREE.PointLight(0x3060ff, 5, 7, 1.6);
    blueLight.position.set(2.6, 3.2, 0.8);
    scene.add(blueLight);
    const masuLight = new THREE.PointLight(0xffc070, 3, 6, 1.6);
    masuLight.position.set(0, 1.8, 3.4);
    scene.add(masuLight);

    // ---------- room: tatami, shoji, posts ----------
    const tatamiTex = canvasTex(256, 512, (g) => {
      g.fillStyle = '#b9b56a';
      g.fillRect(0, 0, 256, 512);
      for (let y = 0; y < 512; y += 3) {
        g.fillStyle = `rgba(90,85,30,${0.12 + Math.random() * 0.12})`;
        g.fillRect(0, y, 256, 1);
      }
      g.fillStyle = '#1e2a1c';
      g.fillRect(0, 0, 16, 512);
      g.fillRect(240, 0, 16, 512);
    });
    tatamiTex.wrapS = tatamiTex.wrapT = THREE.RepeatWrapping;
    tatamiTex.repeat.set(6, 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshStandardMaterial({ map: tatamiTex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    scene.add(floor);

    const shojiTex = canvasTex(512, 256, (g) => {
      g.fillStyle = '#fbf3df';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#5a3a20';
      for (let x = 0; x <= 512; x += 64) g.fillRect(x - 3, 0, 6, 256);
      for (let y = 0; y <= 256; y += 42) g.fillRect(0, y - 3, 512, 6);
    });
    shojiTex.wrapS = THREE.RepeatWrapping;
    shojiTex.repeat.set(2, 1);
    const shojiMat = new THREE.MeshStandardMaterial({ map: shojiTex, emissiveMap: shojiTex, emissive: 0xffe0b0, emissiveIntensity: 0.55, roughness: 0.95 });
    const shoji = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.2), shojiMat);
    shoji.position.set(0, 2.1, -3.2);
    scene.add(shoji);
    const woodDark = std(0x4a2e18, 0.7);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.3, 0.3), woodDark);
    lintel.position.set(0, 4.35, -3.1);
    scene.add(lintel);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), std(0xc9b48a, 0.95));
    wall.position.set(0, 5.9, -3.25);
    scene.add(wall);
    const postGeo = new THREE.BoxGeometry(0.32, 7.5, 0.32);
    const postL = new THREE.Mesh(postGeo, woodDark);
    postL.position.set(-6.1, 3.75, -3.0);
    const postR = new THREE.Mesh(postGeo, woodDark);
    postR.position.set(6.1, 3.75, -3.0);
    scene.add(postL, postR);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.08, 0.3), woodDark);
    sill.position.set(0, 0.04, -3.1);
    scene.add(sill);

    // ---------- hiiragi-iwashi on a front post ----------
    const hPost = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), woodDark);
    hPost.position.set(-4.6, 3.5, -1.0);
    scene.add(hPost);
    const hiiragi = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.1, 6), std(0x6b4a2a, 0.8));
    hiiragi.add(stick);
    const leafShape = new THREE.Shape();
    {
      // holly leaf: pointed ellipse with zigzag spikes
      const L = 0.34;
      const W = 0.12;
      const spikes = 4;
      leafShape.moveTo(0, 0);
      for (let i = 1; i <= spikes * 2; i++) {
        const u = i / (spikes * 2);
        const w = Math.sin(u * Math.PI) * W * (i % 2 === 1 ? 1.35 : 0.8);
        leafShape.lineTo(w, u * L);
      }
      for (let i = spikes * 2 - 1; i >= 1; i--) {
        const u = i / (spikes * 2);
        const w = Math.sin(u * Math.PI) * W * (i % 2 === 1 ? 1.35 : 0.8);
        leafShape.lineTo(-w, u * L);
      }
      leafShape.lineTo(0, 0);
    }
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.01, bevelEnabled: false });
    const leafMat = std(0x1a4a22, 0.35, 0.1, { side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const lf = new THREE.Mesh(leafGeo, leafMat);
      const y = 0.1 + i * 0.06;
      lf.position.set(0, y, 0);
      lf.rotation.set(0.3 * (i % 2 ? 1 : -1), i * 0.9, (i % 2 ? 1 : -1) * (0.7 + i * 0.05));
      hiiragi.add(lf);
    }
    const fish = new THREE.Group();
    const fishMat = std(0x9aa3ad, 0.25, 0.6);
    const fishHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), fishMat);
    fishHead.scale.set(1.9, 1, 0.8);
    fish.add(fishHead);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 12), fishMat);
    snout.rotation.z = -Math.PI / 2;
    snout.position.x = 0.26;
    fish.add(snout);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0x111111, 0.3));
      eye.position.set(0.12, 0.03, s * 0.085);
      fish.add(eye);
    }
    fish.position.set(0, -0.3, 0);
    fish.rotation.z = -Math.PI / 2 + 0.2;
    hiiragi.add(fish);
    hiiragi.position.set(-4.6, 2.7, -0.8);
    hiiragi.rotation.z = 0.25;
    scene.add(hiiragi);

    // ---------- oni ----------
    const tigerTex = canvasTex(256, 64, (g) => {
      g.fillStyle = '#f2b51c';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#1a1208';
      for (let x = 8; x < 256; x += 26) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 10, 0);
        g.lineTo(x + 4 + Math.random() * 6, 64);
        g.lineTo(x - 4, 64);
        g.closePath();
        g.fill();
      }
    });
    tigerTex.wrapS = THREE.RepeatWrapping;
    const tigerMat = new THREE.MeshStandardMaterial({ map: tigerTex, roughness: 0.8 });
    const hornMat = std(0xf2e6c4, 0.5);
    const hairMat = std(0x16110e, 0.85);
    const whiteMat = std(0xffffff, 0.3);
    const blackMat = std(0x0c0c0c, 0.3);
    const ironMat = std(0x3a3a44, 0.35, 0.8);
    const studGeo = new THREE.ConeGeometry(0.045, 0.1, 6);

    interface Oni {
      root: T.Group;
      body: T.Group;
      head: T.Group;
      clubArm: T.Group;
      otherArm: T.Group;
      skin: T.MeshStandardMaterial;
      baseX: number;
      side: number;
      hit: number;
      phase: number;
    }
    const makeOni = (skinColor: number, horns: 1 | 2, side: number): Oni => {
      const skin = std(skinColor, 0.55, 0, { emissive: skinColor, emissiveIntensity: 0.08 });
      const root = new THREE.Group();
      const body = new THREE.Group();
      root.add(body);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.85, 12), skin);
        leg.position.set(s * 0.24, 0.42, 0);
        body.add(leg);
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), skin);
        foot.scale.set(1, 0.5, 1.4);
        foot.position.set(s * 0.24, 0.06, 0.08);
        body.add(foot);
      }
      const loin = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.45, 20), tigerMat);
      loin.position.y = 0.98;
      body.add(loin);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), skin);
      belly.scale.set(0.95, 0.9, 0.78);
      belly.position.y = 1.55;
      body.add(belly);
      const makeArm = (s: number): T.Group => {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.58, 1.95, 0);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.85, 10), skin);
        arm.position.y = -0.42;
        pivot.add(arm);
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
        fist.position.y = -0.88;
        pivot.add(fist);
        body.add(pivot);
        return pivot;
      };
      // the club arm is on the outer side
      const clubArm = makeArm(side);
      const otherArm = makeArm(-side);
      const club = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.06, 1.7, 12), ironMat);
      shaft.position.y = 0.55;
      club.add(shaft);
      const STUDS = 30;
      const studs = new THREE.InstancedMesh(studGeo, ironMat, STUDS);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const p = new THREE.Vector3();
      const sc = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < STUDS; i++) {
        const ring = Math.floor(i / 6);
        const a = (i % 6) * (Math.PI / 3) + ring * 0.5;
        const y = 0.75 + ring * 0.15;
        const r = 0.06 + ((y + 0.3) / 1.7) * 0.08 + 0.035;
        p.set(Math.cos(a) * r, y, Math.sin(a) * r);
        e.set(0, -a, -Math.PI / 2);
        q.setFromEuler(e);
        studs.setMatrixAt(i, m.compose(p, q, sc));
      }
      club.add(studs);
      club.position.y = -0.9;
      club.rotation.x = 1.25;
      clubArm.add(club);

      const head = new THREE.Group();
      head.position.y = 2.45;
      body.add(head);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), skin);
      head.add(skull);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.15 + (i % 3) * 0.02, 10, 8), hairMat);
        curl.position.set(Math.cos(a) * 0.34, 0.26 + Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.3 - 0.08);
        head.add(curl);
      }
      const hornGeo = new THREE.ConeGeometry(0.08, 0.38, 12);
      const hornXs = horns === 2 ? [-0.2, 0.2] : [0];
      for (const hx of hornXs) {
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(hx, 0.52, 0.08);
        horn.rotation.z = -hx * 1.2;
        head.add(horn);
      }
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), whiteMat);
        eye.position.set(s * 0.16, 0.08, 0.38);
        head.add(eye);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), blackMat);
        pupil.position.set(s * 0.15, 0.08, 0.48);
        head.add(pupil);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.08), hairMat);
        brow.position.set(s * 0.17, 0.23, 0.39);
        brow.rotation.z = s * 0.45;
        head.add(brow);
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 8), whiteMat);
        fang.position.set(s * 0.12, -0.16, 0.41);
        head.add(fang);
      }
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16, Math.PI), std(0x2a0808, 0.6));
      mouth.rotation.z = Math.PI;
      mouth.position.set(0, -0.12, 0.4);
      head.add(mouth);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skin);
      nose.position.set(0, -0.02, 0.45);
      head.add(nose);

      const baseX = side * 2.4;
      root.position.set(baseX, 0, -0.9);
      root.rotation.y = -side * 0.35;
      root.scale.setScalar(1.05);
      scene.add(root);
      return { root, body, head, clubArm, otherArm, skin, baseX, side, hit: 0, phase: side > 0 ? 1.3 : 0 };
    };
    const onis: Oni[] = [makeOni(0xd8342a, 2, -1), makeOni(0x2f5fd0, 1, 1)];

    // ---------- masu ----------
    const masu = new THREE.Group();
    const masuWood = std(0xe2c48c, 0.6);
    const S = 0.9;
    const Hm = 0.5;
    const tk = 0.06;
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(S, tk, S), masuWood);
    bottom.position.y = tk / 2;
    masu.add(bottom);
    const fukuTex = canvasTex(128, 128, (g) => {
      g.fillStyle = '#e2c48c';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(140,100,50,0.25)';
      for (let y = 0; y < 128; y += 7) g.fillRect(0, y, 128, 2);
      g.fillStyle = '#1a1008';
      g.font = 'bold 84px "Hiragino Mincho ProN", "Yu Mincho", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('福', 64, 70);
    });
    const frontMat = new THREE.MeshStandardMaterial({ map: fukuTex, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const w = new THREE.Mesh(new THREE.BoxGeometry(S, Hm, tk), i === 0 ? [masuWood, masuWood, masuWood, masuWood, frontMat, masuWood] : masuWood);
      w.position.set(Math.sin(a) * (S / 2 - tk / 2), Hm / 2, Math.cos(a) * (S / 2 - tk / 2));
      w.rotation.y = a;
      masu.add(w);
    }
    // a heap of beans inside
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xcfa96c, 0.8));
    heap.scale.set(1, 0.35, 1);
    heap.position.y = Hm - 0.1;
    masu.add(heap);
    masu.position.set(0, 0, 2.6);
    masu.rotation.y = 0.15;
    scene.add(masu);
    const MOUTH_X = 0;
    const MOUTH_Y = 0.6;
    const MOUTH_Z = 2.6;

    // ---------- beans ----------
    const B = 700;
    const R = 0.055;
    const beanGeo = new THREE.SphereGeometry(R, 8, 6);
    beanGeo.scale(1, 0.85, 0.9);
    const beans = new THREE.InstancedMesh(beanGeo, std(0xffffff, 0.65), B);
    beans.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    beans.frustumCulled = false;
    scene.add(beans);
    const bp = new Float32Array(B * 3);
    const bv = new Float32Array(B * 3);
    const bRot = new Float32Array(B);
    const bSleep = new Uint8Array(B);
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const bc = new THREE.Color();
    for (let i = 0; i < B; i++) {
      bp[i * 3 + 1] = -10;
      bSleep[i] = 1;
      beans.setMatrixAt(i, hidden);
      bc.setHSL(0.09 + Math.random() * 0.02, 0.5 + Math.random() * 0.15, 0.55 + Math.random() * 0.12);
      beans.setColorAt(i, bc);
    }
    let cursor = 0;
    let throwCount = 0;
    const throwAt = (target: Oni, count: number, power: number): void => {
      const tx = target.baseX;
      const tz = target.root.position.z;
      for (let n = 0; n < count; n++) {
        const i = cursor;
        cursor = (cursor + 1) % B;
        bp[i * 3] = MOUTH_X + (Math.random() - 0.5) * 0.4;
        bp[i * 3 + 1] = MOUTH_Y + Math.random() * 0.1;
        bp[i * 3 + 2] = MOUTH_Z + (Math.random() - 0.5) * 0.3;
        // ballistic toward the oni's chest, with spread
        const fl = 0.55 + Math.random() * 0.25;
        const dx = tx + (Math.random() - 0.5) * 1.0 - bp[i * 3]!;
        const dz = tz + (Math.random() - 0.5) * 0.6 - bp[i * 3 + 2]!;
        const dy = 1.4 + Math.random() * 1.2 - bp[i * 3 + 1]!;
        const flight = fl / power;
        bv[i * 3] = dx / flight;
        bv[i * 3 + 2] = dz / flight;
        bv[i * 3 + 1] = dy / flight + 0.5 * 9.8 * flight;
        bRot[i] = Math.random() * 6;
        bSleep[i] = 0;
      }
    };

    // ---------- per-frame state ----------
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const redC = new THREE.Color(0xff3020);
    const blueC = new THREE.Color(0x3060ff);
    const warmC = new THREE.Color(0xffc070);
    const shojiC = new THREE.Color(0xffe0b0);
    const m4 = new THREE.Matrix4();
    const q4 = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const pv = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const look = new THREE.Vector3();
    let lastBeat = -1;
    let masuKick = 0;

    // integrated phases: an intensity change never makes the camera jump
    let camPh = 0;
    return {
      reset() {
        for (let i = 0; i < B; i++) {
          bSleep[i] = 1;
          bp[i * 3 + 1] = -10;
          beans.setMatrixAt(i, hidden);
        }
        beans.instanceMatrix.needsUpdate = true;
        lastBeat = -1;
        throwCount = 0;
      },
      update(input) {
        const t = input.t;
        const dt = Math.min(0.04, input.dt);
        const I = input.intensity;
        cA.set(input.palette.a);
        cB.set(input.palette.b);
        cC.set(input.palette.c);
        fog.color.set(input.palette.bg);

        // on each beat: throw a handful at the next oni
        if (input.beat !== lastBeat) {
          if (lastBeat >= 0) {
            const target = onis[throwCount % 2]!;
            throwAt(target, Math.round(8 + 34 * I), 0.9 + 0.5 * I);
            throwCount++;
            masuKick = 1;
          }
          lastBeat = input.beat;
        }
        masuKick *= Math.exp(-dt * 9);

        // beans: gravity, bounce off the oni and the tatami, then settle
        const g = 9.8;
        for (let i = 0; i < B; i++) {
          if (bSleep[i]) continue;
          const o = i * 3;
          let x = bp[o]!;
          let y = bp[o + 1]!;
          let z = bp[o + 2]!;
          let vx = bv[o]!;
          let vy = bv[o + 1]! - g * dt;
          let vz = bv[o + 2]!;
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;
          // oni as a squat cylinder (radius 0.7, height 2.9)
          for (let k = 0; k < 2; k++) {
            const on = onis[k]!;
            const ox = x - on.root.position.x;
            const oz = z - on.root.position.z;
            const d2 = ox * ox + oz * oz;
            if (d2 < 0.49 && y < 2.95) {
              const d = Math.sqrt(d2) || 1e-3;
              const nx = ox / d;
              const nz = oz / d;
              const vn = vx * nx + vz * nz;
              if (vn < 0) {
                vx -= 1.5 * vn * nx;
                vz -= 1.5 * vn * nz;
                vy = Math.abs(vy) * 0.4 + 1.2;
                on.hit = Math.min(1, on.hit + 0.08);
              }
              x = on.root.position.x + nx * 0.71;
              z = on.root.position.z + nz * 0.71;
            }
          }
          if (y < R) {
            y = R;
            if (vy < -0.6) {
              vy = -vy * 0.42;
              vx *= 0.7;
              vz *= 0.7;
            } else {
              vy = 0;
              vx *= 0.9;
              vz *= 0.9;
              if (vx * vx + vz * vz < 0.004) bSleep[i] = 1;
            }
          }
          if (z < -3.1) {
            z = -3.1;
            vz = Math.abs(vz) * 0.3;
          }
          bp[o] = x;
          bp[o + 1] = y;
          bp[o + 2] = z;
          bv[o] = vx;
          bv[o + 1] = vy;
          bv[o + 2] = vz;
          const r = bRot[i]! + dt * 8 * Math.sqrt(vx * vx + vz * vz);
          bRot[i] = r;
          eul.set(r, r * 0.7, 0);
          q4.setFromEuler(eul);
          pv.set(x, y, z);
          beans.setMatrixAt(i, m4.compose(pv, q4, one));
        }
        beans.instanceMatrix.needsUpdate = true;

        // oni: groove sway, recoil when hit, club swings with the bass
        for (const on of onis) {
          on.hit *= Math.exp(-dt * 5);
          const h = on.hit;
          const groove = Math.sin(input.beatPhase * Math.PI * 2 + on.phase) * (0.25 + I * 0.75);
          const bounce = input.beatPulse * 0.08 * (0.4 + I);
          on.body.position.y = bounce + Math.max(0, groove) * 0.05;
          on.body.rotation.z = groove * 0.06 + on.side * h * 0.1;
          on.body.rotation.x = -h * 0.45;
          on.body.scale.set(1 + h * 0.12, 1 - h * 0.12 + input.beatPulse * 0.03, 1 + h * 0.12);
          on.head.rotation.x = -h * 0.5 + Math.sin(t * 1.3 + on.phase) * 0.05;
          on.head.rotation.z = Math.sin(t * 2.1 + on.phase) * 0.08 * (0.3 + I) + h * on.side * 0.2;
          on.root.position.x = on.baseX + on.side * h * 0.25;
          // club: raised and shaking with bass, dropped a little when hit
          on.clubArm.rotation.z = on.side * (0.5 + input.bass * 0.9 * (0.4 + I) - h * 0.6);
          on.clubArm.rotation.x = -0.3 - input.beatPulse * 0.25 * I + h * 0.4;
          on.otherArm.rotation.z = -on.side * (0.3 + Math.max(0, groove) * 0.35 + h * 0.8);
          on.skin.emissiveIntensity = 0.06 + h * 0.5 + input.high * 0.1;
        }

        // lights: oni glow tinted by the palette, pulsing with the bass
        const glow = 0.5 + input.bass * 1.5 + input.beatPulse * 0.8;
        redLight.color.copy(redC).lerp(cA, 0.4);
        redLight.intensity = 2 + glow * 3 + onis[0]!.hit * 6;
        blueLight.color.copy(blueC).lerp(cB, 0.4);
        blueLight.intensity = 2 + glow * 3 + onis[1]!.hit * 6;
        masuLight.color.copy(warmC).lerp(cC, 0.4);
        masuLight.intensity = 1.5 + glow * 1.5 + masuKick * 3;
        shojiMat.emissive.copy(shojiC).lerp(cC, 0.25);
        shojiMat.emissiveIntensity = 0.4 + input.bass * 0.35 + input.high * 0.2;

        // masu kicks upward on the throw
        masu.position.y = masuKick * 0.12 * (0.4 + I);
        masu.rotation.x = -masuKick * 0.18 * (0.4 + I);
        masu.scale.set(1 + masuKick * 0.05, 1 - masuKick * 0.06, 1 + masuKick * 0.05);

        // hiiragi-iwashi swings gently
        hiiragi.rotation.z = 0.25 + Math.sin(t * 1.2) * 0.05 + input.bass * 0.05;

        // camera: slow side-to-side dolly at a low angle, beat pushes in
        camPh += dt * (0.07 + I * 0.1);
        const sw = camPh;
        camera.position.set(Math.sin(sw) * 3.2, 2.1 + Math.sin(t * 0.17) * 0.3, 8.2 - input.beatPulse * 0.3 * I);
        look.set(Math.sin(sw) * 0.6, 1.5, -0.6);
        camera.lookAt(look);
        camera.fov = 50 - input.beatPulse * 1.5 * I;
        camera.updateProjectionMatrix();
      },
    };
  },
});
