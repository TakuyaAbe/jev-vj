import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {AppStep} from '../data';
import {msToFrames} from '../data';
import {COLORS} from '../theme';

const RING_SECONDS = 0.6;
const RING_DELAY_FRAMES = 5;
const MIN_DIAMETER = 26;
const MAX_DIAMETER = 140;

/** Two expanding orange rings centred on each click box, starting at atMs. */
export const ClickRings: React.FC<{steps: AppStep[]}> = ({steps}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ringFrames = Math.round(RING_SECONDS * fps);

  return (
    <>
      {steps.flatMap((step) =>
        step.clicks.map((click, ci) => {
          const local = frame - msToFrames(click.atMs, fps);
          if (local < 0 || local > ringFrames + RING_DELAY_FRAMES) {
            return null;
          }
          const cx = click.x + click.w / 2;
          const cy = click.y + click.h / 2;
          return [0, 1].map((ring) => {
            const t = local - ring * RING_DELAY_FRAMES;
            if (t < 0) {
              return null;
            }
            const diameter = interpolate(t, [0, ringFrames], [MIN_DIAMETER, MAX_DIAMETER], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const opacity = interpolate(t, [0, ringFrames], [0.95, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.in(Easing.quad),
            });
            return (
              <div
                key={`${step.id}-${ci}-${ring}`}
                style={{
                  position: 'absolute',
                  left: cx - diameter / 2,
                  top: cy - diameter / 2,
                  width: diameter,
                  height: diameter,
                  borderRadius: '50%',
                  border: `4px solid ${COLORS.orange}`,
                  boxShadow: `0 0 18px rgba(255,154,31,${opacity * 0.6})`,
                  opacity,
                  pointerEvents: 'none',
                }}
              />
            );
          });
        }),
      )}
    </>
  );
};
