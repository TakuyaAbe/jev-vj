#!/usr/bin/env node
/**
 * Synthesise the Japanese narration for every clip in script.json, then measure each one with ffprobe.
 *
 * Clips, in playback order:  title · overview · every chapter step (s_panel … l_fonts) · keys · outro
 *
 * Engines (TTS_ENGINE env, default "edge"):
 *   edge — Microsoft neural voices via the `edge-tts` CLI (no API key; needs network). Looked up in
 *          ./.venv/bin, then in the sibling aeon360-demo/video/.venv (EDGE_TTS=/path overrides).
 *          TTS_VOICE defaults to ja-JP-NanamiNeural; ja-JP-KeitaNeural is the male option. TTS_RATE (script.meta.rate, +12%).
 *   say  — macOS built-in Kyoko (offline fallback; also used per clip when edge-tts fails).
 *
 * Output: public/narration/<id>.wav + public/narration/durations.json ({ id: seconds }).
 * Only clips whose text/voice changed (texts.json) or whose wav is missing are synthesised again;
 * FORCE=1 re-synthesises everything. durations.json is the timing contract shared with capture.mjs
 * and the composition: step length = max(minSeconds, narration + 1 s).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(ROOT, 'public', 'narration')
const FFPROBE = '/opt/homebrew/bin/ffprobe'
const FFMPEG = '/opt/homebrew/bin/ffmpeg'

const script = JSON.parse(readFileSync(join(ROOT, 'script.json'), 'utf8'))

const EDGE_CANDIDATES = [
  process.env.EDGE_TTS,
  join(ROOT, '.venv', 'bin', 'edge-tts'),
  join(ROOT, '..', '..', 'aeon360-demo', 'video', '.venv', 'bin', 'edge-tts'),
].filter(Boolean)
const EDGE_TTS = EDGE_CANDIDATES.find((p) => existsSync(p))
let ENGINE = process.env.TTS_ENGINE || 'edge'
if (ENGINE === 'edge' && !EDGE_TTS) {
  console.warn('! edge-tts not found (python3 -m venv .venv && .venv/bin/pip install edge-tts) — falling back to macOS `say -v Kyoko`')
  ENGINE = 'say'
}
const EDGE_VOICE = process.env.TTS_VOICE || 'ja-JP-NanamiNeural'
const EDGE_RATE = process.env.TTS_RATE || script.meta.rate || '+12%'
const SAY_VOICE = 'Kyoko'
const SAY_RATE = '185'

/** [id, japanese narration] in the order they appear in the finished video. */
const clips = [
  ['title', script.cards.title.narration],
  ['overview', script.cards.overview.narration],
  ...script.chapters.flatMap((c) => c.steps.map((s) => [s.id, s.narration])),
  ['keys', script.cards.keys.narration],
  ['outro', script.cards.outro.narration],
]

mkdirSync(OUT_DIR, { recursive: true })

/* --- drop anything left over from an older script --- */
const wanted = new Set(clips.map(([id]) => id))
for (const f of readdirSync(OUT_DIR)) {
  const m = /^(.+)\.(wav|mp3)$/.exec(f)
  if (m && !wanted.has(m[1])) {
    rmSync(join(OUT_DIR, f))
    console.log(`removed stale ${f}`)
  }
}

function probeDuration(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  const seconds = Number.parseFloat(out.trim())
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe could not read a duration from ${file}`)
  return Math.round(seconds * 1000) / 1000
}

const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return {}
  }
}

function synthEdge(text, file) {
  const mp3 = file.replace(/\.wav$/, '.mp3')
  execFileSync(EDGE_TTS, ['--voice', EDGE_VOICE, `--rate=${EDGE_RATE}`, '--text', text, '--write-media', mp3], { stdio: ['ignore', 'ignore', 'pipe'] })
  // 16-bit PCM 44.1 kHz mono with 150 ms of silence padding on both ends so clips never clip.
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', mp3, '-af', 'adelay=150|150,apad=pad_dur=0.15', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', file], { stdio: 'inherit' })
  rmSync(mp3, { force: true })
}

function synthSay(text, file) {
  execFileSync('say', ['-v', SAY_VOICE, '-r', SAY_RATE, '-o', file, '--data-format=LEI16@44100', text], { stdio: 'inherit' })
}

const TEXTS = join(OUT_DIR, 'texts.json')
const previousTexts = readJson(TEXTS)
const previousDurations = readJson(join(OUT_DIR, 'durations.json'))
const voiceKey = (engine) => (engine === 'edge' ? `edge|${EDGE_VOICE}|${EDGE_RATE}` : `say|${SAY_VOICE}|${SAY_RATE}`)

const durations = {}
const texts = {}
let synthesised = 0
let fellBack = 0
for (const [id, text] of clips) {
  if (!text) throw new Error(`script.json has no narration for "${id}"`)
  const file = join(OUT_DIR, `${id}.wav`)
  const key = `${voiceKey(ENGINE)}|${text}`
  const unchanged = previousTexts[id] === undefined || previousTexts[id] === key
  if (!process.env.FORCE && unchanged && existsSync(file) && previousDurations[id]) {
    texts[id] = previousTexts[id] ?? key
    durations[id] = probeDuration(file)
    continue
  }
  synthesised++
  let engine = ENGINE
  if (engine === 'edge') {
    try {
      synthEdge(text, file)
    } catch (err) {
      fellBack++
      engine = 'say'
      console.warn(`! edge-tts failed for "${id}" (${String(err.message).split('\n')[0].slice(0, 80)}) — using say -v Kyoko`)
      synthSay(text, file)
    }
  } else {
    synthSay(text, file)
  }
  texts[id] = `${voiceKey(engine)}|${text}`
  durations[id] = probeDuration(file)
  console.log(`${id.padEnd(12)} ${durations[id].toFixed(3)}s  [${engine}]  ${text.slice(0, 28)}…`)
}

writeFileSync(join(OUT_DIR, 'durations.json'), `${JSON.stringify(durations, null, 2)}\n`)
writeFileSync(TEXTS, `${JSON.stringify(texts, null, 2)}\n`)
const total = Object.values(durations).reduce((a, b) => a + b, 0)
console.log(`\n${clips.length} clips (${synthesised} synthesised${fellBack ? `, ${fellBack} via say fallback` : ''}) · ${total.toFixed(1)}s of speech → ${join(OUT_DIR, 'durations.json')}`)
