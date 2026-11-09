import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import path from 'path';

const browserExecutable = process.env.CHROME || undefined;
const mode = process.argv[2] || 'video';
const storySlug = process.argv[3] || null; // e.g. 'noah', 'david' — omit for Abraham

const serveUrl = await bundle({entryPoint: path.resolve('src/index.tsx')});

// Abraham = AbrahamReel; any new story = StoryReel
const compositionId = storySlug ? 'StoryReel' : 'AbrahamReel';
const outputFile   = storySlug ? `out/${storySlug}-reel.mp4` : 'out/abraham-reel.mp4';

const opts = {serveUrl, id: compositionId, browserExecutable, chromeMode: browserExecutable ? 'chrome-for-testing' : undefined};
const composition = await selectComposition(opts);

if (mode === 'stills') {
  const defaultFrames = storySlug
    ? '30,150,300,450,600'
    : '30,150,300,450,600,800,950,1060,1150,1310,1400,1550,1620,1700,1830,1930,2050';
  const frames = (process.argv[4] || defaultFrames).split(',').map(Number);
  for (const frame of frames) {
    await renderStill({...opts, composition, frame, output: `out/still-${storySlug || 'abraham'}-${frame}.png`});
  }
} else {
  await renderMedia({
    ...opts, composition, codec: 'h264', crf: 20, x264Preset: 'veryfast', concurrency: 2,
    outputLocation: outputFile,
    onProgress: ({progress}) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)}% `); },
  });
}
console.log('done');
