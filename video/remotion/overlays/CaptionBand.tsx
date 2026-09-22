import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {AppChapter, AppStep} from '../data';
import {msToFrames} from '../data';
import {BAND_HEIGHT, BAND_TOP, COLORS, FONT_FAMILY, VIDEO_WIDTH} from '../theme';

const FADE = 5;
const CHIP_LEFT = 40;
const CHIP_WIDTH = 330;
const TEXT_LEFT = CHIP_LEFT + CHIP_WIDTH + 30;
const TEXT_WIDTH = VIDEO_WIDTH - TEXT_LEFT - 40;
const FONT_SIZE = 33;
const LINE_HEIGHT = 46;
const BAR_HEIGHT = 6;

/**
 * Glue numbers to their units ("8 小節", "128 BPM") so a line break never separates them.
 */
const keepTogether = (text: string) =>
  text.replace(/(\d) (?=(?:小節|BPM|拍|px|秒|個|体|種))/g, '$1 ');

/**
 * The 160 px band under the footage: chapter chip (left), the current step's
 * subtitle (right, up to two lines, fixed geometry) and a per-step progress bar
 * along the bottom edge. Steps cross-fade around their [startMs, endMs) window.
 */
export const CaptionBand: React.FC<{chapters: AppChapter[]; steps: AppStep[]}> = ({chapters, steps}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const last = steps.length - 1;
  let currentIndex = steps.findIndex((s) => ms >= s.startMs && ms < s.endMs);
  if (currentIndex === -1) {
    currentIndex = ms < (steps[0]?.startMs ?? 0) ? 0 : last;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: BAND_TOP,
        width: VIDEO_WIDTH,
        height: BAND_HEIGHT,
        backgroundColor: COLORS.bg,
        borderTop: `1px solid ${COLORS.line}`,
        overflow: 'hidden',
      }}
    >
      {chapters.map((c, i) => {
        const start = msToFrames(c.startMs, fps);
        const end = msToFrames(c.endMs, fps);
        const isLast = i === chapters.length - 1;
        const opacity = interpolate(
          frame,
          isLast ? [start - FADE, start + FADE, end - 1, end] : [start - FADE, start + FADE, end - FADE, end + FADE],
          isLast ? [0, 1, 1, 1] : [0, 1, 1, 0],
          {extrapolateLeft: i === 0 ? 'extend' : 'clamp', extrapolateRight: 'clamp'},
        );
        if (opacity <= 0) {
          return null;
        }
        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: CHIP_LEFT,
              top: (BAND_HEIGHT - BAR_HEIGHT - 58) / 2,
              width: CHIP_WIDTH,
              height: 58,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 20px 0 10px',
              borderRadius: 999,
              backgroundColor: COLORS.mint,
              color: COLORS.mintInk,
              opacity: Math.min(1, Math.max(0, opacity)),
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: COLORS.mintInk,
                color: COLORS.mint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {c.number}
            </div>
            <div style={{fontSize: 27, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap', lineHeight: 1}}>
              {c.title}
            </div>
          </div>
        );
      })}

      {steps.map((s, i) => {
        const start = msToFrames(s.startMs, fps);
        const end = msToFrames(s.endMs, fps);
        const opacity = interpolate(
          frame,
          i === last ? [start - FADE, start + FADE, end - 1, end] : [start - FADE, start + FADE, end - FADE, end + FADE],
          i === last ? [0, 1, 1, 1] : [0, 1, 1, 0],
          {extrapolateLeft: i === 0 ? 'extend' : 'clamp', extrapolateRight: 'clamp'},
        );
        if (opacity <= 0) {
          return null;
        }
        return (
          <div
            key={s.id}
            lang="ja"
            style={{
              position: 'absolute',
              left: TEXT_LEFT,
              top: 0,
              width: TEXT_WIDTH,
              height: BAND_HEIGHT - BAR_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              color: COLORS.white,
              fontFamily: FONT_FAMILY,
              fontSize: FONT_SIZE,
              fontWeight: 400,
              lineHeight: `${LINE_HEIGHT}px`,
              fontKerning: 'normal',
              fontFeatureSettings: 'normal',
              wordBreak: 'auto-phrase' as React.CSSProperties['wordBreak'],
              overflowWrap: 'normal',
              opacity: Math.min(1, Math.max(0, opacity)),
            }}
          >
            <div>{keepTogether(s.subtitle)}</div>
          </div>
        );
      })}

      {/* per-step progress along the bottom edge */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR_HEIGHT, display: 'flex', gap: 3}}>
        {steps.map((s, i) => {
          const span = Math.max(1, s.endMs - s.startMs);
          const within = Math.min(1, Math.max(0, (ms - s.startMs) / span));
          const fill = i < currentIndex ? 1 : i === currentIndex ? within : 0;
          return (
            <div key={s.id} style={{flex: 1, height: BAR_HEIGHT, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden'}}>
              <div style={{width: `${fill * 100}%`, height: BAR_HEIGHT, backgroundColor: COLORS.mint, opacity: i < currentIndex ? 0.7 : 1}} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
