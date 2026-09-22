/**
 * Load any Google Fonts family at runtime for canvas text. Three stylesheet
 * links are injected (regular, 700, 900) because the css2 API rejects a
 * request that names a weight the family does not have; a missing weight
 * just fails its own link. `document.fonts.load` with the actual text pulls
 * the unicode-range subsets Japanese families are split into.
 */
const injected = new Set<string>();

export const JP_PRESETS = [
  'Noto Sans JP',
  'Zen Kaku Gothic New',
  'Dela Gothic One',
  'DotGothic16',
  'Reggae One',
  'RocknRoll One',
  'Shippori Mincho B1',
  'Yuji Syuku',
  'Kaisei Decol',
  'Hachi Maru Pop',
  'Train One',
  'Rampart One',
];
export const EN_PRESETS = [
  'Bebas Neue',
  'Anton',
  'Unbounded',
  'Orbitron',
  'Space Grotesk',
  'Inter',
  'Michroma',
  'Major Mono Display',
  'Press Start 2P',
  'Rubik Mono One',
  'Syncopate',
  'Monoton',
];
export const MONO_PRESETS = ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'Space Mono', 'DotGothic16', 'VT323', 'Share Tech Mono', 'Kosugi'];

function inject(family: string, weight: number | null): void {
  const key = `${family}|${weight ?? 'r'}`;
  if (injected.has(key)) return;
  injected.add(key);
  const fam = family.trim().replace(/\s+/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fam}${weight ? `:wght@${weight}` : ''}&display=swap`;
  link.dataset.googleFont = key;
  document.head.append(link);
}

export interface FontLoadResult {
  family: string;
  ok: boolean;
  faces: number;
  /** the heaviest weight that actually arrived */
  weight: number;
}

/** Inject and wait; `sample` should be the text that will be drawn. */
export async function loadGoogleFont(family: string, sample: string): Promise<FontLoadResult> {
  const fam = family.trim();
  if (!fam) return { family: fam, ok: false, faces: 0, weight: 400 };
  inject(fam, null);
  inject(fam, 700);
  inject(fam, 900);
  // give the stylesheets a moment to arrive, then ask for the faces
  await new Promise((r) => setTimeout(r, 250));
  const probe = async (): Promise<{ faces: number; weight: number }> => {
    const seen = new Set<FontFace>();
    let weight = 0;
    for (const w of [400, 700, 900]) {
      try {
        // the browser answers with the nearest face, so read the real weight off the FontFace
        for (const face of await document.fonts.load(`${w} 40px "${fam}"`, sample)) {
          seen.add(face);
          const m = face.weight.match(/\d+/g);
          if (m) weight = Math.max(weight, ...m.map(Number));
        }
      } catch {
        /* this weight does not exist */
      }
    }
    return { faces: seen.size, weight };
  };
  let r = await probe();
  if (r.faces === 0) {
    await new Promise((res) => setTimeout(res, 900)); // late stylesheet: retry once
    r = await probe();
  }
  return { family: fam, ok: r.faces > 0, faces: r.faces, weight: r.weight || 400 };
}

/** Load many families at once (for the random shuffle); returns the ones that arrived. */
export async function preloadFonts(families: string[], sample: string, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const ok: string[] = [];
  let done = 0;
  await Promise.all(
    families.map(async (f) => {
      const r = await loadGoogleFont(f, sample);
      if (r.ok) ok.push(r.family);
      done++;
      onProgress?.(done, families.length);
    }),
  );
  return ok;
}
