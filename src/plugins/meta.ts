/**
 * Plugin metadata shared by every file format.
 *
 * GLSL / Shadertoy files carry it in comment tags:
 *   // @name   Neon Rings
 *   // @description ビートで広がるネオンの輪。…
 *   // @short  ネオンの輪。ドロップ
 *   // @group  shadertoy
 *   // @maxBars 8
 * ISF files carry it in their JSON header (NAME / DESCRIPTION) plus an optional
 * "JEVJ" object with the same keys (ISF hosts ignore unknown keys).
 */
export interface PluginMeta {
  id?: string;
  name?: string;
  description?: string;
  short?: string;
  group?: string;
  maxBars?: number;
}

const TAG = /^\s*(?:\/\/+|\*|\/\*+)?\s*@(\w+)\s+(.+?)\s*(?:\*\/)?\s*$/;

export function parseCommentMeta(src: string): PluginMeta {
  const meta: PluginMeta = {};
  // only scan the leading comment region so string literals further down are never read as tags
  for (const line of src.split('\n').slice(0, 40)) {
    const m = TAG.exec(line);
    if (!m) continue;
    const [, key, value] = m as unknown as [string, string, string];
    if (key === 'maxBars') meta.maxBars = Number(value) || undefined;
    else if (key === 'name' || key === 'description' || key === 'short' || key === 'group' || key === 'id') meta[key] = value;
  }
  return meta;
}

export function slug(s: string): string {
  return (
    s
      .replace(/\.[^.]+$/, '')
      .replace(/\.(scene|shadertoy|isf)$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'plugin'
  );
}

export function baseName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Title-case a file name for display when no @name is given. */
export function titleFromFile(path: string): string {
  return slug(baseName(path))
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export type ShaderFormat = 'isf' | 'shadertoy' | 'jev';

/** ISF = leading JSON comment; Shadertoy = defines mainImage; anything else = Jev uniforms (common.glsl). */
export function detectShaderFormat(src: string): ShaderFormat {
  if (/^\s*\/\*\s*\{/.test(src)) return 'isf';
  if (/\bvoid\s+mainImage\s*\(/.test(src)) return 'shadertoy';
  return 'jev';
}

/**
 * Remove directives three.js adds itself (it compiles as GLSL ES 3.00 with its own prefix).
 * Lines are blanked, never removed, so compiler line numbers still match the file.
 */
export function stripDirectives(src: string): string {
  return src.replace(/^[ \t]*#version.*$/gm, '').replace(/^[ \t]*precision\s+\w+\s+\w+\s*;/gm, '');
}

/**
 * Source markers. Runtimes put `sourceStart()` on the line right before the
 * user's code and `SOURCE_END` right after it; GlContext uses them to map
 * compiler line numbers (which count three's prefix + our headers) back to the
 * user's file. `offset` = lines of the file that precede the compiled body
 * (e.g. an ISF JSON header).
 */
export const SOURCE_TAG = '// @jevj-src';
export const SOURCE_END = '// @jevj-end';
export function sourceStart(file: string, offset = 0): string {
  return `${SOURCE_TAG} ${offset} ${baseName(file).replace(/[\r\n]/g, '')}`;
}
