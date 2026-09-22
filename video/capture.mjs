#!/usr/bin/env node
/**
 * Films the Jev VJ app for the how-to video with Playwright — one continuous session for every
 * capture chapter in script.json — and produces the footage the Remotion composition edits:
 *
 *   public/captures/app.mp4        1920x920, 30 fps, no audio (the caption band lives below it)
 *   public/captures/<stepId>.png   one still per step (taken at the step's midpoint) for eyeballing
 *   public/audio/demo-track.wav    the app's own 128 BPM demo track, read back from the page's
 *                                  AudioBuffer so the video can use it as the music bed, in sync
 *   public/timeline.json           { video, totalMs, demo:{file,startMs}, chapters:[{id,startMs,endMs,
 *                                    steps:[{id,startMs,endMs,clicks,keys,notes}]}] }
 *
 * Every timestamp is milliseconds from the first frame of app.mp4 (t0 is taken right before the CDP
 * screencast starts). Frames come from the screencast (a JPEG per compositor frame with its swap
 * time; encodeFrames re-times them onto a 30 fps grid) because Playwright's recordVideo is VP8 at
 * ~1 Mbps. Chromium runs headless on the real GPU through ANGLE/Metal — SwiftShader managed ~1.5 fps
 * with the three.js / GLSL scenes.
 *
 * Capture-only tweaks (nothing in the app source changes):
 *   - the viewport is 1920x920 so the caption band never covers the CLI log / prompt line
 *   - `#panel { zoom: 1.5 }` so the 12 px side panel reads at 1080p
 *   - /api/spotify is stubbed (no "osascript failed" hint in the panel)
 *
 * Per step, script.json actions run on a schedule (seconds from the step start; negative = from
 * the step end):  click / key / type / select / check / hover / scrollTo / eval.  `notes` resolve
 * their target's box against the live page and track it (or carry a fixed `box` in stage px).
 *
 * Timing contract (shared with narration.mjs / the composition):
 *   step duration = max(step.minSeconds, narrationDuration[id] + 1.0 s)
 *
 * Run:  node capture.mjs        (needs the dev server: cd .. && npm run dev  → http://127.0.0.1:5183)
 *       CAPTURE_BASE_URL=https://jevj.sayuno.me node capture.mjs   films another build
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(ROOT, 'public')
const CAPTURES = join(PUBLIC, 'captures')
/** Screencast frames while filming (outside public/, which Remotion copies on every bundle). */
const RAW = join(ROOT, '.capture-frames')
const TIMELINE = join(PUBLIC, 'timeline.json')
const DEMO_WAV = join(PUBLIC, 'audio', 'demo-track.wav')
const FFMPEG = '/opt/homebrew/bin/ffmpeg'

const script = JSON.parse(readFileSync(join(ROOT, 'script.json'), 'utf8'))
const durations = JSON.parse(readFileSync(join(PUBLIC, 'narration', 'durations.json'), 'utf8'))

const BASE = process.env.CAPTURE_BASE_URL || script.meta.baseUrl
const VIEWPORT = { width: script.meta.capture.width, height: script.meta.capture.height }
const PANEL_ZOOM = script.meta.capture.panelZoom
const FPS = script.meta.fps
const FRAME_QUALITY = 85
const CLICK_HOLD_MS = 120
const FIND_TIMEOUT = 10_000
const NOTE_TIMEOUT_MS = 6000
const TRACK_EVERY_MS = 200
/** Settle time after the page is up before the first step. */
const LEAD_IN_MS = 1200
/** Tail so the last step does not cut on the final frame. */
const TAIL_MS = 1500
/** The demo track is 129.5 s; it is looped in the page when the footage after the click is longer. */
const DEMO_SECONDS = 129.5
/** SCENES order in src/scenes/index.ts – the panel's scene grid and the number keys follow it. */
const SCENE_ORDER = ['particles', 'tunnel', 'grid', 'strobe', 'kaleido', 'waves', 'warp', 'lattice', 'julia', 'voronoi', 'galaxy', 'terrain', 'hina_mochi', 'seigaiha', 'hina_dan3d', 'hina_petals', 'hina_dan']
const LAUNCH_ARGS = [
  '--autoplay-policy=no-user-gesture-required',
  '--use-gl=angle',
  '--use-angle=metal',
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
]
const CAPTURE_CSS = `#panel { zoom: ${PANEL_ZOOM}; }`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stepSeconds = (step) => Math.max(step.minSeconds, (durations[step.id] ?? 0) + 1.0)

/* ------------------------------------------------------------------ pre-flight */

const chapters = script.chapters
const warnings = []
const warn = (msg) => {
  warnings.push(msg)
  console.error(`  ! ${msg}`)
}
for (const c of chapters) for (const s of c.steps) if (!durations[s.id]) warn(`no narration clip for "${s.id}" — using minSeconds`)

{
  // Does everything after the Demo track click fit into the demo track?
  let afterDemo = null
  for (const c of chapters) {
    for (const s of c.steps) {
      const dur = stepSeconds(s)
      if (afterDemo === null) {
        const click = (s.actions ?? []).find((a) => a.type === 'click' && a.target === 'button:Demo track')
        if (click) afterDemo = dur - click.at
      } else afterDemo += dur
    }
  }
  if (afterDemo !== null) {
    console.log(`footage after the Demo track click: ${afterDemo.toFixed(1)} s (demo track ${DEMO_SECONDS} s)`)
    if (afterDemo > DEMO_SECONDS - 1) console.log(`  (longer than the track: the demo loops after ${DEMO_SECONDS} s)`)
  }
}

mkdirSync(CAPTURES, { recursive: true })
mkdirSync(RAW, { recursive: true })
for (const f of readdirSync(RAW)) rmSync(join(RAW, f), { recursive: true, force: true })
for (const f of readdirSync(CAPTURES)) rmSync(join(CAPTURES, f), { force: true })

/* ------------------------------------------------------------------ targets */

/**
 * Resolve a script.json target to a Playwright locator inside the side panel:
 *   panel · stage · button:<text> · section:<h2 text> · scene:<id> · input:main|sub · select:pos|<row label>
 *   checkbox:<label text> · text:<text> · h2:<text>
 */
function resolveTarget(page, target) {
  const panel = page.locator('#panel')
  if (target === 'panel') return { locator: panel, label: 'パネル' }
  if (target === 'stage') return { locator: page.locator('#stage'), label: 'ステージ' }
  const i = target.indexOf(':')
  const kind = i < 0 ? target : target.slice(0, i)
  const arg = i < 0 ? '' : target.slice(i + 1)
  switch (kind) {
    case 'button':
      return { locator: panel.getByRole('button', { name: arg, exact: true }).first(), label: arg }
    case 'section':
      return { locator: panel.locator('section').filter({ has: page.locator('h2', { hasText: arg }) }).first(), label: arg }
    case 'h2':
      return { locator: panel.locator('h2', { hasText: arg }).first(), label: arg }
    case 'scene': {
      const idx = SCENE_ORDER.indexOf(arg)
      if (idx < 0) throw new Error(`unknown scene "${arg}"`)
      return { locator: panel.locator('.scene-item').nth(idx).locator('button'), label: arg }
    }
    case 'input':
      if (arg === 'main') return { locator: panel.locator('input[placeholder^="メイン"]'), label: 'メイン' }
      if (arg === 'sub') return { locator: panel.locator('input[placeholder^="サブ"]'), label: 'サブ' }
      throw new Error(`unknown input "${arg}"`)
    case 'select':
      if (arg === 'pos') return { locator: panel.locator('select:has(option[value="above"])'), label: 'サブの位置' }
      return { locator: panel.locator('.row').filter({ has: page.locator(`span.hint:text-is("${arg}")`) }).locator('select').first(), label: arg }
    case 'checkbox':
      return { locator: panel.locator('label', { hasText: arg }).locator('input[type=checkbox]').first(), label: arg }
    case 'text':
      return { locator: panel.getByText(arg).first(), label: arg }
    default:
      throw new Error(`unknown target "${target}"`)
  }
}

/* ------------------------------------------------------------------ recorder */

class ScreencastRecorder {
  constructor(page, dir) {
    this.page = page
    this.dir = dir
    this.frames = []
    this.pending = new Set()
  }

  async start() {
    mkdirSync(this.dir, { recursive: true })
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const ts = typeof metadata.timestamp === 'number' ? metadata.timestamp * 1000 : Date.now()
      const file = join(this.dir, `f${String(this.frames.length).padStart(6, '0')}.jpg`)
      this.frames.push({ ts, file })
      const write = writeFile(file, Buffer.from(data, 'base64')).finally(() => this.pending.delete(write))
      this.pending.add(write)
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    })
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: FRAME_QUALITY,
      maxWidth: VIEWPORT.width,
      maxHeight: VIEWPORT.height,
      everyNthFrame: 1,
    })
  }

  async stop() {
    await this.cdp.send('Page.stopScreencast').catch(() => {})
    await Promise.all(this.pending)
    await this.cdp.detach().catch(() => {})
  }
}

/** Re-time the frames onto a constant FPS grid from t0 and encode H.264 (concat demuxer). */
function encodeFrames(frames, t0, totalMs, dir, mp4) {
  if (!frames.length) throw new Error('screencast produced no frames')
  const total = Math.ceil((totalMs / 1000) * FPS)
  const runs = []
  let j = 0
  for (let i = 0; i < total; i++) {
    const t = t0 + (i * 1000) / FPS
    while (j + 1 < frames.length && frames[j + 1].ts <= t) j++
    const last = runs[runs.length - 1]
    if (last && last.j === j) last.n++
    else runs.push({ j, n: 1 })
  }
  const lines = ['ffconcat version 1.0']
  for (const r of runs) lines.push(`file '${frames[r.j].file}'`, `duration ${(r.n / FPS).toFixed(6)}`)
  lines.push(`file '${frames[runs[runs.length - 1].j].file}'`)
  const list = join(dir, 'frames.ffconcat')
  writeFileSync(list, `${lines.join('\n')}\n`)
  execFileSync(FFMPEG, [
    '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `fps=${FPS},format=yuv420p`, '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    // 1 s GOP: Remotion renders in parallel chunks and seeks a lot.
    '-g', String(FPS), '-movflags', '+faststart', '-an', mp4,
  ], { stdio: 'inherit' })
  const spanS = (frames[frames.length - 1].ts - frames[0].ts) / 1000
  return { frames: frames.length, unique: runs.length, avgFps: frames.length / Math.max(1, spanS) }
}

/* ------------------------------------------------------------------ demo track export */

/** Read the demo AudioBuffer back from the page (mono) and write it as 16-bit PCM WAV. */
async function exportDemoTrack(page, file) {
  const meta = await page.evaluate(() => {
    const a = window.vj?.audio
    const b = a?.buffer
    if (!b || a.kind !== 'demo') return null
    return { sampleRate: b.sampleRate, length: b.length, channels: b.numberOfChannels }
  })
  if (!meta) return null
  const CHUNK = 1_500_000
  const parts = []
  for (let offset = 0; offset < meta.length; offset += CHUNK) {
    const b64 = await page.evaluate(([o, n]) => {
      const d = window.vj.audio.buffer.getChannelData(0).subarray(o, o + n)
      const i16 = new Int16Array(d.length)
      for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)))
      const u8 = new Uint8Array(i16.buffer)
      let s = ''
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
      return btoa(s)
    }, [offset, Math.min(CHUNK, meta.length - offset)])
    parts.push(Buffer.from(b64, 'base64'))
  }
  const data = Buffer.concat(parts)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22)
  head.writeUInt32LE(meta.sampleRate, 24); head.writeUInt32LE(meta.sampleRate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.concat([head, data]))
  return { seconds: meta.length / meta.sampleRate, sampleRate: meta.sampleRate }
}

/* ------------------------------------------------------------------ capture */

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS })
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' })
await context.addInitScript((css) => {
  const apply = () => {
    if (document.getElementById('capture-css')) return
    const style = document.createElement('style')
    style.id = 'capture-css'
    style.textContent = css
    ;(document.head ?? document.documentElement).appendChild(style)
  }
  if (document.documentElement) apply()
  document.addEventListener('DOMContentLoaded', apply)
}, CAPTURE_CSS)
const page = await context.newPage()
await page.route('**/api/spotify', (route) => route.fulfill({ json: { running: false } }))
page.on('pageerror', (e) => warn(`page error: ${e.message.split('\n')[0]}`))

const recorder = new ScreencastRecorder(page, join(RAW, 'app'))
// Frame 0 of app.mp4 is this instant; the screencast starts right after.
const t0 = Date.now()
await recorder.start()
const elapsed = () => Date.now() - t0
const waitUntil = async (ms) => {
  const left = ms - elapsed()
  if (left > 0) await sleep(left)
}

console.log(`opening ${BASE}`)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: 'Demo track', exact: true }).waitFor({ state: 'visible', timeout: FIND_TIMEOUT })
await waitUntil(LEAD_IN_MS)

let demo = null
const timelineChapters = []

async function clickLocator(locator, label, clicks) {
  await locator.waitFor({ state: 'visible', timeout: FIND_TIMEOUT })
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`no bounding box for "${label}"`)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy, { steps: 12 })
  const atMs = elapsed()
  await page.mouse.down()
  await sleep(CLICK_HOLD_MS)
  await page.mouse.up()
  clicks.push({ atMs, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), label })
  console.log(`    ${String(atMs).padStart(6)}ms  click ${label}  @${Math.round(cx)},${Math.round(cy)}`)
  return { box, atMs }
}

/** After typing / selecting, drop focus so the app's key handlers (h / l / digits) work again. */
const blur = (locator) => locator.evaluate((el) => el.blur()).catch(() => {})

async function noteDemoStart() {
  // The click is the user gesture; playDemo synthesises the track (a few hundred ms) and then starts it.
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const r = await page.evaluate(() => {
      const a = window.vj?.audio
      if (!a?.playing || a.kind !== 'demo') return null
      const pos = a.position()
      return pos > 0.15 ? { now: Date.now(), pos } : null
    })
    if (r) {
      const startMs = Math.round(r.now - r.pos * 1000 - t0)
      // Loop the buffer so the footage may outlast the 129.5 s track; the composition loops the exported
      // wav from the same start, so the bed stays in sync with what the stage reacted to.
      await page.evaluate(() => {
        const a = window.vj.audio
        if (a.bufferSource) a.bufferSource.loop = true
      })
      demo = { file: 'audio/demo-track.wav', startMs, loop: true }
      console.log(`    demo track started at ${startMs}ms (video clock), looping`)
      return
    }
    await sleep(60)
  }
  warn('demo track did not start within 8 s after the click')
}

async function runAction(a, step, clicks, keys, durMs) {
  switch (a.type) {
    case 'click': {
      const { locator, label } = resolveTarget(page, a.target)
      await clickLocator(locator, label, clicks)
      if (a.target === 'button:Demo track') await noteDemoStart()
      return
    }
    case 'key': {
      const atMs = elapsed()
      await page.keyboard.press(a.key)
      keys.push({ atMs, key: a.key })
      console.log(`    ${String(atMs).padStart(6)}ms  key ${a.key}`)
      return
    }
    case 'type': {
      const { locator, label } = resolveTarget(page, a.target)
      await clickLocator(locator, label, clicks)
      await page.keyboard.press('End')
      await locator.pressSequentially(a.text, { delay: a.delay ?? 70 })
      await blur(locator)
      console.log(`    ${String(elapsed()).padStart(6)}ms  typed "${a.text}" into ${label}`)
      return
    }
    case 'select': {
      const { locator, label } = resolveTarget(page, a.target)
      const { atMs } = await clickLocator(locator, `${label}: ${a.value}`, clicks)
      await locator.selectOption({ label: a.value })
      await blur(locator)
      console.log(`    ${String(atMs).padStart(6)}ms  select ${label} → ${a.value}`)
      return
    }
    case 'check': {
      const { locator, label } = resolveTarget(page, a.target)
      // Click the label text (the checkbox itself is 13 px); the ring is drawn on the label box.
      const labelEl = locator.locator('xpath=ancestor::label[1]')
      await clickLocator(labelEl, label, clicks)
      await blur(locator)
      return
    }
    case 'hover': {
      const { locator } = resolveTarget(page, a.target)
      const box = await locator.boundingBox()
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
      return
    }
    case 'scrollTo': {
      const { locator, label } = resolveTarget(page, a.target)
      await locator.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }))
      console.log(`    ${String(elapsed()).padStart(6)}ms  scrollTo ${label}`)
      return
    }
    case 'eval': {
      await page.evaluate(`(() => { ${a.js} })()`)
      console.log(`    ${String(elapsed()).padStart(6)}ms  eval ${a.js.slice(0, 60)}`)
      return
    }
    default:
      throw new Error(`unknown action type "${a.type}" in ${step.id}`)
  }
}

/** Annotation: static stage box, or a DOM target sampled until `untilMs` (the panel scrolls). */
async function trackNote(note, startMs, durMs, notes) {
  const atOffset = Math.round(note.at * 1000)
  const untilMs = startMs + Math.round(Math.min(note.until ?? note.at + 4, durMs / 1000) * 1000)
  const kind = note.kind ?? 'box'
  const side = note.side ?? 'auto'
  if (note.box) {
    const [x, y, w, h] = note.box
    notes.push({ atMs: startMs + atOffset, untilMs, label: note.label, kind, side, track: [[startMs + atOffset, x, y, w, h]] })
    return
  }
  const { locator } = resolveTarget(page, note.target)
  const deadline = Math.min(elapsed() + NOTE_TIMEOUT_MS, untilMs)
  while (!(await locator.isVisible().catch(() => false))) {
    if (elapsed() > deadline) throw new Error(`note "${note.label}": ${note.target} never became visible`)
    await sleep(100)
  }
  const atMs = elapsed()
  const track = []
  while (elapsed() <= untilMs) {
    const t = elapsed()
    const b = await locator.boundingBox().catch(() => null)
    if (!b) break
    track.push([t, Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])
    await sleep(TRACK_EVERY_MS)
  }
  if (!track.length) throw new Error(`note "${note.label}" had no box`)
  notes.push({ atMs, untilMs, label: note.label, kind, side, track })
  console.log(`    ${String(atMs).padStart(6)}ms  note ${note.target} → "${note.label}" (${track.length} samples)`)
}

for (const chapter of chapters) {
  const chapterStart = elapsed()
  console.log(`\n════ ${chapter.number} · ${chapter.title} (${chapter.id}) ════  ${chapterStart}ms`)
  const entry = { id: chapter.id, startMs: chapterStart, endMs: 0, steps: [] }

  for (const step of chapter.steps) {
    const durMs = Math.round(stepSeconds(step) * 1000)
    const startMs = elapsed()
    const clicks = []
    const keys = []
    const notes = []
    const background = []
    console.log(`\n${step.id}  start ${startMs}ms  dur ${(durMs / 1000).toFixed(2)}s  (narration ${(durations[step.id] ?? 0).toFixed(2)}s)`)

    const report = (what) => async (err) => {
      const shot = join(CAPTURES, `error-${step.id}.png`)
      await page.screenshot({ path: shot }).catch(() => {})
      warn(`${step.id}: ${what}${err.message.split('\n')[0]} → ${shot}`)
    }

    const atMsOf = (at) => Math.round((at < 0 ? durMs / 1000 + at : at) * 1000)
    const schedule = [
      ...(step.actions ?? []).map((a) => ({ at: atMsOf(a.at), order: 1, run: () => runAction(a, step, clicks, keys, durMs) })),
      ...(step.notes ?? []).map((n) => ({ at: atMsOf(n.at), order: 2, run: () => { background.push(trackNote(n, startMs, durMs, notes).catch(report(`note "${n.label}": `))) } })),
      { at: Math.round(durMs / 2), order: 0, run: () => { background.push(page.screenshot({ path: join(CAPTURES, `${step.id}.png`) }).catch(() => {})) } },
    ].sort((a, b) => a.at - b.at || a.order - b.order)

    for (const item of schedule) {
      await waitUntil(startMs + item.at)
      try {
        await item.run()
      } catch (err) {
        await report('')(err)
      }
    }
    await waitUntil(startMs + durMs)
    await Promise.all(background)
    notes.sort((a, b) => a.atMs - b.atMs)
    entry.steps.push({ id: step.id, startMs, endMs: elapsed(), clicks, keys, notes })
  }
  entry.endMs = elapsed()
  timelineChapters.push(entry)
}

await sleep(TAIL_MS)
const totalMs = elapsed()
await recorder.stop()

/* ---- demo track ---- */
let demoInfo = null
try {
  demoInfo = await exportDemoTrack(page, DEMO_WAV)
  if (demoInfo) console.log(`\ndemo track → ${DEMO_WAV} (${demoInfo.seconds.toFixed(1)}s @ ${demoInfo.sampleRate} Hz)`)
  else warn('demo track buffer not available — the composition will fall back to bgm.wav')
} catch (err) {
  warn(`demo track export failed: ${err.message.split('\n')[0]}`)
}
if (!demoInfo) demo = null

await context.close()
await browser.close()

/* ---- encode ---- */
const mp4 = join(CAPTURES, 'app.mp4')
const firstLagMs = recorder.frames.length ? Math.round(recorder.frames[0].ts - t0) : NaN
const stats = encodeFrames(recorder.frames, t0, totalMs, join(RAW, 'app'), mp4)
rmSync(join(RAW, 'app'), { recursive: true, force: true })
console.log(`\napp.mp4: ${(totalMs / 1000).toFixed(2)}s → ${mp4}  (${stats.frames} screencast frames, ~${stats.avgFps.toFixed(1)} fps, first frame +${firstLagMs}ms)`)
if (stats.avgFps < 20) warn(`screencast averaged ${stats.avgFps.toFixed(1)} fps — motion will look choppy`)

/* ---- timeline.json ---- */
const timeline = {
  version: 1,
  fps: FPS,
  width: VIEWPORT.width,
  height: VIEWPORT.height,
  video: 'captures/app.mp4',
  totalMs,
  demo,
  chapters: timelineChapters,
}
writeFileSync(TIMELINE, `${JSON.stringify(timeline, null, 2)}\n`)

/* ---- summary ---- */
for (const c of timelineChapters) {
  console.log(`\n─── ${c.id} ─── ${c.startMs} → ${c.endMs} ms`)
  for (const s of c.steps) {
    console.log(`${s.id.padEnd(10)} ${String(s.startMs).padStart(7)} → ${String(s.endMs).padStart(7)} ms  (${((s.endMs - s.startMs) / 1000).toFixed(2)}s)  clicks: ${s.clicks.map((k) => k.label).join(', ') || '—'}  keys: ${s.keys.map((k) => k.key).join(' ') || '—'}  notes: ${s.notes.length}`)
  }
}
console.log(`\ntimeline → ${TIMELINE}${demo ? `  (demo track from ${demo.startMs}ms)` : ''}`)
if (warnings.length) {
  console.log('\n─── warnings ───')
  for (const w of warnings) console.log(`! ${w}`)
} else {
  console.log('no warnings')
}
