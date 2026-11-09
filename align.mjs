// align.mjs — map the script's words onto real timings from the audio.
//
// Whisper transcribes what it HEARS, which never matches the script exactly:
// it writes "chapter four verses six and seven" where the script says
// "Philippians 4:6-7", it drops filler, it mishears names. So the two word
// sequences have to be aligned rather than zipped together.
//
// The approach is a windowed greedy match with interpolation:
//   1. walk the script, looking a short way ahead in the transcript for each word
//   2. every confident match becomes an ANCHOR with a real timestamp
//   3. words between anchors get times interpolated across the gap
//
// Interpolating between anchors is what makes this safe. Even when a whole
// phrase is misheard, the words on either side are pinned to real audio, so
// the error stays local instead of shifting everything after it — which is
// exactly how the old syllable estimate drifted.

/** Strip to comparable form: lowercase letters and digits only. */
export const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9]/g, '');

/** How far ahead in the transcript to look for a match before giving up. */
const LOOKAHEAD = 8;

/**
 * How far the window may widen after a run of misses.
 *
 * A fixed window loses the thread for good when a long passage is misheard:
 * the transcript cursor stalls at the start of the bad patch while the script
 * walks past it, and every later word then falls outside the window. Measured
 * on a transcript with 60% of words mangled, a fixed window of 8 recovered 0%
 * of the script; widening on misses recovers the passage after it.
 */
const MAX_LOOKAHEAD = 160;

/**
 * Align script words to transcript words.
 *
 * @param {string[]} scriptWords  words as written in the script (spoken form)
 * @param {{word: string, start: number, end: number}[]} heard  from Whisper
 * @param {number} duration  audio length, used to bound the ends
 * @returns {{start: number, end: number, anchored: boolean}[]} one per script word
 */
export function alignWords(scriptWords, heard, duration) {
  const S = scriptWords.map(norm);
  const H = heard.map((h) => ({...h, n: norm(h.word)}));

  // ── 1. Anchors ──
  const times = new Array(S.length).fill(null);
  let hi = 0;
  let misses = 0;
  for (let si = 0; si < S.length; si++) {
    if (!S[si]) continue;
    // The window stays tight while the two sequences agree, so a common word
    // ("the", "God") matches the NEXT occurrence rather than a far later one.
    // It opens only after a run of misses, which is the signal that the cursor
    // has been left behind by a misheard passage.
    const reach = Math.min(MAX_LOOKAHEAD, LOOKAHEAD + misses * LOOKAHEAD);
    const limit = Math.min(H.length, hi + reach);
    let hit = -1;
    for (let k = hi; k < limit; k++) {
      if (!H[k].n || H[k].n !== S[si]) continue;
      // A jump beyond the tight window has to be corroborated: a lone "the"
      // 90 words downstream is far more likely to be a coincidence than the
      // real continuation, and following it would skip everything between.
      if (k - hi >= LOOKAHEAD && !pairAhead(S, H, si, k)) continue;
      hit = k;
      break;
    }
    if (hit < 0) { misses++; continue; }
    times[si] = {start: H[hit].start, end: H[hit].end};
    hi = hit + 1;
    misses = 0;
  }

  // ── 2. Fill the gaps ──
  // Anchors are real; everything between them is spread evenly across the gap.
  const anchors = [];
  times.forEach((t, i) => { if (t) anchors.push(i); });

  if (!anchors.length) return null; // nothing matched — caller falls back

  const out = new Array(S.length);
  for (let i = 0; i < S.length; i++) {
    if (times[i]) { out[i] = {...times[i], anchored: true}; continue; }

    const prev = lastBefore(anchors, i);
    const next = firstAfter(anchors, i);

    if (prev == null && next == null) {
      out[i] = {start: 0, end: duration, anchored: false};
    } else if (prev == null) {
      // Before the first anchor: back-fill from the start of the audio.
      const span = times[next].start;
      const share = span / Math.max(1, next);
      out[i] = {start: i * share, end: (i + 1) * share, anchored: false};
    } else if (next == null) {
      // After the last anchor: run on to the end of the audio.
      const from = times[prev].end;
      const span = Math.max(0.2, duration - from);
      const n = S.length - prev;
      const share = span / Math.max(1, n);
      const k = i - prev;
      out[i] = {start: from + (k - 1) * share, end: from + k * share, anchored: false};
    } else {
      const from = times[prev].end;
      const to = times[next].start;
      const n = next - prev;
      const share = Math.max(0.02, (to - from) / Math.max(1, n));
      const k = i - prev;
      out[i] = {start: from + (k - 1) * share, end: from + k * share, anchored: false};
    }
  }

  // Keep the sequence monotonic: a misheard patch must never move time backwards.
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].start;
    if (out[i].end < out[i].start) out[i].end = out[i].start + 0.05;
  }
  return out;
}

/** True when the word after S[si] also follows H[k] — a two-word confirmation. */
function pairAhead(S, H, si, k) {
  for (let a = si + 1; a < S.length; a++) {
    if (!S[a]) continue;
    for (let b = k + 1; b < Math.min(H.length, k + 4); b++) {
      if (H[b].n && H[b].n === S[a]) return true;
    }
    return false;
  }
  return true; // S[si] was the last word; nothing left to corroborate with
}

function lastBefore(sorted, i) {
  let r = null;
  for (const a of sorted) { if (a < i) r = a; else break; }
  return r;
}
function firstAfter(sorted, i) {
  for (const a of sorted) if (a > i) return a;
  return null;
}

/**
 * Turn aligned word times into start/end for each caption chunk.
 *
 * @param {string[]} chunks   caption chunks, in order, as SPOKEN text
 * @param {object[]} wordTimes  output of alignWords, one per script word
 * @param {number} duration
 */
export function timeChunks(chunks, wordTimes, duration) {
  const segs = [];
  let w = 0;
  for (const chunk of chunks) {
    const n = chunk.split(/\s+/).filter(Boolean).length;
    const first = wordTimes[w];
    const last = wordTimes[Math.min(wordTimes.length - 1, w + n - 1)];
    w += n;
    if (!first || !last) break;
    segs.push({
      s: round2(Math.max(0, first.start)),
      e: round2(Math.min(duration, Math.max(first.start + 0.3, last.end))),
    });
  }

  // No caption may start before the previous one ended.
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].s < segs[i - 1].e) segs[i].s = round2(segs[i - 1].e + 0.02);
    if (segs[i].e <= segs[i].s) segs[i].e = round2(segs[i].s + 0.3);
  }
  return segs;
}

/** Share of script words that matched the audio directly. */
export function anchorRate(wordTimes) {
  if (!wordTimes?.length) return 0;
  return wordTimes.filter((t) => t.anchored).length / wordTimes.length;
}

function round2(n) { return parseFloat(Number(n).toFixed(2)); }
