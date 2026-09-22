#!/usr/bin/env node
/**
 * Self-hosts the Japanese UI font used by the Remotion composition.
 *
 * Why: @remotion/google-fonts serves Noto Sans JP as ~100 unicode-range chunks that Chrome fetches
 * lazily per glyph. With render concurrency a tab can capture a frame before the chunk holding
 * 「」：… has arrived, those glyphs fall back to another face and the auto-width subtitle box
 * trembles from frame to frame. One local variable TTF (all glyphs, one request, gated by
 * document.fonts.load in remotion/FontGate.tsx) removes the race entirely.
 *
 *   public/fonts/NotoSansJP.ttf   <- https://github.com/google/fonts (OFL), skipped when present
 *
 * Run once (needs network):  node fonts.mjs
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const FONT_DIR = join(ROOT, 'public', 'fonts')
const FONT_FILE = join(FONT_DIR, 'NotoSansJP.ttf')
const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf'
/** The variable TTF is ~9 MB; anything smaller is an HTML error page or a truncated download. */
const MIN_BYTES = 1_000_000

if (existsSync(FONT_FILE) && statSync(FONT_FILE).size >= MIN_BYTES) {
  console.log(`ok  ${FONT_FILE} already present (${(statSync(FONT_FILE).size / 1e6).toFixed(1)} MB)`)
  process.exit(0)
}

console.log(`get ${FONT_URL}`)
const res = await fetch(FONT_URL, { redirect: 'follow' })
if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${res.statusText}`)
const bytes = new Uint8Array(await res.arrayBuffer())
if (bytes.length < MIN_BYTES) throw new Error(`download too small (${bytes.length} bytes) — not a TTF`)
// 0x00010000 = TrueType sfnt header; a Google-served TTF always starts with it.
if (!(bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) {
  throw new Error('downloaded file does not start with a TrueType header')
}
mkdirSync(FONT_DIR, { recursive: true })
writeFileSync(FONT_FILE, bytes)
console.log(`ok  ${FONT_FILE} (${(bytes.length / 1e6).toFixed(1)} MB)`)
