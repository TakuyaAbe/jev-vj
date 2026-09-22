import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

/** Slow-breathing mint / orange radial glow over the dark background of the cards. */
export const Glow: React.FC<{x?: number; y?: number; strength?: number}> = ({x = 50, y = 42, strength = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 55% at ${x}% ${y}%, rgba(124,242,196,${0.22 * strength}) 0%, rgba(255,154,31,${0.12 * strength}) 40%, rgba(10,11,16,0) 75%)`,
        scale: String(
          interpolate(frame, [0, 12 * fps], [1, 1.12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        ),
      }}
    />
  );
};
