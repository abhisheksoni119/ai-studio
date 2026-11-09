// analyse.mjs — turns a passage of script into a composed SceneSpec.
//
// There is no scene library here. A spec is ASSEMBLED from vocabulary:
// a setting gives terrain, nouns give structures and props, subjects give cast,
// verbs give poses, and tone gives palette and weather. Joseph's pit and John's
// throne room come out of the same function and look nothing alike, because the
// words are different — not because somebody drew two scenes.
//
// Everything is deterministic: positions and shapes come from a seeded PRNG so
// a given script always renders identically, while two different scripts
// (or two windows of the same script) get different framing.

// ─── Deterministic RNG ────────────────────────────────────────────────────────

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seedStr) {
  let a = hashSeed(String(seedStr));
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = (n) => Math.round(n);

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Word matcher anchored at BOTH ends, so "rain" cannot match "rainbow",
 * "cross" cannot match "cross to the other side", and "go" cannot match "God".
 * Common inflections are still allowed, so "rain" matches "rained"/"raining".
 * Multi-word phrases are matched as written.
 */
function wordRe(k) {
  const key = String(k).trim();
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/\s/.test(key)) return new RegExp(`\\b${esc}`, 'i');
  return new RegExp(`\\b${esc}(?:s|es|ed|d|ing|'s|\u2019s)?\\b`, 'i');
}

function hits(text, words) {
  let n = 0;
  for (const w of words) if (wordRe(w).test(text)) n += 1;
  return n;
}

const any = (text, words) => hits(text, words) > 0;

// ─── Vocabulary ───────────────────────────────────────────────────────────────

/** Where the passage is happening. First strong match wins; order is priority. */
const SETTINGS = [
  ['heaven',     ['throne', 'heaven', 'heavenly', 'glory', 'worship him', 'holy holy', 'elders', 'seraphim', 'revelation', 'majesty', 'reign']],
  ['underwater', ['drowning', 'sinking', 'depths', 'under the water', 'swallowed', 'belly of']],
  ['sea',        ['sea', 'waves', 'boat', 'ship', 'storm on', 'fishermen', 'fishing', 'nets', 'shore', 'lake', 'galilee', 'sailed', 'water walked', 'walked on the water']],
  ['prison',     ['prison', 'chains', 'jail', 'cell', 'imprisoned', 'bound in', 'shackles', 'dungeon']],
  ['tombsite',   ['tomb', 'grave', 'buried', 'resurrection', 'risen', 'rose again', 'empty tomb', 'stone was rolled']],
  ['templeyard', ['temple', 'tabernacle', 'synagogue', 'altar', 'sacrifice', 'priest', 'sanctuary', 'courts']],
  ['city',       ['city', 'jerusalem', 'town', 'streets', 'gate', 'nineveh', 'babylon', 'bethlehem', 'marketplace', 'crowds gathered']],
  ['valley',     ['valley', 'canyon', 'ravine', 'shadow of death', 'between the hills', 'gorge']],
  ['desert',     ['desert', 'wilderness', 'barren', 'sand', 'dunes', 'wandered forty', 'dry land', 'parched']],
  ['field',      ['field', 'harvest', 'crops', 'wheat', 'grain', 'sowed', 'sower', 'reap', 'vineyard', 'pasture']],
  ['garden',     ['garden', 'eden', 'olive', 'gethsemane', 'orchard', 'fig tree', 'vine']],
  ['house',      ['house', 'household', 'upper room', 'returned home', 'his home', 'their home']],
  ['pitplace',   ['pit', 'well', 'cistern', 'threw him', 'lowered', 'hole in the ground']],
  ['mountain',   ['mountain', 'mount', 'hill', 'sinai', 'moriah', 'summit', 'climbed', 'high place']],
  ['road',       ['road', 'highway', 'journey', 'travelled', 'traveled', 'crossroad', 'wandering', 'the path']],
];

/**
 * Tone of the passage, mapped to the flat earthy palettes. Scored; strongest
 * wins. These are deliberately NOT one-to-one with emotion — several moods
 * share a family so consecutive scenes can shift hue without lying about the
 * text.
 */
const MOODS = {
  night:  ['night', 'midnight', 'darkness', 'dark', 'stars', 'moon', 'asleep', 'evening came', 'alone in the'],
  ash:    ['grief', 'mourning', 'weep', 'wept', 'sorrow', 'loss', 'died', 'death', 'tears', 'lament', 'empty', 'silence'],
  teal:   ['sea', 'waves', 'deep', 'water', 'river', 'flood', 'drowning', 'storm', 'rain', 'afraid', 'fear', 'anxious', 'anxiety'],
  ember:  ['fire', 'flame', 'burning', 'burned', 'furnace', 'consumed', 'blaze', 'coals', 'anger', 'wrath'],
  gold:   ['glory', 'throne', 'majesty', 'radiant', 'shining', 'holy', 'worship', 'praise', 'crowned', 'heaven', 'light of'],
  sand:   ['desert', 'wilderness', 'dust', 'dry', 'thirst', 'barren', 'drought', 'wandered', 'noon', 'midday'],
  clay:   ['clay', 'potter', 'made', 'formed', 'built', 'city', 'house', 'village', 'street', 'work', 'labour', 'labor'],
  olive:  ['garden', 'grow', 'growth', 'seed', 'plant', 'vine', 'fruit', 'harvest', 'field', 'tend', 'green'],
  forest: ['tree', 'trees', 'branches', 'forest', 'shade', 'root', 'wood', 'leaves'],
  plum:   ['dusk', 'evening', 'sunset', 'quiet', 'still', 'rest', 'wonder', 'mystery', 'dream', 'vision'],
  stone:  ['stone', 'rock', 'altar', 'tomb', 'grave', 'mountain', 'wall', 'law', 'command', 'judgment'],
  rust:   ['thorns', 'curse', 'toil', 'sweat', 'struggle', 'hard', 'broken', 'rusted', 'worn', 'burden', 'weary'],
};

/** Named people and roles → how to cast them. */
const PEOPLE = [
  ['jesus',  {build: 'man'},   ['jesus', 'christ', 'savior', 'saviour', 'messiah', 'the lord said', 'son of god', 'rabbi', 'teacher said']],
  ['angel',  {angel: true},    ['angel', 'angels', 'archangel', 'gabriel', 'heavenly host', 'seraph']],
  ['girl',   {build: 'girl'},  ['girl', 'daughter', 'little girl', 'young woman', 'maiden']],
  ['boy',    {build: 'boy'},   ['boy', 'lad', 'shepherd boy', 'young david', 'child', 'children', 'little one', 'infant', 'son of jacob']],
  ['elder',  {build: 'elder'}, ['elder', 'old man', 'aged', 'priest', 'prophet', 'moses', 'abraham', 'noah', 'king', 'elijah', 'paul wrote']],
  ['woman',  {build: 'woman'}, ['woman', 'mary', 'ruth', 'esther', 'hannah', 'mother', 'widow', 'she said', 'her heart']],
];

const CROWD_WORDS = ['crowd', 'crowds', 'people', 'multitude', 'disciples', 'brothers', 'army', 'soldiers', 'nation', 'everyone', 'they all', 'assembly', 'congregation', 'followers', 'thousands'];

/** Verbs → pose. Checked in order; first match wins. */
const POSES = [
  ['kneel',  ['pray', 'prayed', 'praying', 'knelt', 'kneel', 'bowed down', 'fell on his knees', 'confess', 'pleaded', 'cried out to']],
  ['raise',  ['praise', 'worship', 'lifted his hands', 'raised his hands', 'rejoice', 'shouted', 'sang', 'hallelujah', 'arms raised', 'surrender']],
  ['bow',    ['bowed', 'bow', 'humbled', 'head down', 'ashamed', 'repent']],
  ['fallen', ['fell', 'fallen', 'collapsed', 'struck down', 'face down', 'lay on the ground', 'defeated']],
  ['carry',  ['carried', 'carry', 'bearing', 'bore', 'lifted up the', 'burden']],
  ['reach',  ['reached', 'reach', 'stretched out', 'held out his hand', 'took hold']],
  ['sit',    ['sat', 'sitting', 'seated', 'rested', 'waited by']],
  ['point',  ['pointed', 'declared', 'proclaimed', 'said to them', 'answered', 'spoke', 'asked them', 'called out']],
  ['walk',   ['walked', 'walking', 'went', 'journeyed', 'travelled', 'traveled', 'followed', 'came toward', 'set out', 'ran']],
];

/** Objects that appear as held or placed props. */
const PROPS = [
  ['sword',   ['sword', 'blade', 'armed']],
  ['spear',   ['spear', 'javelin']],
  ['shield',  ['shield', 'armour', 'armor']],
  ['sling',   ['sling', 'slingshot']],
  ['stone',   ['stone', 'stones', 'pebble', 'smooth stones']],
  ['crown',   ['crown', 'crowned', 'diadem']],
  ['thorns',  ['thorns', 'crown of thorns']],
  ['scroll',  ['scroll', 'scrolls', 'written on a scroll', 'sealed']],
  ['book',    ['book', 'bible', 'scripture', 'word of god', 'wrote', 'letter']],
  ['lamp',    ['lamp', 'lantern', 'candle', 'oil for the']],
  ['chains',  ['chains', 'shackles', 'bound with']],
  ['key',     ['key', 'keys', 'unlocked']],
  ['net',     ['net', 'nets', 'cast the net']],
  ['bread',   ['bread', 'loaves', 'broke the bread', 'manna']],
  ['cup',     ['cup', 'wine', 'drink this']],
  ['jar',     ['jar', 'pitcher', 'vessel', 'flask', 'oil in a']],
  ['harp',    ['harp', 'lyre', 'played music', 'psalm of david']],
  ['anchor',  ['anchor', 'anchored']],
  ['basket',  ['basket', 'baskets']],
  ['coat',    ['coat', 'robe of many', 'cloak', 'garment', 'many colours', 'many colors']],
  ['staff',   ['staff', 'rod', 'shepherd’s staff', 'shepherds staff']],
  ['trumpet', ['trumpet', 'horn sounded']],
  ['sickle',  ['sickle', 'reaping hook']],
];

/** Animals mentioned in the passage. */
const ANIMALS = [
  ['sheep',   ['sheep', 'flock', 'lamb', 'lambs', 'ewe']],
  ['ram',     ['ram', 'goat']],
  ['dove',    ['dove', 'doves', 'pigeon']],
  ['lion',    ['lion', 'lions', 'den of']],
  ['fish',    ['fish', 'fishes', 'catch of']],
  ['donkey',  ['donkey', 'colt', 'mule']],
  ['ox',      ['ox', 'oxen', 'cattle', 'bull']],
  ['serpent', ['serpent', 'snake', 'viper']],
];

/** Structures the passage puts in the frame. */
const STRUCTURES = [
  ['throne',   ['throne', 'seated in majesty', 'reigns', 'kingdom come']],
  ['tomb',     ['tomb', 'grave', 'buried', 'stone was rolled', 'empty tomb', 'risen']],
  // 'cross' alone is usually the verb ("cross over"), so the crucifix needs context.
  ['cross',    ['crucified', 'calvary', 'golgotha', 'nailed', 'the cross', 'his cross', 'on a cross']],
  ['altar',    ['altar', 'sacrifice', 'offering', 'burnt offering']],
  ['well',     ['well', 'cistern', 'drew water', 'living water']],
  ['boat',     ['boat', 'ship', 'vessel', 'sailed', 'fishermen', 'into the boat']],
  ['temple',   ['temple', 'tabernacle', 'sanctuary', 'synagogue']],
  ['city',     ['city', 'jerusalem', 'town', 'nineveh', 'babylon', 'bethlehem', 'walls of']],
  ['gate',     ['gate', 'door', 'narrow gate', 'doorway', 'entrance']],
  ['house',    ['house', 'home', 'household', 'upper room']],
  ['tent',     ['tent', 'tents', 'camped', 'dwelling']],
  ['table',    ['table', 'supper', 'feast', 'banquet', 'communion', 'meal']],
  ['prison',   ['prison', 'jail', 'cell', 'dungeon', 'bars']],
  ['ladder',   ['ladder', 'stairway to heaven', 'jacob’s ladder', 'jacobs ladder']],
  ['tree',     ['tree', 'trees', 'branches', 'vine', 'fig tree', 'olive tree', 'forest']],
  ['campfire', ['fire', 'campfire', 'coals', 'warmed himself']],
  ['wall',     ['wall', 'walls', 'ramparts', 'jericho']],
  ['signpost', ['crossroad', 'crossroads', 'which way', 'two roads', 'fork in the']],
  ['stone',    ['great stone', 'boulder', 'rock rolled']],
];

// ─── Scene construction ───────────────────────────────────────────────────────

// ─── Stage geometry ───────────────────────────────────────────────────────────
// The frame is 1080x1920. Captions occupy the upper-left (y 430-700) and the
// scripture pill sits at y ~1560, so the picture has to read in the band
// between and behind them. The ground plane starts at the horizon and widens
// toward the viewer; everything standing on it is placed by `depth` rather than
// pixels, and the renderer converts that into position and scale.
const HORIZON_HIGH = 820;   // lots of ground — intimate, close
const HORIZON_LOW  = 1080;  // little ground — open, distant

/**
 * Related palettes. A script about anxiety scores one mood on nearly every
 * sentence, which is correct but produces two minutes in one colour. After a
 * couple of scenes we step to a sibling so the video keeps moving tonally
 * without contradicting the text.
 */
const SIBLINGS = {
  olive:  ['forest', 'gold', 'stone'],
  forest: ['olive', 'teal', 'stone'],
  rust:   ['clay', 'ember', 'sand'],
  clay:   ['rust', 'sand', 'stone'],
  sand:   ['gold', 'clay', 'olive'],
  gold:   ['sand', 'olive', 'ember'],
  teal:   ['night', 'forest', 'ash'],
  night:  ['plum', 'teal', 'ash'],
  plum:   ['night', 'stone', 'ash'],
  stone:  ['ash', 'clay', 'olive'],
  ash:    ['stone', 'night', 'plum'],
  ember:  ['rust', 'gold', 'clay'],
};

// Scenes are only ~3.5s, so a colour holds for two shots at most before it has
// to move. The reference reels shift hue on nearly every scene.
const PALETTE_RUN = 2;

/** A script that ends in hope should not end in the colour it opened in. */
const HOPE = ['hope', 'peace', 'joy', 'grace', 'promise', 'faith', 'trust', 'light',
  'morning', 'new', 'healed', 'restored', 'free', 'rise', 'forever', 'love', 'comfort'];
const RESOLVE = ['gold', 'sand', 'olive'];

/** Windows a setting survives without being named again before it drifts. */
const SETTING_HOLD = 2;

/** Open landscapes used when a script never names a literal place. */
const NEUTRAL = ['mountain', 'road', 'field', 'valley', 'desert', 'plain'];

/**
 * Written scripture references already rewritten by scripture.mjs. The book
 * name is matched against the real list rather than "any capitalised word",
 * which was capturing the preceding word and producing "IN PHILIPPIANS 4:6-7".
 */
const BOOK_NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms',
  'Proverbs', 'Ecclesiastes', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  'Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', 'Thessalonians',
  'Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', 'Peter', 'Jude', 'Revelation',
];
const REF_RE = new RegExp(
  `\\b((?:[123]\\s+)?(?:${BOOK_NAMES.join('|')}))\\s+(\\d+)(?::(\\d+(?:-\\d+)?))?\\b`,
);

/**
 * Compose a SceneSpec for one window of script.
 *
 * @param {string} text      the window's own sentences
 * @param {number} i         window index
 * @param {number} total     number of windows
 * @param {string} storySeed stable per-story seed
 * @param {number} s         start second
 * @param {number} e         end second
 * @param {{setting?: string, palette?: string, held?: number, run?: number,
 *          settingAge?: number, anchor?: string}} prev
 *        carried state from the previous window. A story has a PLACE and a
 *        TONE; without this, any sentence that happens not to name the setting
 *        would snap the viewer somewhere new and back again.
 */
export function composeScene(text, i, total, storySeed, s, e, prev = {}) {
  const L = ` ${text.toLowerCase()} `;
  const rand = rng(`${storySeed}|${i}`);
  const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
  const between = (lo, hi) => lo + rand() * (hi - lo);

  const isLast = i === total - 1;

  // A setting persists so the story keeps a place, but it DECAYS: a single
  // mention should not pin the next six windows to the same location.
  const named = pickSetting(L);
  const settingAge = named ? 0 : (prev.settingAge ?? 0) + 1;
  let setting;
  if (named) {
    setting = named;
  } else if (prev.setting && settingAge <= SETTING_HOLD) {
    setting = prev.setting;
  } else if (prev.anchor) {
    setting = prev.anchor;
  } else {
    setting = NEUTRAL[Math.floor(rand() * NEUTRAL.length) % NEUTRAL.length];
  }

  const mood = pickPalette(L, named, i, total);
  let palette;
  if (mood) {
    palette = mood;
  } else if (prev.palette && (prev.held ?? 0) < 3) {
    palette = prev.palette;
  } else {
    const arc = ['olive', 'clay', 'stone', 'teal', 'sand', 'plum'];
    const at = arc.indexOf(prev.palette ?? '');
    palette = arc[(at + 1 + arc.length) % arc.length] ?? 'stone';
  }

  // Break up a run of one colour even when the passage keeps scoring it.
  let run = palette === prev.palette ? (prev.run ?? 0) + 1 : 0;
  if (run >= PALETTE_RUN) {
    const sibs = SIBLINGS[palette];
    if (sibs?.length) {
      palette = sibs[Math.floor(rand() * sibs.length) % sibs.length];
      run = 0;
    }
  }

  // Resolution: a hopeful close should not land in the tone it opened in.
  if (isLast && hits(L, HOPE) >= 1) {
    palette = RESOLVE[Math.floor(rand() * RESOLVE.length) % RESOLVE.length];
    run = 0;
  }

  const held = mood ? 0 : (prev.palette === palette ? (prev.held ?? 0) + 1 : 0);

  // Framing varies per window, so a story that stays in one place still cuts
  // between wide, medium and close shots instead of repeating one composition.
  const shot = pick(['wide', 'medium', 'medium', 'close', 'close']);
  const horizon = shot === 'close' ? R(between(HORIZON_HIGH, 900))
    : shot === 'wide' ? R(between(1000, HORIZON_LOW))
    : R(between(900, 1000));

  const spec = {
    id: `${setting}/${palette}`,
    s: round2(s),
    e: round2(e),
    palette,
    seed: `${storySeed}s${i}`,
    horizon,
    skew: round2(between(0.25, 0.7)),
    rows: rand() > 0.25,
    scatter: R(between(10, 26)),
    structures: [],
    cast: [],
    props: [],
    fx: [],
    camera: pick(['push', 'push', 'driftL', 'driftR', 'rise', 'pull']),
  };

  buildSkyAndLight(spec, L, setting, palette, rand, between);
  buildStructures(spec, L, setting, shot, rand, between);
  buildCast(spec, L, setting, shot, rand, between, storySeed);
  buildProps(spec, L, rand, between);
  buildWeather(spec, L, setting, palette, rand, between);
  attachScripture(spec, text);

  // Sand and gold grounds are light enough that captions need dark ink.
  spec.lightGround = palette === 'sand' || palette === 'gold';

  for (const k of ['structures', 'cast', 'props', 'fx']) {
    if (Array.isArray(spec[k]) && spec[k].length === 0) delete spec[k];
  }

  spec._carry = {setting, palette, held, run, settingAge, anchor: prev.anchor};
  return spec;
}

/** Returns the named setting, or null when the passage names none. */
function pickSetting(L) {
  return scoreSetting(L).setting;
}

function scoreSetting(L) {
  let setting = null;
  let score = 0;
  for (const [name, words] of SETTINGS) {
    const n = hits(L, words);
    if (n > score) { score = n; setting = name; }
  }
  return {setting, score};
}

/**
 * The setting a whole script is anchored to, or null if it never commits to a
 * place. `minHits` guards against one stray word pinning an entire video: a
 * teaching script that says "path" once is not set on a road.
 */
export function detectSetting(text, minHits = 1) {
  const {setting, score} = scoreSetting(` ${String(text).toLowerCase()} `);
  return score >= minHits ? setting : null;
}

/** Returns the mood palette, or null when the passage carries no tonal signal. */
function pickPalette(L, setting, i, total) {
  const scores = {};
  for (const [name, words] of Object.entries(MOODS)) scores[name] = hits(L, words);

  // Settings carry their own strong colour implication.
  if (setting === 'heaven') scores.gold = (scores.gold ?? 0) + 3;
  if (setting === 'underwater') scores.teal = (scores.teal ?? 0) + 4;
  if (setting === 'sea') scores.teal = (scores.teal ?? 0) + 2;
  if (setting === 'desert') scores.sand = (scores.sand ?? 0) + 2;
  if (setting === 'prison') scores.ash = (scores.ash ?? 0) + 2;
  if (setting === 'tombsite') scores.stone = (scores.stone ?? 0) + 2;
  if (setting === 'field' || setting === 'garden') scores.olive = (scores.olive ?? 0) + 2;
  if (setting === 'city' || setting === 'house') scores.clay = (scores.clay ?? 0) + 1;
  if (setting === 'valley' || setting === 'mountain') scores.stone = (scores.stone ?? 0) + 1;

  let best = null;
  let bestScore = 0;
  for (const [name, n] of Object.entries(scores)) {
    if (n > bestScore) { bestScore = n; best = name; }
  }
  return best;
}

/** Backdrop, distant hills, stars and the single diagonal shaft of light. */
function buildSkyAndLight(spec, L, setting, palette, rand, between) {
  const dark = palette === 'night' || palette === 'ash' || palette === 'plum' || palette === 'teal';

  if (dark && setting !== 'prison' && rand() > 0.35) {
    spec.stars = R(between(40, 90));
  }

  // Distant hills behind the plane, except indoors and at sea.
  if (setting !== 'prison' && setting !== 'underwater' && setting !== 'sea' && rand() > 0.4) {
    spec.ridge = {amp: R(between(70, 160)), y: R(spec.horizon - between(10, 90))};
  }

  // ONE diagonal shaft. This is the reference lighting device — it gives the
  // frame direction without a sun disc sitting in the middle of every scene.
  const wantsShaft =
    any(L, ['light', 'voice', 'called', 'calling', 'spoke', 'heard', 'presence', 'glory',
            'appeared', 'revealed', 'shone', 'hope', 'morning', 'dawn', 'god'])
    || rand() > 0.45;
  if (wantsShaft) {
    spec.shaft = {
      across: round2(between(-0.8, 0.8)),
      width: R(between(110, 230)),
      tilt: R(between(-220, 220)),
      opacity: round2(between(0.13, 0.26)),
    };
  }

  if (any(L, ['birds', 'ravens', 'sparrow', 'eagle', 'wings', 'fly'])) {
    spec.fx.push({kind: 'birds', n: R(between(3, 7)), y: R(between(280, 520))});
  }
  if (any(L, ['glory', 'radiant', 'shining', 'holy', 'spirit', 'presence'])) {
    spec.fx.push({kind: 'motes', n: R(between(16, 28)), across: round2(between(-0.4, 0.4))});
  }
}

/** Structures the passage puts on the ground. At most two, so the frame breathes. */
function buildStructures(spec, L, setting, shot, rand, between) {
  const out = spec.structures;
  const added = new Set();

  // Close shots put the subject forward; wide shots push everything back.
  const baseDepth = shot === 'close' ? between(0.72, 0.95)
    : shot === 'wide' ? between(0.24, 0.48)
    : between(0.45, 0.72);

  const add = (kind, opts = {}) => {
    if (added.has(kind) || added.size >= 2) return;
    added.add(kind);
    out.push({
      kind,
      across: round2(between(-0.62, 0.62)),
      depth: round2(baseDepth + between(-0.08, 0.08)),
      s: round2(between(0.85, 1.25)),
      ...opts,
    });
  };

  for (const [kind, words] of STRUCTURES) {
    if (added.size >= 2) break;
    if (!any(L, words)) continue;
    switch (kind) {
      case 'throne': add('throne', {across: round2(between(-0.2, 0.2)), s: 1.2}); break;
      case 'tomb':   add('tomb',   {open: any(L, ['risen', 'rose', 'empty', 'rolled away']) ? 1 : 0.15}); break;
      case 'gate':   add('gate',   {open: any(L, ['opened', 'enter', 'came in']) ? 0.8 : 0.1}); break;
      case 'city':   add('city',   {depth: round2(between(0.12, 0.3)), lit: true}); break;
      case 'house':  add('house',  {lit: true}); break;
      case 'boat':   add('boat',   {lit: rand() > 0.5}); break;
      case 'tree':   add('tree',   {across: round2(rand() > 0.5 ? between(0.45, 0.95) : between(-0.95, -0.45)), s: round2(between(0.7, 1.05))}); break;
      default:       add(kind); break;
    }
  }

  // Settings that imply a structure even when the words did not name one.
  if (!added.size) {
    if (setting === 'city') add('city', {depth: 0.2, lit: true});
    else if (setting === 'templeyard') add('temple');
    else if (setting === 'tombsite') add('tomb', {open: 0.9});
    else if (setting === 'garden' || setting === 'field') add('tree', {across: round2(rand() > 0.5 ? between(0.5, 0.95) : between(-0.95, -0.5)), s: 0.9});
    else if (setting === 'prison') add('prison', {across: 0, depth: 0.5});
    else if (setting === 'house') add('house', {lit: true});
    else if (setting === 'heaven' && rand() > 0.45) add('throne', {across: 0});
  }

  // A second tree or stone to give the plane something to sit on.
  if (added.size === 1 && rand() > 0.5 && setting !== 'prison' && setting !== 'heaven') {
    add(rand() > 0.5 ? 'tree' : 'stone', {
      across: round2(between(-0.95, 0.95)),
      depth: round2(between(0.1, 0.4)),
      s: round2(between(0.5, 0.9)),
    });
  }

  if (any(L, ['pillar of', 'cloud by day', 'fire by night'])) {
    spec.fx.push({kind: 'pillar', across: round2(between(-0.3, 0.3)), depth: 0.45});
  }
}

function buildCast(spec, L, setting, shot, rand, between, storySeed) {
  const cast = spec.cast;
  const pose = pickPose(L);
  const walking = pose === 'walk';

  // The subject sits forward in close shots, further back in wide ones.
  const subjectDepth = shot === 'close' ? between(0.74, 0.88)
    : shot === 'wide' ? between(0.42, 0.62)
    : between(0.62, 0.82);

  for (const [kind, words] of ANIMALS) {
    if (!any(L, words)) continue;
    const n = kind === 'sheep' && setting !== 'heaven' ? R(between(2, 4)) : 1;
    for (let k = 0; k < n; k++) {
      cast.push({
        kind: 'animal', animal: kind,
        across: round2(between(0.1, 0.9)),
        depth: round2(subjectDepth - between(0.05, 0.22)),
        s: round2(between(0.8, 1.1)),
        flip: rand() > 0.65,
      });
    }
    break;
  }

  if (any(L, CROWD_WORDS)) {
    cast.push({
      kind: 'crowd',
      across: round2(between(-0.4, 0.4)),
      depth: round2(subjectDepth - between(0.12, 0.3)),
      n: R(between(3, 6)),
      s: round2(between(0.85, 1.1)),
      spread: R(between(380, 640)),
      pose: pose === 'raise' || pose === 'kneel' ? pose : 'stand',
    });
  }

  const who = pickPerson(L);
  if (who.angel) {
    cast.push({kind: 'angel', across: round2(between(-0.4, 0.4)), depth: round2(subjectDepth - 0.1), s: 1});
    cast.push({kind: 'figure', across: round2(between(-0.3, 0.3)), depth: round2(subjectDepth), s: 1, pose: 'bow', lit: true,
      look: `${storySeed}-${who.build ?? 'man'}`});
  } else {
    cast.push({
      kind: 'figure',
      across: round2(walking ? between(-0.7, -0.2) : between(-0.45, 0.45)),
      depth: round2(subjectDepth),
      s: round2(between(0.95, 1.2)),
      pose,
      build: who.build ?? 'man',
      lit: true, // the subject is lit; everyone else stays silhouetted
      look: `${storySeed}-${who.build ?? 'man'}`, // same person in every shot
      prop: pickHeldProp(L),
      travel: walking ? round2(between(0.06, 0.16)) : 0,
      flip: !walking && rand() > 0.7,
    });
  }

  if (any(L, ['his son', 'his brother', 'his friend', 'with him', 'together they', 'his father', 'two of them', 'his disciple'])) {
    cast.push({
      kind: 'figure',
      across: round2(between(0.2, 0.7)),
      depth: round2(subjectDepth - between(0.02, 0.12)),
      s: round2(between(0.8, 1)),
      pose: walking ? 'walk' : 'stand',
      build: rand() > 0.5 ? 'boy' : 'woman',
      travel: walking ? round2(between(0.06, 0.16)) : 0,
    });
  }
}

function pickPose(L) {
  for (const [pose, words] of POSES) if (any(L, words)) return pose;
  return 'stand';
}

function pickPerson(L) {
  for (const [, opts, words] of PEOPLE) if (any(L, words)) return opts;
  return {};
}

function pickHeldProp(L) {
  const HELD = new Set(['staff', 'sword', 'spear', 'shield', 'scroll', 'lamp', 'basket', 'sling', 'harp', 'sickle', 'trumpet', 'key']);
  for (const [kind, words] of PROPS) if (HELD.has(kind) && any(L, words)) return kind;
  return undefined;
}

function buildProps(spec, L, rand, between) {
  const FREE = new Set(['crown', 'thorns', 'chains', 'bread', 'cup', 'jar', 'anchor', 'net', 'coat', 'book', 'stone']);
  let placed = 0;
  for (const [kind, words] of PROPS) {
    if (placed >= 1) break;
    if (!FREE.has(kind) || !any(L, words)) continue;
    // Objects that carry the meaning are held up as symbols; the rest sit down.
    const hero = kind === 'crown' || kind === 'thorns' || kind === 'book' || kind === 'scroll';
    spec.props.push({
      kind,
      across: round2(between(-0.5, 0.5)),
      depth: round2(between(0.45, 0.8)),
      s: round2(between(0.75, 1.15)),
      hero,
      bright: hero && rand() > 0.4,
    });
    placed += 1;
  }
}

function buildWeather(spec, L, setting, palette, rand, between) {
  if (any(L, ['rain', 'rained', 'downpour', 'poured down', 'flood'])) {
    spec.weather = {kind: 'rain', n: 95, opacity: 0.4};
  } else if (any(L, ['snow', 'white as snow', 'frost'])) {
    spec.weather = {kind: 'snow', n: 80, opacity: 0.6};
  } else if (setting === 'desert' || palette === 'sand') {
    spec.weather = {kind: 'dust', n: 12, opacity: 0.18};
  } else if (any(L, ['mist', 'fog', 'cloud covered', 'haze'])) {
    spec.weather = {kind: 'mist', n: 10, opacity: 0.16};
  }

  if (any(L, ['smoke', 'incense', 'burnt offering'])) {
    spec.fx.push({kind: 'smoke', across: round2(between(-0.3, 0.3)), depth: 0.5, n: 16});
  }
  if (any(L, ['fire', 'flame', 'burning bush', 'coals']) && setting !== 'prison') {
    spec.fx.push({kind: 'fire', across: round2(between(-0.5, 0.5)), depth: round2(between(0.5, 0.75))});
  }
  if (setting === 'sea' || any(L, ['waves', 'still waters', 'ripple'])) {
    spec.fx.push({kind: 'ripples', depth: round2(between(0.5, 0.8))});
  }
}

/**
 * Pull a written scripture reference out of the window text for the pill at the
 * foot of the frame. scripture.mjs has already rewritten spoken forms
 * ("Philippians chapter four, verses six and seven") into written ones, so by
 * the time we see it the reference looks like "Philippians 4:6-7".
 */
function attachScripture(spec, text) {
  const m = REF_RE.exec(String(text));
  if (!m) return;
  const [, book, chapter, verse] = m;
  spec.scripture = {ref: `${book} ${chapter}${verse ? `:${verse}` : ''}`.toUpperCase()};
}

function round2(n) { return parseFloat(Number(n).toFixed(2)); }
