import type { DecisionReason, Deliberation, DirectorState, LogEntry } from './director';
import type { JevResult } from './jev';
import type { BeatInfo, Effect, FrameFeatures, Scene, SceneId } from './types';
import { EN_PRESETS, JP_PRESETS, MONO_PRESETS } from './fonts';
import { saveSettings, settings } from './settings';

export interface TrackInfo {
  file: string;
  label: string;
  note?: string;
}

/** keys for the first 20 scenes in the list, top to bottom */
export const SCENE_KEYS = [...'1234567890qwertyuiop'];

export type SourceMode = 'demo' | 'tracks' | 'file' | 'mic' | 'system' | 'url';

/** off / on (full) / auto (follows Jev's intensity) / beat (pulses on the beat) */
export type EffectMode = 'off' | 'on' | 'auto' | 'beat' | 'jev';

export const GROUP_LABELS: Record<string, string> = {
  hina: 'ひな祭り',
  '2d': '2D',
  gl: 'GLSL / 3D',
  isf: 'ISF',
  shadertoy: 'Shadertoy',
  user: '追加',
  nenju: '年中行事',
};

export interface UiCallbacks {
  playDemo(): void;
  playFile(file: File): void;
  startMic(deviceId: string | undefined): void;
  startSystemAudio(): void;
  stop(): void;
  setMagiMode(mode: 'always' | 'changes' | 'single'): void;
  setOverlay(on: boolean): void;
  logoNow(): void;
  setLogoText(main: string, sub: string, subAbove: boolean): void;
  getLogoText(): { main: string; sub: string; subAbove: boolean };
  /** scene picker */
  selectScene(id: SceneId): void;
  setSceneEnabled(id: SceneId, on: boolean): void;
  /** edit mode: the scene list was rearranged (null = back to the default order) */
  reorderScenes(ids: string[] | null): void;
  /** 'all' or a scene group */
  setScenePreset(kind: string): void;
  /** shader / plugin files picked or dropped */
  loadPlugins(files: File[]): void;
  removePlugin(id: string): void;
  setEffectMode(id: string, mode: EffectMode): void;
  /** which: 'jp' | 'en' | 'log'; family '' resets to the system font */
  setFont(which: 'jp' | 'en' | 'log', family: string): Promise<string>;
  getFonts(): { jp: string; en: string; log: string };
  /** random font switching for the logo lines */
  setFontShuffle(opts: { enabled: boolean; intervalSec: number; beatSync: boolean }, onStatus: (text: string) => void): void;
  toggleMute(): boolean;
  playTrack(index: number): void;
  seek(sec: number): void;
  setAutoAdvance(on: boolean): void;
  setInterval(bars: number): void;
  setContext(text: string): void;
  askNow(): void;
  togglePause(): boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function meter(label: string): { root: HTMLElement; set(v: number, text?: string): void } {
  const root = el('div', 'meter');
  const name = el('span', '', label);
  const track = el('div', 'track');
  const fill = el('div', 'fill');
  const val = el('span', 'val');
  track.append(fill);
  root.append(name, track, val);
  return {
    root,
    set(v, text) {
      fill.style.width = `${Math.max(0, Math.min(100, v * 100)).toFixed(0)}%`;
      val.textContent = text ?? v.toFixed(2);
    },
  };
}

export class Ui {
  private readonly panel: HTMLElement;
  private readonly meters: Record<string, ReturnType<typeof meter>> = {};
  private readonly beatEl: HTMLElement;
  private readonly answersEl: HTMLElement;
  private readonly statsEl: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly sourceRow: HTMLElement;
  private readonly sourceBody: HTMLElement;
  private readonly modeButtons = new Map<SourceMode, HTMLButtonElement>();
  private readonly modeBodies = new Map<SourceMode, HTMLElement>();
  private readonly playBtn: HTMLButtonElement;
  private overlayCb: HTMLInputElement | null = null;
  private editMode = false;
  private readonly editBtn: HTMLButtonElement;
  private readonly resetOrderBtn: HTMLButtonElement;
  private dragId: string | null = null;
  private readonly fileName: HTMLElement;
  private readonly seekRow: HTMLElement;
  /** the source picked in the Source tabs */
  private mode: SourceMode = 'demo';
  /** what is actually running (null = stopped) */
  private playing: SourceMode | null = null;
  private pendingFile: File | null = null;
  private urlPlay: (() => void) | null = null;
  private readonly deviceSelect: HTMLSelectElement;
  private readonly nowPlayingEl: HTMLElement;
  private readonly unitsEl: HTMLElement;
  private readonly sceneGrid: HTMLElement;
  private readonly presetRow: HTMLElement;
  private readonly fxList: HTMLElement;
  private sceneButtons = new Map<SceneId, { btn: HTMLButtonElement; cb: HTMLInputElement }>();
  private activeScene: SceneId | null = null;
  private readonly trackSelect: HTMLSelectElement;
  private readonly trackNote: HTMLElement;
  private readonly progress: HTMLInputElement;
  private readonly timeEl: HTMLElement;
  private seeking = false;
  private tracks: TrackInfo[] = [];

  constructor(private readonly cb: UiCallbacks) {
    this.panel = document.getElementById('panel')!;

    const title = el('h1', '', 'JEV VJ');
    const sub = el('div', 'hint', 'DSP がビートを刻み、Jev が小節ごとに演出を判断する。h: パネル / f: 全画面');
    this.panel.append(title, sub);

    // source: where the audio comes from (selecting does not start playback)
    const src = el('section');
    src.append(el('h2', '', 'Source'));
    this.sourceRow = el('div', 'seg');
    const modes: [SourceMode, string][] = [
      ['demo', 'Demo'],
      ['tracks', 'Tracks'],
      ['file', 'File'],
      ['mic', 'Mic / line-in'],
      ['system', 'System audio'],
    ];
    for (const [m, label] of modes) this.addModeButton(m, label);
    this.sourceBody = el('div', 'source-body');

    // demo
    const demoBody = el('div', '', '');
    demoBody.append(el('div', 'hint', '128 BPM のテクノを合成（intro → build → drop → breakdown → build → drop → outro、約 3 分）'));
    this.modeBodies.set('demo', demoBody);

    // tracks (bundled playlist)
    const trBody = el('div');
    const plRow = el('div', 'row');
    this.trackSelect = el('select');
    this.trackSelect.style.flex = '1';
    this.trackSelect.style.minWidth = '0';
    this.trackSelect.onchange = () => {
      this.showTrackNote();
      saveSettings({ track: Number(this.trackSelect.value) });
      // while a track is playing, picking another one switches to it
      if (this.playing === 'tracks') cb.playTrack(Number(this.trackSelect.value));
    };
    const prevBtn = el('button', '', '⏮');
    prevBtn.title = '前の曲';
    prevBtn.onclick = () => this.step(-1);
    const nextBtn = el('button', '', '⏭');
    nextBtn.title = '次の曲';
    nextBtn.onclick = () => this.step(1);
    plRow.append(this.trackSelect, prevBtn, nextBtn);
    this.trackNote = el('div', 'hint', '');
    const autoRow = el('label', 'row hint');
    const auto = el('input');
    auto.type = 'checkbox';
    auto.checked = settings.autoAdvance;
    auto.onchange = () => cb.setAutoAdvance(auto.checked);
    autoRow.append(auto, document.createTextNode('曲が終わったら次へ'));
    trBody.append(plRow, this.trackNote, autoRow, el('div', 'hint', 'public/tracks の CC 音源'));
    this.modeBodies.set('tracks', trBody);

    // file
    const fileBody = el('div');
    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    fileInput.onchange = () => {
      const f = fileInput.files?.[0];
      fileInput.value = '';
      if (!f) return;
      this.pendingFile = f;
      this.fileName.textContent = f.name;
      cb.playFile(f);
    };
    const fileRow = el('div', 'row');
    const fileBtn = el('button', '', '音声ファイルを選ぶ…');
    fileBtn.onclick = () => fileInput.click();
    this.fileName = el('span', 'hint', '未選択（画面にドロップでも可）');
    fileRow.append(fileBtn, this.fileName, fileInput);
    fileBody.append(fileRow);
    this.modeBodies.set('file', fileBody);

    // mic / line-in
    const micBody = el('div');
    const devRow = el('div', 'row');
    devRow.append(el('span', 'hint', 'input'));
    this.deviceSelect = el('select');
    this.deviceSelect.style.flex = '1';
    this.deviceSelect.style.minWidth = '0';
    const none = el('option', '', 'default');
    none.value = '';
    this.deviceSelect.append(none);
    devRow.append(this.deviceSelect);
    micBody.append(devRow, el('div', 'hint', 'DJ ミキサーの出力など。スピーカーには出さない（解析のみ）'));
    this.modeBodies.set('mic', micBody);

    // system audio
    const sysBody = el('div');
    this.nowPlayingEl = el('div', 'hint', '');
    sysBody.append(
      el('div', 'hint', '▶ で画面共有ダイアログが開く。「システム音声を共有」を選ぶと Spotify など Mac で鳴っている音をそのまま解析する'),
      this.nowPlayingEl,
    );
    this.modeBodies.set('system', sysBody);

    src.append(this.sourceRow, this.sourceBody);
    this.panel.append(src);

    // transport: the same controls whatever the source is
    const tr = el('section');
    tr.append(el('h2', '', 'Transport'));
    const trRow = el('div', 'row');
    this.playBtn = el('button', 'play', '▶ Play');
    this.playBtn.onclick = () => this.togglePlay();
    const muteBtn = el('button', '', 'Mute');
    muteBtn.title = 'スピーカーだけ切って解析は続ける';
    muteBtn.classList.toggle('on', settings.muted);
    muteBtn.onclick = () => muteBtn.classList.toggle('on', cb.toggleMute());
    this.statusEl = el('span', 'hint status', 'stopped');
    trRow.append(this.playBtn, muteBtn, this.statusEl);
    const seekRow = el('div', 'row');
    this.progress = el('input');
    this.progress.type = 'range';
    this.progress.min = '0';
    this.progress.max = '1000';
    this.progress.value = '0';
    this.progress.style.flex = '1';
    this.progress.oninput = () => {
      this.seeking = true;
    };
    this.progress.onchange = () => {
      this.seeking = false;
      cb.seek((Number(this.progress.value) / 1000) * this.durationSec);
    };
    this.timeEl = el('span', 'hint', '0:00 / 0:00');
    seekRow.append(this.progress, this.timeEl);
    this.seekRow = seekRow;
    tr.append(trRow, seekRow);
    this.panel.append(tr);
    this.selectMode(settings.sourceMode);

    // context + interval
    const ctxSec = el('section');
    ctxSec.append(el('h2', '', 'Context for Jev'));
    const ta = el('textarea');
    ta.placeholder = 'ジャンル・雰囲気・今夜の狙いなど（例: メロディックテクノ、深夜のピークタイム、赤系は避けたい）';
    ta.value = settings.context;
    ta.oninput = () => cb.setContext(ta.value);
    const row2 = el('div', 'row');
    row2.append(el('span', 'hint', 'ask every'));
    const sel = el('select');
    for (const n of [1, 2, 4, 8]) {
      const o = el('option', '', `${n} bar${n > 1 ? 's' : ''}`);
      o.value = String(n);
      if (n === settings.intervalBars) o.selected = true;
      sel.append(o);
    }
    sel.onchange = () => cb.setInterval(Number(sel.value));
    const askBtn = el('button', '', 'Ask now');
    askBtn.onclick = () => cb.askNow();
    this.pauseBtn = el('button', '', 'Pause Jev');
    this.pauseBtn.onclick = () => {
      const paused = cb.togglePause();
      this.pauseBtn.textContent = paused ? 'Resume Jev' : 'Pause Jev';
      this.pauseBtn.classList.toggle('on', paused);
    };
    row2.append(sel, askBtn, this.pauseBtn);
    const row3 = el('div', 'row');
    const magiLabel = el('label', 'row hint');
    const magiSel = el('select');
    for (const [v, t] of [
      ['always', 'MAGI 常時 3 体'],
      ['changes', '変化時のみ 3 体（定期は 1 体）'],
      ['single', '1 体だけ'],
    ] as const) {
      const o = el('option', '', t);
      o.value = v;
      magiSel.append(o);
    }
    magiSel.value = settings.magiMode;
    magiSel.onchange = () => cb.setMagiMode(magiSel.value as 'always' | 'changes' | 'single');
    magiLabel.append(magiSel);
    const ovLabel = el('label', 'row hint');
    const ovCb = el('input');
    ovCb.type = 'checkbox';
    ovCb.checked = settings.overlay;
    ovCb.onchange = () => cb.setOverlay(ovCb.checked);
    this.overlayCb = ovCb;
    ovLabel.append(ovCb, document.createTextNode('CLI ログ表示 (m)'));
    row3.append(magiLabel, ovLabel);
    ctxSec.append(ta, row2, row3);
    this.panel.append(ctxSec);

    // scene picker (素材)
    const scSec = el('section');
    scSec.append(el('h2', '', 'Scenes (素材)'));
    this.presetRow = el('div', 'row');
    this.sceneGrid = el('div', 'scenes');
    const editRow = el('div', 'row');
    this.editBtn = el('button', '', '並び替え');
    this.editBtn.title = '編集モード: ドラッグ & ドロップで順番を変える（上から 20 個にキー 1〜0, q〜p）';
    this.editBtn.onclick = () => this.setEditMode(!this.editMode);
    const resetBtn = el('button', '', '既定の順に戻す');
    resetBtn.onclick = () => cb.reorderScenes(null);
    resetBtn.style.display = 'none';
    this.resetOrderBtn = resetBtn;
    editRow.append(this.editBtn, resetBtn);
    const plugInput = el('input');
    plugInput.type = 'file';
    plugInput.multiple = true;
    plugInput.accept = '.fs,.frag,.glsl,.isf,.txt,.js,.mjs';
    plugInput.style.display = 'none';
    plugInput.onchange = () => {
      if (plugInput.files?.length) cb.loadPlugins([...plugInput.files]);
      plugInput.value = '';
    };
    const plugBtn = el('button', '', 'シェーダー / プラグインを追加…');
    plugBtn.onclick = () => plugInput.click();
    const plugRow = el('div', 'row');
    plugRow.append(plugBtn, plugInput);
    scSec.append(
      this.presetRow,
      editRow,
      this.sceneGrid,
      el('div', 'hint', 'チェック = Jev の候補に入れる。名前クリック = 今すぐ切替（8 小節ホールド）。キー 1〜0, q〜p = 上から 20 個。「並び替え」でドラッグして順番を変えられる'),
      plugRow,
      el('div', 'hint', 'ISF (.fs) / Shadertoy (mainImage) / GLSL / JS モジュールを画面にドロップしても追加できる。ISF のフィルタは FX に入る。追加分はブラウザに保存され、× で削除'),
    );
    this.panel.append(scSec);

    // stage effects (ISF filters, canvas post effects)
    const fxSec = el('section');
    fxSec.append(el('h2', '', 'FX (ポストエフェクト)'));
    this.fxList = el('div', 'fxlist');
    fxSec.append(this.fxList, el('div', 'hint', 'auto = Jev の激しさに連動 / beat = ビートで脈打つ / on = 常時'));
    this.panel.append(fxSec);

    // logo
    const logoSec = el('section');
    logoSec.append(el('h2', '', 'Logo (決め場)'));
    const saved = cb.getLogoText();
    const jp = el('input');
    jp.value = saved.main;
    jp.placeholder = 'メイン（大きく出る行）';
    const en = el('input');
    en.value = saved.sub;
    en.placeholder = 'サブ（小さく字間を空けて出る行）';
    const posSel = el('select');
    for (const [v, t] of [
      ['above', 'サブを上に'],
      ['below', 'サブを下に'],
    ] as const) {
      const o = el('option', '', t);
      o.value = v;
      posSel.append(o);
    }
    posSel.value = saved.subAbove ? 'above' : 'below';
    const emit = (): void => cb.setLogoText(jp.value, en.value, posSel.value === 'above');
    for (const i of [jp, en]) {
      i.type = 'text';
      i.style.width = '100%';
      i.style.font = 'inherit';
      i.style.background = '#101018';
      i.style.color = 'var(--fg)';
      i.style.border = '1px solid var(--line)';
      i.style.borderRadius = '4px';
      i.style.padding = '4px 6px';
      i.oninput = emit;
    }
    posSel.onchange = emit;
    const logoRow = el('div', 'row');
    const logoBtn = el('button', '', 'Logo now (l)');
    logoBtn.onclick = () => cb.logoNow();
    logoRow.append(logoBtn, posSel);
    logoSec.append(el('div', 'hint', 'メイン'), jp, el('div', 'hint', 'サブ'), en, logoRow, el('div', 'hint', 'Jev が決め場と判断すると 8 小節表示。次は 16 小節あけて'));
    this.panel.append(logoSec);

    // fonts (Google Fonts, loaded at runtime)
    const fontSec = el('section');
    fontSec.append(el('h2', '', 'Fonts (Google Fonts)'));
    const current = cb.getFonts();
    const fontRow = (label: string, which: 'jp' | 'en' | 'log', presets: string[], value: string): HTMLElement => {
      const row = el('div', 'row');
      row.append(el('span', 'hint', label));
      const sel = el('select');
      sel.style.maxWidth = '170px';
      const addOption = (fam: string, text = fam): HTMLOptionElement => {
        const o = el('option', '', text);
        o.value = fam;
        sel.append(o);
        return o;
      };
      addOption('', 'system');
      for (const f of presets) addOption(f);
      if (value && !presets.includes(value)) addOption(value);
      sel.value = value;
      const status = el('span', 'hint', value ? '…' : 'system');
      const apply = async (fam: string): Promise<void> => {
        status.textContent = fam ? 'loading…' : 'system';
        status.textContent = await cb.setFont(which, fam);
      };
      sel.onchange = () => void apply(sel.value);
      // free text for any family that is not in the list
      const custom = el('input');
      custom.type = 'text';
      custom.placeholder = 'その他の family 名 + Enter';
      custom.style.width = '150px';
      custom.style.font = 'inherit';
      custom.style.background = '#101018';
      custom.style.color = 'var(--fg)';
      custom.style.border = '1px solid var(--line)';
      custom.style.borderRadius = '4px';
      custom.style.padding = '3px 6px';
      custom.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        const fam = custom.value.trim();
        if (!fam) return;
        if (![...sel.options].some((o) => o.value === fam)) addOption(fam);
        sel.value = fam;
        custom.value = '';
        void apply(fam);
      };
      if (value) void apply(value);
      row.append(sel, status, custom);
      return row;
    };
    fontSec.append(
      fontRow('ロゴ メイン', 'jp', JP_PRESETS, current.jp),
      fontRow('ロゴ サブ', 'en', EN_PRESETS, current.en),
      fontRow('CLI ログ', 'log', MONO_PRESETS, current.log),
    );
    // random shuffle
    const shRow = el('div', 'row');
    const shLabel = el('label', 'row hint');
    const shCb = el('input');
    shCb.type = 'checkbox';
    shCb.checked = settings.fontShuffle.enabled;
    shLabel.append(shCb, document.createTextNode('ロゴのフォントをランダム切替'));
    const shInterval = el('input');
    shInterval.type = 'number';
    shInterval.min = '0.05';
    shInterval.max = '10';
    shInterval.step = '0.05';
    shInterval.value = String(settings.fontShuffle.intervalSec);
    shInterval.style.width = '64px';
    shInterval.style.font = 'inherit';
    shInterval.style.background = '#101018';
    shInterval.style.color = 'var(--fg)';
    shInterval.style.border = '1px solid var(--line)';
    shInterval.style.borderRadius = '4px';
    shInterval.style.padding = '3px 6px';
    const beatLabel = el('label', 'row hint');
    const beatCb = el('input');
    beatCb.type = 'checkbox';
    beatCb.checked = settings.fontShuffle.beatSync;
    beatLabel.append(beatCb, document.createTextNode('ビート同期'));
    const shStatus = el('span', 'hint', '');
    const emitShuffle = (): void =>
      cb.setFontShuffle({ enabled: shCb.checked, intervalSec: Math.max(0.05, Number(shInterval.value) || 0.4), beatSync: beatCb.checked }, (t) => {
        shStatus.textContent = t;
      });
    shCb.onchange = emitShuffle;
    shInterval.onchange = emitShuffle;
    beatCb.onchange = emitShuffle;
    shRow.append(shLabel, shInterval, el('span', 'hint', 'sec'), beatLabel, shStatus);
    // apply the remembered shuffle once the app has finished wiring up
    if (shCb.checked) setTimeout(emitShuffle, 0);
    fontSec.append(shRow, el('div', 'hint', 'プルダウンは全候補が常に出る。Google Fonts にある family ならテキスト欄から追加できる'));
    this.panel.append(fontSec);

    // live analysis
    const live = el('section');
    live.append(el('h2', '', 'DSP (per frame)'));
    this.beatEl = el('div', 'kv');
    live.append(this.beatEl);
    for (const k of ['energy', 'sub', 'bass', 'lowmid', 'mid', 'high']) {
      const m = meter(k);
      this.meters[k] = m;
      live.append(m.root);
    }
    this.panel.append(live);

    // jev answers
    const jev = el('section');
    jev.append(el('h2', '', 'MAGI / Jev (per bars)'));
    this.statsEl = el('div', 'kv');
    this.unitsEl = el('div');
    this.answersEl = el('div');
    jev.append(this.statsEl, this.unitsEl, this.answersEl);
    this.panel.append(jev);

    // log
    const logSec = el('section');
    logSec.append(el('h2', '', 'Decisions'));
    this.logEl = el('div');
    this.logEl.id = 'log';
    logSec.append(this.logEl);
    this.panel.append(logSec);

    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (t instanceof HTMLInputElement && ['text', 'number', 'search', 'url'].includes(t.type)) return;
      if (e.key === 'h') this.panel.classList.toggle('hidden');
      if (e.key === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    });
  }

  private durationSec = 0;

  setScenes(scenes: Scene[]): void {
    this.presetRow.replaceChildren();
    const groups = [...new Set(scenes.map((sc) => sc.group))];
    // 年中行事 is a cross-group preset: every scene tagged with a month (ひな壇 3D included)
    if (scenes.some((sc) => sc.month) && !groups.includes('nenju')) groups.push('nenju');
    for (const kind of ['all', ...groups]) {
      const b = el('button', '', kind === 'all' ? 'すべて' : (GROUP_LABELS[kind] ?? kind));
      b.onclick = () => this.cb.setScenePreset(kind);
      this.presetRow.append(b);
    }
    this.sceneGrid.replaceChildren();
    this.sceneButtons.clear();
    scenes.forEach((sc, i) => {
      const item = el('div', `scene-item g-${sc.group}${sc.error ? ' broken' : ''}`);
      item.dataset.id = sc.id;
      this.makeDraggable(item);
      const cbx = el('input');
      cbx.type = 'checkbox';
      cbx.checked = true;
      cbx.onchange = () => this.cb.setSceneEnabled(sc.id, cbx.checked);
      const btn = el('button', '', sc.name);
      btn.title = sc.error ? `エラー: ${sc.error}` : `${sc.description}${sc.source ? `\n${sc.source}` : ''}`;
      btn.onclick = () => {
        if (!this.editMode) this.cb.selectScene(sc.id);
      };
      const key = SCENE_KEYS[i] ?? '';
      item.append(cbx, btn);
      if (sc.group === 'user') {
        const rm = el('button', 'rm', '×');
        rm.title = '削除';
        rm.onclick = () => this.cb.removePlugin(sc.id);
        item.append(rm);
      }
      item.append(el('span', 'hint key', key));
      this.sceneGrid.append(item);
      this.sceneButtons.set(sc.id, { btn, cb: cbx });
    });
    this.setEditMode(this.editMode);
  }

  private setEditMode(on: boolean): void {
    this.editMode = on;
    this.editBtn.classList.toggle('on', on);
    this.editBtn.textContent = on ? '完了' : '並び替え';
    this.resetOrderBtn.style.display = on ? '' : 'none';
    this.sceneGrid.classList.toggle('editing', on);
    for (const item of this.sceneGrid.children) (item as HTMLElement).draggable = on;
  }

  /** HTML5 drag & drop inside the scene grid (edit mode only). */
  private makeDraggable(item: HTMLElement): void {
    item.draggable = this.editMode;
    item.addEventListener('dragstart', (e) => {
      if (!this.editMode) return e.preventDefault();
      this.dragId = item.dataset.id ?? null;
      item.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', this.dragId ?? '');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      this.dragId = null;
      item.classList.remove('dragging');
      for (const x of this.sceneGrid.children) x.classList.remove('drop-before', 'drop-after');
    });
    const after = (e: DragEvent): boolean => {
      const r = item.getBoundingClientRect();
      return e.clientX > r.left + r.width / 2;
    };
    item.addEventListener('dragover', (e) => {
      if (!this.editMode || !this.dragId || this.dragId === item.dataset.id) return;
      e.preventDefault();
      e.stopPropagation(); // keep the page-level file drop overlay out of it
      const a = after(e);
      item.classList.toggle('drop-after', a);
      item.classList.toggle('drop-before', !a);
    });
    item.addEventListener('dragleave', () => item.classList.remove('drop-before', 'drop-after'));
    item.addEventListener('drop', (e) => {
      if (!this.editMode || !this.dragId) return;
      e.preventDefault();
      e.stopPropagation();
      const ids = [...this.sceneGrid.children].map((x) => (x as HTMLElement).dataset.id!).filter((id) => id !== this.dragId);
      let at = ids.indexOf(item.dataset.id!);
      if (after(e)) at++;
      ids.splice(at, 0, this.dragId);
      this.cb.reorderScenes(ids);
    });
  }

  setOverlayChecked(on: boolean): void {
    if (this.overlayCb) this.overlayCb.checked = on;
  }

  setEffects(effects: Effect[], modes: Map<string, EffectMode>): void {
    this.fxList.replaceChildren();
    if (effects.length === 0) this.fxList.append(el('div', 'hint', '（なし）'));
    for (const fx of effects) {
      const row = el('div', `fx-item${fx.error ? ' broken' : ''}`);
      const name = el('span', 'fxname', fx.name);
      name.title = fx.error ? `エラー: ${fx.error}` : fx.description;
      const sel = el('select');
      for (const m of ['off', 'jev', 'auto', 'beat', 'on'] as const) sel.append(new Option(m === 'jev' ? 'jev (AI)' : m, m));
      sel.value = modes.get(fx.id) ?? 'auto';
      sel.onchange = () => this.cb.setEffectMode(fx.id, sel.value as EffectMode);
      row.append(name, sel);
      if (fx.id.startsWith('user_')) {
        const rm = el('button', 'rm', '×');
        rm.onclick = () => this.cb.removePlugin(fx.id);
        row.append(rm);
      }
      this.fxList.append(row);
    }
  }

  setEnabledScenes(ids: Set<SceneId>): void {
    for (const [id, { cb }] of this.sceneButtons) cb.checked = ids.size === 0 || ids.has(id);
  }

  setActiveScene(id: SceneId): void {
    if (this.activeScene === id) return;
    if (this.activeScene) this.sceneButtons.get(this.activeScene)?.btn.classList.remove('on');
    this.sceneButtons.get(id)?.btn.classList.add('on');
    this.activeScene = id;
  }

  setInputDevices(devices: { deviceId: string; label: string }[]): void {
    const cur = this.deviceSelect.value;
    const none = el('option', '', 'default');
    none.value = '';
    this.deviceSelect.replaceChildren(
      none,
      ...devices.map((d) => {
        const o = el('option', '', d.label);
        o.value = d.deviceId;
        return o;
      }),
    );
    if ([...this.deviceSelect.options].some((o) => o.value === cur)) this.deviceSelect.value = cur;
  }

  setNowPlaying(text: string | null): void {
    this.nowPlayingEl.textContent = text ?? '';
  }

  /** Three-column verdict table for the latest deliberation. */
  showDeliberation(d: Deliberation): void {
    const rows: HTMLElement[] = [];
    const head = el('div', 'units');
    for (const u of d.units) {
      const cell = el('div', `unit ${u.stance}`);
      cell.append(el('div', 'uname', `${u.unit.name}·${u.unit.number}`));
      if (u.error) cell.append(el('div', 'uerr', u.error.slice(0, 40)));
      else if (!u.result) cell.append(el('div', 'hint', '審議中'));
      else {
        const a = u.result.answers;
        const prop = u.proposal === 'keep' || u.proposal === null ? '維持' : u.proposal;
        cell.append(el('div', 'uprop', prop));
        cell.append(el('div', 'hint', `${a.phase.choice} · sw ${a.switch_now.noul.toFixed(2)} · int ${a.intensity.score.toFixed(1)} · ${a.palette.choice} · ${Math.round(u.result.latencyMs)}ms`));
        if (u.stance !== 'none') cell.append(el('div', 'ustance', u.stance === 'for' ? '賛成' : '反対'));
      }
      head.append(cell);
    }
    rows.push(head);
    const outcome = d.outcome === 'approved' ? '可決' : d.outcome === 'rejected' ? '否決' : d.outcome === 'keep' ? '維持' : d.outcome === 'error' ? 'エラー' : '審議中';
    rows.push(el('div', `uresult ${d.outcome}`, `#${d.id} ${outcome}  ${d.note}`));
    // what went in, what came out
    if (d.input) {
      const det = el('details');
      det.append(el('summary', 'hint', `#${d.id} 入力 (state) → 出力 (answers) を見る`));
      const pre = el('pre', 'json');
      pre.textContent = JSON.stringify(d.input, null, 1);
      det.append(el('div', 'hint', '入力 state（3 体共通。各 unit には judge.stance が加わる）'), pre);
      for (const u of d.units) {
        if (!u.result) continue;
        const a = u.result.answers;
        const brief = Object.fromEntries(
          Object.entries(a).map(([k, v]) => [k, 'choice' in v ? `${v.choice} (${(v.probabilities as Record<string, number>)[v.choice]?.toFixed(2)})` : 'noul' in v ? v.noul.toFixed(2) : v.score.toFixed(2)]),
        );
        const pu = el('pre', 'json');
        pu.textContent = JSON.stringify(brief, null, 1);
        det.append(el('div', 'hint', `${u.unit.name}-${u.unit.number} の回答  ${Math.round(u.result.latencyMs)}ms  ${u.result.usage.input_tokens} tokens`), pu);
      }
      if (d.consensus) {
        const c = d.consensus;
        const pc = el('pre', 'json');
        pc.textContent = JSON.stringify(
          {
            phase: `${c.phase.choice} (${c.phase.probabilities[c.phase.choice].toFixed(2)})`,
            scene: `${c.scene.choice} (${(c.scene.probabilities[c.scene.choice] ?? 0).toFixed(2)})`,
            switch_now: c.switch_now.noul.toFixed(2),
            drop_soon: c.drop_soon.noul.toFixed(2),
            drop_scene: c.drop_scene?.choice ?? '(未質問)',
            intensity: c.intensity.score.toFixed(2),
            palette: c.palette.choice,
            transition: c.transition.choice,
            kime: c.kime.noul.toFixed(2),
            kime_on_drop: c.kime_on_drop ? c.kime_on_drop.noul.toFixed(2) : '(未質問)',
            fx: c.fx?.choice ?? '(未質問)',
          },
          null,
          1,
        );
        det.append(el('div', 'hint', '合議（多数決 / 平均）'), pc);
      }
      rows.push(det);
    }
    this.unitsEl.replaceChildren(...rows);
  }

  setTracks(tracks: TrackInfo[]): void {
    this.tracks = tracks;
    this.trackSelect.replaceChildren(
      ...tracks.map((t, i) => {
        const o = el('option', '', t.label);
        o.value = String(i);
        return o;
      }),
    );
    if (settings.track < tracks.length) this.trackSelect.value = String(settings.track);
    this.showTrackNote();
  }

  selectTrack(index: number): void {
    this.trackSelect.value = String(index);
    saveSettings({ track: index });
    this.showTrackNote();
  }

  private showTrackNote(): void {
    const t = this.tracks[Number(this.trackSelect.value)];
    this.trackNote.textContent = t?.note ?? '';
  }

  private step(delta: number): void {
    if (this.tracks.length === 0) return;
    const i = (Number(this.trackSelect.value) + delta + this.tracks.length) % this.tracks.length;
    this.selectTrack(i);
    this.cb.playTrack(i);
  }

  setProgress(posSec: number, durationSec: number): void {
    this.durationSec = durationSec;
    if (!this.seeking) this.progress.value = durationSec > 0 ? String(Math.round((posSec / durationSec) * 1000)) : '0';
    const f = (x: number): string => `${Math.floor(x / 60)}:${Math.floor(x % 60).toString().padStart(2, '0')}`;
    this.timeEl.textContent = `${f(posSec)} / ${f(durationSec)}`;
  }

  private addModeButton(m: SourceMode, label: string): void {
    const b = el('button', '', label);
    b.onclick = () => this.selectMode(m);
    this.sourceRow.append(b);
    this.modeButtons.set(m, b);
  }

  /** Pick a source. Does not interrupt what is playing; ▶ starts the picked one. */
  selectMode(m: SourceMode): void {
    if (!this.modeButtons.has(m)) m = 'demo';
    this.mode = m;
    if (settings.sourceMode !== m) saveSettings({ sourceMode: m });
    for (const [k, b] of this.modeButtons) b.classList.toggle('on', k === m);
    this.sourceBody.replaceChildren(this.modeBodies.get(m) ?? el('div'));
    this.refreshTransport();
  }

  /** ■ stops the running source; ▶ starts the picked one (replacing whatever else is running). */
  private togglePlay(): void {
    if (this.playing && this.playing === this.mode) {
      this.cb.stop();
      return;
    }
    switch (this.mode) {
      case 'demo':
        this.cb.playDemo();
        break;
      case 'tracks':
        if (this.tracks.length) this.cb.playTrack(Number(this.trackSelect.value) || 0);
        break;
      case 'file':
        if (this.pendingFile) this.cb.playFile(this.pendingFile);
        else (this.modeBodies.get('file')?.querySelector('input[type=file]') as HTMLInputElement | null)?.click();
        break;
      case 'mic':
        this.cb.startMic(this.deviceSelect.value || undefined);
        break;
      case 'system':
        this.cb.startSystemAudio();
        break;
      case 'url':
        this.urlPlay?.();
        break;
    }
  }

  private refreshTransport(): void {
    const stoppable = this.playing !== null && this.playing === this.mode;
    this.playBtn.textContent = stoppable ? '■ Stop' : this.playing ? '▶ Play (切替)' : '▶ Play';
    this.playBtn.classList.toggle('on', stoppable);
    // live inputs have no timeline
    const live = (this.playing ?? this.mode) === 'mic' || (this.playing ?? this.mode) === 'system';
    this.seekRow.style.display = live ? 'none' : '';
  }

  /** ?audio=<url>: an extra source tab */
  addSourceButton(label: string, onClick: () => void): void {
    this.urlPlay = onClick;
    const body = el('div');
    body.append(el('div', 'hint', label));
    this.modeBodies.set('url', body);
    this.addModeButton('url', 'URL');
  }

  /** `active` = the source now running (null = stopped); the Source tabs follow it. */
  setStatus(text: string, active: SourceMode | null): void {
    this.statusEl.textContent = text;
    this.playing = active;
    if (active && active !== this.mode) this.selectMode(active);
    else this.refreshTransport();
  }

  updateLive(f: FrameFeatures | null, beat: BeatInfo, d: DirectorState, sectionHint: string | null): void {
    if (f) {
      this.meters.energy!.set(f.rms);
      this.meters.sub!.set(f.sub);
      this.meters.bass!.set(f.bass);
      this.meters.lowmid!.set(f.lowmid);
      this.meters.mid!.set(f.mid);
      this.meters.high!.set(f.high);
    }
    const dots = ['●', '○', '○', '○'].map((_, i) => (i === beat.beatInBar ? '●' : '○')).join('');
    this.setActiveScene(d.scene.id);
    this.beatEl.replaceChildren(
      ...kv('bpm', beat.bpm ? `${beat.bpm.toFixed(1)} ${beat.locked ? '' : '(searching)'}` : '--'),
      ...kv('bar', `${beat.bar}  ${dots}`),
      ...kv('scene', `${d.scene.name}${d.transition ? ` → ${d.transition.to.name}` : ''}`),
      ...kv('intensity', d.intensity.toFixed(2)),
      ...kv('palette', d.paletteId),
      ...kv('armed', d.armed ? `${d.armed.scene} (until bar ${d.armed.untilBar})` : '--'),
      ...kv('fx (jev)', d.fx ?? '--'),
    );
    void sectionHint;
  }

  showDecision(r: JevResult, reason: DecisionReason, d: DirectorState): void {
    const a = r.answers;
    const avg = d.latencies.length ? d.latencies.reduce((x, y) => x + y, 0) / d.latencies.length : 0;
    this.statsEl.replaceChildren(
      ...kv('calls', `${d.calls} 呼び出し · 審議 ${d.deliberation?.id ?? '-'} · skip ${d.skips} · next +${d.nextIntervalBars} (${reason})`),
      ...kv('latency', `${Math.round(r.latencyMs)} ms  avg ${Math.round(avg)} ms`),
      ...kv('tokens', `${r.usage.input_tokens} in この審議 · 累計 ${(d.inputTokens / 1000).toFixed(1)}k`),
      ...kv('cost', `$${d.costUsd.toFixed(4)} total  (~$${((d.costUsd / Math.max(1, d.calls)) * 900).toFixed(3)}/h at 1 call/4s)`),
      ...kv('model', r.model),
    );
    const blocks: HTMLElement[] = [];
    const probs = (name: string, p: Record<string, number>, win: string): void => {
      blocks.push(el('div', 'qname', name));
      for (const [k, v] of Object.entries(p).sort((x, y) => y[1] - x[1])) {
        const row = el('div', `prob${k === win ? ' win' : ''}`);
        const track = el('div', 'track');
        const fill = el('div', 'fill');
        fill.style.width = `${(v * 100).toFixed(0)}%`;
        track.append(fill);
        row.append(el('span', 'name', k), track, el('span', 'val', v.toFixed(2)));
        blocks.push(row);
      }
    };
    probs('phase', a.phase.probabilities, a.phase.choice);
    blocks.push(el('div', 'qname', 'drop_soon / switch_now'));
    for (const [k, v] of [
      ['drop_soon', a.drop_soon.noul],
      ['switch_now', a.switch_now.noul],
    ] as const) {
      const row = el('div', `prob${v >= 0.5 ? ' win' : ''}`);
      const track = el('div', 'track');
      const fill = el('div', 'fill');
      fill.style.width = `${(v * 100).toFixed(0)}%`;
      track.append(fill);
      row.append(el('span', 'name', k), track, el('span', 'val', v.toFixed(2)));
      blocks.push(row);
    }
    probs('scene', a.scene.probabilities, a.scene.choice);
    if (a.drop_scene) probs('drop_scene (speculative)', a.drop_scene.probabilities, a.drop_scene.choice);
    probs(`intensity = ${a.intensity.score.toFixed(2)}`, a.intensity.probabilities, String(Math.round(a.intensity.score)));
    probs('palette', a.palette.probabilities, a.palette.choice);
    probs('transition', a.transition.probabilities, a.transition.choice);
    if (a.fx) probs(`fx → ${d.fx ?? 'none'}`, a.fx.probabilities, d.fx ?? 'none');
    this.answersEl.replaceChildren(...blocks);
  }

  log(e: LogEntry): void {
    const row = el('div', `entry ${e.kind}`);
    const d = new Date();
    row.append(el('span', 't', d.toLocaleTimeString('ja-JP', { hour12: false })), document.createTextNode(e.text));
    this.logEl.prepend(row);
    while (this.logEl.children.length > 80) this.logEl.lastChild?.remove();
  }
}

function kv(k: string, v: string): HTMLElement[] {
  return [el('span', '', k), el('b', '', v)];
}
