import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {HowtoData} from '../data';
import {Narration} from '../Narration';
import {COLORS, MONO_FAMILY} from '../theme';
import {Glow} from './Glow';

const Keycap: React.FC<{text: string; small?: boolean}> = ({text, small}) => (
  <div
    style={{
      minWidth: 104,
      height: 104,
      boxSizing: 'border-box',
      padding: '0 18px',
      borderRadius: 20,
      backgroundColor: 'rgba(12,14,20,0.96)',
      border: `3px solid ${COLORS.mint}`,
      boxShadow: '0 10px 0 rgba(124,242,196,0.35), 0 18px 40px rgba(0,0,0,0.5)',
      color: COLORS.mint,
      fontFamily: MONO_FAMILY,
      fontSize: small ? 34 : 52,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

export const KeysCard: React.FC<{data: HowtoData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {layout} = data;
  const items = data.script.cards.keys.items;
  const heading = spring({frame, fps, delay: 4, config: {damping: 200}});

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center'}}>
      <Glow x={30} y={30} strength={0.7} />
      <div style={{position: 'relative', width: 1400, display: 'flex', flexDirection: 'column', gap: 26}}>
        <div style={{color: COLORS.white, fontSize: 72, fontWeight: 700, marginBottom: 18, opacity: heading, translate: `0px ${(1 - heading) * 30}px`}}>
          キーボード早見
        </div>
        {items.map((item, i) => {
          const p = spring({frame, fps, delay: 14 + i * 9, config: {damping: 200}});
          const caps = item.key.split(',').map((k) => k.trim());
          return (
            <div key={item.key} style={{display: 'flex', alignItems: 'center', gap: 40, opacity: p, translate: `${(1 - p) * -40}px 0px`}}>
              <div style={{display: 'flex', gap: 14, width: 330, justifyContent: 'flex-end', flexShrink: 0}}>
                {caps.map((c) => (
                  <Keycap key={c} text={c.length === 1 ? c.toUpperCase() : c} small={c.length > 1} />
                ))}
              </div>
              <div style={{color: COLORS.white, fontSize: 42, fontWeight: 400, lineHeight: 1.3}}>{item.label}</div>
            </div>
          );
        })}
      </div>
      <Narration id="keys" from={layout.narrationDelayFrames} data={data} />
    </AbsoluteFill>
  );
};
