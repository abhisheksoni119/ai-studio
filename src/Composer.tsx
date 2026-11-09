// Composer.tsx — renders ANY SceneSpec.
//
// There is no per-story scene code. A spec describing Joseph's pit and a spec
// describing John's throne room go through this same function.
//
// The look follows the reference reels: a FLAT backdrop, a ground plane that
// recedes, one diagonal shaft of light, and a limited monochromatic palette per
// scene. No sky gradient and no sun disc — those made every scene look alike.
//
// Layer order is fixed so depth always reads correctly:
//   backdrop → stars → ridge → plane → rows → shaft
//   → structures / cast / props (all sorted far-to-near)
//   → weather → fx
//
// Robustness, because specs are generated rather than hand-written:
//   - an unknown kind is skipped, never thrown on
//   - every numeric input is coerced finite before it reaches SVG or interpolate
//   - all <defs> ids are namespaced by the scene's own uid

import React from 'react';
import {interpolate} from 'remotion';
import {
  PALETTES, Backdrop, Plane, PlaneRows, Scatter, planeAt, Shaft, Stars, Ridge,
  Altar, Throne, Tomb, Well, Boat, Tent, City, Temple, Gate, Cross, Pillar,
  Ladder, Prison, House, Table, Tree, Signpost, Campfire, Wall, StoneBlock, IsoBox,
  Person, Crowd, Angel, Animal, Prop,
  Rain, Snow, Dust, Mist, Motes, Bubbles, Birds, Smoke, Ripples,
  mix, shade, W, H,
} from './Atoms';
import type {SceneSpec, StructureSpec, CastSpec, FxSpec, Spot} from './SceneSpec';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Coerce anything that reached us from a generated spec into a usable number. */
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Linear ramp that cannot be handed a zero-width or non-finite input range. */
const ramp = (t: number, dur: number, from: number, to: number) =>
  interpolate(num(t), [0, Math.max(1, num(dur, 1))], [from, to], clamp);

const DEFAULT_HORIZON = 980;

/**
 * Place a spot on the ground plane. `across` is -1..1 and spreads wider as it
 * comes forward, which is what sells the perspective — a figure at the horizon
 * occupies a narrow band, one in the foreground can sit near the frame edge.
 */
function place(spot: Spot, horizon: number) {
  const depth = Math.min(1, Math.max(0, num(spot.depth, 0.6)));
  const {y, scale} = planeAt(horizon, depth);
  const spread = 180 + depth * 520;
  const x = W / 2 + Math.max(-1, Math.min(1, num(spot.across, 0))) * spread;
  return {x, y, scale: scale * Math.max(0.05, num(spot.s, 1)), depth};
}

export const Composer: React.FC<{spec: SceneSpec; t: number; dur: number; uid: string}> = ({spec, t, dur, uid}) => {
  const p = PALETTES[spec.palette] ?? PALETTES.olive;
  const seed = spec.seed || spec.id || uid;
  const horizon = num(spec.horizon, DEFAULT_HORIZON);

  // ── Camera ────────────────────────────────────────────────────────────────
  let cam: string;
  switch (spec.camera) {
    case 'push':   cam = `translate(${W / 2},${H / 2}) scale(${ramp(t, dur, 1, 1.1)}) translate(${-W / 2},${-H / 2})`; break;
    case 'pull':   cam = `translate(${W / 2},${H / 2}) scale(${ramp(t, dur, 1.1, 1)}) translate(${-W / 2},${-H / 2})`; break;
    case 'driftL': cam = `translate(${ramp(t, dur, 40, -40)},0) scale(1.07)`; break;
    case 'driftR': cam = `translate(${ramp(t, dur, -40, 40)},0) scale(1.07)`; break;
    case 'rise':   cam = `translate(0,${ramp(t, dur, 44, -44)}) scale(1.07)`; break;
    default:       cam = `translate(${W / 2},${H / 2}) scale(${ramp(t, dur, 1, 1.05)}) translate(${-W / 2},${-H / 2})`;
  }

  // Everything that stands on the ground is painted back to front together, so
  // a figure in front of a structure actually occludes it.
  const standing: {depth: number; node: React.ReactNode}[] = [];

  (spec.structures ?? []).forEach((st, i) => {
    const node = renderStructure(st, i, horizon, seed, t, p, uid);
    if (node) standing.push({depth: num(st.depth, 0.6), node});
  });
  (spec.cast ?? []).forEach((c, i) => {
    const node = renderCast(c, i, horizon, t, dur, p);
    if (node) standing.push({depth: num(c.depth, 0.6), node});
  });
  (spec.props ?? []).forEach((pr, i) => {
    const node = renderProp(pr, i, horizon, t, p);
    if (node) standing.push({depth: pr.hero ? 1.5 : num(pr.depth, 0.6), node});
  });
  standing.sort((a, b) => a.depth - b.depth);

  return (
    <g transform={cam}>
      {/* ── Flat backdrop ─────────────────────────────────────────────────── */}
      <Backdrop fill={p.sky} />

      {num(spec.stars) > 0 && (
        <Stars t={t} n={Math.round(num(spec.stars))} seed={`${seed}st`} maxY={horizon} opacity={0.75} />
      )}

      {spec.ridge && (
        <Ridge seed={`${seed}rg`} y={num(spec.ridge.y, horizon - 40)} amp={Math.max(10, num(spec.ridge.amp, 120))}
          fill={shade(p.sky, 0.28)} rough={0.45} />
      )}

      {/* ── Ground plane ──────────────────────────────────────────────────── */}
      <Plane horizon={horizon} fill={p.base} edge={shade(p.base, 0.3)} skew={num(spec.skew, 0.4)} />
      {spec.rows !== false && <PlaneRows horizon={horizon} color={p.deep} n={7} opacity={0.12} />}
      {/* ground texture — an untextured plane looks unfinished */}
      <Scatter seed={`${seed}sc`} horizon={horizon} n={num(spec.scatter, 18)} color={shade(p.deep, 0.2)} />

      {/* ── One diagonal shaft of light ───────────────────────────────────── */}
      {spec.shaft && (
        <Shaft u={uid} x={W / 2 + Math.max(-1, Math.min(1, num(spec.shaft.across, 0))) * 420}
          width={Math.max(40, num(spec.shaft.width, 170))} tilt={num(spec.shaft.tilt, 90)}
          color={p.accent} opacity={num(spec.shaft.opacity, 0.22)} />
      )}

      {/* ── Everything standing on the ground, far to near ────────────────── */}
      {standing.map((item, i) => <g key={`g${i}`}>{item.node}</g>)}

      {/* ── Weather and effects ───────────────────────────────────────────── */}
      {renderWeather(spec, seed, t, p)}
      {(spec.fx ?? []).map((fx, i) => renderFx(fx, i, horizon, seed, t, p))}
    </g>
  );
};

// ─── Layer renderers ──────────────────────────────────────────────────────────

function renderStructure(
  st: StructureSpec, i: number, horizon: number, seed: string, t: number,
  p: typeof PALETTES[keyof typeof PALETTES], uid: string,
) {
  const {x, y, scale} = place(st, horizon);
  const key = `s${i}`;
  const ink = p.ink;
  const stone = mix(p.light, p.base, 0.4);
  const open = Math.min(1, Math.max(0, num(st.open, 0)));

  switch (st.kind) {
    case 'altar':    return <Altar key={key} x={x} y={y} s={scale} fill={ink} wood={shade(p.accent, 0.45)} />;
    case 'throne':   return <Throne key={key} x={x} y={y} s={scale * 0.8} fill={ink} light={p.accent} u={`${uid}t${i}`} />;
    case 'tomb':     return <Tomb key={key} x={x} y={y} s={scale * 0.8} rock={p.deep} dark={p.ink} light={p.accent} open={open} stone={stone} />;
    case 'well':     return <Well key={key} x={x} y={y} s={scale} fill={ink} dark={shade(p.ink, -0.2)} />;
    case 'boat':     return <Boat key={key} x={x} y={y} s={scale} fill={ink} sail={st.lit ? p.light : undefined} tilt={Math.sin(t / 22) * 4} />;
    case 'tent':     return <Tent key={key} x={x} y={y} s={scale} fill={ink} dark={shade(p.ink, -0.25)} />;
    case 'city':     return <City key={key} seed={`${seed}ct`} x={x} y={y} s={scale} fill={ink} lit={st.lit ? p.accent : undefined} />;
    case 'temple':   return <Temple key={key} x={x} y={y} s={scale} fill={ink} dark={shade(p.ink, -0.2)} />;
    case 'gate':     return <Gate key={key} x={x} y={y} s={scale} fill={ink} glow={p.accent} open={open} />;
    case 'cross':    return <Cross key={key} x={x} y={y} s={scale} fill={ink} />;
    case 'ladder':   return <Ladder key={key} x={x} y={y} s={scale} fill={ink} />;
    case 'prison':   return <Prison key={key} x={x} y={y} s={scale} fill={ink} />;
    case 'house':    return <House key={key} x={x} y={y} s={scale} fill={ink} lit={st.lit ? p.accent : undefined} t={t} />;
    case 'tree':     return <Tree key={key} t={t} seed={`${seed}tr${i}`} x={x} y={y} s={scale} fill={shade(p.deep, 0.15)} bare={st.lit === false} />;
    case 'signpost': return <Signpost key={key} x={x} y={y} s={scale} fill={ink} />;
    case 'campfire': return <Campfire key={key} t={t} x={x} y={y} s={scale} wood={shade(p.accent, 0.5)} hot={p.accent} cool={p.light} />;
    case 'wall':     return <Wall key={key} seed={`${seed}wl`} x={x} y={y} s={scale} fill={ink} />;
    case 'stone':    return <StoneBlock key={key} x={x} y={y} s={scale} fill={stone} />;
    case 'pillar':   return <Pillar key={key} t={t} x={x} y={y} hot={p.accent} cool={p.light} />;
    case 'table':
      // A table reads far better as an isometric box on the plane than as a
      // flat side-on shape, which is the whole point of the ground plane.
      return (
        <IsoBox key={key} x={x} y={y} w={190 * scale} d={54 * scale} h={118 * scale}
          top={p.light} left={p.deep} right={shade(p.base, 0.12)} />
      );
    default: return null;
  }
}

function renderCast(
  c: CastSpec, i: number, horizon: number, t: number, dur: number,
  p: typeof PALETTES[keyof typeof PALETTES],
) {
  const {x, y, scale} = place(c, horizon);
  const key = `c${i}`;
  const travel = num(c.travel, 0);
  const px = x + (travel ? ramp(t, dur, 0, travel * W) : 0);

  switch (c.kind) {
    case 'crowd':
      return <Crowd key={key} seed={`cr${i}`} t={t} x={px} y={y} n={Math.max(1, Math.round(num(c.n, 5)))}
        s={scale * 0.9} fill={p.ink} spread={Math.max(80, num(c.spread, 520))} pose={c.pose ?? 'stand'} />;
    case 'angel':
      return <Angel key={key} t={t} x={px} y={y - 320 * scale} s={scale} fill={p.accent}
        glowColor={mix(p.accent, '#ffffff', 0.5)} />;
    case 'animal':
      return <Animal key={key} kind={c.animal ?? 'sheep'} x={px} y={y} s={scale} fill={p.ink} t={t} flip={c.flip === true} />;
    case 'figure':
    default:
      return <Person key={key} x={px} y={y} s={scale} ink={p.ink} light={p.accent}
        build={c.build ?? 'man'} pose={c.pose ?? 'stand'} flip={c.flip === true}
        t={t} prop={c.prop} lit={c.lit === true} seed={c.look ?? `${key}${c.build ?? ''}`} />;
  }
}

function renderProp(
  pr: import('./SceneSpec').FreePropSpec, i: number, horizon: number, t: number,
  p: typeof PALETTES[keyof typeof PALETTES],
) {
  const key = `p${i}`;
  if (pr.hero) {
    // A symbol, held in the upper frame rather than resting on the ground.
    const x = W / 2 + Math.max(-1, Math.min(1, num(pr.across, 0))) * 280;
    return <Prop key={key} kind={pr.kind} x={x} y={620} s={Math.max(0.1, num(pr.s, 1.1))}
      fill={pr.bright ? p.accent : p.ink} accent={p.light} t={t} />;
  }
  const {x, y, scale} = place(pr, horizon);
  return <Prop key={key} kind={pr.kind} x={x} y={y} s={scale * 0.6} fill={pr.bright ? p.accent : p.ink}
    accent={p.light} t={t} />;
}

function renderWeather(spec: SceneSpec, seed: string, t: number, p: typeof PALETTES[keyof typeof PALETTES]) {
  const w = spec.weather;
  if (!w || w.kind === 'none') return null;
  const n = Math.max(0, Math.round(num(w.n, 90)));
  const op = num(w.opacity, 0.4);
  switch (w.kind) {
    case 'rain': return <Rain t={t} seed={`${seed}rn`} n={n} color={mix(p.light, '#ffffff', 0.4)} opacity={op} />;
    case 'snow': return <Snow t={t} seed={`${seed}sn`} n={n} opacity={op} />;
    case 'dust': return <Dust t={t} seed={`${seed}ds`} n={Math.min(n, 20)} color={p.light} opacity={op} y={num(spec.horizon, DEFAULT_HORIZON) + 260} />;
    case 'mist': return <Mist t={t} seed={`${seed}ms`} n={Math.min(n, 14)} color={p.light} opacity={op} y={num(spec.horizon, DEFAULT_HORIZON) - 60} />;
    default: return null;
  }
}

function renderFx(
  fx: FxSpec, i: number, horizon: number, seed: string, t: number,
  p: typeof PALETTES[keyof typeof PALETTES],
) {
  const key = `f${i}`;
  const spotX = (across: number) => W / 2 + Math.max(-1, Math.min(1, num(across, 0))) * 420;

  switch (fx.kind) {
    case 'motes':
      return <Motes key={key} t={t} seed={`${seed}mo${i}`} n={Math.max(1, Math.round(num(fx.n, 22)))}
        color={p.accent} x={spotX(num(fx.across, 0))} spread={460} from={H - 120} rise={760} />;
    case 'bubbles':
      return <Bubbles key={key} t={t} seed={`${seed}bu${i}`} n={Math.max(1, Math.round(num(fx.n, 22)))} color={p.light} />;
    case 'birds':
      return <Birds key={key} t={t} seed={`${seed}bd${i}`} n={Math.max(1, Math.round(num(fx.n, 5)))}
        color={shade(p.sky, 0.45)} y={num(fx.y, horizon - 320)} />;
    case 'smoke': {
      const {x, y} = place({across: num(fx.across, 0), depth: num(fx.depth, 0.5)}, horizon);
      return <Smoke key={key} t={t} seed={`${seed}sm${i}`} x={x} y={y} n={Math.max(1, Math.round(num(fx.n, 16)))}
        color={p.light} rise={560} />;
    }
    case 'fire': {
      const {x, y, scale} = place({across: num(fx.across, 0), depth: num(fx.depth, 0.6), s: num(fx.s, 1)}, horizon);
      return <Campfire key={key} t={t} x={x} y={y} s={scale} wood={shade(p.accent, 0.5)} hot={p.accent} cool={p.light} />;
    }
    case 'ripples': {
      const {y} = place({across: 0, depth: num(fx.depth, 0.7)}, horizon);
      return <Ripples key={key} t={t} y={y} color={p.light} />;
    }
    case 'pillar': {
      const {x, y} = place({across: num(fx.across, 0), depth: num(fx.depth, 0.5)}, horizon);
      return <Pillar key={key} t={t} x={x} y={y} hot={p.accent} cool={p.light} />;
    }
    default: return null;
  }
}
