import * as THREE from 'three';
import { SOURCE_END, SOURCE_TAG } from '../plugins/meta';

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
      const fsLog = gl.getShaderInfoLog(fs)?.trim() ?? '';
      const vsLog = gl.getShaderInfoLog(vs)?.trim() ?? '';
      const progLog = gl.getProgramInfoLog(program)?.trim() ?? '';
      const raw = [fsLog, vsLog, progLog].filter(Boolean).join('\n');
      if (fsLog) this.lastShaderError = formatShaderLog(fsLog, gl.getShaderSource(fs) ?? '');
      else if (vsLog) this.lastShaderError = formatShaderLog(vsLog, gl.getShaderSource(vs) ?? '');
      else this.lastShaderError = formatShaderLog(progLog || 'shader link failed', '');
      console.warn(`[jev-vj] shader error\n${this.lastShaderError}\n--- raw log ---\n${raw}`);
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

const MAX_ERROR_LINES = 3;

/**
 * Turn a GLSL info log into at most 3 "file:line: message" lines.
 *
 * The compiled source is three's prefix + our header + the user's code, so
 * the driver's line numbers ("ERROR: 0:70: ...", or NVIDIA's "0(70) : error")
 * are shifted. When `source` carries the markers from `sourceStart()` /
 * `SOURCE_END`, lines inside the user's code are mapped back to the file;
 * lines outside it are reported as coming from the prelude / footer.
 */
export function formatShaderLog(log: string, source: string): string {
  let file = 'shader';
  let startLine = -1; // 1-based line of the start marker
  let endLine = Infinity;
  let offset = 0;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (startLine < 0 && l.startsWith(SOURCE_TAG)) {
      const m = /^\S+\s+\S+\s+(-?\d+)\s*(.*)$/.exec(l);
      offset = m ? Number(m[1]) : 0;
      file = m?.[2]?.trim() || file;
      startLine = i + 1;
    } else if (startLine >= 0 && l.startsWith(SOURCE_END)) {
      endLine = i + 1;
      break;
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  // ANGLE ends logs with a NUL; drop control characters before parsing
  for (const rawLine of log.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').split('\n')) {
    const t = rawLine.trim();
    if (!t || /compilation errors?\.\s*No code generated/i.test(t)) continue;
    if (/^WARNING\b/i.test(t) || /:\s*warning\b/i.test(t)) continue;
    let lineNo: number | null = null;
    let msg = t;
    const ang = /^ERROR:\s*\d+:(\d+):\s*(.*)$/i.exec(t);
    const nv = /^\d+\((\d+)\)\s*:\s*(?:error\s*\w*\s*:)?\s*(.*)$/i.exec(t);
    if (ang) [lineNo, msg] = [Number(ang[1]), ang[2]!];
    else if (nv) [lineNo, msg] = [Number(nv[1]), nv[2]!];
    else msg = t.replace(/^ERROR:\s*/i, '');
    msg = msg.replace(/\s+/g, ' ').trim();
    let where: string;
    if (lineNo === null) where = file;
    else if (startLine < 0) where = `${file}:${lineNo}`;
    else if (lineNo <= startLine) where = `${file} (prelude line ${lineNo})`;
    else if (lineNo >= endLine) where = file;
    else where = `${file}:${lineNo - startLine + offset}`;
    const entry = `${where}: ${msg}`;
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  if (!out.length) return log.trim().split('\n').slice(0, MAX_ERROR_LINES).join('\n') || 'shader compile failed';
  if (out.length > MAX_ERROR_LINES) {
    const more = out.length - MAX_ERROR_LINES;
    return [...out.slice(0, MAX_ERROR_LINES - 1), `${out[MAX_ERROR_LINES - 1]} (+${more} more)`].join('\n');
  }
  return out.join('\n');
}
