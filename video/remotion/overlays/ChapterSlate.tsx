import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {AppChapter} from '../data';
import {msToFrames, SLATE_FRAMES} from '../data';
import {COLORS, FONT_FAMILY} from '../theme';

const EXIT = 12;

/** The chapter title, flying in over the footage for ~2 s when a chapter starts. */
const Slate: React.FC<{chapter: AppChapter}> = ({chapter}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - msToFrames(chapter.startMs, fps);
  if (local < 0 || local > SLATE_FRAMES) {
    return null;
  }
  const enter = spring({frame: local, fps, config: {damping: 200}});
  const badge = spring({frame: local - 2, fps, config: {damping: 13, stiffness: 140}});
  const exit = interpolate(local, [SLATE_FRAMES - EXIT, SLATE_FRAMES], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 300,
        height: 190,
        display: 'flex',
        alignItems: 'center',
        gap: 34,
        paddingLeft: 70,
        paddingRight: 90,
        backgroundColor: 'rgba(8,9,14,0.86)',
        borderLeft: `10px solid ${COLORS.mint}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        opacity: Math.min(enter, exit),
        translate: `${(1 - enter) * -80}px 0px`,
        fontFamily: FONT_FAMILY,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: COLORS.mint,
          color: COLORS.mintInk,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 70,
          fontWeight: 700,
          lineHeight: 1,
          opacity: badge,
          scale: String(0.6 + 0.4 * badge),
          boxShadow: '0 16px 40px rgba(124,242,196,0.35)',
        }}
      >
        {chapter.number}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
        <div style={{color: COLORS.mint, fontSize: 24, fontWeight: 700, letterSpacing: 4}}>CHAPTER {chapter.number}</div>
        <div style={{color: COLORS.white, fontSize: 68, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap'}}>{chapter.title}</div>
      </div>
    </div>
  );
};

export const ChapterSlates: React.FC<{chapters: AppChapter[]}> = ({chapters}) => (
  <>
    {chapters.map((c) => (
      <Slate key={c.id} chapter={c} />
    ))}
  </>
);
