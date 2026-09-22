import type {CalculateMetadataFunction} from 'remotion';
import {Composition} from 'remotion';
import {Howto, type HowtoProps} from './Howto';
import {loadHowtoData} from './data';
import {FPS, VIDEO_HEIGHT, VIDEO_WIDTH} from './theme';

const calculateMetadata: CalculateMetadataFunction<HowtoProps> = async ({props, abortSignal}) => {
  const data = await loadHowtoData({fps: FPS, signal: abortSignal});
  return {
    durationInFrames: data.layout.totalFrames,
    fps: FPS,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    props: {...props, data},
  };
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="Howto"
      component={Howto}
      durationInFrames={30 * 60}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{data: null}}
      calculateMetadata={calculateMetadata}
    />
  );
};
