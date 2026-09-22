import { defineThreeScene } from '../api';

/** A ring of instanced pillars, one per spectrum band, rising with the music. */
export default defineThreeScene({
  id: 'monoliths',
  name: 'Monoliths (three.js)',
  description: '円形に並んだ 64 本の柱がスペクトラムに合わせて伸び縮みし、カメラがゆっくり周回する。建築的で力強い。ビルドアップからドロップ、重いベースの場面に合う',
  short: 'スペクトラムの柱が円環に並ぶ（3D）。力強い。ビルド・ドロップ',
  setup({ THREE, scene }) {
    const N = 64;
    const geo = new THREE.BoxGeometry(0.18, 1, 0.18);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    scene.add(mesh);
    const floor = new THREE.Mesh(new THREE.RingGeometry(0.5, 3.4, 64, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const colA = new THREE.Color();
    const colB = new THREE.Color();
    const c = new THREE.Color();
    const heights = new Float32Array(N);
    return {
      update(input, { camera }) {
        colA.set(input.palette.a);
        colB.set(input.palette.b);
        for (let i = 0; i < N; i++) {
          // log-spaced bands so bass does not take half the ring
          const bin = Math.floor(Math.pow(i / N, 2) * 380) + 2;
          const v = (input.spectrum[bin] ?? 0) / 255;
          heights[i] = Math.max(v * (1 + input.intensity * 2.5), heights[i]! * 0.9);
          const a = (i / N) * Math.PI * 2;
          pos.set(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4);
          q.setFromAxisAngle(up, -a);
          scl.set(1, 0.05 + heights[i]! * 2.2 + input.beatPulse * 0.15, 1);
          m.compose(pos, q, scl);
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, c.copy(colA).lerp(colB, v));
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        floor.material.color.set(input.palette.c);
        const orbit = input.t * (0.08 + input.intensity * 0.25);
        camera.position.set(Math.sin(orbit) * 5.5, 2.2 + Math.sin(input.t * 0.2) * 0.8 + input.bass * 0.3, Math.cos(orbit) * 5.5);
        camera.lookAt(0, 0.9, 0);
      },
    };
  },
});
