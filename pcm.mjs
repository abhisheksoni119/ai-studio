// pcm.mjs — MP3 to 16kHz mono Float32, with no system ffmpeg and no Python.
//
// Whisper wants exactly one channel of 16kHz Float32 in [-1,1]. Getting there
// on Windows used to mean installing ffmpeg; this does it inside Node.
//
// Decoders are tried in order:
//   1. mpg123-decoder — a 220KB WebAssembly build of libmpg123. Pure JS to
//      install (no compiler, no Python), works identically on Windows, macOS
//      and Linux, and decodes offline.
//   2. a system ffmpeg, if the machine happens to have one.
//
// The Remotion compositor binary is deliberately NOT tried: it speaks a JSON
// protocol on stdin and rejects ffmpeg-style argv, answering any attempt with
// `expected ident at line 1 column 2` rather than audio.

import fs from 'fs';
import {execFileSync} from 'child_process';

export const SAMPLE_RATE = 16000;

/** MP3 file path → {audio: Float32Array @16kHz mono, via: string}. */
export async function decodeToPcm(file) {
  const notes = [];

  try {
    return {audio: await viaMpg123(file), via: 'mpg123-decoder'};
  } catch (err) {
    notes.push(`mpg123-decoder: ${err.message}`);
  }

  try {
    return {audio: viaFfmpeg(file), via: 'ffmpeg'};
  } catch (err) {
    notes.push(`ffmpeg: ${err.message}`);
  }

  const e = new Error('no usable MP3 decoder');
  e.notes = notes;
  throw e;
}

async function viaMpg123(file) {
  let mod;
  try {
    mod = await import('mpg123-decoder');
  } catch {
    throw new Error('not installed (npm install mpg123-decoder)');
  }
  const dec = new mod.MPEGDecoder();
  await dec.ready;
  try {
    const out = dec.decode(new Uint8Array(fs.readFileSync(file)));
    if (!out.samplesDecoded) throw new Error('decoded 0 samples — not an MP3?');
    return resample(toMono(out.channelData), out.sampleRate, SAMPLE_RATE);
  } finally {
    dec.free();
  }
}

function viaFfmpeg(file) {
  const buf = execFileSync('ffmpeg', [
    '-v', 'error', '-i', file,
    '-ar', String(SAMPLE_RATE), '-ac', '1', '-f', 'f32le', '-',
  ], {maxBuffer: 1024 * 1024 * 512});
  if (!buf || buf.length < 1024) throw new Error('returned no audio');
  // execFileSync may hand back a slice of a larger pool, so copy before
  // reinterpreting the bytes — and the offset may not be 4-byte aligned.
  const copy = Buffer.from(buf.subarray(0, buf.length - (buf.length % 4)));
  return new Float32Array(copy.buffer, copy.byteOffset, copy.length / 4);
}

export function toMono(channels) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i];
  const k = 1 / channels.length;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

/**
 * Windowed-sinc resampler.
 *
 * Plain linear interpolation would be cheaper, but dropping 44.1kHz to 16kHz
 * folds everything above 8kHz back down as aliasing noise, and Whisper reads
 * exactly that band as part of its mel spectrogram. The sinc kernel is scaled
 * by the ratio when downsampling, which is what band-limits the signal.
 */
export function resample(input, from, to) {
  if (from === to) return input;
  const ratio = to / from;
  const outLen = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLen);

  // Cutoff below both Nyquists; TAPS lobes either side of each sample.
  const cutoff = Math.min(1, ratio) * 0.95;
  const TAPS = 16;
  const half = Math.ceil(TAPS / cutoff);

  // Precompute the kernel on a fine grid: recomputing sin() per tap per output
  // sample costs ~55M calls on a two-minute read.
  const RES = 128;
  const table = new Float32Array(half * RES + 1);
  for (let i = 0; i < table.length; i++) {
    const x = i / RES;
    const s = x === 0 ? 1 : Math.sin(Math.PI * cutoff * x) / (Math.PI * cutoff * x);
    const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / half); // Hann, zero at the edge
    table[i] = cutoff * s * w;
  }
  const kernel = (x) => {
    const i = Math.round(Math.abs(x) * RES);
    return i >= table.length ? 0 : table[i];
  };

  for (let i = 0; i < outLen; i++) {
    const centre = i / ratio;
    const first = Math.ceil(centre - half);
    const last = Math.floor(centre + half);
    let acc = 0;
    let norm = 0;
    for (let j = first; j <= last; j++) {
      const k = kernel(centre - j);
      if (k === 0) continue;
      norm += k;
      if (j < 0 || j >= input.length) continue; // zero-pad the edges
      acc += input[j] * k;
    }
    out[i] = norm > 0 ? acc / norm : 0;
  }
  return out;
}
