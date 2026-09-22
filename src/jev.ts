import type { BarAggregator } from './features';
import type { PaletteId, PhaseId, Scene, SceneId, TransitionId } from './types';

export interface ChoiceAnswer<T extends string = string> {
  type: 'choice';
  choice: T;
  confidence: number;
  probabilities: Record<T, number>;
}
export interface NoulAnswer {
  type: 'noul';
  noul: number;
}
export interface ScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface JevAnswers {
  phase: ChoiceAnswer<PhaseId>;
  drop_soon: NoulAnswer;
  switch_now: NoulAnswer;
  scene: ChoiceAnswer<SceneId>;
  /** speculative scene for the drop (only asked when a drop is plausible) */
  drop_scene?: ChoiceAnswer<SceneId>;
  intensity: ScoreAnswer;
  palette: ChoiceAnswer<PaletteId>;
  transition: ChoiceAnswer<TransitionId>;
  /** is this the 決め場: the peak moment that deserves the club logo */
  kime: NoulAnswer;
  /** speculative: if the drop lands within 8 bars, is that moment the 決め場 (only asked when a drop is plausible) */
  kime_on_drop?: NoulAnswer;
}

export interface JevResult {
  answers: JevAnswers;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  latencyMs: number;
  upstreamMs: number | null;
  state: unknown;
}

export type UnitId = 'melchior' | 'balthasar' | 'casper';

/** One of the three MAGI judges: the same Jev model, a different stance. */
export interface Unit {
  id: UnitId;
  name: string;
  number: 1 | 2 | 3;
  /** short label shown in the header bar */
  role: string;
  /** sent to Jev as `judge.stance` */
  stance: string;
  /** appended to the scene question */
  sceneHint: string;
  /** appended to the switch_now question */
  switchHint: string;
}

export const UNITS: Unit[] = [
  {
    id: 'melchior',
    name: 'MELCHIOR',
    number: 1,
    role: '科学者',
    stance:
      '科学者としての判断。数値と曲の展開の整合を最優先し、セクションの性格に論理的に合うシーンを選ぶ。切り替えは根拠が明確なときだけ。感情や勢いでは動かない',
    sceneHint: 'セクションの性格と数値の傾向に最も整合するものを選ぶ',
    switchHint: '展開の変化が数値に表れているときだけ true。曖昧なら維持',
  },
  {
    id: 'balthasar',
    name: 'BALTHASAR',
    number: 2,
    role: '母',
    stance:
      '母としての判断。フロアにいる人の疲れと流れを気遣う。目に優しく、連続性を壊さない演出を好む。同じシーンが長すぎるのも、頻繁な切り替えも避ける。ストロボのような強い刺激は短く',
    sceneHint: '流れを壊さず、目が疲れないものを選ぶ。強い刺激は短時間に留める',
    switchHint: '観客の疲れと流れを優先。同じシーンが長く続いて飽きが出そうなら true、直前に切り替えたばかりなら false',
  },
  {
    id: 'casper',
    name: 'CASPER',
    number: 3,
    role: '女',
    stance:
      '直感と美意識で判断する。コントラストとドラマを求め、意外性のある選択や新しい表現（GLSL・three.js のシーン）を積極的に試す。退屈を最も嫌い、迷ったら動く',
    sceneHint: 'コントラストとドラマを優先し、意外性のある選択や GLSL・three.js のシーンを積極的に選ぶ',
    switchHint: '退屈を最も嫌う。今の音に対してより映える選択があるなら迷わず true',
  },
];

export const UNIT_BY_ID: Record<UnitId, Unit> = Object.fromEntries(UNITS.map((u) => [u.id, u])) as Record<UnitId, Unit>;

export interface SetContext {
  elapsedSec: number;
  bpm: number;
  bar: number;
  currentScene: SceneId;
  sceneAgeBars: number;
  previousScenes: SceneId[];
  lastPhase: PhaseId | null;
  lastSwitchReason: string | null;
  userContext: string;
}

/**
 * Short criteria for the scene questions. The full `Scene.description` is what
 * a human reads; Jev gets ~30 characters per option so the two scene questions
 * stay around 500 tokens instead of 2,500.
 */
export const SCENE_SHORT: Partial<Record<SceneId, string>> = {
  particles: '粒子。中程度。安定した進行・グルーヴ',
  tunnel: 'トンネル前進。高揚感。ビルド・ドロップ',
  grid: '格子が脈動。硬質ミニマル。テクノの安定進行',
  strobe: '白黒ストロボ。最大エネルギーのドロップ専用。短時間',
  kaleido: '万華鏡。浮遊感。ブレイクダウン・イントロ',
  waves: '波形リボン。柔らかい。メロディ・緩やかな展開',
  warp: '流体の煙（GLSL）。サイケ。ディープ・ブレイクダウン',
  lattice: '無限3D格子を突進（GLSL）。ビルド・ドロップ',
  julia: 'フラクタル（GLSL）。催眠的。安定進行・ディープ',
  voronoi: 'セルがビートで点灯（GLSL）。デジタル。テクノ・ドロップ',
  galaxy: '銀河の粒子（3D）。壮大・浮遊。盛り上がりの入口',
  terrain: '波形の地形と太陽（3D）。シンセウェーブ。中程度',
  hina_petals: 'ひな祭り: 桃の花びら。柔らか。春・中程度まで',
  hina_dan: 'ひな祭り: 七段飾り2D。象徴的。見せ場・決め場',
  hina_mochi: 'ひな祭り: 菱餅タイル（GLSL）。ポップ。ドロップ・安定',
  seigaiha: 'ひな祭り: 青海波（GLSL）。和・静か。イントロ・ブレイク',
  hina_dan3d: 'ひな祭り: 七段飾り3D、カメラ回り込み。見せ場・決め場',
};

export const shortDescription = (sc: Scene): string => sc.short ?? SCENE_SHORT[sc.id] ?? sc.description.split('。')[0]!;

export const PALETTE_DESCRIPTIONS: Record<PaletteId, string> = {
  warm: '赤〜オレンジ〜琥珀の暖色。熱気、ピーク',
  cold: '青〜シアン〜白の寒色。深い、クール、浮遊',
  neon: 'ピンクと緑のネオン。派手、遊び',
  mono: '白黒。硬質、ミニマル、緊張感',
  acid: '黄緑とオレンジ。アシッド、歪み、攻撃的',
  hina: 'ひな祭り。桃色・若草色・白に金。春らしく華やかで柔らかい',
};

const INTENSITY_LEVELS = ['静止に近い（ブレイク・イントロ）', '控えめ', '中程度。ビートごとに動く', '激しい。速く強い明滅', '最大。ストロボ級（ドロップのピーク）'];

const fmt = (x: number): string => x.toFixed(2);

export function buildState(agg: BarAggregator, set: SetContext, scenes: Scene[], unit?: Unit): Record<string, unknown> {
  const h = agg.history;
  const last = h[h.length - 1];
  const peakE = agg.peakEnergy || 1;
  const peakB = agg.peakBass || 1;
  const rel = (v: number, peak: number): number => Math.min(1.2, v / peak);
  const slope = agg.trend(8) / peakE;
  const trendWord = slope > 0.02 ? '上昇中' : slope < -0.02 ? '下降中' : 'ほぼ一定';
  const word = (v: number, up: number): string => (v > up ? `上昇（${v >= 0 ? '+' : ''}${fmt(v)}/小節）` : v < -up ? `下降（${fmt(v)}/小節）` : '一定');
  const trends4 = {
    energy: word(agg.trend(4) / peakE, 0.03),
    bass: word(agg.trend(4, 'bass') / peakB, 0.03),
    high: word(agg.trend(4, 'high'), 0.03),
    onsets: word(agg.trend(4, 'onsets'), 0.8),
    brightness: word(agg.trend(4, 'centroid') / 1000, 0.15),
  };
  const layers = last
    ? [
        last.sub > 0.45 ? 'キック' : null,
        last.bassFloor > 0.3 ? 'ベースライン（低域が持続）' : null,
        last.lowmid > 0.35 || last.mid > 0.35 ? '中域（メロディ/コード/リード）' : null,
        last.high > 0.25 ? 'ハイハット/高域' : null,
      ].filter((x): x is string => x !== null)
    : [];
  const barLines = h.slice(-8).map((b) =>
    `bar${b.bar} e${fmt(rel(b.energy, peakE))} sub${fmt(b.sub)} bf${fmt(b.bassFloor)} lm${fmt(b.lowmid)} m${fmt(b.mid)} h${fmt(b.high)} on${b.onsets}`,
  );
  const brightness = last ? (last.centroid > 2500 ? '明るい' : last.centroid > 1200 ? '中間' : '暗い') : '不明';
  const mm = Math.floor(set.elapsedSec / 60);
  const ss = Math.floor(set.elapsedSec % 60);
  return {
    role: 'クラブのVJ（映像演出）。音声解析の数値から曲の展開を読み、次の数小節の映像を決める判断材料',
    judge: unit ? { name: `${unit.name}-${unit.number}（${unit.role}）`, stance: unit.stance } : undefined,
    context: set.userContext || '（ジャンル・雰囲気の指定なし）',
    legend: 'recent_bars: e=音圧(セット最大=1) sub=キック帯域 bf=低域の持続(ベースライン) lm/m/h=低中/中/高域(0〜1) on=小節内アタック数',
    now: {
      bpm: Math.round(set.bpm),
      bar: set.bar,
      loudness_absolute: last ? `${fmt(last.rawRms)}（固定スケール。0.5前後=控えめ、0.8以上=フル）` : '不明',
      layers_active: layers.length ? layers.join('、') : 'ほぼ無音',
      trends_4bars: trends4,
      energy_trend_8bars: `${trendWord}（1小節あたり${slope >= 0 ? '+' : ''}${fmt(slope)}）`,
      energy_relative: last ? `${fmt(rel(last.energy, peakE))}（このセットでの最大音量を1とした相対値。序盤は基準が未確定）` : '不明',
      bass: last ? `${fmt(rel(last.bass, peakB))}（相対値）` : '不明',
      mid: last ? fmt(last.mid) : '不明',
      high: last ? fmt(last.high) : '不明',
      brightness,
      onsets_per_bar: last ? last.onsets : 0,
    },
    recent_bars: barLines,
    set: {
      elapsed: `${mm}分${ss.toString().padStart(2, '0')}秒`,
      current_scene: set.currentScene,
      scene_age_bars: set.sceneAgeBars,
      previous_scenes: set.previousScenes.slice(-4),
      last_phase_judgement: set.lastPhase ?? 'なし',
      last_switch_reason: set.lastSwitchReason ?? 'なし',
      note:
        h.length < 16
          ? 'まだ小節数が少なく、相対値の基準（最大）が確定していない。今が曲の序盤である可能性を考慮する'
          : undefined,
    },
    scene_ids: scenes.map((sc) => sc.id),
  };
}

export interface QuestionOptions {
  /** include the speculative drop questions (drop_scene, kime_on_drop) */
  askDrop: boolean;
}

export function buildQuestions(scenes: Scene[], unit?: Unit, opts: QuestionOptions = { askDrop: true }): Record<string, unknown> {
  const sceneCriteria = Object.fromEntries(scenes.map((sc) => [sc.id, shortDescription(sc)]));
  const judge = unit ? `\`judge.stance\` の立場で判断する。${unit.sceneHint}。` : '';
  const judgeSwitch = unit ? `\`judge.stance\` の立場で判断する。${unit.switchHint}。` : '';
  return {
    phase: {
      type: 'choice',
      instructions: '`now` と `recent_bars` の推移から、曲は今どのセクションにいるか',
      criteria: {
        intro: '導入。キックなど少数の要素のみ、ベース・中高域が薄い（序盤は相対音圧が高くてもこちら）',
        build: 'ビルドアップ。高域・アタック数・明るさが数小節かけて上がり続けている',
        drop: 'ドロップ。キック・持続ベース・中高域が揃い、エネルギーが最大付近で安定',
        breakdown: 'ブレイクダウン。キックや低域が抜け、エネルギーが大きく落ちた',
        steady: '大きな変化のない中程度の進行',
        outro: '終わり。要素が減っていく',
      },
    },
    drop_soon: {
      type: 'noul',
      instructions: '次の8小節以内にドロップ（低域とエネルギーの急上昇）が来るか',
      criteria: { true: 'ビルドの兆候があり、まもなく来る', false: '兆候なし、または既にドロップ中' },
    },
    switch_now: {
      type: 'noul',
      instructions: `${judgeSwitch}今、映像シーンを \`set.current_scene\` から切り替えるべきか。展開が変わった直後や同じシーンが16小節以上続くときは自然。頻繁すぎる切替は避ける`,
      criteria: { true: '切り替える。展開が変わった／今の音に合っていない', false: '維持する。今の音に合っている' },
    },
    scene: {
      type: 'choice',
      instructions: `${judge}次の数小節に最も合う映像シーン。\`set.current_scene\` のままでもよい。\`set.previous_scenes\` の連発は避ける`,
      criteria: sceneCriteria,
    },
    ...(opts.askDrop
      ? {
          drop_scene: {
            type: 'choice',
            instructions: 'もし次の8小節以内にドロップが来たら、その瞬間に切り替えるシーン（先読み）',
            criteria: sceneCriteria,
          },
        }
      : {}),
    intensity: {
      type: 'score',
      instructions: '次の数小節の映像の激しさ',
      criteria: INTENSITY_LEVELS,
    },
    palette: {
      type: 'choice',
      instructions: '次の数小節の色調。曲の状況と `context` を考慮する',
      criteria: PALETTE_DESCRIPTIONS,
    },
    kime: {
      type: 'noul',
      instructions: '今が「決め場」か。クラブ名ロゴを全面に出すのにふさわしい曲の最高潮か。ロゴは一晩に何度も出さず、出せば決まる場面だけ',
      criteria: { true: 'ドロップの頭や最大エネルギーで、フロアが最も盛り上がる一番いいところ', false: '序盤・ビルド途中・ブレイクダウン・平常時。出すと興ざめ' },
    },
    ...(opts.askDrop
      ? {
          kime_on_drop: {
            type: 'noul',
            instructions: 'もし次の8小節以内にドロップが来たら、その瞬間はロゴを出すべき決め場か（先読み）',
            criteria: { true: 'ビルドが十分溜まっていて、来るドロップは山場', false: '小さな変化に過ぎない／山場は過ぎた' },
          },
        }
      : {}),
    transition: {
      type: 'choice',
      instructions: 'シーンを切り替える場合の切り替え方',
      criteria: { cut: '瞬時。ドロップや明確な切れ目', crossfade: '1小節で溶かす。緩やかな変化', flash: '白く光って切替。ビルドの頂点' },
    },
  };
}

export async function callJev(state: unknown, questions: unknown, signal?: AbortSignal): Promise<JevResult> {
  const t0 = performance.now();
  const res = await fetch('/api/jev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, questions }),
    signal,
  });
  const latencyMs = performance.now() - t0;
  const upstream = res.headers.get('X-Jev-Upstream-Ms');
  const json = (await res.json()) as {
    error?: string;
    model?: string;
    answers?: JevAnswers;
    usage?: { input_tokens: number; output_tokens: number };
  };
  if (!res.ok || !json.answers) {
    throw new Error(json.error ?? `Jev HTTP ${res.status}`);
  }
  return {
    answers: json.answers,
    usage: json.usage ?? { input_tokens: 0, output_tokens: 0 },
    model: json.model ?? 'jev',
    latencyMs,
    upstreamMs: upstream ? Number(upstream) : null,
    state,
  };
}
