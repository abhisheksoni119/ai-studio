#!/usr/bin/env node
// transcribe.mjs — read word-level timings out of the narration itself.
//
// Usage: node transcribe.mjs <slug> [--model tiny|base|small]
//
// Writes stories/<slug>/words.json. prepare.mjs picks that up automatically and
// times the captions from the real audio instead of estimating from syllable
// counts. Measured against a read with an uneven pace, the estimate drifts
// about 1.5s on average and 2.8s at worst; alignment against real timings
// lands inside 0.2s even when a sixth of the words are misheard.
//
// This is speech RECOGNITION, not voice generation: it reads the MP3 you
// already exported and never synthesises anything. Pure JavaScript — no Python,
// no WSL2, no ffmpeg, no build tools. The model downloads once and everything
// after that runs offline.
//
// Optional. Skip it and prepare.mjs falls back to the estimate as before.

import fs from 'fs';
import path from 'path';
import {decodeToPcm, SAMPLE_RATE} from './pcm.mjs';

const MODELS = {
  tiny:  'onnx-community/whisper-tiny.en',   // ~80MB,  fastest, good enough for timing
  base:  'onnx-community/whisper-base.en',   // ~150MB, noticeably better words
  small: 'onnx-community/whisper-small.en',  // ~500MB, best, slow on CPU
};

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node transcribe.mjs <slug> [--model tiny|base|small]');
    process.exit(1);
  }
  const which = argValue('--model') ?? 'base';
  const modelId = MODELS[which];
  if (!modelId) {
    console.error(`Unknown model "${which}". Use one of: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
  }

  const voicePath = path.resolve(`stories/${slug}/voice.mp3`);
  if (!fs.existsSync(voicePath)) {
    console.error(`\n[x] Missing ${voicePath}`);
    console.error('    Put the ElevenLabs MP3 there first.\n');
    process.exit(1);
  }

  let transformers;
  try {
    transformers = await import('@huggingface/transformers');
  } catch {
    console.error('\n[x] @huggingface/transformers is not installed.');
    console.error('    Install it once:  npm install @huggingface/transformers');
    console.error('    Until then, captions use the syllable estimate.\n');
    process.exit(1);
  }

  console.log(`\nDecoding ${path.basename(voicePath)} ...`);
  let audio, via;
  try {
    ({audio, via} = await decodeToPcm(voicePath));
  } catch (err) {
    console.error('\n[x] Could not decode the MP3.');
    for (const n of err.notes ?? []) console.error(`    - ${n}`);
    console.error('\n    Fix: npm install mpg123-decoder');
    console.error('    (220KB, pure WebAssembly, no compiler and no ffmpeg needed)\n');
    process.exit(1);
  }
  const seconds = audio.length / SAMPLE_RATE;
  console.log(`[ok] ${seconds.toFixed(2)}s at ${SAMPLE_RATE}Hz mono, via ${via}`);

  console.log(`Loading ${modelId} ...`);
  console.log('     (first run downloads the model; after that it is offline)');
  const t0 = Date.now();
  let asr;
  try {
    asr = await transformers.pipeline('automatic-speech-recognition', modelId);
  } catch (err) {
    console.error(`\n[x] Could not load the model: ${err.message}`);
    console.error('    The first run needs internet to fetch it from huggingface.co.\n');
    process.exit(1);
  }
  console.log(`[ok] model ready in ${Math.round((Date.now() - t0) / 1000)}s`);

  console.log('Transcribing ... (roughly real-time on a laptop CPU)');
  const t1 = Date.now();
  const out = await asr(audio, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  console.log(`[ok] transcribed in ${Math.round((Date.now() - t1) / 1000)}s`);

  const words = (out.chunks ?? [])
    .map((c) => ({
      word: String(c.text ?? '').trim(),
      start: Number(c.timestamp?.[0]),
      end: Number(c.timestamp?.[1]),
    }))
    .filter((w) => w.word && Number.isFinite(w.start));

  // Whisper occasionally omits the closing timestamp on the last word of a chunk.
  for (let i = 0; i < words.length; i++) {
    if (!Number.isFinite(words[i].end)) {
      words[i].end = i + 1 < words.length ? words[i + 1].start : seconds;
    }
  }

  if (!words.length) {
    console.error('\n[x] No word timings came back. Captions will use the estimate.\n');
    process.exit(1);
  }

  const dest = path.resolve(`stories/${slug}/words.json`);
  fs.writeFileSync(dest, JSON.stringify({
    model: modelId,
    duration: seconds,
    text: out.text ?? '',
    words,
  }, null, 2));

  console.log(`\n[ok] ${words.length} word timings -> stories/${slug}/words.json`);
  console.log(`     first: "${words[0].word}" at ${words[0].start.toFixed(2)}s`);
  console.log(`     last : "${words[words.length - 1].word}" at ${words[words.length - 1].start.toFixed(2)}s`);
  console.log('\nNow run prepare.mjs again - it will time the captions from the audio.\n');
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

main().catch((err) => {
  console.error('transcribe failed:', err.message);
  process.exit(1);
});
