import {Video} from '@remotion/media';
import {useMemo} from 'react';
import {AbsoluteFill, staticFile, useVideoConfig} from 'remotion';
import type {AppLayout, HowtoData} from '../data';
import {msToFrames} from '../data';
import {Narration} from '../Narration';
import {Callouts} from '../overlays/Callouts';
import {CaptionBand} from '../overlays/CaptionBand';
import {ChapterSlates} from '../overlays/ChapterSlate';
import {ClickRings} from '../overlays/ClickRings';
import {KeyBadges} from '../overlays/KeyBadges';
import {Legends} from '../overlays/Legends';
import {Sfx} from '../Sfx';
import {CAPTURE_HEIGHT, COLORS, MONO_FAMILY, STEP_NARRATION_DELAY_FRAMES, VIDEO_WIDTH} from '../theme';

/** Dark stand-in for the capture (before `node capture.mjs` has run). */
const Placeholder: React.FC<{app: AppLayout}> = ({app}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: VIDEO_WIDTH,
      height: CAPTURE_HEIGHT,
      backgroundColor: '#07070a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'rgba(255,255,255,0.35)',
      fontFamily: MONO_FAMILY,
      fontSize: 30,
      textAlign: 'center',
      lineHeight: 1.6,
    }}
  >
    {app.video} placeholder
    <br />
    run `node capture.mjs`
  </div>
);

/**
 * The footage: captures/app.mp4 (1920x920) at the top, trimmed by trimMs, with
 * the drawn-on callouts, click rings, key badges, legend cards and chapter
 * slates over it, and the caption band (chapter chip + subtitle + progress)
 * in the 160 px below. Every step's narration starts at its startMs.
 */
export const AppSegment: React.FC<{data: HowtoData}> = ({data}) => {
  const {fps} = useVideoConfig();
  const {app} = data.layout;
  const notes = useMemo(() => app.steps.flatMap((s) => s.notes), [app.steps]);

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      {app.videoAvailable ? (
        <Video
          src={staticFile(app.video)}
          trimBefore={msToFrames(app.trimMs, fps)}
          muted
          style={{position: 'absolute', left: 0, top: 0, width: VIDEO_WIDTH, height: CAPTURE_HEIGHT, objectFit: 'fill'}}
        />
      ) : (
        <Placeholder app={app} />
      )}

      <Callouts notes={notes} />
      <ClickRings steps={app.steps} />
      <KeyBadges steps={app.steps} />
      <Legends steps={app.steps} />
      <ChapterSlates chapters={app.chapters} />
      <CaptionBand chapters={app.chapters} steps={app.steps} />

      {app.steps.map((step) => (
        <Narration key={step.id} id={step.id} from={msToFrames(step.startMs, fps) + STEP_NARRATION_DELAY_FRAMES} data={data} />
      ))}
      {app.steps.flatMap((step) => [
        ...step.clicks.map((c, i) => <Sfx key={`${step.id}:tap${i}`} type="tap" from={msToFrames(c.atMs, fps)} />),
        ...step.keys.map((k, i) => <Sfx key={`${step.id}:key${i}`} type="pop" from={msToFrames(k.atMs, fps)} />),
      ])}
      {app.chapters.slice(1).map((c) => (
        <Sfx key={`slate:${c.id}`} type="whoosh" from={msToFrames(c.startMs, fps)} />
      ))}
    </AbsoluteFill>
  );
};
