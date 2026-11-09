#!/usr/bin/env node
// prepare.mjs — Faith Reel Studio automation
// Usage: node prepare.mjs <slug> [duration_in_seconds]
//
// Steps this script handles automatically:
//  1. Reads stories/<slug>/script.txt  (your narration lines)
//  2. Reads stories/<slug>/story.json  (title, scripture; scenes optional)
//  3. Reads stories/<slug>/voice.mp3   (ElevenLabs export)
//  4. Detects audio duration via ffprobe (or estimates from syllable count)
//  5. Splits long lines into readable caption chunks
//  6. Times each chunk by SYLLABLES + punctuation pauses, normalised to the
//     exact audio length so captions never drift away from the voice
//  7. One chunk per caption block — a single sentence on screen at a time
//  8. Picks a scene per ~9.5s window by matching THAT window's own words,
//     so two different scripts produce two different scene sequences
//  9. Copies voice.mp3 -> public/story-voice.mp3  (NEVER touches voice.mp3)
// 10. Writes src/story-timeline.ts (auto-generated, safe to regenerate)
//
// All execution lives in main(), called at the bottom of this file, so every
// module-level constant below is fully initialised before anything runs.

import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import {composeScene, detectSetting} from './analyse.mjs';
import {mp3Duration} from './mp3duration.mjs';
import {formatScripture} from './scripture.mjs';
import {alignWords, timeChunks, anchorRate} from './align.mjs';
import {planPrompts} from './prompt-plan.mjs';

// ═══ Tuning ═══════════════════════════════════════════════════════════════════

const MIN_ANCHOR_RATE = 0.55; // below this the transcript isn't the same text as the script
const LEAD_IN        = 0.45;  // silence before the first caption (seconds)
const TAIL_PAD       = 0.10;  // keep the last caption just inside the audio
const MAX_WORDS      = 13;    // hard cap on words shown on screen at once
const CAPTION_GAP    = 0.06;  // visual breath between captions (seconds)
// The reference reels cut every 3-4 seconds. At 9.5s the video reads as a
// slideshow however good each frame is.
const SCENE_TARGET_S = 3.5;
const SCENE_MIN      = 4;
const SCENE_MAX      = 40;
const FPS            = 30;

// Pause cost in "syllable equivalents" — tuned against natural narration.
const PAUSE_SENTENCE = 1.30;  // . ! ?
const PAUSE_CLAUSE   = 0.55;  // , ; :
const PAUSE_DASH     = 0.50;  // — –
const PAUSE_ELLIPSIS = 1.00;  // …

// Words that make an acceptable caption break when no punctuation is available.
const CONJUNCTIONS = /^(and|but|so|because|that|when|then|for|yet|or|if|though|while|as|since|until)$/i;

// Words rendered in ember/caps for emphasis.
const EMPHASIS = [
  'god', 'jesus', 'christ', 'lord', 'spirit', 'father', 'king',
  'faith', 'trust', 'hope', 'grace', 'mercy', 'peace', 'love', 'joy',
  'promise', 'provide', 'cross', 'blood', 'light', 'life', 'truth',
  'forgive', 'free', 'healed', 'saved', 'risen', 'eternal', 'never', 'always',
];

// ═══ Main ═════════════════════════════════════════════════════════════════════

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node prepare.mjs <slug> [duration_in_seconds]');
    console.error('Example: node prepare.mjs trust-anxiety');
    console.error('Example: node prepare.mjs trust-anxiety 72.4');
    process.exit(1);
  }

  const storyDir   = path.resolve(`stories/${slug}`);
  const scriptPath = path.join(storyDir, 'script.txt');
  const configPath = path.join(storyDir, 'story.json');
  const voicePath  = path.join(storyDir, 'voice.mp3');

  if (!fs.existsSync(scriptPath)) { console.error(`❌ Missing: ${scriptPath}`); process.exit(1); }
  if (!fs.existsSync(configPath)) { console.error(`❌ Missing: ${configPath}`); process.exit(1); }
  if (!fs.existsSync(voicePath))  {
    console.error(`❌ Missing: ${voicePath}`);
    console.error('   Export your ElevenLabs narration as MP3 and save it there.');
    process.exit(1);
  }

  // ─── Load inputs ────────────────────────────────────────────────────────────
  const story      = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const scriptText = fs.readFileSync(scriptPath, 'utf8').trim();
  const rawLines   = scriptText.split('\n').map(l => l.trim()).filter(Boolean);

  if (!rawLines.length) { console.error('❌ script.txt is empty'); process.exit(1); }

  // ─── Split long lines into screen-sized chunks ──────────────────────────────
  const chunks = rawLines.flatMap(splitLine);
  console.log(`✓ Script lines   : ${rawLines.length}  →  ${chunks.length} caption chunks`);

  // ─── Audio duration ─────────────────────────────────────────────────────────
  let duration = parseFloat(process.argv[3] || '0');
  if (!duration) duration = detectDuration(voicePath, chunks, slug);
  if (!duration || Number.isNaN(duration)) {
    console.error('❌ Could not detect audio duration.');
    console.error(`   Run: node prepare.mjs ${slug} <duration_in_seconds>`);
    process.exit(1);
  }
  console.log(`✓ Audio duration : ${duration.toFixed(2)}s`);

  // ─── Safety check — Abraham's files untouched ───────────────────────────────
  ['public/voice.mp3', 'public/pad.mp3', 'src/timeline.ts', 'src/Reel.tsx', 'src/Scenes.tsx'].forEach(f => {
    if (fs.existsSync(f)) console.log(`✓ Protected (unchanged): ${f}`);
  });

  // ─── Copy voice to public slot ──────────────────────────────────────────────
  fs.mkdirSync('public', {recursive: true});
  fs.copyFileSync(voicePath, 'public/story-voice.mp3');
  console.log('✓ Copied to public/story-voice.mp3');

  // ─── Caption timing ─────────────────────────────────────────────────────────
  // Two sources, in order of preference:
  //
  //   1. stories/<slug>/words.json — real word timestamps read out of the MP3
  //      by transcribe.mjs, aligned to the script. This is the only source that
  //      knows where the narrator actually paused, sped up or drew a word out.
  //   2. a syllable + punctuation estimate, scaled so the weights sum to exactly
  //      the audio length. Never drifts cumulatively, but on a read with an
  //      uneven pace it sits about 1.5s out on average.
  //
  // Captions show written references ("Philippians 4:6-7") while the narrator
  // speaks them in full ("Philippians chapter four, verses six and seven").
  // Timing is therefore computed on the SPOKEN text, and only the displayed
  // text is rewritten.
  const display   = chunks.map(formatScripture);
  const rewritten = display.filter((d, i) => d !== chunks[i]).length;
  if (rewritten) console.log(`\u2713 Scripture refs  : ${rewritten} rewritten for display`);

  const weights     = chunks.map(chunkWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const usable      = Math.max(1, duration - LEAD_IN - TAIL_PAD);
  const secPerUnit  = usable / totalWeight;

  let times = timesFromAudio(slug, chunks, duration);
  if (!times) {
    let cursor = LEAD_IN;
    times = chunks.map((_, i) => {
      const s = round2(cursor);
      cursor += weights[i] * secPerUnit;              // always the true share
      return {s, e: round2(Math.min(Math.max(cursor - CAPTION_GAP, s + 0.3), duration - 0.04))};
    });
    console.log('\u2713 Caption timing : syllable estimate');
    console.log('                   (run `node transcribe.mjs ' + slug + '` once for timing read from the audio)');
  }

  const segs = chunks.map((spoken, i) => {
    const text = display[i];
    const kw   = extractKeywords(text);
    const seg  = {s: times[i].s, e: times[i].e, text};
    return kw.length ? {...seg, kw} : seg;
  });

  const wordCount = chunks.join(' ').split(/\s+/).filter(Boolean).length;
  console.log(`✓ Pace           : ${((wordCount / duration) * 60).toFixed(0)} words/min (${(1 / secPerUnit).toFixed(1)} syllables/sec)`);

  // ─── Build BLOCKS — one sentence on screen at a time ────────────────────────
  const blocks = segs.map((_, i) => [i]);

  // ─── Build SCENES ───────────────────────────────────────────────────────────
  // Each window is COMPOSED from its own wording rather than picked from a
  // fixed library, so a new story needs no new scene code.
  const scenes = buildScenes(segs, duration, slug);

  // ─── Scene plan: one image prompt per scene ─────────────────────────────────
  // Written whether or not a generator is configured, so `node fetch-images.mjs`
  // can be run at any time afterwards.
  const windows = scenes.map((sc) => {
    const inside = segs.filter((g) => g.s >= sc.s - 0.3 && g.s < sc.e);
    return (inside.length ? inside : [segs[0]]).map((g) => g.text).join(' ');
  });
  const plans = planPrompts(windows);
  const MOVES = ['inC', 'inL', 'inR', 'panL', 'panR', 'outC'];
  const scenePlan = plans.map((p, i) => ({
    index: i,
    kind: p.kind,
    place: p.place,
    characters: p.characters,
    text: windows[i].slice(0, 160),
    prompt: p.prompt,
    seed: Math.abs(hashString(`${slug}${i}`)) % 100000,
  }));
  fs.writeFileSync(path.join(storyDir, 'scene-plan.json'), JSON.stringify(scenePlan, null, 2), 'utf8');
  console.log(`\u2713 Scene plan     : stories/${slug}/scene-plan.json`);
  {
    const byKind = {};
    for (const p of plans) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
    console.log(`  ${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ')}`);
  }

  // ─── Attach any already-generated images ────────────────────────────────────
  const manifestPath = path.resolve('public/scenes/manifest.json');
  let withImages = 0;
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const byIndex = new Map(manifest.map((m) => [m.index, m.file]));
      scenes.forEach((sc, i) => {
        const file = byIndex.get(i);
        if (file) { sc.image = file; sc.move = MOVES[i % MOVES.length]; withImages += 1; }
      });
      console.log(`\u2713 Scene images    : ${withImages}/${scenes.length} from public/scenes/`);
      if (withImages < scenes.length) {
        console.log(`  ${scenes.length - withImages} scene(s) will render as vector art.`);
      }
    } catch {
      console.warn('\u26a0\ufe0f  public/scenes/manifest.json could not be read — rendering all scenes as vector art.');
    }
  } else {
    console.log('\u2139\ufe0f  No generated images yet. All scenes render as vector art.');
    console.log(`   To generate them:  node fetch-images.mjs ${slug}`);
    console.log('   (AI Horde by default \u2014 free, no account, no API key.)');
    console.log('   Then re-run this script to attach them, and render.');
  }

  // ─── Write story-timeline.ts ────────────────────────────────────────────────
  fs.mkdirSync('src', {recursive: true});
  fs.writeFileSync('src/story-timeline.ts', buildTimeline(segs, blocks, scenes, duration, story, slug), 'utf8');
  console.log('✓ Written: src/story-timeline.ts');

  console.log('\n✅ Done! Next steps:');
  console.log('   Preview : npm run studio        (select "StoryReel" in the left panel)');
  console.log(`   Render  : node render.mjs video ${slug}  →  out/${slug}-reel.mp4`);
}

// ═══ Helpers ══════════════════════════════════════════════════════════════════

function round2(n) { return parseFloat(n.toFixed(2)); }

/** Small stable hash, used to give each scene a deterministic generator seed. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

// ─── Caption chunking ─────────────────────────────────────────────────────────

/**
 * Break a line longer than MAX_WORDS into screen-sized chunks, preferring
 * punctuation breaks, then conjunctions, and only then a neutral midpoint.
 */
function splitLine(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) return [text];

  const mid = words.length / 2;
  let best = -1;
  let bestCost = Infinity;

  for (let i = 2; i <= words.length - 2; i++) {
    const prev = words[i - 1];
    let cost = Math.abs(i - mid);
    if (/[,;:]$/.test(prev))              cost -= 7;
    else if (/[—–]$/.test(prev))          cost -= 6;
    else if (CONJUNCTIONS.test(words[i])) cost -= 3;
    else                                  cost += 5; // mid-phrase break: last resort
    if (cost < bestCost) { bestCost = cost; best = i; }
  }
  if (best < 0) best = Math.round(mid);

  return [
    ...splitLine(words.slice(0, best).join(' ')),
    ...splitLine(words.slice(best).join(' ')),
  ];
}

// ─── Timing model ─────────────────────────────────────────────────────────────

/** Approximate spoken syllables in a single word. */
function syllables(word) {
  const raw = word.toLowerCase();

  // Digits are read out, which takes far longer than their character count.
  const digits = raw.match(/\d+/g);
  const extra = digits
    ? digits.reduce((sum, d) => sum + Math.max(1, Math.round(d.length * 1.3)), 0)
    : 0;

  const w = raw.replace(/[^a-z]/g, '');
  if (!w) return Math.max(extra, 0.5);
  if (w.length <= 3) return 1 + extra;

  const trimmed = w
    .replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, '') // silent trailing e / -es
    .replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1) + extra;
}

/** Total weight of a chunk: spoken syllables plus the pauses its punctuation implies. */
/**
 * Caption times read from the narration itself, or null to fall back.
 *
 * Whisper transcribes what it hears, which never matches the script word for
 * word, so align.mjs anchors the words that do match and interpolates the rest.
 * A low anchor rate means the transcript and the script are not the same text
 * — a stale words.json, or the wrong MP3 — and guessing from it would be worse
 * than the estimate, so this refuses rather than returning something plausible.
 */
function timesFromAudio(slug, chunks, duration) {
  const p = path.resolve(`stories/${slug}/words.json`);
  if (!fs.existsSync(p)) return null;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.warn(`\u26a0\ufe0f  words.json could not be read (${err.message}) — using the estimate.`);
    return null;
  }
  const heard = Array.isArray(data?.words) ? data.words : [];
  if (heard.length < 10) {
    console.warn('\u26a0\ufe0f  words.json has almost no words — using the estimate.');
    return null;
  }

  // A words.json cut from a different take would misplace every caption.
  if (Number.isFinite(data.duration) && Math.abs(data.duration - duration) > 1) {
    console.warn(`\u26a0\ufe0f  words.json is ${data.duration.toFixed(1)}s but voice.mp3 is ${duration.toFixed(1)}s`);
    console.warn('    — the transcript is from a different recording. Re-run transcribe.mjs.');
    return null;
  }

  const scriptWords = chunks.join(' ').split(/\s+/).filter(Boolean);
  const aligned = alignWords(scriptWords, heard, duration);
  if (!aligned) {
    console.warn('\u26a0\ufe0f  No word of the script matched the transcript — using the estimate.');
    return null;
  }

  const rate = anchorRate(aligned);
  if (rate < MIN_ANCHOR_RATE) {
    console.warn(`\u26a0\ufe0f  Only ${Math.round(rate * 100)}% of the script matched the audio` +
                 ` (need ${Math.round(MIN_ANCHOR_RATE * 100)}%) — using the estimate.`);
    console.warn('    Check that script.txt and voice.mp3 are the same take.');
    return null;
  }

  const t = timeChunks(chunks, aligned, duration);
  if (t.length !== chunks.length) {
    console.warn(`\u26a0\ufe0f  Timed only ${t.length} of ${chunks.length} captions — using the estimate.`);
    return null;
  }

  console.log(`\u2713 Caption timing : read from the audio (${Math.round(rate * 100)}% of words matched)`);
  return t;
}

function chunkWeight(text) {
  const words = text.split(/\s+/).filter(Boolean);
  let w = words.reduce((sum, word) => sum + syllables(word), 0);

  w += (text.match(/\.\.\.|…/g) || []).length * PAUSE_ELLIPSIS;
  w += (text.match(/[.!?](?!\.)/g) || []).length * PAUSE_SENTENCE;
  w += (text.match(/[,;:]/g) || []).length * PAUSE_CLAUSE;
  w += (text.match(/[—–]/g) || []).length * PAUSE_DASH;

  // A chunk with no end punctuation is a mid-sentence split: it flows straight on.
  if (!/[.!?]$/.test(text.trim())) w += 0.15;

  return Math.max(1, w);
}

function detectDuration(filepath, chunks, slug) {
  // 0. Read the MP3's own frame headers. No dependency, exact, and works on
  //    machines where ffprobe is not installed — which is most Windows setups.
  //    This has to come first: the syllable fallback below ran ~6% long on a
  //    real narration, leaving seconds of captions with no voice behind them.
  try {
    const d = mp3Duration(filepath);
    if (d > 0 && Number.isFinite(d)) {
      console.log(`\u2713 Audio length read from the file: ${d.toFixed(2)}s`);
      return d;
    }
  } catch { /* fall through to the external probes */ }

  const probes = [
    // 1. System ffprobe (works if ffmpeg is installed)
    () => {
      const r = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filepath}"`,
        {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']},
      );
      return parseFloat(r.trim());
    },
    // 2. Remotion's bundled compositor binary
    () => {
      const comp = findCompositor();
      if (!comp) throw new Error('no compositor');
      const r = execSync(
        `"${comp}" ffprobe -v error -show_entries format=duration -of csv=p=0 "${filepath}"`,
        {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']},
      );
      return parseFloat(r.trim());
    },
  ];
  for (const probe of probes) {
    try {
      const d = probe();
      if (d > 0 && !Number.isNaN(d)) { console.log(`✓ Detected via ffprobe: ${d.toFixed(2)}s`); return d; }
    } catch { /* try the next probe */ }
  }
  // 3. Estimate from syllables (~4.3 syllables/sec is typical narration pace)
  const syl = chunks.reduce((sum, c) => sum + chunkWeight(c), 0);
  const est = round2(syl / 4.3);
  console.warn(`⚠️  ffprobe not found — estimating ${est}s from ${Math.round(syl)} syllables`);
  console.warn(`   For accurate timing: node prepare.mjs ${slug} <actual_seconds>`);
  return est;
}

function findCompositor() {
  const candidates = [
    'node_modules/@remotion/compositor-win32-x64-msvc/remotion.exe',
    'node_modules/@remotion/compositor-linux-x64-gnu/remotion',
    'node_modules/@remotion/compositor-darwin-arm64/remotion',
    'node_modules/@remotion/compositor-darwin-x64/remotion',
  ];
  return candidates.find(c => fs.existsSync(c)) || null;
}

/** Words rendered in ember/caps for emphasis. Max 2 per caption so it stays calm. */
function extractKeywords(text) {
  const kw = new Set();

  const quoted = text.match(/"([^"]+)"/g) || [];
  quoted.forEach(q =>
    q.replace(/"/g, '').toLowerCase().split(/\s+/).slice(0, 2)
      .forEach(w => { if (w.length > 3) kw.add(w.replace(/[^a-z\-]/g, '')); }));

  for (const k of EMPHASIS) {
    if (kw.size >= 2) break;
    if (new RegExp(`\\b${k}`, 'i').test(text)) kw.add(k);
  }
  return [...kw].slice(0, 2);
}

// ─── Scene construction ────────────────────────────────────────

/**
 * Split the script into roughly equal time windows (always breaking on a
 * segment boundary) and compose a scene for each from that window's own words.
 */
function buildScenes(segs, duration, storySeed) {
  const count = clamp(Math.round(duration / SCENE_TARGET_S), SCENE_MIN, Math.min(SCENE_MAX, segs.length));

  // Split at the segment boundary NEAREST each target time. Accumulating until
  // a segment overshoots the window instead would merge segments whenever they
  // are long, yielding far fewer and much longer scenes than SCENE_TARGET_S.
  const splitAt = new Set();
  for (let k = 1; k < count; k++) {
    const target = (k * duration) / count;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 1; i < segs.length; i++) {
      if (splitAt.has(i)) continue;
      const dist = Math.abs(segs[i].s - target);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (best > 0) splitAt.add(best);
  }

  const groups = [];
  let current = [];
  segs.forEach((seg, i) => {
    if (splitAt.has(i) && current.length) { groups.push(current); current = []; }
    current.push(seg);
  });
  if (current.length) groups.push(current);

  // Thread setting/tone through the windows so the story keeps a place and a
  // mood instead of snapping somewhere new whenever a sentence names nothing.
  // Seed the opening window with the script's dominant setting: a story often
  // introduces a person several sentences before it names the place.
  // The script's dominant location, if it has one. Used both to open the video
  // in the right place and to return there when a passage names no setting.
  // Three or more mentions: the script is genuinely set somewhere. Fewer than
  // that and it is a teaching script, which should range across landscapes.
  const anchor = detectSetting(segs.map((g) => g.text).join(' '), 3) ?? undefined;
  let carry = {setting: anchor, anchor};
  const scenes = groups.map((group, i) => {
    const text = group.map((g) => g.text).join(' ');
    const s = i === 0 ? 0 : Math.max(0, group[0].s - 0.25);
    const e = i === groups.length - 1 ? duration : group[group.length - 1].e + 0.25;
    const spec = composeScene(text, i, groups.length, storySeed, s, e, carry);
    carry = spec._carry ?? {};
    delete spec._carry;
    return spec;
  });

  console.log(`\u2713 Composed ${scenes.length} scenes (~${(duration / count).toFixed(1)}s each)`);
  scenes.forEach((sc, i) => {
    const bits = [];
    if (sc.structures?.length) bits.push(sc.structures.map((x) => x.kind).join('+'));
    if (sc.cast?.length) bits.push(sc.cast.map((x) => x.animal || x.kind).join('+'));
    if (sc.props?.length) bits.push(sc.props.map((x) => x.kind).join('+'));
    if (sc.weather && sc.weather.kind !== 'none') bits.push(sc.weather.kind);
    console.log(`   ${String(i + 1).padStart(2)}. ${sc.id.padEnd(22)} ${bits.join(' / ')}`);
  });
  return scenes;
}

// ─── Output ───────────────────────────────────────────────────────────────────

function buildTimeline(segs, blocks, scenes, duration, story, slug) {
  const segLines = segs.map(s => {
    const kw = s.kw ? `, kw: ${JSON.stringify(s.kw)}` : '';
    return `  {s: ${s.s}, e: ${s.e}, text: ${JSON.stringify(s.text)}${kw}}`;
  }).join(',\n');

  const blockLines = blocks.map(b => `  [${b.join(', ')}]`).join(',\n');
  // Specs are emitted as literals so the renderer needs no parsing step.
  const sceneLines = scenes.map(sc => '  ' + JSON.stringify(sc)).join(',\n');
  const totalFrames = Math.ceil(duration * FPS);

  return `// AUTO-GENERATED by prepare.mjs — do not edit manually
// Story : ${story.title} (${story.scripture || 'No scripture'})
// Regen : node prepare.mjs ${slug}
import type {Seg} from './timeline';
import type {SceneSpec} from './SceneSpec';

export const STORY_SEGS: Seg[] = [
${segLines},
];

export const STORY_BLOCKS: number[][] = [
${blockLines},
];

export const STORY_SCENES: SceneSpec[] = [
${sceneLines},
];

export const STORY_DURATION     = ${duration};
export const STORY_FPS          = ${FPS};
export const STORY_TOTAL_FRAMES = ${totalFrames};
export const STORY_TITLE        = ${JSON.stringify(story.title)};
export const STORY_SCRIPTURE    = ${JSON.stringify(story.scripture || '')};
`;
}

main();
