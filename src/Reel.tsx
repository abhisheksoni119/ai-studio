import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import {SEGS, BLOCKS, SCENES, FPS, TOTAL_FRAMES} from './timeline';
import {SCENE_MAP, } from './Scenes';
import {C} from './Art';

const XF = 10; // crossfade frames
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const SceneWrap: React.FC<{id: string; s: number; e: number; last: boolean}> = ({id, s, e, last}) => {
  const Comp = SCENE_MAP[id];
  const start = Math.max(0, Math.round(s * FPS) - (s > 0 ? XF : 0));
  const end = last ? TOTAL_FRAMES : Math.round(e * FPS);
  const dur = end - start;
  return (
    <Sequence from={start} durationInFrames={dur} name={id}>
      <Inner Comp={Comp} at={start / FPS} dur={dur} fadeIn={s > 0} />
    </Sequence>
  );
};

const Inner: React.FC<{Comp: React.FC<any>; at: number; dur: number; fadeIn: boolean}> = ({Comp, at, dur, fadeIn}) => {
  const t = useCurrentFrame();
  const op = fadeIn ? interpolate(t, [0, XF], [0, 1], cl) : 1;
  const zoom = interpolate(t, [0, dur], [1.0, 1.05]);
  return (
    <AbsoluteFill style={{opacity: op}}>
      <svg viewBox="0 0 1080 1920" width="1080" height="1920" style={{transform: `scale(${zoom})`}}>
        <Comp t={t} at={at} dur={dur} />
      </svg>
    </AbsoluteFill>
  );
};

const clean = (w: string) => w.toLowerCase().replace(/[^a-z\-]/g, '');

const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const sec = f / FPS;
  const onLight = sec > 66.2;
  const bi = BLOCKS.findIndex((b, i) => {
    const s = SEGS[b[0]].s;
    const next = BLOCKS[i + 1] ? SEGS[BLOCKS[i + 1][0]].s : 99;
    return sec >= s - 0.05 && sec < next - 0.05;
  });
  if (bi < 0) return null;
  const block = BLOCKS[bi];
  const blockEnd = SEGS[block[block.length - 1]].e;
  const nextStart = BLOCKS[bi + 1] ? SEGS[BLOCKS[bi + 1][0]].s : 99;
  const out = interpolate(sec, [Math.min(blockEnd + 0.6, nextStart - 0.25), nextStart - 0.05], [1, 0], cl);
  const words: {w: string; at: number; kw: boolean}[] = [];
  block.forEach((si) => {
    const seg = SEGS[si];
    const ws = seg.text.split(' ');
    ws.forEach((w, i) => {
      words.push({w, at: seg.s + (i / ws.length) * (seg.e - seg.s) * 0.92, kw: (seg.kw ?? []).includes(clean(w))});
    });
  });
  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: 1430, opacity: out}}>
      <div style={{width: 900, textAlign: 'center', lineHeight: 1.18, fontFamily: 'Cormorant Garamond', fontStyle: 'italic', fontWeight: 500,
        fontSize: words.length > 12 ? 64 : 76, color: onLight ? '#2a1c14' : C.sand, textShadow: onLight ? 'none' : '0 4px 24px rgba(0,0,0,0.85)'}}>
        {words.map((w, i) => {
          const p = interpolate(sec, [w.at, w.at + 0.18], [0, 1], cl);
          return (
            <span key={i} style={{display: 'inline-block', marginRight: 18, opacity: p, transform: `translateY(${(1 - p) * 14}px)`,
              ...(w.kw ? {fontStyle: 'normal', fontWeight: 700, color: onLight ? '#b5561c' : C.ember, letterSpacing: 2, textTransform: 'uppercase'} : {})}}>
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    {SCENES.map((sc, i) => <SceneWrap key={sc.id} {...sc} last={i === SCENES.length - 1} />)}
    {/* bottom shade for caption legibility */}
    <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 100%)'}} />
    <Captions />
    <Audio src={staticFile('voice.mp3')} />
    <Audio src={staticFile('pad.mp3')} volume={0.22} />
  </AbsoluteFill>
);
