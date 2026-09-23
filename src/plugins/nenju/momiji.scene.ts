import { defineThreeScene } from '../api';

/**
 * Momiji-gari (October): an autumn valley at dusk. Maple trees in reds and
 * oranges line a stream crossed by a vermilion taiko-bashi, stone lanterns
 * glow with the bass, mountains fade into the fog behind a pale moon, and
 * star-shaped momiji leaves spiral down. Signature moment: every beat sends a
 * gust through the valley (trees bow, leaves whirl sideways), and the bar
 * downbeat is the big one.
 */
export default defineThreeScene({
  id: 'nenju_momiji',
  name: 'Momiji-gari 3D (three.js)',
  group: 'nenju',
  month: 10,
  description:
    '紅葉狩り素材（3D）。夕暮れの渓谷に赤や橙のもみじの木が並び、朱塗りの太鼓橋が小川に架かる。石灯籠の灯りが低域で揺らぎ、星形のもみじの葉がくるくると舞い落ちる。拍ごとに谷を風が吹き抜けて木々がしなり、小節頭で大きな一陣の風が葉を巻き上げる。カメラは橋のまわりをゆったり行き来する。温かく豊かな雰囲気で、腰の据わったグルーヴが続く場面に向く',
  short: '10月・紅葉狩り（3D）。温かく豊か。安定したグルーヴ',
  fov: 45,
  setup({ THREE, scene, camera }) {
    const fog = new THREE.Fog('#1a0d08', 18, 55);
    scene.fog = fog;

    // ---------------------------------------------------------------- lights
    scene.add(new THREE.HemisphereLight(0xffd8b0, 0x2a1408, 0.55));
    const sun = new THREE.DirectionalLight(0xffa860, 1.3);
    sun.position.set(-10, 8, 6);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xff7040, 0.45);
    rim.position.set(8, 5, -10);
    scene.add(rim);

    // ---------------------------------------------------------------- ground + stream
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90, 1, 1), groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    // fallen-leaf carpet: scattered tiny discs baked into a texture
    const carpetCv = document.createElement('canvas');
    carpetCv.width = carpetCv.height = 256;
    const cc = carpetCv.getContext('2d')!;
    cc.fillStyle = '#4a2a14';
    cc.fillRect(0, 0, 256, 256);
    const carpetCols = ['#b8321c', '#d65a1e', '#e89a2a', '#8a2414', '#6a3a18'];
    for (let i = 0; i < 900; i++) {
      cc.fillStyle = carpetCols[i % carpetCols.length]!;
      cc.globalAlpha = 0.5 + Math.random() * 0.5;
      cc.beginPath();
      cc.arc(Math.random() * 256, Math.random() * 256, 1.5 + Math.random() * 3, 0, Math.PI * 2);
      cc.fill();
    }
    const carpetTex = new THREE.CanvasTexture(carpetCv);
    carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(14, 14);
    carpetTex.colorSpace = THREE.SRGBColorSpace;
    groundMat.map = carpetTex;

    // stream runs along x; ripples are a scrolling canvas texture
    const waterCv = document.createElement('canvas');
    waterCv.width = 128;
    waterCv.height = 128;
    const wc = waterCv.getContext('2d')!;
    wc.fillStyle = '#10222e';
    wc.fillRect(0, 0, 128, 128);
    wc.strokeStyle = 'rgba(200,230,255,0.35)';
    wc.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const y0 = Math.random() * 128;
      const x0 = Math.random() * 128;
      wc.beginPath();
      wc.moveTo(x0, y0);
      wc.quadraticCurveTo(x0 + 10, y0 - 3, x0 + 22 + Math.random() * 16, y0);
      wc.stroke();
    }
    const waterTex = new THREE.CanvasTexture(waterCv);
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(16, 1.2);
    waterTex.colorSpace = THREE.SRGBColorSpace;
    const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.15, metalness: 0.4, emissive: 0x000000, emissiveMap: waterTex, emissiveIntensity: 0.4 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 4.2), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.03;
    scene.add(water);
    // stone banks
    const stoneGeo = new THREE.DodecahedronGeometry(0.35, 0);
    const STONES = 70;
    const stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.95, flatShading: true }), STONES);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < STONES; i++) {
      p.set((Math.random() - 0.5) * 44, 0.05, (i % 2 === 0 ? 1 : -1) * (2.1 + Math.random() * 0.3));
      e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      q.setFromEuler(e);
      const k = 0.5 + Math.random() * 0.9;
      s.set(k * 1.3, k * 0.6, k);
      stones.setMatrixAt(i, m4.compose(p, q, s));
    }
    scene.add(stones);

    // ---------------------------------------------------------------- taiko-bashi (arched bridge across the stream, along z)
    const VERMILION = 0xd4381e;
    const bridge = new THREE.Group();
    const span = 6.4;
    const rise = 1.5;
    const archY = (u: number): number => Math.sin(Math.PI * u) * rise + 0.25;
    const PLANKS = 26;
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.85 });
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.08, span / PLANKS + 0.02), plankMat, PLANKS);
    for (let i = 0; i < PLANKS; i++) {
      const u = (i + 0.5) / PLANKS;
      const z = -span / 2 + span * u;
      const slope = Math.atan2(Math.cos(Math.PI * u) * rise * Math.PI, span);
      e.set(-slope, 0, 0);
      q.setFromEuler(e);
      p.set(0, archY(u), z);
      s.set(1, 1, 1);
      planks.setMatrixAt(i, m4.compose(p, q, s));
    }
    bridge.add(planks);
    const lacquer = new THREE.MeshStandardMaterial({ color: VERMILION, roughness: 0.45, emissive: 0x3a0800, emissiveIntensity: 0.5 });
    // side beams and handrails follow the arch
    for (const side of [-1, 1]) {
      const beamPts: InstanceType<typeof THREE.Vector3>[] = [];
      const railPts: InstanceType<typeof THREE.Vector3>[] = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        const z = -span / 2 + span * u;
        beamPts.push(new THREE.Vector3(side * 0.88, archY(u) - 0.1, z));
        railPts.push(new THREE.Vector3(side * 0.88, archY(u) + 0.72, z));
      }
      bridge.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beamPts), 40, 0.1, 8), lacquer));
      bridge.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 40, 0.055, 8), lacquer));
      // mid rail
      const midPts = railPts.map((v) => new THREE.Vector3(v.x, v.y - 0.36, v.z));
      bridge.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(midPts), 40, 0.035, 6), lacquer));
    }
    // posts with gold giboshi caps
    const POSTS = 7;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 10), lacquer, POSTS * 2);
    const caps = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0b44a, metalness: 0.85, roughness: 0.3, emissive: 0x4a3008 }),
      POSTS * 2,
    );
    q.identity();
    s.set(1, 1, 1);
    for (let i = 0; i < POSTS; i++) {
      const u = i / (POSTS - 1);
      const z = -span / 2 + span * u;
      for (let k = 0; k < 2; k++) {
        const x = (k === 0 ? -1 : 1) * 0.88;
        p.set(x, archY(u) + 0.35, z);
        posts.setMatrixAt(i * 2 + k, m4.compose(p, q, s));
        p.set(x, archY(u) + 0.84, z);
        caps.setMatrixAt(i * 2 + k, m4.compose(p, q, s));
      }
    }
    bridge.add(posts, caps);
    // piers in the water
    for (const z of [-1.6, 1.6]) {
      for (const x of [-0.7, 0.7]) {
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 8), lacquer);
        pier.position.set(x, 0.5, z);
        bridge.add(pier);
      }
    }
    scene.add(bridge);

    // ---------------------------------------------------------------- stone lanterns (ishi-doro)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.95, flatShading: true });
    const fireMats: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];
    const lights: InstanceType<typeof THREE.PointLight>[] = [];
    const lanternSpots: [number, number][] = [
      [-2.2, 3.4],
      [2.4, -3.3],
      [-7.5, -3.2],
    ];
    for (const [lx, lz] of lanternSpots) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 6), stoneMat);
      base.position.y = 0.11;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.9, 8), stoneMat);
      post.position.y = 0.66;
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.14, 6), stoneMat);
      tray.position.y = 1.17;
      const fireMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffa040, emissiveIntensity: 1.2, roughness: 0.8 });
      fireMats.push(fireMat);
      const fire = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.4), fireMat);
      fire.position.y = 1.42;
      // stone frame around the glowing box
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.2), stoneMat);
      frame.position.y = 1.42;
      const frame2 = frame.clone();
      frame2.rotation.y = Math.PI / 2;
      frame.scale.set(1, 1, 0.5);
      frame2.scale.set(1, 1, 0.5);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 6), stoneMat);
      roof.position.y = 1.82;
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), stoneMat);
      jewel.scale.y = 1.4;
      jewel.position.y = 2.1;
      g.add(base, post, tray, fire, frame, frame2, roof, jewel);
      g.position.set(lx, 0, lz);
      g.rotation.y = Math.random() * Math.PI;
      scene.add(g);
      const l = new THREE.PointLight(0xffa050, 4, 9, 1.6);
      l.position.set(lx, 1.45, lz);
      scene.add(l);
      lights.push(l);
    }

    // ---------------------------------------------------------------- mountains + moon
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x5a2416, roughness: 1, flatShading: true });
    const mountains: [number, number, number, number][] = [
      [-18, -30, 11, 14],
      [0, -36, 15, 17],
      [18, -31, 12, 15],
      [-32, -22, 9, 12],
      [32, -24, 10, 13],
    ];
    for (const [mx, mz, h, r] of mountains) {
      const mt = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 3), mountMat);
      mt.position.set(mx, h / 2 - 0.2, mz);
      mt.rotation.y = Math.random() * Math.PI;
      scene.add(mt);
    }
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), moonMat);
    moon.position.set(12, 17, -48);
    scene.add(moon);

    // ---------------------------------------------------------------- maple trees
    const TREES = 34;
    const CL = 6; // leaf clusters per tree
    const SLOPE = 220; // small clusters painted on the mountain slopes
    const LEAF_COLS = [0xc41e12, 0xe0441a, 0xf07a1e, 0xa8140e, 0xf2a93a, 0xd8321a];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2216, roughness: 0.9 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.2, 1, 7), trunkMat, TREES);
    const clusterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, flatShading: true, emissive: 0x2a0600, emissiveIntensity: 0.6 });
    const clusters = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), clusterMat, TREES * CL + SLOPE);
    const cBase = new Float32Array(TREES * CL * 4); // x, y, z, size (relative to trunk base)
    const treeX = new Float32Array(TREES);
    const treeZ = new Float32Array(TREES);
    const treeH = new Float32Array(TREES);
    const treePh = new Float32Array(TREES);
    const col = new THREE.Color();
    let ti = 0;
    let guard = 0;
    while (ti < TREES && guard++ < 5000) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 34 - 4;
      if (Math.abs(z) < 3.2) continue; // keep off the stream
      if (Math.abs(x) < 2.6 && Math.abs(z) < 5) continue; // keep the bridge ends clear
      if (z > 1 && Math.hypot(x, z) > 8.5) continue; // keep the camera's arc (radius ~15, front side) clear
      let near = false;
      for (const [lx, lz] of lanternSpots) if ((x - lx) ** 2 + (z - lz) ** 2 < 2.2) near = true;
      if (near) continue;
      const h = 2 + Math.random() * 1.6;
      treeX[ti] = x;
      treeZ[ti] = z;
      treeH[ti] = h;
      treePh[ti] = Math.random() * Math.PI * 2;
      p.set(x, h / 2, z);
      q.identity();
      s.set(1, h, 1);
      trunks.setMatrixAt(ti, m4.compose(p, q, s));
      for (let c = 0; c < CL; c++) {
        const a = (c / CL) * Math.PI * 2 + Math.random();
        const rr = c === 0 ? 0 : 0.7 + Math.random() * 0.5;
        const j = (ti * CL + c) * 4;
        cBase[j] = Math.cos(a) * rr;
        cBase[j + 1] = h + (c === 0 ? 0.7 : Math.random() * 0.7 - 0.1);
        cBase[j + 2] = Math.sin(a) * rr;
        cBase[j + 3] = c === 0 ? 1.15 : 0.7 + Math.random() * 0.4;
        col.setHex(LEAF_COLS[(ti + c * 3) % LEAF_COLS.length]!);
        clusters.setColorAt(ti * CL + c, col);
      }
      ti++;
    }
    const liveTrees = ti;
    // static slope clusters on the camera-facing side of the mountains
    for (let i = 0; i < SLOPE; i++) {
      const [mx, mz, h, r] = mountains[i % mountains.length]!;
      const f = Math.pow(Math.random(), 1.4) * 0.8;
      const a = Math.PI / 2 + (Math.random() - 0.5) * 2.4; // +z side faces the valley
      const rr = r * (1 - f) * 0.98;
      p.set(mx + Math.cos(a) * rr, f * h, mz + Math.sin(a) * rr);
      q.identity();
      const k = 0.9 + Math.random() * 1.1;
      s.set(k, k * 0.8, k);
      clusters.setMatrixAt(TREES * CL + i, m4.compose(p, q, s));
      col.setHex(LEAF_COLS[i % LEAF_COLS.length]!).multiplyScalar(0.7 + Math.random() * 0.3);
      clusters.setColorAt(TREES * CL + i, col);
    }
    // hide unused tree slots if placement ran out of room
    s.set(0, 0, 0);
    for (let i = liveTrees; i < TREES; i++) {
      trunks.setMatrixAt(i, m4.compose(p.set(0, -10, 0), q.identity(), s));
      for (let c = 0; c < CL; c++) clusters.setMatrixAt(i * CL + c, m4);
    }
    scene.add(trunks, clusters);

    // ---------------------------------------------------------------- falling momiji leaves (star shape, instanced)
    const leafShape = new THREE.Shape();
    const LOBES = 5;
    for (let i = 0; i <= LOBES * 2; i++) {
      const a = Math.PI / 2 + (i / (LOBES * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 1 : 0.42;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) leafShape.moveTo(x, y);
      else leafShape.lineTo(x, y);
    }
    const leafGeo = new THREE.ShapeGeometry(leafShape);
    leafGeo.scale(0.13, 0.13, 0.13);
    const LEAVES = 520;
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x3a0800, emissiveIntensity: 0.7 });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
    leaves.frustumCulled = false;
    const lx = new Float32Array(LEAVES);
    const ly = new Float32Array(LEAVES);
    const lz = new Float32Array(LEAVES);
    const lAng = new Float32Array(LEAVES);
    const lRad = new Float32Array(LEAVES);
    const lFall = new Float32Array(LEAVES);
    const lSpin = new Float32Array(LEAVES);
    const lRot = new Float32Array(LEAVES * 3);
    const lDx = new Float32Array(LEAVES); // per-leaf wind drift, wrapped
    const spawn = (i: number, top: boolean): void => {
      lx[i] = (Math.random() - 0.5) * 30;
      lz[i] = (Math.random() - 0.5) * 22;
      ly[i] = top ? 6 + Math.random() * 3 : Math.random() * 9;
      lAng[i] = Math.random() * Math.PI * 2;
      lRad[i] = 0.2 + Math.random() * 0.6;
      lFall[i] = 0.35 + Math.random() * 0.45;
      lSpin[i] = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2);
      lRot[i * 3] = Math.random() * 6;
      lRot[i * 3 + 1] = Math.random() * 6;
      lRot[i * 3 + 2] = Math.random() * 6;
    };
    for (let i = 0; i < LEAVES; i++) {
      spawn(i, false);
      col.setHex(LEAF_COLS[i % LEAF_COLS.length]!);
      leaves.setColorAt(i, col);
    }
    scene.add(leaves);

    // fireflies of warm light drifting near the water (sparkle with highs)
    const MOTES = 260;
    const motePos = new Float32Array(MOTES * 3);
    const moteSeed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      motePos[i * 3] = (Math.random() - 0.5) * 28;
      motePos[i * 3 + 1] = 0.3 + Math.random() * 3.5;
      motePos[i * 3 + 2] = (Math.random() - 0.5) * 18;
      moteSeed[i] = Math.random() * 100;
    }
    // the attribute gets its own copy: motePos stays the rest position the drift is added to
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos.slice(), 3));
    const moteMat = new THREE.PointsMaterial({ color: 0xffc070, size: 0.08, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    // ---------------------------------------------------------------- per-frame scratch
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const white = new THREE.Color(0xffffff);
    const warm = new THREE.Color(0xffa050);
    let gust = 0;
    let gustDir = 1;
    let lastBar = -1;
    let scroll = 0;

    // integrated phases: an intensity change never makes the camera jump
    let camPh = 0;
    const emberCol = new THREE.Color(0xff5a1e);
    return {
      reset() {
        gust = 0;
        lastBar = -1;
      },
      update(input) {
        const t = input.t;
        const dt = Math.min(input.dt, 0.05);
        const it = input.intensity;
        cA.set(input.palette.a);
        cB.set(input.palette.b);
        cC.set(input.palette.c);
        fog.color.set(input.palette.bg);

        // gust: every beat, bigger on the bar downbeat
        gust *= Math.exp(-dt * 2.6);
        const beatGust = input.beatPulse * (0.25 + 0.55 * it);
        if (beatGust > gust) gust = beatGust;
        if (input.bar !== lastBar) {
          if (lastBar >= 0) {
            gust = Math.max(gust, 0.7 + 0.6 * it);
            gustDir = input.bar % 4 === 3 ? -1 : 1;
          }
          lastBar = input.bar;
        }
        const windStep = gust * dt * 2.2 * gustDir;

        // camera: slow pendulum around the bridge, beat breathes it in
        camPh += dt * (0.05 + it * 0.08);
        const swing = Math.sin(camPh) * 0.75;
        const radius = 15 - input.beatPulse * 0.5 * it - input.bass * 0.4;
        camera.position.set(Math.sin(swing + 0.5) * radius, 3.6 + Math.sin(t * 0.13) * 0.9, Math.cos(swing + 0.5) * radius);
        camera.lookAt(0, 1.6, -1);

        // trees sway gently and bow with the gust
        const sway = 0.04 + it * 0.08;
        for (let i = 0; i < liveTrees; i++) {
          const x0 = treeX[i]!;
          const z0 = treeZ[i]!;
          const bend = Math.sin(t * 0.9 + treePh[i]!) * sway + gust * 0.35 * gustDir;
          for (let c = 0; c < CL; c++) {
            const j = (i * CL + c) * 4;
            const hy = cBase[j + 1]!;
            const k = cBase[j + 3]! * (1 + input.bass * 0.05);
            p.set(x0 + cBase[j]! + bend * hy * 0.25, hy - Math.abs(bend) * 0.08, z0 + cBase[j + 2]!);
            e.set(0, treePh[i]!, -bend * 0.3);
            q.setFromEuler(e);
            s.set(k, k * 0.85, k);
            clusters.setMatrixAt(i * CL + c, m4.compose(p, q, s));
          }
        }
        clusters.instanceMatrix.needsUpdate = true;
        // palette tints the foliage lightly (signature reds stay)
        // a cold palette multiplied into red leaves reads purple, so keep the tint small and the glow warm
        clusterMat.color.copy(white).lerp(cA, 0.08);
        clusterMat.emissive.copy(emberCol).lerp(cA, 0.2).multiplyScalar(0.12 + input.beatPulse * 0.08 * it);
        leafMat.color.copy(white).lerp(cB, 0.2);

        // lanterns breathe with the bass
        const glow = 0.5 + input.bass * 1.3 + input.beatPulse * 0.5;
        for (let i = 0; i < lights.length; i++) {
          const flick = 1 + Math.sin(t * 7.3 + i * 2.1) * 0.05 + Math.sin(t * 13.1 + i) * 0.03;
          lights[i]!.intensity = (2.5 + glow * 3.5) * flick;
          lights[i]!.color.copy(warm).lerp(cC, 0.3);
          fireMats[i]!.emissiveIntensity = (0.8 + glow * 0.6) * flick;
        }
        lacquer.emissiveIntensity = 0.35 + input.beatPulse * 0.35 * it;

        // stream flows; highs make it glint
        scroll += dt * (0.12 + it * 0.2);
        waterTex.offset.x = scroll;
        waterMat.emissive.copy(cC).multiplyScalar(0.25 + input.high * 0.8);
        moonMat.color.copy(white).lerp(cC, 0.15);

        // leaves spiral down; the gust whirls them sideways
        const fallK = 0.6 + it * 0.8;
        for (let i = 0; i < LEAVES; i++) {
          lAng[i] = lAng[i]! + dt * lSpin[i]! * (0.6 + gust * 1.5);
          ly[i] = ly[i]! - dt * lFall[i]! * fallK + gust * dt * 0.35;
          lRot[i * 3] = lRot[i * 3]! + dt * lSpin[i]! * (0.8 + gust * 3);
          lRot[i * 3 + 1] = lRot[i * 3 + 1]! + dt * 1.1;
          if (ly[i]! > 0.05) lDx[i] = (lDx[i]! + windStep * lFall[i]! * 2) % 30;
          let x = lx[i]! + Math.cos(lAng[i]!) * lRad[i]! + lDx[i]!;
          x = ((((x + 15) % 30) + 30) % 30) - 15;
          if (ly[i]! < 0.04) {
            // rest on the ground a moment, then respawn at the top
            ly[i] = 0.04;
            if (Math.random() < dt * 0.8) spawn(i, true);
          }
          p.set(x, ly[i]!, lz[i]! + Math.sin(lAng[i]!) * lRad[i]!);
          const grounded = ly[i]! <= 0.05;
          e.set(grounded ? -Math.PI / 2 : lRot[i * 3]!, lRot[i * 3 + 1]!, grounded ? 0 : lRot[i * 3 + 2]!);
          q.setFromEuler(e);
          const k = 1 + input.beatPulse * 0.15 * it;
          s.set(k, k, k);
          leaves.setMatrixAt(i, m4.compose(p, q, s));
        }
        leaves.instanceMatrix.needsUpdate = true;

        // motes twinkle with the highs
        const mp = motes.geometry.attributes.position as InstanceType<typeof THREE.BufferAttribute>;
        for (let i = 0; i < MOTES; i++) {
          const sd = moteSeed[i]!;
          mp.setY(i, motePos[i * 3 + 1]! + Math.sin(t * 0.7 + sd) * 0.3);
          mp.setX(i, motePos[i * 3]! + Math.sin(t * 0.3 + sd * 1.7) * 0.5);
        }
        mp.needsUpdate = true;
        moteMat.size = 0.05 + input.high * 0.12 + it * 0.02;
        moteMat.opacity = 0.35 + input.high * 0.6;
        moteMat.color.copy(warm).lerp(cC, 0.5);
      },
    };
  },
});
