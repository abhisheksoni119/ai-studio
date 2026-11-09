# Faith Reel Studio — making a video

## The three steps

```
node transcribe.mjs <slug>     # time the captions to the voice  (optional, once per MP3)
node prepare.mjs <slug>        # timing, captions, scene plan
node fetch-images.mjs <slug>   # generate the artwork  (free, no account)
node prepare.mjs <slug>        # attach the images
```
Then render as usual (the launcher does this for you).

`<slug>` is the folder name under `stories/`, e.g.
`how-can-i-trust-god-when-i-feel-anxious`.

---

## Image generation

Default provider is **AI Horde** — free, no account, no API key. It is a pool
of volunteered GPUs. All jobs are submitted up front (two per second, the only
hard limit) and then collected together, so a 31-scene video takes a couple of
minutes rather than one-at-a-time.

```
node fetch-images.mjs <slug>                      # AI Horde, Deliberate model
node fetch-images.mjs <slug> --model "Rev Animated"
node fetch-images.mjs <slug> --provider pollinations
node fetch-images.mjs <slug> --force              # ignore the cache
```

**Caching.** Images are stored in `image-cache/` keyed by a hash of the prompt.
Re-rendering the same video costs nothing, and editing one sentence regenerates
only that scene.

**Failures are safe.** Any scene without an image is drawn as vector art
instead, so a timeout or a rate limit never leaves a hole in the video.

### Trying a different look

The model changes the style more than anything else. Good ones on AI Horde:

| Model | Look |
|---|---|
| `Deliberate` | flat, painterly, warm — the current default |
| `Rev Animated` | stronger illustration, higher contrast |
| `AlbedoBase XL` | sharper and more detailed, slower |
| `Flat-2D Animerge` | very flat, graphic |

The shared style wording lives in `characters.mjs` → `STYLE`. Change it there
and every scene in every video follows.

### Using a paid generator instead

Add one entry to `PROVIDERS` in `fetch-images.mjs`:

```js
custom: {
  mode: 'direct',
  rateMs: 1000,
  url: (prompt, seed) => `https://your-endpoint?prompt=${encodeURIComponent(prompt)}&seed=${seed}`,
  headers: () => ({Authorization: `Bearer ${process.env.IMAGE_API_KEY}`}),
},
```
Then `node fetch-images.mjs <slug> --provider custom`.

---

## How a scene is chosen

`prompt-plan.mjs` reads each sentence and resolves, in order:

1. **An action** — "nailed to a cross" becomes a figure *hanging on* the cross,
   not an empty cross standing nearby.
2. **A symbol**, when the sentence is abstract — "sin separated humanity from
   God" becomes a chasm splitting rock with light unreachable on the far side.
3. **Who is present** — `characters.mjs` holds the appearance of Jesus, Moses,
   David, Mary, Paul, angels and the rest, so the right person is drawn.
4. **Where** — a named location carries for two scenes past its last mention,
   then releases. This is deliberate: an earlier version let one location latch
   on and 31 of 40 scenes became the same tomb.

`stories/<slug>/scene-plan.json` shows exactly what each scene will draw.
Edit a prompt there by hand and re-run `fetch-images.mjs` to change one shot.

---

## Caption timing

Captions are timed from the narration itself. `transcribe.mjs` listens to
`voice.mp3`, writes a word-by-word timestamp list to
`stories/<slug>/words.json`, and `prepare.mjs` uses it instead of guessing.

```
node transcribe.mjs <slug>                  # base model, the default
node transcribe.mjs <slug> --model tiny     # faster, slightly rougher
node transcribe.mjs <slug> --model small    # best, slow on a laptop CPU
```

Run it once per MP3. The launcher runs it automatically as step 1 and skips it
when `words.json` is already newer than `voice.mp3`.

**How accurate.** Measured against a read whose pace swings between 0.6x and
1.8x:

| Source | Average error | Worst caption |
|---|---|---|
| Syllable estimate | 1.56 s | 4.38 s |
| Read from the audio | 0.00 s | 0.01 s |
| Same, with 15% of words dropped and 15% misheard | 0.16 s | 1.24 s |

**It never breaks a render.** Whisper transcribes what it hears, which never
matches the script word for word: it writes "chapter four verses six and seven"
where the script says "Philippians 4:6-7", and it mishears names. `align.mjs`
anchors the words that do match and interpolates the rest, so a misheard phrase
stays a local error instead of shifting everything after it. If fewer than 55%
of the script's words can be matched — a stale `words.json`, or the wrong MP3 —
it says so and falls back to the estimate rather than placing captions it
cannot justify.

**Turning it on.** The speech model is a large download, so it is not installed
by default:

```
npm run caption-sync-setup
```

about 300 MB, once. Everything after that runs offline. Until it is installed
the launcher says so and carries on with the estimate.

**No Python, no ffmpeg.** The MP3 is decoded by `pcm.mjs` using
`mpg123-decoder`, a 220 KB WebAssembly build of libmpg123 that installs with
plain `npm install` on Windows. It resamples to the 16 kHz mono the model wants
with a windowed-sinc kernel; plain interpolation would fold everything above
8 kHz back into the signal as noise, in exactly the band the model reads.
