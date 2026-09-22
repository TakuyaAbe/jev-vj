import type { Effect, Scene } from '../types';
import { makeIsfEffect, makeIsfScene, parseIsf } from '../gl/isf';
import { makeShadertoyScene } from '../gl/shadertoy';
import { makeShaderScene } from '../gl/shader-scene';
import common from '../gl/shaders/common.glsl?raw';
import * as api from './api';
import { baseName, detectShaderFormat, parseCommentMeta, slug, titleFromFile } from './meta';

export interface Loaded {
  scenes: Scene[];
  effects: Effect[];
}

export const SHADER_EXT = /\.(fs|frag|glsl|isf|txt)$/i;
export const MODULE_EXT = /\.(m?js)$/i;

/**
 * Turn one shader file into a scene or effect, whatever the dialect:
 * ISF (JSON header), Shadertoy (mainImage) or Jev GLSL (common.glsl uniforms).
 */
export function fromShaderSource(text: string, path: string, opts: { idPrefix?: string; group?: string } = {}): Loaded {
  const file = baseName(path);
  const id = `${opts.idPrefix ?? ''}${slug(file)}`;
  const fallbackName = titleFromFile(file);
  const format = detectShaderFormat(text);
  if (format === 'isf') {
    const { header } = parseIsf(text);
    const isFilter = (header.INPUTS ?? []).some((i) => i.NAME === 'inputImage' && i.TYPE === 'image');
    const o = { id, source: path, group: opts.group, fallbackName };
    return isFilter ? { scenes: [], effects: [makeIsfEffect(text, o)] } : { scenes: [makeIsfScene(text, o)], effects: [] };
  }
  const meta = parseCommentMeta(text);
  if (opts.group && !meta.group) meta.group = opts.group;
  if (format === 'shadertoy') return { scenes: [makeShadertoyScene(text, { id, source: path, meta, fallbackName })], effects: [] };
  return {
    scenes: [
      makeShaderScene({
        id: meta.id ?? id,
        group: meta.group ?? 'gl',
        name: `${meta.name ?? fallbackName} (GLSL)`,
        description: meta.description ?? `GLSL シェーダー ${meta.name ?? fallbackName}`,
        short: meta.short,
        maxBars: meta.maxBars,
        source: path,
        frag: `${common}\n${text}`,
      }),
    ],
    effects: [],
  };
}

/** Accept `default` / `scenes` / `effects` exports; Scene vs Effect is told apart by `render` vs `apply`. */
export function fromModule(mod: Record<string, unknown>, path: string, group?: string): Loaded {
  const out: Loaded = { scenes: [], effects: [] };
  const items = [mod.default, mod.scenes, mod.effects].flat().filter(Boolean) as (Scene | Effect)[];
  for (const it of items) {
    if (typeof (it as Scene).render === 'function') out.scenes.push({ ...(it as Scene), source: path, group: group ?? (it as Scene).group ?? 'user' });
    else if (typeof (it as Effect).apply === 'function') out.effects.push({ ...(it as Effect), source: path });
  }
  return out;
}

// -------------------------------------------------------------- bundled plugins
const shaderFiles = import.meta.glob<string>('./**/*.{fs,frag,glsl,isf}', { eager: true, query: '?raw', import: 'default' });
const moduleFiles = import.meta.glob<Record<string, unknown>>('./**/*.scene.ts', { eager: true });

/** Everything under src/plugins/, loaded at startup. A broken file is reported, not fatal. */
export function bundledPlugins(): Loaded & { failed: { path: string; error: string }[] } {
  const out = { scenes: [] as Scene[], effects: [] as Effect[], failed: [] as { path: string; error: string }[] };
  const add = (path: string, load: () => Loaded): void => {
    try {
      const l = load();
      out.scenes.push(...l.scenes);
      out.effects.push(...l.effects);
    } catch (e) {
      out.failed.push({ path, error: e instanceof Error ? e.message : String(e) });
    }
  };
  for (const [path, text] of Object.entries(shaderFiles)) add(path, () => fromShaderSource(text, path.replace(/^\.\//, 'plugins/')));
  for (const [path, mod] of Object.entries(moduleFiles)) add(path, () => fromModule(mod, path.replace(/^\.\//, 'plugins/')));
  return out;
}

// -------------------------------------------------------------- runtime files
/** Helpers exposed to runtime `.js` plugins (they cannot import bare 'three'). */
export function exposeGlobalApi(register: (l: Loaded) => void): void {
  (globalThis as unknown as { JEVJ: unknown }).JEVJ = { ...api, register: (x: Scene | Effect | (Scene | Effect)[]) => register(fromModule({ default: x }, 'runtime')) };
}

/** Load a dropped / picked file. Shader text is compiled; JS runs as an ES module. */
export async function fromFile(name: string, text: string): Promise<Loaded> {
  if (MODULE_EXT.test(name)) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    try {
      const mod = (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
      const l = fromModule(mod, name, 'user');
      for (const s of l.scenes) s.id = `user_${s.id}`;
      for (const f of l.effects) f.id = `user_${f.id}`;
      return l;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return fromShaderSource(text, name, { idPrefix: 'user_', group: 'user' });
}
