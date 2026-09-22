import * as THREE from 'three';
import type { Scene } from '../types';
import { GlContext } from './context';

/**
 * Hina-dan in 3D: seven red tiers in front of a gold folding screen, dolls
 * built from primitives (layered robe cones, head, hair, crown), bonbori
 * lanterns as point lights breathing with the bass, petals falling, and a
 * camera that slowly circles the display.
 */
const TIERS = 7;
const DOLLS_PER_TIER = [2, 3, 5, 2, 3, 0, 0];
const ROBES: [number, number, number][] = [
  [0xff9fbf, 0xa3d39c, 0xfff3d6],
  [0xfff3d6, 0xff7aa2, 0xa3d39c],
  [0xa3d39c, 0xfff3d6, 0xff9fbf],
];

interface Doll {
  group: THREE.Group;
  baseY: number;
  phase: number;
}

function makeDoll(variant: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  const robes = ROBES[variant % ROBES.length]!;
  const layers = [
    { r: 0.62, h: 1.25, y: 0.62, c: robes[0] },
    { r: 0.5, h: 1.05, y: 0.58, c: robes[1] },
    { r: 0.38, h: 0.85, y: 0.55, c: robes[2] },
  ];
  for (const l of layers) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 24, 1, false), new THREE.MeshStandardMaterial({ color: l.c, roughness: 0.75 }));
    m.position.y = l.y;
    g.add(m);
  }
  // sleeves
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: robes[1], roughness: 0.8 }));
    s.scale.set(1.4, 0.7, 1);
    s.position.set(side * 0.42, 0.62, 0.12);
    g.add(s);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), new THREE.MeshStandardMaterial({ color: 0xfff3d6, roughness: 0.6 }));
  head.position.y = 1.42;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1014, roughness: 0.5 }));
  hair.position.y = 1.45;
  g.add(hair);
  const crown = new THREE.Mesh(
    variant % 2 === 0 ? new THREE.BoxGeometry(0.14, 0.22, 0.14) : new THREE.CylinderGeometry(0.02, 0.2, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0xe6c45a, metalness: 0.8, roughness: 0.3, emissive: 0x554411 }),
  );
  crown.position.y = 1.78;
  g.add(crown);
  g.scale.setScalar(scale);
  return g;
}

function makeHishimochi(): THREE.Group {
  const g = new THREE.Group();
  const cols = [0xa3d39c, 0xfff3d6, 0xff9fbf];
  cols.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    m.rotation.y = Math.PI / 4;
    m.scale.set(1.3, 1, 0.8);
    m.position.y = 0.05 + i * 0.1;
    g.add(m);
  });
  return g;
}

export function makeHinaDan3d(): Scene {
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  const dolls: Doll[] = [];
  const lights: THREE.PointLight[] = [];
  const lanterns: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>[] = [];
  let petals: THREE.Points | null = null;
  let petalVel: Float32Array | null = null;
  let screenMat: THREE.MeshStandardMaterial | null = null;

  const ensure = (): void => {
    if (scene) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    scene.add(new THREE.AmbientLight(0xffe4d6, 0.45));
    const key = new THREE.DirectionalLight(0xfff0e0, 1.1);
    key.position.set(4, 9, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb0c8, 0.5);
    rim.position.set(-6, 5, -6);
    scene.add(rim);

    // gold folding screen: six slightly zig-zagged panels
    screenMat = new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.75, roughness: 0.35, emissive: 0x3a2a08 });
    for (let i = 0; i < 6; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 6.5), screenMat);
      panel.position.set(-6.25 + i * 2.5, 3.9, -3.2 + (i % 2) * 0.35);
      panel.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.18;
      scene.add(panel);
    }
    // tiers (red felt with gold edge), from top/back to bottom/front
    const tierDepth = 1.15;
    const tierH = 0.55;
    for (let i = 0; i < TIERS; i++) {
      const w = 6 + i * 0.9;
      const y = (TIERS - 1 - i) * tierH;
      const z = -2 + i * tierDepth;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, tierH, tierDepth), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xc8102e : 0x9c0f24, roughness: 0.9 }));
      box.position.set(0, y + tierH / 2, z);
      scene.add(box);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: 0xe6c45a, metalness: 0.8, roughness: 0.3 }));
      edge.position.set(0, y + tierH, z - tierDepth / 2 + 0.03);
      scene.add(edge);
      const n = DOLLS_PER_TIER[i]!;
      const scale = 0.62 - i * 0.03;
      for (let d = 0; d < n; d++) {
        const u = (d + 0.5) / n;
        const x = -w * 0.38 + w * 0.76 * u;
        const doll = makeDoll((i + d) % 3, scale);
        doll.position.set(x, y + tierH, z + 0.05);
        doll.rotation.y = (0.5 - u) * 0.5;
        scene.add(doll);
        dolls.push({ group: doll, baseY: y + tierH, phase: d * 1.3 + i * 0.7 });
      }
      if (n === 0) {
        for (let k = 0; k < 4; k++) {
          const hm = makeHishimochi();
          hm.position.set(-w * 0.36 + (w * 0.72 * (k + 0.5)) / 4, y + tierH, z);
          scene.add(hm);
        }
      }
    }
    // bonbori lanterns on the top tier
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x3a1a10 }));
      pole.position.set(side * 3.2, (TIERS - 1) * tierH + tierH + 0.8, -2);
      scene.add(pole);
      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.38, 0.7, 12),
        new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 0.8, roughness: 0.9, transparent: true, opacity: 0.92 }),
      );
      lantern.position.set(side * 3.2, (TIERS - 1) * tierH + tierH + 1.7, -2);
      scene.add(lantern);
      lanterns.push(lantern);
      const light = new THREE.PointLight(0xffc080, 6, 12, 1.6);
      light.position.copy(lantern.position);
      scene.add(light);
      lights.push(light);
    }
    // petals
    const n = 500;
    const pos = new Float32Array(n * 3);
    petalVel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12 + 1;
      petalVel[i] = 0.4 + Math.random() * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    petals = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb0c8, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
    scene.add(petals);
    scene.fog = new THREE.Fog(0x1a0b12, 12, 30);
  };

  return {
    id: 'hina_dan3d',
    group: 'hina',
    name: 'Hina Dan 3D (three.js)',
    description: 'ひな祭り素材（3D）。立体の七段飾りをカメラがゆっくり回り込み、お内裏様・三人官女・五人囃子がビートで揺れ、ぼんぼりの灯りが低域で明滅する。金屏風と舞う花びら。見せ場や決め場に向く',
    render(ctx, input) {
      ensure();
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      const t = input.t;
      // camera circles the display; intensity speeds it up, the beat nudges it in
      const orbit = t * (0.08 + input.intensity * 0.18);
      const radius = 12.5 - input.beatPulse * 0.6 * input.intensity;
      camera!.aspect = gl.w / gl.h;
      camera!.updateProjectionMatrix();
      camera!.position.set(Math.sin(orbit) * radius, 4.2 + Math.sin(t * 0.21) * 1.2, Math.cos(orbit) * radius + 2);
      camera!.lookAt(0, 2.1, 0.5);
      // dolls bob and sway on the beat, tier by tier
      for (const d of dolls) {
        const bob = input.beatPulse * (0.6 + 0.4 * Math.sin(d.phase));
        d.group.position.y = d.baseY + bob * 0.12 * (0.4 + input.intensity);
        d.group.rotation.z = Math.sin(t * 2.2 + d.phase) * 0.05 * input.energy + bob * 0.04;
        d.group.scale.y = d.group.scale.x * (1 + bob * 0.06);
      }
      const glow = 0.5 + input.bass * 1.4 + input.beatPulse * 1.2;
      for (const l of lights) l.intensity = 3 + glow * 4;
      for (const m of lanterns) m.material.emissiveIntensity = 0.5 + glow * 0.5;
      if (screenMat) screenMat.emissiveIntensity = 0.6 + input.high * 1.4;
      // petals fall and drift
      if (petals && petalVel) {
        const pos = petals.geometry.attributes.position as THREE.BufferAttribute;
        const dt = input.dt;
        for (let i = 0; i < petalVel.length; i++) {
          let y = pos.getY(i) - petalVel[i]! * dt * (1 + input.intensity) + input.beatPulse * dt * 2;
          let x = pos.getX(i) + Math.sin(t * 1.3 + i) * dt * 0.6;
          if (y < 0) {
            y = 9;
            x = (Math.random() - 0.5) * 16;
          }
          pos.setXY(i, x, y);
        }
        pos.needsUpdate = true;
        (petals.material as THREE.PointsMaterial).size = 0.1 + input.energy * 0.08;
      }
      (scene!.fog as THREE.Fog).color.set(input.palette.bg);
      gl.renderer.setClearColor(new THREE.Color(input.palette.bg), 1);
      gl.renderer.render(scene!, camera!);
      gl.blit(ctx, input.w, input.h);
    },
  };
}
