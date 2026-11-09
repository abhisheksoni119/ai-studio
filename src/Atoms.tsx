// Atoms.tsx — the LOCKED visual language for composed story scenes.
//
// Nothing here is a "scene". These are primitives the Composer assembles into a
// scene from a SceneSpec, so a script about Joseph's pit and a script about
// John's throne room are built from the same vocabulary but look nothing alike.
//
// Three rules hold this together:
//   1. PALETTES are fixed, so every story keeps the same brand look.
//   2. Every <defs> id is namespaced by a `u` prefix supplied by the Composer.
//      Two scenes overlap during a crossfade, so a bare id like "sky" would let
//      one scene inherit the other's gradient.
//   3. All randomness goes through Remotion's seeded `random()`. Frame-to-frame
//      instability would tear the video apart; a per-story seed is what makes
//      two stories get different mountains from the same ridge code.

import React from 'react';
import {random} from 'remotion';

// ─── Palette ──────────────────────────────────────────────────────────────────

/**
 * A scene palette. Flat and monochromatic by design: one dominant hue filling
 * most of the frame, two variants of it for depth, and a single contrasting
 * accent. This is the structure the reference reels use — a sky gradient with
 * a sun in it makes every scene look like the last one.
 */
export type Tone = {
  sky: string;    // flat backdrop above the ground plane
  base: string;   // dominant ground fill
  deep: string;   // darker variant — distance and shadow
  light: string;  // lighter variant — near surfaces and highlights
  accent: string; // the one contrasting colour: light shafts, fruit, key words
  ink: string;    // outlines and dark detail
  paper: string;  // caption text over this palette
};

export type PaletteName =
  | 'olive' | 'forest' | 'rust' | 'clay' | 'sand' | 'gold'
  | 'teal' | 'night' | 'plum' | 'stone' | 'ash' | 'ember';

/**
 * Earthy, limited, flat. Each scene claims ONE of these, and consecutive scenes
 * deliberately claim different ones — the reference reels shift olive → rust →
 * sand across three consecutive shots.
 */
export const PALETTES: Record<PaletteName, Tone> = {
  olive:  {sky: '#47512f', base: '#6b7444', deep: '#39422a', light: '#8d9560', accent: '#e8c06a', ink: '#1d2116', paper: '#f0e6d2'},
  forest: {sky: '#2c4436', base: '#3f5f4a', deep: '#22362b', light: '#5f8065', accent: '#e8c06a', ink: '#141f18', paper: '#ede6d6'},
  rust:   {sky: '#6e3a22', base: '#9a5a35', deep: '#5a3120', light: '#c08055', accent: '#f0cf8a', ink: '#2a1610', paper: '#f4e6d0'},
  clay:   {sky: '#7a4634', base: '#a86a52', deep: '#653a2c', light: '#c99078', accent: '#ecd0a0', ink: '#2e1a14', paper: '#f6ead8'},
  sand:   {sky: '#a98a60', base: '#c9a479', deep: '#8a6a46', light: '#e4c9a0', accent: '#b4522f', ink: '#3a2c1c', paper: '#2e2316'},
  gold:   {sky: '#8a6a34', base: '#b8914e', deep: '#7a5c2c', light: '#d8b878', accent: '#fff0cc', ink: '#33260f', paper: '#2b2110'},
  teal:   {sky: '#27454b', base: '#3a5f66', deep: '#1e383d', light: '#5c858a', accent: '#e0a860', ink: '#0f1d20', paper: '#e6efee'},
  night:  {sky: '#1b2234', base: '#2a3348', deep: '#151b29', light: '#46516e', accent: '#e8c06a', ink: '#0a0e16', paper: '#e8e6e0'},
  plum:   {sky: '#3e2e42', base: '#5a4258', deep: '#322438', light: '#7d6179', accent: '#e0b070', ink: '#1a1220', paper: '#f0e4e8'},
  stone:  {sky: '#5d5a4e', base: '#7a7566', deep: '#4a4740', light: '#9d9888', accent: '#d8b878', ink: '#23211c', paper: '#f0ead8'},
  ash:    {sky: '#43434a', base: '#5a5a5e', deep: '#34343a', light: '#7e7e84', accent: '#c8b48a', ink: '#17171b', paper: '#ebe9e4'},
  ember:  {sky: '#4a241c', base: '#73372a', deep: '#431e18', light: '#9c5540', accent: '#ffae55', ink: '#210e0a', paper: '#f8e2c8'},
};

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const hexToRgb = (h: string) =>
  h.startsWith('rgb')
    ? ((h.match(/\d+/g) as string[]).slice(0, 3).map(Number) as number[])
    : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const mix = (a: string, b: string, p: number) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const q = Math.min(1, Math.max(0, p));
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], q))).join(',')})`;
};

/** Darken a colour toward black — used to push terrain layers forward. */
export const shade = (c: string, amount: number) => mix(c, '#000000', amount);

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Deterministic value in [0,1) for a seed. */
const r1 = (seed: string) => random(seed);
/** Deterministic value in [lo,hi). */
const rr = (seed: string, lo: number, hi: number) => lo + random(seed) * (hi - lo);

export const W = 1080;
export const H = 1920;

export type AtomBase = {u: string; t: number};

// ─── Sky ──────────────────────────────────────────────────────────────────────

/** Flat backdrop. No gradient: the reference look is flat colour fields. */
export const Backdrop: React.FC<{fill: string}> = ({fill}) => (
  <rect width={W} height={H} fill={fill} />
);

/**
 * A ground plane receding into the distance. THIS is what makes a scene read as
 * a place rather than a backdrop: objects sit ON a surface that has depth,
 * instead of lining up along a flat side-on horizon.
 *
 * `horizon` is where the plane begins; it widens toward the viewer.
 */
export const Plane: React.FC<{horizon: number; fill: string; edge?: string; skew?: number}> = ({
  horizon, fill, edge, skew = 0,
}) => {
  // A narrow far edge makes the ground read as a cut-out shape sitting on the
  // backdrop. Keeping it wide, and softening the join with a haze band, reads
  // as a surface running to the horizon.
  const inset = 120 - skew * 70;
  return (
    <g>
      <path d={`M${inset},${horizon} L${W - inset},${horizon} L${W + 460},${H} L${-460},${H} Z`} fill={fill} />
      {/* haze where the ground meets the backdrop */}
      {edge && (
        <>
          <rect x={0} y={horizon - 26} width={W} height={52} fill={edge} opacity="0.35" />
          <rect x={0} y={horizon - 10} width={W} height={20} fill={edge} opacity="0.3" />
        </>
      )}
    </g>
  );
};

/**
 * Small ground detail — tufts, pebbles, stubble — scattered across the plane.
 * Without these the surface is a flat colour field and the scene looks unfinished;
 * the reference reels always carry some texture on the ground.
 */
export const Scatter: React.FC<{
  seed: string; horizon: number; n?: number; color: string; kind?: 'tuft' | 'rock' | 'both';
}> = ({seed, horizon, n = 16, color, kind = 'both'}) => (
  <g fill={color}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const d = 0.12 + random(`${seed}sd${i}`) * 0.88;
      const y = horizon + Math.pow(d, 1.7) * (H - horizon);
      const spread = 220 + d * 620;
      const x = W / 2 + (random(`${seed}sx${i}`) - 0.5) * 2 * spread;
      const sc = (0.3 + d * 1.1) * (0.6 + random(`${seed}ss${i}`) * 0.7);
      const isRock = kind === 'rock' || (kind === 'both' && random(`${seed}sk${i}`) > 0.55);
      return isRock ? (
        <ellipse key={i} cx={x} cy={y} rx={14 * sc} ry={8 * sc} opacity={0.5} />
      ) : (
        <g key={i} transform={`translate(${x},${y}) scale(${sc})`} opacity={0.55}>
          <path d="M0,0 L-9,-26 M0,0 L0,-32 M0,0 L9,-24" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
      );
    })}
  </g>
);

/**
 * Depth bands across the plane — faint rows that recede, so the eye reads the
 * surface as going back rather than as a flat trapezoid of colour.
 */
export const PlaneRows: React.FC<{horizon: number; color: string; n?: number; opacity?: number}> = ({
  horizon, color, n = 7, opacity = 0.13,
}) => (
  <g opacity={opacity}>
    {new Array(n).fill(0).map((_, i) => {
      const f = (i + 1) / (n + 1);
      const y = horizon + Math.pow(f, 1.9) * (H - horizon);
      const spread = 300 - f * 300;
      return <line key={i} x1={spread - 180} y1={y} x2={W - spread + 180} y2={y} stroke={color} strokeWidth={2 + f * 5} />;
    })}
  </g>
);

/**
 * Convert a depth value (0 = far, 1 = near) into a y position and a scale, so
 * anything standing on the plane sits correctly and shrinks with distance.
 */
export const planeAt = (horizon: number, depth: number) => {
  const d = Math.min(1, Math.max(0, depth));
  const y = horizon + Math.pow(d, 1.7) * (H - horizon);
  // Tuned so a subject at depth ~0.8 stands roughly a quarter of the frame
  // tall, matching the reference reels. The earlier curve left people the size
  // of a thumbnail on an empty plane.
  const scale = 0.5 + d * 1.85;
  return {y, scale};
};

/** An isometric box sitting on the plane — garden beds, altars, steps, crates. */
export const IsoBox: React.FC<{
  x: number; y: number; w: number; d: number; h: number;
  top: string; left: string; right: string;
}> = ({x, y, w, d, h, top, left, right}) => (
  <g transform={`translate(${x},${y})`}>
    {/* left face */}
    <path d={`M${-w},0 L${-w},${-h} L0,${-h - d} L0,${-d} Z`} fill={left} />
    {/* right face */}
    <path d={`M${w},0 L${w},${-h} L0,${-h - d} L0,${-d} Z`} fill={right} />
    {/* top face */}
    <path d={`M0,${-h - d * 2} L${w},${-h - d} L0,${-h} L${-w},${-h - d} Z`} fill={top} />
  </g>
);

/** A diagonal shaft of light across the frame — the reference lighting device. */
export const Shaft: React.FC<{u: string; x: number; width: number; tilt: number; color: string; opacity?: number}> = ({
  u, x, width, tilt, color, opacity = 0.3,
}) => (
  <>
    <defs>
      <linearGradient id={`${u}-shaft`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity={opacity} />
        <stop offset="0.72" stopColor={color} stopOpacity={opacity * 0.55} />
        <stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d={`M${x - width / 2},0 L${x + width / 2},0 L${x + width / 2 + tilt + width * 0.7},${H} L${x - width / 2 + tilt - width * 0.7},${H} Z`}
      fill={`url(#${u}-shaft)`}
    />
  </>
);

export const Glow: React.FC<{u: string; k: string | number; cx: number; cy: number; r: number; color: string; opacity?: number}> = ({
  u, k, cx, cy, r, color, opacity = 1,
}) => (
  <>
    <defs>
      <radialGradient id={`${u}-glow${k}`}>
        <stop offset="0" stopColor={color} stopOpacity={0.95} />
        <stop offset="0.35" stopColor={color} stopOpacity={0.35} />
        <stop offset="1" stopColor={color} stopOpacity={0} />
      </radialGradient>
    </defs>
    <circle cx={cx} cy={cy} r={Math.max(1, r)} fill={`url(#${u}-glow${k})`} opacity={opacity} />
  </>
);

export const Stars: React.FC<{t: number; n: number; seed: string; opacity?: number; maxY?: number}> = ({
  t, n, seed, opacity = 1, maxY = 1100,
}) => (
  <g opacity={opacity}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const x = r1(`${seed}sx${i}`) * W;
      const y = r1(`${seed}sy${i}`) * maxY;
      const rad = 0.8 + r1(`${seed}sr${i}`) * 2.2;
      const tw = 0.55 + 0.45 * Math.sin(t / 12 + i * 1.7);
      return <circle key={i} cx={x} cy={y} r={rad} fill="#fff8e6" opacity={tw} />;
    })}
  </g>
);

export const Clouds: React.FC<{t: number; n: number; seed: string; color: string; y?: number; band?: number; opacity?: number; speed?: number; heavy?: boolean}> = ({
  t, n, seed, color, y = 420, band = 260, opacity = 0.3, speed = 0.5, heavy = false,
}) => (
  <g opacity={opacity}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const cy = y + r1(`${seed}cy${i}`) * band;
      const rx = (heavy ? 240 : 170) + r1(`${seed}cr${i}`) * 140;
      const ry = (heavy ? 54 : 22) + r1(`${seed}cq${i}`) * (heavy ? 40 : 16);
      const cx = ((i * 290 + t * speed + r1(`${seed}cx${i}`) * 400) % (W + 700)) - 350;
      return <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={color} />;
    })}
  </g>
);

/** Radial god-rays from a point. */
export const Rays: React.FC<{t: number; n: number; cx: number; cy: number; len: number; color: string; opacity?: number; spin?: number; width?: number}> = ({
  t, n, cx, cy, len, color, opacity = 0.1, spin = 0.2, width = 12,
}) => (
  <g>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => (
      <rect key={i} x={cx - width / 2} y={cy - len} width={width} height={len} fill={color}
        opacity={opacity + Math.sin(t / 16 + i) * opacity * 0.4}
        transform={`rotate(${(i * 360) / n + t * spin} ${cx} ${cy})`} />
    ))}
  </g>
);

/** A vertical shaft of light — the divine-call beam. */
export const Beam: React.FC<{u: string; t: number; cx: number; top: number; bottom: number; spread: number; color: string; opacity?: number}> = ({
  u, t, cx, top, bottom, spread, color, opacity = 0.8,
}) => (
  <>
    <defs>
      <linearGradient id={`${u}-beam`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity={opacity} />
        <stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d={`M${cx - 34},${top} L${cx + 34},${top} L${cx + spread},${bottom} L${cx - spread},${bottom} Z`}
      fill={`url(#${u}-beam)`}
    />
  </>
);

export const Rainbow: React.FC<{cx: number; cy: number; r: number; opacity?: number}> = ({cx, cy, r, opacity = 0.35}) => (
  <g opacity={opacity} fill="none" strokeWidth="26">
    {['#e4705a', '#e8a85a', '#e8de7a', '#7ac08a', '#6a9ad0', '#8a7ac8'].map((c, i) => (
      <path key={c} d={`M${cx - r + i * 26},${cy} A${r - i * 26},${r - i * 26} 0 0 1 ${cx + r - i * 26},${cy}`} stroke={c} />
    ))}
  </g>
);

export const Lightning: React.FC<{t: number; seed: string; at: number; color?: string}> = ({t, seed, at, color = '#e8f0ff'}) => {
  const phase = t - at;
  if (phase < 0 || phase > 10) return null;
  const flash = phase < 3 ? 1 : 1 - (phase - 3) / 7;
  const x = 200 + r1(`${seed}lx`) * 680;
  const pts: string[] = [];
  let cy = 0;
  let cx = x;
  for (let i = 0; i < 7; i++) {
    pts.push(`${cx},${cy}`);
    cy += 150;
    cx += (r1(`${seed}lz${i}`) - 0.5) * 150;
  }
  return (
    <g opacity={flash}>
      <rect width={W} height={H} fill={color} opacity={0.35 * flash} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="9" strokeLinejoin="round" />
    </g>
  );
};

// ─── Terrain ──────────────────────────────────────────────────────────────────

/**
 * A ridge line generated from a seed, so every story gets its own mountains
 * from the same code. `rough` controls jaggedness: low for rolling hills, high
 * for cliffs.
 */
export const Ridge: React.FC<{seed: string; y: number; amp: number; fill: string; n?: number; rough?: number; dx?: number}> = ({
  seed, y, amp, fill, n = 7, rough = 0.5, dx = 0,
}) => {
  const pts: number[][] = [];
  const span = W + 400;
  for (let i = 0; i <= n; i++) {
    const px = -200 + (i / n) * span;
    const base = Math.sin((i / n) * Math.PI * rr(`${seed}f`, 1.2, 2.6) + rr(`${seed}p`, 0, 6.3));
    const jag = (r1(`${seed}j${i}`) - 0.5) * 2 * rough;
    pts.push([px, y - (base * 0.6 + jag * 0.8) * amp]);
  }
  const d = `M${pts[0][0]},${H} L${pts[0][0]},${pts[0][1]} ${pts
    .slice(1)
    .map((p) => `L${p[0]},${p[1]}`)
    .join(' ')} L${pts[pts.length - 1][0]},${H} Z`;
  return <path d={d} fill={fill} transform={`translate(${dx},0)`} />;
};

/** Smooth sand dunes. */
export const Dunes: React.FC<{seed: string; y: number; amp: number; fill: string}> = ({seed, y, amp, fill}) => {
  const n = 5;
  let d = `M-200,${H} L-200,${y}`;
  for (let i = 0; i < n; i++) {
    const x0 = -200 + (i / n) * (W + 400);
    const x1 = -200 + ((i + 1) / n) * (W + 400);
    const peak = y - rr(`${seed}d${i}`, 0.35, 1) * amp;
    d += ` Q${(x0 + x1) / 2},${peak} ${x1},${y - rr(`${seed}e${i}`, 0, 0.3) * amp}`;
  }
  d += ` L${W + 200},${H} Z`;
  return <path d={d} fill={fill} />;
};

export const Ground: React.FC<{y: number; fill: string}> = ({y, fill}) => (
  <rect x="0" y={y} width={W} height={Math.max(0, H - y)} fill={fill} />
);

/** Canyon / valley wall. side -1 = left, 1 = right. */
export const Cliff: React.FC<{seed: string; side: -1 | 1; gap: number; top: number; fill: string}> = ({
  seed, side, gap, top, fill,
}) => {
  const edge = side < 0 ? 0 : W;
  // `gap` is the clear distance from centre to the cliff face. The sign must
  // follow `side`: with `W/2 - side*gap` the LEFT wall extended past centre and
  // the two cliffs overlapped into one slab covering the frame.
  const inner = W / 2 + side * gap;
  const bulge = rr(`${seed}cb`, 0.12, 0.4);
  // The face leans away from centre as it rises, so the cliff frames the shot.
  const lip = inner - side * 110;
  const d =
    side < 0
      ? `M-120,0 L-120,${H} L${inner},${H} Q${inner - 40},${top + 420} ${lip},${top} Q${lip - 130 * bulge},${top * bulge} ${edge - 200},0 Z`
      : `M${W + 120},0 L${W + 120},${H} L${inner},${H} Q${inner + 40},${top + 420} ${lip},${top} Q${lip + 130 * bulge},${top * bulge} ${edge + 200},0 Z`;
  return <path d={d} fill={fill} />;
};

/** Sea surface with drifting highlight bands. */
export const Sea: React.FC<{t: number; y: number; fill: string; shine: string; rows?: number; lightX?: number}> = ({
  t, y, fill, shine, rows = 13, lightX = W / 2,
}) => (
  <>
    <rect x="0" y={y} width={W} height={Math.max(0, H - y)} fill={fill} />
    {/* reflected light path, widening toward the viewer */}
    <path d={`M${lightX - 30},${y} L${lightX + 30},${y} L${lightX + 230},${H} L${lightX - 230},${H} Z`}
      fill={shine} opacity="0.1" />
    {new Array(rows).fill(0).map((_, i) => {
      const f = i / rows;
      const ry = y + 26 + f * (H - y) * 1.05;
      const amp = 10 + f * 42;
      const drift = Math.sin(t / (22 + i * 2) + i) * (16 + f * 46);
      const seg = 150 + f * 190;
      const d = `M${-80 + drift},${ry} ` + new Array(6).fill(0)
        .map((__, k) => `q${seg / 2},${k % 2 ? amp : -amp} ${seg},0`).join(' ');
      return (
        <path key={i} d={d} fill="none" stroke={shine} strokeWidth={3 + f * 5}
          strokeLinecap="round" opacity={0.1 + f * 0.14} />
      );
    })}
  </>
);

/** Crop rows receding to the horizon. */
export const Field: React.FC<{t: number; seed: string; y: number; fill: string; stalk: string; rows?: number}> = ({
  t, seed, y, fill, stalk, rows = 5,
}) => (
  <>
    <rect x="0" y={y} width={W} height={Math.max(0, H - y)} fill={fill} />
    {new Array(rows).fill(0).map((_, row) => {
      const ry = y + 70 + row * ((H - y) / rows) * 0.85;
      const s = 0.5 + row * 0.26;
      const count = 16 - row * 2;
      return (
        <g key={row}>
          {new Array(Math.max(3, count)).fill(0).map((_, i) => {
            const x = ((i + 0.5) / count) * W + (row % 2) * 24;
            return <Wheat key={i} x={x} y={ry} s={s} fill={stalk} tilt={Math.sin(t / (26 + row * 3) + i) * 6} />;
          })}
        </g>
      );
    })}
  </>
);

/** A path running from the bottom of frame toward a point on the horizon. */
export const Road: React.FC<{fromX: number; toX: number; toY: number; fill: string; width?: number}> = ({
  fromX, toX, toY, fill, width = 230,
}) => (
  <path
    d={`M${fromX - width},${H} Q${fromX - width * 0.45},${(H + toY) / 2} ${toX - 26},${toY} L${toX + 26},${toY} Q${fromX + width * 0.45},${(H + toY) / 2} ${fromX + width},${H} Z`}
    fill={fill}
    opacity="0.55"
  />
);

/** A pit or open grave in the ground. */
export const Pit: React.FC<{x: number; y: number; rx?: number; fill: string; rim: string}> = ({
  x, y, rx = 220, fill, rim,
}) => (
  <g>
    <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.3} fill={rim} />
    <ellipse cx={x} cy={y + 10} rx={rx * 0.86} ry={rx * 0.25} fill={fill} />
  </g>
);

// ─── Structures ───────────────────────────────────────────────────────────────

export type StructKind =
  | 'altar' | 'throne' | 'tomb' | 'well' | 'boat' | 'tent' | 'city' | 'temple'
  | 'gate' | 'cross' | 'pillar' | 'ladder' | 'prison' | 'house' | 'table'
  | 'tree' | 'signpost' | 'campfire' | 'wall' | 'stone';

export const Altar: React.FC<{x: number; y: number; s?: number; fill: string; wood?: string}> = ({x, y, s = 1, fill, wood}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <g fill={fill}>
      <rect x="-120" y="-46" width="110" height="46" rx="10" />
      <rect x="-4" y="-46" width="124" height="46" rx="10" />
      <rect x="-96" y="-92" width="96" height="42" rx="10" />
      <rect x="6" y="-92" width="92" height="42" rx="10" />
    </g>
    {wood && (
      <g fill={wood}>
        <rect x="-90" y="-108" width="180" height="12" rx="5" />
        <rect x="-80" y="-120" width="164" height="12" rx="5" />
      </g>
    )}
  </g>
);

/**
 * A throne of glory. Rendered as LIGHT framed by dark pillars and steps, not as
 * a dark frontal silhouette: a solid filled chair shape with armrests reads as
 * a head and shoulders at reel size, however the proportions are tuned.
 */
export const Throne: React.FC<{x: number; y: number; s?: number; fill: string; light: string; u: string}> = ({
  x, y, s = 1, fill, light, u,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <defs>
      <linearGradient id={`${u}-thr`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={light} stopOpacity="0.95" />
        <stop offset="0.65" stopColor={light} stopOpacity="0.55" />
        <stop offset="1" stopColor={light} stopOpacity="0.12" />
      </linearGradient>
    </defs>

    {/* the seat of glory: an arch of light */}
    <path d="M-120,-150 L-120,-470 Q-120,-610 0,-626 Q120,-610 120,-470 L120,-150 Z" fill={`url(#${u}-thr)`} />
    <path d="M-120,-150 L-120,-470 Q-120,-610 0,-626 Q120,-610 120,-470 L120,-150 Z"
      fill="none" stroke={light} strokeWidth="7" opacity="0.5" />

    {/* dark pillars frame it, so the light has an edge to read against */}
    <g fill={fill}>
      <rect x="-212" y="-520" width="46" height="376" rx="10" />
      <rect x="166" y="-520" width="46" height="376" rx="10" />
      <ellipse cx="-189" cy="-538" rx="40" ry="26" />
      <ellipse cx="189" cy="-538" rx="40" ry="26" />

      {/* stepped dais */}
      <rect x="-186" y="-150" width="372" height="42" rx="8" />
      <rect x="-244" y="-108" width="488" height="42" rx="8" />
      <rect x="-302" y="-66" width="604" height="42" rx="8" />
      <rect x="-360" y="-24" width="720" height="42" rx="8" />
    </g>
  </g>
);

export const Tomb: React.FC<{x: number; y: number; s?: number; rock: string; dark: string; light: string; open: number; stone: string}> = ({
  x, y, s = 1, rock, dark, light, open, stone,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-420,0 Q-420,-470 0,-482 Q420,-470 420,0 Z" fill={rock} />
    <path d="M-420,0 Q-400,-350 -160,-440 Q-280,-290 -290,0 Z" fill={mix(rock, '#ffffff', 0.08)} />
    <path d="M-132,0 Q-132,-334 0,-344 Q132,-334 132,0 Z" fill={dark} />
    <path d="M-132,0 Q-132,-334 0,-344 Q132,-334 132,0 Z" fill={light} opacity={0.55 * open} />
    <g transform={`translate(${open * 330},0)`}>
      <circle cx="0" cy="-140" r="142" fill={stone} />
      <circle cx="0" cy="-140" r="142" fill="none" stroke={shade(stone, 0.4)} strokeWidth="16" />
      <circle cx="0" cy="-140" r="92" fill="none" stroke={shade(stone, 0.25)} strokeWidth="10" opacity="0.7" />
    </g>
  </g>
);

export const Well: React.FC<{x: number; y: number; s?: number; fill: string; dark: string}> = ({x, y, s = 1, fill, dark}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <ellipse cx="0" cy="-96" rx="120" ry="34" fill={dark} />
    <path d="M-120,-96 L-120,0 Q0,30 120,0 L120,-96 Z" fill={fill} />
    <ellipse cx="0" cy="-96" rx="120" ry="34" fill="none" stroke={shade(fill, 0.3)} strokeWidth="12" />
    <rect x="-112" y="-300" width="16" height="206" fill={fill} />
    <rect x="96" y="-300" width="16" height="206" fill={fill} />
    <path d="M-140,-300 L0,-362 L140,-300 Z" fill={shade(fill, 0.2)} />
    <rect x="-8" y="-296" width="16" height="120" fill={shade(fill, 0.35)} />
  </g>
);

export const Boat: React.FC<{x: number; y: number; s?: number; fill: string; sail?: string; tilt?: number}> = ({
  x, y, s = 1, fill, sail, tilt = 0,
}) => (
  <g transform={`translate(${x},${y}) scale(${s}) rotate(${tilt})`}>
    {sail && (
      <>
        <rect x="-6" y="-390" width="12" height="390" fill={fill} />
        <path d="M6,-380 Q150,-250 10,-110 Z" fill={sail} />
      </>
    )}
    <path d="M-200,-40 L200,-40 Q166,46 0,52 Q-166,46 -200,-40 Z" fill={fill} />
    <rect x="-200" y="-54" width="400" height="20" rx="10" fill={shade(fill, 0.25)} />
  </g>
);

export const Tent: React.FC<{x: number; y: number; s?: number; fill: string; dark: string}> = ({x, y, s = 1, fill, dark}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-220,0 L0,-230 L220,0 Z" fill={fill} />
    <path d="M-54,0 L0,-150 L54,0 Z" fill={dark} />
    <rect x="-6" y="-258" width="12" height="46" fill={dark} />
  </g>
);

export const City: React.FC<{seed: string; x: number; y: number; s?: number; fill: string; lit?: string}> = ({
  seed, x, y, s = 1, fill, lit,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    {new Array(11).fill(0).map((_, i) => {
      const bw = 56 + r1(`${seed}bw${i}`) * 46;
      const bh = 90 + r1(`${seed}bh${i}`) * 230;
      const bx = -330 + i * 62;
      const dome = r1(`${seed}bd${i}`) > 0.66;
      return (
        <g key={i}>
          <rect x={bx} y={-bh} width={bw} height={bh} fill={fill} />
          {dome && <ellipse cx={bx + bw / 2} cy={-bh} rx={bw / 2} ry={bw / 2.4} fill={fill} />}
          {lit &&
            new Array(3).fill(0).map((__, k) =>
              r1(`${seed}bl${i}${k}`) > 0.45 ? (
                <rect key={k} x={bx + 12} y={-bh + 28 + k * 42} width="16" height="20" fill={lit} opacity="0.85" />
              ) : null,
            )}
        </g>
      );
    })}
  </g>
);

export const Temple: React.FC<{x: number; y: number; s?: number; fill: string; dark: string}> = ({x, y, s = 1, fill, dark}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <rect x="-300" y="-40" width="600" height="40" fill={shade(fill, 0.25)} />
    {[-5, -3, -1, 1, 3, 5].map((k) => (
      <rect key={k} x={k * 48 - 18} y="-300" width="36" height="260" fill={fill} />
    ))}
    <rect x="-320" y="-340" width="640" height="46" fill={fill} />
    <path d="M-330,-340 L0,-470 L330,-340 Z" fill={shade(fill, 0.15)} />
    <rect x="-60" y="-300" width="120" height="260" fill={dark} />
  </g>
);

export const Gate: React.FC<{x: number; y: number; s?: number; fill: string; glow?: string; open?: number}> = ({
  x, y, s = 1, fill, glow, open = 0,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-210,0 L-210,-300 Q-210,-460 0,-470 Q210,-460 210,-300 L210,0 Z" fill={fill} />
    {glow && <path d="M-150,0 L-150,-300 Q-150,-404 0,-412 Q150,-404 150,-300 L150,0 Z" fill={glow} opacity={0.3 + open * 0.6} />}
    <rect x="-14" y="-412" width="28" height="412" fill={fill} opacity={1 - open} />
  </g>
);

export const Cross: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-14" y="-320" width="28" height="320" />
    <rect x="-96" y="-250" width="192" height="24" />
  </g>
);

/** Pillar of cloud or fire. */
export const Pillar: React.FC<{t: number; x: number; y: number; h?: number; hot: string; cool: string}> = ({
  t, x, y, h = 900, hot, cool,
}) => (
  <g>
    {new Array(16).fill(0).map((_, i) => {
      const p = ((t * 2.6 + i * (h / 16)) % h) / h;
      const w = 92 - p * 56;
      return (
        <ellipse key={i} cx={x + Math.sin(p * 7 + i) * 42 * p} cy={y - p * h} rx={Math.max(4, w)} ry={Math.max(3, w * 0.72)}
          fill={mix(hot, cool, p)} opacity={(1 - p) * 0.72} />
      );
    })}
  </g>
);

export const Ladder: React.FC<{x: number; y: number; s?: number; fill: string; top?: number}> = ({x, y, s = 1, fill, top = 1100}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-80" y={-top} width="18" height={top} transform="rotate(4)" />
    <rect x="62" y={-top} width="18" height={top} transform="rotate(-4)" />
    {new Array(9).fill(0).map((_, i) => (
      <rect key={i} x={-74 + i * 2} y={-100 - i * (top / 10)} width={148 - i * 5} height="13" rx="6" />
    ))}
  </g>
);

export const Prison: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-300" y="-620" width="600" height="46" />
    <rect x="-300" y="-60" width="600" height="60" />
    {new Array(7).fill(0).map((_, i) => (
      <rect key={i} x={-282 + i * 90} y="-620" width="26" height="566" />
    ))}
  </g>
);

export const House: React.FC<{x: number; y: number; s?: number; fill: string; lit?: string; t?: number}> = ({
  x, y, s = 1, fill, lit, t = 0,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M-170,0 L-170,-180 L0,-300 L170,-180 L170,0 Z" fill={fill} />
    <rect x="-46" y="-120" width="92" height="120" fill={shade(fill, 0.4)} />
    {lit && (
      <>
        <rect x="-124" y="-156" width="70" height="62" rx="5" fill={lit} opacity={0.86 + Math.sin(t / 12) * 0.08} />
        <rect x="56" y="-156" width="70" height="62" rx="5" fill={lit} opacity={0.78 + Math.sin(t / 15 + 2) * 0.08} />
      </>
    )}
  </g>
);

export const Table: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <rect x="-380" y="-220" width="760" height="34" rx="10" fill={fill} />
    <rect x="-360" y="-186" width="34" height="186" fill={shade(fill, 0.25)} />
    <rect x="326" y="-186" width="34" height="186" fill={shade(fill, 0.25)} />
    <ellipse cx="0" cy="-212" rx="380" ry="22" fill={mix(fill, '#ffffff', 0.12)} />
  </g>
);

export const Tree: React.FC<{t: number; seed: string; x: number; y: number; s?: number; fill: string; bare?: boolean}> = ({
  t, seed, x, y, s = 1, fill, bare = false,
}) => (
  <g transform={`translate(${x},${y}) scale(${s}) rotate(${Math.sin(t / 40) * 1.2})`} fill={fill}>
    <path d="M-16,0 Q-10,-130 -20,-230 L20,-230 Q10,-130 16,0 Z" />
    {new Array(5).fill(0).map((_, i) => {
      const a = -150 + i * 72;
      const len = 74 + r1(`${seed}tb${i}`) * 54;
      return (
        <rect key={i} x="-7" y="0" width="14" height={len} rx="7"
          transform={`translate(0,-230) rotate(${a + (r1(`${seed}ta${i}`) - 0.5) * 30})`} />
      );
    })}
    {!bare &&
      new Array(7).fill(0).map((_, i) => (
        <ellipse key={i} cx={(r1(`${seed}tc${i}`) - 0.5) * 190} cy={-350 - r1(`${seed}td${i}`) * 80}
          rx={66 + r1(`${seed}te${i}`) * 44} ry={50 + r1(`${seed}tf${i}`) * 30} />
      ))}
  </g>
);

export const Signpost: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-7" y="-300" width="14" height="300" />
    <rect x="-134" y="-290" width="128" height="34" rx="6" />
    <rect x="8" y="-236" width="130" height="34" rx="6" />
  </g>
);

export const Campfire: React.FC<{t: number; x: number; y: number; s?: number; wood: string; hot: string; cool: string}> = ({
  t, x, y, s = 1, wood, hot, cool,
}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <rect x="-70" y="-16" width="140" height="16" rx="8" fill={wood} transform="rotate(-8)" />
    <rect x="-70" y="-16" width="140" height="16" rx="8" fill={wood} transform="rotate(10)" />
    {new Array(9).fill(0).map((_, i) => {
      const p = ((t * 3 + i * 18) % 120) / 120;
      return (
        <ellipse key={i} cx={Math.sin(t / 7 + i) * 16} cy={-30 - p * 110} rx={Math.max(3, (1 - p) * 34)} ry={Math.max(4, (1 - p) * 48)}
          fill={mix(hot, cool, p)} opacity={(1 - p) * 0.85} />
      );
    })}
  </g>
);

export const Wall: React.FC<{seed: string; x: number; y: number; s?: number; fill: string}> = ({seed, x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-420" y="-200" width="840" height="200" />
    {new Array(10).fill(0).map((_, i) => (
      <rect key={i} x={-410 + i * 86} y="-250" width="52" height="54" />
    ))}
    {new Array(14).fill(0).map((_, i) => (
      <rect key={i} x={-410 + (i % 7) * 120} y={-180 + Math.floor(i / 7) * 76} width="104" height="62"
        fill="none" stroke={shade(fill, 0.3)} strokeWidth="4" opacity={0.4 + r1(`${seed}w${i}`) * 0.3} />
    ))}
  </g>
);

export const StoneBlock: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <ellipse cx="0" cy="-60" rx="110" ry="74" fill={fill} />
    <ellipse cx="-22" cy="-78" rx="64" ry="42" fill={mix(fill, '#ffffff', 0.08)} />
  </g>
);

// ─── Props ────────────────────────────────────────────────────────────────────

export type PropKind =
  | 'staff' | 'scroll' | 'lamp' | 'sword' | 'crown' | 'chains' | 'net' | 'bread'
  | 'cup' | 'jar' | 'harp' | 'anchor' | 'basket' | 'stone' | 'coat' | 'thorns'
  | 'key' | 'sling' | 'book' | 'shield' | 'spear' | 'sickle' | 'trumpet';

export const Prop: React.FC<{kind: PropKind; x: number; y: number; s?: number; fill: string; accent?: string; t?: number}> = ({
  kind, x, y, s = 1, fill, accent = '#e8d8b4', t = 0,
}) => {
  const g = (children: React.ReactNode) => <g transform={`translate(${x},${y}) scale(${s})`}>{children}</g>;

  switch (kind) {
    case 'staff':
      return g(<path d="M0,0 L0,-230 Q0,-268 -34,-268 Q-62,-266 -58,-238" fill="none" stroke={fill} strokeWidth="13" strokeLinecap="round" />);
    case 'sword':
      return g(
        <g fill={fill}>
          <path d="M-11,-250 L11,-250 L15,-60 L-15,-60 Z" />
          <rect x="-50" y="-60" width="100" height="16" rx="8" />
          <rect x="-11" y="-44" width="22" height="58" rx="8" />
        </g>,
      );
    case 'spear':
      return g(
        <g fill={fill}>
          <rect x="-6" y="-300" width="12" height="300" rx="6" />
          <path d="M0,-370 L22,-290 L-22,-290 Z" />
        </g>,
      );
    case 'shield':
      return g(
        <g>
          <path d="M-74,-150 L74,-150 Q82,-40 0,30 Q-82,-40 -74,-150 Z" fill={fill} />
          <path d="M-46,-124 L46,-124 Q52,-46 0,-6 Q-52,-46 -46,-124 Z" fill="none" stroke={accent} strokeWidth="8" opacity="0.5" />
        </g>,
      );
    case 'crown':
      return g(
        <g fill={fill}>
          <path d="M-96,0 L-110,-104 L-50,-52 L0,-124 L50,-52 L110,-104 L96,0 Z" />
          <rect x="-100" y="0" width="200" height="26" rx="10" />
        </g>,
      );
    case 'thorns':
      return g(
        <g fill="none" stroke={fill} strokeLinecap="round">
          {[0, 1, 2].map((b) => (
            <ellipse key={b} cx="0" cy="0" rx={150 - b * 9} ry={102 - b * 7} strokeWidth={11 - b * 2} opacity={1 - b * 0.18} />
          ))}
          {new Array(22).fill(0).map((_, i) => {
            const a = (i / 22) * Math.PI * 2;
            const px = Math.cos(a) * 150;
            const py = Math.sin(a) * 102;
            const len = 54 + r1(`pt${i}`) * 48;
            const tilt = (r1(`pq${i}`) - 0.5) * 1.4;
            return (
              <line key={i} x1={px} y1={py} x2={px + Math.cos(a + tilt) * len} y2={py + Math.sin(a + tilt) * len * 0.8}
                strokeWidth={4 + r1(`pw${i}`) * 5} />
            );
          })}
        </g>,
      );
    case 'scroll':
      return g(
        <g>
          <rect x="-180" y="-120" width="360" height="240" rx="6" fill={accent} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="-134" y={-82 + i * 46} width="268" height="7" rx="3" fill={fill} opacity="0.3" />
          ))}
          <rect x="-212" y="-146" width="30" height="292" rx="15" fill={fill} />
          <rect x="182" y="-146" width="30" height="292" rx="15" fill={fill} />
        </g>,
      );
    case 'book':
      return g(
        <g>
          <path d="M0,0 Q-120,-40 -260,-10 L-260,170 Q-120,140 0,180 Q120,140 260,170 L260,-10 Q120,-40 0,0 Z" fill={fill} />
          <path d="M0,-6 Q-115,-46 -240,-18 L-240,150 Q-115,122 0,160 Z" fill={accent} />
          <path d="M0,-6 Q115,-46 240,-18 L240,150 Q115,122 0,160 Z" fill={accent} opacity="0.9" />
        </g>,
      );
    case 'lamp':
      return g(
        <g>
          <g fill={fill}>
            <path d="M-56,0 Q-60,36 -16,42 L22,42 Q62,34 56,0 Z" />
            <path d="M46,-4 Q84,-10 92,6 L72,12 Q62,2 46,6 Z" />
            <path d="M-30,-26 Q0,-44 30,-26 Z" />
          </g>
          <ellipse cx="82" cy="2" rx={7 * (0.9 + Math.sin(t / 4.5) * 0.12)} ry={16 * (0.9 + Math.sin(t / 4.5) * 0.12)} fill={accent} />
        </g>,
      );
    case 'chains':
      return g(
        <g fill="none" stroke={fill} strokeWidth="13">
          {new Array(7).fill(0).map((_, i) => (
            <ellipse key={i} cx={Math.sin(i * 0.8) * 14} cy={-210 + i * 58} rx="22" ry="31" />
          ))}
        </g>,
      );
    case 'key':
      return g(
        <g fill={fill}>
          <circle cx="0" cy="-130" r="48" />
          <circle cx="0" cy="-130" r="20" fill={accent} />
          <rect x="-10" y="-90" width="20" height="190" />
          <rect x="0" y="50" width="48" height="18" />
          <rect x="0" y="86" width="34" height="18" />
        </g>,
      );
    case 'net':
      return g(
        <g fill="none" stroke={fill} strokeWidth="5" opacity="0.8">
          {new Array(9).fill(0).map((_, i) => (
            <line key={`a${i}`} x1={-160 + i * 40} y1="-110" x2={-200 + i * 48} y2="130" />
          ))}
          {new Array(6).fill(0).map((_, i) => (
            <path key={`b${i}`} d={`M-175,${-96 + i * 44} Q0,${-62 + i * 44} 175,${-96 + i * 44}`} />
          ))}
        </g>,
      );
    case 'bread':
      return g(
        <g>
          <ellipse cx="0" cy="0" rx="86" ry="40" fill={fill} />
          <ellipse cx="0" cy="-14" rx="78" ry="33" fill={accent} />
          <path d="M-34,-26 L-20,-38 M4,-28 L18,-40" stroke={fill} strokeWidth="6" strokeLinecap="round" />
        </g>,
      );
    case 'cup':
      return g(
        <g fill={fill}>
          <path d="M-48,-68 L48,-68 L37,0 L-37,0 Z" />
          <ellipse cx="0" cy="-68" rx="48" ry="15" fill={accent} />
          <rect x="-10" y="0" width="20" height="40" />
          <ellipse cx="0" cy="42" rx="46" ry="13" />
        </g>,
      );
    case 'jar':
      return g(
        <g fill={fill}>
          <path d="M-30,-130 L30,-130 L44,-96 Q78,-56 70,0 Q62,56 0,62 Q-62,56 -70,0 Q-78,-56 -44,-96 Z" />
          <rect x="-38" y="-146" width="76" height="20" rx="9" />
        </g>,
      );
    case 'harp':
      return g(
        <g fill="none" stroke={fill} strokeWidth="14">
          <path d="M-70,80 Q-90,-80 10,-150" />
          <line x1="-70" y1="80" x2="80" y2="60" />
          <path d="M10,-150 Q96,-100 80,60" />
          {new Array(5).fill(0).map((_, i) => (
            <line key={i} x1={-50 + i * 26} y1={66 - i * 4} x2={-10 + i * 24} y2={-122 + i * 32} strokeWidth="4" opacity="0.65" />
          ))}
        </g>,
      );
    case 'anchor':
      return g(
        <g fill="none" stroke={fill} strokeWidth="20" strokeLinecap="round">
          <circle cx="0" cy="-150" r="30" />
          <line x1="0" y1="-120" x2="0" y2="140" />
          <line x1="-78" y1="-74" x2="78" y2="-74" />
          <path d="M-116,34 Q-108,150 0,152 Q108,150 116,34" />
        </g>,
      );
    case 'basket':
      return g(
        <g fill={fill}>
          <path d="M-90,-40 L90,-40 L66,70 L-66,70 Z" />
          <path d="M-90,-40 Q0,-130 90,-40" fill="none" stroke={fill} strokeWidth="12" />
          <rect x="-96" y="-54" width="192" height="20" rx="9" />
        </g>,
      );
    case 'sling':
      return g(
        <g fill="none" stroke={fill} strokeWidth="8" strokeLinecap="round">
          <path d="M-60,-120 Q-20,20 20,-110" />
          <path d="M-60,-120 Q0,-150 20,-110" />
          <circle cx="-16" cy="-28" r="16" fill={fill} />
        </g>,
      );
    case 'stone':
      return g(<ellipse cx="0" cy="0" rx="38" ry="30" fill={fill} />);
    case 'coat':
      return g(
        <g>
          <path d="M-84,-140 L84,-140 L108,-36 L76,-26 L70,120 L-70,120 L-76,-26 L-108,-36 Z" fill={fill} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="-70" y={-96 + i * 54} width="140" height="22" fill={accent} opacity={0.55 - i * 0.08} />
          ))}
        </g>,
      );
    case 'sickle':
      return g(
        <g fill="none" stroke={fill} strokeWidth="16" strokeLinecap="round">
          <path d="M-10,90 L-10,-40" />
          <path d="M-10,-40 Q110,-70 86,-170" />
        </g>,
      );
    case 'trumpet':
      return g(
        <g fill={fill}>
          <rect x="-110" y="-14" width="180" height="28" rx="14" />
          <path d="M70,-62 L132,-86 L132,86 L70,62 Z" />
        </g>,
      );
    default:
      return null;
  }
};

// ─── Cast ─────────────────────────────────────────────────────────────────────

// ─── People ───────────────────────────────────────────────────────────────────

/**
 * Character colouring. The world stays in silhouette; the SUBJECT is lit, so a
 * person reads as a person rather than a shadow and the eye knows where to look.
 * Tones are fixed rather than taken from the scene palette, so a character looks
 * like the same character whether the scene is a desert noon or a midnight sea.
 */
export const SKIN = ['#c78a5c', '#ab6e45', '#8a5634', '#dda87a', '#9c6340'];
export const HAIR = ['#241509', '#3a2213', '#120c07', '#53301a', '#6b4526'];
// Cloth is deliberately COOL. Skin is warm, so a warm robe makes the whole
// character one brown mass with no readable silhouette inside it.
export const CLOTH = ['#3f5a78', '#4a4270', '#2f5a56', '#5a3a5e', '#38506a', '#46604a', '#6a4450'];

const pickFrom = (arr: string[], seed: string) => arr[Math.floor(random(seed) * arr.length) % arr.length];

/** Darken for the shaded side of a form. */
const dark = (c: string, k = 0.3) => mix(c, '#000000', k);

export type Pose = 'stand' | 'walk' | 'kneel' | 'raise' | 'bow' | 'carry' | 'reach' | 'fallen' | 'sit' | 'point';
export type Build = 'man' | 'woman' | 'boy' | 'girl' | 'elder';

const BUILD = {
  man:   {h: 1.0,  shoulder: 38, robe: 1.0,  head: 21, cover: false},
  woman: {h: 0.95, shoulder: 32, robe: 1.06, head: 20, cover: true},
  boy:   {h: 0.68, shoulder: 28, robe: 0.8,  head: 20, cover: false},
  girl:  {h: 0.66, shoulder: 26, robe: 0.86, head: 19, cover: true},
  elder: {h: 0.97, shoulder: 37, robe: 1.08, head: 21, cover: true},
};

/**
 * One parameterised character covers every person in every story.
 *
 * `lit` draws the figure in skin and cloth with a shaded side; otherwise it is
 * a flat silhouette, which is what crowds and distant figures want so the lit
 * subject stays the focal point.
 *
 * Poses are joint angles, so a new pose is a few numbers rather than a new
 * silhouette that drifts out of style. Idle figures breathe and sway: a
 * perfectly still character is what makes a scene feel frozen.
 */
export const Person: React.FC<{
  x: number; y: number; s?: number; t?: number;
  build?: Build; pose?: Pose; flip?: boolean;
  lit?: boolean; ink: string; light?: string;
  seed?: string; prop?: PropKind;
}> = ({
  x, y, s = 1, t = 0, build = 'man', pose = 'stand', flip = false,
  lit = false, ink, light = '#ffffff', seed = 'p', prop,
}) => {
  const B = BUILD[build] ?? BUILD.man;
  const k = s * B.h;

  const skin = lit ? pickFrom(SKIN, `${seed}sk`) : ink;
  const hair = lit ? pickFrom(HAIR, `${seed}hr`) : ink;
  const cloth = lit ? pickFrom(CLOTH, `${seed}cl`) : ink;
  const clothDark = lit ? dark(cloth, 0.34) : ink;
  const skinDark = lit ? dark(skin, 0.26) : ink;

  // Idle life: a slow breath and a touch of sway. Walking overrides with a step.
  const breath = Math.sin(t / 26) * 2.2;
  const swayA = Math.sin(t / 31 + 1.3) * 2.4;
  const step = Math.sin(t / 6);

  let armBack = 12 + swayA;
  let armFront = -10 - swayA;
  let lean = 0;
  let headTilt = Math.sin(t / 38) * 1.6;
  let mode: 'up' | 'kneel' | 'sit' | 'prone' = 'up';
  let bob = breath;

  switch (pose) {
    case 'walk':   armBack = 24 + step * 24; armFront = -22 - step * 24; lean = 3; bob = -Math.abs(step) * 6; break;
    case 'kneel':  mode = 'kneel'; armBack = 38; armFront = 28; headTilt = 11; break;
    case 'raise':  armBack = -150 - swayA * 2; armFront = 150 + swayA * 2; break;
    case 'bow':    lean = 24; armBack = 34; armFront = 24; headTilt = 14; break;
    case 'carry':  armBack = 60; armFront = 52; lean = -6; break;
    case 'reach':  armBack = -100 + swayA; armFront = 22; lean = -5; break;
    case 'fallen': mode = 'prone'; break;
    case 'sit':    mode = 'sit'; armBack = 42; armFront = 28; break;
    case 'point':  armBack = -84 + swayA; armFront = 18; break;
    default: break;
  }

  const SH = B.shoulder;
  const headY = -186;

  const head = (
    <g transform={`rotate(${headTilt} 0 ${headY})`}>
      <rect x={-7} y={headY + 14} width={14} height={18} fill={skinDark} />
      <ellipse cx={0} cy={headY} rx={B.head * 0.88} ry={B.head} fill={skin} />
      {/* shaded side gives the head form instead of reading as a flat disc */}
      <path d={`M0,${headY - B.head} A${B.head * 0.88},${B.head} 0 0 1 0,${headY + B.head} Z`} fill={skinDark} opacity="0.45" />
      {B.cover ? (
        <path d={`M${-B.head - 4},${headY + 6} Q${-B.head - 2},${headY - B.head - 8} 0,${headY - B.head - 7}
                  Q${B.head + 2},${headY - B.head - 8} ${B.head + 4},${headY + 6}
                  L${B.head + 9},${headY + 54} L${-B.head - 9},${headY + 54} Z`} fill={lit ? clothDark : ink} />
      ) : (
        <path d={`M${-B.head - 1},${headY - 2} Q${-B.head - 1},${headY - B.head - 9} 0,${headY - B.head - 8}
                  Q${B.head + 1},${headY - B.head - 9} ${B.head + 1},${headY - 2}
                  Q${B.head * 0.6},${headY - B.head * 0.75} ${B.head * 0.1},${headY - B.head * 0.5}
                  Q${-B.head * 0.5},${headY - B.head * 0.3} ${-B.head - 1},${headY - 2} Z`} fill={hair} />
      )}
      {/* Face. Small and simple — at reel size anything more becomes noise —
          but a blank oval is what made the earlier figures read as mannequins. */}
      {lit && (
        <g>
          <ellipse cx={-8} cy={headY - 3} rx={2.7} ry={3.7} fill={ink} opacity="0.85" />
          <ellipse cx={8.5} cy={headY - 3} rx={2.7} ry={3.7} fill={ink} opacity="0.7" />
          <path d={`M${1.5},${headY + 1} L${3.5},${headY + 6} L${0.5},${headY + 6.5}`}
            fill="none" stroke={skinDark} strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
          <path d={`M${-7},${headY + 10} Q${1},${headY + 13.5} ${8},${headY + 10}`}
            fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
        </g>
      )}
      {/* Beard sits along the jaw and under the chin, leaving the mouth clear.
          A full mask of hair hides the expression the face was added for. */}
      {(build === 'man' || build === 'elder') && (
        <path d={`M${-B.head + 2},${headY + 4} Q${-B.head + 4},${headY + (build === 'elder' ? 40 : 28)} 0,${headY + (build === 'elder' ? 45 : 32)}
                  Q${B.head - 4},${headY + (build === 'elder' ? 40 : 28)} ${B.head - 2},${headY + 4}
                  Q${B.head - 6},${headY + 16} ${B.head * 0.42},${headY + 15}
                  Q${B.head * 0.2},${headY + 22} 0,${headY + 22}
                  Q${-B.head * 0.2},${headY + 22} ${-B.head * 0.42},${headY + 15}
                  Q${-B.head + 6},${headY + 16} ${-B.head + 2},${headY + 4} Z`}
          fill={build === 'elder' ? (lit ? '#cfc4b4' : ink) : hair} opacity={lit ? 0.92 : 1} />
      )}
    </g>
  );

  const arm = (angle: number, side: -1 | 1, len: number) => (
    <g transform={`translate(${side * (SH - 16)},-140) rotate(${angle})`}>
      <rect x={-6.5} y={0} width={13} height={len * 0.58} rx={6} fill={side < 0 ? clothDark : cloth} />
      <rect x={-5.5} y={len * 0.52} width={11} height={len * 0.44} rx={5.5} fill={side < 0 ? skinDark : skin} />
    </g>
  );

  const body = (() => {
    if (mode === 'prone') {
      return (
        <g>
          <ellipse cx={0} cy={-26} rx={104} ry={30} fill={cloth} />
          <ellipse cx={-30} cy={-34} rx={56} ry={20} fill={clothDark} opacity="0.5" />
          <circle cx={-96} cy={-40} r={B.head} fill={skin} />
          <path d={`M${-96 - B.head},-52 Q-96,${-54 - B.head} ${-96 + B.head},-52 Z`} fill={hair} />
        </g>
      );
    }
    if (mode === 'kneel') {
      return (
        <g>
          <ellipse cx={4} cy={-10} rx={56} ry={16} fill={clothDark} />
          <path d={`M-42,-14 Q-30,-70 -6,-80 L${SH - 4},-68 L${SH + 2},-14 Z`} fill={cloth} />
          <path d={`M-42,-14 Q-30,-70 -6,-80 L-2,-78 L-10,-14 Z`} fill={clothDark} opacity="0.55" />
        </g>
      );
    }
    if (mode === 'sit') {
      return (
        <g>
          <rect x={-14} y={-56} width={28} height={60} rx={12} fill={clothDark} />
          <rect x={2} y={-18} width={84} height={26} rx={12} fill={cloth} />
          <path d={`M${-SH},-58 Q${-SH + 8},-142 0,-154 Q${SH - 8},-142 ${SH},-58 Z`} fill={cloth} />
        </g>
      );
    }
    // standing / walking: legs, then a robe that flares, with a sash
    const stride = pose === 'walk' ? step * 13 : 0;
    return (
      <g>
        {/* legs show below the hem, so the figure is a person and not a cone */}
        <g>
          <rect x={-17 - stride} y={-54} width={15} height={54} rx={6} fill={skinDark} />
          <rect x={4 + stride} y={-54} width={15} height={54} rx={6} fill={skin} />
          <ellipse cx={-10 - stride * 1.3} cy={-2} rx={15} ry={6} fill={clothDark} />
          <ellipse cx={12 + stride * 1.3} cy={-2} rx={15} ry={6} fill={clothDark} />
        </g>
        <path d={`M${-SH - 4},-46 L${-SH + 10},-148 Q0,-166 ${SH - 10},-148 L${SH + 6},-46 Z`} fill={cloth} />
        <path d={`M${-SH - 4},-46 L${-SH + 10},-148 Q${-SH * 0.3},-158 ${-SH * 0.12},-156 L${-SH * 0.28},-46 Z`}
          fill={clothDark} opacity="0.55" />
        <rect x={-SH + 4} y={-100} width={SH * 2 - 8} height={13} rx={6} fill={clothDark} />
        {/* shoulders */}
        <path d={`M${-SH + 8},-150 Q0,-170 ${SH - 8},-150 L${SH - 12},-134 Q0,-150 ${-SH + 12},-134 Z`} fill={clothDark} opacity="0.7" />
      </g>
    );
  })();

  return (
    <g transform={`translate(${x},${y + bob}) scale(${flip ? -k : k},${k}) rotate(${lean})`}>
      {body}
      {mode !== 'prone' && (
        <>
          {arm(armBack, -1, 78)}
          {arm(armFront, 1, 78)}
        </>
      )}
      {mode !== 'prone' && head}
      {prop && mode === 'up' && (
        <g transform={`translate(${-SH - 6},0)`}>
          <Prop kind={prop} x={0} y={prop === 'staff' ? 0 : -116} s={prop === 'staff' ? 0.62 : 0.44}
            fill={lit ? dark(cloth, 0.5) : ink} accent={lit ? light : mix(light, ink, 0.4)} t={t} />
        </g>
      )}
    </g>
  );
};

/** A row of people at varying scale and depth — a crowd, a family, an army. */
export const Crowd: React.FC<{seed: string; t: number; x: number; y: number; n: number; s?: number; fill: string; spread?: number; pose?: Pose}> = ({
  seed, t, x, y, n, s = 1, fill, spread = 620, pose = 'stand',
}) => (
  <g>
    {new Array(Math.max(1, n)).fill(0).map((_, i) => {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const px = x - spread / 2 + f * spread + (random(`${seed}cx${i}`) - 0.5) * 40;
      const depth = random(`${seed}cd${i}`);
      const builds: Build[] = ['man', 'woman', 'man', 'boy', 'woman'];
      return (
        // Crowds stay in silhouette so the lit subject keeps the eye.
        <Person key={i} x={px} y={y + depth * 16} s={s * (0.82 + depth * 0.3)} ink={fill}
          t={t + i * 7} pose={pose} seed={`${seed}${i}`}
          flip={random(`${seed}cf${i}`) > 0.6}
          build={builds[Math.floor(random(`${seed}cb${i}`) * builds.length) % builds.length]} />
      );
    })}
  </g>
);

export const Angel: React.FC<{t: number; x: number; y: number; s?: number; fill: string; glowColor?: string}> = ({
  t, x, y, s = 1, fill, glowColor,
}) => {
  const flap = Math.sin(t / 9) * 18;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={`M-26,-150 Q-180,${-280 + flap} -250,${-120 + flap} Q-150,-110 -30,-96 Z`} fill={glowColor ?? fill} opacity="0.92" />
      <path d={`M26,-150 Q180,${-280 - flap} 250,${-120 - flap} Q150,-110 30,-96 Z`} fill={glowColor ?? fill} opacity="0.92" />
      <path d="M-34,0 L-24,-150 Q0,-170 24,-150 L36,0 Z" fill={fill} />
      <circle cx="2" cy="-192" r="21" fill={fill} />
    </g>
  );
};

export type AnimalKind = 'sheep' | 'ram' | 'dove' | 'lion' | 'fish' | 'donkey' | 'serpent' | 'ox';

export const Animal: React.FC<{kind: AnimalKind; x: number; y: number; s?: number; fill: string; t?: number; flip?: boolean}> = ({
  kind, x, y, s = 1, fill, t = 0, flip = false,
}) => {
  const g = (children: React.ReactNode) => (
    <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`} fill={fill}>{children}</g>
  );
  const head = Math.sin(t / 14) * 6;

  switch (kind) {
    case 'sheep':
      return g(
        <>
          <rect x="-28" y="-26" width="8" height="26" rx="4" />
          <rect x="-8" y="-26" width="8" height="26" rx="4" />
          <rect x="14" y="-26" width="8" height="26" rx="4" />
          <ellipse cx="0" cy="-44" rx="44" ry="26" />
          <g transform={`translate(40,-58) rotate(${head})`}>
            <ellipse cx="10" cy="4" rx="18" ry="13" />
            <rect x="2" y="12" width="7" height="14" rx="3" />
          </g>
        </>,
      );
    case 'ram':
      return g(
        <>
          <rect x="-55" y="-60" width="12" height="60" rx="5" />
          <rect x="-30" y="-60" width="12" height="60" rx="5" />
          <rect x="25" y="-60" width="12" height="60" rx="5" />
          <rect x="48" y="-60" width="12" height="60" rx="5" />
          <ellipse cx="0" cy="-92" rx="82" ry="46" />
          <g transform={`translate(78,-118) rotate(${head})`}>
            <ellipse cx="22" cy="6" rx="30" ry="20" />
            <path d="M-6,-14 C-30,-30 -38,6 -14,14 C2,18 6,0 -6,-4" fill="none" stroke={fill} strokeWidth="12" strokeLinecap="round" />
          </g>
        </>,
      );
    case 'dove':
      return g(
        <>
          <ellipse cx="0" cy="0" rx="46" ry="24" />
          <circle cx="40" cy="-16" r="18" />
          <path d="M54,-20 L80,-12 L54,-6 Z" />
          <path d={`M-10,-8 Q-50,${-70 - Math.sin(t / 5) * 30} -96,-30 Q-56,-10 -14,-4 Z`} />
          <path d={`M-10,8 Q-50,${70 + Math.sin(t / 5) * 30} -96,30 Q-56,10 -14,4 Z`} />
          <path d="M-40,2 L-104,20 L-44,-10 Z" />
        </>,
      );
    case 'lion':
      return g(
        <>
          <rect x="-66" y="-54" width="15" height="54" rx="7" />
          <rect x="-30" y="-54" width="15" height="54" rx="7" />
          <rect x="34" y="-54" width="15" height="54" rx="7" />
          <ellipse cx="0" cy="-86" rx="92" ry="44" />
          <circle cx="86" cy="-118" r="52" />
          <circle cx="94" cy="-118" r="30" fill={shade(fill, 0.2)} />
          <path d="M-88,-96 Q-140,-120 -128,-58" fill="none" stroke={fill} strokeWidth="13" strokeLinecap="round" />
        </>,
      );
    case 'fish':
      return g(
        <>
          <ellipse cx="0" cy="0" rx="74" ry="34" />
          <path d={`M-66,0 L-124,${-34 + Math.sin(t / 7) * 12} L-112,0 L-124,${34 + Math.sin(t / 7) * 12} Z`} />
          <circle cx="42" cy="-10" r="7" fill={shade(fill, -0.6)} />
        </>,
      );
    case 'donkey':
      return g(
        <>
          <rect x="-56" y="-62" width="14" height="62" rx="7" />
          <rect x="-24" y="-62" width="14" height="62" rx="7" />
          <rect x="30" y="-62" width="14" height="62" rx="7" />
          <ellipse cx="0" cy="-92" rx="80" ry="40" />
          <g transform={`translate(70,-130) rotate(${head})`}>
            <ellipse cx="22" cy="14" rx="36" ry="19" transform="rotate(26 22 14)" />
            <path d="M6,-14 L-2,-52 L16,-44 Z" />
            <path d="M28,-10 L34,-50 L46,-36 Z" />
          </g>
        </>,
      );
    case 'ox':
      return g(
        <>
          <rect x="-62" y="-66" width="16" height="66" rx="8" />
          <rect x="-26" y="-66" width="16" height="66" rx="8" />
          <rect x="34" y="-66" width="16" height="66" rx="8" />
          <ellipse cx="0" cy="-104" rx="96" ry="50" />
          <g transform={`translate(88,-132) rotate(${head})`}>
            <ellipse cx="18" cy="10" rx="34" ry="24" />
            <path d="M-6,-16 Q-40,-50 -8,-44" fill="none" stroke={fill} strokeWidth="12" strokeLinecap="round" />
            <path d="M34,-14 Q62,-50 34,-42" fill="none" stroke={fill} strokeWidth="12" strokeLinecap="round" />
          </g>
        </>,
      );
    case 'serpent':
      return g(
        <path d={`M-140,0 Q-70,${-60 + Math.sin(t / 10) * 18} 0,0 Q70,${60 - Math.sin(t / 10) * 18} 140,-10 L150,-32 L112,-34`}
          fill="none" stroke={fill} strokeWidth="26" strokeLinecap="round" />,
      );
    default:
      return null;
  }
};

// ─── Weather & FX ─────────────────────────────────────────────────────────────

export const Rain: React.FC<{t: number; seed: string; n: number; color?: string; opacity?: number}> = ({
  t, seed, n, color = '#cfe0f0', opacity = 0.5,
}) => (
  <g opacity={opacity} stroke={color} strokeWidth="3" strokeLinecap="round">
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const x = r1(`${seed}rx${i}`) * (W + 160) - 80;
      const speed = 22 + r1(`${seed}rs${i}`) * 16;
      const y = ((t * speed + r1(`${seed}ro${i}`) * 1600) % 1600) - 120;
      const len = 26 + r1(`${seed}rl${i}`) * 34;
      return <line key={i} x1={x} y1={y} x2={x - 10} y2={y + len} />;
    })}
  </g>
);

export const Snow: React.FC<{t: number; seed: string; n: number; color?: string; opacity?: number}> = ({
  t, seed, n, color = '#eef4ff', opacity = 0.7,
}) => (
  <g opacity={opacity} fill={color}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const x = r1(`${seed}nx${i}`) * W + Math.sin(t / (16 + (i % 9)) + i) * 36;
      const y = ((t * (3 + r1(`${seed}ns${i}`) * 3) + r1(`${seed}no${i}`) * 1900) % 1900) - 60;
      return <circle key={i} cx={x} cy={y} r={2 + r1(`${seed}nr${i}`) * 4} />;
    })}
  </g>
);

export const Dust: React.FC<{t: number; seed: string; n: number; color?: string; opacity?: number; y?: number}> = ({
  t, seed, n, color = '#e8c492', opacity = 0.22, y = 1300,
}) => (
  <g opacity={opacity} fill={color}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => (
      <ellipse key={i} cx={(i * 150 + t * 2.4 + r1(`${seed}dx${i}`) * 300) % (W + 260) - 130}
        cy={y + (i % 4) * 44} rx={70 + r1(`${seed}dr${i}`) * 70} ry={5 + r1(`${seed}dq${i}`) * 5} />
    ))}
  </g>
);

export const Mist: React.FC<{t: number; seed: string; n: number; color?: string; opacity?: number; y?: number; band?: number}> = ({
  t, seed, n, color = '#b8c4d0', opacity = 0.16, y = 1150, band = 280,
}) => (
  <g opacity={opacity} fill={color}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => (
      <ellipse key={i} cx={((i * 220 + t * 0.8) % (W + 500)) - 250} cy={y + r1(`${seed}mx${i}`) * band}
        rx={200 + r1(`${seed}mr${i}`) * 160} ry={28 + r1(`${seed}mq${i}`) * 22} />
    ))}
  </g>
);

export const Motes: React.FC<{t: number; seed: string; n: number; color: string; opacity?: number; from?: number; rise?: number; x?: number; spread?: number}> = ({
  t, seed, n, color, opacity = 0.55, from = 1300, rise = 760, x = W / 2, spread = 520,
}) => (
  <g fill={color}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const p = ((t * (1.1 + (i % 4) * 0.5) + i * (rise / n)) % rise) / rise;
      return (
        <circle key={i} cx={x - spread / 2 + r1(`${seed}mx${i}`) * spread + Math.sin(t / 16 + i) * 14}
          cy={from - p * rise} r={2 + (i % 3)} opacity={(1 - p) * opacity} />
      );
    })}
  </g>
);

export const Bubbles: React.FC<{t: number; seed: string; n: number; color?: string; opacity?: number}> = ({
  t, seed, n, color = '#bfe4ff', opacity = 0.3,
}) => (
  <g fill={color} opacity={opacity}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const y = 1500 - ((t * (1.6 + (i % 4) * 0.7) + i * 70) % 1700);
      return <circle key={i} cx={240 + ((i * 139) % 600) + Math.sin(t / (18 + i) + i) * 14} cy={y} r={3 + (i % 4) * 2.5} />;
    })}
  </g>
);

export const Birds: React.FC<{t: number; seed: string; n: number; color: string; y?: number; opacity?: number}> = ({
  t, seed, n, color, y = 460, opacity = 0.55,
}) => (
  <g stroke={color} strokeWidth="4" fill="none" opacity={opacity} strokeLinecap="round">
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const x = ((i * 190 + t * 1.6) % (W + 300)) - 150;
      const by = y + r1(`${seed}by${i}`) * 180 + Math.sin(t / 22 + i) * 12;
      const w = 13 + r1(`${seed}bw${i}`) * 9;
      const f = Math.sin(t / 6 + i) * 5;
      return <path key={i} d={`M${x - w},${by} q${w / 2},${-6 - f} ${w},0 q${w / 2},${6 + f} ${w},0`} />;
    })}
  </g>
);

export const Smoke: React.FC<{t: number; x: number; y: number; n?: number; seed: string; color?: string; opacity?: number; rise?: number}> = ({
  t, x, y, n = 16, seed, color = '#d8cbb4', opacity = 0.3, rise = 620,
}) => (
  <g opacity={opacity}>
    {new Array(Math.max(0, n)).fill(0).map((_, i) => {
      const p = ((t * 1.5 + i * (rise / n)) % rise) / rise;
      const rad = 16 + p * 62;
      const dx = Math.sin(p * 5 + i) * 70 * p;
      return (
        <circle key={i} cx={x + dx + (r1(`${seed}k${i}`) - 0.5) * 40} cy={y - p * rise} r={rad} fill={color} opacity={(1 - p) * 0.5} />
      );
    })}
  </g>
);

export const Ripples: React.FC<{t: number; y: number; color?: string; n?: number; opacity?: number}> = ({
  t, y, color = '#cfe4f0', n = 14, opacity = 0.4,
}) => (
  <g fill="none" stroke={color} strokeWidth="3">
    {new Array(n).fill(0).map((_, i) => {
      const p = ((t * 3 + i * 26) % 70) / 70;
      return <ellipse key={i} cx={80 + ((i * 131) % 940)} cy={y} rx={6 + p * 42} ry={2 + p * 9} opacity={(1 - p) * opacity} />;
    })}
  </g>
);

export const Wheat: React.FC<{x: number; y: number; s?: number; fill: string; tilt: number}> = ({x, y, s = 1, fill, tilt}) => (
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
