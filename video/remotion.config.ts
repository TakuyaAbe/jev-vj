import {Config} from '@remotion/cli/config';
import fs from 'node:fs';
import path from 'node:path';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setEntryPoint('remotion/index.ts');

// Evaluated by the Remotion CLI before bundling: keep public/script.json (what
// the composition fetches with staticFile() in calculateMetadata) in sync with
// video/script.json, the source of truth for narration / capture / overlays.
const root = process.cwd();
const src = path.join(root, 'script.json');
const dest = path.join(root, 'public', 'script.json');
try {
  const next = fs.readFileSync(src);
  if (!fs.existsSync(dest) || !next.equals(fs.readFileSync(dest))) {
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.writeFileSync(dest, next);
  }
} catch (err) {
  console.warn('[remotion.config] could not mirror script.json:', err);
}
