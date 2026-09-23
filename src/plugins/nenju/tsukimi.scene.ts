import { defineThreeScene, THREE } from '../api';

/**
 * September: お月見. Seen from an engawa framed by two posts and a lintel: a
 * 三方 with a 月見団子 pyramid and a paper 行灯 on the boards, a すすき field
 * swaying in the wind, a dark hill, and a huge full moon rising behind it with
 * soft crater shading, a halo and thin clouds drifting across. A rabbit in
 * silhouette hops along the ridge against the moon.
 * Signature moment: the rabbit hops on the beat (every beat when lively, every
 * other beat when calm) and squashes on landing; the moon's glow breathes with
 * the bass and the wind in the field swells with energy.
 */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bend instanced blades in the wind: the higher the vertex, the further it leans. */
function windBend(mat: THREE.Material, u: { uTime: { value: number }; uWind: { value: number }; uGust: { value: number } }): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.uniforms.uWind = u.uWind;
    sh.uniforms.uGust = u.uGust;
    sh.vertexShader = 'uniform float uTime, uWind, uGust;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  vec2 ip = instanceMatrix[3].xz;
  float hs = length(instanceMatrix[1].xyz);
#else
  vec2 ip = vec2(0.0);
  float hs = 1.0;
#endif
float k = clamp(transformed.y, 0.0, 1.4);
k *= k;
float ph = uTime + ip.x * 0.23 + ip.y * 0.17;
float wave = sin(ph) * 0.6 + sin(ph * 2.3 + ip.x * 1.7) * 0.25 + sin(uTime * 0.37 + ip.x * 0.05) * 0.4;
float sway = wave * uWind + uGust * (0.6 + 0.4 * sin(ip.y * 0.5));
mvPosition.x += sway * k * hs * 0.4;
mvPosition.z += sway * 0.25 * k * hs * 0.4;
mvPosition.y -= abs(sway) * k * hs * 0.08;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  mat.customProgramCacheKey = () => 'tsukimi-wind';
}

export default defineThreeScene({
  id: 'nenju_tsukimi',
  name: 'Otsukimi 3D (three.js)',
  group: 'nenju',
  month: 9,
  description:
    'お月見の素材（3D）。縁側から眺める秋の夜、三方に積んだ月見団子と行灯、風にそよぐすすき野の向こうに大きな満月が昇る。月は低域でふんわり光り、エネルギーで風が強まってすすきが波打つ。丘の上をうさぎの影がビートで跳ねる。静かで澄んだ場面、イントロ・アウトロ・ブレイクダウンに向く',
  short: '9月・お月見（3D）。静謐・幻想的。イントロ・アウトロ',
  maxBars: 32,
  fov: 45,
  setup({ scene, camera }) {
    const tmpM = new THREE.Matrix4();
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    const tmpP = new THREE.Vector3();
    const tmpS = new THREE.Vector3();
    const palA = new THREE.Color();
    const palB = new THREE.Color();
    const palC = new THREE.Color();
    const cream = new THREE.Color(0xfff4d8);
    const bgCol = new THREE.Color();

    scene.fog = new THREE.Fog(0x0a1024, 30, 110);
    const hemi = new THREE.HemisphereLight(0x5a6aa8, 0x141008, 0.5);
    scene.add(hemi);
    // moonlight comes from the moon, i.e. from behind the field: rim light on the susuki
    const MOON = new THREE.Vector3(-6, 17, -75);
    const moonLight = new THREE.DirectionalLight(0xdfe4ff, 0.9);
    moonLight.position.copy(MOON);
    scene.add(moonLight);
    const front = new THREE.DirectionalLight(0x8090c0, 0.25);
    front.position.set(4, 6, 20);
    scene.add(front);

    // ---- moon ----
    const R = 9.5;
    const craters = canvasTex(512, 256, (g) => {
      g.fillStyle = '#fff6e2';
      g.fillRect(0, 0, 512, 256);
      // maria: large soft grey patches
      for (let i = 0; i < 26; i++) {
        const x = 150 + Math.random() * 220;
        const y = 50 + Math.random() * 150;
        const r = 18 + Math.random() * 50;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(150,140,130,0.32)');
        gr.addColorStop(1, 'rgba(150,140,130,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // small craters: dark rim with a light centre
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 512;
        const y = 20 + Math.random() * 216;
        const r = 1.5 + Math.random() * 6;
        g.strokeStyle = 'rgba(120,110,100,0.35)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(255,255,245,0.25)';
        g.beginPath();
        g.arc(x - r * 0.2, y - r * 0.2, r * 0.6, 0, Math.PI * 2);
        g.fill();
      }
    });
    const moonMat = new THREE.MeshBasicMaterial({ map: craters, fog: false });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), moonMat);
    moon.position.copy(MOON);
    moon.rotation.y = -Math.PI / 2; // texture centre faces the camera
    scene.add(moon);
    const glowTex = canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.22, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.5 });
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(MOON).z -= 2;
    scene.add(glow);
    const haloMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.18 });
    const halo = new THREE.Sprite(haloMat);
    halo.position.copy(MOON).z -= 3;
    halo.scale.setScalar(R * 9);
    scene.add(halo);
    // thin clouds drifting across
    const cloudTex = canvasTex(256, 64, (g) => {
      for (let i = 0; i < 9; i++) {
        const x = 40 + Math.random() * 176;
        const y = 26 + Math.random() * 12;
        const gr = g.createRadialGradient(x, y, 0, x, y, 40);
        gr.addColorStop(0, 'rgba(255,255,255,0.45)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 64);
      }
    });
    const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(34, 5), cloudMat);
      c.position.set(-40 + i * 24, 10 + Math.random() * 14, -64 + i);
      c.scale.set(0.8 + Math.random() * 0.6, 0.7 + Math.random() * 0.6, 1);
      scene.add(c);
      clouds.push(c);
    }
    // stars
    {
      const n = 500;
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI - Math.PI;
        const e = 0.08 + Math.random() * 1.0;
        p[i * 3] = Math.cos(a) * Math.cos(e) * 95;
        p[i * 3 + 1] = Math.sin(e) * 95;
        p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 95;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8e0ff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.5, fog: false, depthWrite: false })));
    }

    // ---- land: ground, hills, the ridge the rabbit runs on ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 160), new THREE.MeshStandardMaterial({ color: 0x1a1a10, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -40;
    scene.add(ground);
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 1 });
    const HILL = { x: -3.4, z: -38, rx: 18, ry: 6.8, rz: 7 };
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.set(HILL.rx, HILL.ry, HILL.rz);
    hill.position.set(HILL.x, 0, HILL.z);
    scene.add(hill);
    for (const [x, z, sx, sy] of [[18, -46, 22, 4.2], [-30, -50, 20, 5], [40, -60, 26, 7], [-55, -62, 24, 8]] as const) {
      const h = new THREE.Mesh(hill.geometry, hillMat);
      h.scale.set(sx, sy, 9);
      h.position.set(x, 0, z);
      scene.add(h);
    }
    const ridgeY = (x: number): number => {
      const u = (x - HILL.x) / HILL.rx;
      return HILL.ry * Math.sqrt(Math.max(0, 1 - u * u));
    };

    // ---- rabbit silhouette ----
    const ink = new THREE.MeshBasicMaterial({ color: 0x06070c, fog: false });
    const rabbit = new THREE.Group();
    const body = new THREE.Group(); // pitched while hopping
    rabbit.add(body);
    const sph = new THREE.SphereGeometry(1, 16, 12);
    const part = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rz = 0): void => {
      const m = new THREE.Mesh(sph, ink);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.rotation.z = rz;
      body.add(m);
    };
    part(0.5, 0.38, 0.34, 0, 0.4, 0); // body
    part(0.26, 0.24, 0.22, 0.42, 0.72, 0); // head
    part(0.07, 0.34, 0.05, 0.34, 1.12, 0.06, 0.35); // ears
    part(0.07, 0.32, 0.05, 0.3, 1.08, -0.06, 0.5);
    part(0.12, 0.12, 0.12, -0.5, 0.45, 0); // tail
    part(0.2, 0.1, 0.12, 0.28, 0.08, 0.1); // paws
    part(0.28, 0.12, 0.14, -0.2, 0.1, -0.1);
    rabbit.scale.setScalar(1.25);
    scene.add(rabbit);

    // ---- engawa, posts, lintel ----
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.8 });
    const woodLight = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 0.62), i % 2 === 0 ? woodMat : woodLight);
      plank.position.set(0, 0.3, 6.6 + i * 0.66);
      scene.add(plank);
    }
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 0.1), woodMat);
    skirt.position.set(0, 0.15, 6.3);
    scene.add(skirt);
    for (const sx of [-3.3, 3.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5, 0.22), woodMat);
      post.position.set(sx, 2.5, 7.1);
      scene.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(9, 0.28, 0.24), woodMat);
    lintel.position.set(0, 3.9, 7.1);
    scene.add(lintel);

    // ---- 三方 with 月見団子 ----
    const hinoki = new THREE.MeshStandardMaterial({ color: 0xd8b888, roughness: 0.6 });
    const sanbo = new THREE.Group();
    sanbo.position.set(-1.2, 0.35, 7.7);
    sanbo.rotation.y = 0.35;
    scene.add(sanbo);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.62), hinoki);
    base.position.y = 0.17;
    sanbo.add(base);
    // cut-out on the front of the base (the 眼象) as a dark inset
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshStandardMaterial({ color: 0x3a2818 }));
    eye.position.set(0, 0.17, 0.312);
    sanbo.add(eye);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), hinoki);
    tray.position.y = 0.36;
    sanbo.add(tray);
    for (const [x, z, w, d] of [[0, 0.44, 0.9, 0.03], [0, -0.44, 0.9, 0.03], [0.44, 0, 0.03, 0.9], [-0.44, 0, 0.03, 0.9]] as const) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), hinoki);
      rim.position.set(x, 0.42, z);
      sanbo.add(rim);
    }
    const paperSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.9 }));
    paperSheet.rotation.x = -Math.PI / 2;
    paperSheet.rotation.z = Math.PI / 4;
    paperSheet.position.y = 0.385;
    sanbo.add(paperSheet);
    const DR = 0.125;
    const dangoPos: [number, number, number][] = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dangoPos.push([(i - 1) * DR * 2, 0, (j - 1) * DR * 2]);
    const l2 = DR * Math.SQRT2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) dangoPos.push([(i - 0.5) * DR * 2, l2, (j - 0.5) * DR * 2]);
    dangoPos.push([-DR, l2 * 2 - DR * 0.3, 0], [DR, l2 * 2 - DR * 0.3, 0]);
    const dangoMat = new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.55, emissive: 0xfff4dc, emissiveIntensity: 0.08 });
    const dango = new THREE.InstancedMesh(new THREE.SphereGeometry(DR, 18, 14), dangoMat, dangoPos.length);
    dangoPos.forEach(([x, y, z], i) => {
      tmpM.makeScale(1, 0.92, 1).setPosition(x, 0.39 + DR * 0.92 + y, z);
      dango.setMatrixAt(i, tmpM);
    });
    sanbo.add(dango);

    // ---- 行灯 (andon) with a warm point light ----
    const andon = new THREE.Group();
    andon.position.set(1.9, 0.35, 8.0);
    scene.add(andon);
    const andonPaper = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb060, emissiveIntensity: 0.8, roughness: 0.9, transparent: true, opacity: 0.95 });
    const shade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.42), andonPaper);
    shade.position.y = 0.55;
    andon.add(shade);
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.04), woodMat);
      leg.position.set(x, 0.45, z);
      andon.add(leg);
    }
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.48), woodMat);
    frameTop.position.y = 0.88;
    andon.add(frameTop);
    const andonLight = new THREE.PointLight(0xffb060, 3, 7, 1.6);
    andonLight.position.set(1.9, 0.95, 8.0);
    scene.add(andonLight);

    // ---- すすき field (instanced blades + plumes bending in the wind) ----
    const wind = { uTime: { value: 0 }, uWind: { value: 0.25 }, uGust: { value: 0 } };
    const bladeGeo = new THREE.PlaneGeometry(0.05, 1, 1, 6);
    bladeGeo.translate(0, 0.5, 0);
    {
      const p = bladeGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - p.getY(i) * 0.85));
    }
    const plumeGeo = new THREE.SphereGeometry(1, 6, 6);
    plumeGeo.scale(0.045, 0.2, 0.045);
    plumeGeo.rotateZ(-0.35);
    plumeGeo.translate(0.05, 1.08, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x6a6436, roughness: 0.85, side: THREE.DoubleSide });
    const plumeMat = new THREE.MeshStandardMaterial({ color: 0xe6d8b8, roughness: 0.9, emissive: 0xfff0d0, emissiveIntensity: 0.12 });
    windBend(bladeMat, wind);
    windBend(plumeMat, wind);
    const CLUMPS = 260;
    const PER_CLUMP = 6;
    const BLADES = CLUMPS * PER_CLUMP;
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADES);
    const plumes = new THREE.InstancedMesh(plumeGeo, plumeMat, BLADES);
    blades.frustumCulled = false;
    plumes.frustumCulled = false;
    let bi = 0;
    for (let c = 0; c < CLUMPS; c++) {
      // denser near the veranda, thinning towards the hill
      const d = Math.pow(Math.random(), 1.6);
      const cz = 5.2 - d * 36;
      const spread = 10 + d * 40;
      const cx = (Math.random() - 0.5) * spread * 2;
      const hBase = 1.3 + Math.random() * 0.9 + (1 - d) * 0.4;
      for (let k = 0; k < PER_CLUMP; k++) {
        tmpE.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);
        tmpQ.setFromEuler(tmpE);
        tmpP.set(cx + (Math.random() - 0.5) * 0.5, 0, cz + (Math.random() - 0.5) * 0.5);
        const h = hBase * (0.8 + Math.random() * 0.35);
        tmpS.set(1 + Math.random() * 0.4, h, 1);
        tmpM.compose(tmpP, tmpQ, tmpS);
        blades.setMatrixAt(bi, tmpM);
        plumes.setMatrixAt(bi, tmpM);
        bi++;
      }
    }
    scene.add(blades, plumes);

    // ---- drifting motes of light ----
    const MOTES = 280;
    const mpos = new Float32Array(MOTES * 3);
    const mseed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      mpos[i * 3] = (Math.random() - 0.5) * 30;
      mpos[i * 3 + 1] = Math.random() * 6;
      mpos[i * 3 + 2] = 5 - Math.random() * 30;
      mseed[i] = Math.random() * 10;
    }
    const mgeo = new THREE.BufferGeometry();
    const mAttr = new THREE.BufferAttribute(mpos, 3);
    mAttr.setUsage(THREE.DynamicDrawUsage);
    mgeo.setAttribute('position', mAttr);
    const moteMat = new THREE.PointsMaterial({ map: glowTex, size: 0.12, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = new THREE.Points(mgeo, moteMat);
    motes.frustumCulled = false;
    scene.add(motes);

    // ---- per-frame state ----
    let windPhase = 0;
    let windAmp = 0.2;
    let drift = 0;
    let lastBeat = -1;
    let lastHop = 0;
    let clock = 0;
    let hopT = -1; // <0: resting
    let hopDur = 0.4;
    let hopH = 0.6;
    let dir = 1;
    let rx = -5;
    let fromX = -5;
    let land = 0; // landing squash
    let barPulse = 0;
    let lastBar = -1;
    const X_MIN = -6.8;
    const X_MAX = 0.2;

    const startHop = (I: number, bpm: number): void => {
      hopDur = Math.min(0.5, Math.max(0.28, (bpm > 0 ? 60 / bpm : 0.6) * 0.75));
      hopH = 0.35 + I * 0.6;
      fromX = rx;
      if ((dir > 0 && rx > X_MAX) || (dir < 0 && rx < X_MIN)) dir = -dir;
      hopT = 0;
      lastHop = clock;
    };

    return {
      reset() {
        hopT = -1;
        rx = -5;
        dir = 1;
      },
      update(input) {
        const dt = Math.min(input.dt, 0.05);
        const t = input.t;
        const I = input.intensity;
        clock += dt;
        palA.set(input.palette.a);
        palB.set(input.palette.b);
        palC.set(input.palette.c);
        bgCol.set(input.palette.bg);
        (scene.fog as THREE.Fog).color.copy(bgCol);

        // camera: slow drift along the veranda, a gentle breath on the beat
        drift += dt * (0.04 + I * 0.06);
        camera.position.set(Math.sin(drift) * 1.1, 1.6 + Math.sin(t * 0.11) * 0.12, 11.6 + Math.sin(drift * 0.6) * 0.4);
        camera.lookAt(Math.sin(drift) * 0.6 - 1.2, 5.8, -30);
        camera.fov = 45 - input.beatPulse * 0.6 * I;
        camera.updateProjectionMatrix();

        // moon: cream with a hint of palette.a; glow breathes with the bass, swells on the bar
        const bar = Math.floor(input.bar);
        if (bar !== lastBar) {
          if (lastBar >= 0) barPulse = 1;
          lastBar = bar;
        }
        barPulse *= Math.exp(-dt * 1.8);
        const lum = 0.86 + input.bass * 0.14 + barPulse * 0.05;
        moonMat.color.copy(cream).lerp(palA, 0.12).multiplyScalar(lum);
        glowMat.color.copy(cream).lerp(palA, 0.35);
        glowMat.opacity = 0.38 + input.bass * 0.35 + barPulse * 0.12;
        glow.scale.setScalar(R * (4.2 + input.bass * 0.7 + barPulse * 0.3));
        haloMat.color.copy(palB).lerp(cream, 0.4);
        haloMat.opacity = 0.12 + input.bass * 0.1;
        moonLight.color.copy(cream).lerp(palA, 0.2);
        moonLight.intensity = 0.75 + input.bass * 0.35;
        hemi.color.copy(bgCol).lerp(palB, 0.4).offsetHSL(0, 0, 0.18);
        for (const c of clouds) {
          c.position.x += dt * (0.5 + I * 0.8);
          if (c.position.x > 55) c.position.x = -55;
        }
        cloudMat.color.copy(cream).lerp(palB, 0.35);

        // wind: calm breeze, swelling with energy/bass; a small puff on the beat
        const target = 0.14 + input.energy * 0.3 * (0.35 + I) + input.bass * 0.18 * I;
        windAmp += (target - windAmp) * Math.min(1, dt * 1.5);
        windPhase += dt * (0.7 + I * 1.1 + input.energy * 0.6);
        wind.uTime.value = windPhase;
        wind.uWind.value = windAmp;
        wind.uGust.value = input.beatPulse * 0.1 * I;
        plumeMat.emissive.copy(cream).lerp(palC, 0.4);
        plumeMat.emissiveIntensity = 0.1 + input.high * 0.25;

        // rabbit: hops on the beat, turns at the ends of the ridge
        const beat = Math.floor(input.beat);
        if (beat !== lastBeat) {
          const every = I > 0.5 ? 1 : 2;
          if (lastBeat >= 0 && beat % every === 0 && hopT < 0) startHop(I, input.bpm);
          lastBeat = beat;
        }
        if (hopT < 0 && clock - lastHop > 3.5) startHop(I, 0);
        let lift = 0;
        let pitch = 0;
        if (hopT >= 0) {
          hopT += dt / hopDur;
          const u = Math.min(1, hopT);
          const stride = 0.55 + I * 0.5;
          rx = fromX + dir * stride * u;
          lift = Math.sin(Math.PI * u) * hopH;
          pitch = Math.cos(Math.PI * u) * 0.35;
          if (hopT >= 1) {
            hopT = -1;
            land = 1;
          }
        }
        land *= Math.exp(-dt * 10);
        rabbit.position.set(rx, ridgeY(rx) - 0.05 + lift, HILL.z + 0.5);
        rabbit.rotation.y = dir > 0 ? 0 : Math.PI;
        body.rotation.z = pitch;
        body.scale.set(1 + land * 0.12, 1 - land * 0.18 + (hopT >= 0 ? 0.08 : 0), 1);

        // andon breathes with the bass
        const warm = 0.7 + input.bass * 0.8 + input.beatPulse * 0.1 * I;
        andonPaper.emissive.set(0xffb060).lerp(palA, 0.25);
        andonPaper.emissiveIntensity = 0.5 + warm * 0.4;
        andonLight.color.copy(andonPaper.emissive);
        andonLight.intensity = 1.5 + warm * 2.5;
        dangoMat.emissiveIntensity = 0.06 + input.bass * 0.06;

        // motes drift up and sideways with the wind, twinkling with the highs
        for (let i = 0; i < MOTES; i++) {
          const s = mseed[i]!;
          let y = mpos[i * 3 + 1]! + dt * (0.12 + (s % 1) * 0.15);
          let x = mpos[i * 3]! + dt * (Math.sin(t * 0.4 + s) * 0.2 + windAmp * 0.8);
          if (y > 7) y = 0.3;
          if (x > 16) x = -16;
          mpos[i * 3] = x;
          mpos[i * 3 + 1] = y;
        }
        mAttr.needsUpdate = true;
        moteMat.color.copy(palC).lerp(cream, 0.4);
        moteMat.size = 0.1 + input.high * 0.12;
        moteMat.opacity = 0.35 + input.high * 0.4 + I * 0.1;
      },
    };
  },
});
