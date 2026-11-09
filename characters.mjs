// characters.mjs — how each biblical figure should LOOK.
//
// Why this file exists: the previous system drew the same generic man whatever
// the sentence said, so a script about Jesus on the cross showed an anonymous
// figure standing beside an empty cross. An image generator can draw the right
// person, but only if it is told who that person is. These descriptors are
// pasted into the prompt whenever the name appears in a sentence.
//
// Descriptions follow the traditional artistic conventions used by the
// reference accounts rather than historical-reconstruction scholarship, because
// the audience recognises the convention. Where the two differ (Jesus in
// particular) the note is recorded against the entry.

/** The locked look the whole video shares. Prepended to every prompt. */
export const STYLE = [
  'flat vector illustration',
  'limited earthy colour palette',
  'bold simple shapes',
  'soft directional light',
  'cinematic composition',
  'biblical scene',
  'no text, no lettering, no watermark, no signature',
].join(', ');

/** Appended to every prompt — things the generator reliably gets wrong. */
export const NEGATIVE = 'no modern clothing, no cars, no text overlay, not a photograph';

/**
 * Named figures. `look` goes into the prompt; `aliases` are what a script might
 * call them; `role` picks a sensible default action when the sentence is vague.
 */
export const CHARACTERS = {
  jesus: {
    aliases: ['jesus', 'christ', 'messiah', 'saviour', 'savior', 'the lord', 'son of god', 'lamb of god', 'rabbi'],
    look: 'Jesus Christ with shoulder-length wavy brown hair parted in the middle, a short full beard, '
      + 'wearing a simple white robe with a deep red sash, warm olive skin, calm compassionate expression',
    // Historically a first-century Galilean would have worn short hair and a trimmed beard;
    // the long-haired convention dates from 4th-century art. The convention is used because
    // it is what makes the figure instantly readable to the audience.
    role: 'standing with open hands',
  },
  mary: {
    aliases: ['mary', 'mother of jesus', 'virgin mary', 'his mother'],
    look: 'Mary, a young woman with a soft blue head covering draped over dark hair, '
      + 'a simple pale robe, gentle downcast expression',
    role: 'standing quietly',
  },
  magdalene: {
    aliases: ['mary magdalene', 'magdalene'],
    look: 'Mary Magdalene, a woman with long dark red hair, a deep green robe, kneeling posture',
    role: 'kneeling',
  },
  moses: {
    aliases: ['moses'],
    look: 'Moses, an old man with a long white beard and flowing white hair, '
      + 'a brown robe, holding a tall wooden staff, commanding presence',
    role: 'holding a staff aloft',
  },
  david: {
    aliases: ['david', 'king david', 'shepherd boy'],
    look: 'David as a young shepherd, a teenage boy with curly auburn hair, a short tan tunic, '
      + 'a leather sling and shepherd pouch, determined expression',
    role: 'standing ready',
  },
  abraham: {
    aliases: ['abraham', 'abram'],
    look: 'Abraham, an elderly patriarch with a long grey beard, a heavy dust-coloured robe and head wrap, '
      + 'a wooden staff, weathered face',
    role: 'looking upward',
  },
  noah: {
    aliases: ['noah'],
    look: 'Noah, an old man with a long grey beard, rough brown work robes, carpenter build',
    role: 'working with timber',
  },
  joseph: {
    aliases: ['joseph', 'jacob’s son', 'jacobs son'],
    look: 'Joseph as a young man with short dark hair, wearing a striped coat of many colours '
      + 'in red, gold, blue and green',
    role: 'standing',
  },
  paul: {
    aliases: ['paul', 'saul of tarsus', 'the apostle paul'],
    look: 'Paul the apostle, a balding middle-aged man with a short dark beard, '
      + 'a plain travelling cloak, holding a scroll',
    role: 'writing or teaching',
  },
  peter: {
    aliases: ['peter', 'simon peter'],
    look: 'Peter the fisherman, a broad-shouldered man with grey-streaked curly hair and a thick beard, '
      + 'a rough tunic, weathered hands',
    role: 'standing',
  },
  john: {
    aliases: ['john the apostle', 'the beloved disciple', 'john on patmos'],
    look: 'John the apostle, a younger man with dark hair, a simple pale robe',
    role: 'looking upward in wonder',
  },
  judas: {
    aliases: ['judas', 'judas iscariot', 'iscariot', 'the betrayer', 'the traitor'],
    // The money pouch is the whole character in one object: he carried the bag
    // for the twelve, and the bag is what the story turns on. Giving him a
    // readable prop matters more than his face, which no account describes.
    look: 'Judas Iscariot, a lean man with dark curly hair and a short beard, a muted ochre robe, '
      + 'a small leather money pouch hanging at his belt, face turned half away from the light',
    role: 'standing apart from the others',
  },
  baptist: {
    aliases: ['john the baptist'],
    look: 'John the Baptist, a wild-looking man with long matted hair and beard, '
      + 'a rough camel-hair garment and leather belt',
    role: 'standing in a river',
  },
  elijah: {
    aliases: ['elijah'],
    look: 'Elijah the prophet, a gaunt bearded man in a dark hairy mantle, windblown',
    role: 'standing against the wind',
  },
  daniel: {
    aliases: ['daniel'],
    look: 'Daniel, a composed young man in Babylonian-styled robes of blue and gold',
    role: 'praying',
  },
  ruth: {
    aliases: ['ruth'],
    look: 'Ruth, a young woman in a simple russet robe and head scarf, gathering grain',
    role: 'gleaning in a field',
  },
  esther: {
    aliases: ['esther', 'queen esther'],
    look: 'Esther, a young queen in rich purple and gold Persian robes, a delicate crown',
    role: 'standing with resolve',
  },
  angel: {
    aliases: ['angel', 'angels', 'gabriel', 'archangel', 'heavenly host', 'seraph'],
    look: 'a radiant angel with large white wings, luminous white robes, glowing golden light around it',
    role: 'descending',
  },
  disciples: {
    aliases: ['disciples', 'the twelve', 'apostles', 'followers'],
    look: 'a group of twelve men in simple first-century robes of earth tones, varied ages and beards',
    role: 'gathered listening',
  },
  pharisees: {
    aliases: ['pharisees', 'scribes', 'priests', 'religious leaders', 'teachers of the law'],
    look: 'religious leaders in elaborate dark robes with prayer shawls and phylacteries, stern faces',
    role: 'standing in judgement',
  },
  soldiers: {
    aliases: ['soldiers', 'roman soldiers', 'centurion', 'guards'],
    look: 'Roman soldiers in red tunics, segmented armour, crested helmets, carrying spears',
    role: 'standing guard',
  },
  crowd: {
    aliases: ['crowd', 'crowds', 'multitude', 'people', 'everyone', 'the nation'],
    look: 'a crowd of ordinary first-century people in simple earth-toned robes',
    role: 'gathered',
  },
  shepherd: {
    aliases: ['shepherd', 'shepherds'],
    look: 'a shepherd in a rough wool cloak with a crook, sheep around him',
    role: 'watching the flock',
  },
};

/**
 * Settings and objects worth describing precisely, so the generator does not
 * invent a modern or generic version of them.
 */
export const PLACES = {
  golgotha:   'the hill of Golgotha outside Jerusalem, three crosses, dark stormy sky',
  tomb:       'a rock-cut tomb with a great round stone rolled aside, dawn light from the opening',
  jerusalem:  'the ancient walled city of Jerusalem, stone buildings, temple on the hill',
  galilee:    'the Sea of Galilee at dawn, wooden fishing boats, low hills across the water',
  wilderness: 'barren rocky wilderness, dry scrub, heat haze, endless horizon',
  garden:     'an olive grove at night, gnarled ancient trees, moonlight',
  temple:     'the interior of the Jerusalem temple, stone columns, a heavy woven curtain',
  upperroom:  'a simple upper room with a long low table, oil lamps, clay cups',
  sinai:      'Mount Sinai, a smoking rocky peak under a dark sky',
  bethlehem:  'a stone stable in Bethlehem, a manger, soft lamplight',
  throne:     'a throne room in heaven, radiant light, elders bowing, a rainbow encircling the throne',
  sea:        'a violent storm at sea, a small wooden boat among high waves, lightning',
  prison:     'a stone prison cell, iron bars, a single shaft of light from a high window',
  field:      'a field of ripe barley under a wide sky',
  road:       'a dusty road winding through dry hills',
};

/** Find every character a sentence mentions, longest alias first. */
export function findCharacters(text) {
  const L = ` ${String(text).toLowerCase()} `;
  const found = [];
  const pairs = [];
  for (const [key, c] of Object.entries(CHARACTERS)) {
    for (const a of c.aliases) pairs.push({key, alias: a, len: a.length});
  }
  pairs.sort((x, y) => y.len - x.len);
  for (const {key, alias} of pairs) {
    if (found.includes(key)) continue;
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(L)) found.push(key);
    if (found.length >= 3) break;
  }
  return found;
}

/** Find a named place in a sentence. */
export function findPlace(text) {
  const L = ` ${String(text).toLowerCase()} `;
  const HINTS = {
    golgotha:   ['golgotha', 'calvary', 'crucified', 'crucifixion', 'the cross', 'nailed'],
    tomb:       ['tomb', 'grave', 'buried', 'risen', 'resurrection', 'rolled away', 'third day'],
    jerusalem:  ['jerusalem', 'the city', 'city gates'],
    galilee:    ['galilee', 'fishermen', 'fishing', 'nets', 'boat', 'lake'],
    wilderness: ['wilderness', 'desert', 'forty days', 'tempted', 'barren'],
    garden:     ['gethsemane', 'olive grove', 'garden of'],
    temple:     ['temple', 'curtain', 'holy of holies', 'sanctuary'],
    upperroom:  ['upper room', 'last supper', 'broke bread', 'passover meal'],
    sinai:      ['sinai', 'the mountain of god', 'ten commandments'],
    bethlehem:  ['bethlehem', 'manger', 'born in'],
    throne:     ['throne', 'heaven', 'elders', 'revelation'],
    sea:        ['storm at sea', 'waves', 'calmed the storm', 'walked on water'],
    prison:     ['prison', 'jail', 'chains', 'cell'],
    field:      ['field', 'harvest', 'sower', 'grain'],
    road:       ['road', 'journey', 'the way', 'walked along'],
  };
  let best = null;
  let bestScore = 0;
  for (const [place, words] of Object.entries(HINTS)) {
    const n = words.filter((w) => L.includes(w)).length;
    if (n > bestScore) { bestScore = n; best = place; }
  }
  return best;
}
