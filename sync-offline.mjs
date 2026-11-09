#!/usr/bin/env node
// sync-offline.mjs — time the captions from the narration, with no network.
//
// Usage: node sync-offline.mjs <slug> [--noise -32dB] [--min-pause 0.35] [--dry]
//
// Why this exists
// ---------------
// transcribe.mjs needs a Whisper model from huggingface.co. In a sandboxed
// cloud container that host is blocked at the proxy, so transcribe.mjs exits
// and prepare.mjs silently falls back to the syllable estimate — which drifts
// about 1.5s on average and 4.4s at worst. That drift is the "voice is not
// aligned" problem; the captions were never timed to the audio at all.
//
// This script gets the timing a different way. It does not recognise speech.
// It finds where the speaker PAUSES — which ffmpeg can do offline — and pins
// each sentence of the script to the stretch of audio between two pauses.
// Word times inside a sentence are then spread by syllable weight.
//
// So the anchors are real. A caption can still be a little early or late
// WITHIN its sentence, but it can no longer drift into the wrong sentence,
// which is the error people actually see.
//
// Output is stories/<slug>/words.json, in exactly the shape transcribe.mjs
// writes, so prepare.mjs and align.mjs need no changes. The words written are
// the script's own words, so align.mjs anchors 100% of them.

import fs from 'fs';
import path from 'path';
import {execFileSync, spawnSync} from 'child_process';

const DEFAULT_NOISE = '-32dB';
const DEFAULT_MIN_PAUSE = 0.35;

// ─────────────────────────────────────────────────────────────── audio ──

/** Length of the file in seconds, via ffprobe. */
function probeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    file,
  ], {encoding: 'utf8'});
  const d = Number(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe gave no duration for ${file}`);
  return d;
}

/**
 * Stretches of audio that are NOT silence.
 *
 * ffmpeg reports the silences; the speech is what is left between them. A
 * leading silence means the read starts late, a trailing one that it ends
 * early — both are handled by walking the silence list and taking the gaps.
 */
function speechSegments(file, duration, noise, minPause) {
  // silencedetect reports on STDERR and ffmpeg still exits 0, so the log has to
  // be read from stderr explicitly rather than from a return value.
  const run = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', `silencedetect=noise=${noise}:d=${minPause}`,
    '-f', 'null', '-',
  ], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});

  if (run.error) throw run.error;
  const log = `${run.stderr ?? ''}${run.stdout ?? ''}`;
  if (!log.trim()) throw new Error('ffmpeg produced no log; is the file readable?');

  const silences = [];
  let open = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) { open = Math.max(0, Number(s[1])); continue; }
    const e = line.match(/silence_end:\s*(-?[\d.]+)/);
    if (e && open !== null) {
      silences.push({start: open, end: Math.min(duration, Number(e[1]))});
      open = null;
    }
  }
  // A silence still open at EOF runs to the end of the file.
  if (open !== null) silences.push({start: open, end: duration});

  const segs = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start > cursor + 0.02) segs.push({start: cursor, end: s.start});
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < duration - 0.02) segs.push({start: cursor, end: duration});

  return segs.filter((s) => s.end - s.start > 0.08);
}

// ────────────────────────────────────────────────────────────── script ──

/**
 * Split the script into the units a caption block is built from.
 *
 * Both script styles in this repo work: abraham/script.txt is one phrase per
 * line, the anxious script is blank-line separated prose. A line that is one
 * long paragraph is split further at sentence ends, because the reader pauses
 * there and the pause detector will have found it.
 */
function scriptSentences(text) {
  const out = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    // Split after . ? ! … and after a closing quote that follows one.
    const parts = line.split(/(?<=[.!?…]["'”’]?)\s+/);
    for (const p of parts) {
      const t = p.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’‐-―-]*/gu;

function wordsOf(sentence) {
  return sentence.match(WORD_RE) ?? [];
}

/**
 * Rough syllable count — how long a word takes to say.
 *
 * Exact phonetics are not needed: this only has to share a sentence's seconds
 * out among its words in roughly the right proportions, so "encouraged" gets
 * more room than "to".
 */
function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 1;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/e$/, '')
    .replace(/[^aeiouy]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return Math.max(1, groups.length);
}

const weightOf = (word) => syllables(word) + 0.35; // +0.35 ≈ the gap after a word

// ─────────────────────────────────────────────────────────── alignment ──

/**
 * Make the number of speech segments equal the number of sentences.
 *
 * More segments than sentences is the normal case: the reader takes a breath
 * mid-sentence. The shortest gap between two neighbouring segments is the one
 * most likely to be that breath rather than a sentence end, so segments are
 * merged across the shortest gaps first.
 *
 * Fewer segments than sentences means two sentences were read without a pause
 * between them. Then the longest segment is split by syllable weight.
 */
function fitSegments(segs, sentences) {
  let s = segs.map((x) => ({...x}));
  const want = sentences.length;

  while (s.length > want) {
    let bestIdx = 0;
    let bestGap = Infinity;
    for (let i = 0; i < s.length - 1; i++) {
      const gap = s[i + 1].start - s[i].end;
      if (gap < bestGap) { bestGap = gap; bestIdx = i; }
    }
    s.splice(bestIdx, 2, {start: s[bestIdx].start, end: s[bestIdx + 1].end});
  }

  while (s.length < want && s.length > 0) {
    let bestIdx = 0;
    let bestDur = -Infinity;
    for (let i = 0; i < s.length; i++) {
      const d = s[i].end - s[i].start;
      if (d > bestDur) { bestDur = d; bestIdx = i; }
    }
    const seg = s[bestIdx];
    const mid = seg.start + (seg.end - seg.start) / 2;
    s.splice(bestIdx, 1, {start: seg.start, end: mid}, {start: mid, end: seg.end});
  }

  return s;
}

/** Spread one sentence's words across its segment, by syllable weight. */
function timeSentence(sentence, seg) {
  const ws = wordsOf(sentence);
  if (!ws.length) return [];
  const weights = ws.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.12, seg.end - seg.start);

  const out = [];
  let t = seg.start;
  for (let i = 0; i < ws.length; i++) {
    const share = (weights[i] / total) * span;
    const start = t;
    const end = i === ws.length - 1 ? seg.end : Math.min(seg.end, t + share);
    out.push({word: ws[i], start: Number(start.toFixed(3)), end: Number(end.toFixed(3))});
    t = end;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────── main ──

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const slug = process.argv[2];
  if (!slug || slug.startsWith('--')) {
    console.error('Usage: node sync-offline.mjs <slug> [--noise -32dB] [--min-pause 0.35] [--dry]');
    process.exit(1);
  }

  const dir = path.resolve(`stories/${slug}`);
  const voicePath = path.join(dir, 'voice.mp3');
  const scriptPath = path.join(dir, 'script.txt');

  for (const [p, what] of [[voicePath, 'voice.mp3'], [scriptPath, 'script.txt']]) {
    if (!fs.existsSync(p)) {
      console.error(`\n[x] Missing ${what} in stories/${slug}/\n`);
      process.exit(1);
    }
  }

  const noise = argValue('--noise', DEFAULT_NOISE);
  const minPause = Number(argValue('--min-pause', DEFAULT_MIN_PAUSE));
  const dry = process.argv.includes('--dry');

  const duration = probeDuration(voicePath);
  const rawSegs = speechSegments(voicePath, duration, noise, minPause);
  const sentences = scriptSentences(fs.readFileSync(scriptPath, 'utf8'));

  if (!sentences.length) {
    console.error('\n[x] script.txt has no sentences.\n');
    process.exit(1);
  }
  if (!rawSegs.length) {
    console.error(`\n[x] No speech found at noise=${noise}. Try --noise -40dB.\n`);
    process.exit(1);
  }

  console.log(`\n  audio      ${duration.toFixed(2)}s`);
  console.log(`  speech     ${rawSegs.length} segments (pauses over ${minPause}s at ${noise})`);
  console.log(`  script     ${sentences.length} sentences`);

  const segs = fitSegments(rawSegs, sentences);
  const merged = Math.max(0, rawSegs.length - sentences.length);
  const split = Math.max(0, sentences.length - rawSegs.length);
  if (merged) console.log(`  fitted     merged ${merged} breath pause${merged === 1 ? '' : 's'}`);
  if (split) console.log(`  fitted     split ${split} run-on segment${split === 1 ? '' : 's'}`);

  const words = [];
  for (let i = 0; i < sentences.length; i++) {
    words.push(...timeSentence(sentences[i], segs[i]));
  }

  if (!words.length) {
    console.error('\n[x] No words timed.\n');
    process.exit(1);
  }

  // ── quality report ──
  const speechTotal = rawSegs.reduce((a, s) => a + (s.end - s.start), 0);
  const inSpeech = words.filter((w) => {
    const mid = (w.start + w.end) / 2;
    return rawSegs.some((s) => mid >= s.start - 0.05 && mid <= s.end + 0.05);
  }).length;
  const pct = ((inSpeech / words.length) * 100).toFixed(1);

  // What the old syllable estimate would have done: one flat spread over the
  // whole file, ignoring where the speaker actually is.
  const allWeights = sentences.flatMap((s) => wordsOf(s).map(weightOf));
  const wSum = allWeights.reduce((a, b) => a + b, 0);
  let et = 0;
  let drift = 0;
  for (let i = 0; i < words.length; i++) {
    const estStart = et;
    et += (allWeights[i] / wSum) * duration;
    drift = Math.max(drift, Math.abs(estStart - words[i].start));
  }

  console.log(`\n  words      ${words.length}`);
  console.log(`  on speech  ${inSpeech}/${words.length}  (${pct}%)`);
  console.log(`  voiced     ${speechTotal.toFixed(1)}s of ${duration.toFixed(1)}s`);
  console.log(`  vs estimate  worst drift the old estimate had here: ${drift.toFixed(2)}s`);

  if (dry) {
    console.log('\n  --dry: nothing written\n');
    console.log('  first 8:');
    for (const w of words.slice(0, 8)) {
      console.log(`    ${w.start.toFixed(2)}  ${w.word}`);
    }
    console.log('');
    return;
  }

  const dest = path.join(dir, 'words.json');
  fs.writeFileSync(dest, JSON.stringify({
    model: `offline-pause-align (ffmpeg silencedetect ${noise}/${minPause}s)`,
    duration,
    text: sentences.join(' '),
    words,
  }, null, 2));

  console.log(`\n[ok] stories/${slug}/words.json`);
  console.log(`     first: "${words[0].word}" at ${words[0].start.toFixed(2)}s`);
  console.log(`     last : "${words.at(-1).word}" at ${words.at(-1).start.toFixed(2)}s`);
  console.log('\n     Now run prepare.mjs — it will use these instead of the estimate.\n');
}

main();
