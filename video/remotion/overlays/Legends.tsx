import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {AppStep, ScriptLegend} from '../data';
import {msToFrames} from '../data';
import {COLORS, FONT_FAMILY, MONO_FAMILY} from '../theme';

const ENTER = 10;
const EXIT = 8;
const WIDTH = 600;
const LEFT = 1920 - WIDTH - 30;
const TOP = 28;

/**
 * Explanatory card over the stage (top right, where the hidden panel was):
 * one row per log line type or verdict badge. The CLI log is canvas text, so
 * this is how the composition annotates it.
 */
const LegendCard: React.FC<{legend: ScriptLegend; step: AppStep}> = ({legend, step}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const durS = (step.endMs - step.startMs) / 1000;
  const start = msToFrames(step.startMs + legend.at * 1000, fps);
  const end = msToFrames(step.startMs + Math.min(legend.until ?? durS, durS) * 1000, fps);
  if (frame < start || frame > end) {
    return null;
  }
  const enter = interpolate(frame, [start, start + ENTER], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const exit = interpolate(frame, [end - EXIT, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = Math.min(enter, exit);
  return (
    <div
      style={{
        position: 'absolute',
        left: LEFT,
        top: TOP,
        width: WIDTH,
        boxSizing: 'border-box',
        padding: '20px 24px 22px',
        borderRadius: 16,
        backgroundColor: 'rgba(10,11,16,0.9)',
        border: `1px solid rgba(124,242,196,0.4)`,
        boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
        color: COLORS.white,
        fontFamily: FONT_FAMILY,
        opacity,
        translate: `0px ${(1 - enter) * -14}px`,
        pointerEvents: 'none',
      }}
    >
      {legend.title ? (
        <div style={{color: COLORS.mint, fontSize: 22, fontWeight: 700, letterSpacing: 1.5, marginBottom: 14}}>{legend.title}</div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {legend.items.map((item, i) => {
          const rowIn = interpolate(frame, [start + 4 + i * 4, start + 12 + i * 4], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 14, opacity: rowIn, translate: `${(1 - rowIn) * 10}px 0px`}}>
              {item.badge ? (
                <div
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    padding: '3px 12px',
                    backgroundColor: item.color,
                    color: '#000',
                    fontFamily: MONO_FAMILY,
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    borderRadius: 3,
                  }}
                >
                  {item.badge}
                </div>
              ) : (
                <div style={{flexShrink: 0, marginTop: 9, width: 14, height: 14, borderRadius: 7, backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}`}} />
              )}
              <div style={{display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0}}>
                {item.sample ? (
                  <div style={{fontFamily: MONO_FAMILY, fontSize: 20, color: item.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.95}}>
                    {item.sample}
                  </div>
                ) : null}
                <div style={{fontSize: 24, lineHeight: 1.35, color: COLORS.white}}>{item.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Legends: React.FC<{steps: AppStep[]}> = ({steps}) => (
  <>
    {steps.map((s) => (s.legend ? <LegendCard key={s.id} legend={s.legend} step={s} /> : null))}
  </>
);
