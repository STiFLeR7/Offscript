import type { TokenModel } from './tokens.js';
import type { BrandContract } from './operator.js';
import { resolveSlot } from './brand-contract.js';
import { parseHex, type Rgb } from './color.js';

/**
 * BrandPosture — the per-bundle "designer brain" parameters that bound the
 * brand-VARIANT operators. Derived from the brand-kit (+ optional
 * creative-direction); never a baked constant. Invariant hygiene (contrast,
 * semantics, token-traceability) ignores posture entirely.
 *
 * Spec: docs/superpowers/specs/2026-05-29-offscript-m3-governed-actuator-design.md §4.
 */
export interface BrandPosture {
  /** HSL-saturation cap = the brand's OWN max accent chroma + headroom (0..1). */
  saturationCeiling: number;
  /** fraction of foreground inkings allowed to be accent (0..1). */
  accentUsageBudget: number;
  /** layout density expectation. */
  densityBudget: 'airy' | 'balanced' | 'dense';
  /** motion personality. */
  motionPersonality: 'restrained' | 'balanced' | 'energetic';
  /** SECTION_INTELLIGENCE §1.2 voice axes, each -1..1. */
  axes: {
    roundedAngular: number;
    denseAiry: number;
    editorialUtilitarian: number;
    warmCool: number;
    ornateMinimal: number;
  };
  /** how many distinct accents the brand declares (≥1). */
  allowedAccentCount: number;
  confidence: 'human' | 'auto' | 'hybrid';
}

const DEFAULT_CEILING = 0.7;
const HEADROOM = 0.08;
const DEFAULT_AXES: BrandPosture['axes'] = {
  roundedAngular: 0,
  denseAiry: 0,
  editorialUtilitarian: 0,
  warmCool: 0,
  ornateMinimal: 0,
};

export interface DerivePostureInput {
  tokens: TokenModel;
  brandContract?: BrandContract;
  /** verbatim contents of `<kitDir>/creative-direction.md` if present. */
  creativeDirection?: string;
}

/** HSL saturation (0..1) of a hex colour; 0 if unparseable. */
function saturationOf(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return hslSaturation(rgb);
}

function hslSaturation(c: Rgb): number {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

const DENSITY_VALUES = new Set(['airy', 'balanced', 'dense']);
const MOTION_VALUES = new Set(['restrained', 'balanced', 'energetic']);

/** Parse `key: value` directives from creative-direction.md (line-oriented, case-insensitive keys). */
function parseDirectives(text: string): { density?: BrandPosture['densityBudget']; motion?: BrandPosture['motionPersonality'] } {
  const out: { density?: BrandPosture['densityBudget']; motion?: BrandPosture['motionPersonality'] } = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(density|motion)\s*:\s*([a-z]+)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].toLowerCase();
    if (key === 'density' && DENSITY_VALUES.has(val)) out.density = val as BrandPosture['densityBudget'];
    if (key === 'motion' && MOTION_VALUES.has(val)) out.motion = val as BrandPosture['motionPersonality'];
  }
  return out;
}

export function deriveBrandPosture(input: DerivePostureInput): BrandPosture {
  const { tokens, brandContract } = input;
  const props = tokens.customProps;

  const accentValues: string[] = [];
  for (const slot of ['--accent', '--accent-2']) {
    const resolved = resolveSlot(brandContract, slot, props);
    if (resolved?.value) accentValues.push(resolved.value);
  }

  const allowedAccentCount = Math.max(1, accentValues.length);

  let saturationCeiling = DEFAULT_CEILING;
  if (accentValues.length > 0) {
    const maxSat = Math.max(...accentValues.map(saturationOf));
    saturationCeiling = clamp01(maxSat + HEADROOM);
  }

  const accentUsageBudget = allowedAccentCount >= 2 ? 0.18 : 0.1;

  const directives = input.creativeDirection ? parseDirectives(input.creativeDirection) : {};

  return {
    saturationCeiling,
    accentUsageBudget,
    densityBudget: directives.density ?? 'balanced',
    motionPersonality: directives.motion ?? 'balanced',
    axes: { ...DEFAULT_AXES },
    allowedAccentCount,
    confidence: brandContract?.decidedBy ?? 'auto',
  };
}
