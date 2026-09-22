import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {HowtoData} from '../data';
import {Narration} from '../Narration';
import {COLORS, MONO_FAMILY} from '../theme';
import {Glow} from './Glow';

export const OutroCard: React.FC<{data: HowtoData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {meta} = data.script;
  const {layout} = data;
  const enter = (delay: number) => spring({frame, fps, delay, config: {damping: 200}});
  const heading = enter(6);
  const card = enter(16);
  const note = enter(28);
  const brand = enter(40);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center'}}>
      <Glow x={50} y={62} strength={0.8} />
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
        <div style={{color: COLORS.white, fontSize: 80, fontWeight: 700, opacity: heading, translate: `0px ${(1 - heading) * 40}px`}}>公開版</div>
        <div
          style={{
            boxSizing: 'border-box',
            padding: '34px 70px',
            borderRadius: 26,
            backgroundColor: COLORS.white,
            boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            opacity: card,
            translate: `0px ${(1 - card) * 40}px`,
          }}
        >
          <div style={{fontFamily: MONO_FAMILY, fontSize: 66, fontWeight: 700, color: COLORS.bg, whiteSpace: 'nowrap', letterSpacing: 0.5}}>
            {meta.publicUrl}
          </div>
        </div>
        {meta.publicNote ? (
          <div style={{color: 'rgba(255,255,255,0.8)', fontSize: 34, opacity: note, translate: `0px ${(1 - note) * 24}px`}}>{meta.publicNote}</div>
        ) : null}
        <div
          style={{
            marginTop: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            opacity: brand,
            translate: `0px ${(1 - brand) * 20}px`,
          }}
        >
          <div style={{width: 200, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${COLORS.mint}, ${COLORS.orange})`}} />
          <div style={{color: COLORS.dim, fontSize: 30, letterSpacing: 1, marginTop: 10}}>{meta.subtitle}</div>
        </div>
      </div>
      <Narration id="outro" from={layout.narrationDelayFrames} data={data} />
    </AbsoluteFill>
  );
};
