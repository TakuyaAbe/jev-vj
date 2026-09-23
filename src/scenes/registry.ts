import type { Effect, Scene, SceneId } from '../types';

/**
 * The live list of scenes and effects. Built-ins register at startup, bundled
 * plugins right after, and files dropped on the stage at runtime; listeners
 * (UI, director) refresh on every change.
 */
export const SCENES: Scene[] = [];
export const SCENE_BY_ID: Record<SceneId, Scene | undefined> = {};
export const EFFECTS: Effect[] = [];
const listeners = new Set<() => void>();

export function onRegistryChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const emit = (): void => listeners.forEach((cb) => cb());

function upsert<T extends { id: string }>(list: T[], item: T): T | null {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) {
    list.push(item);
    return null;
  }
  const old = list[i]!;
  list[i] = item;
  return old;
}

/** Add or replace (same id) scenes. Returns the replaced ones. */
export function registerScenes(scenes: Scene[], silent = false): Scene[] {
  const replaced: Scene[] = [];
  for (const sc of scenes) {
    const old = upsert(SCENES, sc);
    if (old) replaced.push(old);
    SCENE_BY_ID[sc.id] = sc;
  }
  sortScenes();
  if (!silent) emit();
  return replaced;
}

/** ids in the order the VJ arranged them (edit mode); empty = default order */
let preferredOrder: string[] = [];

/**
 * Default order: 年中行事 first by month, then registration order. A saved
 * arrangement wins; scenes it does not mention (new plugins) go after it.
 */
function sortScenes(): void {
  const reg = new Map(SCENES.map((sc, i) => [sc, i]));
  const pref = new Map(preferredOrder.map((id, i) => [id, i]));
  const rank = (sc: Scene): number => pref.get(sc.id) ?? preferredOrder.length;
  SCENES.sort((x, y) => rank(x) - rank(y) || (x.month ?? 99) - (y.month ?? 99) || reg.get(x)! - reg.get(y)!);
}

export function setSceneOrder(ids: string[]): void {
  preferredOrder = [...ids];
  sortScenes();
  emit();
}

export function registerEffects(effects: Effect[], silent = false): void {
  for (const fx of effects) upsert(EFFECTS, fx);
  if (!silent) emit();
}

export function unregister(id: string): void {
  const i = SCENES.findIndex((s) => s.id === id);
  if (i >= 0 && SCENES.length > 1) {
    SCENES.splice(i, 1);
    delete SCENE_BY_ID[id];
  }
  const j = EFFECTS.findIndex((f) => f.id === id);
  if (j >= 0) EFFECTS.splice(j, 1);
  emit();
}

/** Look a scene up by id; unknown ids fall back to the first registered scene. */
export function sceneById(id: SceneId): Scene {
  return SCENE_BY_ID[id] ?? SCENES[0]!;
}

/** Scenes that compiled (or were never checked). */
export const usableScenes = (list: Scene[] = SCENES): Scene[] => list.filter((s) => !s.error);

/**
 * Compile every GL scene / effect in idle time so the first cut to a shader
 * does not stall the frame, and so broken plugins are flagged before Jev picks them.
 */
export function prewarm(onDone?: (failed: { id: string; error: string }[]) => void): void {
  const queue: (Scene | Effect)[] = [...SCENES, ...EFFECTS].filter((x) => x.prepare);
  const failed: { id: string; error: string }[] = [];
  const idle = (cb: () => void): void => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(cb, { timeout: 500 });
    else setTimeout(cb, 16);
  };
  const step = (): void => {
    const next = queue.shift();
    if (!next) {
      if (failed.length) emit();
      onDone?.(failed);
      return;
    }
    const err = next.prepare!();
    if (err) failed.push({ id: next.id, error: err });
    idle(step);
  };
  idle(step);
}
