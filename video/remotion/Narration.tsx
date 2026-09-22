import {Audio} from '@remotion/media';
import {Sequence, staticFile} from 'remotion';
import type {HowtoData} from './data';

/**
 * The narration clip for `id` starting at local frame `from`. Only clips listed
 * in public/narration/durations.json are referenced, so a missing clip never
 * breaks the render.
 */
export const Narration: React.FC<{id: string; from: number; data: HowtoData}> = ({id, from, data}) => {
  const entry = data.narration[id];
  if (!entry) {
    return null;
  }
  return (
    <Sequence name={`narration:${id}`} from={from} layout="none">
      <Audio src={staticFile(entry.file)} />
    </Sequence>
  );
};
