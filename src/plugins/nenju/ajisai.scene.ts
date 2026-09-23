import { defineThreeScene } from '../api';

/**
 * 梅雨・紫陽花 (June). Seen from under a wooden eave: hydrangea bushes made of
 * instanced four-petal florets whose clusters drift between the palette
 * colours, rain streaks, puddles that bloom with ripples on every beat (a big
 * one on each downbeat), three teru-teru-bozu swinging from the eave, a paper
 * lantern breathing with the bass and an open janome umbrella left in the rain.
 */
export default defineThreeScene({
  id: 'nenju_ajisai',
  name: 'Ajisai 3D (three.js)',
  month: 6,
  group: 'nenju',
  description:
    '梅雨・紫陽花素材（3D）。軒先から雨の庭を眺める構図で、小さな花びらが集まった紫陽花の毬がパレット色のあいだをゆっくり移ろう。雨筋が降り、水たまりに拍ごとに波紋が広がり（小節頭で大きな輪）、軒のてるてる坊主がビートに押されて揺れる。提灯の灯りが低域で息づき、蛇の目の和傘が雨の中に開いている。しっとりと物憂げで、イントロやブレイクダウン、静かな場面に向く',
  short: '6月・梅雨と紫陽花（3D）。しっとり物憂げ。チル・ダウンテンポ',
  fov: 50,
  setup({ THREE, scene, camera }) {
    const fog = new THREE.Fog('#10141c', 7, 26);
    scene.fog = fog;

    // --- lights ---
    scene.add(new THREE.HemisphereLight(0x9fb4d6, 0x1a1f1a, 0.6));
    const moon = new THREE.DirectionalLight(0xc8d6f0, 0.55);
    moon.position.set(-5, 9, 4);
    scene.add(moon);
    const lanternLight = new THREE.PointLight(0xffb070, 4, 11, 1.6);
    const bushLight = new THREE.PointLight(0x8fa0ff, 3, 10, 1.5);
    bushLight.position.set(0.5, 2.6, -0.8);
    const glintLight = new THREE.PointLight(0xa0e0ff, 2, 9, 1.5);
    glintLight.position.set(2.2, 1.3, 2.2);
    scene.add(lanternLight, bushLight, glintLight);

    // --- ground, stepping stones, puddles ---
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.88 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: 0.55, metalness: 0.1 });
    const stones: [number, number, number][] = [
      [-2.6, 2.4, 0.55],
      [-1.4, 1.3, 0.5],
      [-0.2, 2.1, 0.6],
      [1.1, 1.0, 0.5],
      [2.6, 1.8, 0.58],
    ];
    for (const [x, z, r] of stones) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.12, 14), stoneMat);
      s.scale.set(1, 1, 0.75 + Math.random() * 0.2);
      s.rotation.y = Math.random() * Math.PI;
      s.position.set(x, 0.06, z);
      scene.add(s);
    }
    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0b0f16, metalness: 0.85, roughness: 0.08 });
    interface Puddle {
      x: number;
      z: number;
      r: number;
    }
    const puddles: Puddle[] = [
      { x: 0.6, z: 3.4, r: 1.5 },
      { x: -3.6, z: 0.8, r: 1.0 },
      { x: 3.4, z: -0.2, r: 0.9 },
      { x: -1.2, z: -0.4, r: 0.75 },
    ];
    for (const pd of puddles) {
      const sh = new THREE.Shape();
      const seg = 28;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const rr = pd.r * (1 + 0.12 * Math.sin(a * 3 + pd.x) + 0.06 * Math.sin(a * 5 + pd.z));
        if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), puddleMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(pd.x, 0.008, pd.z);
      scene.add(m);
    }

    // --- hydrangea bushes ---
    const BUSHES: [number, number, number][] = [
      [-5.4, -2.6, 1.1],
      [-3.0, -3.4, 1.25],
      [-0.6, -3.0, 1.15],
      [1.9, -3.5, 1.3],
      [4.3, -2.7, 1.15],
      [6.2, -1.4, 0.95],
    ];
    // soil hues: blue, purple, pink by bush (mixed with the palette each frame)
    const SOIL = [0x4f6fd6, 0x8a5cc9, 0x5b7fe0, 0xd07aa8, 0x7563d0, 0x5d8ad8].map((h) => new THREE.Color(h));
    const CLUSTERS_PER_BUSH = 6;
    const FLORETS = 80;
    const CLUSTER_R = 0.38;
    const nClusters = BUSHES.length * CLUSTERS_PER_BUSH;
    const nFlorets = nClusters * FLORETS;

    const floretShapes: InstanceType<typeof THREE.Shape>[] = [];
    const fr = 0.085;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.quadraticCurveTo(Math.cos(a - 0.55) * fr * 1.1, Math.sin(a - 0.55) * fr * 1.1, Math.cos(a) * fr, Math.sin(a) * fr);
      s.quadraticCurveTo(Math.cos(a + 0.55) * fr * 1.1, Math.sin(a + 0.55) * fr * 1.1, 0, 0);
      floretShapes.push(s);
    }
    const floretGeo = new THREE.ShapeGeometry(floretShapes, 3);
    const floretMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide });
    const florets = new THREE.InstancedMesh(floretGeo, floretMat, nFlorets);
    florets.frustumCulled = false;
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(CLUSTER_R * 0.93, 14, 10), coreMat, nClusters);
    cores.frustumCulled = false;
    const bushGroup = new THREE.Group();
    bushGroup.add(florets, cores);
    scene.add(bushGroup);

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const q2 = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const clusterBush = new Uint8Array(nClusters);
    const clusterSeed = new Float32Array(nClusters);
    const floretCluster = new Uint16Array(nFlorets);
    const floretVary = new Float32Array(nFlorets);
    const golden = Math.PI * (3 - Math.sqrt(5));
    let fi = 0;
    for (let b = 0; b < BUSHES.length; b++) {
      const [bx, bz, bs] = BUSHES[b]!;
      for (let k = 0; k < CLUSTERS_PER_BUSH; k++) {
        const ci = b * CLUSTERS_PER_BUSH + k;
        clusterBush[ci] = b;
        clusterSeed[ci] = Math.random();
        const ang = (k / CLUSTERS_PER_BUSH) * Math.PI * 2 + Math.random() * 0.6;
        const rad = k === 0 ? 0 : (0.45 + Math.random() * 0.25) * bs;
        const cx = bx + Math.cos(ang) * rad;
        const cz = bz + Math.sin(ang) * rad * 0.8 + (k === 0 ? 0.1 : 0);
        const cy = (k === 0 ? 1.55 : 0.85 + Math.random() * 0.5) * bs;
        const cs = (0.85 + Math.random() * 0.3) * bs;
        v.set(cx, cy, cz);
        sc.setScalar(cs);
        m4.compose(v, q.identity(), sc);
        cores.setMatrixAt(ci, m4);
        for (let j = 0; j < FLORETS; j++) {
          // fibonacci sphere, skipping the very bottom where it meets the leaves
          const y = 1 - ((j + 0.5) / FLORETS) * 1.75;
          const r = Math.sqrt(Math.max(0, 1 - y * y));
          const th = j * golden;
          n.set(Math.cos(th) * r, y, Math.sin(th) * r).normalize();
          q.setFromUnitVectors(zAxis, n);
          q2.setFromAxisAngle(zAxis, Math.random() * Math.PI);
          q.multiply(q2);
          v.copy(n).multiplyScalar(CLUSTER_R * cs * (1 + Math.random() * 0.06));
          v.x += cx;
          v.y += cy;
          v.z += cz;
          sc.setScalar(cs * (0.8 + Math.random() * 0.45));
          m4.compose(v, q, sc);
          florets.setMatrixAt(fi, m4);
          floretCluster[fi] = ci;
          floretVary[fi] = (Math.random() - 0.5) * 0.3;
          fi++;
        }
      }
    }
    // allocate instance colours up front so the first compile already has them
    const white0 = new THREE.Color(0xffffff);
    for (let i = 0; i < nFlorets; i++) florets.setColorAt(i, white0);
    for (let i = 0; i < nClusters; i++) cores.setColorAt(i, white0);
    // leaves around each bush
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.17, 0.18, 0, 0.5);
    leafShape.quadraticCurveTo(-0.17, 0.18, 0, 0);
    const LEAVES_PER = 20;
    const leaves = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(leafShape, 4),
      new THREE.MeshStandardMaterial({ color: 0x2c5a2e, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }),
      BUSHES.length * LEAVES_PER,
    );
    const eul = new THREE.Euler();
    let li = 0;
    for (const [bx, bz, bs] of BUSHES) {
      for (let k = 0; k < LEAVES_PER; k++) {
        const a = (k / LEAVES_PER) * Math.PI * 2 + Math.random() * 0.3;
        const rr = (0.5 + Math.random() * 0.55) * bs;
        v.set(bx + Math.cos(a) * rr, (0.25 + Math.random() * 0.75) * bs, bz + Math.sin(a) * rr * 0.8);
        eul.set(-0.9 - Math.random() * 0.6, -a + Math.PI / 2, (Math.random() - 0.5) * 0.6, 'YXZ');
        q.setFromEuler(eul);
        sc.setScalar(bs * (1 + Math.random() * 0.6));
        m4.compose(v, q, sc);
        leaves.setMatrixAt(li++, m4);
      }
    }
    scene.add(leaves);

    // --- eave, teru-teru-bozu, lantern ---
    const EAVE_Y = 5.1;
    const EAVE_Z = 3.4;
    const wood = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.7 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 0.28, 0.32), wood);
    beam.position.set(0, EAVE_Y, EAVE_Z);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(21, 0.14, 2.2), new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.6, metalness: 0.2 }));
    roof.position.set(0, EAVE_Y + 0.35, EAVE_Z + 0.7);
    roof.rotation.x = -0.18;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, EAVE_Y, 0.3), wood);
    post.position.set(-6.8, EAVE_Y / 2, EAVE_Z);
    scene.add(beam, roof, post);

    const cloth = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.9, side: THREE.DoubleSide });
    const ink = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    const ribbon = new THREE.MeshStandardMaterial({ color: 0xc8283c, roughness: 0.6 });
    const stringMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 });
    const skirtGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.05, 0),
        new THREE.Vector2(0.16, -0.06),
        new THREE.Vector2(0.28, -0.26),
        new THREE.Vector2(0.37, -0.5),
        new THREE.Vector2(0.42, -0.62),
      ],
      20,
    );
    interface Bozu {
      pivot: InstanceType<typeof THREE.Group>;
      len: number;
      th: number;
      om: number;
      phase: number;
    }
    const bozus: Bozu[] = [];
    for (const [x, len] of [
      [-1.4, 0.7],
      [0.5, 1.05],
      [2.3, 0.8],
    ] as [number, number][]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, EAVE_Y - 0.14, EAVE_Z);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 5), stringMat);
      str.position.y = -len / 2;
      pivot.add(str);
      const body = new THREE.Group();
      body.position.y = -len - 0.24;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), cloth);
      body.add(head);
      const skirt = new THREE.Mesh(skirtGeo, cloth);
      skirt.position.y = -0.2;
      body.add(skirt);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 16), ribbon);
      tie.rotation.x = Math.PI / 2;
      tie.position.y = -0.23;
      body.add(tie);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), ink);
        eye.position.set(side * 0.085, 0.04, 0.245);
        body.add(eye);
      }
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 5, 12, Math.PI), ink);
      mouth.rotation.z = Math.PI;
      mouth.position.set(0, -0.03, 0.245);
      body.add(mouth);
      pivot.add(body);
      scene.add(pivot);
      bozus.push({ pivot, len: len + 0.3, th: (Math.random() - 0.5) * 0.2, om: 0, phase: Math.random() * 6 });
    }

    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffb060, emissiveIntensity: 0.8, roughness: 0.9 });
    const lantern = new THREE.Group();
    const lBody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), lanternMat);
    lBody.scale.y = 1.35;
    lantern.add(lBody);
    for (const sy of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), ink);
      cap.position.y = sy * 0.42;
      lantern.add(cap);
    }
    lantern.position.set(-4.4, EAVE_Y - 0.75, EAVE_Z);
    const lStr = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), stringMat);
    lStr.position.set(-4.4, EAVE_Y - 0.26, EAVE_Z);
    scene.add(lantern, lStr);
    lanternLight.position.copy(lantern.position);

    // --- janome umbrella left open in the rain ---
    const jc = document.createElement('canvas');
    jc.width = 256;
    jc.height = 128;
    const jx = jc.getContext('2d')!;
    jx.fillStyle = '#b3202c';
    jx.fillRect(0, 0, 256, 128);
    jx.fillStyle = '#f2ece0';
    jx.fillRect(0, 46, 256, 30);
    jx.fillStyle = 'rgba(40,10,10,0.55)';
    for (let i = 0; i < 24; i++) jx.fillRect((i / 24) * 256, 0, 2, 128);
    const janome = new THREE.CanvasTexture(jc);
    janome.colorSpace = THREE.SRGBColorSpace;
    const umbrella = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.5, 24, 1, true), new THREE.MeshStandardMaterial({ map: janome, roughness: 0.6, side: THREE.DoubleSide }));
    canopy.position.y = 1.5;
    umbrella.add(canopy);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), wood);
    handle.position.y = 0.9;
    umbrella.add(handle);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), wood);
    knob.position.y = 1.78;
    umbrella.add(knob);
    const umbrellaTilt = new THREE.Group();
    umbrellaTilt.position.set(4.7, 0.12, 1.4);
    umbrellaTilt.rotation.set(-0.15, 0.4, -0.8);
    umbrellaTilt.add(umbrella);
    scene.add(umbrellaTilt);

    // --- rain streaks ---
    const RAIN = 1400;
    const rainMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.32, depthWrite: false });
    const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.55, 0.012), rainMat, RAIN);
    rain.frustumCulled = false;
    scene.add(rain);
    const rx = new Float32Array(RAIN);
    const ry = new Float32Array(RAIN);
    const rz = new Float32Array(RAIN);
    const rv = new Float32Array(RAIN);
    for (let i = 0; i < RAIN; i++) {
      rx[i] = (Math.random() - 0.5) * 22;
      ry[i] = Math.random() * 12;
      rz[i] = -7 + Math.random() * 16;
      rv[i] = 8 + Math.random() * 5;
    }
    const WIND = 0.12;
    const rainQ = new THREE.Quaternion().setFromAxisAngle(zAxis, WIND);
    const one = new THREE.Vector3(1, 1, 1);

    // --- ripples (additive rings, colour fades to black) ---
    const RIPPLES = 48;
    const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ripples = new THREE.InstancedMesh(new THREE.RingGeometry(0.9, 1, 48), rippleMat, RIPPLES);
    ripples.frustumCulled = false;
    scene.add(ripples);
    const rpX = new Float32Array(RIPPLES);
    const rpZ = new Float32Array(RIPPLES);
    const rpAge = new Float32Array(RIPPLES).fill(99);
    const rpLife = new Float32Array(RIPPLES).fill(1);
    const rpMax = new Float32Array(RIPPLES);
    const rpBright = new Float32Array(RIPPLES);
    const flatQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const black0 = new THREE.Color(0, 0, 0);
    for (let i = 0; i < RIPPLES; i++) ripples.setColorAt(i, black0);
    let rpNext = 0;
    const spawnRipple = (pi: number, big: boolean): void => {
      const pd = puddles[pi]!;
      const i = rpNext;
      rpNext = (rpNext + 1) % RIPPLES;
      const a = Math.random() * Math.PI * 2;
      const d = big ? 0 : Math.random() * pd.r * 0.55;
      rpX[i] = pd.x + Math.cos(a) * d;
      rpZ[i] = pd.z + Math.sin(a) * d;
      rpAge[i] = 0;
      rpLife[i] = big ? 2.2 : 0.9 + Math.random() * 0.5;
      rpMax[i] = big ? pd.r * 0.95 : 0.25 + Math.random() * Math.min(0.35, pd.r * 0.35);
      rpBright[i] = big ? 1 : 0.55;
    };

    // --- per-frame state ---
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const col = new THREE.Color();
    const tmp = new THREE.Color();
    const warm = new THREE.Color(0xffb070);
    const white = new THREE.Color(0xffffff);
    const clusterCol: InstanceType<typeof THREE.Color>[] = [];
    for (let i = 0; i < nClusters; i++) clusterCol.push(new THREE.Color());
    let lastBeat = -1;
    let lastBar = -1;
    let rainAcc = 0;
    let spin = 0;
    let spinVel = 0.15;

    const mixPalette = (p: number, out: InstanceType<typeof THREE.Color>): void => {
      const x = (((p % 1) + 1) % 1) * 3;
      if (x < 1) out.copy(cA).lerp(cB, x);
      else if (x < 2) out.copy(cB).lerp(cC, x - 1);
      else out.copy(cC).lerp(cA, x - 2);
    };

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

        // beats: ripples on every beat, a big ring and a push on the downbeat
        const newBeat = input.beat !== lastBeat;
        const newBar = input.bar !== lastBar;
        if (newBeat && lastBeat >= 0) {
          const k = 1 + Math.round(I * 2);
          for (let i = 0; i < k; i++) spawnRipple(1 + Math.floor(Math.random() * (puddles.length - 1)), false);
          for (const b of bozus) b.om += (0.25 + I * 0.55) * (Math.sin(b.phase + input.beat * 1.7) >= 0 ? 1 : -1) * 0.5;
        }
        if (newBar && lastBar >= 0) {
          spawnRipple(0, true);
          for (const b of bozus) b.om += (0.35 + I * 0.8) * (input.bar % 2 === 0 ? 1 : -1);
          spinVel += 0.6 * (0.4 + I);
        }
        lastBeat = input.beat;
        lastBar = input.bar;
        // raindrop ripples between beats
        rainAcc += dt * (1.5 + I * 7);
        while (rainAcc > 1) {
          rainAcc -= 1;
          spawnRipple(Math.floor(Math.random() * puddles.length), false);
        }

        // camera: slow arc under the eave, beat and bass nudge it in
        camPh += dt * (0.035 + I * 0.05);
        const arc = Math.sin(camPh) * 0.42;
        const radius = 10.8 - input.beatPulse * 0.35 * I - input.bass * 0.25;
        camera.fov = 50 - input.beatPulse * 0.8 * I;
        camera.updateProjectionMatrix();
        camera.position.set(Math.sin(arc) * radius, 2.5 + Math.sin(t * 0.11) * 0.35, Math.cos(arc) * radius + 1.2);
        camera.lookAt(0, 1.7, -0.4);

        // hydrangea clusters drift between palette colours, soil hue underneath
        colPh += dt * (0.012 + I * 0.03);
        const drift = colPh;
        for (let ci = 0; ci < nClusters; ci++) {
          mixPalette(clusterSeed[ci]! + drift + clusterBush[ci]! * 0.17, col);
          col.lerp(SOIL[clusterBush[ci]!]!, 0.45);
          clusterCol[ci]!.copy(col);
          tmp.copy(col).multiplyScalar(0.45);
          cores.setColorAt(ci, tmp);
        }
        for (let i = 0; i < nFlorets; i++) {
          tmp.copy(clusterCol[floretCluster[i]!]!).multiplyScalar(1 + floretVary[i]!);
          florets.setColorAt(i, tmp);
        }
        if (florets.instanceColor) florets.instanceColor.needsUpdate = true;
        if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
        floretMat.emissive.copy(cB).multiplyScalar(0.05 + input.high * 0.18 + input.beatPulse * 0.08 * I);
        const swell = 1 + input.bass * 0.025 + input.beatPulse * 0.012 * I;
        bushGroup.scale.set(1, swell, 1);

        // teru-teru-bozu: damped pendulums, pushed on the beat
        for (const b of bozus) {
          const g = 9.8 / b.len;
          b.om += (-g * Math.sin(b.th) - b.om * 0.9) * dt;
          b.om += Math.sin(t * 0.7 + b.phase) * 0.12 * dt; // breeze
          b.th += b.om * dt;
          if (b.th > 0.7) b.th = 0.7;
          if (b.th < -0.7) b.th = -0.7;
          b.pivot.rotation.z = b.th;
          b.pivot.rotation.x = Math.sin(t * 0.9 + b.phase) * 0.06;
          b.pivot.rotation.y = Math.sin(t * 0.3 + b.phase) * 0.25;
        }

        // lantern + point lights breathe with the bass, tinted by the palette
        const glow = 0.5 + input.bass * 1.3 + input.beatPulse * 0.6 * I;
        lanternLight.color.copy(warm).lerp(cA, 0.35);
        lanternLight.intensity = 2.5 + glow * 3.5;
        lanternMat.emissiveIntensity = 0.45 + glow * 0.45;
        lanternMat.emissive.copy(warm).lerp(cA, 0.25);
        bushLight.color.copy(cB).lerp(white, 0.3);
        bushLight.intensity = 2 + input.bass * 3 + input.mid * 1.5;
        glintLight.color.copy(cC).lerp(white, 0.4);
        glintLight.intensity = 1.2 + input.high * 4;

        // umbrella slowly turns, kicked on the downbeat
        spinVel += (0.12 + I * 0.2 - spinVel) * dt * 0.8;
        spin += spinVel * dt;
        umbrella.rotation.y = spin;

        // rain: denser and faster with intensity
        const active = Math.floor(RAIN * (0.4 + 0.6 * I));
        rain.count = active;
        const fall = 0.75 + I * 0.55;
        for (let i = 0; i < active; i++) {
          let y = ry[i]! - rv[i]! * fall * dt;
          let x = rx[i]! + rv[i]! * fall * dt * WIND;
          if (y < 0) {
            y += 12;
            x = (Math.random() - 0.5) * 22;
          }
          if (x > 11) x -= 22;
          ry[i] = y;
          rx[i] = x;
          v.set(x, y, rz[i]!);
          m4.compose(v, rainQ, one);
          rain.setMatrixAt(i, m4);
        }
        rain.instanceMatrix.needsUpdate = true;
        rainMat.color.copy(cC).lerp(white, 0.65);
        rainMat.opacity = 0.2 + 0.18 * I + input.high * 0.12;

        // ripples expand and fade
        tmp.copy(cA).lerp(white, 0.5);
        for (let i = 0; i < RIPPLES; i++) {
          const age = (rpAge[i]! += dt);
          const u = age / rpLife[i]!;
          if (u >= 1) {
            sc.setScalar(0.0001);
            col.setRGB(0, 0, 0);
          } else {
            const e = 1 - (1 - u) * (1 - u);
            sc.setScalar(0.02 + rpMax[i]! * e);
            col.copy(tmp).multiplyScalar((1 - u) * rpBright[i]! * (0.6 + 0.4 * I));
          }
          v.set(rpX[i]!, 0.015, rpZ[i]!);
          m4.compose(v, flatQ, sc);
          ripples.setMatrixAt(i, m4);
          ripples.setColorAt(i, col);
        }
        ripples.instanceMatrix.needsUpdate = true;
        if (ripples.instanceColor) ripples.instanceColor.needsUpdate = true;
      },
      reset() {
        rpAge.fill(99);
        lastBeat = -1;
        lastBar = -1;
        for (const b of bozus) {
          b.th = 0;
          b.om = 0;
        }
      },
    };
  },
});
