import type { RenderInput } from './types';

/**
 * Full-screen club logo for the 決め場. Slams in with a wipe, breathes with
 * the beat, splits into palette-colored ghosts on onsets, wipes out.
 */
export class LogoOverlay {
  /** big line */
  jp = '🍲闇鍋🍲';
  /** small letter-spaced line */
  en = 'BAKUROCHO DOMINO CLUB PRESENTS';
  /** draw the small line above the big one */
  subAbove = true;
  /** Google Fonts family names (empty = system default) */
  jpFamily = '';
  enFamily = '';
  jpWeight = 900;
  enWeight = 800;

  private jpFont(px: number): string {
    const fam = this.jpFamily ? `"${this.jpFamily}", ` : '';
    return `${this.jpWeight} ${Math.round(px)}px ${fam}"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;
  }

  private enFont(px: number): string {
    const fam = this.enFamily ? `"${this.enFamily}", ` : '';
    return `${this.enWeight} ${Math.round(px)}px ${fam}"Helvetica Neue", "Inter", "Hiragino Sans", sans-serif`;
  }
  private shownAt = -1;
  private hiddenAt = -1;
  private visible = false;

  get active(): boolean {
    return this.visible;
  }

  show(now: number): void {
    if (this.visible) return;
    this.visible = true;
    this.shownAt = now;
    this.hiddenAt = -1;
  }

  hide(now: number): void {
    if (!this.visible) return;
    this.visible = false;
    this.hiddenAt = now;
  }

  toggle(now: number): void {
    if (this.visible) this.hide(now);
    else this.show(now);
  }

  /** Largest font size (≤ max) at which `text` fits in `maxW`; `font100` is the font at 100px. */
  private fitSize(ctx: CanvasRenderingContext2D, text: string, font100: string, maxW: number, max: number, spacing = 0): number {
    ctx.save();
    ctx.font = font100;
    ctx.letterSpacing = `${spacing * 100}px`; // measured at 100px, scales linearly
    const w100 = Math.max(1, ctx.measureText(text).width);
    ctx.restore();
    return Math.max(8, Math.min(max, (100 * maxW) / w100));
  }

  /** @param visibleW / visibleH stage area not covered by the panel (side panel on desktop, bottom sheet on phones); the logo centers and fits inside it */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, input: RenderInput, visibleW = w, visibleH = h): void {
    const IN = 420;
    const OUT = 380;
    let k: number; // 0..1 presence
    if (this.visible) k = Math.min(1, (now - this.shownAt) / IN);
    else if (this.hiddenAt >= 0) k = 1 - Math.min(1, (now - this.hiddenAt) / OUT);
    else return;
    if (k <= 0) return;
    const ease = k < 1 ? 1 - Math.pow(1 - k, 3) : 1;

    const cx = visibleW / 2;
    const cy = visibleH / 2;
    const jpSize = this.fitSize(ctx, this.jp, this.jpFont(100), visibleW * 0.86, visibleH * 0.2);
    const enSize = this.fitSize(ctx, this.en, this.enFont(100), visibleW * 0.86, jpSize * 0.32, 0.32);
    const bandH = jpSize * 2.6;
    const pulse = 1 + input.beatPulse * 0.035 * (0.5 + input.intensity);

    ctx.save();
    // dark band wiping open from the center line
    ctx.globalAlpha = 0.72 * Math.min(1, ease * 1.3);
    ctx.fillStyle = '#000';
    const openH = bandH * ease;
    ctx.fillRect(0, cy - openH / 2, w, openH);
    // thin rules
    ctx.globalAlpha = ease;
    ctx.fillStyle = input.palette.c;
    const ruleW = w * ease;
    ctx.fillRect(w / 2 - ruleW / 2, cy - bandH / 2, ruleW, Math.max(1, jpSize * 0.03));
    ctx.fillRect(w / 2 - ruleW / 2, cy + bandH / 2, ruleW, Math.max(1, jpSize * 0.03));

    // clip region reveals the text left → right while entering
    ctx.beginPath();
    ctx.rect(cx - (visibleW / 2) * ease, cy - bandH / 2, visibleW * ease, bandH);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const jpY = this.subAbove ? jpSize * 0.16 : -jpSize * 0.28;
    const enY = this.subAbove ? -jpSize * 0.62 : jpSize * 0.62;
    const glitch = input.onset && input.intensity > 0.5 ? jpSize * 0.06 : jpSize * 0.008 * input.high;

    // colored ghosts
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = this.jpFont(jpSize);
    ctx.globalAlpha = 0.55 * ease;
    ctx.fillStyle = input.palette.a;
    ctx.fillText(this.jp, -glitch, jpY);
    ctx.fillStyle = input.palette.b;
    ctx.fillText(this.jp, glitch, jpY);
    ctx.globalCompositeOperation = 'source-over';

    // main text
    ctx.globalAlpha = ease;
    ctx.fillStyle = '#fff';
    ctx.fillText(this.jp, 0, jpY);
    ctx.font = this.enFont(enSize);
    ctx.letterSpacing = `${Math.round(enSize * 0.32)}px`;
    ctx.fillStyle = input.palette.c;
    ctx.fillText(this.en, enSize * 0.16, enY);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }
}
