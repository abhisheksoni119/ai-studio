import React from 'react';
import {interpolate, Easing} from 'remotion';
import {
  C, Sky, Stars, Glow, Ridge, MORIAH, Father, Son, Ram, Thicket, Altar, Cross, Idol, Book, mix,
} from './Art';
import {FPS} from './timeline';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const io = Easing.bezier(0.45, 0, 0.55, 1);
// t = local frame, at = global scene start seconds. g(sec) converts global seconds → local frame.
type P = {t: number; at: number; dur: number};
const ramp = (t: number, a: number, b: number, from = 0, to = 1) => interpolate(t, [a, b], [from, to], {...cl, easing: io});

const Title: React.FC<{y: number; text: string; size?: number; color?: string; op?: number; spacing?: number; italic?: boolean}> = ({
  y, text, size = 46, color = C.gold, op = 1, spacing = 14, italic = false,
}) => (
  <text x="540" y={y} textAnchor="middle" fill={color} opacity={op}
    style={{fontFamily: italic ? 'Cormorant Garamond' : 'Inter', fontStyle: italic ? 'italic' : 'normal', fontWeight: italic ? 500 : 600, fontSize: size, letterSpacing: spacing}}>
    {text}
  </text>
);

const ground = (fill: string, y = 1260) => <rect x="0" y={y} width="1080" height={1920 - y} fill={fill} />;
const bob = (t: number, speed = 7, amp = 5) => -Math.abs(Math.sin(t / speed)) * amp;

export const Hook: React.FC<P> = ({t}) => (
  <>
    <Sky id="hook" top="#0b0d1f" bottom="#43283a" />
    <Stars n={120} t={t} seed="hk" />
    <Glow id="moon" cx={790} cy={430} r={260} color="#ffe9c4" opacity={0.5} />
    <circle cx={790} cy={430} r={58} fill="#fff1d6" />
    <Ridge pts={[[0, 1150], [300, 1060], [600, 1110], [1080, 1030]]} fill="#2b1d2c" dx={-t * 0.3} />
    <Ridge pts={[[0, 1300], [360, 1200], [540, 1180], [760, 1210], [1080, 1290]]} fill={C.ink} />
    <Father x={500} y={1186} s={1.25} fill={C.ink} arm={38} />
    <Son x={600} y={1190} s={1.15} fill={C.ink} />
    <Title y={330} text="GENESIS 22" op={ramp(t, 10, 30)} />
  </>
);

export const BookScene: React.FC<P> = ({t}) => (
  <>
    <Sky id="book" top="#120d0a" bottom="#2a1a10" />
    <Glow id="bk" cx={540} cy={860} r={620} color={C.gold} opacity={ramp(t, 0, 40, 0.2, 0.75)} />
    {new Array(14).fill(0).map((_, i) => (
      <rect key={i} x="536" y="300" width="8" height="520" fill={C.gold} opacity={0.12}
        transform={`rotate(${i * 26 + t * 0.4} 540 860)`} />
    ))}
    <g transform={`translate(0,${ramp(t, 0, 60, 30, 0)})`}>
      <Book x={540} y={900} fill="#3b2614" page={C.sand} />
    </g>
    {new Array(30).fill(0).map((_, i) => {
      const x = 340 + ((i * 97) % 400);
      const y = 1000 - ((t * (1 + (i % 4) * 0.5) + i * 40) % 700);
      return <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill={C.gold} opacity={0.6} />;
    })}
  </>
);

export const StarsScene: React.FC<P> = ({t, at}) => {
  const promise = (10.1 - at) * FPS;
  const years = Math.round(ramp(t, 5, 70, 0, 25));
  return (
    <>
      <Sky id="st" top="#05060f" bottom="#1d1a35" />
      <Stars n={Math.round(ramp(t, 0, 120, 60, 420))} t={t} seed="pr" maxY={1250} />
      <Glow id="pm" cx={540} cy={760} r={420} color={C.gold} opacity={ramp(t, promise, promise + 20, 0, 0.9)} />
      <circle cx={540} cy={760} r={ramp(t, promise, promise + 25, 0, 26)} fill="#fff6dc" />
      <Ridge pts={[[0, 1330], [400, 1280], [800, 1300], [1080, 1270]]} fill={C.ink} />
      <Father x={330} y={1290} s={1.3} fill={C.ink} arm={-150} />
      <text x="540" y="380" textAnchor="middle" fill={C.gold} opacity={ramp(t, 0, 15) * ramp(t, promise - 10, promise, 1, 0)}
        style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 150, letterSpacing: 6}}>{years}</text>
      <Title y={450} text="YEARS OF WAITING" size={34} op={ramp(t, 10, 25) * ramp(t, promise - 10, promise, 1, 0)} />
      <Title y={420} text="THE PROMISE" op={ramp(t, promise + 5, promise + 20)} />
    </>
  );
};

export const Call: React.FC<P> = ({t}) => (
  <>
    <Sky id="call" top="#1b1530" bottom="#7a4a3a" />
    <Stars n={60} t={t} seed="cl" opacity={0.5} />
    <defs>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3d0" stopOpacity="0.85" />
        <stop offset="1" stopColor="#fff3d0" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d={`M${500 - ramp(t, 0, 40, 10, 60)},0 L${540 + ramp(t, 0, 40, 10, 60)},0 L${720},1260 L${330},1260 Z`} fill="url(#beam)" opacity={ramp(t, 0, 30)} />
    <Ridge pts={[[0, 1240], [300, 1200], [700, 1230], [1080, 1190]]} fill="#3a2430" />
    {ground('#1a1015', 1255)}
    <Glow id="cg" cx={530} cy={1150} r={260} color="#fff0c8" opacity={0.6} />
    <Father x={530} y={1262} s={1.5} fill={C.ink} arm={10} />
    <Title y={330} text="GENESIS 22:2" size={36} op={ramp(t, 40, 60)} />
  </>
);

export const Journey: React.FC<P> = ({t, at, dur}) => {
  const zoomAt = (20.8 - at) * FPS;
  const z = ramp(t, zoomAt, zoomAt + 40, 1, 1.45);
  const fx = 260 + t * 1.6;
  const day = Math.min(3, 1 + Math.floor(t / (dur * 0.22)));
  return (
    <>
      <Sky id="jr" top="#5b3a5c" bottom="#f2b27a" />
      <circle cx={830} cy={ramp(t, 0, dur, 900, 640)} r={70} fill="#ffe2a8" />
      <Glow id="sun" cx={830} cy={ramp(t, 0, dur, 900, 640)} r={300} color="#ffd18a" opacity={0.6} />
      <Ridge pts={MORIAH.map(([x, y]) => [x, y - 40])} fill="#8a4f52" />
      <g transform={`translate(${fx + 50},1250) scale(${z}) translate(${-(fx + 50)},-1250)`}>
        <Ridge pts={[[0, 1240], [500, 1220], [1080, 1250]]} fill="#3b2228" />
        {ground('#2a171c', 1250)}
        <Father x={fx} y={1254 + bob(t)} s={1.1} fill={C.ink} arm={20} />
        <Son x={fx + 110} y={1254 + bob(t + 3)} s={1.05} fill={C.ink} wood="#5a3a24" />
      </g>
      <Title y={330} text={`DAY ${day}`} size={58} op={ramp(t, 5, 20) * ramp(t, zoomAt - 10, zoomAt, 1, 0)} />
    </>
  );
};

export const LambQ: React.FC<P> = ({t, at}) => {
  const prov = (27.7 - at) * FPS;
  return (
    <>
      <Sky id="lq" top="#2a1b3a" bottom="#d9824e" />
      <Glow id="lql" cx={540} cy={200} r={ramp(t, prov, prov + 40, 0, 900)} color="#ffe6b0" opacity={0.8} />
      <Ridge pts={MORIAH.map(([x, y]) => [x, y + 40])} fill="#6b3a42" />
      {ground('#24131a', 1250)}
      <Son x={400} y={1258} s={2} fill={C.ink} wood="#4a2e1d" />
      <Father x={680} y={1258} s={2} fill={C.ink} flip arm={15} />
    </>
  );
};

export const AltarScene: React.FC<P> = ({t, at}) => {
  const raise = (30.2 - at) * FPS;
  const stop = (32.8 - at) * FPS;
  const arm = t < stop ? ramp(t, raise, raise + 50, 20, -165) : ramp(t, stop, stop + 30, -165, 30);
  const flash = ramp(t, stop, stop + 4) * ramp(t, stop + 4, stop + 30, 1, 0);
  return (
    <>
      <Sky id="al" top={mix('#2a0f14', '#5a3a30', ramp(t, stop, stop + 20))} bottom={mix('#a8402c', '#f2c070', ramp(t, stop, stop + 20))} />
      <Glow id="alg" cx={540} cy={300} r={700} color="#fff2cc" opacity={ramp(t, stop, stop + 20, 0, 0.8)} />
      <Ridge pts={[[0, 1300], [300, 1180], [540, 1130], [780, 1180], [1080, 1300]]} fill={C.ink} />
      <Altar x={440} y={1140} fill="#2a1a16" wood="#4a2e1d" />
      <Father x={700} y={1150} s={1.6} fill={C.ink} flip arm={arm} staff={false} />
      <rect width="1080" height="1920" fill="#fffaf0" opacity={flash} />
    </>
  );
};

export const RamScene: React.FC<P> = ({t}) => (
  <>
    <Sky id="rm" top="#4a3a40" bottom="#f4cf8a" />
    <Glow id="rmg" cx={760} cy={600} r={600} color="#fff0c4" opacity={0.75} />
    <Ridge pts={[[0, 1260], [540, 1220], [1080, 1250]]} fill="#2f2226" />
    {ground('#1f1519', 1250)}
    <Ram x={520} y={1250} s={1.6} fill={C.ink} head={Math.sin(t / 10) * 6} />
    <Thicket x={600} y={1260} stroke="#120c0c" w={460} />
  </>
);

export const Idols: React.FC<P> = ({t, at}) => {
  const turn = (42.8 - at) * FPS;
  const fall = ramp(t, turn, turn + 40);
  return (
    <>
      <Sky id="id" top={mix('#14070a', '#3a3040', fall)} bottom={mix('#6a1a14', '#f3d9a0', fall)} />
      <Glow id="fire" cx={540} cy={1250} r={700} color="#ff5a2a" opacity={0.55 * (1 - fall)} />
      <Glow id="holy" cx={540} cy={300} r={ramp(t, turn, turn + 40, 0, 1000)} color="#fff4d6" opacity={0.9} />
      <g opacity={1 - fall} transform={`translate(0,${fall * 160})`}>
        <Idol x={260} y={1260} s={1.1} fill="#0e0606" />
        <Idol x={820} y={1260} s={1.1} fill="#0e0606" />
        <Idol x={540} y={1240} s={1.45} fill="#080303" />
      </g>
      {new Array(18).fill(0).map((_, i) => {
        const y = 1250 - ((t * 3 + i * 60) % 800);
        return <circle key={i} cx={300 + ((i * 131) % 480)} cy={y} r={30 + (i % 4) * 14} fill="#2a1414" opacity={0.25 * (1 - fall)} />;
      })}
      {ground(mix('#120606', '#2a1e22', fall), 1250)}
      <Title y={330} text="THE ANCIENT WORLD" size={34} op={ramp(t, 40, 60) * (1 - fall)} />
    </>
  );
};

export const Generations: React.FC<P> = ({t}) => (
  <>
    <Sky id="gn" top="#1a1a33" bottom="#e7b37a" />
    <Glow id="gng" cx={540} cy={420} r={700} color="#fff0c8" opacity={0.7} />
    {ground('#20141a', 1100)}
    {[0, 1, 2, 3].map((row) =>
      new Array(9).fill(0).map((_, i) => {
        const appear = row * 25 + i * 4;
        const op = ramp(t, appear, appear + 12);
        const s = 0.55 + row * 0.18;
        const x = 80 + i * 115 + (row % 2) * 55;
        const y = 1120 + row * 150;
        return i % 3 === 1 ? (
          <g key={`${row}-${i}`} opacity={op}><Son x={x} y={y} s={s} fill={C.ink} /></g>
        ) : (
          <g key={`${row}-${i}`} opacity={op}><Father x={x} y={y} s={s * 0.8} fill={C.ink} staff={false} /></g>
        );
      }),
    )}
    <Title y={330} text="EVERY GENERATION" size={40} op={ramp(t, 15, 35)} />
  </>
);

export const Jireh: React.FC<P> = ({t}) => (
  <>
    <Sky id="jh" top="#3a2440" bottom="#f6c27a" />
    <circle cx={540} cy={900} r={110} fill="#ffe7b0" />
    <Glow id="jhs" cx={540} cy={900} r={520} color="#ffd790" opacity={0.85} />
    <Ridge pts={MORIAH} fill="#6a3a3a" />
    <Ridge pts={[[0, 1350], [540, 1300], [1080, 1340]]} fill={C.ink} />
    <text x="540" y="400" textAnchor="middle" fill={C.ink} opacity={ramp(t, 20, 40)}
      style={{fontFamily: 'Cormorant Garamond', fontWeight: 600, fontSize: 110, letterSpacing: 6}}>JEHOVAH JIREH</text>
    <Title y={470} text="GENESIS 22:14" size={30} color={C.ink} op={ramp(t, 35, 55)} />
  </>
);

export const Miss: React.FC<P> = ({t}) => (
  <>
    <rect width="1080" height="1920" fill="#0b0807" />
    <rect x={540 - ramp(t, 0, 40, 0, 300)} y="958" width={ramp(t, 0, 40, 0, 600)} height="4" fill={C.ember} />
  </>
);

export const Centuries: React.FC<P> = ({t, at, dur}) => {
  const lapseEnd = (60.5 - at) * FPS;
  const beamAt = (60.9 - at) * FPS;
  const ph = t < lapseEnd ? (t / lapseEnd) * 4 : 4; // 4 day cycles
  const day = (Math.sin((ph % 1) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  const sunX = 100 + (ph % 1) * 880;
  const sunY = 1000 - Math.sin((ph % 1) * Math.PI) * 600;
  const settle = ramp(t, lapseEnd - 20, lapseEnd);
  const top = mix(mix('#070814', '#4a6a9a', day), '#3a2240', settle);
  const bottom = mix(mix('#1a1428', '#f1c48a', day), '#c0603e', settle);
  return (
    <>
      <Sky id="cn" top={top} bottom={bottom} />
      <Stars n={150} t={t} seed="cn" opacity={(1 - day) * (1 - settle)} />
      {t < lapseEnd && <circle cx={sunX} cy={sunY} r={55} fill="#ffe6b0" opacity={day} />}
      <Ridge pts={MORIAH} fill={mix('#3a2a36', '#5a2e34', settle)} />
      <g transform={`translate(0,${ramp(t, 60, 150, 260, 0)})`} fill="#1c1118">
        <rect x="0" y="1150" width="1080" height="200" />
        {new Array(12).fill(0).map((_, i) => <rect key={i} x={i * 92} y="1120" width="50" height="40" />)}
        <rect x="180" y="1040" width="110" height="160" />
        <rect x="760" y="1060" width="120" height="140" />
      </g>
      {ground(C.ink, 1330)}
      <g opacity={ramp(t, beamAt, beamAt + 15)}>
        <Son x={300 + (t - beamAt) * 1.4} y={1336 + bob(t)} s={1.5} fill="#000" wood="#000" beam />
      </g>
      <Title y={330} text="CENTURIES LATER" size={40} op={ramp(t, 10, 30) * ramp(t, lapseEnd - 30, lapseEnd - 10, 1, 0)} />
      <Title y={330} text="JERUSALEM" size={40} op={ramp(t, lapseEnd, lapseEnd + 20) * ramp(t, dur - 15, dur, 1, 0)} />
    </>
  );
};

export const CrossScene: React.FC<P> = ({t}) => (
  <>
    <Sky id="cr" top="#0a0a10" bottom="#4a2a2a" />
    <Glow id="crg" cx={540} cy={820} r={ramp(t, 0, 60, 300, 520)} color="#f7d9a0" opacity={0.6} />
    <Ridge pts={[[0, 1350], [300, 1200], [540, 1150], [780, 1200], [1080, 1350]]} fill={C.ink} />
    <g transform={`translate(540,1160) scale(${ramp(t, 0, 70, 1, 1.12)}) translate(-540,-1160)`}>
      <Cross x={540} y={1160} s={1.6} fill={C.ink} />
    </g>
  </>
);

export const End: React.FC<P> = ({t}) => (
  <>
    <rect width="1080" height="1920" fill={mix('#2a1a14', '#f6efe1', ramp(t, 0, 25))} />
    <Glow id="end" cx={540} cy={860} r={600} color="#ffd890" opacity={ramp(t, 10, 40, 0, 0.55)} />
    <g opacity={ramp(t, 20, 45)}>
      <ellipse cx="540" cy="930" rx="70" ry="40" fill="#3a2a22" />
      <circle cx="605" cy="895" r="26" fill="#3a2a22" />
      <rect x="490" y="955" width="10" height="45" fill="#3a2a22" />
      <rect x="520" y="955" width="10" height="45" fill="#3a2a22" />
      <rect x="555" y="955" width="10" height="45" fill="#3a2a22" />
      <rect x="585" y="955" width="10" height="45" fill="#3a2a22" />
    </g>
    <Title y={1820} text="GENESIS 22  ·  JOHN 1:29" size={26} color="#8a6a50" op={ramp(t, 60, 80)} />
  </>
);

export const SCENE_MAP: Record<string, React.FC<P>> = {
  hook: Hook, book: BookScene, stars: StarsScene, call: Call, journey: Journey, lamb: LambQ, altar: AltarScene,
  ram: RamScene, idols: Idols, generations: Generations, jireh: Jireh, miss: Miss, centuries: Centuries,
  cross: CrossScene, end: End,
};
