import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import {STORY_SEGS, STORY_BLOCKS, STORY_SCENES, STORY_FPS, STORY_TOTAL_FRAMES, STORY_DURATION} from './story-timeline';
import {Composer} from './Composer';
import {PALETTES} from './Atoms';
import type {SceneSpec} from './SceneSpec';

const XF = 8; // crossfade frames — short, because scenes are short
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Abraham's reel (Reel.tsx / Scenes.tsx / timeline.ts) is a separate
// composition and shares no code with this file.

const SceneWrap: React.FC<{spec: SceneSpec; index: number; last: boolean}> = ({spec, index, last}) => {
  const start = Math.max(0, Math.round(spec.s * STORY_FPS) - (spec.s > 0 ? XF : 0));
  const end = last ? STORY_TOTAL_FRAMES : Math.round(spec.e * STORY_FPS);
  const dur = Math.max(2, end - start); // never zero/negative — interpolate would throw
  return (
    <Sequence from={start} durationInFrames={dur} name={spec.id}>
      <Inner spec={spec} dur={dur} fadeIn={spec.s > 0} uid={`sc${index}`} />
    </Sequence>
  );
};

/**
 * Ken Burns transform for a generated image. A still photograph held for three
 * seconds reads as a slideshow; a slow continuous move reads as film.
 */
function kenBurns(move: SceneSpec['move'], p: number): string {
  switch (move) {
    case 'inL':  return `scale(${1.06 + p * 0.1}) translate(${2.5 - p * 2}%, 0%)`;
    case 'inR':  return `scale(${1.06 + p * 0.1}) translate(${-2.5 + p * 2}%, 0%)`;
    case 'outC': return `scale(${1.2 - p * 0.12}) translate(0%, ${-1 + p * 1}%)`;
    case 'panL': return `scale(1.16) translate(${4 - p * 8}%, 0%)`;
    case 'panR': return `scale(1.16) translate(${-4 + p * 8}%, 0%)`;
    case 'inC':
    default:     return `scale(${1.05 + p * 0.11}) translate(0%, ${1 - p * 2}%)`;
  }
}

const Inner: React.FC<{spec: SceneSpec; dur: number; fadeIn: boolean; uid: string}> = ({spec, dur, fadeIn, uid}) => {
  const t = useCurrentFrame();
  const op = fadeIn ? interpolate(t, [0, XF], [0, 1], cl) : 1;
  const p = interpolate(t, [0, Math.max(1, dur)], [0, 1], cl);

  // A generated image, when there is one, IS the scene.
  if (spec.image) {
    return (
      <AbsoluteFill style={{opacity: op, overflow: 'hidden', backgroundColor: '#07070a'}}>
        <Img
          src={staticFile(`scenes/${spec.image}`)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: kenBurns(spec.move, p),
            transformOrigin: 'center center',
          }}
        />
        {/* Generated art has its own contrast, so captions need a scrim to sit on. */}
        <AbsoluteFill style={{
          background:
            'linear-gradient(to bottom, rgba(8,8,12,0.62) 0%, rgba(8,8,12,0.18) 34%,'
            + ' rgba(8,8,12,0.10) 58%, rgba(8,8,12,0.72) 100%)',
        }} />
      </AbsoluteFill>
    );
  }

  // No image for this scene — draw it as vector art instead of leaving a hole.
  return (
    <AbsoluteFill style={{opacity: op}}>
      <svg viewBox="0 0 1080 1920" width="1080" height="1920">
        <Composer spec={spec} t={t} dur={dur} uid={uid} />
      </svg>
    </AbsoluteFill>
  );
};

/** The spec on screen at a given second. */
const sceneAt = (sec: number): SceneSpec | undefined =>
  STORY_SCENES.find((sc) => sec >= sc.s && sec < sc.e) ?? STORY_SCENES[STORY_SCENES.length - 1];

const clean = (w: string) => w.toLowerCase().replace(/[^a-z\-]/g, '');

// Captions sit UPPER-LEFT and build word by word, following the reference
// reels. Centred text at the foot of the frame competes with the subject and
// with Instagram's own UI.
const LEAD = 0.12;    // seconds of head start on the narration
const FADE_IN = 0.1;  // per-word fade — short, so words snap in
const SPREAD = 0.8;   // reveal all words within this fraction of the segment

const StoryCaptions: React.FC = () => {
  const f = useCurrentFrame();
  const sec = f / STORY_FPS;

  const scene = sceneAt(sec);
  const tone = PALETTES[scene?.palette ?? 'olive'] ?? PALETTES.olive;
  // Over generated art the scrim is always dark, so caption text stays light
  // whatever the vector palette for that scene would have wanted.
  const overImage = Boolean(scene?.image);
  const paper = overImage ? '#f4ecdd' : tone.paper;
  const accent = overImage ? '#ffcf7a' : tone.accent;

  // END is a finite stand-in for "there is no next block". A non-finite value
  // would reach interpolate() below and throw mid-render; a small fixed
  // sentinel (e.g. 99) would silently hide the last caption of any video
  // longer than the sentinel.
  const END = STORY_DURATION + 1;

  const startOf = (blockIndex: number) =>
    STORY_BLOCKS[blockIndex] ? STORY_SEGS[STORY_BLOCKS[blockIndex][0]]?.s ?? END : END;

  const bi = STORY_BLOCKS.findIndex((b, i) => {
    const s = STORY_SEGS[b[0]]?.s ?? 0;
    return sec >= s - LEAD && sec < startOf(i + 1) - LEAD;
  });
  if (bi < 0) return null;

  const block = STORY_BLOCKS[bi];
  const blockEnd = STORY_SEGS[block[block.length - 1]]?.e ?? 0;
  const hasNext = bi + 1 < STORY_BLOCKS.length;
  const nextStart = startOf(bi + 1);

  // Hold the finished line briefly, then clear before the next arrives.
  // The final caption holds to the end of the video instead.
  const fadeStart = hasNext
    ? Math.min(blockEnd + 0.3, nextStart - 0.2)
    : Math.max(blockEnd, STORY_DURATION - 0.6);
  const fadeEnd = Math.max(fadeStart + 0.05, hasNext ? nextStart - 0.04 : STORY_DURATION);
  const out = interpolate(sec, [fadeStart, fadeEnd], [1, 0], cl);

  const words: {w: string; at: number; kw: boolean}[] = [];
  block.forEach((si) => {
    const seg = STORY_SEGS[si];
    if (!seg) return;
    const ws = seg.text.split(' ').filter(Boolean);
    const span = Math.max(0.4, seg.e - seg.s);
    ws.forEach((w, i) => {
      words.push({
        w,
        at: seg.s - LEAD + (i / Math.max(1, ws.length)) * span * SPREAD,
        kw: (seg.kw ?? []).includes(clean(w)),
      });
    });
  });

  const n = words.length;
  const fontSize = n > 16 ? 60 : n > 11 ? 66 : 72;

  return (
    <AbsoluteFill style={{opacity: out}}>
      <div style={{
        position: 'absolute', left: 92, top: 430, width: 790,
        textAlign: 'left', lineHeight: 1.26,
        fontFamily: 'Cormorant Garamond', fontStyle: 'italic', fontWeight: 500,
        fontSize, color: paper,
        textShadow: '0 3px 18px rgba(0,0,0,0.45)',
      }}>
        {words.map((w, i) => {
          const pr = interpolate(sec, [w.at, w.at + FADE_IN], [0, 1], cl);
          return (
            <span key={i} style={{
              display: 'inline-block', marginRight: 15, opacity: pr,
              transform: `translateY(${(1 - pr) * 10}px)`,
              ...(w.kw ? {fontStyle: 'normal', fontWeight: 700, color: accent} : {}),
            }}>
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * The dark pill at the foot of the frame carrying the scripture reference,
 * e.g. "GENESIS 3:8 · THE COOL OF THE DAY". Taken straight from the reference
 * reels: it anchors the frame and keeps the verse out of the spoken caption.
 */
const ScripturePill: React.FC = () => {
  const sec = useCurrentFrame() / STORY_FPS;
  const scene = sceneAt(sec);
  if (!scene?.scripture) return null;

  const tone = PALETTES[scene.palette] ?? PALETTES.olive;
  const into = interpolate(sec, [scene.s + 0.25, scene.s + 0.7], [0, 1], cl);
  const outOf = interpolate(sec, [scene.e - 0.45, scene.e - 0.1], [1, 0], cl);
  const op = Math.min(into, outOf);
  const {ref, phrase} = scene.scripture;

  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150, opacity: op}}>
      <div style={{
        background: 'rgba(12,10,8,0.82)',
        borderRadius: 999,
        padding: '18px 40px',
        fontFamily: 'Inter', fontWeight: 600,
        fontSize: 27, letterSpacing: 3.4,
        color: scene.image || tone.paper === '#2e2316' || tone.paper === '#2b2110' ? '#f2e8d4' : tone.paper,
        textTransform: 'uppercase',
        transform: `translateY(${(1 - op) * 14}px)`,
        whiteSpace: 'nowrap',
      }}>
        {ref}{phrase ? `  ·  ${phrase}` : ''}
      </div>
    </AbsoluteFill>
  );
};

export const StoryReel: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    {STORY_SCENES.map((spec, i) => (
      <SceneWrap key={`${spec.id}-${i}`} spec={spec} index={i} last={i === STORY_SCENES.length - 1} />
    ))}
    <StoryCaptions />
    <ScripturePill />
    {/* story-voice.mp3: new story audio — NEVER voice.mp3 (that's Abraham's) */}
    <Audio src={staticFile('story-voice.mp3')} />
    <Audio src={staticFile('pad.mp3')} volume={0.2} />
  </AbsoluteFill>
);
