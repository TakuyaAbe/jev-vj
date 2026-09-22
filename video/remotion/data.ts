import {staticFile} from 'remotion';
import {
  NARRATION_DELAY_FRAMES,
  SLATE_FRAMES,
  STEP_NARRATION_DELAY_FRAMES,
  TRANSITION_FRAMES,
} from './theme';

// ---------------------------------------------------------------------------
// script.json (source of truth: video/script.json, mirrored to public/ by
// remotion.config.ts)
// ---------------------------------------------------------------------------

export type NoteKind = 'box' | 'circle' | 'underline';
export type NoteSide = 'auto' | 'right' | 'left' | 'above' | 'below';

export type ScriptAction = {type: string; at: number; [key: string]: unknown};

/** Callout: a DOM target (resolved by capture.mjs) or a fixed box in capture px. */
export type ScriptNote = {
  at: number;
  until?: number;
  target?: string;
  box?: [number, number, number, number];
  label: string;
  kind?: NoteKind;
  side?: NoteSide;
};

export type LegendItem = {color: string; text: string; sample?: string; badge?: string};
/** Explanatory card drawn over the stage (for canvas content no DOM target can point at). */
export type ScriptLegend = {at: number; until?: number; title?: string; items: LegendItem[]};

export type ScriptStep = {
  id: string;
  subtitle: string;
  narration: string;
  minSeconds: number;
  actions?: ScriptAction[];
  notes?: ScriptNote[];
  legend?: ScriptLegend;
};

export type ScriptChapter = {id: string; number: number; title: string; steps: ScriptStep[]};

export type Script = {
  meta: {
    title: string;
    subtitle: string;
    caption: string;
    baseUrl: string;
    publicUrl: string;
    publicNote?: string;
    fps: number;
    width: number;
    height: number;
    capture: {width: number; height: number; panelZoom: number};
    voice?: string;
    rate?: string;
    version?: number;
  };
  cards: {
    title: {minSeconds: number; narration: string};
    overview: {minSeconds: number; narration: string};
    keys: {minSeconds: number; narration: string; items: Array<{key: string; label: string}>};
    outro: {minSeconds: number; narration: string};
  };
  chapters: ScriptChapter[];
};

// ---------------------------------------------------------------------------
// timeline.json (produced by capture.mjs; every ms is relative to frame 0 of
// captures/app.mp4). A sample built from script.json minSeconds stands in
// while no capture exists, so the Studio works before filming.
// ---------------------------------------------------------------------------

/** [videoMs, x, y, w, h] – a note target's box sampled over time. */
export type TrackSample = [number, number, number, number, number];
export type TimelineClick = {atMs: number; x: number; y: number; w: number; h: number; label: string};
export type TimelineKey = {atMs: number; key: string};
export type TimelineNote = {atMs: number; untilMs: number; label: string; kind: NoteKind; side: NoteSide; track: TrackSample[]};
export type TimelineStep = {id: string; startMs: number; endMs: number; clicks: TimelineClick[]; keys: TimelineKey[]; notes: TimelineNote[]};
export type TimelineChapter = {id: string; startMs: number; endMs: number; steps: TimelineStep[]};
export type Timeline = {
  version: number;
  fps: number;
  width: number;
  height: number;
  video: string;
  totalMs: number;
  demo: {file: string; startMs: number; loop?: boolean} | null;
  chapters: TimelineChapter[];
  source: 'timeline.json' | 'sample';
};

// ---------------------------------------------------------------------------
// Layout: everything the composition and its audio need, in frames.
// ---------------------------------------------------------------------------

export type SegmentKind = 'title' | 'overview' | 'app' | 'keys' | 'outro';
export type Segment = {kind: SegmentKind; from: number; durationInFrames: number};

/** One step of the footage; ms values are relative to the app segment start (trimMs removed). */
export type AppStep = {
  id: string;
  index: number;
  chapterIndex: number;
  subtitle: string;
  legend: ScriptLegend | null;
  startMs: number;
  endMs: number;
  clicks: TimelineClick[];
  keys: TimelineKey[];
  notes: TimelineNote[];
};

export type AppChapter = {id: string; index: number; number: number; title: string; startMs: number; endMs: number};

export type AppLayout = {
  from: number;
  durationInFrames: number;
  video: string;
  videoAvailable: boolean;
  /** ms cut from the start of the capture (page-load lead-in). videoMs = trimMs + segmentMs. */
  trimMs: number;
  chapters: AppChapter[];
  steps: AppStep[];
  /** The app's demo track as the music bed: local frame it starts at. */
  demo: {file: string; startFrame: number; loop: boolean} | null;
};

export type Layout = {
  fps: number;
  totalFrames: number;
  transitionFrames: number;
  narrationDelayFrames: number;
  segments: Segment[];
  app: AppLayout;
  /** Global frame spans of every narration clip (for ducking the beds). */
  narration: Array<{from: number; durationInFrames: number}>;
  /** Global frames where a whoosh plays (card transitions, chapter slates). */
  whooshes: number[];
};

export type HowtoData = {
  script: Script;
  timeline: Timeline;
  narration: Record<string, {file: string; seconds: number}>;
  demoAvailable: boolean;
  layout: Layout;
};

export const msToFrames = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

const stepSeconds = (step: ScriptStep, durations: Record<string, number>) =>
  Math.max(step.minSeconds, (durations[step.id] ?? 0) + 1.0);

/** Development stand-in for timeline.json: steps back to back, no clicks, fixed-box notes kept. */
export const sampleTimeline = (script: Script, durations: Record<string, number>): Timeline => {
  let cursor = 1200;
  const chapters: TimelineChapter[] = script.chapters.map((c) => {
    const startMs = cursor;
    const steps: TimelineStep[] = c.steps.map((s) => {
      const s0 = cursor;
      const durMs = Math.round(stepSeconds(s, durations) * 1000);
      cursor += durMs;
      const notes: TimelineNote[] = (s.notes ?? [])
        .filter((n) => n.box)
        .map((n) => ({
          atMs: s0 + Math.round(n.at * 1000),
          untilMs: s0 + Math.round(Math.min(n.until ?? n.at + 4, durMs / 1000) * 1000),
          label: n.label,
          kind: n.kind ?? 'box',
          side: n.side ?? 'auto',
          track: [[s0 + Math.round(n.at * 1000), ...(n.box as [number, number, number, number])]],
        }));
      return {id: s.id, startMs: s0, endMs: cursor, clicks: [], keys: [], notes};
    });
    return {id: c.id, startMs, endMs: cursor, steps};
  });
  return {
    version: 1,
    fps: script.meta.fps,
    width: script.meta.capture.width,
    height: script.meta.capture.height,
    video: 'captures/app.mp4',
    totalMs: cursor + 1500,
    demo: null,
    chapters,
    source: 'sample',
  };
};

export const computeLayout = (
  script: Script,
  timeline: Timeline,
  durations: Record<string, number>,
  fps: number,
  videoAvailable: boolean,
  demoAvailable: boolean,
): Layout => {
  const narr = (id: string) => durations[id] ?? 0;
  const cardFrames = (id: keyof Script['cards']) =>
    Math.round(Math.max(script.cards[id].minSeconds, narr(id) + 1.0) * fps);

  // ---- app segment -------------------------------------------------------
  const scriptSteps = new Map(script.chapters.flatMap((c) => c.steps.map((s) => [s.id, s] as const)));
  const scriptChapters = new Map(script.chapters.map((c) => [c.id, c] as const));
  const firstChapter = timeline.chapters[0];
  const lastChapter = timeline.chapters[timeline.chapters.length - 1];
  const trimMs = firstChapter?.startMs ?? 0;
  const appEndMs = (lastChapter?.endMs ?? trimMs) - trimMs;
  const tailMs = Math.min(500, Math.max(0, timeline.totalMs - trimMs - appEndMs));
  const appDuration = Math.max(fps, msToFrames(appEndMs + tailMs, fps));

  const steps: AppStep[] = [];
  const chapters: AppChapter[] = timeline.chapters.map((c, ci) => {
    const sc = scriptChapters.get(c.id);
    for (const s of c.steps) {
      const ss = scriptSteps.get(s.id);
      steps.push({
        id: s.id,
        index: steps.length,
        chapterIndex: ci,
        subtitle: ss?.subtitle ?? s.id,
        legend: ss?.legend ?? null,
        startMs: s.startMs - trimMs,
        endMs: s.endMs - trimMs,
        clicks: s.clicks.map((k) => ({...k, atMs: k.atMs - trimMs})),
        keys: s.keys.map((k) => ({...k, atMs: k.atMs - trimMs})),
        notes: s.notes.map((n) => ({
          ...n,
          atMs: n.atMs - trimMs,
          untilMs: n.untilMs - trimMs,
          track: n.track.map(([t, x, y, w, h]) => [t - trimMs, x, y, w, h] as TrackSample),
        })),
      });
    }
    return {
      id: c.id,
      index: ci,
      number: sc?.number ?? ci + 1,
      title: sc?.title ?? c.id,
      startMs: c.startMs - trimMs,
      endMs: c.endMs - trimMs,
    };
  });

  // ---- segments through the TransitionSeries ----------------------------
  const order: Array<[SegmentKind, number]> = [
    ['title', cardFrames('title')],
    ['overview', cardFrames('overview')],
    ['app', appDuration],
    ['keys', cardFrames('keys')],
    ['outro', cardFrames('outro')],
  ];
  const segments: Segment[] = [];
  let cursor = 0;
  for (const [kind, durationInFrames] of order) {
    segments.push({kind, from: cursor, durationInFrames});
    cursor += durationInFrames - TRANSITION_FRAMES;
  }
  const totalFrames = cursor + TRANSITION_FRAMES;
  const segFrom = (kind: SegmentKind) => segments.find((s) => s.kind === kind)!.from;

  // ---- audio spans -------------------------------------------------------
  const narration: Layout['narration'] = [];
  const clip = (id: string, from: number) => {
    const seconds = narr(id);
    if (seconds > 0) {
      narration.push({from, durationInFrames: Math.round(seconds * fps)});
    }
  };
  clip('title', segFrom('title') + NARRATION_DELAY_FRAMES);
  clip('overview', segFrom('overview') + NARRATION_DELAY_FRAMES);
  const appFrom = segFrom('app');
  for (const s of steps) {
    clip(s.id, appFrom + msToFrames(s.startMs, fps) + STEP_NARRATION_DELAY_FRAMES);
  }
  clip('keys', segFrom('keys') + NARRATION_DELAY_FRAMES);
  clip('outro', segFrom('outro') + NARRATION_DELAY_FRAMES);

  const whooshes = [
    ...segments.slice(1).map((s) => s.from),
    ...chapters.slice(1).map((c) => appFrom + msToFrames(c.startMs, fps)),
  ];

  const demo =
    demoAvailable && timeline.demo
      ? {file: timeline.demo.file, startFrame: msToFrames(timeline.demo.startMs - trimMs, fps), loop: timeline.demo.loop ?? false}
      : null;

  return {
    fps,
    totalFrames,
    transitionFrames: TRANSITION_FRAMES,
    narrationDelayFrames: NARRATION_DELAY_FRAMES,
    segments,
    app: {
      from: appFrom,
      durationInFrames: appDuration,
      video: timeline.video,
      videoAvailable,
      trimMs,
      chapters,
      steps,
      demo,
    },
    narration,
    whooshes,
  };
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const fetchJson = async <T,>(file: string, signal: AbortSignal, optional: boolean): Promise<T | null> => {
  const res = await fetch(staticFile(file), {signal});
  if (!res.ok) {
    if (optional) {
      return null;
    }
    throw new Error(`could not load ${file}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
};

const exists = async (file: string, signal: AbortSignal): Promise<boolean> => {
  try {
    const res = await fetch(staticFile(file), {method: 'HEAD', signal});
    return res.ok;
  } catch {
    return false;
  }
};

export const loadHowtoData = async ({fps, signal}: {fps: number; signal: AbortSignal}): Promise<HowtoData> => {
  const script = await fetchJson<Script>('script.json', signal, false);
  if (!script) {
    throw new Error('script.json missing');
  }
  const durations = (await fetchJson<Record<string, number>>('narration/durations.json', signal, true)) ?? {};
  const raw = await fetchJson<Omit<Timeline, 'source'>>('timeline.json', signal, true);
  const timeline: Timeline = raw ? {...raw, source: 'timeline.json'} : sampleTimeline(script, durations);
  const [videoAvailable, demoAvailable] = await Promise.all([
    exists(timeline.video, signal),
    timeline.demo ? exists(timeline.demo.file, signal) : Promise.resolve(false),
  ]);
  if (!videoAvailable) {
    console.warn(`[data] ${timeline.video} is missing – run \`node capture.mjs\` (showing a placeholder)`);
  }
  const narration: HowtoData['narration'] = {};
  for (const [id, seconds] of Object.entries(durations)) {
    narration[id] = {file: `narration/${id}.wav`, seconds};
  }
  const layout = computeLayout(script, timeline, durations, fps, videoAvailable, demoAvailable);
  return {script, timeline, narration, demoAvailable, layout};
};

export {SLATE_FRAMES};
