import {Audio} from '@remotion/media';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import type {HowtoData, Layout, Segment} from './data';
import {FontGate} from './FontGate';
import {AppSegment} from './scenes/AppSegment';
import {KeysCard} from './scenes/KeysCard';
import {OutroCard} from './scenes/OutroCard';
import {OverviewCard} from './scenes/OverviewCard';
import {TitleCard} from './scenes/TitleCard';
import {Sfx} from './Sfx';
import {AUDIO, COLORS, FONT_FAMILY} from './theme';

export type HowtoProps = {data: HowtoData | null};

/** 0..1 how much the beds should duck at global frame f (ramped around every narration clip). */
const duckAt = (layout: Layout, f: number) => {
  const ramp = AUDIO.duckRampFrames;
  let duck = 0;
  for (const span of layout.narration) {
    const inRamp = (f - (span.from - ramp)) / ramp;
    const outRamp = (span.from + span.durationInFrames + ramp - f) / ramp;
    duck = Math.max(duck, Math.min(1, inRamp, outRamp));
  }
  return Math.max(0, duck);
};

/**
 * Soft loop under the cards. Fades out where the app's demo track takes over
 * (from the Demo track click to the end of the footage) and back in after.
 */
const Bgm: React.FC<{layout: Layout}> = ({layout}) => {
  const {fps} = useVideoConfig();
  const demoFrom = layout.app.demo ? layout.app.from + layout.app.demo.startFrame : null;
  const appEnd = layout.app.from + layout.app.durationInFrames;
  const volume = (f: number) => {
    const level = AUDIO.bgm - (AUDIO.bgm - AUDIO.bgmDucked) * duckAt(layout, f);
    const edges = interpolate(f, [0, 2 * fps, layout.totalFrames - 3 * fps, layout.totalFrames - 1], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const handOver =
      demoFrom === null
        ? 1
        : interpolate(f, [demoFrom - fps, demoFrom + fps, appEnd - 2 * fps, appEnd], [1, 0, 0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
    return level * edges * handOver;
  };
  return <Audio src={staticFile('audio/bgm.wav')} loop loopVolumeCurveBehavior="extend" volume={volume} />;
};

/** The app's own demo track, in sync with the footage, ducked under the narration. */
const DemoBed: React.FC<{layout: Layout}> = ({layout}) => {
  const {fps} = useVideoConfig();
  const {demo} = layout.app;
  if (!demo) {
    return null;
  }
  const from = layout.app.from + demo.startFrame;
  const end = layout.app.from + layout.app.durationInFrames;
  const volume = (local: number) => {
    const f = from + local;
    const level = AUDIO.demo - (AUDIO.demo - AUDIO.demoDucked) * duckAt(layout, f);
    const fadeIn = interpolate(local, [0, Math.round(0.4 * fps)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const fadeOut = interpolate(f, [end - 2 * fps, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return level * fadeIn * fadeOut;
  };
  return (
    <Sequence name="demo-track" from={from} durationInFrames={end - from} layout="none">
      <Audio src={staticFile(demo.file)} loop={demo.loop} loopVolumeCurveBehavior="extend" volume={volume} />
    </Sequence>
  );
};

const sceneFor = (seg: Segment, data: HowtoData): React.ReactNode => {
  switch (seg.kind) {
    case 'title':
      return <TitleCard data={data} />;
    case 'overview':
      return <OverviewCard data={data} />;
    case 'app':
      return <AppSegment data={data} />;
    case 'keys':
      return <KeysCard data={data} />;
    case 'outro':
      return <OutroCard data={data} />;
  }
};

/**
 * Title → Overview → footage (chapters 1–4) → Keys → Outro through a
 * TransitionSeries with cross-fades. The frame arithmetic is mirrored by
 * computeLayout (data.ts), which the audio beds rely on.
 */
export const Howto: React.FC<HowtoProps> = ({data}) => {
  const {fps} = useVideoConfig();
  if (!data) {
    return <AbsoluteFill style={{backgroundColor: COLORS.bg}} />;
  }
  const {layout} = data;
  const children: React.ReactNode[] = [];
  layout.segments.forEach((seg, i) => {
    children.push(
      <TransitionSeries.Sequence key={`seq-${seg.kind}`} name={seg.kind} durationInFrames={seg.durationInFrames} premountFor={fps}>
        {sceneFor(seg, data)}
      </TransitionSeries.Sequence>,
    );
    if (i < layout.segments.length - 1) {
      children.push(
        <TransitionSeries.Transition key={`tr-${i}`} presentation={fade()} timing={linearTiming({durationInFrames: layout.transitionFrames})} />,
      );
    }
  });

  return (
    <FontGate>
      <AbsoluteFill lang="ja" style={{backgroundColor: COLORS.bg, fontFamily: FONT_FAMILY}}>
        <TransitionSeries>{children}</TransitionSeries>
        <Bgm layout={layout} />
        <DemoBed layout={layout} />
        {layout.segments.slice(1).map((seg) => (
          <Sfx key={`whoosh-${seg.kind}`} type="whoosh" from={seg.from} />
        ))}
      </AbsoluteFill>
    </FontGate>
  );
};
