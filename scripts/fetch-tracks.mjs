#!/usr/bin/env node
/**
 * Download the bundled CC tracks listed in public/tracks/index.json (field `source`)
 * into public/tracks/ when they are missing. The mp3s are not committed (90 MB,
 * CC BY-NC-ND redistribution) — CI and fresh clones fetch them from the original
 * netlabel releases on archive.org before `vite build`.
 */
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public', 'tracks');
const index = JSON.parse(await readFile(join(DIR, 'index.json'), 'utf8'));
mkdirSync(DIR, { recursive: true });

let failed = 0;
for (const t of index) {
  const dest = join(DIR, t.file);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log(`ok       ${t.file}`);
    continue;
  }
  if (!t.source) {
    console.warn(`skip     ${t.file} (no source url)`);
    continue;
  }
  process.stdout.write(`fetch    ${t.file} … `);
  try {
    const res = await fetch(t.source, { redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
    console.log(`${(statSync(dest).size / 1e6).toFixed(1)} MB`);
  } catch (e) {
    failed++;
    if (existsSync(dest)) unlinkSync(dest);
    console.log(`FAILED (${e instanceof Error ? e.message : e})`);
  }
}
if (failed) {
  console.error(`${failed} track(s) could not be fetched; the build will ship without them.`);
  process.exitCode = process.env.STRICT_TRACKS ? 1 : 0;
}
