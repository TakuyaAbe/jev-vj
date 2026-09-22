import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {HowtoData} from '../data';
import {Narration} from '../Narration';
import {COLORS, MONO_FAMILY} from '../theme';
import {Glow} from './Glow';

/** Faint CLI-style texture behind the title, echoing the app's stage log. */
const FAKE_LOG = [
  'bar  40  ●●●●  ▃▅▇▆  128.1bpm  e0.82 sub0.74 bf0.55 lm0.61 mid0.22 hi0.09  on12  trend +0.031',
  'MAGI #17 bar 41 :: 審議開始 [interval] units=3 候補=17',
  '  入力 :: 音圧 0.81 (相対 0.98)  層[キック、ベースライン、ハイハット/高域]  傾向 e↑ bass→ hi↑ on↑ | scene=tunnel age=12',
  'MELCHIOR-1   維持       switch 0.21  drop      int 3.2  drop 0.12  kime 0.44  318ms',
  'BALTHASAR-2  維持       switch 0.18  drop      int 2.9  drop 0.10  kime 0.51  322ms',
  'CASPER-3     STROBE     switch 0.62  drop      int 3.6  drop 0.15  kime 0.66  340ms',
  '合議 :: drop(0.71) scene=tunnel(0.48) switch=0.34 int=3.2 pal=neon drop_soon=0.12 kime=0.54 next+4',
  '▶ 維持  Tunnel  切替提案 1/3 (CASPER:strobe) → Tunnel を維持 (age 12)',
  'bar  41  ●●●●  ▅▆▇▇  128.1bpm  e0.84 sub0.76 bf0.57 lm0.60 mid0.24 hi0.11  on14  trend +0.018',
  'magi@bakurocho:~$ ●○○○ bar 42 · 128bpm ▮▮▮▮▯ · tunnel int0.80 neon · drop · MAGI… █',
];

export const TitleCard: React.FC<{data: HowtoData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {meta} = data.script;
  const {layout} = data;

  const enter = (delay: number) => spring({frame, fps, delay, config: {damping: 200}});
  const title = enter(8);
  const accent = enter(16);
  const subtitle = enter(20);
  const caption = enter(34);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: interpolate(frame, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      }}
    >
      <Glow />
      <AbsoluteFill
        style={{
          padding: '60px 70px',
          fontFamily: MONO_FAMILY,
          fontSize: 20,
          lineHeight: '30px',
          color: COLORS.mint,
          opacity: 0.16,
          whiteSpace: 'pre',
          overflow: 'hidden',
          justifyContent: 'flex-end',
        }}
      >
        {FAKE_LOG.map((line, i) => (
          <div
            key={i}
            style={{
              opacity: interpolate(frame, [i * 3, i * 3 + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            {line}
          </div>
        ))}
      </AbsoluteFill>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: 1600,
          padding: '0 80px',
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: 2,
            lineHeight: 1.1,
            opacity: title,
            translate: `0px ${(1 - title) * 60}px`,
            textShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          {meta.title}
        </div>
        <div
          style={{
            width: 240,
            height: 8,
            borderRadius: 4,
            marginTop: 30,
            background: `linear-gradient(90deg, ${COLORS.mint}, ${COLORS.orange})`,
            scale: `${accent} 1`,
            opacity: accent,
          }}
        />
        <div
          style={{
            marginTop: 34,
            fontSize: 44,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.5,
            opacity: subtitle,
            translate: `0px ${(1 - subtitle) * 40}px`,
          }}
        >
          {meta.subtitle}
        </div>
        <div
          style={{
            marginTop: 60,
            fontSize: 28,
            letterSpacing: 1,
            color: COLORS.dim,
            opacity: caption,
            translate: `0px ${(1 - caption) * 24}px`,
          }}
        >
          {meta.caption}
        </div>
      </div>
      <Narration id="title" from={layout.narrationDelayFrames} data={data} />
    </AbsoluteFill>
  );
};
