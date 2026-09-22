import {Audio} from '@remotion/media';
import {Sequence, staticFile} from 'remotion';
import {AUDIO, type SfxType} from './theme';

const isSfx = (type: string): type is SfxType => type in AUDIO.sfx;

/** One synthesised sound effect (public/audio/<type>.wav, see audio.mjs) at local frame `from`. */
export const Sfx: React.FC<{type: string; from: number; gain?: number}> = ({type, from, gain = 1}) => {
  if (!isSfx(type) || from < 0) {
    return null;
  }
  return (
    <Sequence name={`sfx:${type}`} from={from} layout="none">
      <Audio src={staticFile(`audio/${type}.wav`)} volume={AUDIO.sfx[type] * gain} />
    </Sequence>
  );
};
