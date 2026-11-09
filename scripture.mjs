// scripture.mjs — rewrite spoken scripture references into written form.
//
// Narration says "Philippians chapter four, verses six and seven" because that
// is how it is read aloud. On screen it should read "Philippians 4:6-7".
// Only the reference is rewritten; the rest of the sentence is untouched.

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs', 'Ecclesiastes',
  'Song of Solomon', 'Song of Songs', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

/** Spoken ordinals that prefix a book name: "first Corinthians" -> "1 Corinthians". */
const BOOK_PREFIX = {first: '1', second: '2', third: '3', 1: '1', 2: '2', 3: '3'};

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = {twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};

/**
 * Parse a spelled-out number: "six", "fifty-six", "one hundred nineteen".
 * Returns null if the words are not a number.
 */
export function wordsToNumber(text) {
  if (text == null) return null;
  const raw = String(text).toLowerCase().trim();
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);

  const words = raw.replace(/-/g, ' ').split(/\s+/).filter((w) => w && w !== 'and');
  if (!words.length) return null;

  let total = 0;
  let current = 0;
  let saw = false;

  for (const w of words) {
    if (w in UNITS) { current += UNITS[w]; saw = true; }
    else if (w in TENS) { current += TENS[w]; saw = true; }
    else if (w === 'hundred') { current = Math.max(1, current) * 100; saw = true; }
    else if (w === 'thousand') { total += Math.max(1, current) * 1000; current = 0; saw = true; }
    else return null; // not part of a number
  }
  return saw ? total + current : null;
}

// A number is digits, or one or more number WORDS. Built from the actual
// vocabulary rather than [a-z]+, so the match is greedy and exact:
// "one hundred nineteen" must not truncate to "one".
const SMALL_WORDS = [...Object.keys(UNITS), ...Object.keys(TENS)]
  .sort((a, b) => b.length - a.length).join('|');
const SMALL = `(?:${SMALL_WORDS})`;

// "and" may only join a number AFTER hundred/thousand ("one hundred and five").
// Allowing it anywhere makes "verses six and seven" parse as the single number
// thirteen, which silently turns Philippians 4:6-7 into Philippians 4:13.
const NUM = `(?:\\d+|${SMALL}(?:[\\s-]+${SMALL})*` +
  `(?:[\\s-]+(?:hundred|thousand)(?:[\\s-]+and)?(?:[\\s-]+${SMALL}(?:[\\s-]+${SMALL})*)?)*)`;

/** Book names with any numeric prefix stripped, longest first. */
const BASE_BOOKS = [...new Set(BOOKS.map((b) => b.replace(/^\d\s+/, '')))]
  .sort((a, b) => b.length - a.length);
const BOOK_ALT = BASE_BOOKS.map((b) => b.replace(/\s+/g, '\\s+')).join('|');

/** Canonical capitalisation for a matched book name. */
function canonicalBook(matched) {
  const key = String(matched).toLowerCase().replace(/\s+/g, ' ').trim();
  return BASE_BOOKS.find((b) => b.toLowerCase() === key) ?? matched;
}

/**
 * Rewrite every spoken scripture reference in a line.
 *
 *   "Philippians chapter four, verses six and seven"  -> "Philippians 4:6-7"
 *   "Psalm fifty-six, verse three"                    -> "Psalm 56:3"
 *   "Matthew chapter six"                             -> "Matthew 6"
 */
export function formatScripture(line) {
  if (!line) return line;

  const re = new RegExp(
    `\\b(?:(first|second|third|[123])\\s+)?(${BOOK_ALT})` +   // 1 prefix, 2 book
    `(?:\\s+chapter)?\\s+(${NUM})` +                          // 3 chapter
    `(?:\\s*,?\\s*(?:verses|verse|vv?\\.?)\\s+(${NUM})` +  // 4 first verse
    `(?:\\s*(?:and|through|to|-|\u2013)\\s*(${NUM}))?)?`,     // 5 last verse
    'gi',
  );

  return line.replace(re, (match, prefix, book, chapRaw, v1Raw, v2Raw) => {
    const chapter = wordsToNumber(chapRaw);
    if (chapter == null) return match; // the words after the book were not a number

    const pre = prefix ? `${BOOK_PREFIX[String(prefix).toLowerCase()] ?? prefix} ` : '';
    const name = canonicalBook(book);

    const v1 = v1Raw != null ? wordsToNumber(v1Raw) : null;
    const v2 = v2Raw != null ? wordsToNumber(v2Raw) : null;

    if (v1 == null) return `${pre}${name} ${chapter}`;
    if (v2 == null) return `${pre}${name} ${chapter}:${v1}`;
    return `${pre}${name} ${chapter}:${v1}-${v2}`;
  });
}
