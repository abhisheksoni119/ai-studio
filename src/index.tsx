import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Reel} from './Reel';
import {StoryReel} from './StoryReel';
import {FPS, TOTAL_FRAMES} from './timeline';
import {STORY_FPS, STORY_TOTAL_FRAMES} from './story-timeline';

const Root: React.FC = () => (
  <>
    {/* Abraham reel — ORIGINAL, never touched */}
    <Composition id="AbrahamReel" component={Reel} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* New story reel — driven by prepare.mjs → story-timeline.ts */}
    <Composition id="StoryReel" component={StoryReel} durationInFrames={Math.max(STORY_TOTAL_FRAMES, 1)} fps={STORY_FPS} width={1080} height={1920} />
  </>
);
registerRoot(Root);
