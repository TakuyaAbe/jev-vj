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

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = true;
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
