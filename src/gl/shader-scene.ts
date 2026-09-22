import * as THREE from 'three';
import type { Scene, SceneId } from '../types';
import { GlContext } from './context';
import { makeAudioUniforms, updateAudioUniforms, type BeatCounter } from './uniforms';

const VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export interface ShaderSceneDef {
  id: SceneId;
  group: Scene['group'];
  name: string;
  description: string;
  maxBars?: number;
  frag: string;
}

/** A full-screen fragment shader driven by the shared audio uniforms. */
export function makeShaderScene(def: ShaderSceneDef): Scene {
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  const uniforms = makeAudioUniforms();
  const bc: BeatCounter = { count: 0, wasHigh: false };

  const ensure = (): void => {
    if (scene) return;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: def.frag, depthTest: false, depthWrite: false });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  };

  return {
    id: def.id,
    group: def.group,
    name: def.name,
    description: def.description,
    maxBars: def.maxBars,
    render(ctx, input) {
      ensure();
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      updateAudioUniforms(uniforms, input, gl.w, gl.h, bc);
      gl.renderer.render(scene!, camera!);
      gl.blit(ctx, input.w, input.h);
    },
  };
}
