/**
 * Panel settings remembered across reloads (localStorage). Logo text, fonts,
 * FX modes and runtime plugins keep their own keys; everything else lives here.
 */
export interface Settings {
  sourceMode: 'demo' | 'file' | 'mic' | 'system' | 'url';
  /** item in the Demo list: -1 = synthesized demo, else a bundled track index */
  track: number;
  autoAdvance: boolean;
  muted: boolean;
  intervalBars: number;
  magiMode: 'always' | 'changes' | 'single';
  overlay: boolean;
  /** rows in the CLI log overlay */
  logRows: number;
  context: string;
  fontShuffle: { enabled: boolean; intervalSec: number; beatSync: boolean };
  /** scene ids Jev may pick; null = all */
  enabledScenes: string[] | null;
  /** scene list order from edit mode; empty = default */
  sceneOrder: string[];
}

const KEY = 'jev-vj.settings';

const DEFAULTS: Settings = {
  sourceMode: 'demo',
  track: -1,
  autoAdvance: true,
  muted: false,
  intervalBars: 2,
  magiMode: 'always',
  overlay: true,
  logRows: 10,
  context: '',
  fontShuffle: { enabled: true, intervalSec: 0.4, beatSync: true },
  enabledScenes: null,
  sceneOrder: [],
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw) as Partial<Settings>;
    return { ...structuredClone(DEFAULTS), ...saved, fontShuffle: { ...DEFAULTS.fontShuffle, ...saved.fontShuffle } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const settings: Settings = load();

export function saveSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings last until reload */
  }
}
