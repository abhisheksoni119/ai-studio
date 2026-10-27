import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Reel} from './Reel';
import {FPS, TOTAL_FRAMES} from './timeline';

const Root: React.FC = () => (
  <Composition id="AbrahamReel" component={Reel} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);
registerRoot(Root);
