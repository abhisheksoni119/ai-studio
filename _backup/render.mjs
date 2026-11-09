import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import path from 'path';

const browserExecutable = process.env.CHROME || undefined;
const mode = process.argv[2] || 'video';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.tsx')});
const opts = {serveUrl, id: 'AbrahamReel', browserExecutable, chromeMode: browserExecutable ? 'chrome-for-testing' : undefined};
const composition = await selectComposition(opts);

if (mode === 'stills') {
  const frames = (process.argv[3] || '30,150,300,450,600,800,950,1060,1150,1310,1400,1550,1620,1700,1830,1930,2050').split(',').map(Number);
  for (const frame of frames) {
    await renderStill({...opts, composition, frame, output: `out/still-${frame}.png`});
  }
} else {
  await renderMedia({
    ...opts, composition, codec: 'h264', crf: 20, x264Preset: 'veryfast', concurrency: 2,
    outputLocation: 'out/abraham-reel.mp4',
    onProgress: ({progress}) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)}% `); },
  });
}
console.log('done');
