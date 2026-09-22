import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {NoteSide, TimelineNote, TrackSample} from '../data';
import {msToFrames} from '../data';
import {CAPTURE_HEIGHT, COLORS, FONT_FAMILY, VIDEO_WIDTH} from '../theme';

const DRAW_FRAMES = 14;
const LABEL_DELAY = 5;
const EXIT_FRAMES = 8;
const STROKE = 3.5;
const LABEL_H = 44;
const LABEL_FONT = 25;
const LABEL_GAP = 12;

type Rect = {x: number; y: number; width: number; height: number};

/** The target's box at segment time `ms`, linearly interpolated between samples. */
const boxAt = (track: TrackSample[], ms: number): Rect => {
  let i = 0;
  while (i + 1 < track.length && track[i + 1][0] <= ms) {
    i++;
  }
  const a = track[i];
  const b = track[Math.min(i + 1, track.length - 1)];
  const t = b[0] > a[0] ? Math.min(1, Math.max(0, (ms - a[0]) / (b[0] - a[0]))) : 0;
  const m = (k: number) => a[k] + (b[k] - a[k]) * t;
  return {x: m(1), y: m(2), width: m(3), height: m(4)};
};

const roundedRect = ({x, y, width: w, height: h}: Rect, r: number) =>
  [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
  ].join(' ');

const ellipse = ({x, y, width: w, height: h}: Rect) => {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2 + 16;
  const ry = h / 2 + 12;
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${cx + rx * Math.cos(a)} ${cy + ry * Math.sin(a)}`;
  };
  return `M ${pt(200)} A ${rx} ${ry} 0 1 1 ${pt(20)} A ${rx} ${ry} 0 0 1 ${pt(215)}`;
};

const underline = ({x, y, width: w, height: h}: Rect) =>
  `M ${x - 4} ${y + h + 6} Q ${x + w / 2} ${y + h + 12} ${x + w + 4} ${y + h + 4}`;

/** Label width without measuring the DOM: CJK glyphs 1em, Latin ≈ 0.56em, plus pill padding. */
const labelWidth = (text: string) => {
  let w = 36;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    w += code >= 0x2e80 ? LABEL_FONT : ch === ' ' ? LABEL_FONT * 0.28 : LABEL_FONT * 0.56;
  }
  return w;
};

type Side = Exclude<NoteSide, 'auto'>;
type Placement = {x: number; y: number; origin: string};

const placementFor = (shape: Rect, w: number, side: Side): Placement => {
  const cy = shape.y + shape.height / 2 - LABEL_H / 2;
  switch (side) {
    case 'right':
      return {x: shape.x + shape.width + LABEL_GAP, y: cy, origin: '0% 50%'};
    case 'left':
      return {x: shape.x - LABEL_GAP - w, y: cy, origin: '100% 50%'};
    case 'above':
      return {x: shape.x, y: shape.y - LABEL_GAP - LABEL_H, origin: '0% 100%'};
    case 'below':
      return {x: shape.x, y: shape.y + shape.height + LABEL_GAP, origin: '0% 0%'};
  }
};

const chooseSide = (shape: Rect, w: number, preferred: NoteSide): Side => {
  const fits = (p: Placement) => p.x >= 16 && p.x + w <= VIDEO_WIDTH - 16 && p.y >= 12 && p.y + LABEL_H <= CAPTURE_HEIGHT - 12;
  const order: Side[] = ['right', 'left', 'above', 'below'];
  return (preferred === 'auto' ? order : [preferred, ...order]).find((s) => fits(placementFor(shape, w, s))) ?? 'above';
};

const outerShape = (note: TimelineNote, box: Rect): Rect =>
  note.kind === 'circle' ? {x: box.x - 16, y: box.y - 12, width: box.width + 32, height: box.height + 24} : box;

const Note: React.FC<{note: TimelineNote}> = ({note}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const start = msToFrames(note.atMs, fps);
  const end = msToFrames(note.untilMs, fps);
  const local = frame - start;
  if (local < 0 || frame > end) {
    return null;
  }
  const ms = (frame / fps) * 1000;
  const src = boxAt(note.track, ms);
  const pad = note.kind === 'box' ? 6 : 0;
  const box: Rect = {x: src.x - pad, y: src.y - pad, width: src.width + pad * 2, height: src.height + pad * 2};

  const draw = interpolate(local, [0, DRAW_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(frame, [end - EXIT_FRAMES, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pop = spring({frame: local - LABEL_DELAY, fps, config: {damping: 14, stiffness: 180}});

  const path = note.kind === 'circle' ? ellipse(box) : note.kind === 'underline' ? underline(box) : roundedRect(box, 10);
  const w = labelWidth(note.label);
  const side = chooseSide(outerShape(note, box), w, note.side);
  const placed = placementFor(outerShape(note, box), w, side);
  const label = {...placed, x: Math.min(Math.max(16, placed.x), VIDEO_WIDTH - 16 - w)};

  return (
    <>
      <svg
        width={VIDEO_WIDTH}
        height={CAPTURE_HEIGHT}
        style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: exit, pointerEvents: 'none'}}
      >
        <path
          d={path}
          pathLength={1}
          fill="none"
          stroke={COLORS.orange}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
          style={{filter: 'drop-shadow(0 0 6px rgba(255,154,31,0.75))'}}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: label.x,
          top: label.y,
          height: LABEL_H,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          borderRadius: LABEL_H / 2,
          backgroundColor: COLORS.orange,
          color: '#1a0f00',
          fontFamily: FONT_FAMILY,
          fontSize: LABEL_FONT,
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          opacity: Math.min(exit, pop),
          scale: String(0.85 + 0.15 * pop),
          transformOrigin: label.origin,
          pointerEvents: 'none',
        }}
      >
        {note.label}
      </div>
    </>
  );
};

/** Drawn-on callouts (box / circle / underline + label pill) over the footage. */
export const Callouts: React.FC<{notes: TimelineNote[]}> = ({notes}) => (
  <>
    {notes.map((note) => (
      <Note key={`${note.atMs}-${note.label}`} note={note} />
    ))}
  </>
);
