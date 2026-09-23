import type { LogEntry } from './director';

interface Line {
  at: number;
  kind: LogEntry['kind'];
  text: string;
}

const MAX_LINES = 120;
const VERDICT_KINDS = new Set<LogEntry['kind']>(['approved', 'rejected', 'keep', 'logo']);


/**
 * Faint CLI-style log over the whole stage. Every director event (MAGI
 * deliberations, verdicts, DSP triggers, logo) is one line; approvals and
 * rejections get inverse-video badges so they read at a glance.
 */
export class TerminalOverlay {
  enabled = true;
  /** log rows shown above the live line and prompt */
  maxRows = 10;
  /** Google Fonts family for the log (empty = system monospace) */
  fontFamily = '';
  private lines: Line[] = [];
  /** compact live readout shown after the prompt, replaced every frame */
  status = '';
  /** the bar in progress: fills in beat by beat, then commits as one 'dsp' line */
  live = '';

  /** finalize the in-progress bar as a normal log line */
  commitLive(text: string): void {
    this.push({ t: performance.now(), kind: 'dsp', text });
    this.live = '';
  }

  private font(px: number, bold = false): string {
    const fam = this.fontFamily ? `"${this.fontFamily}", ` : '';
    return `${bold ? 'bold ' : ''}${Math.round(px)}px ${fam}"SF Mono", Menlo, "Hiragino Sans", monospace`;
  }

  push(e: LogEntry): void {
    const d = new Date();
    const p2 = (n: number): string => n.toString().padStart(2, '0');
    // fixed 12-char stamp (HH:MM:SS.mmm) so the badge parser can slice it off reliably
    const stamp = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, '0')}`;
    this.lines.push({ at: performance.now(), kind: e.kind, text: `${stamp} ${e.text}` });
    if (this.lines.length > MAX_LINES) this.lines.shift();
  }

  clear(): void {
    this.lines = [];
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, dim: number): void {
    if (!this.enabled) return;
    const size = Math.max(12, Math.min(20, h / 52));
    const lh = size * 1.32;
    const left = w * 0.018;
    // prompt sits near the bottom edge; the log grows upward from it
    const bottom = h - Math.max(size * 0.8, h * 0.025);
    const top = h * 0.02;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // live bar line just above the prompt
    if (this.live) {
      ctx.font = this.font(size);
      ctx.globalAlpha = 0.9 * dim;
      ctx.fillStyle = '#c8ffe0';
      ctx.fillText(this.live, left, bottom - lh);
    }
    // lay lines out from the bottom up; verdict rows get a little air for their color band.
    // Older lines fade so only the recent past stays readable.
    let y = bottom - lh * 2;
    let rows = 0;
    for (let i = this.lines.length - 1; i >= 0 && rows < this.maxRows; i--, rows++) {
      const line = this.lines[i]!;
      const big = VERDICT_KINDS.has(line.kind);
      const rowH = big ? lh * 1.25 : lh;
      if (y - rowH < top) break;
      const ageS = (now - line.at) / 1000;
      const fadeIn = Math.min(1, (now - line.at) / 180);
      const ageFade = Math.max(0.25, Math.min(1, 1 - (ageS - 20) / 40));
      ctx.font = this.font(size);
      this.line(ctx, line, left, y, size, fadeIn * ageFade * dim, w, big);
      y -= rowH;
    }
    // prompt with a compact live readout
    ctx.font = this.font(size);
    const blink = Math.floor(now / 530) % 2 === 0;
    ctx.globalAlpha = 0.55 * dim;
    ctx.fillStyle = '#9fffc8';
    ctx.fillText(`jev@sayu_nomu_:~$ ${this.status}${blink ? ' █' : '  '}`, left, bottom);
    ctx.restore();
  }

  private line(ctx: CanvasRenderingContext2D, line: Line, x: number, y: number, size: number, alpha: number, w: number, big = false): void {
    const badge = (label: string, color: string, rest: string): void => {
      // full-width band behind the verdict so it reads even while analysis scrolls past
      if (big) {
        ctx.globalAlpha = Math.min(1, alpha * 3) * 0.16;
        ctx.fillStyle = color;
        ctx.fillRect(0, y - size * 1.0, w, size * 1.35);
        ctx.globalAlpha = Math.min(1, alpha * 3);
        ctx.fillStyle = color;
        ctx.fillText('▶', x - size * 0.0, y);
        x += size * 1.1;
      }
      // inverse-video badge for the verdict word
      ctx.globalAlpha = Math.min(1, alpha * 3);
      const stamp = line.text.slice(0, 13);
      ctx.fillStyle = '#c8ffe0';
      ctx.fillText(stamp, x, y);
      const bx = x + ctx.measureText(stamp).width;
      const bw = ctx.measureText(` ${label} `).width;
      ctx.fillStyle = color;
      ctx.fillRect(bx, y - size * 0.95, bw, size * 1.25);
      ctx.fillStyle = '#000';
      ctx.fillText(` ${label} `, bx, y);
      ctx.fillStyle = color;
      ctx.fillText(rest, bx + bw + size * 0.4, y);
    };
    const rest = line.text.slice(13);
    switch (line.kind) {
      case 'approved':
        badge('可決', '#39ff88', rest.replace(/^\s*可決\s*/, ''));
        return;
      case 'rejected':
        badge('否決', '#ff3a2e', rest.replace(/^\s*否決\s*/, ''));
        return;
      case 'logo':
        badge('決め場', '#ffe94d', rest.replace(/^\s*決め場\s*/, ''));
        return;
      case 'keep':
        badge('維持', '#ffb547', rest.replace(/^\s*維持\s*/, ''));
        return;
      case 'dsp':
        ctx.globalAlpha = alpha * 0.75;
        ctx.fillStyle = '#7fd8a8';
        break;
      case 'magi':
        ctx.globalAlpha = alpha * 1.8;
        ctx.fillStyle = '#c8ffe0';
        break;
      case 'switch':
      case 'armed':
        ctx.globalAlpha = alpha * 2.0;
        ctx.fillStyle = '#9fffc8';
        break;
      case 'error':
        ctx.globalAlpha = alpha * 2.4;
        ctx.fillStyle = '#ff6b6b';
        break;
      default:
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#9fffc8';
    }
    const maxW = w * 0.96;
    let text = line.text;
    if (ctx.measureText(text).width > maxW) {
      while (text.length > 8 && ctx.measureText(`${text}…`).width > maxW) text = text.slice(0, -4);
      text += '…';
    }
    ctx.fillText(text, x, y);
  }
}
