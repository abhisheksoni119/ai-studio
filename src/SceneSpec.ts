// SceneSpec.ts — the contract between analyse.mjs and the renderer.
//
// analyse.mjs reads a script and emits one SceneSpec per window into
// src/story-timeline.ts. Composer.tsx renders any spec. Nothing in between
// knows about specific Bible stories, so a new story needs no new code.
//
// Positions on the ground use `depth` (0 = far horizon, 1 = foreground) rather
// than pixel y. The renderer converts depth into both a y position and a scale,
// so anything standing on the plane sits correctly and shrinks with distance
// without the analyser having to know the geometry.
//
// Everything here must be JSON-serialisable: analyse.mjs writes these as
// object literals into generated TypeScript.

import type {PaletteName, StructKind, PropKind, Pose, Build, AnimalKind} from './Atoms';

/** Where on the ground, and how far back. */
export type Spot = {
  /** -1 (left edge) to 1 (right edge); 0 is centre. */
  across: number;
  /** 0 = at the horizon, 1 = at the viewer. */
  depth: number;
  /** Extra scale on top of the depth scaling. */
  s?: number;
};

export type StructureSpec = Spot & {
  kind: StructKind;
  /** 0..1 progress for structures that open (tomb stone, gate). */
  open?: number;
  lit?: boolean;
};

export type CastSpec = Spot & {
  kind: 'figure' | 'crowd' | 'angel' | 'animal';
  pose?: Pose;
  build?: Build;
  flip?: boolean;
  /** crowd only */
  n?: number;
  spread?: number;
  /** animal only */
  animal?: AnimalKind;
  prop?: PropKind;
  /**
   * Draw this person lit — skin, cloth and a shaded side — instead of as a flat
   * silhouette. Reserved for the subject; crowds stay silhouetted.
   */
  lit?: boolean;
  /** Stable appearance key, derived from the STORY so it is the same person throughout. */
  look?: string;
  /** Walk across the scene: fraction of frame width travelled over the shot. */
  travel?: number;
};

export type FreePropSpec = Spot & {
  kind: PropKind;
  /** Float it above the ground as a symbol rather than resting it on the plane. */
  hero?: boolean;
  bright?: boolean;
};

export type WeatherSpec = {
  kind: 'rain' | 'snow' | 'dust' | 'mist' | 'none';
  n?: number;
  opacity?: number;
};

export type FxSpec =
  | {kind: 'motes'; n?: number; across?: number}
  | {kind: 'bubbles'; n?: number}
  | {kind: 'birds'; n?: number; y?: number}
  | {kind: 'smoke'; across: number; depth: number; n?: number}
  | {kind: 'fire'; across: number; depth: number; s?: number}
  | {kind: 'ripples'; depth: number}
  | {kind: 'pillar'; across: number; depth: number};

export type CameraMove = 'none' | 'push' | 'pull' | 'driftL' | 'driftR' | 'rise';

/** The dark pill at the foot of the frame. */
export type ScriptureTag = {
  /** Written form, e.g. "GENESIS 3:8". */
  ref: string;
  /** Optional short phrase after a separator, e.g. "THE COOL OF THE DAY". */
  phrase?: string;
};

export type SceneSpec = {
  /** Human-readable label. Logging and debugging only — never affects rendering. */
  id: string;
  s: number;
  e: number;
  palette: PaletteName;
  /** Varies generated shapes per scene and per story. */
  seed: string;

  /**
   * Generated artwork for this scene, as a filename under public/scenes/.
   * When present the image IS the scene and the vector layers are skipped.
   * When absent — no generator configured, or that one image failed — the
   * scene falls back to vector art, so a video is never left with a hole.
   */
  image?: string;
  /** Ken Burns variant for the image. */
  move?: 'inL' | 'inR' | 'inC' | 'outC' | 'panL' | 'panR';

  /** Where the ground plane begins. Lower number = higher horizon = more ground. */
  horizon?: number;
  /** Plane perspective, 0 (shallow) to 1 (steep). */
  skew?: number;
  /** Faint depth rows across the plane. */
  rows?: boolean;
  /** How much tuft/pebble detail to scatter across the ground. */
  scatter?: number;

  /** Diagonal light shaft — the reference lighting device. */
  shaft?: {across: number; width: number; tilt: number; opacity?: number};
  /** Stars, for night palettes only. */
  stars?: number;
  /** Distant silhouetted hills behind the plane. */
  ridge?: {amp: number; y: number};

  structures?: StructureSpec[];
  cast?: CastSpec[];
  props?: FreePropSpec[];
  weather?: WeatherSpec;
  fx?: FxSpec[];

  scripture?: ScriptureTag;

  camera?: CameraMove;
  /** Lower third is light, so captions must switch to dark ink. */
  lightGround?: boolean;
};
