import type { Effect, Palette, RenderInput, Scene, TransitionId } from './types';

/**
 * Draws the active scene, composites a crossfading next scene over it, and
 * paints the flash overlay used by the "flash" transition.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  /** transparent layer above the stage for text overlays (log, logo); cleared each frame */
  readonly overlay: HTMLCanvasElement;
  readonly overlayCtx: CanvasRenderingContext2D;
  private readonly off: HTMLCanvasElement;
  private readonly offCtx: CanvasRenderingContext2D;
  w = 0;
  h = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d')!;
    this.overlay = document.createElement('canvas');
    this.overlay.id = 'overlay-stage';
    Object.assign(this.overlay.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    canvas.insertAdjacentElement('afterend', this.overlay);
    this.overlayCtx = this.overlay.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  clearOverlay(): void {
    this.overlayCtx.clearRect(0, 0, this.w, this.h);
  }

  resize(): void {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.w = Math.floor(window.innerWidth * dpr);
    this.h = Math.floor(window.innerHeight * dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.off.width = this.w;
    this.off.height = this.h;
    this.overlay.width = this.w;
    this.overlay.height = this.h;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  draw(
    input: Omit<RenderInput, 'w' | 'h'>,
    scene: Scene,
    transition: { to: Scene; kind: TransitionId; progress: number } | null,
    flashAmount: number,
    effects: { fx: Effect; amount: number }[] = [],
  ): void {
    const full: RenderInput = { ...input, w: this.w, h: this.h };
    this.safeRender(scene, this.ctx, full);
    if (transition && transition.kind === 'crossfade') {
      this.safeRender(transition.to, this.offCtx, full);
      this.ctx.globalAlpha = Math.min(1, transition.progress);
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(this.off, 0, 0);
      this.ctx.globalAlpha = 1;
    }
    for (const { fx, amount } of effects) {
      if (fx.error || amount <= 0.001) continue;
      try {
        fx.apply(this.ctx, full, amount);
      } catch (e) {
        fx.error = e instanceof Error ? e.message : String(e);
        console.warn(`[jev-vj] effect ${fx.id}`, e);
      }
      this.ctx.globalAlpha = 1;
      this.ctx.globalCompositeOperation = 'source-over';
    }
    if (flashAmount > 0) {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillStyle = '#fff';
      this.ctx.globalAlpha = Math.min(1, flashAmount);
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.globalAlpha = 1;
    }
  }

  /** A plugin that throws is flagged (the director then cuts away) instead of killing the frame loop. */
  private safeRender(scene: Scene, ctx: CanvasRenderingContext2D, input: RenderInput): void {
    try {
      scene.render(ctx, input);
    } catch (e) {
      scene.error = e instanceof Error ? e.message : String(e);
      console.warn(`[jev-vj] scene ${scene.id}`, e);
      ctx.fillStyle = input.palette.bg;
      ctx.fillRect(0, 0, input.w, input.h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear(palette: Palette): void {
    this.ctx.fillStyle = palette.bg;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
}
