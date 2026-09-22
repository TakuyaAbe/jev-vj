import { AudioEngine, isLive } from './audio';
import { LogoOverlay } from './logo';
import { EN_PRESETS, JP_PRESETS, loadGoogleFont, preloadFonts } from './fonts';
import { TerminalOverlay } from './terminal';
import { BeatTracker } from './beat';
import { DEMO_BPM, demoSectionAt, renderDemoTrack } from './demo-track';
import { Director } from './director';
import { BarAggregator } from './features';
import { Renderer } from './render';
import { resetSceneState, SCENES } from './scenes';
import { Ui, type TrackInfo } from './ui';
import type { BeatInfo, RenderInput } from './types';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const agg = new BarAggregator();
const beat = new BeatTracker();
const director = new Director(agg);
const terminal = new TerminalOverlay();
const logo = new LogoOverlay();
const FONT_KEY = 'jev-vj.fonts';
function readFonts(): { jp: string; en: string; log: string } {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    if (raw) return { jp: '', en: '', log: '', ...(JSON.parse(raw) as Partial<{ jp: string; en: string; log: string }>) };
  } catch {
    /* storage unavailable */
  }
  return { jp: '', en: '', log: '' };
}
const fonts = readFonts();
const LOGO_KEY = 'jev-vj.logo';
function readLogo(): { main: string; sub: string; subAbove: boolean } {
  const def = { main: '🍲闇鍋🍲', sub: 'BAKUROCHO DOMINO CLUB PRESENTS', subAbove: true };
  try {
    const raw = localStorage.getItem(LOGO_KEY);
    if (raw) return { ...def, ...(JSON.parse(raw) as Partial<typeof def>) };
  } catch {
    /* storage unavailable */
  }
  return def;
}
{
  const l = readLogo();
  logo.jp = l.main;
  logo.en = l.sub;
  logo.subAbove = l.subAbove;
}
function saveFonts(): void {
  try {
    localStorage.setItem(FONT_KEY, JSON.stringify(fonts));
  } catch {
    /* ignore */
  }
}
let audio: AudioEngine | null = null;
let userText = '';
let nowPlaying = '';
let lastInput: RenderInput = {
  w: 1, h: 1, t: 0, dt: 0, energy: 0, sub: 0, bass: 0, mid: 0, high: 0, beatPhase: 0, beatPulse: 0, barPhase: 0, onset: false,
  intensity: 0, palette: { bg: '#000', a: '#fff', b: '#888', c: '#444' }, wave: new Float32Array(2048),
};
let demoBuffer: AudioBuffer | null = null;
let lastFrameT = performance.now();
let lastBeat: BeatInfo = { bpm: 0, confidence: 0, beatPhase: 0, barPhase: 0, beatInBar: 0, bar: 0, beatPulse: 0, locked: false };
let elapsedStart = 0;
let tracks: TrackInfo[] = [];
let currentTrack = -1;
let autoAdvance = true;
/** set as soon as the user starts a source; a pending auto-resume then stands down */
let userStarted = false;
const logInfo = (text: string): void => director.onLog?.({ t: performance.now(), kind: 'info', text });

function ensureAudio(): AudioEngine {
  if (audio) return audio;
  audio = new AudioEngine();
  audio.onFrame = (f) => {
    beatAcc.sum += f.rms;
    beatAcc.n++;
    beat.push(f);
    const info = beat.info(f.t);
    agg.push(f, info.bar);
    const jump = agg.detectJump();
    if (jump) director.onJump(jump, info.bar, elapsed());
  };
  audio.onEnded = () => {
    ui.setStatus('ended', null);
    if (autoAdvance && currentTrack >= 0 && tracks.length > 1) {
      const next = (currentTrack + 1) % tracks.length;
      ui.selectTrack(next);
      void playTrack(next);
    }
  };
  return audio;
}

function elapsed(): number {
  return audio ? audio.ctx.currentTime - elapsedStart : 0;
}

function resetAll(): void {
  beat.reset();
  agg.reset();
  director.reset();
  resetSceneState();
  elapsedStart = audio?.ctx.currentTime ?? 0;
}

const bars5 = (v: number): string => '▮'.repeat(Math.max(0, Math.min(5, Math.round(v * 5)))) + '▯'.repeat(5 - Math.max(0, Math.min(5, Math.round(v * 5))));
const SPARK = '▁▂▃▄▅▆▇█';
const spark = (v: number): string => SPARK[Math.max(0, Math.min(7, Math.round(v * 7)))]!;

// per-beat energy for the live bar line: accumulated from frames, cut on each beat
const beatAcc = { sum: 0, n: 0 };
let barLevels: number[] = [];
function liveBarText(bar: number): string {
  const dots = '●'.repeat(Math.min(4, barLevels.length)) + '○'.repeat(Math.max(0, 4 - barLevels.length));
  const sp = barLevels.map(spark).join('') + '_'.repeat(Math.max(0, 4 - barLevels.length));
  const f = audio?.latest;
  return `bar ${bar.toString().padStart(3, ' ')}  ${dots}  ${sp}  e${(f?.rms ?? 0).toFixed(2)} sub${(f?.sub ?? 0).toFixed(2)}`;
}

beat.onBeat = (info) => {
  // the level accumulated so far belongs to the beat that just ended
  barLevels.push(beatAcc.n ? beatAcc.sum / beatAcc.n : 0);
  if (barLevels.length > 4) barLevels = barLevels.slice(-4); // tracker re-anchoring can fire extra beats
  beatAcc.sum = 0;
  beatAcc.n = 0;
  if (info.beatInBar !== 0) terminal.live = liveBarText(info.bar);
  if (shuffle.enabled && shuffle.beatSync) shuffleNow();
};

beat.onBar = (info) => {
  director.setBpm(info.bpm);
  const b = agg.history[agg.history.length - 1];
  if (b) {
    const slope = agg.trend(4);
    const armed = director.state.armed ? `  armed→${director.state.armed.scene}` : '';
    const sp = barLevels.slice(-4).map(spark).join('').padEnd(4, '_');
    terminal.commitLive(
      `bar ${b.bar.toString().padStart(3, ' ')}  ●●●●  ${sp}  ${info.bpm.toFixed(1)}bpm  e${b.energy.toFixed(2)} sub${b.sub.toFixed(2)} bf${b.bassFloor.toFixed(2)} lm${b.lowmid.toFixed(2)} mid${b.mid.toFixed(2)} hi${b.high.toFixed(2)}  on${b.onsets.toString().padStart(2, ' ')}  trend ${slope >= 0 ? '+' : ''}${slope.toFixed(3)}${armed}`,
    );
  }
  barLevels = [];
  terminal.live = liveBarText(info.bar);
  director.onBar(info.bar, elapsed());
};

const ui = new Ui({
  async playDemo() {
    userStarted = true;
    const a = ensureAudio();
    ui.setStatus('generating demo track…', 'demo');
    await new Promise((r) => setTimeout(r, 30));
    demoBuffer ??= renderDemoTrack(a.ctx.sampleRate);
    resetAll();
    await a.playBuffer(demoBuffer, 'demo');
    currentTrack = -1;
    ui.setStatus(`demo track (${DEMO_BPM} bpm, ${Math.round(demoBuffer.duration)} s)`, 'demo');
    logInfo(`▶ demo track (${DEMO_BPM} bpm, ${Math.round(demoBuffer.duration)} s)`);
  },
  async playFile(file) {
    userStarted = true;
    currentTrack = -1;
    const a = ensureAudio();
    ui.setStatus(`decoding ${file.name}…`, 'file');
    resetAll();
    try {
      await a.playFile(file);
      ui.setStatus(`${file.name} (${Math.round(a.duration)} s)`, 'file');
      logInfo(`▶ ${file.name} (${Math.round(a.duration)} s)`);
    } catch (e) {
      ui.setStatus(`failed: ${e instanceof Error ? e.message : String(e)}`, null);
    }
  },
  async startMic(deviceId) {
    userStarted = true;
    currentTrack = -1;
    const a = ensureAudio();
    resetAll();
    try {
      await a.startMic(deviceId);
      ui.setStatus('mic / line-in (not monitored)', 'mic');
      ui.setInputDevices(await AudioEngine.inputDevices());
    } catch (e) {
      ui.setStatus(`mic failed: ${e instanceof Error ? e.message : String(e)}`, null);
    }
  },
  async startSystemAudio() {
    const a = ensureAudio();
    try {
      await a.startSystemAudio();
      resetAll();
      ui.setStatus('system audio via screen share (not monitored)', 'mic');
    } catch (e) {
      ui.setStatus(`system audio failed: ${e instanceof Error ? e.message : String(e)}`, null);
    }
  },
  setMagi(on) {
    director.state.magi = on;
  },
  setOverlay(on) {
    terminal.enabled = on;
  },
  logoNow() {
    if (director.state.logo.active) director.hideLogo(lastBeat.bar);
    else director.showLogo(lastBeat.bar, '手動', 'manual');
  },
  setLogoText(main, sub, subAbove) {
    logo.jp = main;
    logo.en = sub;
    logo.subAbove = subAbove;
    try {
      localStorage.setItem(LOGO_KEY, JSON.stringify({ main, sub, subAbove }));
    } catch {
      /* ignore */
    }
  },
  getLogoText() {
    return { main: logo.jp, sub: logo.en, subAbove: logo.subAbove };
  },
  selectScene(id) {
    director.manualSelect(id, lastBeat.bar);
  },
  setSceneEnabled(id, on) {
    const set = director.enabledScenes;
    if (set.size === 0) for (const sc of SCENES) set.add(sc.id); // materialize "all" before removing one
    if (on) set.add(id);
    else set.delete(id);
    if (set.size === SCENES.length) set.clear();
    ui.setEnabledScenes(set);
  },
  setScenePreset(kind) {
    const set = director.enabledScenes;
    set.clear();
    if (kind !== 'all') for (const sc of SCENES) if (sc.group === kind) set.add(sc.id);
    ui.setEnabledScenes(set);
    ui.log({ t: performance.now(), kind: 'info', text: `素材セット: ${kind === 'all' ? 'すべて' : kind === 'hina' ? 'ひな祭り' : kind.toUpperCase()}（${director.candidates().length} scenes）` });
  },
  async setFont(which, family) {
    fonts[which] = family;
    saveFonts();
    if (!family) {
      if (which === 'jp' && !shuffle.enabled) logo.jpFamily = '';
      else if (which === 'en' && !shuffle.enabled) logo.enFamily = '';
      else if (which === 'log') terminal.fontFamily = '';
      return 'system';
    }
    const sample = which === 'jp' ? logo.jp : which === 'en' ? logo.en : 'MAGI 審議 可決 否決 0123456789 abcdefghijklmnopqrstuvwxyz';
    const r = await loadGoogleFont(family, sample);
    if (!r.ok) return `not found: ${family}`;
    if (which === 'jp') {
      if (!shuffle.enabled) logo.jpFamily = r.family;
      logo.jpWeight = r.weight;
      if (!shuffle.jp.includes(r.family) && shuffle.jp.length) shuffle.jp.push(r.family);
    } else if (which === 'en') {
      if (!shuffle.enabled) logo.enFamily = r.family;
      logo.enWeight = r.weight;
      if (!shuffle.en.includes(r.family) && shuffle.en.length) shuffle.en.push(r.family);
    } else terminal.fontFamily = r.family;
    return `loaded (${r.faces} faces, wght ${r.weight})`;
  },
  getFonts() {
    return { ...fonts };
  },
  setFontShuffle(opts, onStatus) {
    void setFontShuffle(opts, onStatus);
  },
  stop() {
    audio?.stop();
    ui.setStatus('stopped', null);
  },
  toggleMute() {
    const a = ensureAudio();
    a.muted = !a.muted;
    return a.muted;
  },
  playTrack(index) {
    userStarted = true;
    void playTrack(index);
  },
  async seek(sec) {
    if (!audio?.playing) return;
    resetAll();
    await audio.seek(sec);
  },
  setAutoAdvance(on) {
    autoAdvance = on;
  },
  setInterval(bars) {
    director.state.intervalBars = bars;
  },
  setContext(text) {
    userText = text;
    updateContext();
  },
  askNow() {
    void director.decide('manual', lastBeat.bar, elapsed(), lastBeat.bpm);
  },
  togglePause() {
    director.state.paused = !director.state.paused;
    return director.state.paused;
  },
});

function updateContext(): void {
  director.userContext = [userText.trim(), nowPlaying].filter(Boolean).join('。');
}

director.onLog = (e) => {
  ui.log(e);
  terminal.push(e);
};
ui.setScenes(SCENES);
director.onDeliberation = (d) => ui.showDeliberation(d);
director.onLogo = (show) => (show ? logo.show(performance.now()) : logo.hide(performance.now()));
window.addEventListener('keydown', (e) => {
  // keys still work with a checkbox / button focused; only typing fields and selects swallow them
  const t = e.target;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
  if (t instanceof HTMLInputElement && ['text', 'number', 'search', 'url'].includes(t.type)) return;
  if (e.key === 'm') terminal.enabled = !terminal.enabled;
  if (/^[0-9]$/.test(e.key)) {
    const idx = e.key === '0' ? 9 : Number(e.key) - 1;
    const sc = SCENES[idx];
    if (sc) director.manualSelect(sc.id, lastBeat.bar);
  }
  if (e.key === 'l') {
    if (director.state.logo.active) director.hideLogo(lastBeat.bar);
    else director.showLogo(lastBeat.bar, '手動', 'manual');
  }
});

// random font switching for the logo lines (timer or beat-synced)
const shuffle = { enabled: false, intervalSec: 0.4, beatSync: false, lastAt: 0, jp: [] as string[], en: [] as string[], loading: false };
const pick = (pool: string[], current: string): string => {
  if (pool.length === 0) return current;
  if (pool.length === 1) return pool[0]!;
  let next = current;
  while (next === current) next = pool[Math.floor(Math.random() * pool.length)]!;
  return next;
};
function shuffleNow(now = performance.now()): void {
  if (!shuffle.enabled) return;
  shuffle.lastAt = now;
  logo.jpFamily = pick(shuffle.jp, logo.jpFamily);
  logo.enFamily = pick(shuffle.en, logo.enFamily);
}
function applyUserFonts(): void {
  logo.jpFamily = fonts.jp;
  logo.enFamily = fonts.en;
}
async function setFontShuffle(opts: { enabled: boolean; intervalSec: number; beatSync: boolean }, onStatus: (text: string) => void): Promise<void> {
  shuffle.intervalSec = opts.intervalSec;
  shuffle.beatSync = opts.beatSync;
  if (!opts.enabled) {
    shuffle.enabled = false;
    applyUserFonts();
    onStatus('');
    return;
  }
  if (shuffle.jp.length === 0 && !shuffle.loading) {
    shuffle.loading = true;
    const jpPool = [...new Set([...JP_PRESETS, fonts.jp].filter(Boolean))];
    const enPool = [...new Set([...EN_PRESETS, fonts.en].filter(Boolean))];
    let done = 0;
    const total = jpPool.length + enPool.length;
    const progress = (): void => onStatus(`fonts ${++done}/${total}…`);
    [shuffle.jp, shuffle.en] = await Promise.all([
      preloadFonts(jpPool, logo.jp, progress),
      preloadFonts(enPool, logo.en, progress),
    ]);
    shuffle.loading = false;
  }
  shuffle.enabled = true;
  onStatus(`${shuffle.jp.length} + ${shuffle.en.length} fonts`);
  shuffleNow(); // the interval itself is driven from the frame loop (timers can be throttled)
}

// what the local Spotify app is playing (dev server reads it with AppleScript)
interface SpotifyInfo {
  running: boolean;
  /** the deployed Worker has no AppleScript; stop polling */
  unavailable?: boolean;
  state?: string;
  name?: string;
  artist?: string;
  album?: string;
  position?: number;
  duration?: number;
  error?: string;
}
let spotifyTimer = 0;
async function pollSpotify(): Promise<void> {
  try {
    const res = await fetch('/api/spotify');
    if (res.status === 404) {
      window.clearInterval(spotifyTimer);
      return;
    }
    const info = (await res.json()) as SpotifyInfo;
    if (info.unavailable) {
      window.clearInterval(spotifyTimer);
      ui.setNowPlaying('');
      return;
    }
    if (info.running && info.name) {
      const f = (x: number): string => `${Math.floor(x / 60)}:${Math.floor(x % 60).toString().padStart(2, '0')}`;
      ui.setNowPlaying(`Spotify ${info.state}: ${info.artist} – ${info.name}  ${f(info.position ?? 0)} / ${f(info.duration ?? 0)}`);
      const np = info.state === 'playing' ? `Spotify で再生中: ${info.artist}「${info.name}」（${info.album}）` : '';
      if (np !== nowPlaying) {
        nowPlaying = np;
        updateContext();
      }
    } else {
      ui.setNowPlaying(info.error ? `Spotify: ${info.error}` : '');
      if (nowPlaying) {
        nowPlaying = '';
        updateContext();
      }
    }
  } catch {
    /* dev server not reachable */
  }
}
void pollSpotify();
spotifyTimer = window.setInterval(() => void pollSpotify(), 2000);
// input devices are listed after the first Mic / line-in grant (enumerating earlier triggers a permission notice)

// decoded buffers are cached so restarts, seeks and the next track start without a fetch/decode gap
const bufferCache = new Map<string, Promise<AudioBuffer>>();
function getBuffer(url: string): Promise<AudioBuffer> {
  let p = bufferCache.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ensureAudio().ctx.decodeAudioData(await res.arrayBuffer());
    })();
    p.catch(() => bufferCache.delete(url));
    bufferCache.set(url, p);
  }
  return p;
}

function prefetchNext(): void {
  if (currentTrack < 0 || tracks.length < 2) return;
  const next = tracks[(currentTrack + 1) % tracks.length];
  if (next) void getBuffer(`/tracks/${next.file}`).catch(() => undefined);
}

async function playUrl(url: string, label: string, offset = 0): Promise<void> {
  const a = ensureAudio();
  if (!bufferCache.has(url)) ui.setStatus(`fetching ${label}…`, 'file');
  try {
    const buf = await getBuffer(url);
    resetAll();
    await a.playBuffer(buf, 'file', offset);
    ui.setStatus(`${label} (${Math.round(buf.duration)} s)`, 'file');
    logInfo(`▶ ${label}${offset > 0 ? ` @ ${Math.round(offset)}s` : ''} (${Math.round(buf.duration)} s)`);
    prefetchNext();
  } catch (e) {
    ui.setStatus(`failed: ${e instanceof Error ? e.message : String(e)}`, null);
  }
}

// keep playback across page reloads (Vite HMR reloads, accidental refresh)
const PLAYBACK_KEY = 'jev-vj.playback';
interface SavedPlayback {
  track: number;
  pos: number;
  at: number;
}
function savePlayback(): void {
  try {
    if (audio?.playing && audio.kind === 'file' && currentTrack >= 0) {
      sessionStorage.setItem(PLAYBACK_KEY, JSON.stringify({ track: currentTrack, pos: audio.position(), at: Date.now() } satisfies SavedPlayback));
    } else if (!audio?.playing) sessionStorage.removeItem(PLAYBACK_KEY);
  } catch {
    /* storage unavailable */
  }
}
setInterval(savePlayback, 1000);

async function resumePlayback(): Promise<void> {
  let saved: SavedPlayback | null = null;
  try {
    const raw = sessionStorage.getItem(PLAYBACK_KEY);
    saved = raw ? (JSON.parse(raw) as SavedPlayback) : null;
  } catch {
    return;
  }
  if (!saved || Date.now() - saved.at > 10 * 60_000 || !tracks[saved.track]) return;
  const t = tracks[saved.track]!;
  const a = ensureAudio();
  const target = (): number => saved!.pos + (Date.now() - saved!.at) / 1000;
  const start = async (): Promise<void> => {
    if (userStarted) return; // the user already started something else
    currentTrack = saved!.track;
    ui.selectTrack(currentTrack);
    await playUrl(`/tracks/${t.file}`, t.label, target());
    director.onLog?.({ t: performance.now(), kind: 'info', text: `再開 ${t.label} @ ${Math.round(target())}s（リロード前の位置から）` });
  };
  // the context may be suspended until a gesture; try briefly, then wait for the first click / key
  await Promise.race([a.ctx.resume(), new Promise((r) => setTimeout(r, 400))]);
  if (a.ctx.state === 'running') {
    await start();
    return;
  }
  ui.setStatus(`クリックで再開: ${t.label} @ ${Math.round(target())}s`, 'file');
  const once = (): void => {
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
    // defer past the click's own handler so a "Play" click wins over the resume
    setTimeout(() => void start(), 50);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);
}

// ?audio=<url> adds a "Play URL" button (handy for testing with a real track)
const audioUrl = new URLSearchParams(location.search).get('audio');
if (audioUrl) ui.addSourceButton('Play URL', () => void playUrl(audioUrl, audioUrl.split('/').pop() ?? audioUrl));

async function playTrack(index: number): Promise<void> {
  const t = tracks[index];
  if (!t) return;
  currentTrack = index;
  await playUrl(`/tracks/${t.file}`, t.label);
}

// public/tracks/index.json lists bundled tracks (mp3s are not committed; see README)
fetch('/tracks/index.json')
  .then((r) => (r.ok ? (r.json() as Promise<TrackInfo[]>) : []))
  .then((list) => {
    tracks = list;
    ui.setTracks(list);
    void resumePlayback();
  })
  .catch(() => undefined);
director.onDecision = (r, reason) => ui.showDecision(r, reason, director.state);

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrameT) / 1000);
  lastFrameT = now;
  const f = audio?.latest ?? null;
  const t = audio ? audio.ctx.currentTime : now / 1000;
  if (audio?.playing) lastBeat = beat.info(t);
  director.tick(dt);
  if (shuffle.enabled && !shuffle.beatSync && now - shuffle.lastAt >= shuffle.intervalSec * 1000) shuffleNow(now);
  const s = director.state;
  lastInput = {
      w: renderer.w,
      h: renderer.h,
      t,
      dt,
      energy: f?.rms ?? 0,
      sub: f?.sub ?? 0,
      bass: f?.bass ?? 0,
      mid: f?.mid ?? 0,
      high: f?.high ?? 0,
      beatPhase: lastBeat.beatPhase,
      beatPulse: audio?.playing ? lastBeat.beatPulse : 0,
      barPhase: lastBeat.barPhase,
      onset: f?.onset ?? false,
      intensity: s.intensity,
      palette: s.palette,
      wave: f?.wave ?? new Float32Array(2048),
  };
  renderer.draw(lastInput, s.scene, s.transition, s.flash);
  renderer.clearOverlay();
  const dots = [0, 1, 2, 3].map((i) => (i === lastBeat.beatInBar ? '●' : '○')).join('');
  terminal.status = f
    ? `${dots} bar ${lastBeat.bar} · ${lastBeat.bpm ? lastBeat.bpm.toFixed(0) : '---'}bpm ${bars5(f.rms)}${f.onset ? '◆' : ' '} · ${s.scene.id} int${s.intensity.toFixed(2)} ${s.paletteId} · ${s.lastPhase ?? '--'}${s.armed ? ` · armed→${s.armed.scene}` : ''}${s.logo.active ? ' · LOGO' : ''}${s.inFlight ? ' · MAGI…' : ''}`
    : '(no audio)';
  terminal.draw(renderer.overlayCtx, renderer.w, renderer.h, now, logo.active ? 0.35 : 1);
  const panelEl = document.getElementById('panel');
  const panelPx = panelEl && !panelEl.classList.contains('hidden') ? panelEl.offsetWidth * (renderer.w / window.innerWidth) : 0;
  logo.draw(renderer.overlayCtx, renderer.w, renderer.h, now, lastInput, renderer.w - panelPx);
  const hint = audio?.kind === 'demo' ? demoSectionAt(Math.floor(audio.position() / ((60 / DEMO_BPM) * 4))) : null;
  ui.updateLive(f, lastBeat, s, hint);
  if (audio?.playing && !isLive(audio.kind)) ui.setProgress(audio.position(), audio.duration);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// expose for debugging in the console
(window as unknown as { vj: unknown }).vj = { director, beat, agg, terminal, logo, get audio() { return audio; }, frame };
