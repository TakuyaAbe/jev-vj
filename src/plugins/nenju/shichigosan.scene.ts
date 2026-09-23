import { defineThreeScene } from '../api';

/**
 * Shichi-go-san (November): walking up a shrine approach through a tunnel of
 * vermilion torii (senbon-torii). The camera dollies forward in time with the
 * bar, surging on every beat; chitose-ame bags and pinwheels line the path,
 * the pinwheels spin with the energy, and at the end of the tunnel the haiden
 * waits with a shimenawa, paper shide and a big gold suzu. Signature moment:
 * the suzu swings and flashes on the beat, and rings out hard (with the rope
 * and shide shaking) on each bar downbeat.
 */
export default defineThreeScene({
  id: 'nenju_shichigosan',
  name: 'Shichigosan 3D (three.js)',
  group: 'nenju',
  month: 11,
  description:
    '七五三・神社素材（3D）。朱色の千本鳥居が連なる参道を、小節に合わせてカメラが奥へ奥へと進み、拍ごとにぐっと前へ押し出される。道端には千歳飴の袋と色とりどりの風車が並び、風車は音の勢いで回る。鳥居の先には拝殿としめ縄、金の鈴が待ち、鈴は拍で揺れて光り、小節頭で大きく鳴ってしめ縄と紙垂が震える。静かな時はゆっくり歩き、盛り上がると一気に駆け抜ける。前へ進む高揚感があり、ビルドアップからドロップへの流れに向く',
  short: '11月・七五三と千本鳥居（3D）。疾走・前進感。ハイテンポの走り',
  fov: 58,
  setup({ THREE, scene, camera }) {
    const fog = new THREE.Fog('#140806', 10, 40);
    scene.fog = fog;

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const col = new THREE.Color();

    // ---------------------------------------------------------------- lights
    scene.add(new THREE.HemisphereLight(0xfff0e0, 0x301410, 0.6));
    const key = new THREE.DirectionalLight(0xffe0c0, 0.9);
    key.position.set(4, 10, 3);
    scene.add(key);

    // ---------------------------------------------------------------- stone path + gravel
    const pathCv = document.createElement('canvas');
    pathCv.width = 128;
    pathCv.height = 256;
    const pc = pathCv.getContext('2d')!;
    pc.fillStyle = '#6e6660';
    pc.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 2; c++) {
        const off = r % 2 === 0 ? 0 : 32;
        const shade = 110 + Math.floor(Math.random() * 40);
        pc.fillStyle = `rgb(${shade},${shade - 6},${shade - 12})`;
        pc.fillRect(((c * 64 + off) % 128) + 2, r * 32 + 2, 60, 28);
      }
    }
    const pathTex = new THREE.CanvasTexture(pathCv);
    pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping;
    pathTex.colorSpace = THREE.SRGBColorSpace;
    const PATH_LEN = 200;
    pathTex.repeat.set(1, PATH_LEN / 2.4);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.8, PATH_LEN), new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.95 }));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.01;
    scene.add(path);
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(40, PATH_LEN), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 1 }));
    gravel.rotation.x = -Math.PI / 2;
    scene.add(gravel);

    // ---------------------------------------------------------------- senbon torii (instanced parts, recycled around the camera)
    const N = 14;
    const GAP = 1.5;
    const AHEAD = 18; // the haiden sits this far ahead of the camera
    const TW = 1.35; // half width between pillars
    const TH = 3.1;
    const vermilion = new THREE.MeshStandardMaterial({ color: 0xe0401c, roughness: 0.5, emissive: 0x3a0a00, emissiveIntensity: 0.5 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.6 });
    const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, TH, 12), vermilion, N * 2);
    const bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12), black, N * 2);
    const kasagi = new THREE.InstancedMesh(new THREE.BoxGeometry(TW * 2 + 1.0, 0.18, 0.3), vermilion, N);
    const kasagiTop = new THREE.InstancedMesh(new THREE.BoxGeometry(TW * 2 + 1.15, 0.08, 0.34), black, N);
    const nuki = new THREE.InstancedMesh(new THREE.BoxGeometry(TW * 2 + 0.5, 0.13, 0.16), vermilion, N);
    const gakuzuka = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.42, 0.1), vermilion, N);
    const parts = [pillars, bases, kasagi, kasagiTop, nuki, gakuzuka];
    for (const im of parts) {
      im.frustumCulled = false;
      scene.add(im);
    }

    // ---------------------------------------------------------------- chitose-ame bags (canvas texture)
    const bagCv = document.createElement('canvas');
    bagCv.width = 128;
    bagCv.height = 256;
    const bc = bagCv.getContext('2d')!;
    bc.fillStyle = '#f6efe2';
    bc.fillRect(0, 0, 128, 256);
    bc.fillStyle = '#c8182a';
    bc.fillRect(0, 0, 128, 26);
    bc.fillRect(0, 230, 128, 26);
    // crane and turtle marks, kept simple
    bc.fillStyle = '#e0b44a';
    bc.beginPath();
    bc.arc(96, 70, 14, 0, Math.PI * 2);
    bc.fill();
    bc.fillStyle = '#2a7a4a';
    bc.beginPath();
    bc.ellipse(34, 196, 16, 11, 0, 0, Math.PI * 2);
    bc.fill();
    bc.fillStyle = '#c8182a';
    bc.font = 'bold 40px serif';
    bc.textAlign = 'center';
    bc.textBaseline = 'middle';
    ['千', '歳', '飴'].forEach((ch, i) => bc.fillText(ch, 64, 78 + i * 48));
    const bagTex = new THREE.CanvasTexture(bagCv);
    bagTex.colorSpace = THREE.SRGBColorSpace;
    const B = 6;
    const bagMat = new THREE.MeshStandardMaterial({ map: bagTex, roughness: 0.7 });
    const bags = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.66, 0.12), bagMat, B);
    const sticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), B * 2);
    for (let i = 0; i < B * 2; i++) sticks.setColorAt(i, col.setHex(i % 2 === 0 ? 0xe8283a : 0xfaf4ea));
    bags.frustumCulled = sticks.frustumCulled = false;
    scene.add(bags, sticks);
    const BAG_SPACING = 3 * GAP;

    // ---------------------------------------------------------------- pinwheels (kazaguruma)
    const pw = new THREE.BufferGeometry();
    {
      // four folded blades; each blade is two triangles folded along the diagonal
      const v: number[] = [];
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const rot = (x: number, y: number, z: number): number[] => [x * ca - y * sa, x * sa + y * ca, z];
        v.push(...rot(0, 0, 0), ...rot(0.26, 0, 0.02), ...rot(0.26, 0.26, 0.08));
        v.push(...rot(0, 0, 0), ...rot(0.26, 0.26, 0.08), ...rot(0, 0.14, 0.0));
      }
      pw.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      pw.computeVertexNormals();
    }
    const W = 10;
    const PW_COLS = [0xe8283a, 0xf2c230, 0x2a8ad8, 0x3ab85a, 0xe060a8, 0xf07a1e];
    const pwMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x220a00, emissiveIntensity: 0.6 });
    const wheels = new THREE.InstancedMesh(pw, pwMat, W);
    const wheelSticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a40 }), W);
    for (let i = 0; i < W; i++) wheels.setColorAt(i, col.setHex(PW_COLS[i % PW_COLS.length]!));
    wheels.frustumCulled = wheelSticks.frustumCulled = false;
    scene.add(wheels, wheelSticks);
    const PW_SPACING = 2 * GAP;
    const pwPhase = new Float32Array(W);
    for (let i = 0; i < W; i++) pwPhase[i] = Math.random() * Math.PI * 2;

    // ---------------------------------------------------------------- haiden (moves with the camera: always the destination)
    const haiden = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a2a18, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.2 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe6be50, metalness: 0.9, roughness: 0.25, emissive: 0x5a3a08, emissiveIntensity: 0.6 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 3.2), wood);
    deck.position.set(0, 0.3, -1.2);
    const steps = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.8), wood);
    steps.position.set(0, 0.15, 0.6);
    haiden.add(deck, steps);
    for (const x of [-3.1, -1.25, 1.25, 3.1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 12), vermilion);
      c.position.set(x, 2.2, 0);
      haiden.add(c);
    }
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d6, roughness: 0.9, emissive: 0x2a1a0a, emissiveIntensity: 0.6 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.0, 0.1), wallMat);
    wall.position.set(0, 2.1, -1.4);
    haiden.add(wall);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.28, 0.4), vermilion);
    lintel.position.set(0, 3.9, 0);
    haiden.add(lintel);
    // sweeping roof: extruded curved gable profile
    {
      const sh = new THREE.Shape();
      sh.moveTo(-5.2, 0);
      sh.quadraticCurveTo(-2.6, 0.5, 0, 2.3);
      sh.quadraticCurveTo(2.6, 0.5, 5.2, 0);
      sh.lineTo(4.8, 0.35);
      sh.quadraticCurveTo(2.4, 0.9, 0, 2.7);
      sh.quadraticCurveTo(-2.4, 0.9, -4.8, 0.35);
      sh.closePath();
      const roofGeo = new THREE.ExtrudeGeometry(sh, { depth: 4.4, bevelEnabled: false });
      roofGeo.translate(0, 0, -3.4);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 4.0;
      haiden.add(roof);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 4.6), roofMat);
      ridge.position.set(0, 6.72, -1.2);
      haiden.add(ridge);
      for (const x of [-1, 1]) {
        const chigi = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.12), gold);
        chigi.position.set(x * 0.25, 7.0, 0.9);
        chigi.rotation.z = x * 0.5;
        haiden.add(chigi);
      }
    }
    // offering box
    const saisen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.6), wood);
    saisen.position.set(0, 0.9, 0.05);
    haiden.add(saisen);

    // shimenawa: a thick twisted rope sagging between the front pillars (two twisted tubes)
    const nawa = new THREE.Group();
    nawa.position.set(0, 3.55, 0.25);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.95 });
    for (let strand = 0; strand < 3; strand++) {
      const pts: InstanceType<typeof THREE.Vector3>[] = [];
      for (let i = 0; i <= 48; i++) {
        const u = i / 48;
        const x = -1.35 + 2.7 * u;
        const sag = -Math.sin(Math.PI * u) * 0.45;
        const thick = 0.1 + Math.sin(Math.PI * u) * 0.14;
        const a = u * Math.PI * 10 + (strand * Math.PI * 2) / 3;
        pts.push(new THREE.Vector3(x, sag + Math.cos(a) * thick * 0.6, Math.sin(a) * thick * 0.6));
      }
      const r = 0.07 + 0.02 * strand;
      nawa.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, r, 8), ropeMat));
    }
    // shide: zig-zag white paper strips hanging from the rope
    const shideShape = new THREE.Shape();
    shideShape.moveTo(0, 0);
    shideShape.lineTo(0.12, 0);
    shideShape.lineTo(0.12, -0.14);
    shideShape.lineTo(0.2, -0.14);
    shideShape.lineTo(0.2, -0.3);
    shideShape.lineTo(0.08, -0.3);
    shideShape.lineTo(0.08, -0.44);
    shideShape.lineTo(0.16, -0.44);
    shideShape.lineTo(0.16, -0.6);
    shideShape.lineTo(0.04, -0.6);
    shideShape.lineTo(0.04, -0.46);
    shideShape.lineTo(-0.04, -0.46);
    shideShape.lineTo(-0.04, -0.3);
    shideShape.lineTo(0, -0.3);
    shideShape.closePath();
    const shideMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x333333 });
    const shideGeo = new THREE.ShapeGeometry(shideShape);
    const shides: InstanceType<typeof THREE.Mesh>[] = [];
    for (const u of [0.18, 0.38, 0.62, 0.82]) {
      const sm = new THREE.Mesh(shideGeo, shideMat);
      sm.position.set(-1.35 + 2.7 * u, -Math.sin(Math.PI * u) * 0.45 - 0.12, 0.12);
      nawa.add(sm);
      shides.push(sm);
    }
    haiden.add(nawa);

    // suzu: gold bell on a red/white/purple rope (suzu-no-o), pivoting at the top
    const bell = new THREE.Group();
    bell.position.set(0, 3.8, 0.55);
    const suzu = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), gold);
    suzu.position.y = -0.45;
    const slit = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 32), black);
    slit.position.y = -0.45;
    slit.rotation.x = Math.PI / 2;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 16), gold);
    hook.position.y = -0.08;
    bell.add(suzu, slit, hook);
    const ropeCols = [0xc8182a, 0xfaf4ea, 0x6a2a8a];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 8), new THREE.MeshStandardMaterial({ color: ropeCols[i]!, roughness: 0.8 }));
      r.position.set((i - 1) * 0.06, -1.7, 0);
      bell.add(r);
    }
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0xc8182a, roughness: 0.8 }));
    tassel.position.y = -2.7;
    bell.add(tassel);
    haiden.add(bell);

    // paper lanterns (chochin) either side of the front, with the only point lights
    const lanternMats: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];
    const lights: InstanceType<typeof THREE.PointLight>[] = [];
    const lanCv = document.createElement('canvas');
    lanCv.width = 128;
    lanCv.height = 128;
    const lcx = lanCv.getContext('2d')!;
    lcx.fillStyle = '#fff4dc';
    lcx.fillRect(0, 0, 128, 128);
    lcx.fillStyle = '#c8182a';
    lcx.fillRect(0, 0, 128, 10);
    lcx.fillRect(0, 118, 128, 10);
    lcx.font = 'bold 60px serif';
    lcx.textAlign = 'center';
    lcx.textBaseline = 'middle';
    lcx.fillStyle = '#1a1010';
    lcx.fillText('奉', 64, 66);
    const lanTex = new THREE.CanvasTexture(lanCv);
    lanTex.colorSpace = THREE.SRGBColorSpace;
    for (const x of [-2.2, 2.2]) {
      const mat = new THREE.MeshStandardMaterial({ map: lanTex, emissiveMap: lanTex, emissive: 0xffb060, emissiveIntensity: 1, roughness: 0.9 });
      lanternMats.push(mat);
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), mat);
      lan.scale.set(1, 1.3, 1);
      lan.position.set(x, 3.1, 0.3);
      haiden.add(lan);
      const l = new THREE.PointLight(0xffb070, 5, 10, 1.6);
      l.position.set(x, 3.0, 0.8);
      haiden.add(l);
      lights.push(l);
    }
    // a flash light at the bell for the downbeat ring
    const bellLight = new THREE.PointLight(0xffd070, 0, 8, 1.8);
    bellLight.position.set(0, 3.4, 1.2);
    haiden.add(bellLight);
    scene.add(haiden);

    // ---------------------------------------------------------------- confetti / gold motes drifting down the tunnel
    const P = 900;
    const pPos = new Float32Array(P * 3);
    const pCol = new Float32Array(P * 3);
    const pVel = new Float32Array(P);
    for (let i = 0; i < P; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 5;
      pPos[i * 3 + 1] = Math.random() * 4;
      pPos[i * 3 + 2] = -Math.random() * 24;
      pVel[i] = 0.2 + Math.random() * 0.5;
    }
    const pGeo = new THREE.BufferGeometry();
    // own copy: pPos holds the simulated state, the attribute gets it plus the sideways sway
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos.slice(), 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = new THREE.Points(pGeo, pMat);
    motes.frustumCulled = false;
    scene.add(motes);
    const goldC = new THREE.Color(0xffd070);

    // ---------------------------------------------------------------- state
    let dist = 0;
    let speed = 0;
    let spin = 0;
    let swingA = 0;
    let swingV = 0;
    let ring = 0;
    let lastBar = -1;
    let lastBeat = -1;
    let rollPunch = 0;
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const warm = new THREE.Color(0xffb070);
    const baseVermilion = new THREE.Color(0xe0401c);

    const wrapAhead = (baseZ: number, camZ: number, spacing: number, count: number): number => {
      // place slot on a repeating lattice from just behind the camera forwards
      const span = spacing * count;
      const rel = baseZ - camZ - 2; // how far ahead of "2 behind the camera"
      return camZ + 2 + ((((rel % span) + span) % span) - span);
    };

    return {
      reset() {
        dist = 0;
        lastBar = -1;
        lastBeat = -1;
      },
      update(input) {
        const t = input.t;
        const dt = Math.min(input.dt, 0.05);
        const it = input.intensity;
        cA.set(input.palette.a);
        cB.set(input.palette.b);
        cC.set(input.palette.c);
        fog.color.set(input.palette.bg);

        // dolly: gates per bar picks up with intensity; each beat surges forward
        const bpm = input.bpm > 40 ? input.bpm : 120;
        const barSec = (60 / bpm) * 4;
        const gatesPerBar = it < 0.3 ? 1 : it < 0.65 ? 2 : 4;
        const target = (gatesPerBar * GAP) / barSec;
        speed += (target - speed) * Math.min(1, dt * 1.5);
        const surge = 1 + (0.35 + 0.35 * it) * Math.cos(input.beatPhase * Math.PI * 2);
        dist += speed * surge * dt;
        const camZ = -dist;

        // bar downbeat: ring the bell hard; beats: small shakes
        if (input.bar !== lastBar) {
          if (lastBar >= 0) {
            swingV += 3.2 + 2.2 * it;
            ring = 1;
            rollPunch = input.bar % 2 === 0 ? 1 : -1;
          }
          lastBar = input.bar;
        }
        if (input.beat !== lastBeat) {
          if (lastBeat >= 0) swingV += (0.8 + it) * (input.beat % 2 === 0 ? 1 : -1);
          lastBeat = input.beat;
        }
        // damped pendulum
        swingV += -swingA * 28 * dt - swingV * 2.6 * dt;
        swingA += swingV * dt;
        swingA = Math.max(-0.7, Math.min(0.7, swingA));
        ring *= Math.exp(-dt * 3.5);
        rollPunch *= Math.exp(-dt * 3);

        camera.position.set(Math.sin(t * 0.23) * 0.18, 1.45 + Math.sin(dist * 0.9) * 0.03 * (0.5 + it), camZ);
        camera.fov = 58 + input.beatPulse * 3 * it + ring * 2;
        camera.updateProjectionMatrix();
        camera.lookAt(Math.sin(t * 0.17) * 0.25, 1.75, camZ - 10);
        camera.rotation.z += rollPunch * 0.015;

        haiden.position.set(0, 0, camZ - AHEAD);

        // torii: recycle across the tunnel; far gates rise out of the ground
        const tunnelEnd = camZ - AHEAD + 3.4;
        for (let i = 0; i < N; i++) {
          const z = wrapAhead(-i * GAP, camZ, GAP, N);
          const ahead = camZ - z; // >0 in front
          const rise = Math.max(0, Math.min(1, (z - tunnelEnd) / (GAP * 2)));
          const bob = input.beatPulse * 0.04 * it;
          const scaleY = rise * (1 + bob);
          const hidden = z < tunnelEnd || ahead < -2.5;
          const k = hidden ? 0 : 1;
          q.identity();
          for (let sd = 0; sd < 2; sd++) {
            const x = (sd === 0 ? -1 : 1) * TW;
            p.set(x, (TH / 2) * scaleY, z);
            s.set(k, k * scaleY, k);
            pillars.setMatrixAt(i * 2 + sd, m4.compose(p, q, s));
            p.set(x, 0.15 * scaleY, z);
            bases.setMatrixAt(i * 2 + sd, m4.compose(p, q, s));
          }
          s.set(k, k * Math.max(rise, 0.001), k);
          p.set(0, (TH + 0.1) * scaleY, z);
          kasagi.setMatrixAt(i, m4.compose(p, q, s));
          p.set(0, (TH + 0.23) * scaleY, z);
          kasagiTop.setMatrixAt(i, m4.compose(p, q, s));
          p.set(0, (TH - 0.55) * scaleY, z);
          nuki.setMatrixAt(i, m4.compose(p, q, s));
          p.set(0, (TH - 0.25) * scaleY, z + 0.02);
          gakuzuka.setMatrixAt(i, m4.compose(p, q, s));
        }
        for (const im of parts) im.instanceMatrix.needsUpdate = true;
        vermilion.color.copy(baseVermilion).lerp(cA, 0.15);
        vermilion.emissive.copy(cA).multiplyScalar(0.12 + input.bass * 0.25 + input.beatPulse * 0.15 * it);

        // chitose-ame bags on alternating sides, hop on the beat
        for (let i = 0; i < B; i++) {
          const z = wrapAhead(-i * BAG_SPACING - GAP * 0.5, camZ, BAG_SPACING, B);
          const side = i % 2 === 0 ? -1 : 1;
          const hide = z < tunnelEnd ? 0 : 1;
          const hop = input.beatPulse * 0.08 * (0.3 + it) * (i % 2 === (input.beat & 1) ? 1 : 0.4);
          p.set(side * (TW + 0.45), 0.33 + hop, z);
          e.set(0, side * 0.5, Math.sin(t * 1.3 + i) * 0.04);
          q.setFromEuler(e);
          s.set(hide, hide, hide);
          bags.setMatrixAt(i, m4.compose(p, q, s));
          for (let k = 0; k < 2; k++) {
            p.set(side * (TW + 0.45) + (k - 0.5) * 0.08, 0.72 + hop, z);
            e.set(0, 0, (k - 0.5) * 0.25);
            q.setFromEuler(e);
            sticks.setMatrixAt(i * 2 + k, m4.compose(p, q, s));
          }
        }
        bags.instanceMatrix.needsUpdate = true;
        sticks.instanceMatrix.needsUpdate = true;

        // pinwheels spin with the energy (and a kick on each beat)
        spin += dt * (1.2 + input.energy * 14 + input.beatPulse * 6 * it);
        for (let i = 0; i < W; i++) {
          const z = wrapAhead(-i * PW_SPACING - GAP * 0.25, camZ, PW_SPACING, W);
          const side = i % 2 === 0 ? 1 : -1;
          const hide = z < tunnelEnd ? 0 : 1;
          const x = side * (TW + 0.85 + (i % 3) * 0.12);
          const h = 1.05 + (i % 3) * 0.12;
          q.identity();
          s.set(hide, hide * h, hide);
          p.set(x, h / 2, z);
          wheelSticks.setMatrixAt(i, m4.compose(p, q, s));
          s.set(hide, hide, hide);
          p.set(x, h, z + 0.03);
          e.set(0, -side * 0.35, spin * (i % 2 === 0 ? 1 : -1) + pwPhase[i]!);
          q.setFromEuler(e);
          wheels.setMatrixAt(i, m4.compose(p, q, s));
        }
        wheels.instanceMatrix.needsUpdate = true;
        wheelSticks.instanceMatrix.needsUpdate = true;
        pwMat.emissive.copy(cB).multiplyScalar(0.1 + input.high * 0.3);

        // shrine: bell, rope and shide react; lanterns breathe with the bass
        bell.rotation.z = swingA;
        bell.rotation.x = Math.sin(t * 1.7) * 0.02 + swingA * 0.2;
        suzu.scale.setScalar(1 + ring * 0.08);
        gold.emissiveIntensity = 0.5 + ring * 2.2 + input.beatPulse * 0.4 + input.high * 0.4;
        nawa.rotation.z = swingA * 0.05;
        nawa.position.y = 3.55 + ring * 0.04 * Math.sin(t * 40);
        for (let i = 0; i < shides.length; i++) {
          shides[i]!.rotation.x = Math.sin(t * 3 + i) * 0.1 + ring * 0.6 * Math.sin(t * 22 + i * 1.3);
          shides[i]!.rotation.y = swingA * 0.4;
        }
        bellLight.intensity = ring * 18;
        bellLight.color.copy(goldC).lerp(cC, 0.3);
        const glow = 0.5 + input.bass * 1.3 + input.beatPulse * 0.4;
        for (let i = 0; i < lights.length; i++) {
          const flick = 1 + Math.sin(t * 6.1 + i * 2.3) * 0.04;
          lights[i]!.intensity = (3 + glow * 4) * flick;
          lights[i]!.color.copy(warm).lerp(cC, 0.3);
          lanternMats[i]!.emissiveIntensity = (0.6 + glow * 0.5) * flick;
        }
        wallMat.emissive.copy(cC).multiplyScalar(0.1 + input.bass * 0.15);

        // motes drift towards the camera and fall; highs sparkle
        const pp = motes.geometry.attributes.position as InstanceType<typeof THREE.BufferAttribute>;
        const pc2 = motes.geometry.attributes.color as InstanceType<typeof THREE.BufferAttribute>;
        const sparkle = 0.5 + input.high * 1.5;
        for (let i = 0; i < P; i++) {
          let y = pPos[i * 3 + 1]! - pVel[i]! * dt * (0.5 + it);
          let z = pPos[i * 3 + 2]!;
          if (y < 0) y += 4;
          // keep within [camZ - 24, camZ + 1]
          if (z > camZ + 1) z -= 25;
          if (z < camZ - 24) z += 25;
          pPos[i * 3 + 1] = y;
          pPos[i * 3 + 2] = z;
          pp.setXYZ(i, pPos[i * 3]! + Math.sin(t * 0.8 + i) * 0.15, y, z);
          const tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 12.9898);
          const c = i % 3 === 0 ? cA : i % 3 === 1 ? cB : goldC;
          const b = (0.4 + tw * sparkle) * 0.7;
          pc2.setXYZ(i, c.r * b, c.g * b, c.b * b);
        }
        pp.needsUpdate = true;
        pc2.needsUpdate = true;
        pMat.size = 0.05 + input.high * 0.06 + input.beatPulse * 0.02;

        // path and gravel follow the camera (texture scrolls to stay locked to the world)
        path.position.z = camZ - PATH_LEN / 2 + 20;
        gravel.position.z = path.position.z;
        pathTex.offset.y = (-path.position.z / 2.4) % 1;
      },
    };
  },
});
