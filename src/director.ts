import type { BarAggregator, Jump } from './features';
import { buildQuestions, buildState, callJev, UNITS, type JevAnswers, type JevResult, type SetContext, type Unit, type UnitId } from './jev';
import { PALETTES, SCENE_BY_ID, SCENES } from './scenes';
import type { Palette, PaletteId, PhaseId, Scene, SceneId, TransitionId } from './types';

export type DecisionReason = 'interval' | 'change:drop' | 'change:cut' | 'manual' | 'start';

export interface LogEntry {
  t: number;
  kind: 'info' | 'switch' | 'armed' | 'error' | 'jev' | 'magi' | 'approved' | 'rejected' | 'keep' | 'logo' | 'dsp';
  text: string;
}

export interface UnitVerdict {
  unit: Unit;
  result: JevResult | null;
  error: string | null;
  arrivedAt: number | null;
  /** the unit's own proposal: a scene to switch to, or keep */
  proposal: SceneId | 'keep' | null;
  /** how the unit relates to the final resolution */
  stance: 'for' | 'against' | 'none';
}

export type Outcome = 'pending' | 'approved' | 'rejected' | 'keep' | 'error';

/** One MAGI deliberation: three units asked in parallel, then a resolution. */
export interface Deliberation {
  id: number;
  reason: DecisionReason;
  bar: number;
  startedAt: number;
  units: UnitVerdict[];
  /** the state sent to Jev (without the per-unit judge field) */
  input: Record<string, unknown> | null;
  consensus: JevAnswers | null;
  /** what was put to the vote */
  proposal: SceneId | 'keep';
  outcome: Outcome;
  decidedAt: number | null;
  transition: TransitionId | null;
  note: string;
}

export interface DirectorState {
  scene: Scene;
  transition: { to: Scene; kind: TransitionId; progress: number } | null;
  intensity: number;
  palette: Palette;
  paletteId: PaletteId;
  flash: number;
  armed: { scene: SceneId; decidedAt: number; untilBar: number; logo: boolean } | null;
  logo: { active: boolean; untilBar: number; cooldownUntilBar: number; source: 'jev' | 'drop' | 'manual' | null };
  inFlight: boolean;
  last: JevResult | null;
  lastReason: DecisionReason | null;
  deliberation: Deliberation | null;
  calls: number;
  /** deliberations skipped because nothing changed / jump cooldown */
  skips: number;
  /** bars until the next periodic deliberation (2 = base, 4 when the music is settled) */
  nextIntervalBars: number;
  inputTokens: number;
  costUsd: number;
  latencies: number[];
  lastPhase: PhaseId | null;
  intervalBars: number;
  paused: boolean;
  /** MAGI mode: three units; otherwise a single anonymous Jev */
  magi: boolean;
}

const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => {
    const x = (pa >> shift) & 255;
    const y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Majority vote on a choice question; ties fall back to summed probabilities. */
function voteChoice<T extends string>(answers: { choice: T; probabilities: Record<T, number> }[]): {
  type: 'choice';
  choice: T;
  confidence: number;
  probabilities: Record<T, number>;
} {
  const summed: Record<string, number> = {};
  const votes: Record<string, number> = {};
  for (const a of answers) {
    votes[a.choice] = (votes[a.choice] ?? 0) + 1;
    for (const [k, v] of Object.entries(a.probabilities) as [string, number][]) summed[k] = (summed[k] ?? 0) + v / answers.length;
  }
  const byVotes = Object.entries(votes).sort((x, y) => y[1] - x[1] || (summed[y[0]] ?? 0) - (summed[x[0]] ?? 0));
  const top = byVotes[0]!;
  const choice = (top[1] >= 2 ? top[0] : Object.entries(summed).sort((x, y) => y[1] - x[1])[0]![0]) as T;
  const sorted = Object.values(summed).sort((x, y) => y - x);
  return { type: 'choice', choice, confidence: (sorted[0] ?? 0) - (sorted[1] ?? 0), probabilities: summed as Record<T, number> };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Merge the units' answers into one JevAnswers-shaped consensus. */
function consensusOf(results: JevResult[]): JevAnswers {
  const A = results.map((r) => r.answers);
  const scoreProbs: Record<string, number> = {};
  for (const a of A) for (const [k, v] of Object.entries(a.intensity.probabilities)) scoreProbs[k] = (scoreProbs[k] ?? 0) + v / A.length;
  return {
    phase: voteChoice(A.map((a) => a.phase)),
    drop_soon: { type: 'noul', noul: mean(A.map((a) => a.drop_soon.noul)) },
    switch_now: { type: 'noul', noul: mean(A.map((a) => a.switch_now.noul)) },
    scene: voteChoice(A.map((a) => a.scene)),
    drop_scene: voteChoice(A.map((a) => a.drop_scene)),
    intensity: {
      type: 'score',
      score: mean(A.map((a) => a.intensity.score)),
      confidence: mean(A.map((a) => a.intensity.confidence)),
      probabilities: scoreProbs,
    },
    palette: voteChoice(A.map((a) => a.palette)),
    transition: voteChoice(A.map((a) => a.transition)),
    kime: { type: 'noul', noul: mean(A.map((a) => a.kime.noul)) },
    kime_on_drop: { type: 'noul', noul: mean(A.map((a) => a.kime_on_drop.noul)) },
  };
}

const LOGO_BARS = 8;
const LOGO_COOLDOWN_BARS = 16;

/** One-line digest of the state we are about to send, for the log. */
function summarizeInput(input: Record<string, unknown>, set: SetContext): string {
  const now = (input.now ?? {}) as Record<string, unknown>;
  const trends = (now.trends_4bars ?? {}) as Record<string, string>;
  const tr = (k: string): string => {
    const v = trends[k] ?? '';
    return v.startsWith('上昇') ? '↑' : v.startsWith('下降') ? '↓' : '→';
  };
  const abs = String(now.loudness_absolute ?? '').split('（')[0];
  const rel = String(now.energy_relative ?? '').split('（')[0];
  const layers = String(now.layers_active ?? '');
  const ctx = set.userContext ? ` ctx="${set.userContext.slice(0, 28)}${set.userContext.length > 28 ? '…' : ''}"` : '';
  return `音圧 ${abs} (相対 ${rel})  層[${layers}]  傾向 e${tr('energy')} bass${tr('bass')} hi${tr('high')} on${tr('onsets')}  | scene=${set.currentScene} age=${set.sceneAgeBars} prev=[${set.previousScenes.slice(-3).join(',')}] 前回=${set.lastPhase ?? '-'}${ctx}`;
}

/**
 * The slow loop. Every N bars (or right after a detected jump) it asks the
 * three MAGI units in parallel, merges their answers, and turns the result
 * into scene / palette / intensity targets. Beat-level reactions never wait
 * for Jev; a pre-armed "drop_scene" lets the DSP cut instantly on the drop.
 */
export class Director {
  readonly state: DirectorState;
  private targetIntensity = 0.4;
  private targetPalette: PaletteId = 'cold';
  private paletteFrom: Palette;
  private paletteT = 1;
  private sceneStartBar = 0;
  private previousScenes: SceneId[] = [];
  private lastSwitchReason: string | null = null;
  private lastDecisionBar = -1000;
  private holdUntilBar = -1;
  /** bar of the last jump-triggered deliberation, per kind (4-bar cooldown) */
  private lastJumpBar: Record<'drop' | 'cut', number> = { drop: -1000, cut: -1000 };
  /** what the last two bars looked like when we last asked; used to skip unchanged intervals */
  private lastAsked: { e: number; sub: number; bf: number; mid: number; high: number; onsets: number } | null = null;
  private abort: AbortController | null = null;
  private barDuration = (60 / 128) * 4;
  private deliberationSeq = 0;
  /** scenes Jev may choose from (empty = all) */
  readonly enabledScenes = new Set<SceneId>();
  userContext = '';
  onLog: ((e: LogEntry) => void) | null = null;
  onDecision: ((r: JevResult, reason: DecisionReason) => void) | null = null;
  onDeliberation: ((d: Deliberation) => void) | null = null;
  onLogo: ((show: boolean) => void) | null = null;

  constructor(private readonly agg: BarAggregator) {
    const scene = SCENE_BY_ID.particles;
    this.paletteFrom = PALETTES.cold;
    this.state = {
      scene,
      transition: null,
      intensity: 0.4,
      palette: { ...PALETTES.cold },
      paletteId: 'cold',
      flash: 0,
      armed: null,
      logo: { active: false, untilBar: -1, cooldownUntilBar: -1, source: null },
      inFlight: false,
      last: null,
      lastReason: null,
      deliberation: null,
      calls: 0,
      skips: 0,
      nextIntervalBars: 2,
      inputTokens: 0,
      costUsd: 0,
      latencies: [],
      lastPhase: null,
      intervalBars: 2,
      paused: false,
      magi: true,
    };
  }

  reset(): void {
    this.abort?.abort();
    this.abort = null;
    const s = this.state;
    s.transition = null;
    s.armed = null;
    s.inFlight = false;
    s.last = null;
    s.lastPhase = null;
    s.deliberation = null;
    s.logo = { active: false, untilBar: -1, cooldownUntilBar: -1, source: null };
    this.onLogo?.(false);
    this.sceneStartBar = 0;
    this.previousScenes = [];
    this.lastSwitchReason = null;
    this.lastDecisionBar = -1000;
    this.holdUntilBar = -1;
    this.lastJumpBar = { drop: -1000, cut: -1000 };
    this.lastAsked = null;
    s.nextIntervalBars = s.intervalBars;
  }

  private snapshot(): { e: number; sub: number; bf: number; mid: number; high: number; onsets: number } | null {
    const h = this.agg.history.slice(-2);
    if (h.length === 0) return null;
    const avg = (k: 'energy' | 'sub' | 'bassFloor' | 'mid' | 'high' | 'onsets'): number => h.reduce((a, b) => a + b[k], 0) / h.length;
    return { e: avg('energy'), sub: avg('sub'), bf: avg('bassFloor'), mid: avg('mid'), high: avg('high'), onsets: avg('onsets') };
  }

  /** True when the last two bars look like they did at the previous deliberation. */
  private unchangedSince(bar: number): string | null {
    const s = this.state;
    const now = this.snapshot();
    const prev = this.lastAsked;
    if (!now || !prev) return null;
    if (s.armed) return null;
    if (bar - this.sceneStartBar >= 16) return null;
    const d = (a: number, b: number): number => Math.abs(a - b);
    const maxDiff = Math.max(d(now.e, prev.e), d(now.sub, prev.sub), d(now.bf, prev.bf), d(now.mid, prev.mid), d(now.high, prev.high));
    if (maxDiff >= 0.05 || d(now.onsets, prev.onsets) > 2) return null;
    return `Δmax ${maxDiff.toFixed(3)}, onsets ±${d(now.onsets, prev.onsets).toFixed(0)}`;
  }

  private log(kind: LogEntry['kind'], text: string): void {
    this.onLog?.({ t: performance.now(), kind, text });
  }

  /** The candidate scenes for the next deliberation. */
  candidates(): Scene[] {
    const c = SCENES.filter((sc) => this.enabledScenes.has(sc.id));
    return c.length > 0 ? c : SCENES;
  }

  /** VJ override: cut now and hold for a few bars so the council does not undo it at once. */
  manualSelect(id: SceneId, bar: number): void {
    const s = this.state;
    if (s.scene.id === id) return;
    this.switchTo(id, 'cut', '手動', bar);
    this.holdUntilBar = bar + 8;
    this.log('switch', `手動 → ${SCENE_BY_ID[id].name}（8小節ホールド）`);
  }

  setBpm(bpm: number): void {
    if (bpm > 0) this.barDuration = (60 / bpm) * 4;
  }

  showLogo(bar: number, why: string, source: 'jev' | 'drop' | 'manual' = 'jev'): void {
    const s = this.state;
    if (s.logo.active) return;
    s.logo = { active: true, untilBar: bar + LOGO_BARS, cooldownUntilBar: s.logo.cooldownUntilBar, source };
    this.log('logo', `決め場 ロゴ表示 ${LOGO_BARS}小節 :: ${why}`);
    this.onLogo?.(true);
  }

  hideLogo(bar: number): void {
    const s = this.state;
    if (!s.logo.active) return;
    s.logo = { active: false, untilBar: -1, cooldownUntilBar: bar + LOGO_COOLDOWN_BARS, source: null };
    this.log('info', `ロゴ終了 (次は bar ${bar + LOGO_COOLDOWN_BARS} 以降)`);
    this.onLogo?.(false);
  }

  /** Called once per bar from the beat tracker. */
  onBar(bar: number, elapsedSec: number): void {
    const s = this.state;
    if (s.armed && bar > s.armed.untilBar) {
      this.log('info', `armed ${s.armed.scene} expired (no drop within 12 bars)`);
      s.armed = null;
    }
    if (s.logo.active && bar >= s.logo.untilBar) this.hideLogo(bar);
    if (s.paused) return;
    if (bar - this.lastDecisionBar >= s.nextIntervalBars && this.agg.history.length >= 2) {
      const same = this.unchangedSince(bar);
      if (same) {
        s.skips++;
        this.lastDecisionBar = bar;
        this.log('info', `変化なし → skip (bar ${bar}, ${same}, age ${bar - this.sceneStartBar})`);
        return;
      }
      void this.decide('interval', bar, elapsedSec);
    }
  }

  /** Called every analysis tick with the aggregator's jump detector result. */
  onJump({ kind, strong }: Jump, bar: number, elapsedSec: number): void {
    const s = this.state;
    if (kind === 'drop' && s.armed && strong) {
      const ageMs = performance.now() - s.armed.decidedAt;
      this.log('switch', `DROP detected by DSP → cut to ${s.armed.scene} (MAGI が ${(ageMs / 1000).toFixed(1)}s 前に先読み)`);
      this.switchTo(s.armed.scene, 'cut', 'drop detected (pre-armed)', bar);
      this.targetIntensity = Math.max(this.targetIntensity, 0.9);
      this.holdUntilBar = bar + 4;
      if (s.armed.logo && bar >= s.logo.cooldownUntilBar) this.showLogo(bar, 'ドロップ検知（kime_on_drop 先読み）', 'drop');
      s.armed = null;
    } else if (bar - this.lastJumpBar[kind] < 4) {
      // same kind of jump within 4 bars: the armed cut above still fires, but no new deliberation
      s.skips++;
      this.log('info', `${kind.toUpperCase()} detected by DSP → 4小節以内なので審議スキップ`);
      return;
    } else {
      this.log('info', `${kind.toUpperCase()} detected by DSP${s.armed && kind === 'drop' ? ' (weak, keeping armed)' : ''} → asking now`);
    }
    if (s.paused) return;
    this.lastJumpBar[kind] = bar;
    void this.decide(kind === 'drop' ? 'change:drop' : 'change:cut', bar, elapsedSec);
  }

  async decide(reason: DecisionReason, bar: number, elapsedSec: number, bpm?: number): Promise<void> {
    const s = this.state;
    if (s.inFlight) return;
    s.inFlight = true;
    this.lastDecisionBar = bar;
    this.lastAsked = this.snapshot();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const set: SetContext = {
      elapsedSec,
      bpm: bpm ?? (4 * 60) / this.barDuration,
      bar,
      currentScene: s.scene.id,
      sceneAgeBars: bar - this.sceneStartBar,
      previousScenes: this.previousScenes,
      lastPhase: s.lastPhase,
      lastSwitchReason: this.lastSwitchReason,
      userContext: this.userContext,
    };
    const units: Unit[] = s.magi ? UNITS : [UNITS[0]!];
    const d: Deliberation = {
      id: ++this.deliberationSeq,
      reason,
      bar,
      startedAt: performance.now(),
      units: units.map((unit) => ({ unit, result: null, error: null, arrivedAt: null, proposal: null, stance: 'none' })),
      input: null,
      consensus: null,
      proposal: 'keep',
      outcome: 'pending',
      decidedAt: null,
      transition: null,
      note: '',
    };
    s.deliberation = d;
    this.onDeliberation?.(d);
    const cands0 = this.candidates();
    const input = buildState(this.agg, set, cands0);
    d.input = input;
    this.log('magi', `MAGI #${d.id} bar ${bar} :: 審議開始 [${reason}] units=${units.length} 候補=${cands0.length}`);
    this.log('magi', `  入力 :: ${summarizeInput(input, set)}`);

    await Promise.all(
      d.units.map(async (uv) => {
        const unit = s.magi ? uv.unit : undefined;
        try {
          const cands = this.candidates();
          const r = await callJev(buildState(this.agg, set, cands, unit), buildQuestions(cands, unit), signal);
          uv.result = r;
          uv.arrivedAt = performance.now();
          uv.proposal = r.answers.switch_now.noul >= 0.5 && r.answers.scene.choice !== s.scene.id ? r.answers.scene.choice : 'keep';
          const a = r.answers;
          const name = `${uv.unit.name}-${uv.unit.number}`.padEnd(12, ' ');
          const prop = uv.proposal === 'keep' ? '維持' : uv.proposal.toUpperCase();
          this.log('magi', `${name} ${prop.padEnd(10, ' ')} switch ${a.switch_now.noul.toFixed(2)}  ${a.phase.choice.padEnd(9, ' ')} int ${a.intensity.score.toFixed(1)}  drop ${a.drop_soon.noul.toFixed(2)}  kime ${a.kime.noul.toFixed(2)}  ${Math.round(r.latencyMs)}ms`);
          s.calls++;
          s.inputTokens += r.usage.input_tokens;
          s.costUsd = s.inputTokens * USD_PER_INPUT_TOKEN;
          s.latencies.push(r.latencyMs);
          if (s.latencies.length > 60) s.latencies.shift();
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') uv.error = 'aborted';
          else uv.error = e instanceof Error ? e.message : String(e);
          uv.arrivedAt = performance.now();
          if (uv.error !== 'aborted') this.log('error', `${uv.unit.name}-${uv.unit.number} 応答なし: ${uv.error}`);
        }
      }),
    );

    try {
      if (signal.aborted) return;
      const results = d.units.map((u) => u.result).filter((r): r is JevResult => r !== null);
      if (results.length === 0) {
        d.outcome = 'error';
        d.note = d.units[0]?.error ?? 'no answers';
        d.decidedAt = performance.now();
        this.log('error', `MAGI: ${d.note}`);
        return;
      }
      const consensus = consensusOf(results);
      d.consensus = consensus;
      const merged: JevResult = {
        answers: consensus,
        usage: {
          input_tokens: results.reduce((a, r) => a + r.usage.input_tokens, 0),
          output_tokens: results.reduce((a, r) => a + r.usage.output_tokens, 0),
        },
        model: results[0]!.model,
        latencyMs: Math.max(...results.map((r) => r.latencyMs)),
        upstreamMs: null,
        state: results[0]!.state,
      };
      s.last = merged;
      s.lastReason = reason;
      this.apply(merged, reason, bar, d);
      this.onDecision?.(merged, reason);
      this.onDeliberation?.(d);
    } finally {
      s.inFlight = false;
      this.abort = null;
    }
  }

  private apply(r: JevResult, reason: DecisionReason, bar: number, d: Deliberation): void {
    const s = this.state;
    const a = r.answers;
    s.lastPhase = a.phase.choice;
    this.targetIntensity = Math.max(0, Math.min(1, a.intensity.score / 4));
    if (a.palette.choice !== this.targetPalette && a.palette.confidence > 0.1) {
      this.targetPalette = a.palette.choice;
      this.paletteFrom = { ...s.palette };
      this.paletteT = 0;
    }
    this.log(
      'jev',
      `合議 :: ${a.phase.choice}(${a.phase.probabilities[a.phase.choice].toFixed(2)}) scene=${a.scene.choice}(${a.scene.probabilities[a.scene.choice].toFixed(2)}) switch=${a.switch_now.noul.toFixed(2)} int=${a.intensity.score.toFixed(1)} pal=${a.palette.choice} drop_soon=${a.drop_soon.noul.toFixed(2)} kime=${a.kime.noul.toFixed(2)} next+${(a.phase.choice === 'drop' || a.phase.choice === 'steady') && a.switch_now.noul < 0.3 && a.drop_soon.noul < 0.3 && !s.armed ? Math.max(s.intervalBars, 4) : s.intervalBars}`,
    );

    // arm the speculative drop scene (and whether the drop is the 決め場)
    if (a.drop_soon.noul >= 0.5 && a.phase.choice !== 'drop') {
      const armScene = a.drop_scene.choice;
      const logo = a.kime_on_drop.noul >= 0.5;
      if (!s.armed || s.armed.scene !== armScene || s.armed.logo !== logo) {
        this.log('armed', `drop_soon=${a.drop_soon.noul.toFixed(2)} → armed "${armScene}"${logo ? ' + ロゴ' : ''} (12小節有効, kime_on_drop ${a.kime_on_drop.noul.toFixed(2)})`);
      }
      s.armed = { scene: armScene, decidedAt: performance.now(), untilBar: bar + 12, logo };
    }

    // resolution: what is on the table, and does the policy carry it?
    const age = bar - this.sceneStartBar;
    const maxAge = s.scene.maxBars ?? 32;
    const switchVotes = d.units.filter((u) => u.proposal !== null && u.proposal !== 'keep').length;
    const majoritySwitch = switchVotes * 2 > d.units.length;
    let target: SceneId | null = null;
    if (a.scene.choice !== s.scene.id && (majoritySwitch || a.switch_now.noul >= 0.5 || (age >= 16 && a.switch_now.noul >= 0.3) || age >= maxAge || a.scene.probabilities[a.scene.choice] >= 0.7)) {
      target = a.scene.choice;
    } else if (a.scene.choice === s.scene.id && (a.switch_now.noul >= 0.7 || age >= maxAge)) {
      const runner = (Object.entries(a.scene.probabilities) as [SceneId, number][])
        .filter(([id]) => id !== s.scene.id)
        .sort((x, y) => y[1] - x[1])[0];
      if (runner && runner[1] >= 0.15) target = runner[0];
    }
    const blocked = bar < this.holdUntilBar || age < 2 || s.transition !== null;
    d.proposal = target ?? 'keep';
    for (const u of d.units) {
      if (u.proposal === null) u.stance = 'none';
      else if (d.proposal === 'keep') u.stance = u.proposal === 'keep' ? 'for' : 'against';
      else u.stance = u.proposal === d.proposal ? 'for' : 'against';
    }
    d.decidedAt = performance.now();
    const forCount = d.units.filter((u) => u.stance === 'for').length;
    if (target && !blocked) {
      const kind: TransitionId = reason === 'change:drop' ? 'cut' : a.transition.choice;
      d.outcome = 'approved';
      d.transition = kind;
      d.note = `${kind} → ${SCENE_BY_ID[target].name}`;
      this.log('approved', `可決 ${kind} → ${SCENE_BY_ID[target].name}  賛成 ${forCount}/${d.units.length}  (${a.phase.choice}, switch ${a.switch_now.noul.toFixed(2)}, age ${age})`);
      this.switchTo(target, kind, `${a.phase.choice}, votes ${switchVotes}/${d.units.length}, switch_now=${a.switch_now.noul.toFixed(2)}, age=${age}`, bar);
    } else if (target && blocked) {
      d.outcome = 'rejected';
      d.note = bar < this.holdUntilBar ? 'ホールド中' : s.transition ? '切替中' : '直前に切替済み';
      this.log('rejected', `否決 ${SCENE_BY_ID[target].name} への切替  賛成 ${forCount}/${d.units.length}  理由: ${d.note}`);
    } else if (switchVotes > 0) {
      d.outcome = 'keep';
      d.note = `${switchVotes}/${d.units.length} が切替を提案、否決`;
      this.log('rejected', `否決 切替提案 ${switchVotes}/${d.units.length}（${d.units.filter((u) => u.proposal && u.proposal !== 'keep').map((u) => `${u.unit.name}:${u.proposal}`).join(', ')}）→ ${s.scene.name} を維持`);
    } else {
      d.outcome = 'keep';
      d.note = '全員一致で維持';
      this.log('keep', `維持 ${s.scene.name}  全員一致 (age ${age})`);
    }

    // settled music (drop / steady, nobody wants to move, no drop coming): ask half as often
    const settled = (a.phase.choice === 'drop' || a.phase.choice === 'steady') && a.switch_now.noul < 0.3 && a.drop_soon.noul < 0.3 && !s.armed;
    s.nextIntervalBars = settled ? Math.max(s.intervalBars, 4) : s.intervalBars;

    // 決め場: the logo goes up when the council agrees this is the peak
    const kimeVotes = d.units.filter((u) => u.result && u.result.answers.kime.noul >= 0.5).length;
    if (!s.logo.active && bar >= s.logo.cooldownUntilBar && (a.kime.noul >= 0.6 || (kimeVotes * 2 > d.units.length && a.kime.noul >= 0.5))) {
      this.showLogo(bar, `kime ${a.kime.noul.toFixed(2)}, ${kimeVotes}/${d.units.length} が決め場と判断`);
    } else if (s.logo.active && s.logo.source === 'jev' && a.kime.noul < 0.25 && bar - (s.logo.untilBar - LOGO_BARS) >= 2) {
      this.log('info', `決め場終了の判断 (kime ${a.kime.noul.toFixed(2)})`);
      this.hideLogo(bar);
    }
  }

  switchTo(id: SceneId, kind: TransitionId, why: string, bar: number): void {
    const s = this.state;
    const to = SCENE_BY_ID[id];
    if (to.id === s.scene.id) return;
    this.previousScenes.push(s.scene.id);
    if (this.previousScenes.length > 8) this.previousScenes.shift();
    this.lastSwitchReason = why;
    this.sceneStartBar = bar;
    if (kind === 'cut') {
      s.scene = to;
      s.transition = null;
    } else if (kind === 'flash') {
      s.flash = 1;
      s.scene = to;
      s.transition = null;
    } else {
      s.transition = { to, kind: 'crossfade', progress: 0 };
    }
    this.log('switch', `${kind} → ${to.name} (${why})`);
  }

  /** Per-frame easing of intensity, palette, transitions, flash. */
  tick(dt: number): void {
    const s = this.state;
    s.intensity += (this.targetIntensity - s.intensity) * Math.min(1, dt * 1.5);
    if (this.paletteT < 1) {
      this.paletteT = Math.min(1, this.paletteT + dt / Math.max(0.5, this.barDuration));
      const to = PALETTES[this.targetPalette];
      s.palette = {
        bg: lerpColor(this.paletteFrom.bg, to.bg, this.paletteT),
        a: lerpColor(this.paletteFrom.a, to.a, this.paletteT),
        b: lerpColor(this.paletteFrom.b, to.b, this.paletteT),
        c: lerpColor(this.paletteFrom.c, to.c, this.paletteT),
      };
      if (this.paletteT >= 1) s.paletteId = this.targetPalette;
    }
    if (s.transition) {
      s.transition.progress += dt / this.barDuration;
      if (s.transition.progress >= 1) {
        s.scene = s.transition.to;
        s.transition = null;
      }
    }
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 6);
  }
}

export type { UnitId };
