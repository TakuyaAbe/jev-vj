import { defineThreeScene } from '../api';

/**
 * 夜桜 (April hanami at night): three big cherry trees built from a tapered
 * trunk, a handful of branches and instanced blossom clusters dusted with a
 * cloud of petal sprites; a sagging string of chochin lanterns (kanji drawn on
 * a CanvasTexture) whose point lights breathe with the bass and light the
 * blossoms from below; a blue hanami sheet with jubako, a sake bottle and
 * sanshoku dango; a pale moon behind.
 * Signature moment: every beat sends a gust of 花吹雪 through the petals, the
 * canopies shiver and the lanterns swing — hardest on the bar downbeat.
 */

const PETALS = 2000;
const CANOPY_DOTS = 900;
const LANTERNS = 12;

function lanternTexture(THREE: typeof import('three'), base: string, ink: string, kanji: string): import('three').CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  // bamboo ribs
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 1.5;
  for (let y = 6; y < 128; y += 9) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  // top/bottom bands
  g.fillStyle = ink;
  g.fillRect(0, 0, 256, 7);
  g.fillRect(0, 121, 256, 7);
  // the kanji at u = 0.25 and 0.75 (mesh is turned so these face front/back)
  g.fillStyle = ink;
  g.font = 'bold 72px "Hiragino Mincho ProN", "Yu Mincho", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(kanji, 64, 66);
  g.fillText(kanji, 192, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function petalTexture(THREE: typeof import('three')): import('three').CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 40, 2, 32, 34, 30);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#f4d8e2');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(32, 6);
  g.bezierCurveTo(54, 14, 54, 46, 32, 60);
  g.bezierCurveTo(10, 46, 10, 14, 32, 6);
  g.fill();
  // the little notch at the tip of a sakura petal
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(25, 0);
  g.lineTo(32, 13);
  g.lineTo(39, 0);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default defineThreeScene({
  id: 'nenju_hanami',
  name: 'Yozakura Hanami 3D (three.js)',
  month: 4,
  group: 'nenju',
  description:
    'お花見・夜桜素材（3D）。月夜に満開の桜の大木が並び、提灯の列が低域に合わせてふんわり明滅して花を下から照らす。ビートごとに花吹雪がひと吹き舞い、小節頭では強い風が枝を揺らす。ブルーシートに重箱と三色団子。カメラは桜を見上げながらゆっくり漂う。ブレイクダウンやメロディアスなパートなど、夢見心地で叙情的な場面に向く',
  short: '4月・夜桜（3D）。夢見心地・叙情的。ブレイク・メロ',
  fov: 50,
  setup({ THREE, scene, camera }) {
    const fog = new THREE.Fog('#0b0a18', 14, 38);
    scene.fog = fog;

    // --- lights: dim night, moon rim, lanterns do the rest
    const amb = new THREE.AmbientLight(0x3a3a6a, 0.55);
    scene.add(amb);
    const moonLight = new THREE.DirectionalLight(0xb8c4ff, 0.55);
    moonLight.position.set(6, 10, -12);
    scene.add(moonLight);
    const fill = new THREE.DirectionalLight(0xffc8d8, 0.18);
    fill.position.set(-4, 3, 10);
    scene.add(fill);

    // moon + halo
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4dc, fog: false }));
    moon.position.set(9, 13, -32);
    scene.add(moon);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffe6f0, transparent: true, opacity: 0.12, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), haloMat);
    halo.position.copy(moon.position);
    scene.add(halo);

    // --- ground + blue hanami sheet
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x151c16, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.03, 3.4), new THREE.MeshStandardMaterial({ color: 0x2466c8, roughness: 0.55 }));
    sheet.position.set(0.6, 0.015, 3.6);
    sheet.rotation.y = 0.08;
    scene.add(sheet);

    // jubako: three lacquer boxes, black outside, red rim, gold edge
    const lacquer = new THREE.MeshStandardMaterial({ color: 0x140a0a, roughness: 0.25, metalness: 0.2 });
    const lacquerRed = new THREE.MeshStandardMaterial({ color: 0xa01020, roughness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe6c45a, metalness: 0.85, roughness: 0.3 });
    const jubako = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.62), lacquer);
      b.position.y = 0.1 + i * 0.21;
      jubako.add(b);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.025, 0.64), i === 2 ? gold : lacquerRed);
      rim.position.y = 0.2 + i * 0.21;
      jubako.add(rim);
    }
    jubako.position.set(-0.6, 0.03, 3.4);
    jubako.rotation.y = 0.35;
    scene.add(jubako);
    // isshobin sake bottle
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x1d4a2a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 });
    const bottlePts: import('three').Vector2[] = [];
    const prof: [number, number][] = [[0, 0], [0.16, 0], [0.17, 0.05], [0.17, 0.6], [0.12, 0.72], [0.06, 0.82], [0.055, 1.0], [0.065, 1.02], [0, 1.03]];
    for (const [r, y] of prof) bottlePts.push(new THREE.Vector2(r, y));
    const bottle = new THREE.Mesh(new THREE.LatheGeometry(bottlePts, 20), bottleMat);
    bottle.position.set(0.5, 0.03, 3.0);
    scene.add(bottle);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.28, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 }));
    label.position.set(0.5, 0.36, 3.0);
    scene.add(label);
    // sake cups
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.35 });
    for (const [x, z] of [[1.1, 3.4], [1.4, 3.9], [0.1, 4.3]] as const) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.06, 16), cupMat);
      cup.position.set(x, 0.06, z);
      scene.add(cup);
    }
    // sanshoku dango on a plate: pink, white, green
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.5 }));
    plate.position.set(1.8, 0.05, 2.9);
    scene.add(plate);
    const dangoGeo = new THREE.SphereGeometry(0.075, 14, 10);
    const dangoMats = [0xff9fbf, 0xfff8ee, 0x8fcf7a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: 0.9 });
    for (let k = 0; k < 2; k++) {
      const skewer = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 5), stickMat);
      stick.rotation.z = Math.PI / 2;
      skewer.add(stick);
      for (let j = 0; j < 3; j++) {
        const d = new THREE.Mesh(dangoGeo, dangoMats[j]!);
        d.position.x = -0.16 + j * 0.155;
        skewer.add(d);
      }
      skewer.position.set(1.8, 0.14, 2.82 + k * 0.17);
      skewer.rotation.y = 0.3 + k * 0.1;
      scene.add(skewer);
    }

    // --- sakura trees
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x2a1a16, roughness: 0.95 });
    const blossomGeo = new THREE.IcosahedronGeometry(0.55, 1);
    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0x6a2a40, emissiveIntensity: 0.25, flatShading: true });
    const pinks = [0xffd6e4, 0xffc4d8, 0xfff0f5, 0xf7afc8, 0xffe2ec];
    const canopyPivots: { pivot: import('three').Group; phase: number }[] = [];
    const pTex = petalTexture(THREE);
    const dotMat = new THREE.PointsMaterial({ size: 0.2, map: pTex, vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false });
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpS = new THREE.Vector3();
    const tmpP = new THREE.Vector3();
    const tmpC = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const trees: [number, number, number, number][] = [
      [-3.2, -2.6, 1.35, 0.3],
      [4.6, -1.2, 1.05, 2.1],
      [-9.5, 0.6, 0.95, 4.2],
      [10.5, -5.5, 1.2, 1.1],
    ];
    const clustersPerTree = 70;
    const dotsPerTree = Math.floor(CANOPY_DOTS / trees.length);
    for (const [tx, tz, s, rot] of trees) {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      tree.rotation.y = rot;
      tree.scale.setScalar(s);
      scene.add(tree);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 3.0, 10), barkMat);
      trunk.position.y = 1.5;
      trunk.rotation.z = 0.05;
      tree.add(trunk);
      // the canopy (branches + blossoms) swings from the top of the trunk
      const pivot = new THREE.Group();
      pivot.position.y = 2.9;
      tree.add(pivot);
      canopyPivots.push({ pivot, phase: Math.random() * 6 });
      const tips: import('three').Vector3[] = [];
      const nb = 6;
      for (let b = 0; b < nb; b++) {
        const ang = (b / nb) * Math.PI * 2 + Math.random() * 0.5;
        const len = 1.8 + Math.random() * 1.2;
        const tilt = 0.55 + Math.random() * 0.45; // from vertical
        const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang));
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, len, 7), barkMat);
        br.quaternion.setFromUnitVectors(up, dir);
        br.position.copy(dir).multiplyScalar(len / 2);
        pivot.add(br);
        tips.push(dir.clone().multiplyScalar(len));
        tips.push(dir.clone().multiplyScalar(len * 0.55));
      }
      tips.push(new THREE.Vector3(0, 2.4, 0));
      const inst = new THREE.InstancedMesh(blossomGeo, blossomMat, clustersPerTree);
      for (let i = 0; i < clustersPerTree; i++) {
        const tip = tips[i % tips.length]!;
        tmpP.set((Math.random() - 0.5) * 1.8, (Math.random() - 0.35) * 1.2, (Math.random() - 0.5) * 1.8).add(tip);
        const sc = 0.7 + Math.random() * 0.7;
        tmpS.set(sc * 1.15, sc * 0.8, sc * 1.15);
        tmpQ.setFromAxisAngle(up, Math.random() * 6.28);
        tmpM.compose(tmpP, tmpQ, tmpS);
        inst.setMatrixAt(i, tmpM);
        inst.setColorAt(i, tmpC.setHex(pinks[i % pinks.length]!));
      }
      pivot.add(inst);
      // petal sprites sprinkled over the cluster surfaces (they sway with the canopy)
      const dotPos: number[] = [];
      const dotCol: number[] = [];
      for (let i = 0; i < dotsPerTree; i++) {
        const tip = tips[Math.floor(Math.random() * tips.length)]!;
        const r = 0.9 + Math.random() * 0.8;
        const u = Math.random() * 6.28;
        const v = Math.acos(2 * Math.random() - 1);
        tmpP.set(Math.sin(v) * Math.cos(u) * r * 1.2, Math.cos(v) * r * 0.75, Math.sin(v) * Math.sin(u) * r * 1.2).add(tip);
        dotPos.push(tmpP.x, tmpP.y, tmpP.z);
        tmpC.setHex(pinks[i % pinks.length]!);
        dotCol.push(tmpC.r, tmpC.g, tmpC.b);
      }
      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPos, 3));
      dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(dotCol, 3));
      pivot.add(new THREE.Points(dotGeo, dotMat));
    }

    // --- lantern string: two poles, a sagging cord, chochin hanging from it
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 });
    const x0 = -8.5;
    const x1 = 8.5;
    const zS = 1.2;
    const topY = 3.6;
    for (const x of [x0, x1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, topY, 8), poleMat);
      p.position.set(x, topY / 2, zS);
      scene.add(p);
    }
    const sag = (u: number): number => topY - 0.9 * (1 - (2 * u - 1) * (2 * u - 1));
    const cordPts: import('three').Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      cordPts.push(new THREE.Vector3(x0 + (x1 - x0) * u, sag(u), zS));
    }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 48, 0.014, 5, false), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
    scene.add(cord);

    const lanternPts: import('three').Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      lanternPts.push(new THREE.Vector2(0.07 + 0.2 * Math.sin(Math.PI * t), t * 0.6));
    }
    const lanternGeo = new THREE.LatheGeometry(lanternPts, 20);
    const capGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 14);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const texA = lanternTexture(THREE, '#fff1e2', '#b0102a', '桜');
    const texB = lanternTexture(THREE, '#c81830', '#fff4e6', '花');
    const matA = new THREE.MeshStandardMaterial({ map: texA, emissiveMap: texA, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
    const matB = new THREE.MeshStandardMaterial({ map: texB, emissiveMap: texB, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
    const lanterns: { g: import('three').Group; phase: number }[] = [];
    for (let i = 0; i < LANTERNS; i++) {
      const u = (i + 0.5) / LANTERNS;
      const g = new THREE.Group();
      g.position.set(x0 + (x1 - x0) * u, sag(u), zS);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4), capMat);
      string.position.y = -0.07;
      g.add(string);
      const body = new THREE.Mesh(lanternGeo, i % 3 === 1 ? matB : matA);
      body.position.y = -0.76;
      body.rotation.y = -Math.PI / 2;
      g.add(body);
      const capT = new THREE.Mesh(capGeo, capMat);
      capT.position.y = -0.16;
      g.add(capT);
      const capB = new THREE.Mesh(capGeo, capMat);
      capB.position.y = -0.76;
      g.add(capB);
      scene.add(g);
      lanterns.push({ g, phase: i * 0.9 });
    }
    const lights: import('three').PointLight[] = [];
    for (const u of [0.18, 0.5, 0.82]) {
      const l = new THREE.PointLight(0xffb070, 6, 14, 1.5);
      l.position.set(x0 + (x1 - x0) * u, sag(u) - 0.5, zS + 0.3);
      scene.add(l);
      lights.push(l);
    }

    // --- 花吹雪: petals that fall, flutter and get blown on the beat
    const pos = new Float32Array(PETALS * 3);
    const col = new Float32Array(PETALS * 3);
    const fall = new Float32Array(PETALS);
    const phase = new Float32Array(PETALS);
    const spawn = (i: number, anywhere: boolean): void => {
      pos[i * 3] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = anywhere ? Math.random() * 9 : 4 + Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 + 0.5;
    };
    for (let i = 0; i < PETALS; i++) {
      spawn(i, true);
      fall[i] = 0.35 + Math.random() * 0.6;
      phase[i] = Math.random() * 6.28;
      tmpC.setHex(pinks[i % pinks.length]!);
      col[i * 3] = tmpC.r;
      col[i * 3 + 1] = tmpC.g;
      col[i * 3 + 2] = tmpC.b;
    }
    const petalGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    petalGeo.setAttribute('position', posAttr);
    petalGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const petalMat = new THREE.PointsMaterial({ size: 0.1, map: pTex, vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false });
    const petals = new THREE.Points(petalGeo, petalMat);
    petals.frustumCulled = false;
    scene.add(petals);

    // --- per-frame scratch
    const cLight = new THREE.Color();
    const cPal = new THREE.Color();
    const cWarm = new THREE.Color(0xffb070);
    const cBlossomGlow = new THREE.Color(0x6a2a40);
    const cWhite = new THREE.Color(0xffffff);
    const look = new THREE.Vector3(0, 3.4, -1);
    let gust = 0;
    let gustDir = 1;
    let lastBeat = -1;

    // integrated phases: an intensity change never makes the camera jump
    let camPh = 0;
    return {
      reset() {
        gust = 0;
        lastBeat = -1;
      },
      update(input) {
        const t = input.t;
        const dt = Math.min(input.dt, 0.1);
        const I = input.intensity;

        // the gust: a puff on every beat, a real blow on the bar downbeat
        gust *= Math.exp(-dt * 2.0);
        if (input.beat !== lastBeat) {
          if (lastBeat >= 0) {
            const down = input.barPhase < 0.2 || input.barPhase > 0.95;
            gust = Math.min(1.8, gust + (down ? 1.0 : 0.3) * (0.3 + 0.7 * I));
            if (down) gustDir = Math.sin(input.bar * 1.7) > -0.3 ? 1 : -1;
          }
          lastBeat = input.beat;
        }

        // camera: low, looking up into the blossoms, drifting slowly side to side
        camPh += dt * (0.045 + I * 0.05);
        const a = Math.sin(camPh) * 0.55;
        const r = 12.5 - input.beatPulse * 0.35 * I;
        camera.position.set(Math.sin(a) * r, 1.5 + Math.sin(t * 0.13) * 0.35, Math.cos(a) * r + 1.5);
        camera.lookAt(look);
        camera.fov = 50 - input.beatPulse * 1.0 * I;
        camera.updateProjectionMatrix();

        // canopies shiver in the gust
        for (const c of canopyPivots) {
          const sway = Math.sin(t * 0.7 + c.phase) * 0.012 * (0.4 + I);
          const shiver = Math.sin(t * 9 + c.phase) * gust * 0.012;
          c.pivot.rotation.z = sway - gust * gustDir * 0.035 + shiver;
          c.pivot.rotation.x = Math.cos(t * 0.5 + c.phase) * 0.01 + shiver * 0.6;
        }

        // lanterns swing and breathe with the bass (warm, tinted by palette.a)
        cPal.set(input.palette.a);
        cLight.copy(cWarm).lerp(cPal, 0.35);
        const glow = 0.45 + input.bass * 1.3 + input.beatPulse * 0.35 * I;
        for (const l of lights) {
          l.color.copy(cLight);
          l.intensity = 3 + glow * 5;
        }
        const e = 0.55 + glow * 0.55;
        matA.emissiveIntensity = e;
        matB.emissiveIntensity = e * 0.9;
        matA.emissive.copy(cWhite).lerp(cPal, 0.2);
        matB.emissive.copy(matA.emissive);
        for (const L of lanterns) {
          L.g.rotation.z = Math.sin(t * 1.1 + L.phase) * 0.04 * (0.3 + I) - gust * gustDir * 0.12 * (0.7 + 0.3 * Math.sin(L.phase));
          L.g.rotation.x = Math.sin(t * 0.8 + L.phase * 1.3) * 0.03;
        }

        // blossoms glow faintly (palette.b), sparkle with the highs
        cPal.set(input.palette.b);
        blossomMat.emissive.copy(cBlossomGlow).lerp(cPal, 0.35);
        blossomMat.emissiveIntensity = 0.18 + input.high * 0.35 + input.bass * 0.12;
        cPal.set(input.palette.c);
        dotMat.color.copy(cWhite).lerp(cPal, 0.2);
        petalMat.color.copy(dotMat.color);
        haloMat.opacity = 0.08 + input.high * 0.1;

        // 花吹雪
        const fallK = 0.5 + 0.6 * I;
        const wind = (0.15 + 0.25 * I) + gust * 3.2 * gustDir;
        const lift = gust * 0.9;
        for (let i = 0; i < PETALS; i++) {
          const ph = phase[i]!;
          const k = i * 3;
          let x = pos[k]!;
          let y = pos[k + 1]!;
          let z = pos[k + 2]!;
          x += (wind * (0.6 + 0.4 * Math.sin(ph * 3)) + Math.sin(t * 1.6 + ph) * 0.45) * dt;
          y += (-fall[i]! * fallK + Math.sin(t * 2.3 + ph * 2) * 0.25 + lift * Math.sin(ph)) * dt;
          z += Math.cos(t * 1.2 + ph * 1.7) * 0.35 * dt;
          if (y < 0.02) {
            spawn(i, false);
            continue;
          }
          if (x > 14) x -= 28;
          else if (x < -14) x += 28;
          if (y > 11) y = 11;
          pos[k] = x;
          pos[k + 1] = y;
          pos[k + 2] = z;
        }
        posAttr.needsUpdate = true;
        petalMat.size = 0.1 + input.energy * 0.035 + gust * 0.02;

        fog.color.set(input.palette.bg);
      },
    };
  },
});
