import React from 'react';
import {random} from 'remotion';

export const C = {
  ink: '#0d0a09',
  sand: '#efe2c8',
  ember: '#f0903e',
  gold: '#f4c66e',
  blood: '#9b2c22',
};

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const hex = (h: string) =>
  h.startsWith('rgb') ? (h.match(/\d+/g) as string[]).slice(0, 3).map(Number) : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a: string, b: string, p: number) => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], Math.min(1, Math.max(0, p))))).join(',')})`;
};

export const Sky: React.FC<{id: string; top: string; bottom: string}> = ({id, top, bottom}) => (
  <>
    <defs>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={top} />
        <stop offset="1" stopColor={bottom} />
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill={`url(#sky-${id})`} />
  </>
);

export const Stars: React.FC<{n: number; t: number; opacity?: number; seed?: string; maxY?: number}> = ({
  n, t, opacity = 1, seed = 's', maxY = 1100,
}) => (
  <g opacity={opacity}>
    {new Array(n).fill(0).map((_, i) => {
      const x = random(`${seed}x${i}`) * 1080;
      const y = random(`${seed}y${i}`) * maxY;
      const r = 0.8 + random(`${seed}r${i}`) * 2.2;
      const tw = 0.55 + 0.45 * Math.sin(t / 12 + i * 1.7);
      return <circle key={i} cx={x} cy={y} r={r} fill="#fff8e6" opacity={tw} />;
    })}
  </g>
);

export const Glow: React.FC<{id: string; cx: number; cy: number; r: number; color: string; opacity?: number}> = ({
  id, cx, cy, r, color, opacity = 1,
}) => (
  <>
    <defs>
      <radialGradient id={`glow-${id}`}>
        <stop offset="0" stopColor={color} stopOpacity={0.95} />
        <stop offset="0.35" stopColor={color} stopOpacity={0.35} />
        <stop offset="1" stopColor={color} stopOpacity={0} />
      </radialGradient>
    </defs>
    <circle cx={cx} cy={cy} r={r} fill={`url(#glow-${id})`} opacity={opacity} />
  </>
);

// Mountain ridge from a list of [x,y] points, closed to the bottom
export const Ridge: React.FC<{pts: number[][]; fill: string; dx?: number}> = ({pts, fill, dx = 0}) => (
  <path
    transform={`translate(${dx},0)`}
    d={`M${pts[0][0] - 400},1920 L${pts[0][0] - 400},${pts[0][1]} ${pts.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${pts[pts.length - 1][0] + 400},${pts[pts.length - 1][1]} L${pts[pts.length - 1][0] + 400},1920 Z`}
    fill={fill}
  />
);

export const MORIAH = [[-100, 1180], [150, 1120], [330, 980], [470, 860], [540, 820], [610, 860], [760, 990], [930, 1090], [1180, 1150]];

// Father figure: feet at (0,0), facing right
export const Father: React.FC<{x: number; y: number; s?: number; fill: string; arm?: number; staff?: boolean; flip?: boolean}> = ({
  x, y, s = 1, fill, arm = 25, staff = true, flip = false,
}) => (
  <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`} fill={fill}>
    <path d="M-40,0 L-27,-150 Q0,-168 27,-150 L42,0 Z" />
    <path d="M-30,-152 Q-34,-196 0,-206 Q30,-200 26,-160 Z" />
    <circle cx="4" cy="-182" r="21" />
    <path d="M8,-172 Q30,-160 22,-138 Q8,-142 2,-160 Z" />
    {staff && <rect x="-62" y="-232" width="7" height="232" rx="3" />}
    <g transform={`translate(16,-140) rotate(${arm})`}>
      <rect x="-7" y="0" width="14" height="78" rx="7" />
    </g>
  </g>
);

// Son figure (smaller), optional wood bundle
export const Son: React.FC<{x: number; y: number; s?: number; fill: string; wood?: string; flip?: boolean; beam?: boolean}> = ({
  x, y, s = 1, fill, wood, flip = false, beam = false,
}) => (
  <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`}>
    {wood && !beam && (
      <g fill={wood} transform="translate(-26,-104) rotate(-8)">
        <rect x="-30" y="0" width="62" height="10" rx="4" />
        <rect x="-26" y="10" width="58" height="10" rx="4" />
        <rect x="-32" y="20" width="64" height="10" rx="4" />
      </g>
    )}
    {beam && <rect x="-120" y="-118" width="200" height="16" rx="5" fill={wood ?? fill} transform="rotate(-24 -20 -110)" />}
    <g fill={fill}>
      <path d="M-26,0 L-18,-96 Q0,-108 18,-96 L28,0 Z" />
      <circle cx="3" cy="-120" r="17" />
    </g>
  </g>
);

export const Ram: React.FC<{x: number; y: number; s?: number; fill: string; head?: number}> = ({x, y, s = 1, fill, head = 0}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-55" y="-60" width="12" height="60" rx="5" />
    <rect x="-30" y="-60" width="12" height="60" rx="5" />
    <rect x="25" y="-60" width="12" height="60" rx="5" />
    <rect x="48" y="-60" width="12" height="60" rx="5" />
    <ellipse cx="0" cy="-92" rx="82" ry="46" />
    <g transform={`translate(78,-118) rotate(${head})`}>
      <ellipse cx="22" cy="6" rx="30" ry="20" />
      <path d="M-6,-14 C-30,-30 -38,6 -14,14 C2,18 6,0 -6,-4" fill="none" stroke={fill} strokeWidth="12" strokeLinecap="round" />
    </g>
  </g>
);

export const Thicket: React.FC<{x: number; y: number; stroke: string; w?: number}> = ({x, y, stroke, w = 360}) => (
  <g transform={`translate(${x},${y})`} fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round">
    {new Array(22).fill(0).map((_, i) => {
      const sx = (random(`tk${i}`) - 0.5) * w;
      const h = 80 + random(`th${i}`) * 170;
      const bend = (random(`tb${i}`) - 0.5) * 120;
      return <path key={i} d={`M${sx},0 Q${sx + bend},${-h * 0.5} ${sx + bend * 1.4},${-h}`} />;
    })}
  </g>
);

export const Altar: React.FC<{x: number; y: number; fill: string; wood?: string}> = ({x, y, fill, wood}) => (
  <g transform={`translate(${x},${y})`}>
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

export const Cross: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-14" y="-320" width="28" height="320" />
    <rect x="-96" y="-250" width="192" height="24" />
  </g>
);

export const Idol: React.FC<{x: number; y: number; s?: number; fill: string}> = ({x, y, s = 1, fill}) => (
  <g transform={`translate(${x},${y}) scale(${s})`} fill={fill}>
    <rect x="-70" y="-60" width="140" height="60" />
    <path d="M-50,-60 L-40,-300 L40,-300 L50,-60 Z" />
    <path d="M-40,-300 Q-90,-360 -70,-420 Q-55,-350 -20,-330 Z" />
    <path d="M40,-300 Q90,-360 70,-420 Q55,-350 20,-330 Z" />
    <rect x="-40" y="-220" width="80" height="14" opacity="0.5" />
  </g>
);

export const Book: React.FC<{x: number; y: number; fill: string; page: string}> = ({x, y, fill, page}) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M0,0 Q-120,-40 -260,-10 L-260,170 Q-120,140 0,180 Q120,140 260,170 L260,-10 Q120,-40 0,0 Z" fill={fill} />
    <path d="M0,-6 Q-115,-46 -240,-18 L-240,150 Q-115,122 0,160 Z" fill={page} />
    <path d="M0,-6 Q115,-46 240,-18 L240,150 Q115,122 0,160 Z" fill={page} opacity="0.9" />
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i} stroke={fill} strokeOpacity="0.25" strokeWidth="4">
        <line x1="-210" y1={10 + i * 26} x2="-30" y2={14 + i * 26} />
        <line x1="30" y1={14 + i * 26} x2="210" y2={10 + i * 26} />
      </g>
    ))}
  </g>
);
