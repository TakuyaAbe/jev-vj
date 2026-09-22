import * as THREE from 'three';
import type { Effect, RenderInput, Scene } from '../types';
import { GlContext } from '../gl/context';
import { makeShaderScene } from '../gl/shader-scene';
import { makeAudioUniforms, updateAudioUniforms, type AudioUniforms, type BeatCounter } from '../gl/uniforms';
import common from '../gl/shaders/common.glsl?raw';

/**
 * Plugin API for scenes written in TypeScript / JavaScript.
 *
 * Bundled: drop `src/plugins/<name>.scene.ts` exporting `default` (a Scene or Scene[]).
 * Runtime: drop a `.js` / `.mjs` ES module on the stage; it gets the same helpers
 * from `globalThis.JEVJ` (THREE included) and exports `default` the same way.
 *
 * Every helper takes the metadata Jev needs: `description` is shown to people,
 * `short` (~30 chars: look, mood, where it fits) is what Jev reads.
 */
export interface SceneMeta {
  id: string;
  name: string;
  description: string;
  short?: string;
  group?: string;
  maxBars?: number;
}

/** Plain Canvas 2D. `render` draws the whole frame onto the stage context. */
export function defineCanvasScene(def: SceneMeta & { render: Scene['render']; reset?: () => void }): Scene {
  return { group: '2d', ...def };
}

export interface ThreeSetup {
  THREE: typeof THREE;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** audio uniforms (uTime, uBass, uBeatPulse, uColA …) for your ShaderMaterials */
  uniforms: AudioUniforms;
}
export interface ThreeHooks {
  /** called every frame before rendering; move meshes, the camera, etc. */
  update(input: RenderInput, setup: ThreeSetup): void;
  reset?(): void;
}

/**
 * three.js scene on the shared WebGL renderer. `setup` runs once (lazily) and
 * returns per-frame hooks; clear colour follows the palette background.
 */
export function defineThreeScene(def: SceneMeta & { fov?: number; setup(s: ThreeSetup): ThreeHooks }): Scene {
  let s: ThreeSetup | null = null;
  let hooks: ThreeHooks | null = null;
  const bc: BeatCounter = { count: 0, wasHigh: false };
  const bg = new THREE.Color();
  const ensure = (): ThreeSetup => {
    if (s) return s;
    const gl = GlContext.get();
    s = { THREE, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(def.fov ?? 60, 1, 0.05, 200), renderer: gl.renderer, uniforms: makeAudioUniforms() };
    hooks = def.setup(s);
    return s;
  };
  const sc: Scene = {
    id: def.id,
    name: def.name,
    description: def.description,
    short: def.short,
    maxBars: def.maxBars,
    group: def.group ?? 'gl',
    prepare() {
      const st = ensure();
      const err = GlContext.get().tryCompile(st.scene, st.camera);
      sc.error = err ?? undefined;
      return err;
    },
    reset: () => hooks?.reset?.(),
    render(ctx, input) {
      const st = ensure();
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      updateAudioUniforms(st.uniforms, input, gl.w, gl.h, bc);
      st.camera.aspect = gl.w / gl.h;
      st.camera.updateProjectionMatrix();
      hooks!.update(input, st);
      gl.renderer.setClearColor(bg.set(input.palette.bg), 1);
      gl.renderer.render(st.scene, st.camera);
      gl.blit(ctx, input.w, input.h);
    },
  };
  return sc;
}

/**
 * Full-screen fragment shader with the Jev uniforms and helpers from common.glsl
 * (uTime, uBass, uBeatPulse, uIntensity, uColA…, fft(x), wav(x), noise, fbm, rot).
 */
export function defineGlslScene(def: SceneMeta & { frag: string }): Scene {
  return makeShaderScene({ ...def, group: def.group ?? 'gl', frag: `${common}\n${def.frag}` });
}

/** Canvas 2D post effect over the finished stage (after the scene and crossfade). */
export function defineCanvasEffect(def: Omit<Effect, 'error'>): Effect {
  return def;
}

export { THREE };
