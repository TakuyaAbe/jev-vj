import { defineThreeScene } from '../api';

/**
 * Flying through square gates. Travel is tempo-locked (one gate per beat at
 * normal intensity, half speed when calm, double at peak), the gates twist a
 * little per bar and light up in palette colours as they pass; streaks along
 * the walls sell the speed. Beat punch = gate scale + FOV kick, never jitter.
 */
export default defineThreeScene({
  id: 'frame_highway',
  name: 'Frame Highway (three.js)',
  description:
    '四角いゲートが奥へ連なり、テンポに同期して一拍ごとにくぐり抜けていく。壁際を光の筋が流れ、スピード感と高揚感がある。ピークタイムの4つ打ちや、ドロップ後の高速パートに合う。静かな場面では速度が半分に落ちて漂う',
  short: '四角いゲートを拍ごとに疾走（3D）。高速・爽快。ピークタイム',
  fov: 70,
  setup({ THREE, scene }) {
    const N = 40;
    const GAP = 2.2;
    const FAR = N * GAP;
    const fog = new THREE.Fog('#000000', FAR * 0.25, FAR * 0.95);
    scene.fog = fog;

    // a square outline: 4 theta segments on a ring, rotated 45 degrees
    const frameGeo = new THREE.RingGeometry(1.25, 1.4, 4, 1, Math.PI / 4);
    const frameMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const frames = new THREE.InstancedMesh(frameGeo, frameMat, N);
    frames.frustumCulled = false;
    scene.add(frames);

    const S = 90;
    const streakGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
    const streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const streaks = new THREE.InstancedMesh(streakGeo, streakMat, S);
    streaks.frustumCulled = false;
    scene.add(streaks);
    const sAng = new Float32Array(S);
    const sZ = new Float32Array(S);
    const sSpd = new Float32Array(S);
    for (let i = 0; i < S; i++) {
      sAng[i] = Math.random() * Math.PI * 2;
      sZ[i] = Math.random() * FAR;
      sSpd[i] = 0.6 + Math.random() * 0.8;
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const cC = new THREE.Color();
    const cBg = new THREE.Color();
    const c = new THREE.Color();

    let dist = 0;
    let speed = 1;
    let punch = 0;
    let roll = 0;
    let twist = 0.15;
    let spin = 0;
    return {
      update(input, { camera }) {
        const dt = Math.min(input.dt, 0.1);
        cA.set(input.palette.a);
        cB.set(input.palette.b);
        cC.set(input.palette.c);
        cBg.set(input.palette.bg);
        fog.color.copy(cBg);

        const bps = (input.bpm > 60 ? input.bpm : 120) / 60;
        const mult = input.intensity < 0.3 ? 0.5 : input.intensity > 0.8 ? 2 : 1;
        speed += (GAP * bps * mult - speed) * Math.min(1, dt * 1.5);
        dist += speed * dt;
        spin += (twist * speed * dt) / GAP;
        punch += (input.beatPulse * (0.4 + input.bass * 0.6) - punch) * Math.min(1, dt * 20);

        const k0 = Math.floor(dist / GAP);
        // smoothed so a jump in Jev's intensity doesn't snap every gate's angle
        twist += (0.12 + input.intensity * 0.2 - twist) * Math.min(1, dt * 0.5);
        for (let i = 0; i < N; i++) {
          const k = k0 + i;
          const z = -k * GAP + dist; // relative to the camera at z=0
          // spectrum band per gate, cycling so each gate has its own voice
          const bin = 3 + ((k * 7) % 48) * 4;
          const v = (input.spectrum[bin] ?? 0) / 255;
          const near = Math.max(0, 1 - Math.abs(z + GAP * 1.5) / (GAP * 2));
          pos.set(0, 0, z);
          // (k - dist/GAP) stays bounded; spin carries the world angle so each gate keeps its own
          e.set(0, 0, (k - dist / GAP) * twist + spin + (Math.floor(k / 4) % 8) * 0.3);
          q.setFromEuler(e);
          const s = 1 + punch * 0.12 + v * 0.15 * input.intensity;
          scl.set(s, s, 1);
          m.compose(pos, q, scl);
          frames.setMatrixAt(i, m);
          c.copy(k % 4 === 0 ? cC : k % 2 === 0 ? cA : cB);
          c.multiplyScalar(0.35 + v * 0.5 + near * (0.4 + punch * 0.8));
          frames.setColorAt(i, c);
        }
        frames.instanceMatrix.needsUpdate = true;
        if (frames.instanceColor) frames.instanceColor.needsUpdate = true;

        const streakLen = 0.6 + speed * 0.35;
        for (let i = 0; i < S; i++) {
          sZ[i] = sZ[i]! + speed * sSpd[i]! * 1.8 * dt;
          if (sZ[i]! > FAR) sZ[i] = sZ[i]! - FAR;
          const r = 0.72 + (i % 3) * 0.05; // inside the gate opening (half-side ~0.88)
          pos.set(Math.cos(sAng[i]!) * r, Math.sin(sAng[i]!) * r, -FAR + sZ[i]!);
          q.identity();
          scl.set(1, 1, streakLen);
          m.compose(pos, q, scl);
          streaks.setMatrixAt(i, m);
          c.copy(i % 2 ? cA : cC).multiplyScalar(0.4 + input.high * 0.6);
          streaks.setColorAt(i, c);
        }
        streaks.instanceMatrix.needsUpdate = true;
        if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true;

        roll += (Math.sin(input.t * 0.23) * 0.35 * input.intensity - roll) * Math.min(1, dt * 2);
        camera.position.set(Math.sin(input.t * 0.31) * 0.25, Math.cos(input.t * 0.27) * 0.18, 0);
        camera.rotation.set(0, 0, roll);
        camera.fov = 70 + punch * 7 * (0.4 + input.intensity);
        camera.updateProjectionMatrix();
      },
      reset() {
        dist = 0;
        speed = 1;
        punch = 0;
        roll = 0;
        spin = 0;
      },
    };
  },
});
