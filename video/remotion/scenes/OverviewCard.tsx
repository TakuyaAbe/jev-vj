import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {HowtoData} from '../data';
import {Narration} from '../Narration';
import {COLORS, MONO_FAMILY} from '../theme';
import {Glow} from './Glow';

type Box = {x: number; y: number; w: number; h: number};

const SOURCE: Box = {x: 110, y: 420, w: 330, h: 330};
const DSP: Box = {x: 520, y: 470, w: 330, h: 230};
const RENDER: Box = {x: 950, y: 250, w: 470, h: 190};
const MAGI: Box = {x: 950, y: 500, w: 560, h: 320};
const DECIDE: Box = {x: 1590, y: 500, w: 290, h: 320};

const UNITS = [
  {name: 'MELCHIOR', n: 1, role: '科学者', hint: '数値と展開の整合'},
  {name: 'BALTHASAR', n: 2, role: '母', hint: 'フロアの疲れと流れ'},
  {name: 'CASPER', n: 3, role: '女', hint: '直感 · 意外性 · GLSL'},
];

const Node: React.FC<{box: Box; progress: number; accent?: string; children: React.ReactNode}> = ({box, progress, accent = COLORS.mint, children}) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      boxSizing: 'border-box',
      padding: '20px 24px',
      borderRadius: 18,
      backgroundColor: 'rgba(18,20,29,0.92)',
      border: `2px solid ${accent}`,
      boxShadow: `0 16px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03) inset`,
      opacity: progress,
      translate: `0px ${(1 - progress) * 26}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      color: COLORS.white,
    }}
  >
    {children}
  </div>
);

const Head: React.FC<{color?: string; children: React.ReactNode}> = ({color = COLORS.mint, children}) => (
  <div style={{color, fontSize: 30, fontWeight: 700, letterSpacing: 1, lineHeight: 1.15}}>{children}</div>
);
const Sub: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{color: 'rgba(255,255,255,0.8)', fontSize: 24, lineHeight: 1.4}}>{children}</div>
);
const Chip: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{padding: '6px 14px', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', border: `1px solid ${COLORS.line}`, fontFamily: MONO_FAMILY, fontSize: 21, color: COLORS.fg, whiteSpace: 'nowrap'}}>
    {children}
  </div>
);

/** Arrow with an optional caption, drawn (pathLength) with `progress`. */
const Arrow: React.FC<{d: string; progress: number; label?: string; lx?: number; ly?: number}> = ({d, progress, label, lx = 0, ly = 0}) => (
  <>
    <path d={d} pathLength={1} fill="none" stroke={COLORS.mint} strokeWidth={5} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - progress} markerEnd="url(#arrowhead)" opacity={0.9} />
    {label ? (
      <text x={lx} y={ly} fill={COLORS.orange} fontSize={24} fontWeight={700} textAnchor="middle" opacity={progress}>
        {label}
      </text>
    ) : null}
  </>
);

export const OverviewCard: React.FC<{data: HowtoData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {layout} = data;
  const enter = (delay: number) => spring({frame, fps, delay, config: {damping: 200}});
  const draw = (delay: number) =>
    interpolate(frame, [delay, delay + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const heading = enter(4);
  const nSource = enter(14);
  const nDsp = enter(30);
  const nRender = enter(50);
  const nMagi = enter(64);
  const nDecide = enter(96);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <Glow x={70} y={70} strength={0.7} />
      <div style={{position: 'absolute', left: 110, top: 70, opacity: heading, translate: `0px ${(1 - heading) * 24}px`}}>
        <div style={{color: COLORS.white, fontSize: 64, fontWeight: 700, lineHeight: 1.1}}>仕組み</div>
        <div style={{marginTop: 12, color: COLORS.dim, fontSize: 30, lineHeight: 1.4}}>
          フレーム単位の反応はコード、小節単位の「意味」の判断は TypeSafe の Jev
        </div>
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.mint} />
          </marker>
        </defs>
        <Arrow d={`M ${SOURCE.x + SOURCE.w} 585 L ${DSP.x - 4} 585`} progress={draw(24)} />
        <Arrow d={`M ${DSP.x + DSP.w} 540 C 910 540, 890 345, ${RENDER.x - 4} 345`} progress={draw(42)} label="毎フレーム" lx={790} ly={440} />
        <Arrow d={`M ${DSP.x + DSP.w} 630 C 910 630, 890 660, ${MAGI.x - 4} 660`} progress={draw(58)} label="数小節ごと" lx={790} ly={740} />
        <Arrow d={`M ${MAGI.x + MAGI.w} 660 L ${DECIDE.x - 4} 660`} progress={draw(90)} label="合議" lx={1550} ly={630} />
      </svg>

      <Node box={SOURCE} progress={nSource}>
        <Head>音源</Head>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <Chip>Demo track</Chip>
          <Chip>Tracks · Audio file</Chip>
          <Chip>Mic / line-in</Chip>
          <Chip>System audio</Chip>
        </div>
      </Node>

      <Node box={DSP} progress={nDsp}>
        <Head>DSP</Head>
        <Sub>ビート · 小節 · BPM</Sub>
        <Sub>帯域レベル · オンセット</Sub>
        <Sub>ドロップ / カット検知</Sub>
      </Node>

      <Node box={RENDER} progress={nRender}>
        <Head>映像（毎フレーム）</Head>
        <Sub>ビートで脈動 · 低域で歪む · 波形</Sub>
        <Sub>17 シーン（2D / GLSL / three.js）</Sub>
      </Node>

      <Node box={MAGI} progress={nMagi} accent={COLORS.orange}>
        <Head color={COLORS.orange}>MAGI — Jev × 3（数小節ごと）</Head>
        <div style={{display: 'flex', gap: 12, marginTop: 4}}>
          {UNITS.map((u, i) => {
            const p = spring({frame, fps, delay: 72 + i * 6, config: {damping: 200}});
            return (
              <div
                key={u.name}
                style={{
                  flex: 1,
                  boxSizing: 'border-box',
                  padding: '12px 12px',
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,154,31,0.08)',
                  border: `1px solid rgba(255,154,31,0.5)`,
                  opacity: p,
                  translate: `0px ${(1 - p) * 14}px`,
                }}
              >
                <div style={{fontFamily: MONO_FAMILY, color: COLORS.orange, fontSize: 19, fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap'}}>
                  {u.name}·{u.n}
                </div>
                <div style={{color: COLORS.white, fontSize: 30, fontWeight: 700, marginTop: 4}}>{u.role}</div>
                <div style={{color: 'rgba(255,255,255,0.72)', fontSize: 19, lineHeight: 1.35, marginTop: 4}}>{u.hint}</div>
              </div>
            );
          })}
        </div>
        <Sub>同じ状態を「立場」だけ変えて並列に質問 → 多数決 / 平均</Sub>
      </Node>

      <Node box={DECIDE} progress={nDecide}>
        <Head>決定</Head>
        <Sub>次のシーン · 切替</Sub>
        <Sub>激しさ · 色調</Sub>
        <Sub>ドロップの先読み</Sub>
        <Sub>決め場 → ロゴ</Sub>
      </Node>

      <Narration id="overview" from={layout.narrationDelayFrames} data={data} />
    </AbsoluteFill>
  );
};
