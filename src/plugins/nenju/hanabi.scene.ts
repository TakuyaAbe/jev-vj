import { defineThreeScene, THREE } from '../api';

/**
 * August: 夏祭り・花火大会. A night river seen from the near bank. On the far
 * bank a row of 屋台 with striped awnings and paper signs, a crowd in yukata,
 * and a 櫓 hung with red-and-white 提灯 strings, a taiko drummer on top.
 * 打ち上げ花火 (菊, 牡丹, 芯入り, 輪, 柳) rise on a beat and burst on the next;
 * everything glowing is mirrored in the water with a gentle ripple.
 * Signature moment: the drummer strikes and the drum head flashes on the kick,
 * and at high intensity every bar opens with a big 尺玉 that lights the sky.
 */

const SLOTS = 12;
const PER = 200;
const N = SLOTS * PER;
const TRAIL = 8;

const KIKU = 0;
const BOTAN = 1;
const SHIN = 2;
const RING = 3;
const YANAGI = 4;

interface Shell {
  state: number; // 0 idle, 1 rising, 2 burst
  age: number;
  life: number;
  rise: number;
  x: number;
  z: number;
  apex: number;
  scale: number;
  type: number;
  drag: number;
  grav: number;
  colA: THREE.Color;
  colB: THREE.Color;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Shift everything horizontally by a ripple after instancing (for the water mirror). */
function ripple(mat: THREE.Material, uTime: { value: number }, amp: number): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.x += sin(mvPosition.y * 1.7 + uTime * 2.3 + mvPosition.x * 0.2) * ${amp.toFixed(3)} * (0.4 + mvPosition.y * 0.08);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  mat.customProgramCacheKey = () => `hanabi-ripple-${amp}`;
}

/** Person silhouette as one lathe: legs/robe, shoulders, neck, head. */
function personGeo(): THREE.LatheGeometry {
  const pts = [
    [0, 0], [0.2, 0], [0.22, 0.5], [0.24, 0.95], [0.27, 1.12], [0.2, 1.2], [0.07, 1.24],
    [0.08, 1.28], [0.12, 1.36], [0.12, 1.48], [0.08, 1.56], [0, 1.58],
  ].map(([x, y]) => new THREE.Vector2(x!, y!));
  return new THREE.LatheGeometry(pts, 10);
}

export default defineThreeScene({
  id: 'nenju_hanabi',
  name: 'Hanabi Taikai 3D (three.js)',
  group: 'nenju',
  month: 8,
  description:
    '夏祭り・花火大会の素材（3D）。夜の川辺、対岸に屋台の列と提灯を吊るした櫓、浴衣の人だかり。打ち上げ花火（菊・牡丹・芯入り・輪・柳）がビートで上がって次の拍で開き、川面に揺れて映る。櫓の太鼓はキックで叩かれて光り、強い展開では小節頭に尺玉が夜空を照らす。盛り上がりの頂点、ドロップや決め場に向く',
  short: '8月・花火大会（3D）。爆発的な祝祭。ピークのドロップ',
  maxBars: 32,
  fov: 50,
  setup({ scene, camera }) {
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    const tmpP = new THREE.Vector3();
    const tmpS = new THREE.Vector3();
    const tmpC = new THREE.Color();
    const palA = new THREE.Color();
    const palB = new THREE.Color();
    const palC = new THREE.Color();
    const white = new THREE.Color(0xffffff);
    const gold = new THREE.Color(0xffc860);
    const uTime = { value: 0 };

    scene.fog = new THREE.Fog(0x05060f, 28, 80);
    scene.add(new THREE.HemisphereLight(0x3a4a80, 0x100808, 0.35));
    const moonKey = new THREE.DirectionalLight(0x8090d0, 0.35);
    moonKey.position.set(-10, 20, 10);
    scene.add(moonKey);

    // mirror world: everything that glows is copied here and flipped under the water
    const mirror = new THREE.Group();
    mirror.scale.y = -1;
    scene.add(mirror);

    // ---- banks and river ----
    const earth = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 1 });
    const farBank = new THREE.Mesh(new THREE.BoxGeometry(160, 0.4, 34), earth);
    farBank.position.set(0, 0.2, -21);
    scene.add(farBank);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(160, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 0.9 }));
    wall.position.set(0, 0.2, -4.1);
    scene.add(wall);
    const nearBank = new THREE.Mesh(new THREE.BoxGeometry(160, 0.4, 20), earth);
    nearBank.position.set(0, 0.2, 22);
    scene.add(nearBank);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x08101f, roughness: 0.28, metalness: 0.55, transparent: true, opacity: 0.78, depthWrite: false });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 16), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0, 4);
    water.renderOrder = 1;
    scene.add(water);
    // distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x0a0c16, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      h.scale.set(14 + Math.random() * 10, 5 + Math.random() * 5, 8);
      h.position.set(-60 + i * 20 + Math.random() * 6, 0, -58 - Math.random() * 6);
      scene.add(h);
    }
    // stars
    const starMat = new THREE.PointsMaterial({ color: 0xc8d0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.6, fog: false, depthWrite: false });
    let stars: THREE.Points;
    {
      const n = 320;
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI - Math.PI;
        const e = 0.12 + Math.random() * 0.9;
        p[i * 3] = Math.cos(a) * Math.cos(e) * 90;
        p[i * 3 + 1] = Math.sin(e) * 90;
        p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 90 - 10;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      stars = new THREE.Points(g, starMat);
      scene.add(stars);
    }

    // ---- lanterns (instanced, red / white), with their mirror ----
    const LANTERN_MAX = 110;
    const lanternGeo = new THREE.SphereGeometry(0.26, 12, 10);
    lanternGeo.scale(1, 1.25, 1);
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, LANTERN_MAX);
    lanterns.frustumCulled = false;
    scene.add(lanterns);
    const lanternMirMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    ripple(lanternMirMat, uTime, 0.12);
    const lanternMir = new THREE.InstancedMesh(lanternGeo, lanternMirMat, LANTERN_MAX);
    lanternMir.frustumCulled = false;
    lanternMir.renderOrder = 0;
    mirror.add(lanternMir);
    const lanternPos: number[] = [];
    const lanternScale: number[] = [];
    const red = new THREE.Color(0xff3a2a);
    const paper = new THREE.Color(0xfff2d8);
    const addLantern = (x: number, y: number, z: number, s: number, col: THREE.Color): void => {
      const i = lanternPos.length / 3;
      if (i >= LANTERN_MAX) return;
      lanternPos.push(x, y, z);
      lanternScale.push(s);
      lanterns.setColorAt(i, col);
    };
    const cordMat = new THREE.LineBasicMaterial({ color: 0x2a1a14 });
    const string = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, count: number, sag: number, s: number): void => {
      const cord: THREE.Vector3[] = [];
      for (let k = 0; k <= 20; k++) {
        const u = k / 20;
        cord.push(new THREE.Vector3(ax + (bx - ax) * u, ay + (by - ay) * u - sag * 4 * u * (1 - u), az + (bz - az) * u));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cord), cordMat));
      for (let k = 1; k < count; k++) {
        const u = k / count;
        addLantern(ax + (bx - ax) * u, ay + (by - ay) * u - sag * 4 * u * (1 - u) - 0.36 * s, az + (bz - az) * u, s, k % 2 === 0 ? red : paper);
      }
    };

    // ---- 櫓 (yagura) ----
    const YX = 0;
    const YZ = -11;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.85 });
    const stripes = canvasTex(128, 16, (g) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 === 0 ? '#d8202a' : '#f6f0e6';
        g.fillRect(i * 16, 0, 16, 16);
      }
    });
    stripes.wrapS = THREE.RepeatWrapping;
    stripes.repeat.set(3, 1);
    const makuMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9 });
    const yagura = new THREE.Group();
    yagura.position.set(YX, 0.4, YZ);
    scene.add(yagura);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.2, 8), wood);
        leg.position.set(sx * 1.8, 3.1, sz * 1.8);
        yagura.add(leg);
      }
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 4.2), wood);
    deck.position.y = 3.3;
    yagura.add(deck);
    const maku = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.5, 3.9), makuMat);
    maku.position.y = 2.5;
    yagura.add(maku);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 4.2), wood);
    rail.position.y = 4.0;
    yagura.add(rail);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.8 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 6.85;
    yagura.add(roof);
    // big 祭 lanterns under the eaves
    const matsuriTex = canvasTex(256, 128, (g) => {
      g.fillStyle = '#fff4dc';
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#c81e24';
      g.fillRect(0, 0, 256, 12);
      g.fillRect(0, 116, 256, 12);
      g.fillStyle = '#1a1010';
      g.font = 'bold 84px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('祭', 64, 68);
      g.fillText('祭', 192, 68);
    });
    const bigGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.8, 16, 1, true);
    const bigMat = new THREE.MeshBasicMaterial({ map: matsuriTex, side: THREE.DoubleSide });
    const bigMirMat = new THREE.MeshBasicMaterial({ map: matsuriTex, side: THREE.DoubleSide, transparent: true, opacity: 0.4, depthWrite: false });
    ripple(bigMirMat, uTime, 0.12);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const b = new THREE.Mesh(bigGeo, bigMat);
        b.position.set(YX + sx * 2.3, 0.4 + 5.7, YZ + sz * 2.3);
        b.rotation.y = Math.PI / 2;
        scene.add(b);
        const bm = new THREE.Mesh(bigGeo, bigMirMat);
        bm.position.copy(b.position);
        bm.rotation.copy(b.rotation);
        mirror.add(bm);
      }
    }
    // taiko drum with 三つ巴 heads
    const tomoe = canvasTex(256, 256, (g) => {
      g.fillStyle = '#efe2c4';
      g.fillRect(0, 0, 256, 256);
      g.translate(128, 128);
      g.fillStyle = '#b01820';
      for (let i = 0; i < 3; i++) {
        g.save();
        g.rotate((i * Math.PI * 2) / 3);
        g.beginPath();
        g.arc(0, -40, 34, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(-34, -40);
        g.quadraticCurveTo(-60, 30, 30, 70);
        g.quadraticCurveTo(-20, 20, 34, -40);
        g.fill();
        g.restore();
      }
    });
    const drum = new THREE.Group();
    drum.position.set(0, 4.05, 0.3);
    yagura.add(drum);
    const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x7a2a18, roughness: 0.6, side: THREE.DoubleSide }));
    drumBody.rotation.x = Math.PI / 2;
    drum.add(drumBody);
    const headMat = new THREE.MeshStandardMaterial({ map: tomoe, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0 });
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), headMat);
      head.position.z = s * 0.4;
      if (s < 0) head.rotation.y = Math.PI;
      drum.add(head);
    }
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.6), wood);
    stand.position.set(0, -0.6, 0);
    drum.add(stand);
    // drummer in a happi: body + two arms with bachi
    const happi = new THREE.MeshStandardMaterial({ color: 0x1c2a60, roughness: 0.8 });
    const drummer = new THREE.Mesh(personGeo(), happi);
    drummer.position.set(0, 3.4, -0.75);
    yagura.add(drummer);
    const hachimaki = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: 0xf4f0ea }));
    hachimaki.rotation.x = Math.PI / 2;
    hachimaki.position.y = 1.45;
    drummer.add(hachimaki);
    const arms: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.26, 1.15, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), happi);
      arm.position.y = -0.25;
      pivot.add(arm);
      const bachi = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0xe8d4a8 }));
      bachi.position.set(0, -0.72, 0);
      pivot.add(bachi);
      drummer.add(pivot);
      arms.push(pivot);
    }
    // lantern strings from the roof peak out to poles
    const peakY = 0.4 + 7.3;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
    const ends: [number, number][] = [[-15, -5.2], [15, -5.2], [-13, -17], [13, -17]];
    for (const [ex, ez] of ends) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6), poleMat);
      pole.position.set(ex, 0.4 + 2.2, ez);
      scene.add(pole);
      string(YX, peakY, YZ, ex, 4.6, ez, 14, 1.1, 1);
    }
    // foreground string framing the top of the view
    string(-16, 5.4, 12.4, 16, 5.4, 12.4, 18, 0.7, 1.35);

    // ---- 屋台 row ----
    const signs = ['たこ焼', '金魚すくい', 'かき氷', '焼そば', 'りんご飴', 'わたあめ', '射的', 'お面'];
    const awnTex = stripes.clone();
    awnTex.repeat.set(2, 1);
    awnTex.needsUpdate = true;
    const awnMat = new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.8 });
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
    const glowMirMat = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    ripple(glowMirMat, uTime, 0.14);
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6);
    const stallXs = [-14.2, -10.8, -7.4, -4, 4, 7.4, 10.8, 14.2];
    const SZ = -6.8;
    stallXs.forEach((sx, i) => {
      const g = new THREE.Group();
      g.position.set(sx, 0.4, SZ);
      g.rotation.y = -sx * 0.012;
      scene.add(g);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 1.1), counterMat);
      counter.position.set(0, 0.45, 0.4);
      g.add(counter);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), glowMat);
      back.position.set(0, 1.3, -0.5);
      g.add(back);
      const backMir = new THREE.Mesh(back.geometry, glowMirMat);
      backMir.position.set(sx, 0.4 + 1.3, SZ - 0.5);
      mirror.add(backMir);
      for (const px of [-1.4, 1.4]) {
        for (const pz of [-0.55, 0.95]) {
          const post = new THREE.Mesh(postGeo, counterMat);
          post.position.set(px, 1.2, pz);
          g.add(post);
        }
      }
      const awn = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 2.0), awnMat);
      awn.position.set(0, 2.45, 0.25);
      awn.rotation.x = 0.22;
      g.add(awn);
      const label = signs[i % signs.length]!;
      const tex = canvasTex(256, 72, (c) => {
        c.fillStyle = '#fff6e4';
        c.fillRect(0, 0, 256, 72);
        c.strokeStyle = '#c81e24';
        c.lineWidth = 6;
        c.strokeRect(3, 3, 250, 66);
        c.fillStyle = '#b01820';
        c.font = `bold ${label.length > 4 ? 40 : 48}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(label, 128, 38);
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.66), new THREE.MeshBasicMaterial({ map: tex }));
      sign.position.set(0, 2.05, 1.2);
      g.add(sign);
      // one lantern at each front corner
      addLantern(sx - 1.3, 0.4 + 1.95, SZ + 1.1, 1.3, i % 2 === 0 ? red : paper);
      addLantern(sx + 1.3, 0.4 + 1.95, SZ + 1.1, 1.3, i % 2 === 0 ? paper : red);
    });

    // finalize lantern matrices
    const LN = lanternPos.length / 3;
    lanterns.count = LN;
    lanternMir.count = LN;
    const lanternPhase = new Float32Array(LN);
    for (let i = 0; i < LN; i++) lanternPhase[i] = Math.random() * Math.PI * 2;
    lanternMir.instanceMatrix = lanterns.instanceMatrix;
    lanternMir.instanceColor = lanterns.instanceColor;

    // ---- crowd in yukata ----
    const CROWD = 72;
    const yukata = [0x24306a, 0xc8303c, 0xf0e8dc, 0xe88aa8, 0x2a2a30, 0x3a6a8a];
    const crowd = new THREE.InstancedMesh(personGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), CROWD);
    crowd.frustumCulled = false;
    scene.add(crowd);
    const crowdX = new Float32Array(CROWD);
    const crowdZ = new Float32Array(CROWD);
    const crowdS = new Float32Array(CROWD);
    const crowdR = new Float32Array(CROWD);
    const crowdPh = new Float32Array(CROWD);
    for (let i = 0; i < CROWD; i++) {
      let x = (Math.random() - 0.5) * 34;
      if (Math.abs(x) < 1.2) x += x < 0 ? -1.4 : 1.4;
      crowdX[i] = x;
      crowdZ[i] = -4.6 - Math.random() * 1.1;
      crowdS[i] = 0.85 + Math.random() * 0.3;
      crowdR[i] = Math.random() * Math.PI * 2;
      crowdPh[i] = Math.random() * Math.PI * 2;
      crowd.setColorAt(i, tmpC.set(yukata[i % yukata.length]!));
    }

    // ---- lights (4) ----
    const stallL = new THREE.PointLight(0xffa860, 8, 14, 1.5);
    stallL.position.set(-9, 2.6, SZ + 2);
    const stallR = new THREE.PointLight(0xffa860, 8, 14, 1.5);
    stallR.position.set(9, 2.6, SZ + 2);
    const drumLight = new THREE.PointLight(0xffe0c0, 0, 12, 1.4);
    drumLight.position.set(YX, 0.4 + 4.3, YZ + 1.6);
    const skyLight = new THREE.PointLight(0xffffff, 0, 90, 0.6);
    skyLight.position.set(0, 18, -22);
    scene.add(stallL, stallR, drumLight, skyLight);

    // ---- fireworks pool ----
    const dot = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
    const fpos = new Float32Array(N * 3);
    const fcol = new Float32Array(N * 3);
    const fvel = new Float32Array(N * 3);
    const flayer = new Uint8Array(N);
    const fgeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(fpos, 3);
    const colAttr = new THREE.BufferAttribute(fcol, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    fgeo.setAttribute('position', posAttr);
    fgeo.setAttribute('color', colAttr);
    const fireMat = new THREE.PointsMaterial({ size: 0.42, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const fire = new THREE.Points(fgeo, fireMat);
    fire.frustumCulled = false;
    fire.renderOrder = 2;
    scene.add(fire);
    const fireMirMat = new THREE.PointsMaterial({ size: 0.5, map: dot, vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    ripple(fireMirMat, uTime, 0.35);
    const fireMir = new THREE.Points(fgeo, fireMirMat);
    fireMir.frustumCulled = false;
    fireMir.renderOrder = 0;
    mirror.add(fireMir);

    const shells: Shell[] = [];
    for (let i = 0; i < SLOTS; i++) {
      shells.push({ state: 0, age: 0, life: 1, rise: 0.8, x: 0, z: -22, apex: 14, scale: 1, type: 0, drag: 1, grav: 2, colA: new THREE.Color(), colB: new THREE.Color() });
    }
    const traditional = [0xff3040, 0xffc860, 0xfff0e0, 0x60ff90, 0xff70c0];
    const pickColor = (out: THREE.Color): void => {
      const r = Math.random();
      if (r < 0.6) out.copy(r < 0.2 ? palA : r < 0.4 ? palB : palC);
      else out.set(traditional[Math.floor(Math.random() * traditional.length)]!);
      // keep it luminous even with dark palettes
      const m = Math.max(out.r, out.g, out.b, 0.001);
      out.multiplyScalar(1 / m);
    };
    const clearSlot = (si: number): void => {
      const b = si * PER * 3;
      fcol.fill(0, b, b + PER * 3);
    };
    let flash = 0;
    const launch = (scale: number, type: number, rise: number): void => {
      let si = -1;
      let worst = -1;
      for (let i = 0; i < SLOTS; i++) {
        const s = shells[i]!;
        if (s.state === 0) {
          si = i;
          break;
        }
        const old = s.state === 2 ? s.age / s.life : -1;
        if (old > worst) {
          worst = old;
          si = i;
        }
      }
      if (si < 0) return;
      const s = shells[si]!;
      clearSlot(si);
      s.state = 1;
      s.age = 0;
      s.rise = rise;
      s.scale = scale;
      s.type = type;
      s.x = (Math.random() - 0.5) * 28;
      s.z = -20 - Math.random() * 9;
      s.apex = 10 + Math.random() * 5 + scale * 3.5;
      pickColor(s.colA);
      pickColor(s.colB);
      if (type === YANAGI) s.colA.copy(gold);
    };
    const golden = Math.PI * (3 - Math.sqrt(5));
    const ringN = new THREE.Vector3();
    const ringU = new THREE.Vector3();
    const ringV = new THREE.Vector3();
    const burst = (si: number): void => {
      const s = shells[si]!;
      s.state = 2;
      s.age = 0;
      const sc = s.scale;
      let speed = 8;
      switch (s.type) {
        case KIKU: speed = 7.2; s.drag = 1.15; s.grav = 2.0; s.life = 2.5; break;
        case BOTAN: speed = 8.4; s.drag = 1.6; s.grav = 1.6; s.life = 1.7; break;
        case SHIN: speed = 8.2; s.drag = 1.45; s.grav = 1.8; s.life = 2.0; break;
        case RING: speed = 8.0; s.drag = 1.5; s.grav = 1.4; s.life = 1.8; break;
        default: speed = 5.2; s.drag = 0.95; s.grav = 3.4; s.life = 3.2; break;
      }
      // ring plane: tilted towards the viewer so the 輪 reads as a ring, not a line
      ringN.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, 1.2).normalize();
      ringU.set(0, 1, 0).cross(ringN).normalize();
      ringV.copy(ringN).cross(ringU);
      const b = si * PER;
      for (let k = 0; k < PER; k++) {
        const i = b + k;
        let dx: number, dy: number, dz: number;
        let sp = speed * sc * (0.94 + Math.random() * 0.12);
        flayer[i] = 0;
        if (s.type === RING) {
          const a = (k / PER) * Math.PI * 2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          dx = ca * ringU.x + sa * ringV.x;
          dy = ca * ringU.y + sa * ringV.y;
          dz = ca * ringU.z + sa * ringV.z;
        } else {
          const y = 1 - (2 * (k + 0.5)) / PER;
          const r = Math.sqrt(1 - y * y);
          const th = golden * k + Math.random() * 0.08;
          dx = Math.cos(th) * r;
          dy = y;
          dz = Math.sin(th) * r;
          if (s.type === SHIN && k % 3 === 0) {
            sp *= 0.48;
            flayer[i] = 1;
          }
        }
        fpos[i * 3] = s.x;
        fpos[i * 3 + 1] = s.apex;
        fpos[i * 3 + 2] = s.z;
        fvel[i * 3] = dx * sp;
        fvel[i * 3 + 1] = dy * sp + (s.type === YANAGI ? 1.5 : 0);
        fvel[i * 3 + 2] = dz * sp;
      }
      flash = Math.max(flash, 0.35 + sc * 0.45);
      skyLight.color.copy(s.colA);
      skyLight.position.set(s.x * 0.6, s.apex, s.z + 4);
    };
    const resetAll = (): void => {
      for (let i = 0; i < SLOTS; i++) {
        shells[i]!.state = 0;
        clearSlot(i);
      }
      colAttr.needsUpdate = true;
    };

    // ---- per-frame state ----
    let lastBeat = -1;
    let lastBar = -1;
    let lastLaunch = 0;
    let orbit = 0;
    let kickEnv = 0;
    let clock = 0;

    return {
      reset: resetAll,
      update(input) {
        const dt = Math.min(input.dt, 0.05);
        const t = input.t;
        const I = input.intensity;
        clock += dt;
        uTime.value = t;
        palA.set(input.palette.a);
        palB.set(input.palette.b);
        palC.set(input.palette.c);
        (scene.fog as THREE.Fog).color.set(input.palette.bg);

        // camera: slow lateral arc from the near bank, beat nudges the FOV
        orbit += dt * (0.05 + I * 0.1);
        camera.position.set(Math.sin(orbit) * 5.5, 2.8 + Math.sin(t * 0.13) * 0.35, 15.5 - input.beatPulse * 0.25 * I);
        camera.lookAt(Math.sin(orbit * 0.7) * 1.5, 7, -8);
        camera.fov = 50 - input.beatPulse * 1.2 * I - flash * 1.5;
        camera.updateProjectionMatrix();

        // launches: a rocket goes up on a beat and bursts about one beat later
        const rise = Math.min(1.1, Math.max(0.45, input.bpm > 0 ? 60 / input.bpm : 0.8));
        const beat = Math.floor(input.beat);
        const bar = Math.floor(input.bar);
        const sc = 0.65 + I * 0.75;
        if (beat !== lastBeat) {
          const every = I > 0.66 ? 1 : I > 0.33 ? 2 : 4;
          if (lastBeat >= 0 && beat % every === 0) {
            const r = Math.random();
            const type = r < 0.3 ? KIKU : r < 0.55 ? BOTAN : r < 0.75 ? SHIN : r < 0.9 ? RING : YANAGI;
            launch(sc * (0.85 + Math.random() * 0.3), type, rise);
            lastLaunch = clock;
          }
          lastBeat = beat;
        }
        if (bar !== lastBar) {
          if (lastBar >= 0 && I > 0.75) {
            // 尺玉: big 芯入り on the downbeat, with a pair of small ones at high intensity
            launch(1.7 + (I - 0.75) * 1.2, Math.random() < 0.5 ? SHIN : KIKU, rise * 1.3);
            if (I > 0.9) {
              launch(0.8, BOTAN, rise * 0.8);
              launch(0.8, RING, rise * 0.9);
            }
            lastLaunch = clock;
          }
          lastBar = bar;
        }
        if (clock - lastLaunch > 2.8 - I * 1.2) {
          launch(sc, Math.random() < 0.5 ? KIKU : BOTAN, 0.9);
          lastLaunch = clock;
        }

        // fireworks physics
        const bright = 0.85 + I * 0.55;
        for (let si = 0; si < SLOTS; si++) {
          const s = shells[si]!;
          if (s.state === 0) continue;
          s.age += dt;
          const b = si * PER;
          if (s.state === 1) {
            for (let k = 0; k < TRAIL; k++) {
              const a = s.age - k * 0.035;
              const u = Math.min(1, Math.max(0, a / s.rise));
              const e = 1 - (1 - u) * (1 - u);
              const i = b + k;
              fpos[i * 3] = s.x + Math.sin(a * 9 + si) * 0.04;
              fpos[i * 3 + 1] = 0.4 + (s.apex - 0.4) * e;
              fpos[i * 3 + 2] = s.z;
              const f = a > 0 ? (1 - k / TRAIL) * 0.9 : 0;
              fcol[i * 3] = gold.r * f;
              fcol[i * 3 + 1] = gold.g * f;
              fcol[i * 3 + 2] = gold.b * f;
            }
            if (s.age >= s.rise) burst(si);
            continue;
          }
          const u = s.age / s.life;
          if (u >= 1) {
            s.state = 0;
            clearSlot(si);
            continue;
          }
          const drag = Math.exp(-s.drag * dt);
          const g = s.grav * dt;
          const pop = 1 + Math.max(0, 1 - s.age * 5) * 1.2;
          let fade = s.type === BOTAN ? Math.pow(1 - u, 1.4) : 1 - u * u;
          fade *= bright * pop;
          const twinkle = u > 0.55 && s.type !== YANAGI;
          const toGold = s.type === KIKU || s.type === YANAGI ? u * 0.85 : 0;
          for (let k = 0; k < PER; k++) {
            const i = b + k;
            const j = i * 3;
            let vx = fvel[j]! * drag;
            let vy = fvel[j + 1]! * drag - g;
            let vz = fvel[j + 2]! * drag;
            fvel[j] = vx;
            fvel[j + 1] = vy;
            fvel[j + 2] = vz;
            fpos[j] = fpos[j]! + vx * dt;
            fpos[j + 1] = fpos[j + 1]! + vy * dt;
            fpos[j + 2] = fpos[j + 2]! + vz * dt;
            const c = flayer[i] === 1 ? s.colB : s.colA;
            let f = fade;
            if (twinkle && Math.random() > 0.5 + input.high * 0.3) f *= 0.15;
            fcol[j] = (c.r + (gold.r - c.r) * toGold) * f;
            fcol[j + 1] = (c.g + (gold.g - c.g) * toGold) * f;
            fcol[j + 2] = (c.b + (gold.b - c.b) * toGold) * f;
          }
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        fireMat.size = 0.34 + I * 0.14 + input.high * 0.08;
        fireMirMat.size = fireMat.size * 1.25;
        fireMirMat.opacity = 0.24 + input.high * 0.12;

        flash *= Math.exp(-dt * 4.5);
        skyLight.intensity = flash * 60;

        // drum: kick flash and the drummer's strike, alternating arms
        if (input.onset && input.bass > 0.45) kickEnv = 1;
        kickEnv *= Math.exp(-dt * 9);
        const kick = Math.max(input.beatPulse * input.beatPulse, kickEnv);
        headMat.emissive.copy(white).lerp(palB, 0.5);
        headMat.emissiveIntensity = 0.05 + kick * (0.8 + I * 1.2);
        drumLight.color.copy(white).lerp(palB, 0.6);
        drumLight.intensity = kick * (10 + I * 18);
        const strike = Math.pow(input.beatPulse, 1.5);
        for (let a = 0; a < 2; a++) {
          const mine = beat % 2 === a;
          const s = mine ? strike : strike * 0.2;
          arms[a]!.rotation.x = -2.5 + s * 1.7;
          arms[a]!.rotation.z = (a === 0 ? -1 : 1) * (0.25 - s * 0.15);
        }
        drum.scale.setScalar(1 + kick * 0.04);

        // lanterns breathe with the bass and swing a little
        const glow = 0.72 + input.bass * 0.3 + input.beatPulse * 0.08;
        lanternMat.color.copy(white).lerp(palA, 0.22).multiplyScalar(glow);
        lanternMirMat.color.copy(lanternMat.color);
        bigMat.color.setScalar(0.8 + input.bass * 0.25);
        bigMirMat.color.copy(bigMat.color);
        const swing = 0.05 + I * 0.08;
        for (let i = 0; i < LN; i++) {
          const ph = lanternPhase[i]!;
          const s = lanternScale[i]!;
          tmpE.set(Math.sin(t * 0.9 + ph) * swing * 0.5, 0, Math.sin(t * 1.1 + ph) * swing);
          tmpQ.setFromEuler(tmpE);
          tmpP.set(lanternPos[i * 3]!, lanternPos[i * 3 + 1]! + input.beatPulse * 0.03 * I * s, lanternPos[i * 3 + 2]!);
          tmpS.setScalar(s);
          tmpM.compose(tmpP, tmpQ, tmpS);
          lanterns.setMatrixAt(i, tmpM);
        }
        lanterns.instanceMatrix.needsUpdate = true;
        glowMat.color.set(0xffb060).lerp(palA, 0.3).multiplyScalar(0.7 + input.bass * 0.35);
        glowMirMat.color.copy(glowMat.color);
        stallL.color.set(0xffa860).lerp(palA, 0.35);
        stallR.color.set(0xffa860).lerp(palC, 0.35);
        stallL.intensity = stallR.intensity = 5 + input.bass * 9 + input.beatPulse * 2;

        // crowd sways and hops a little with the beat
        for (let i = 0; i < CROWD; i++) {
          const ph = crowdPh[i]!;
          const hop = input.beatPulse * (0.5 + 0.5 * Math.sin(ph)) * 0.08 * (0.3 + I);
          tmpE.set(0, crowdR[i]!, Math.sin(t * 1.6 + ph) * 0.04 * (0.3 + input.energy));
          tmpQ.setFromEuler(tmpE);
          tmpP.set(crowdX[i]!, 0.4 + hop, crowdZ[i]!);
          tmpS.setScalar(crowdS[i]!);
          tmpM.compose(tmpP, tmpQ, tmpS);
          crowd.setMatrixAt(i, tmpM);
        }
        crowd.instanceMatrix.needsUpdate = true;

        // water catches the sky flash; mirror ripples sideways
        waterMat.emissive.copy(skyLight.color).multiplyScalar(flash * 0.08);
        mirror.position.x = Math.sin(t * 0.7) * 0.05;
        starMat.opacity = 0.45 + input.high * 0.35;
      },
    };
  },
});
