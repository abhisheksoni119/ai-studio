// Voice timing: each line of the script with start/end (seconds) and highlight words.
export type Seg = {s: number; e: number; text: string; kw?: string[]};

export const SEGS: Seg[] = [
  {s: 0.0, e: 1.82, text: 'Why would God ask a father...', kw: ['father']},
  {s: 2.23, e: 3.85, text: 'to sacrifice his own son?', kw: ['son']},
  {s: 4.39, e: 6.39, text: "It's one of the hardest stories in the Bible.", kw: ['hardest']},
  {s: 6.82, e: 9.68, text: 'Abraham waited twenty-five years for a son.', kw: ['twenty-five']},
  {s: 10.21, e: 11.38, text: 'Isaac was the promise.', kw: ['promise']},
  {s: 11.86, e: 12.7, text: 'And then God says:'},
  {s: 13.15, e: 17.16, text: '"Take now thy son, thine only son Isaac, whom thou lovest."', kw: ['only']},
  {s: 17.6, e: 20.36, text: 'For three days, Abraham walks toward the mountain.', kw: ['three', 'days']},
  {s: 20.84, e: 22.51, text: 'Isaac carries the wood on his back.', kw: ['wood']},
  {s: 22.97, e: 23.82, text: 'Then Isaac asks:'},
  {s: 24.22, e: 24.64, text: '"Father...'},
  {s: 25.03, e: 25.92, text: 'where is the lamb?"', kw: ['lamb']},
  {s: 26.35, e: 27.29, text: 'And Abraham answers:'},
  {s: 27.74, e: 29.59, text: '"God will provide himself a lamb."', kw: ['provide']},
  {s: 30.13, e: 32.34, text: 'At the top, Abraham raises the knife...', kw: ['knife']},
  {s: 32.82, e: 33.7, text: 'and God stops him.', kw: ['stops']},
  {s: 34.15, e: 35.43, text: 'Caught in a thicket nearby —'},
  {s: 35.91, e: 36.31, text: 'a ram.', kw: ['ram']},
  {s: 36.89, e: 38.03, text: 'So why the test?', kw: ['test']},
  {s: 38.45, e: 40.77, text: 'In that world, gods demanded children.', kw: ['children']},
  {s: 41.24, e: 42.34, text: "Abraham's neighbors did it."},
  {s: 42.82, e: 44.41, text: 'But this God stopped the knife.', kw: ['stopped']},
  {s: 44.82, e: 49.69, text: 'He was showing Abraham — and every generation after — that He is not that kind of God.', kw: ['not']},
  {s: 50.14, e: 51.42, text: 'Abraham named the place:'},
  {s: 51.81, e: 52.98, text: '"The Lord will provide."', kw: ['provide']},
  {s: 53.43, e: 54.94, text: "But here's what most people miss.", kw: ['miss']},
  {s: 55.33, e: 60.53, text: 'Centuries later, on that same mountain range, another Father would give his only Son.', kw: ['father', 'son']},
  {s: 60.98, e: 62.96, text: 'Another Son would carry wood on his back.', kw: ['wood']},
  {s: 63.39, e: 65.41, text: 'And this time... no one stopped it.', kw: ['no', 'one']},
  {s: 65.84, e: 67.61, text: 'Because the lamb Abraham promised...', kw: ['lamb']},
  {s: 67.99, e: 69.25, text: 'was always coming.', kw: ['coming']},
];

// Caption blocks: segments shown together on screen (indices into SEGS)
export const BLOCKS: number[][] = [
  [0, 1], [2], [3, 4], [5, 6], [7], [8], [9, 10, 11], [12, 13], [14, 15], [16, 17], [18],
  [19, 20], [21], [22], [23, 24], [25], [26], [27], [28], [29, 30],
];

// Scene cuts (seconds)
export const SCENES: {id: string; s: number; e: number}[] = [
  {id: 'hook', s: 0, e: 4.1},
  {id: 'book', s: 4.1, e: 6.6},
  {id: 'stars', s: 6.6, e: 11.6},
  {id: 'call', s: 11.6, e: 17.4},
  {id: 'journey', s: 17.4, e: 22.7},
  {id: 'lamb', s: 22.7, e: 29.85},
  {id: 'altar', s: 29.85, e: 34.0},
  {id: 'ram', s: 34.0, e: 36.6},
  {id: 'idols', s: 36.6, e: 44.6},
  {id: 'generations', s: 44.6, e: 49.9},
  {id: 'jireh', s: 49.9, e: 53.2},
  {id: 'miss', s: 53.2, e: 55.1},
  {id: 'centuries', s: 55.1, e: 63.2},
  {id: 'cross', s: 63.2, e: 65.6},
  {id: 'end', s: 65.6, e: 69.8},
];

export const FPS = 30;
export const TOTAL_FRAMES = Math.ceil(69.8 * FPS);
