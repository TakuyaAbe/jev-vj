import * as THREE from 'three';

/** Internal render scale for GL scenes (fragment shaders are the bottleneck). */
const GL_SCALE = 0.75;

/**
 * One shared WebGL renderer for every GL scene. Scenes render into its canvas
 * and then blit it onto the 2D stage, so 2D and GL scenes crossfade the same way.
 */
export class GlContext {
  private static inst: GlContext | null = null;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  w = 0;
  h = 0;
  /** info log of the last shader that failed to compile (captured via renderer.debug) */
  private lastShaderError: string | null = null;
  private probe: THREE.WebGLRenderTarget | null = null;

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = true;
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      const log = [gl.getShaderInfoLog(fs), gl.getShaderInfoLog(vs), gl.getProgramInfoLog(program)].map((x) => x?.trim()).filter(Boolean);
      this.lastShaderError = log.join('\n') || 'shader link failed';
      console.warn('[jev-vj] shader error\n' + this.lastShaderError);
    };
  }

  /**
   * Render the scene once into a 4x4 target and report the compile / link log
   * (null = OK). Used to reject broken plugin shaders before they reach the stage.
   */
  tryCompile(scene: THREE.Scene, camera: THREE.Camera): string | null {
    this.lastShaderError = null;
    this.probe ??= new THREE.WebGLRenderTarget(4, 4);
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.probe);
    try {
      this.renderer.render(scene, camera);
    } catch (e) {
      this.lastShaderError = e instanceof Error ? e.message : String(e);
    }
    this.renderer.setRenderTarget(prev);
    return this.lastShaderError;
  }

  static get(): GlContext {
    return (GlContext.inst ??= new GlContext());
  }

  ensureSize(stageW: number, stageH: number): void {
    const w = Math.max(1, Math.round(stageW * GL_SCALE));
    const h = Math.max(1, Math.round(stageH * GL_SCALE));
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.renderer.setSize(w, h, false);
    }
  }

  blit(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.canvas, 0, 0, w, h);
  }
}
