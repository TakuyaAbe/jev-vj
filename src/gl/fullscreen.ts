import * as THREE from 'three';

/** A clip-space quad (position.xy in -1..1) and a camera that ignores it. */
export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 isf_FragNormCoord;
void main() {
  isf_FragNormCoord = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

let quadGeo: THREE.PlaneGeometry | null = null;
let cam: THREE.OrthographicCamera | null = null;

export function fullscreenCamera(): THREE.OrthographicCamera {
  return (cam ??= new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
}

/** A scene holding one full-screen quad with the given material. */
export function fullscreenScene(material: THREE.Material): { scene: THREE.Scene; mesh: THREE.Mesh } {
  quadGeo ??= new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(quadGeo, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { scene, mesh };
}

let copy: { scene: THREE.Scene; mat: THREE.ShaderMaterial } | null = null;

/** Draw a texture onto the current render target (the GL canvas when null). */
export function copyTexture(renderer: THREE.WebGLRenderer, tex: THREE.Texture): void {
  if (!copy) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null } },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc;
        varying vec2 isf_FragNormCoord;
        void main() { gl_FragColor = texture2D(tSrc, isf_FragNormCoord); }
      `,
      depthTest: false,
      depthWrite: false,
    });
    copy = { scene: fullscreenScene(mat).scene, mat };
  }
  copy.mat.uniforms.tSrc!.value = tex;
  renderer.render(copy.scene, fullscreenCamera());
}

/** Resize-aware render target (linear filtering, optional float). */
export function makeTarget(w: number, h: number, float = false): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(w, h, {
    type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
}
