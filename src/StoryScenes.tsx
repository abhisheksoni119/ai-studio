// StoryScenes.tsx — scene library for NEW stories (StoryReel only)
//
// Abraham's scenes live in Scenes.tsx and are NOT touched by this file.
// Every scene here renders SVG children inside the <svg viewBox="0 0 1080 1920">
// wrapper provided by StoryReel.tsx.
//
// Props: t = local frame, at = scene start (global seconds), dur = length in frames.
//
// ID CONVENTION: every <Sky>, <Glow> and <defs> gradient gets a unique id prefix
// per scene. Two scenes overlap during the 10-frame crossfade, so duplicate ids
// would make one scene pick up the other's gradient.

import React from 'react';
import {interpolate, Easing, random} from 'remotion';
import {C, Sky, Stars, Glow, Ridge, Father, Son, Cross, Book, Altar, mix} from './Art';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const io = Easing.bezier(0.45, 0, 0.55, 1);

export type P = {t: number; at: number; dur: number};

/** Eased ramp. Guards against a zero-width input range, which would throw. */
const ramp = (t: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(t, [a, Math.max(a + 1, b)], [from, to], {...cl, easing: io});

/** Linear ramp without easing — for continuous drifts. */
const lin = (t: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(t, [a, Math.max(a + 1, b)], [from, to], cl);

const ground = (fill: string, y = 1260) => <rect x="0" y={y} width="1080" height={1920 - y} fill={fill} />;
const bob = (t: number, speed = 7, amp = 5) => -Math.abs(Math.sin(t / speed)) * amp;
const sway = (t: number, speed = 24, amp = 3) => Math.sin(t / speed) * amp;

// ─── Local primitives ─────────────────────────────────────────────────────────

/** Standing figure, feet at (x,y). Simplified silhouette. */
const Stand: React.FC<{x: number; y: number; s?: number; fill: string; lean?: number; armL?: number; armR?: number}> = ({
  x, y, s = 1, fill, lean = 0, armL = 14, armR = -14,
}) => (
  <g transform={`translate(${x},${y}) scale(${s}) rotate(${lean} 0 0)`} fill={fill}>
    <path d="M-34,0 L-24,-146 Q0,-164 24,-146 L36,0 Z" />
    <circle cx="2" cy="-186" r="20" />
    <rect x="-10" y="-172" width="22" height="22" rx="8" />
    <g transform={`translate(-20,-138) rotate(${armL})`}><rect x="-6" y="0" width="13" height="74" rx="6" /></g>
    <g transform={`translate(22,-138) rotate(${armR})`}><rect x="-6" y="0" width="13" height="74" rx="6" /></g>
  </g>
);

/** Kneeling figure, knees at (x,y). bow = forward head tilt in degrees. */
const Kneeler: React.FC<{x: number; y: number; s?: number; fill: string; bow?: number}> = ({x, y, s = 1, fill, bow = 12}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <ellipse cx="4" cy="-10" rx="58" ry="16" />
    <path d="M-40,-14 Q-28,-66 -4,-76 L30,-66 L36,-14 Z" />
    <g transform={`rotate(${bow} 0 -76)`}>
      <path d="M-20,-74 Q-26,-126 0,-138 Q28,-132 24,-86 Z" />
      <circle cx="4" cy="-156" r="19" />
      <path d="M14,-126 Q44,-106 36,-74" fill="none" stroke={fill} strokeWidth="13" strokeLinecap="round" />
    </g>
  </g>
);

/** Figure with both arms raised. */
const Raised: React.FC<{x: number; y: number; s?: number; fill: string; lift?: number}> = ({x, y, s = 1, fill, lift = 0}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <path d="M-34,0 L-24,-146 Q0,-164 24,-146 L36,0 Z" />
    <circle cx="2" cy="-186" r="20" />
    <g transform={`translate(-22,-150) rotate(${-150 - lift})`}><rect x="-7" y="0" width="14" height="92" rx="7" /></g>
    <g transform={`translate(24,-150) rotate(${150 + lift})`}><rect x="-7" y="0" width="14" height="92" rx="7" /></g>
  </g>
);

/** Simple sheep, feet at (x,y). */
const Sheep: React.FC<{x: number; y: number; s?: number; fill: string; head?: number}> = ({x, y, s = 1, fill, head = 0}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-28" y="-26" width="8" height="26" rx="4" />
    <rect x="-8" y="-26" width="8" height="26" rx="4" />
    <rect x="14" y="-26" width="8" height="26" rx="4" />
    <ellipse cx="0" cy="-44" rx="44" ry="26" />
    <g transform={`translate(40,-58) rotate(${head})`}>
      <ellipse cx="10" cy="4" rx="18" ry="13" />
      <rect x="2" y="12" width="7" height="14" rx="3" />
    </g>
  </g>
);

/** Oil lamp hanging from (x,y). */
const Lamp: React.FC<{x: number; y: number; s?: number; fill: string; flame?: string; flick?: number}> = ({
  x, y, s = 1, fill, flame = '#ffd68a', flick = 1,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <g fill={fill}>
      <path d="M-56,0 Q-60,36 -16,42 L22,42 Q62,34 56,0 Z" />
      <path d="M46,-4 Q84,-10 92,6 L72,12 Q62,2 46,6 Z" />
      <rect x="-6" y="-26" width="12" height="28" rx="5" />
      <path d="M-30,-26 Q0,-44 30,-26 Z" />
    </g>
    <ellipse cx="82" cy="2" rx={7 * flick} ry={16 * flick} fill={flame} />
  </g>
);

/** Unrolled scroll centred on (x,y). */
const Scroll: React.FC<{x: number; y: number; s?: number; fill: string; page: string; open: number}> = ({
  x, y, s = 1, fill, page, open,
}) => {
  const w = 60 + open * 300;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-w} y="-150" width={w * 2} height="300" rx="6" fill={page} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={-w + 36} y={-108 + i * 42} width={Math.max(0, w * 2 - 72)} height="7" rx="3" fill={fill} opacity="0.28" />
      ))}
      <g fill={fill}>
        <rect x={-w - 30} y="-176" width="30" height="352" rx="15" />
        <rect x={w} y="-176" width="30" height="352" rx="15" />
      </g>
    </g>
  );
};

/** Two stone tablets, base at (x,y). */
const Tablets: React.FC<{x: number; y: number; s?: number; fill: string; edge: string}> = ({x, y, s = 1, fill, edge}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    {[-1, 1].map((side) => (
      <g key={side} transform={`translate(${side * 92},0)`}>
        <path d="M-80,0 L-80,-200 Q-80,-268 0,-268 Q80,-268 80,-200 L80,0 Z" fill={fill} stroke={edge} strokeWidth="5" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="-48" y={-200 + i * 44} width="96" height="8" rx="4" fill={edge} opacity="0.45" />
        ))}
      </g>
    ))}
  </g>
);

/** Descending dove, centred on (x,y). */
const Dove: React.FC<{x: number; y: number; s?: number; fill: string; flap: number}> = ({x, y, s = 1, fill, flap}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <ellipse cx="0" cy="0" rx="46" ry="24" />
    <circle cx="40" cy="-16" r="18" />
    <path d="M54,-20 L80,-12 L54,-6 Z" />
    <path d={`M-10,-8 Q-50,${-70 - flap * 36} -96,${-30 - flap * 20} Q-56,-10 -14,-4 Z`} />
    <path d={`M-10,8 Q-50,${70 + flap * 36} -96,${30 + flap * 20} Q-56,10 -14,4 Z`} />
    <path d="M-40,2 L-104,20 L-44,-10 Z" />
  </g>
);

/** Ship's anchor, centred on (x,y). */
const Anchor: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill="none" stroke={fill} strokeWidth="20" strokeLinecap="round">
    <circle cx="0" cy="-150" r="30" />
    <line x1="0" y1="-120" x2="0" y2="140" />
    <line x1="-78" y1="-74" x2="78" y2="-74" />
    <path d="M-116,34 Q-108,150 0,152 Q108,150 116,34" />
  </g>
);

/** Crown of thorns, centred on (x,y). */
const Thorns: React.FC<{x: number; y: number; s?: number; stroke: string}> = ({x, y, s = 1, stroke}) => {
  // A wide, flat ellipse with a glow behind it reads as an eye. A rounder
  // ring in shallow perspective, with long uneven spikes, reads as a crown.
  const RX = 196;
  const RY = 134;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} fill="none" stroke={stroke} strokeLinecap="round">
      {/* three woven strands, each wobbling off the ellipse so it reads as branches */}
      {[0, 1, 2].map((band) => {
        const wob = 10 + band * 7;
        const pts = new Array(37).fill(0).map((_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const r = 1 + Math.sin(a * 3 + band * 2.1) * 0.05;
          return `${(Math.cos(a) * RX * r).toFixed(1)},${(Math.sin(a) * RY * r + Math.sin(a * 5 + band) * wob * 0.3).toFixed(1)}`;
        });
        return <polyline key={band} points={pts.join(' ')} stroke={stroke} strokeWidth={13 - band * 2} opacity={1 - band * 0.18} />;
      })}
      {/* spikes: long, uneven, angled away from the ring */}
      {new Array(26).fill(0).map((_, i) => {
        const a = (i / 26) * Math.PI * 2;
        const px = Math.cos(a) * RX;
        const py = Math.sin(a) * RY;
        const len = 72 + random(`thl${i}`) * 68;
        const tilt = (random(`tht${i}`) - 0.5) * 1.5;
        const ux = Math.cos(a + tilt);
        const uy = Math.sin(a + tilt) * 0.82;
        const mx = px + ux * len * 0.55 + (random(`thb${i}`) - 0.5) * 22;
        const my = py + uy * len * 0.55 + (random(`thc${i}`) - 0.5) * 22;
        return (
          <path key={i} d={`M${px},${py} Q${mx},${my} ${px + ux * len},${py + uy * len}`}
            stroke={stroke} strokeWidth={4 + random(`thw${i}`) * 6} />
        );
      })}
    </g>
  );
};

/** Wheat stalk rooted at (x,y). */
const Wheat: React.FC<{x: number; y: number; s?: number; fill: string; tilt: number}> = ({x, y, s = 1, fill, tilt}) => (
  <g transform={`translate(${x},${y}) scale(${s}) rotate(${tilt})`} fill={fill}>
    <rect x="-3" y="-150" width="6" height="150" rx="3" />
    {new Array(6).fill(0).map((_, i) => (
      <g key={i} transform={`translate(0,${-150 + i * 20})`}>
        <ellipse cx="-13" cy="0" rx="12" ry="7" transform="rotate(-32 -13 0)" />
        <ellipse cx="13" cy="0" rx="12" ry="7" transform="rotate(32 13 0)" />
      </g>
    ))}
    <ellipse cx="0" cy="-158" rx="7" ry="15" />
  </g>
);

/** Deterministic rain streaks falling across the frame. */
const Rainfall: React.FC<{t: number; n: number; seed: string; opacity?: number; color?: string}> = ({
  t, n, seed, opacity = 0.5, color = '#cfe0f0',
}) => (
  <g opacity={opacity} stroke={color} strokeWidth="3" strokeLinecap="round">
    {new Array(n).fill(0).map((_, i) => {
      const x = random(`${seed}x${i}`) * 1240 - 80;
      const speed = 22 + random(`${seed}s${i}`) * 16;
      const y = ((t * speed + random(`${seed}o${i}`) * 1600) % 1600) - 120;
      const len = 26 + random(`${seed}l${i}`) * 34;
      return <line key={i} x1={x} y1={y} x2={x - 10} y2={y + len} />;
    })}
  </g>
);

/** Rising smoke / mist columns from (x,y). */
const Smoke: React.FC<{t: number; x: number; y: number; n?: number; seed: string; color?: string; opacity?: number}> = ({
  t, x, y, n = 16, seed, color = '#d8cbb4', opacity = 0.3,
}) => (
  <g opacity={opacity}>
    {new Array(n).fill(0).map((_, i) => {
      const prog = ((t * 1.5 + i * (620 / n)) % 620) / 620;
      const r = 16 + prog * 62;
      const dx = Math.sin(prog * 5 + i) * 70 * prog;
      return (
        <circle key={i} cx={x + dx + (random(`${seed}${i}`) - 0.5) * 40} cy={y - prog * 620} r={r} fill={color} opacity={(1 - prog) * 0.5} />
      );
    })}
  </g>
);

// ═══ ANXIETY · STORM · FEAR ═══════════════════════════════════════════════════

/** Churning storm, rain, a figure bent against the wind. Lightning near the end. */
export const Storm: React.FC<P> = ({t, dur}) => {
  const strike = dur * 0.55;
  const flash = ramp(t, strike, strike + 2) * ramp(t, strike + 2, strike + 16, 1, 0);
  return (
    <>
      <Sky id="stm" top="#0a0c14" bottom="#2c2f3d" />
      {new Array(7).fill(0).map((_, i) => (
        <ellipse key={i} cx={(i * 230 + t * 1.4) % 1500 - 180} cy={180 + (i % 3) * 130} rx={300 + i * 24} ry={80 + (i % 2) * 24}
          fill="#151824" opacity={0.75} />
      ))}
      <Rainfall t={t} n={95} seed="stm" opacity={0.42} />
      <Ridge pts={[[0, 1270], [330, 1210], [700, 1250], [1080, 1200]]} fill="#141622" />
      {ground('#0b0d14', 1255)}
      <Stand x={540} y={1268} s={1.5} fill={C.ink} lean={-11} armL={38} armR={-6} />
      <rect width="1080" height="1920" fill="#e8f0ff" opacity={flash * 0.55} />
    </>
  );
};

/** A figure bowed under an unseen weight, shoulders low. */
export const Burden: React.FC<P> = ({t, dur}) => {
  const ease = ramp(t, dur * 0.6, dur * 0.95, 0, 1);
  return (
    <>
      <Sky id="brd" top="#16131c" bottom={mix('#3a2f33', '#7a5a46', ease)} />
      <Glow id="brdg" cx={540} cy={380} r={ramp(t, dur * 0.55, dur, 120, 620)} color="#ffdfa8" opacity={0.5 * ease + 0.12} />
      <Ridge pts={[[0, 1300], [360, 1240], [740, 1280], [1080, 1230]]} fill="#231c22" />
      {ground('#141014', 1285)}
      <g transform={`translate(0,${-ease * 26})`}>
        <Stand x={540} y={1296} s={1.6} fill={C.ink} lean={lin(t, 0, dur, -16, -16 + ease * 14)} armL={64} armR={52} />
      </g>
      <ellipse cx="540" cy={1150 - ease * 60} rx={150 * (1 - ease * 0.7)} ry={46 * (1 - ease * 0.7)} fill="#0a0810" opacity={0.55 * (1 - ease)} />
    </>
  );
};

/** Sinking in deep water, light far above — fear, drowning, overwhelm. */
export const DeepWater: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="dpw" top="#13406b" bottom="#03060f" />
    <defs>
      <linearGradient id="dpw-ray" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bfe4ff" stopOpacity="0.5" />
        <stop offset="1" stopColor="#bfe4ff" stopOpacity="0" />
      </linearGradient>
    </defs>
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M${260 + i * 180 + sway(t, 40, 24)},0 L${340 + i * 180 + sway(t, 40, 24)},0 L${430 + i * 190},1200 L${200 + i * 190},1200 Z`}
        fill="url(#dpw-ray)" opacity={0.5 + Math.sin(t / 26 + i) * 0.2} />
    ))}
    <Glow id="dpwg" cx={540} cy={-80} r={700} color="#8fd0ff" opacity={0.45} />
    <g transform={`translate(0,${lin(t, 0, dur, 980, 1120)})`}>
      <Stand x={540} y={0} s={1.25} fill="#050a12" lean={sway(t, 34, 7)} armL={-128} armR={128} />
    </g>
    {new Array(26).fill(0).map((_, i) => {
      const y = 1500 - ((t * (1.6 + (i % 4) * 0.7) + i * 70) % 1700);
      return <circle key={i} cx={300 + ((i * 139) % 520) + sway(t, 20 + i, 12)} cy={y} r={3 + (i % 4) * 2.5} fill="#bfe4ff" opacity={0.3} />;
    })}
  </>
);

// ═══ PEACE · CALM · COMFORT ═══════════════════════════════════════════════════

/** Glassy lake under moonlight with a mirrored reflection. */
export const StillWater: React.FC<P> = ({t}) => (
  <>
    <Sky id="stw" top="#0a1526" bottom="#2f4258" />
    <Stars n={90} t={t} seed="stw" maxY={900} />
    <Glow id="stwm" cx={700} cy={430} r={300} color="#e4f1ff" opacity={0.45} />
    <circle cx={700} cy={430} r={54} fill="#f3f9ff" />
    <Ridge pts={[[0, 1010], [280, 940], [560, 990], [820, 920], [1080, 980]]} fill="#17202f" />
    <rect x="0" y="1010" width="1080" height="910" fill="#101a28" />
    <circle cx={700} cy={1200 + sway(t, 50, 5)} r={46} fill="#9fb6cc" opacity="0.3" />
    {new Array(22).fill(0).map((_, i) => (
      <rect key={i} x={560 + sway(t, 18 + i * 1.6, 26)} y={1070 + i * 36} width={280 - i * 6} height="4" rx="2" fill="#cfe2f5"
        opacity={0.16 + Math.sin(t / 20 + i) * 0.07} />
    ))}
  </>
);

/** Figure sheltered under an overhanging rock, warm light outside. */
export const Shelter: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="shl" top="#241a2c" bottom="#e2a567" />
    <Glow id="shlg" cx={840} cy={880} r={ramp(t, 0, dur, 380, 560)} color="#ffd79a" opacity={0.65} />
    <circle cx={840} cy={880} r={62} fill="#ffeec6" />
    <Ridge pts={[[0, 1240], [420, 1190], [760, 1230], [1080, 1180]]} fill="#4a3330" />
    <path d="M-60,0 L-60,1300 L250,1300 Q300,1000 420,860 Q300,700 250,0 Z" fill="#1a1216" />
    <path d="M250,1300 Q300,1000 420,860 Q520,760 640,740 L640,640 Q420,660 300,820 Q190,980 150,1300 Z" fill="#241a1e" />
    {ground('#140e12', 1270)}
    <Kneeler x={330} y={1278} s={1.25} fill="#0a0708" bow={8} />
  </>
);

/** Soft pastel dawn over gentle hills with a seated figure — rest, stillness. */
export const Calm: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="clm" top="#4a4a74" bottom="#f3c49a" />
    <Glow id="clmg" cx={540} cy={ramp(t, 0, dur, 1040, 860)} r={620} color="#ffd9a8" opacity={0.6} />
    <circle cx={540} cy={ramp(t, 0, dur, 1040, 860)} r={92} fill="#fff0cd" />
    {new Array(5).fill(0).map((_, i) => (
      <ellipse key={i} cx={(i * 280 + t * 0.5) % 1400 - 160} cy={420 + (i % 2) * 110} rx={190} ry={30} fill="#ffe3c0" opacity="0.3" />
    ))}
    <Ridge pts={[[0, 1240], [320, 1180], [620, 1220], [1080, 1160]]} fill="#9a7384" />
    <Ridge pts={[[0, 1340], [400, 1290], [780, 1330], [1080, 1300]]} fill="#4e3545" />
    {ground('#2a1d28', 1330)}
    <g transform="translate(560,1332)">
      <ellipse cx="0" cy="-8" rx="54" ry="14" fill={C.ink} />
      <path d="M-34,-12 Q-24,-96 0,-110 Q26,-98 32,-12 Z" fill={C.ink} />
      <circle cx="2" cy="-132" r="19" fill={C.ink} />
    </g>
  </>
);

// ═══ PRAYER · CRYING OUT ══════════════════════════════════════════════════════

/** Kneeling figure inside a descending beam of light. */
export const Kneel: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="knl" top="#161027" bottom="#5a3a46" />
    <Stars n={46} t={t} seed="knl" opacity={0.4} />
    <defs>
      <linearGradient id="knl-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff4d8" stopOpacity="0.8" />
        <stop offset="1" stopColor="#fff4d8" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d={`M${500 - ramp(t, 0, dur * 0.6, 8, 54)},0 L${556 + ramp(t, 0, dur * 0.6, 8, 54)},0 L740,1290 L350,1290 Z`}
      fill="url(#knl-beam)" opacity={ramp(t, 0, 26)} />
    <Ridge pts={[[0, 1268], [340, 1226], [720, 1258], [1080, 1220]]} fill="#3a2630" />
    {ground('#180f15', 1280)}
    <Glow id="knlg" cx={540} cy={1200} r={ramp(t, 0, dur, 220, 300)} color="#ffeec4" opacity={0.6} />
    <Kneeler x={540} y={1290} s={1.45} fill={C.ink} bow={ramp(t, 0, dur * 0.7, 20, 8)} />
  </>
);

/** Silhouette with both arms raised against a widening glow — surrender, praise. */
export const HandsUp: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="hup" top="#1d1436" bottom="#b5613c" />
    <Glow id="hupg" cx={540} cy={760} r={ramp(t, 0, dur, 300, 720)} color="#ffd89a" opacity={0.8} />
    {new Array(16).fill(0).map((_, i) => (
      <rect key={i} x="534" y="180" width="12" height="620" fill="#ffe7b8" opacity={0.1 + Math.sin(t / 14 + i) * 0.05}
        transform={`rotate(${i * 22.5 + t * 0.25} 540 760)`} />
    ))}
    <Ridge pts={[[0, 1300], [380, 1250], [740, 1290], [1080, 1240]]} fill="#2e1f28" />
    {ground('#171015', 1300)}
    <Raised x={540} y={1308} s={1.6} fill={C.ink} lift={ramp(t, 0, dur * 0.8, 0, 16)} />
  </>
);

/** Stone altar with smoke rising — offering, intercession. */
export const Incense: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="inc" top="#140f1c" bottom="#4a2f2a" />
    <Glow id="incg" cx={540} cy={1180} r={ramp(t, 0, dur, 240, 340)} color="#ff9a4a" opacity={0.5} />
    <Smoke t={t} x={540} y={1130} n={18} seed="inc" color="#cdbba0" opacity={0.34} />
    <Ridge pts={[[0, 1320], [300, 1270], [780, 1310], [1080, 1260]]} fill="#2a1d22" />
    {ground('#140e12', 1320)}
    <Altar x={540} y={1320} fill="#1c1316" wood="#4a2e1d" />
    {new Array(9).fill(0).map((_, i) => {
      const p = ((t * 2 + i * 24) % 160) / 160;
      return <circle key={i} cx={500 + ((i * 53) % 90) + Math.sin(t / 9 + i) * 14} cy={1210 - p * 150} r={5 + (i % 3) * 3}
        fill="#ff9c42" opacity={(1 - p) * 0.75} />;
    })}
  </>
);

// ═══ FAITH · TRUST · WAITING ══════════════════════════════════════════════════

/** Figure on a high rock watching the horizon — waiting, expectancy. */
export const Watchtower: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="wtc" top="#27224a" bottom="#e9a86f" />
    <circle cx={840} cy={ramp(t, 0, dur, 880, 790)} r={76} fill="#ffe8bb" />
    <Glow id="wtcg" cx={840} cy={ramp(t, 0, dur, 880, 790)} r={420} color="#ffd79a" opacity={0.6} />
    {new Array(4).fill(0).map((_, i) => (
      <ellipse key={i} cx={(i * 320 + t * 0.6) % 1500 - 180} cy={520 + (i % 2) * 90} rx={210} ry={26} fill="#f2c79c" opacity="0.26" />
    ))}
    <Ridge pts={[[0, 1180], [340, 1120], [700, 1170], [1080, 1110]]} fill="#7a5060" />
    <path d="M-40,1920 L-40,1340 L180,1300 L330,1120 L470,1096 L520,1140 L560,1920 Z" fill="#241820" />
    <Stand x={420} y={1104} s={1.1} fill={C.ink} armL={-58} armR={10} />
    {ground('#1a1118', 1420)}
  </>
);

/** Anchor resting in deep water, light far above — hope that holds. */
export const AnchorScene: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="anc" top="#0f4e7a" bottom="#020710" />
    <Glow id="ancg" cx={540} cy={-60} r={780} color="#9bd6ff" opacity={ramp(t, 0, dur, 0.3, 0.5)} />
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${340 + i * 220},0 L${430 + i * 220},0 L${520 + i * 210},1100 L${270 + i * 210},1100 Z`}
        fill="#8fd0ff" opacity={0.1 + Math.sin(t / 30 + i) * 0.05} />
    ))}
    <g transform={`translate(540,${1180 + sway(t, 46, 10)})`}>
      <Anchor x={0} y={0} s={1.5} fill="#050b14" />
    </g>
    <path d={`M540,-20 Q${560 + sway(t, 38, 16)},480 540,1010`} fill="none" stroke="#071018" strokeWidth="14" strokeLinecap="round" />
    <Ridge pts={[[0, 1580], [360, 1520], [760, 1570], [1080, 1510]]} fill="#020609" />
  </>
);

/** A seed breaking through soil toward the sun — new growth, small beginnings. */
export const Seed: React.FC<P> = ({t, dur}) => {
  const grow = ramp(t, dur * 0.12, dur * 0.88, 0, 1);
  return (
    <>
      <Sky id="sed" top="#3a3a68" bottom="#f0c489" />
      <circle cx={760} cy={620} r={78} fill="#fff0c4" />
      <Glow id="sedg" cx={760} cy={620} r={440} color="#ffd79a" opacity={0.6} />
      <Ridge pts={[[0, 1200], [420, 1160], [800, 1190], [1080, 1150]]} fill="#8a6a56" />
      {ground('#3d2a20', 1230)}
      <rect x="0" y="1230" width="1080" height="690" fill="#2a1c15" />
      <g transform="translate(470,1232)">
        <rect x="-7" y={-200 * grow} width="14" height={200 * grow} rx="7" fill="#1d3a1c" />
        <g opacity={ramp(t, dur * 0.4, dur * 0.72)} transform={`translate(0,${-170 * grow})`}>
          <ellipse cx="-56" cy="-6" rx="56" ry="25" fill="#28521f" transform={`rotate(${-26 + sway(t, 30, 5)} -56 -6)`} />
          <ellipse cx="56" cy="-16" rx="52" ry="23" fill="#2f6126" transform={`rotate(${22 + sway(t, 34, 5)} 56 -16)`} />
        </g>
      </g>
      {new Array(14).fill(0).map((_, i) => {
        const y = 1232 - ((t * 1.2 + i * 60) % 520);
        return <circle key={i} cx={330 + ((i * 97) % 440)} cy={y} r={2 + (i % 3)} fill="#ffe7b4" opacity={0.4} />;
      })}
    </>
  );
};

/** An oil lamp lighting one step of a dark path — guidance, one step at a time. */
export const LampPath: React.FC<P> = ({t, dur}) => {
  const flick = 0.9 + Math.sin(t / 4.5) * 0.08 + Math.sin(t / 1.9) * 0.04;
  return (
    <>
      <Sky id="lmp" top="#07060c" bottom="#1d1620" />
      <Stars n={56} t={t} seed="lmp" opacity={0.42} maxY={820} />
      <Glow id="lmpg" cx={560} cy={1050} r={ramp(t, 0, dur, 330, 420) * flick} color="#ffc878" opacity={0.65} />
      <Ridge pts={[[0, 1320], [320, 1280], [740, 1310], [1080, 1270]]} fill="#140f16" />
      {ground('#0a070c', 1320)}
      <path d="M380,1920 Q470,1560 540,1330 L640,1330 Q560,1580 520,1920 Z" fill="#241b1c" opacity={0.8 * flick} />
      <g transform="translate(560,1040)">
        <rect x="-4" y="-540" width="8" height="540" fill="#17121a" />
        <Lamp x={0} y={0} s={1.15} fill="#120d12" flick={flick} />
      </g>
      <Stand x={700} y={1332} s={1.1} fill="#070509" armL={-44} armR={16} />
    </>
  );
};

// ═══ JOURNEY · PATH · VALLEY ══════════════════════════════════════════════════

/** A narrow valley between two cliffs, one small figure walking through. */
export const Valley: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="vly" top="#2a2446" bottom="#dda076" />
    <Glow id="vlyg" cx={540} cy={900} r={ramp(t, 0, dur, 280, 420)} color="#ffd9a4" opacity={0.6} />
    <path d="M-60,0 L-60,1920 L300,1920 Q330,1300 420,980 Q350,520 300,0 Z" fill="#241a28" />
    <path d="M1140,0 L1140,1920 L790,1920 Q760,1300 670,980 Q740,520 790,0 Z" fill="#1d1420" />
    <path d="M300,1920 Q330,1300 420,980 L470,980 Q400,1320 390,1920 Z" fill="#30232f" />
    <path d="M790,1920 Q760,1300 670,980 L620,980 Q690,1320 700,1920 Z" fill="#271b26" />
    <Ridge pts={[[420, 1420], [540, 1400], [670, 1420]]} fill="#140d14" />
    <Stand x={lin(t, 0, dur, 500, 572)} y={1430 + bob(t, 8, 4)} s={0.78} fill="#07050a" armL={22} armR={-18} />
    {ground('#0d0810', 1430)}
  </>
);

/** Dunes under a heavy sun, one traveller — the long dry stretch. */
export const Desert: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="dsr" top="#8a5a46" bottom="#f4cf96" />
    <circle cx={540} cy={700} r={120} fill="#fff2cc" opacity="0.92" />
    <Glow id="dsrg" cx={540} cy={700} r={560} color="#ffdca0" opacity={0.7} />
    <Ridge pts={[[0, 1180], [260, 1120], [540, 1160], [820, 1110], [1080, 1150]]} fill="#c79866" />
    <Ridge pts={[[0, 1320], [340, 1250], [700, 1300], [1080, 1240]]} fill="#a9774e" />
    <Ridge pts={[[0, 1470], [420, 1410], [820, 1460], [1080, 1420]]} fill="#7d5236" />
    {ground('#5c3a28', 1460)}
    <g transform={`translate(${lin(t, 0, dur, 300, 430)},0)`}>
      <Father x={0} y={1472 + bob(t, 9, 5)} s={1.15} fill={C.ink} arm={18} />
      <ellipse cx="6" cy="1480" rx="54" ry="11" fill="#3a2418" opacity="0.5" />
    </g>
    {new Array(12).fill(0).map((_, i) => (
      <ellipse key={i} cx={(i * 150 + t * 2.4) % 1300 - 110} cy={1380 + (i % 3) * 40} rx={90} ry={6} fill="#e8c492" opacity="0.2" />
    ))}
  </>
);

/** A narrow path winding uphill into light — the hard, right way. */
export const NarrowPath: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="nrp" top="#2e2550" bottom="#f0b478" />
    <Glow id="nrpg" cx={620} cy={520} r={ramp(t, 0, dur, 320, 520)} color="#fff0c6" opacity={0.75} />
    <circle cx={620} cy={520} r={56} fill="#fff6dd" />
    <Ridge pts={[[0, 1220], [280, 1080], [520, 900], [700, 760], [900, 900], [1080, 1040]]} fill="#5a3d4e" />
    <Ridge pts={[[0, 1380], [320, 1280], [620, 1120], [820, 1220], [1080, 1320]]} fill="#33222e" />
    <path d="M430,1920 Q500,1640 470,1420 Q450,1240 560,1120 Q640,1030 660,900"
      fill="none" stroke="#d8b78c" strokeWidth="46" strokeLinecap="round" opacity="0.5" />
    <path d="M430,1920 Q500,1640 470,1420 Q450,1240 560,1120 Q640,1030 660,900"
      fill="none" stroke="#f0d8ae" strokeWidth="18" strokeLinecap="round" opacity="0.6" strokeDasharray="30 26" />
    {ground('#1d1220', 1500)}
    <Stand x={lin(t, 0, dur, 470, 512)} y={lin(t, 0, dur, 1480, 1382) + bob(t, 9, 4)} s={lin(t, 0, dur, 0.95, 0.82)}
      fill="#0a070c" armL={24} armR={-20} />
  </>
);

/** A fork in the road — decision, discernment. */
export const Crossroads: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="crx" top="#241d3e" bottom="#c88a5e" />
    <Glow id="crxg" cx={780} cy={840} r={ramp(t, 0, dur, 280, 440)} color="#ffd9a4" opacity={0.55} />
    <Glow id="crxg2" cx={300} cy={880} r={300} color="#7a6aa0" opacity={0.3} />
    <Ridge pts={[[0, 1180], [360, 1120], [720, 1170], [1080, 1110]]} fill="#4a3448" />
    {ground('#241826', 1210)}
    <path d="M520,1920 L580,1920 L600,1300 L500,1300 Z" fill="#d6b68e" opacity="0.45" />
    <path d="M500,1300 Q380,1240 180,1216 L170,1256 Q390,1282 510,1340 Z" fill="#c2a079" opacity="0.4" />
    <path d="M600,1300 Q720,1236 930,1206 L940,1246 Q730,1278 610,1340 Z" fill="#e2c599" opacity="0.5" />
    <g transform="translate(700,1300)">
      <rect x="-7" y="-300" width="14" height="300" fill="#1a1118" />
      <rect x="-134" y="-290" width="128" height="34" rx="6" fill="#1a1118" />
      <rect x="8" y="-236" width="130" height="34" rx="6" fill="#1a1118" />
    </g>
    <Stand x={430} y={1322} s={1.25} fill={C.ink} armL={-26} armR={14} />
  </>
);

// ═══ WORD · SCRIPTURE · TRUTH ═════════════════════════════════════════════════

/** A scroll unrolling into light — the written word opening up. */
export const ScrollScene: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="scr" top="#120e0a" bottom="#2f2015" />
    <Glow id="scrg" cx={540} cy={940} r={ramp(t, 0, dur, 340, 660)} color={C.gold} opacity={0.6} />
    {new Array(12).fill(0).map((_, i) => (
      <rect key={i} x="536" y="340" width="8" height="600" fill={C.gold} opacity="0.1"
        transform={`rotate(${i * 30 + t * 0.3} 540 940)`} />
    ))}
    <Scroll x={540} y={940} s={1.05} fill="#4a3220" page="#e8d8b4" open={ramp(t, 4, dur * 0.65, 0.05, 1)} />
    {new Array(22).fill(0).map((_, i) => {
      const y = 1020 - ((t * 1.6 + i * 54) % 680);
      return <circle key={i} cx={320 + ((i * 101) % 460)} cy={y} r={2 + (i % 3)} fill={C.gold} opacity={0.5} />;
    })}
  </>
);

/** Stone tablets on the mount — commandment, covenant, law. */
export const TabletsScene: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="tbl" top="#0f1020" bottom="#453048" />
    <Stars n={54} t={t} seed="tbl" opacity={0.42} maxY={760} />
    <Glow id="tblg" cx={540} cy={820} r={ramp(t, 0, dur, 420, 720)} color="#dff0ff" opacity={0.6} />
    {new Array(14).fill(0).map((_, i) => (
      <rect key={i} x="534" y="260" width="10" height="560" fill="#dff0ff" opacity="0.07"
        transform={`rotate(${i * 25.7 + t * 0.2} 540 820)`} />
    ))}
    <Ridge pts={[[0, 1560], [300, 1430], [540, 1350], [780, 1430], [1080, 1560]]} fill="#1c1626" />
    <g transform={`translate(0,${ramp(t, 0, dur * 0.5, 44, 0)})`} opacity={ramp(t, 0, 22)}>
      <Tablets x={540} y={1400} s={1.5} fill="#7a7488" edge="#241e2e" />
    </g>
  </>
);

/** A glowing open book with rising motes — scripture read, truth received. */
export const OpenBook: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="obk" top="#0e0b0a" bottom="#2b1d14" />
    <Glow id="obkg" cx={540} cy={900} r={ramp(t, 0, dur, 420, 640)} color={C.gold} opacity={ramp(t, 0, 36, 0.25, 0.7)} />
    <g transform={`translate(0,${ramp(t, 0, dur * 0.45, 26, 0)})`}>
      <Book x={540} y={880} fill="#3b2614" page={C.sand} />
    </g>
    {new Array(28).fill(0).map((_, i) => {
      const y = 960 - ((t * (1.3 + (i % 4) * 0.5) + i * 44) % 740);
      return <circle key={i} cx={340 + ((i * 113) % 400) + Math.sin(t / 16 + i) * 12} cy={y} r={2 + (i % 3)} fill={C.gold} opacity={0.6} />;
    })}
  </>
);

// ═══ LIGHT · GLORY · PRESENCE ═════════════════════════════════════════════════

/** A full sunrise cresting the hills — new mercy, a new day. */
export const Sunrise: React.FC<P> = ({t, dur}) => {
  const rise = ramp(t, 0, dur, 0, 1);
  return (
    <>
      <Sky id="snr" top={mix('#1e1b40', '#5b73a8', rise)} bottom={mix('#b05f3c', '#f8d49a', rise)} />
      <Stars n={70} t={t} seed="snr" opacity={(1 - rise) * 0.7} maxY={700} />
      <Glow id="snrg" cx={540} cy={1180 - rise * 340} r={200 + rise * 520} color="#ffd48a" opacity={0.78} />
      <circle cx={540} cy={1180 - rise * 340} r={110} fill="#fff3d0" />
      {new Array(18).fill(0).map((_, i) => (
        <rect key={i} x="534" y={700 - rise * 340} width="12" height="560" fill="#ffe3ae" opacity={0.08 * rise}
          transform={`rotate(${i * 20 + t * 0.2} 540 ${1180 - rise * 340})`} />
      ))}
      <Ridge pts={[[0, 1240], [300, 1190], [620, 1230], [1080, 1180]]} fill={mix('#3a2a40', '#8a6270', rise)} />
      <Ridge pts={[[0, 1360], [380, 1310], [760, 1350], [1080, 1320]]} fill={mix('#1e1420', '#4a3240', rise)} />
      {ground(mix('#140d16', '#2e2028', rise), 1350)}
    </>
  );
};

/** A pillar of cloud and fire — God going ahead of his people. */
export const Pillar: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="plr" top="#0b0a1a" bottom="#3a2230" />
    <Stars n={60} t={t} seed="plr" opacity={0.4} maxY={900} />
    <Glow id="plrg" cx={540} cy={820} r={ramp(t, 0, dur, 320, 560)} color="#ff9f4a" opacity={0.6} />
    <Smoke t={t} x={540} y={900} n={22} seed="plr" color="#e8d6bc" opacity={0.36} />
    {new Array(16).fill(0).map((_, i) => {
      const p = ((t * 2.6 + i * 60) % 900) / 900;
      const w = 90 - p * 54;
      return (
        <ellipse key={i} cx={540 + Math.sin(p * 7 + i) * 40 * p} cy={1240 - p * 900} rx={w} ry={w * 0.72}
          fill={mix('#ff6a1e', '#ffd27a', p)} opacity={(1 - p) * 0.7} />
      );
    })}
    <Ridge pts={[[0, 1330], [340, 1280], [740, 1320], [1080, 1270]]} fill="#1c1420" />
    {ground('#100b14', 1330)}
    {[-1, 1].map((side) => (
      <Stand key={side} x={540 + side * 250} y={1342} s={0.95} fill="#060409" armL={side > 0 ? -30 : 20} armR={side > 0 ? 18 : -26} />
    ))}
  </>
);

/** A radiant throne with rays — majesty, sovereignty, worship. */
export const Throne: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="thr" top="#140f26" bottom="#6a4030" />
    <Glow id="thrg" cx={540} cy={820} r={ramp(t, 0, dur, 420, 760)} color="#ffe0a4" opacity={0.78} />
    {new Array(24).fill(0).map((_, i) => (
      <path key={i} d="M528,820 L552,820 L562,120 L518,120 Z" fill="#ffeec2" opacity={0.08 + Math.sin(t / 18 + i) * 0.03}
        transform={`rotate(${i * 15 + t * 0.18} 540 820)`} />
    ))}
    <g fill="#1c1526" opacity={ramp(t, 0, 28)}>
      {/* crowned back */}
      <path d="M392,1010 L392,700 Q392,612 540,600 Q688,612 688,700 L688,1010 Z" />
      {[-1, 0, 1].map((k) => (
        <path key={k} d={`M${540 + k * 86 - 20},612 L${540 + k * 86},540 L${540 + k * 86 + 20},612 Z`} />
      ))}
      {/* seat and armrests */}
      <rect x="356" y="1004" width="368" height="40" rx="12" />
      <rect x="320" y="912" width="60" height="110" rx="16" />
      <rect x="700" y="912" width="60" height="110" rx="16" />
      <rect x="320" y="896" width="130" height="34" rx="16" />
      <rect x="630" y="896" width="130" height="34" rx="16" />
      {/* legs */}
      <rect x="386" y="1040" width="42" height="120" />
      <rect x="652" y="1040" width="42" height="120" />
      {/* stepped dais */}
      <rect x="350" y="1152" width="380" height="46" rx="10" />
      <rect x="310" y="1198" width="460" height="42" rx="10" />
      <rect x="268" y="1240" width="544" height="44" rx="10" />
    </g>
    <Ridge pts={[[0, 1340], [340, 1300], [760, 1336], [1080, 1296]]} fill="#120d18" />
    {ground('#0a070e', 1340)}
  </>
);

/** A dove descending in light — the Spirit, peace coming down. */
export const DoveScene: React.FC<P> = ({t, dur}) => {
  const flap = (Math.sin(t / 5) + 1) / 2;
  return (
    <>
      <Sky id="dve" top="#1a2440" bottom="#dfc08e" />
      <Glow id="dveg" cx={540} cy={460} r={ramp(t, 0, dur, 320, 560)} color="#ffffff" opacity={0.6} />
      {new Array(14).fill(0).map((_, i) => (
        <rect key={i} x="536" y="180" width="8" height="560" fill="#fff8e4" opacity="0.1"
          transform={`rotate(${i * 25.7 + t * 0.22} 540 460)`} />
      ))}
      <g transform={`translate(${540 + sway(t, 40, 18)},${lin(t, 0, dur, 520, 840)}) scale(1.35)`}>
        <Dove x={0} y={0} s={1} fill="#fdfbf4" flap={flap} />
      </g>
      <Ridge pts={[[0, 1300], [360, 1250], [740, 1290], [1080, 1240]]} fill="#4a3a38" />
      {ground('#2a2020', 1300)}
      <Stand x={540} y={1312} s={1.2} fill={C.ink} armL={-36} armR={32} />
    </>
  );
};

// ═══ CROSS · REDEMPTION ═══════════════════════════════════════════════════════

/** A crown of thorns against dark light — the cost, the sacrifice. */
export const ThornsScene: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="thn" top="#0a0708" bottom="#3a1a18" />
    <Glow id="thng" cx={700} cy={700} r={ramp(t, 0, dur, 320, 560)} color="#c9704a" opacity={0.45} />
    <Glow id="thng2" cx={380} cy={1060} r={300} color="#6a2f20" opacity={0.35} />
    <g transform={`translate(540,900) rotate(${-16 + sway(t, 70, 3)}) scale(${ramp(t, 0, dur, 1, 1.06)})`}>
      <Thorns x={0} y={0} s={1.15} stroke="#1a0f0c" />
    </g>
    <Ridge pts={[[0, 1420], [320, 1360], [760, 1410], [1080, 1350]]} fill="#140b0a" />
    {ground('#0a0505', 1420)}
    <Cross x={880} y={1400} s={0.8} fill="#120a09" />
  </>
);

/** An empty tomb with the stone rolled away — resurrection, hope. */
export const Tomb: React.FC<P> = ({t, dur}) => {
  const open = ramp(t, dur * 0.1, dur * 0.72, 0, 1);
  return (
    <>
      <Sky id="tmb" top={mix('#141228', '#5a6a94', open)} bottom={mix('#3a2a2a', '#f0cf9c', open)} />
      <Stars n={50} t={t} seed="tmb" opacity={(1 - open) * 0.5} maxY={700} />
      <Ridge pts={[[0, 1240], [320, 1180], [700, 1230], [1080, 1170]]} fill={mix('#2a1f28', '#6a5460', open)} />
      {/* rock face */}
      <path d="M120,1470 Q120,1000 540,988 Q960,1000 960,1470 Z" fill="#2e2630" />
      <path d="M120,1470 Q140,1120 380,1030 Q260,1180 250,1470 Z" fill="#372e3a" opacity="0.6" />
      {/* tomb mouth, with light spilling out as the stone clears it */}
      <path d="M408,1470 Q408,1136 540,1126 Q672,1136 672,1470 Z" fill="#06040a" />
      <path d="M408,1470 Q408,1136 540,1126 Q672,1136 672,1470 Z" fill="#fff2cc" opacity={0.55 * open} />
      <Glow id="tmbg" cx={540} cy={1280} r={120 + 260 * open} color="#fff2cc" opacity={0.9 * open} />
      <path d={`M470,1470 L${430 - open * 60},1920 L${780 + open * 60},1920 L610,1470 Z`} fill="#fff2cc" opacity={0.3 * open} />
      {/* the stone: covers the mouth at rest, rolled well clear by the end */}
      <g transform={`translate(${ramp(t, dur * 0.1, dur * 0.72, 0, 330)},0)`}>
        <circle cx={540} cy={1330} r={142} fill="#3d3440" />
        <circle cx={540} cy={1330} r={142} fill="none" stroke="#231c28" strokeWidth="16" />
        <circle cx={540} cy={1330} r={92} fill="none" stroke="#2c2532" strokeWidth="10" opacity="0.7" />
      </g>
      {ground(mix('#140e16', '#3a2c2a', open), 1450)}
    </>
  );
};

// ═══ PROVISION · HARVEST · BLESSING ═══════════════════════════════════════════

/** A golden wheat field swaying — provision, harvest, fruit. */
export const Harvest: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="hrv" top="#3f4478" bottom="#f6d095" />
    <circle cx={800} cy={ramp(t, 0, dur, 820, 740)} r={88} fill="#fff3cd" />
    <Glow id="hrvg" cx={800} cy={ramp(t, 0, dur, 820, 740)} r={460} color="#ffd79a" opacity={0.65} />
    <Ridge pts={[[0, 1140], [360, 1090], [760, 1130], [1080, 1080]]} fill="#b58c58" />
    <rect x="0" y="1140" width="1080" height="780" fill="#c99a52" />
    {new Array(34).fill(0).map((_, i) => {
      const x = (i * 33) % 1120 - 20;
      const row = Math.floor(i / 12);
      return <Wheat key={i} x={x} y={1280 + row * 170} s={0.9 + row * 0.26} fill="#8a5f2a" tilt={sway(t, 26 + (i % 5) * 4, 6)} />;
    })}
    {ground('#6a461f', 1820)}
  </>
);

/** Rain falling on dry cracked ground — refreshing, renewal, mercy. */
export const Rain: React.FC<P> = ({t, dur}) => {
  const soak = ramp(t, 0, dur, 0, 1);
  return (
    <>
      <Sky id="rin" top="#2a3344" bottom={mix('#8a7a60', '#5f7a74', soak)} />
      {new Array(6).fill(0).map((_, i) => (
        <ellipse key={i} cx={(i * 250 + t * 0.9) % 1450 - 180} cy={240 + (i % 3) * 110} rx={270} ry={62} fill="#39414f" opacity="0.72" />
      ))}
      <Rainfall t={t} n={110} seed="rin" opacity={0.5} color="#d8e8f4" />
      <Ridge pts={[[0, 1280], [340, 1240], [740, 1270], [1080, 1230]]} fill={mix('#6a5a44', '#4a5a4a', soak)} />
      {ground(mix('#4a3c2a', '#32402f', soak), 1290)}
      {new Array(9).fill(0).map((_, i) => (
        <path key={i} d={`M${90 + i * 118},1920 L${120 + i * 118},${1480 - (i % 3) * 70} L${150 + i * 118},1920 Z`}
          fill="#241c14" opacity={0.32 * (1 - soak * 0.7)} />
      ))}
      {new Array(16).fill(0).map((_, i) => {
        const p = ((t * 3 + i * 26) % 70) / 70;
        return <ellipse key={i} cx={80 + ((i * 131) % 940)} cy={1440} rx={6 + p * 42} ry={2 + p * 9} fill="none"
          stroke="#cfe4f0" strokeWidth="3" opacity={(1 - p) * 0.4} />;
      })}
    </>
  );
};

/** A prepared table with bread and cup — communion, welcome, provision. */
export const TableScene: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="tbs" top="#1a1118" bottom="#5a3426" />
    <Glow id="tbsg" cx={540} cy={1020} r={ramp(t, 0, dur, 380, 540)} color="#ffc078" opacity={0.6} />
    <Ridge pts={[[0, 1340], [360, 1300], [760, 1334], [1080, 1290]]} fill="#241820" />
    {ground('#160f16', 1340)}
    <g transform="translate(540,1340)">
      <rect x="-380" y="-220" width="760" height="34" rx="10" fill="#4a3220" />
      <rect x="-360" y="-186" width="34" height="186" fill="#3a2718" />
      <rect x="326" y="-186" width="34" height="186" fill="#3a2718" />
      <ellipse cx="0" cy="-212" rx="380" ry="22" fill="#5c4028" />
    </g>
    <g transform="translate(400,1118)" opacity={ramp(t, 10, 40)}>
      <ellipse cx="0" cy="0" rx="76" ry="34" fill="#c08a4a" />
      <ellipse cx="0" cy="-12" rx="68" ry="28" fill="#dba65e" />
      <path d="M-30,-22 L-18,-32 M0,-24 L12,-34" stroke="#8a5c2a" strokeWidth="5" strokeLinecap="round" />
    </g>
    <g transform="translate(680,1096)" opacity={ramp(t, 22, 54)}>
      <path d="M-44,-62 L44,-62 L34,0 L-34,0 Z" fill="#7a5a2a" />
      <ellipse cx="0" cy="-62" rx="44" ry="14" fill="#8a2f28" />
      <rect x="-9" y="0" width="18" height="36" fill="#7a5a2a" />
      <ellipse cx="0" cy="38" rx="42" ry="12" fill="#7a5a2a" />
    </g>
  </>
);

// ═══ REST · ETERNAL · HOME ════════════════════════════════════════════════════

/** A shepherd with his flock on a hillside — care, belonging, being led. */
export const Shepherd: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="shp" top="#3a3a6a" bottom="#f1c18f" />
    <circle cx={810} cy={ramp(t, 0, dur, 840, 760)} r={82} fill="#fff0c8" />
    <Glow id="shpg" cx={810} cy={ramp(t, 0, dur, 840, 760)} r={430} color="#ffd79a" opacity={0.6} />
    <Ridge pts={[[0, 1200], [340, 1150], [720, 1190], [1080, 1140]]} fill="#7a6a56" />
    <Ridge pts={[[0, 1340], [400, 1290], [800, 1330], [1080, 1300]]} fill="#4a4030" />
    {ground('#2e2a1e', 1340)}
    <Father x={330} y={1352 + bob(t, 11, 3)} s={1.25} fill={C.ink} arm={16} />
    {[0, 1, 2, 3].map((i) => (
      <Sheep key={i} x={520 + i * 128 + sway(t, 30 + i * 6, 6)} y={1356 + (i % 2) * 14} s={0.86 + (i % 2) * 0.16}
        fill="#141010" head={Math.sin(t / 14 + i) * 7} />
    ))}
  </>
);

/** A warm lit window seen from a distance at dusk — home, belonging, return. */
export const HomeLight: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="hml" top="#121A30" bottom="#4a3a46" />
    <Stars n={76} t={t} seed="hml" opacity={0.55} maxY={900} />
    <Ridge pts={[[0, 1180], [330, 1120], [720, 1170], [1080, 1110]]} fill="#1e1a2a" />
    <Ridge pts={[[0, 1360], [380, 1310], [780, 1350], [1080, 1320]]} fill="#141220" />
    {ground('#0c0a14', 1360)}
    <g transform="translate(680,1360)">
      <path d="M-170,0 L-170,-180 L0,-300 L170,-180 L170,0 Z" fill="#100d18" />
      <rect x="-46" y="-120" width="92" height="120" fill="#120f1a" />
      <rect x="-124" y="-156" width="70" height="62" rx="5" fill="#ffc87a" opacity={0.86 + Math.sin(t / 12) * 0.08} />
      <rect x="56" y="-156" width="70" height="62" rx="5" fill="#ffc87a" opacity={0.78 + Math.sin(t / 15 + 2) * 0.08} />
    </g>
    <Glow id="hmlg" cx={680} cy={1240} r={ramp(t, 0, dur, 260, 340)} color="#ffc87a" opacity={0.45} />
    <Stand x={lin(t, 0, dur, 240, 310)} y={1372 + bob(t, 10, 4)} s={1.05} fill="#060509" armL={20} armR={-18} />
  </>
);

/** A wide open horizon with one figure looking out — hope, what's ahead. */
export const Horizon: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="hrz" top="#2a2c58" bottom="#f3cf9e" />
    <Glow id="hrzg" cx={540} cy={1060} r={ramp(t, 0, dur, 480, 780)} color="#ffe0ad" opacity={0.65} />
    <circle cx={540} cy={1070} r={64} fill="#fff4d8" opacity="0.92" />
    {new Array(6).fill(0).map((_, i) => (
      <ellipse key={i} cx={(i * 240 + t * 0.4) % 1420 - 170} cy={560 + (i % 3) * 100} rx={220} ry={22} fill="#f6d9b0" opacity="0.28" />
    ))}
    <rect x="0" y="1090" width="1080" height="830" fill="#c08a60" opacity="0.55" />
    <Ridge pts={[[0, 1100], [1080, 1096]]} fill="#8a5f46" />
    <Ridge pts={[[0, 1420], [540, 1396], [1080, 1416]]} fill="#3a2a2a" />
    {ground('#241a1c', 1420)}
    <Stand x={400} y={1432} s={1.3} fill={C.ink} armL={-34} armR={14} />
  </>
);

/** A group gathered under one light — church, family, not being alone. */
export const Gather: React.FC<P> = ({t, dur}) => (
  <>
    <Sky id="gth" top="#18132a" bottom="#6a4436" />
    <Glow id="gthg" cx={540} cy={700} r={ramp(t, 0, dur, 380, 640)} color="#ffd79a" opacity={0.65} />
    <circle cx={540} cy={700} r={52} fill="#fff1cc" />
    <Ridge pts={[[0, 1300], [380, 1250], [760, 1290], [1080, 1240]]} fill="#2a1e26" />
    {ground('#171017', 1300)}
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const x = 180 + i * 148;
      const near = i === 2 || i === 3;
      return (
        <g key={i} opacity={ramp(t, i * 7, i * 7 + 18)}>
          <Stand x={x} y={1312 + (i % 2) * 12} s={near ? 1.22 : 1.02} fill={C.ink}
            armL={i % 2 ? 22 : -16} armR={i % 2 ? -20 : 18} />
        </g>
      );
    })}
  </>
);

// ─── Registry ─────────────────────────────────────────────────────────────────
// IDs here are what prepare.mjs writes into src/story-timeline.ts.
// StoryReel.tsx merges this with SCENE_MAP from Scenes.tsx (Abraham's scenes),
// so none of Abraham's ids are affected.

export const STORY_SCENE_MAP: Record<string, React.FC<P>> = {
  // anxiety · storm · fear
  storm: Storm,
  burden: Burden,
  deepwater: DeepWater,
  // peace · calm · comfort
  stillwater: StillWater,
  shelter: Shelter,
  calm: Calm,
  // prayer · crying out
  kneel: Kneel,
  handsup: HandsUp,
  incense: Incense,
  // faith · trust · waiting
  watchtower: Watchtower,
  anchor: AnchorScene,
  seed: Seed,
  lamp: LampPath,
  // journey · path · valley
  valley: Valley,
  desert: Desert,
  narrowpath: NarrowPath,
  crossroads: Crossroads,
  // word · scripture · truth
  scroll: ScrollScene,
  tablets: TabletsScene,
  openbook: OpenBook,
  // light · glory · presence
  sunrise: Sunrise,
  pillar: Pillar,
  throne: Throne,
  dove: DoveScene,
  // cross · redemption
  thorns: ThornsScene,
  tomb: Tomb,
  // provision · harvest · blessing
  harvest: Harvest,
  rain: Rain,
  table: TableScene,
  // rest · eternal · home
  shepherd: Shepherd,
  homelight: HomeLight,
  horizon: Horizon,
  gather: Gather,
};
