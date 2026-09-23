import { defineThreeScene } from '../api';

/**
 * 大晦日・除夜の鐘: a snowy temple bell tower (鐘楼) at night. A huge bronze
 * 梵鐘 (lathe profile with bands, 乳 bosses and 撞座) hangs from the beam; the
 * wooden 撞木 hangs on two ropes, a monk pulls it back through the bar and it
 * swings in to strike on the downbeat (also on beat 3 at high intensity, every
 * other bar when calm). Each strike: the bell glows and sways, a shockwave ring
 * runs out through the air and across the snow and pushes the falling flakes,
 * and the wooden board by the path counts the strike in kanji (第…打, wraps
 * after 百八). Stone lanterns and a 篝火 breathe with the bass; the camera
 * circles low so the bell looks huge.
 */

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function kanjiNumber(n: number): string {
  if (n <= 0) return '〇';
  let s = '';
  if (n >= 100) {
    s += '百';
    n -= 100;
  }
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens > 0) s += (tens > 1 ? KANJI[tens]! : '') + '十';
  return s + KANJI[ones]!;
}

const FONT = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", serif';

export default defineThreeScene({
  id: 'nenju_joya',
  name: 'Joya no Kane 3D (three.js)',
  month: 12,
  group: 'nenju',
  description:
    '大晦日・除夜の鐘（3D）。雪の降る夜の鐘楼を低い位置からカメラがゆっくり回り込み、巨大な梵鐘を撞木が小節の頭で撞く。撞くたびに鐘が光って揺れ、衝撃波の輪が空気と雪原を走り、雪が押し流される。脇の木札が百八つまで打数を数える。灯籠と篝火は低域で明滅。静かなときは二小節に一打、盛り上がると三拍目にも撞く。荘厳で重く、ドロップ直前の溜めや決め場、年越しの瞬間に向く',
  short: '12月・除夜の鐘（3D）。荘厳・重厚。ドロップ直前の溜め',
  fov: 44,
  setup({ THREE, scene, camera }) {
    const std = (color: number, roughness = 0.8, metalness = 0): InstanceType<typeof THREE.MeshStandardMaterial> =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    // ---------- lights ----------
    const hemi = new THREE.HemisphereLight(0x6a7cae, 0xf0f4ff, 0.7);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xbfd0ff, 1.1);
    moon.position.set(-8, 14, 6);
    scene.add(moon);
    const fog = new THREE.Fog(0x05060c, 18, 58);
    scene.fog = fog;

    // ---------- generated textures ----------
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 64;
    {
      const g = glowCanvas.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);

    // ---------- ground, stone platform, path ----------
    const snowMat = std(0xe8edf6, 1);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), snowMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const BASE_H = 0.7;
    const BASE = 13.6;
    const stoneMat = std(0x7d7a74, 0.95);
    const base = new THREE.Mesh(new THREE.BoxGeometry(BASE, BASE_H, BASE), stoneMat);
    base.position.y = BASE_H / 2;
    scene.add(base);
    const baseSnow = new THREE.Mesh(new THREE.BoxGeometry(BASE - 0.2, 0.08, BASE - 0.2), snowMat);
    baseSnow.position.y = BASE_H + 0.04;
    scene.add(baseSnow);
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, BASE_H * (1 - i / 3), 0.45), stoneMat);
      step.position.set(0, (BASE_H * (1 - i / 3)) / 2, BASE / 2 + 0.22 + i * 0.45);
      scene.add(step);
    }
    const paveGeo = new THREE.BoxGeometry(1.8, 0.06, 0.9);
    const paveN = 12;
    const paves = new THREE.InstancedMesh(paveGeo, std(0x6b6863, 0.95), paveN);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < paveN; i++) {
      e.set(0, (Math.random() - 0.5) * 0.12, 0);
      q.setFromEuler(e);
      m4.compose(v1.set((Math.random() - 0.5) * 0.15, 0.03, BASE / 2 + 1.8 + i * 1.05), q, v2.set(1, 1, 1));
      paves.setMatrixAt(i, m4);
    }
    scene.add(paves);
    // soft snow drifts
    const driftN = 26;
    const drifts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowMat, driftN);
    for (let i = 0; i < driftN; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10.5 + Math.random() * 10;
      q.identity();
      m4.compose(v1.set(Math.cos(a) * r, 0, Math.sin(a) * r), q, v2.set(1 + Math.random() * 2.2, 0.25 + Math.random() * 0.35, 0.8 + Math.random() * 1.6));
      drifts.setMatrixAt(i, m4);
    }
    scene.add(drifts);

    // ---------- snowy pines ----------
    const TREES = 30;
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), std(0x1d3326, 0.9), TREES * 3);
    const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), snowMat, TREES * 3);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 6), std(0x2b1d14), TREES);
    for (let i = 0; i < TREES; i++) {
      const a = (i / TREES) * Math.PI * 2 + Math.random() * 0.18;
      const r = 23 + Math.random() * 12;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const s = 1.4 + Math.random() * 1.4;
      q.identity();
      m4.compose(v1.set(x, s * 0.6, z), q, v2.set(s, s * 1.2, s));
      trunks.setMatrixAt(i, m4);
      for (let k = 0; k < 3; k++) {
        const w = s * (1.9 - k * 0.45);
        const h = s * (2.2 - k * 0.3);
        const y = s * (1.3 + k * 1.35) + h / 2;
        m4.compose(v1.set(x, y, z), q, v2.set(w, h, w));
        foliage.setMatrixAt(i * 3 + k, m4);
        m4.compose(v1.set(x, y + h * 0.28, z), q, v2.set(w * 0.62, h * 0.45, w * 0.62));
        caps.setMatrixAt(i * 3 + k, m4);
      }
    }
    scene.add(foliage, caps, trunks);

    // ---------- the bell tower (鐘楼) ----------
    const woodMat = std(0x4a2618, 0.8);
    const TOP = 6.35;
    const PIL = 2.4;
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.24, TOP - BASE_H, 12);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(pillarGeo, woodMat);
        p.position.set(sx * PIL, BASE_H + (TOP - BASE_H) / 2, sz * PIL);
        scene.add(p);
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 12), stoneMat);
        plinth.position.set(sx * PIL, BASE_H + 0.11, sz * PIL);
        scene.add(plinth);
      }
    }
    for (const y of [1.9, TOP]) {
      for (const s of [-1, 1]) {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(PIL * 2 + 0.7, 0.26, 0.24), woodMat);
        bx.position.set(0, y, s * PIL);
        scene.add(bx);
        const bz = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, PIL * 2 + 0.7), woodMat);
        bz.position.set(s * PIL, y, 0);
        scene.add(bz);
      }
    }
    // the cross beam that carries the bell and the striker ropes (runs out over the striker)
    const cross = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.3, 0.3), woodMat);
    cross.position.set(0.8, TOP + 0.05, 0);
    scene.add(cross);
    // eaves + hip roof + snow on the roof
    const eaves = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.18, 7.6), std(0x221a16, 0.9));
    eaves.position.y = TOP + 0.35;
    scene.add(eaves);
    const eavesSnow = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.08, 7.7), snowMat);
    eavesSnow.position.y = TOP + 0.47;
    scene.add(eavesSnow);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.3, 4), std(0x2b2d33, 0.7, 0.2));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = TOP + 0.44 + 1.15;
    scene.add(roof);
    const roofSnow = new THREE.Mesh(new THREE.ConeGeometry(4.55, 1.95, 4), snowMat);
    roofSnow.rotation.y = Math.PI / 4;
    roofSnow.position.y = TOP + 0.44 + 2.3 + 0.06 - 0.975;
    scene.add(roofSnow);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), std(0xc9a44a, 0.35, 0.8));
    finial.position.y = TOP + 0.44 + 2.35;
    scene.add(finial);

    // ---------- the bell (梵鐘) ----------
    const bronze = new THREE.MeshStandardMaterial({ color: 0x5e4428, metalness: 0.85, roughness: 0.38, side: THREE.DoubleSide, emissive: 0xff9a40, emissiveIntensity: 0 });
    const profile = [
      [0.001, 2.3], [0.6, 2.25], [0.88, 2.0], [0.93, 1.0], [0.97, 0.3], [1.03, 0.02],
      [1.15, 0.0], [1.17, 0.07], [1.12, 0.17], [1.06, 0.4], [1.02, 0.9], [1.0, 1.5],
      [0.98, 2.0], [0.93, 2.22], [0.8, 2.38], [0.5, 2.47], [0.001, 2.5],
    ].map(([r, y]) => new THREE.Vector2(r!, y!));
    const BELL_S = 1.3;
    const bellPivot = new THREE.Group();
    bellPivot.position.set(0, TOP - 0.1, 0);
    scene.add(bellPivot);
    const bell = new THREE.Group();
    bell.scale.setScalar(BELL_S);
    bell.position.y = -0.5 - 2.5 * BELL_S;
    bellPivot.add(bell);
    bell.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 56), bronze));
    const bandMat = bronze;
    for (const [y, r] of [[0.3, 1.075], [0.55, 1.05], [1.5, 1.01], [2.12, 0.965]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 6, 56), bandMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      bell.add(ring);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.57, 0.08), bandMat);
      band.position.set(Math.cos(a) * 1.025, 1.335, Math.sin(a) * 1.025);
      band.rotation.y = -a;
      bell.add(band);
    }
    // 乳: 4 panels of 4x4 bosses between the vertical bands, upper zone
    const bosses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), bronze, 64);
    {
      let n = 0;
      for (let k = 0; k < 4; k++) {
        const centre = (k + 0.5) * (Math.PI / 2);
        for (let row = 0; row < 4; row++) {
          const y = 1.62 + row * 0.135;
          const r = 1.0 - row * 0.008;
          for (let col = 0; col < 4; col++) {
            const a = centre + (col - 1.5) * 0.3;
            q.identity();
            m4.compose(v1.set(Math.cos(a) * r, y, Math.sin(a) * r), q, v2.set(1, 1, 1));
            bosses.setMatrixAt(n++, m4);
          }
        }
      }
    }
    bell.add(bosses);
    // 撞座 (striking seats) where the vertical band meets the lower band
    for (const sx of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20), bronze);
      seat.rotation.z = Math.PI / 2;
      seat.position.set(sx * 1.05, 0.75, 0);
      bell.add(seat);
      const lotus = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 20), bronze);
      lotus.rotation.y = Math.PI / 2;
      lotus.position.set(sx * 1.075, 0.75, 0);
      bell.add(lotus);
    }
    // 龍頭 (hanging loop) and the iron hanger to the beam
    const dragon = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), bronze);
    dragon.position.y = 2.68;
    bell.add(dragon);
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), std(0x222222, 0.5, 0.7));
    hanger.position.y = -0.25;
    bellPivot.add(hanger);
    const BELL_MOUTH_Y = bellPivot.position.y - 0.5 - 2.5 * BELL_S;
    // halo that blooms behind the bell on impact
    const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(0, BELL_MOUTH_Y + 1.6, 0);
    scene.add(halo);
    const bellLight = new THREE.PointLight(0xffb060, 0, 16, 1.7);
    bellLight.position.set(2.0, BELL_MOUTH_Y + 0.9, 0.6);
    scene.add(bellLight);

    // ---------- the striker (撞木) on two ropes ----------
    const SEAT_X = 1.075 * BELL_S + 0.04;
    const SEAT_Y = BELL_MOUTH_Y + 0.75 * BELL_S;
    const LOG_LEN = 2.6;
    const LOG_X0 = SEAT_X + LOG_LEN / 2;
    const ROPE_TOP = TOP - 0.1;
    const ROPE_L = ROPE_TOP - SEAT_Y;
    const ropeMat = std(0xd8c49a, 0.95);
    const ropePivots: InstanceType<typeof THREE.Group>[] = [];
    for (const dx of [-0.85, 0.85]) {
      const pv = new THREE.Group();
      pv.position.set(LOG_X0 + dx, ROPE_TOP, 0);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ROPE_L, 6), ropeMat);
      rope.position.y = -ROPE_L / 2;
      pv.add(rope);
      scene.add(pv);
      ropePivots.push(pv);
    }
    const striker = new THREE.Group();
    const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, LOG_LEN, 16), std(0x9a7650, 0.85));
    logMesh.rotation.z = Math.PI / 2;
    striker.add(logMesh);
    for (const sx of [-1, 1]) {
      const binding = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 16), ropeMat);
      binding.rotation.y = Math.PI / 2;
      binding.position.x = sx * 0.85;
      striker.add(binding);
    }
    scene.add(striker);
    // the monk who pulls the rope
    const monk = new THREE.Group();
    monk.position.set(6.4, BASE_H + 0.08, 0.35);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.45, 16), std(0x1a1a22, 0.9));
    robe.position.y = 0.72;
    monk.add(robe);
    const kesa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.5), std(0x8a6a2a, 0.7, 0.2));
    kesa.position.set(-0.12, 0.85, 0);
    kesa.rotation.x = 0.5;
    monk.add(kesa);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), std(0xe2c1a0, 0.6));
    head.position.y = 1.58;
    monk.add(head);
    scene.add(monk);
    const pullRope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), ropeMat);
    scene.add(pullRope);
    const ropeEnd = new THREE.Vector3();
    const handPos = new THREE.Vector3();

    // ---------- stone lanterns (灯籠) ----------
    const lanternLights: InstanceType<typeof THREE.PointLight>[] = [];
    const fireboxMats: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * 2.9, 0, BASE / 2 + 2.4);
      const parts: [InstanceType<typeof THREE.CylinderGeometry>, number][] = [
        [new THREE.CylinderGeometry(0.55, 0.65, 0.3, 6), 0.15],
        [new THREE.CylinderGeometry(0.16, 0.2, 1.1, 10), 0.85],
        [new THREE.CylinderGeometry(0.5, 0.35, 0.22, 6), 1.5],
      ];
      for (const [geo, y] of parts) {
        const m = new THREE.Mesh(geo, stoneMat);
        m.position.y = y;
        g.add(m);
      }
      const fbMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb060, emissiveIntensity: 1, roughness: 0.9 });
      const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), fbMat);
      firebox.position.y = 1.86;
      g.add(firebox);
      fireboxMats.push(fbMat);
      const lroof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.45, 6), stoneMat);
      lroof.position.y = 2.33;
      g.add(lroof);
      const lsnow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.32, 6), snowMat);
      lsnow.position.y = 2.45;
      g.add(lsnow);
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), stoneMat);
      jewel.position.y = 2.66;
      g.add(jewel);
      scene.add(g);
      const l = new THREE.PointLight(0xffb060, 5, 11, 1.6);
      l.position.set(g.position.x, 1.9, g.position.z);
      scene.add(l);
      lanternLights.push(l);
    }

    // ---------- bonfire (篝火) ----------
    const FIRE = new THREE.Vector3(-5.2, BASE_H, 4.2);
    const ironMat = std(0x1c1c1c, 0.6, 0.6);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), ironMat);
      leg.position.set(FIRE.x + Math.cos(a) * 0.3, FIRE.y + 0.8, FIRE.z + Math.sin(a) * 0.3);
      leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      scene.add(leg);
    }
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.45, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide }));
    basket.position.set(FIRE.x, FIRE.y + 1.65, FIRE.z);
    scene.add(basket);
    const flames: InstanceType<typeof THREE.Mesh>[] = [];
    const flameMats: InstanceType<typeof THREE.MeshBasicMaterial>[] = [];
    for (let k = 0; k < 4; k++) {
      const fm = new THREE.MeshBasicMaterial({ color: k === 0 ? 0xffe0a0 : 0xff7a2a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
      const f = new THREE.Mesh(new THREE.ConeGeometry(k === 0 ? 0.22 : 0.3, 1, 10, 1, true), fm);
      f.position.set(FIRE.x + (k === 0 ? 0 : Math.cos(k * 2.1) * 0.16), FIRE.y + 2.2, FIRE.z + (k === 0 ? 0 : Math.sin(k * 2.1) * 0.16));
      scene.add(f);
      flames.push(f);
      flameMats.push(fm);
    }
    const fireLight = new THREE.PointLight(0xff8a3a, 10, 16, 1.6);
    fireLight.position.set(FIRE.x, FIRE.y + 2.4, FIRE.z);
    scene.add(fireLight);
    const SPARKS = 220;
    const sparkPos = new Float32Array(SPARKS * 3);
    const sparkVel = new Float32Array(SPARKS * 3);
    const resetSpark = (i: number, boost: number): void => {
      sparkPos[i * 3] = FIRE.x + (Math.random() - 0.5) * 0.5;
      sparkPos[i * 3 + 1] = FIRE.y + 1.9 + Math.random() * 0.3;
      sparkPos[i * 3 + 2] = FIRE.z + (Math.random() - 0.5) * 0.5;
      sparkVel[i * 3] = (Math.random() - 0.5) * 0.5;
      sparkVel[i * 3 + 1] = (0.8 + Math.random() * 1.6) * (1 + boost);
      sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    };
    for (let i = 0; i < SPARKS; i++) {
      resetSpark(i, 0);
      sparkPos[i * 3 + 1] = sparkPos[i * 3 + 1]! + Math.random() * 5;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparkMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffa050, size: 0.14, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    scene.add(sparks);

    // ---------- the strike counter board (木札) ----------
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 256;
    boardCanvas.height = 640;
    const woodCanvas = document.createElement('canvas');
    woodCanvas.width = 256;
    woodCanvas.height = 640;
    {
      const w = woodCanvas.getContext('2d')!;
      const grad = w.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, '#9c7648');
      grad.addColorStop(0.5, '#c29a66');
      grad.addColorStop(1, '#9a7446');
      w.fillStyle = grad;
      w.fillRect(0, 0, 256, 640);
      w.strokeStyle = 'rgba(70,40,15,0.22)';
      for (let i = 0; i < 26; i++) {
        w.lineWidth = 1 + Math.random() * 2;
        w.beginPath();
        const x = Math.random() * 256;
        w.moveTo(x, 0);
        w.bezierCurveTo(x + (Math.random() - 0.5) * 30, 200, x + (Math.random() - 0.5) * 30, 440, x + (Math.random() - 0.5) * 20, 640);
        w.stroke();
      }
      w.strokeStyle = 'rgba(40,20,5,0.6)';
      w.lineWidth = 6;
      w.strokeRect(8, 8, 240, 624);
    }
    const bctx = boardCanvas.getContext('2d')!;
    const boardTex = new THREE.CanvasTexture(boardCanvas);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    const vertical = (text: string, x: number, y0: number, size: number): void => {
      bctx.font = `${size}px ${FONT}`;
      for (let i = 0; i < text.length; i++) bctx.fillText(text[i]!, x, y0 + i * size * 1.06);
    };
    const drawBoard = (n: number): void => {
      bctx.drawImage(woodCanvas, 0, 0);
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillStyle = '#1a1008';
      vertical('除夜の鐘', 212, 64, 34);
      vertical('煩悩百八', 44, 400, 28);
      const main = n > 0 ? `第${kanjiNumber(n)}打` : '〇';
      const size = Math.min(92, Math.floor(470 / main.length));
      vertical(main, 124, 110 + (470 - main.length * size * 1.06) / 2 + size / 2, size);
      bctx.fillStyle = '#b3261e';
      bctx.fillRect(190, 560, 44, 44);
      bctx.fillStyle = '#f6e7d0';
      bctx.font = `30px ${FONT}`;
      bctx.fillText('鐘', 212, 583);
      boardTex.needsUpdate = true;
    };
    drawBoard(0);
    const boardWood = std(0x8a6440, 0.85);
    const boardFace = new THREE.MeshStandardMaterial({ map: boardTex, emissiveMap: boardTex, emissive: 0x6a5a48, emissiveIntensity: 0.55, roughness: 0.85 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.08), [boardWood, boardWood, boardWood, boardWood, boardFace, boardFace]);
    const boardGroup = new THREE.Group();
    boardGroup.position.set(5.0, 0, BASE / 2 + 1.4);
    boardGroup.rotation.y = -0.55;
    board.position.y = 2.3;
    boardGroup.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 0.14), boardWood);
    post.position.y = 0.65;
    boardGroup.add(post);
    const boardCap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.3), std(0x3a2416, 0.8));
    boardCap.position.y = 3.35;
    boardGroup.add(boardCap);
    const boardCapSnow = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.28), snowMat);
    boardCapSnow.position.y = 3.43;
    boardGroup.add(boardCapSnow);
    scene.add(boardGroup);

    // ---------- shockwave rings ----------
    const RINGS = 6;
    const ringGeo = new THREE.RingGeometry(0.93, 1.0, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const rings: InstanceType<typeof THREE.Mesh>[] = [];
    const ringMats: InstanceType<typeof THREE.MeshBasicMaterial>[] = [];
    const ringAge = new Float32Array(RINGS).fill(99);
    const ringKind = new Uint8Array(RINGS); // 0 = air (bell mouth), 1 = across the snow
    const ringStrength = new Float32Array(RINGS);
    for (let i = 0; i < RINGS; i++) {
      const rm = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const r = new THREE.Mesh(ringGeo, rm);
      r.visible = false;
      r.frustumCulled = false;
      scene.add(r);
      rings.push(r);
      ringMats.push(rm);
    }
    let ringNext = 0;
    let airRing = -1;
    const AIR_LIFE = 1.8;
    const GROUND_LIFE = 2.6;

    // ---------- snow ----------
    const SNOW = 2300;
    const SNOW_R = 24;
    const SNOW_TOP = 20;
    const snowPos = new Float32Array(SNOW * 3);
    const snowVel = new Float32Array(SNOW);
    const snowPhase = new Float32Array(SNOW);
    for (let i = 0; i < SNOW; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * SNOW_R * 2;
      snowPos[i * 3 + 1] = Math.random() * SNOW_TOP;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_R * 2;
      snowVel[i] = 0.5 + Math.random() * 0.9;
      snowPhase[i] = Math.random() * Math.PI * 2;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowPointsMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false });
    const snow = new THREE.Points(snowGeo, snowPointsMat);
    snow.frustumCulled = false;
    scene.add(snow);

    // ---------- palette tinting (recomputed only when the palette changes) ----------
    const warm = new THREE.Color(0xffb060);
    const gold = new THREE.Color(0xffc870);
    const bellGlow = new THREE.Color();
    const ringCol = new THREE.Color();
    const lanternCol = new THREE.Color();
    const fireCol = new THREE.Color();
    const pa = new THREE.Color();
    const pb = new THREE.Color();
    const pc = new THREE.Color();
    let lastPal = '';
    const applyPalette = (bg: string, a: string, b: string, c: string): void => {
      const key = bg + a + b + c;
      if (key === lastPal) return;
      lastPal = key;
      fog.color.set(bg);
      pa.set(a);
      pb.set(b);
      pc.set(c);
      bellGlow.copy(warm).lerp(pc, 0.3);
      bronze.emissive.copy(bellGlow);
      ringCol.copy(gold).lerp(pa, 0.45);
      lanternCol.copy(warm).lerp(pa, 0.35);
      fireCol.copy(warm).lerp(pb, 0.3);
      for (const l of lanternLights) l.color.copy(lanternCol);
      for (const mm of fireboxMats) mm.emissive.copy(lanternCol);
      fireLight.color.copy(fireCol);
      sparkMat.color.copy(fireCol);
      bellLight.color.copy(bellGlow);
      haloMat.color.copy(ringCol);
      for (const rm of ringMats) rm.color.copy(ringCol);
      snowPointsMat.color.setRGB(1, 1, 1).lerp(pc, 0.15);
    };

    // ---------- strike state ----------
    let count = 0;
    let impact = 0;
    let kick = 0;
    let bellAng = 0;
    let bellVel = 0;
    let prevBp = 0;
    let prevCyc = 0;
    let freeBp = 0;
    let myBar = 0;
    let mode = 1; // strikes per bar: 0.5 (calm), 1, 2 (peak: downbeat + beat 3)
    let lastStrikeT = -99;
    let orbit = 0.6;
    let strikeGlow = 0;

    const spawnRing = (kind: number, strength: number): void => {
      const i = ringNext;
      ringNext = (ringNext + 1) % RINGS;
      ringAge[i] = 0;
      ringKind[i] = kind;
      ringStrength[i] = strength;
      rings[i]!.visible = true;
      if (kind === 0) airRing = i;
    };
    const strike = (t: number, intensity: number): void => {
      lastStrikeT = t;
      count = (count % 108) + 1;
      const big = count === 108 ? 1.6 : 1;
      impact = big;
      strikeGlow = big;
      bellVel -= (0.1 + 0.14 * intensity) * big;
      spawnRing(0, big);
      spawnRing(1, big * 0.8);
      for (let i = 0; i < SPARKS; i += 3) resetSpark(i, 0.6 * big);
      drawBoard(count);
    };

    const swing = (cyc: number, amp: number): number => {
      if (cyc < 0.35) return amp * 0.16 * Math.sin(Math.PI * Math.min(1, cyc / 0.3)) * (1 - cyc / 0.35);
      if (cyc < 0.45) return 0;
      if (cyc < 0.9) {
        const u = (cyc - 0.45) / 0.45;
        return amp * u * u * (3 - 2 * u);
      }
      return amp * Math.cos(((cyc - 0.9) / 0.1) * Math.PI * 0.5);
    };

    return {
      reset() {
        count = 0;
        impact = 0;
        kick = 0;
        bellAng = 0;
        bellVel = 0;
        strikeGlow = 0;
        ringAge.fill(99);
        for (const r of rings) r.visible = false;
        drawBoard(0);
      },
      update(input) {
        const { t, intensity, bass, high } = input;
        const dt = Math.min(input.dt, 0.05);
        applyPalette(input.palette.bg, input.palette.a, input.palette.b, input.palette.c);

        // --- strike clock: follows the bar grid, free-runs slowly when there is no tempo ---
        let bp: number;
        if (input.bpm > 0) bp = input.barPhase;
        else {
          freeBp = (freeBp + dt / 2.8) % 1;
          bp = freeBp;
        }
        if (prevBp > 0.75 && bp < 0.25) {
          myBar++;
          const prevMode = mode;
          if (mode === 1) mode = intensity > 0.75 ? 2 : intensity < 0.22 ? 0.5 : 1;
          else if (mode === 2 && intensity < 0.65) mode = intensity < 0.22 ? 0.5 : 1;
          else if (mode === 0.5 && intensity > 0.3) mode = intensity > 0.75 ? 2 : 1;
          // entering calm mode: make this bar a striking bar so the downbeat is not skipped
          if (mode === 0.5 && prevMode !== 0.5 && (myBar & 1) === 1) myBar++;
        }
        const cyc = mode === 2 ? (bp * 2) % 1 : mode === 0.5 ? ((myBar & 1) + bp) / 2 : bp;
        if (prevCyc > 0.6 && cyc < 0.4 && t - lastStrikeT > 0.2) strike(t, intensity);
        prevBp = bp;
        prevCyc = cyc;

        // --- striker swing (parallelogram ropes keep the log level) ---
        const amp = 0.28 + 0.45 * intensity;
        const th = swing(cyc, amp);
        const sx = Math.sin(th) * ROPE_L;
        const sy = Math.cos(th) * ROPE_L;
        striker.position.set(LOG_X0 + sx, ROPE_TOP - sy, 0);
        for (const pv of ropePivots) pv.rotation.z = th;
        // the monk leans back as he pulls, forward as it strikes
        monk.rotation.z = -th * 0.35 + 0.05;
        monk.updateMatrixWorld();
        ropeEnd.set(striker.position.x + LOG_LEN / 2 - 0.1, striker.position.y - 0.18, 0);
        handPos.set(0, 1.25, 0.1).applyMatrix4(monk.matrixWorld);
        v1.subVectors(ropeEnd, handPos);
        const ropeLen = v1.length();
        pullRope.position.copy(handPos).addScaledVector(v1, 0.5);
        pullRope.quaternion.setFromUnitVectors(up, v1.divideScalar(ropeLen || 1));
        pullRope.scale.set(1, ropeLen, 1);

        // --- bell: damped sway + glow ---
        const w = Math.PI * 2 * 0.62;
        bellVel += (-w * w * bellAng - 0.9 * bellVel) * dt;
        bellAng += bellVel * dt;
        bellPivot.rotation.z = bellAng;
        impact *= Math.exp(-dt * 2.2);
        strikeGlow *= Math.exp(-dt * 4.5);
        const hum = 1 + impact * 0.012 * Math.sin(t * 23);
        bell.scale.set(BELL_S * hum, BELL_S, BELL_S * hum);
        bronze.emissiveIntensity = 0.04 + high * 0.08 + impact * 0.9 + strikeGlow * 0.6;
        bellLight.intensity = 1.5 + (strikeGlow * 70 + impact * 25) * (0.6 + 0.4 * intensity);
        haloMat.opacity = 0.08 + bass * 0.06 + impact * 0.55;
        const hs = 6 + impact * 7;
        halo.scale.set(hs, hs, 1);

        // --- shockwaves ---
        const ringSpeed = 0.7 + 0.6 * intensity;
        let airR = -1;
        for (let i = 0; i < RINGS; i++) {
          const r = rings[i]!;
          if (!r.visible) continue;
          const age = ringAge[i]! + dt;
          ringAge[i] = age;
          const life = ringKind[i] === 0 ? AIR_LIFE : GROUND_LIFE;
          if (age > life) {
            r.visible = false;
            if (airRing === i) airRing = -1;
            continue;
          }
          const u = age / life;
          const fade = (1 - u) * (1 - u) * ringStrength[i]!;
          if (ringKind[i] === 0) {
            const rad = 1.5 + age * 11 * ringSpeed;
            r.position.set(0, BELL_MOUTH_Y + age * 0.6, 0);
            r.scale.set(rad, 1, rad);
            ringMats[i]!.opacity = fade * 0.9;
            if (airRing === i) airR = rad;
          } else {
            const rad = BASE * 0.55 + age * 8 * ringSpeed;
            r.position.set(0, 0.03, 0);
            r.scale.set(rad, 1, rad);
            ringMats[i]!.opacity = fade * 0.6;
          }
        }

        // --- snow: falls, drifts, and is pushed outward as the air ring passes ---
        const fall = 0.45 + 0.9 * intensity;
        const push = airR > 0 ? (1 - ringAge[airRing]! / AIR_LIFE) * 6 * ringStrength[airRing]! : 0;
        for (let i = 0; i < SNOW; i++) {
          const ix = i * 3;
          let x = snowPos[ix]!;
          let y = snowPos[ix + 1]! - snowVel[i]! * fall * dt;
          let z = snowPos[ix + 2]!;
          x += Math.sin(t * 0.6 + snowPhase[i]!) * dt * 0.35 + dt * 0.12;
          z += Math.cos(t * 0.45 + snowPhase[i]!) * dt * 0.25;
          if (push > 0) {
            const d = Math.sqrt(x * x + z * z) + 1e-3;
            const band = 1 - Math.abs(d - airR) / 1.6;
            if (band > 0) {
              x += (x / d) * push * band * dt;
              z += (z / d) * push * band * dt;
              y += push * band * dt * 0.25;
            }
          }
          if (y < 0 || x > SNOW_R || x < -SNOW_R || z > SNOW_R || z < -SNOW_R) {
            y = SNOW_TOP * (0.7 + Math.random() * 0.3);
            x = (Math.random() - 0.5) * SNOW_R * 2;
            z = (Math.random() - 0.5) * SNOW_R * 2;
          }
          snowPos[ix] = x;
          snowPos[ix + 1] = y;
          snowPos[ix + 2] = z;
        }
        snowGeo.attributes.position!.needsUpdate = true;
        snowPointsMat.size = 0.13 + high * 0.1;
        snowPointsMat.opacity = 0.7 + high * 0.3;

        // --- fire & lanterns breathe with the bass ---
        const flick = 0.5 + 0.5 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3);
        for (let k = 0; k < flames.length; k++) {
          const f = flames[k]!;
          const s = 1 + 0.25 * Math.sin(t * (8 + k * 1.7) + k * 2) + bass * 0.6 + impact * 0.3;
          f.scale.set(1, s, 1);
          f.position.y = FIRE.y + 1.9 + s * 0.5;
          flameMats[k]!.opacity = 0.55 + 0.25 * flick;
        }
        fireLight.intensity = 9 + bass * 14 + flick * 4 + impact * 6;
        for (const l of lanternLights) l.intensity = 3.5 + bass * 9 + input.beatPulse * 1.5 * intensity;
        for (const mm of fireboxMats) mm.emissiveIntensity = 0.7 + bass * 0.9;
        for (let i = 0; i < SPARKS; i++) {
          const ix = i * 3;
          sparkPos[ix] = sparkPos[ix]! + sparkVel[ix]! * dt + Math.sin(t * 3 + i) * dt * 0.2;
          sparkPos[ix + 1] = sparkPos[ix + 1]! + sparkVel[ix + 1]! * dt * (0.6 + 0.6 * intensity);
          sparkPos[ix + 2] = sparkPos[ix + 2]! + sparkVel[ix + 2]! * dt;
          if (sparkPos[ix + 1]! > FIRE.y + 7.5) resetSpark(i, 0);
        }
        sparkGeo.attributes.position!.needsUpdate = true;
        sparkMat.size = 0.1 + high * 0.1;

        // --- camera: slow low orbit, the strike pushes in smoothly ---
        orbit += dt * (0.04 + intensity * 0.07);
        kick += (impact * (0.5 + 0.5 * intensity) + input.beatPulse * 0.15 * intensity - kick) * Math.min(1, dt * 5);
        const radius = 17 + Math.sin(t * 0.07) * 1.6 - kick * 1.6;
        camera.position.set(Math.sin(orbit) * radius, 3.3 + Math.sin(t * 0.11) * 1.1 + intensity * 0.6, Math.cos(orbit) * radius);
        camera.lookAt(0, 4.1 - kick * 0.2, 0);
        camera.fov = 44 - kick * 3;
        camera.updateProjectionMatrix();
      },
    };
  },
});
