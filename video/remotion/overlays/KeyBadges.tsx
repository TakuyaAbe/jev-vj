import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {AppStep} from '../data';
import {msToFrames} from '../data';
import {CAPTURE_HEIGHT, COLORS, FONT_FAMILY, MONO_FAMILY, VIDEO_WIDTH} from '../theme';

const HOLD_FRAMES = 42;
const EXIT_FRAMES = 10;
const CAP = 96;

const display = (key: string) => (key.length === 1 ? key.toUpperCase() : key);

/**
 * A keycap that pops in at the top centre of the stage whenever the capture
 * pressed a key (h / l / m / digits), so the viewer sees which key did it.
 */
export const KeyBadges: React.FC<{steps: AppStep[]}> = ({steps}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {steps.flatMap((step) =>
        step.keys.map((k, i) => {
          const local = frame - msToFrames(k.atMs, fps);
          if (local < 0 || local > HOLD_FRAMES + EXIT_FRAMES) {
            return null;
          }
          const pop = spring({frame: local, fps, config: {damping: 12, stiffness: 190}});
          const exit = interpolate(local, [HOLD_FRAMES, HOLD_FRAMES + EXIT_FRAMES], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={`${step.id}-${i}`}
              style={{
                position: 'absolute',
                left: VIDEO_WIDTH / 2 - 110,
                top: Math.round(CAPTURE_HEIGHT * 0.06),
                width: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                opacity: Math.min(pop, exit),
                scale: String(0.8 + 0.2 * pop),
                transformOrigin: '50% 0%',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: CAP,
                  height: CAP,
                  boxSizing: 'border-box',
                  borderRadius: 18,
                  backgroundColor: 'rgba(12,14,20,0.94)',
                  border: `3px solid ${COLORS.mint}`,
                  boxShadow: `0 10px 0 rgba(124,242,196,0.35), 0 18px 40px rgba(0,0,0,0.55)`,
                  color: COLORS.mint,
                  fontFamily: MONO_FAMILY,
                  fontSize: 46,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {display(k.key)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  padding: '4px 14px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(12,14,20,0.85)',
                  color: COLORS.mint,
                  fontFamily: FONT_FAMILY,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                キー
              </div>
            </div>
          );
        }),
      )}
    </>
  );
};
