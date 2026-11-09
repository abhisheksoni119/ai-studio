# Making a reel — the order that actually works

Supersedes the Whisper section of `HOW-TO-RUN.md`, which documents a path that
does not work in a sandboxed container.

Run everything from the repo root, on **your own machine**. Image generation and
the speech model both need hosts that are blocked from the cloud container, so
those two steps belong here, not there.

---

## The five commands

```
node sync-offline.mjs <slug>     # 1. time the captions to the voice
node prepare.mjs      <slug>     # 2. scenes, captions, scene-plan.json
node fetch-images.mjs <slug>     # 3. generate the artwork  (free, no account)
node prepare.mjs      <slug>     # 4. attach the images
npm run render                   # 5. -> out/<slug>-reel.mp4
```

`prepare.mjs` runs twice on purpose: the first pass writes the prompts,
`fetch-images.mjs` fills them, the second pass attaches the results.

Skip step 1 if there is no `voice.mp3`. Skip steps 3 and 4 to render as vector
art only — the video still completes.

---

## 1. Captions — `sync-offline.mjs`

```
node sync-offline.mjs <slug> [--noise -32dB] [--min-pause 0.35] [--dry]
```

Writes `stories/<slug>/words.json`.

**Use this instead of `transcribe.mjs`.** `transcribe.mjs` needs a Whisper model
from huggingface.co. Where that host is unreachable it exits, and `prepare.mjs`
silently falls back to a syllable estimate whose worst drift on these two
stories is **8.8s and 9.0s** — by the end of a reel the caption is a sentence
and a half behind the voice. Neither story had a `words.json` at all, so the
captions had never been timed to the audio.

`sync-offline.mjs` does not recognise speech. It finds where the speaker pauses
(ffmpeg `silencedetect`, offline) and pins each sentence of the script to the
audio between two pauses, spreading word times inside a sentence by syllable
weight. Verified on both stories: 100% of words anchored, under 3% of words
landing in silence.

If it reports far more segments than sentences, the read has long breaths — try
`--min-pause 0.5`. If it finds almost none, try `--noise -40dB`.

`transcribe.mjs` is still the better tool **on a machine that can reach
huggingface.co**. Run `npm run caption-sync-setup` once, then
`node transcribe.mjs <slug>`. Both write the same `words.json`.

---

## 2. Images — `fetch-images.mjs`

```
node fetch-images.mjs <slug>                      # AI Horde, Deliberate model
node fetch-images.mjs <slug> --model "Rev Animated"
node fetch-images.mjs <slug> --force              # ignore the cache
```

Free, no account, no API key. Images cache in `image-cache/` keyed by a hash of
the prompt, so re-rendering costs nothing and editing one sentence regenerates
only that scene.

**Any scene without an image renders as vector art instead**, so a timeout never
leaves a hole — but it also means a total failure is silent. Check the count it
prints, and check that `public/scenes/` is not empty.

If `public/scenes/` does not exist, no image has ever been generated and every
scene in the finished video is vector art.

---

## What the vector fallback currently looks like

Measured on `out/how-can-i-trust-god-when-i-feel-anxious-reel.mp4`:

| Frame band | Mean luma (0–255) |
|---|---|
| top 10% | 29.8 |
| brightest band (50–60%) | **55.7** |
| bottom 20% | 14–15 |

Peak brightness is 22%. The bottom fifth of every frame is effectively black.
Across twelve sampled frames the same figure stands in the same pose, centred,
in all twelve; rain falls in eight; there is one prop in the whole reel.

Two things are **not** wrong, having been checked: caption chunking produces
**no** mid-phrase breaks on either script, and the renders really are 1080×1920
at 30fps.

---

## Scripts decide how the visuals look

`prompt-plan.mjs` resolves, per sentence, an **action** → **character** →
**place**, from keyword tables of concrete moments ("nailed to a cross",
"calmed the storm", "knelt").

A sentence with no concrete noun matches nothing and falls through to a default
— a figure standing in weather. That is why the anxious reel looks the way it
does: the script is abstract ("The Bible gives us a powerful answer", "Notice
what this means"), so almost nothing in it can be drawn.

`stories/abraham/script.txt` is the counter-example — knife, wood, ram, thicket,
mountain, altar, stars, lamb. The same code renders it far better.

**Write scripts with things in them.** A sentence a camera could point at.

---

## Audio

Bible reels render with `public/pad.mp3` under the voice at the `musicVolume` in
`story.json`. The pad has its own beat and the scene cuts come from the script,
so the two are unrelated — if music and cuts need to agree, that is a change to
make deliberately, not a bug to find.
