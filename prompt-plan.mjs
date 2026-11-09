// prompt-plan.mjs — turn one sentence of narration into an image prompt that
// actually depicts what the sentence says.
//
// This is the piece the previous system did not have. Keyword-to-shape matching
// drew an empty cross and a generic man for "He was nailed to a cross", because
// it matched the noun "cross" and had no idea the sentence describes a person
// ON it. Here the ACTION is resolved first, then who is in the scene, then
// where — and an abstract sentence gets a deliberate symbol rather than a
// literal object.

import {STYLE, NEGATIVE, CHARACTERS, PLACES, findCharacters, findPlace} from './characters.mjs';

/**
 * Concrete actions. Checked in order, first match wins, so the most specific
 * phrasing is listed first. Each returns the SHOT, not just a noun.
 */
const ACTIONS = [
  // ── specific moments first; a general word like "crucifixion" appears in
  //    narration about the whole event and must not outrank them ──
  [['mocked', 'beaten', 'scourged', 'flogged', 'spat on', 'struck him', 'jeered'], 'person',
    'a bound and beaten figure surrounded by jeering soldiers, torchlight, harsh shadows'],
  [['crown of thorns', 'thorns on his head', 'pressed a crown'], 'object',
    'a crown of woven thorns resting on bare stone, hard side light'],
  [['carried the cross', 'carrying his cross', 'bearing the cross', 'road to calvary'], 'person',
    'carrying a heavy wooden cross up a steep stony road, stumbling under its weight'],
  [['nailed to a cross', 'nailed to the cross', 'crucified', 'on the cross', 'died on the cross', 'hung on a cross'], 'person',
    'hanging on the wooden cross, arms outstretched, crown of thorns, head bowed, dark sky behind'],
  [['curtain', 'torn in two', 'veil was torn'], 'object',
    'a heavy woven temple curtain torn from top to bottom, light breaking through the tear'],
  [['rose again', 'risen', 'resurrection', 'rolled away', 'empty tomb', 'third day', 'alive again'], 'object',
    'an empty rock tomb with the great stone rolled aside, brilliant dawn light pouring out'],
  [['ascended', 'taken up', 'into heaven'], 'person',
    'rising into a shaft of golden light, watchers below looking up'],
  [['born', 'manger', 'nativity'], 'object',
    'a newborn child in a straw manger, soft lamplight, animals nearby'],
  [['baptised', 'baptized', 'baptism', 'the jordan'], 'person',
    'standing waist-deep in a river, a white dove descending in a beam of light'],
  [['calmed the storm', 'rebuked the wind', 'be still', 'walked on water', 'walking on the water'], 'person',
    'standing with hand raised over violent waves, a small boat tossing beside'],
  [['healed', 'healing', 'made him well', 'opened his eyes', 'made whole'], 'person',
    'reaching down to touch a kneeling person, warm light between their hands'],
  [['fed the', 'five thousand', 'loaves and fishes', 'broke the bread'], 'person',
    'breaking bread above baskets, a vast seated crowd on a hillside'],
  [['last supper', 'passover meal', 'this is my body'], 'object',
    'a long low table set with bread and a cup, oil lamps, seated figures'],
  [['betrayed', 'thirty pieces', 'judas'], 'person',
    'a betrayal in a dark olive grove, torches, a hand on a shoulder'],
  [['prayed', 'praying', 'knelt', 'kneeling', 'on his knees', 'cried out to god'], 'person',
    'kneeling alone with head bowed and hands clasped, light falling from above'],
  [['wept', 'weeping', 'tears', 'mourned'], 'person',
    'seated with head in hands, grief, cold muted light'],
  [['taught', 'teaching', 'preached', 'spoke to the crowd', 'sermon'], 'person',
    'addressing a seated crowd on a hillside'],
  [['follow me', 'chose his disciples', 'called them'], 'person',
    'beckoning to fishermen beside their boats on a shore'],
  [['tempted', 'forty days', 'in the wilderness'], 'person',
    'alone in barren rocky wilderness under a merciless sun'],
  [['walked', 'journeyed', 'travelled', 'traveled', 'set out'], 'person',
    'walking a dusty road that winds away into distant hills'],
];

/**
 * Abstract sentences — most of a teaching script. These get a deliberate
 * SYMBOL. Without this the generator is handed "sin separated humanity from
 * God" and invents something arbitrary, or the old system drew another tomb.
 */
const SYMBOLS = [
  [['sin separated', 'separated from god', 'separation', 'cut off from'],
    'a deep chasm splitting rock in two, a small figure on the near edge, warm light unreachable on the far side'],
  [['forgive', 'forgiven', 'forgiveness', 'pardoned'],
    'broken chains falling from a pair of open upturned hands, warm light above'],
  [['hope', 'hopeful'],
    'a single shaft of gold light breaking through heavy dark cloud onto a hillside'],
  [['fear', 'afraid', 'anxious', 'anxiety', 'worry', 'troubled'],
    'a very small figure beneath an enormous dark storm sky, wind-bent grass'],
  [['faith', 'believe', 'trust'],
    'a figure stepping onto a narrow stone bridge that vanishes into mist'],
  [['love', 'loved us', 'his love'],
    'two hands almost touching, warm radiant light in the gap between them'],
  [['salvation', 'saved', 'rescue', 'redeem', 'redeemed'],
    'a strong hand reaching down into dark water to pull up a drowning figure'],
  [['grace', 'undeserved', 'gift'],
    'light falling onto one open empty hand held out in darkness'],
  [['peace', 'calm', 'rest', 'still'],
    'perfectly still water at dawn reflecting a pale sky, one distant figure'],
  [['death', 'die', 'dying', 'the grave'],
    'a dark open doorway in ancient stone, cold light at its threshold'],
  [['life', 'new life', 'born again', 'alive'],
    'a green shoot pushing up through cracked dry stone, sunlight on it'],
  [['sacrifice', 'gave himself', 'laid down his life'],
    'a stone altar with a single lamb standing beside it, shaft of light'],
  [['prophecy', 'prophet', 'foretold', 'written long before'],
    'an old unrolled scroll on stone, lamplight across the writing'],
  [['sin', 'sinful', 'wrongdoing', 'guilt', 'shame'],
    'a figure turned away in shadow, a long dark stain spreading across stone ground'],
  [['glory', 'majesty', 'holy', 'worship'],
    'overwhelming radiant light above a bowing figure, rays filling the frame'],
  [['promise', 'covenant'],
    'a rainbow arching over an empty landscape after storm'],
  [['heart', 'inside you', 'your soul'],
    'a warm light glowing inside a cupped pair of hands in darkness'],
  [['question', 'wonder', 'ask yourself', 'reflect'],
    'a lone figure at a crossroads at dusk, two paths diverging'],
];

/** Windows a location survives past its last mention. */
const PLACE_HOLD = 2;

const clip = (s, n) => (s.length > n ? `${s.slice(0, n).replace(/[^ ]*$/, '').trim()}` : s);

function firstAction(L) {
  for (const [keys, about, shot] of ACTIONS) {
    for (const k of keys) if (L.includes(k)) return {shot, about};
  }
  return null;
}

function firstSymbol(L) {
  for (const [keys, shot] of SYMBOLS) {
    for (const k of keys) if (L.includes(k)) return shot;
  }
  return null;
}

/**
 * Build an image prompt for one window of narration.
 *
 * @param {string} text   the sentences in this window
 * @param {object} ctx    {prevPlace, palette, index, total}
 * @returns {{prompt: string, place: string|null, characters: string[], kind: string}}
 */
export function buildPrompt(text, ctx = {}) {
  const raw = String(text).trim();
  const L = ` ${raw.toLowerCase()} `;

  const characters = findCharacters(raw);
  const namedPlace = findPlace(raw);
  const place = namedPlace ?? ctx.prevPlace ?? null;

  // 1. A concrete action beats everything: it describes the shot.
  const action = firstAction(L);
  // 2. Otherwise an abstract idea gets a symbol.
  const symbol = action ? null : firstSymbol(L);

  const who = characters
    .map((k) => CHARACTERS[k]?.look)
    .filter(Boolean)
    .slice(0, 2)
    .join('; ');

  const where = place ? PLACES[place] : null;

  let subject;
  let kind;
  if (action) {
    kind = 'action';
    // Only lead with a character when the shot is ABOUT a person. "the curtain
    // was torn" is about the curtain, however many names the sentence contains.
    subject = action.about === 'person' && who ? `${who} — ${action.shot}` : action.shot;
  } else if (symbol) {
    kind = 'symbol';
    // A symbol stands on its own; adding a named character muddies it.
    subject = symbol;
  } else if (who) {
    kind = 'portrait';
    subject = `${who}, ${CHARACTERS[characters[0]]?.role ?? 'standing'}`;
  } else if (where) {
    kind = 'place';
    subject = where;
  } else {
    kind = 'mood';
    subject = 'a lone robed figure in a wide quiet landscape, long shadows, contemplative';
  }

  // Place is context, not the subject, unless it IS the subject.
  const setting = where && kind !== 'place' && kind !== 'symbol' ? `, set at ${where}` : '';

  const prompt = clip(`${STYLE}. ${subject}${setting}. ${NEGATIVE}`, 700);
  return {prompt, place, characters, kind};
}

/**
 * Plan prompts for a whole script, carrying the location forward so a sequence
 * of sentences in one scene does not teleport between locations.
 */
export function planPrompts(windows) {
  let prevPlace = null;
  let age = 0;
  return windows.map((text, i) => {
    const named = findPlace(text);
    if (named) { prevPlace = named; age = 0; } else { age += 1; }
    // A location survives two windows past its last mention, then releases.
    // Carrying it indefinitely is what pinned most of the last video to one
    // place; the sentence should choose the scene, not a stale anchor.
    const carry = age <= PLACE_HOLD ? prevPlace : null;
    if (age > PLACE_HOLD) prevPlace = null;
    return buildPrompt(text, {prevPlace: carry, index: i, total: windows.length});
  });
}
