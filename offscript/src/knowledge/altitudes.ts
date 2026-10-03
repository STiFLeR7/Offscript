/**
 * PKG-2 — Canonical Repository Knowledge Layer: the ALTITUDE ownership model.
 *
 * Ratified by the Repository Knowledge Architecture (RKA ADR §3) and EP-1 §3.
 * Knowledge is owned at the altitude at which it is INVARIANT. This module encodes
 * the altitude set, the (downward-only) inheritance direction, and a SOURCE→altitude
 * resolver that assigns ownership by canonical LOCATION — never by enumerating
 * individual repository assets. Adding a new component/variant/font/rulebook is
 * therefore growth-safe: its altitude follows from where it lives, with zero code
 * change here.
 *
 * This layer is STANDALONE and UNCONSUMED by the generate path: it establishes the
 * foundation PKG-3 (projection) will read. It owns ownership + inheritance + their
 * validation only — never planner, projection, author, runtime, scoring, or
 * generation behaviour (those are forbidden surfaces for PKG-2). It mutates nothing.
 */

/**
 * The seven knowledge altitudes, ordered TOP → BOTTOM. Inheritance flows strictly
 * downward along this order (Constitutional is inherited by all; Runtime inherits
 * all above it). The order is the architecture, not repository content — it is
 * fixed and closed by default (RKA Principle: the altitude set is closed; a new
 * altitude is an exceptional, ADR-level act).
 *
 * Y2 (Program Y) added `constitutional`, ranked above `universal` — the exceptional
 * case the RKA Principle anticipates. `universal` is per-TRACK invariant (true
 * across brands for one medium — e.g. PHILOSOPHY.md, PURPOSE.md); it is not
 * cross-track. `brand` is cross-track but value-scoped (colors_and_type.css,
 * voice.md), not intent-scoped. Neither altitude represents content that is
 * invariant across every track AND is intent rather than value — exactly what a
 * medium-independent creative constitution is. `constitutional` is that altitude:
 * inherited downward by every track's own `universal` content, never the reverse.
 */
export const ALTITUDE_ORDER = [
  'constitutional',
  'universal',
  'brand',
  'family',
  'variant',
  'block',
  'runtime',
] as const;

export type Altitude = (typeof ALTITUDE_ORDER)[number];

/** Numeric rank, 0 = highest (universal). Lower rank ⇒ higher altitude ⇒ inherited-from. */
export function altitudeRank(a: Altitude): number {
  return ALTITUDE_ORDER.indexOf(a);
}

/**
 * The altitudes `a` inherits from — every altitude strictly ABOVE it, in
 * top-down order. Inheritance is downward-only: an altitude never inherits from a
 * peer or a lower altitude (no upward inheritance, no cycles — guaranteed by the
 * strict total order).
 */
export function ancestorsOf(a: Altitude): Altitude[] {
  return ALTITUDE_ORDER.slice(0, altitudeRank(a));
}

/**
 * True iff `parent` may be inherited FROM by `child` — i.e. parent is strictly
 * higher in the altitude order. Self and downward relations are rejected, which is
 * the structural guarantee against upward inheritance and cycles.
 */
export function inheritsDownward(child: Altitude, parent: Altitude): boolean {
  return altitudeRank(parent) < altitudeRank(child);
}

/**
 * One ownership rule: a predicate over a normalized (forward-slash) canonical path
 * and the altitude that owns sources matching it. Rules are LOCATION-based (layer),
 * never per-asset — this is what makes ownership growth-safe.
 */
interface OwnershipRule {
  readonly altitude: Altitude;
  readonly match: (p: string) => boolean;
}

const endsWith = (suffix: string) => (p: string) => p.endsWith(suffix);
const contains = (frag: string) => (p: string) => p.includes(frag);
const baseIs = (name: string) => (p: string) => p.endsWith('/' + name) || p === name;

/**
 * The canonical SOURCE→altitude map, by layer/location. Each rule names the home
 * of a kind of knowledge; ownership is assigned by where a fact lives, so the 79th
 * (or 800th) variant added to COMPOSITION.md is Variant-owned automatically.
 *
 * Order is irrelevant to correctness: a source matching two DIFFERENT altitudes is
 * an ambiguity and fails loud (resolveSourceAltitude). Rules that resolve to the
 * SAME altitude may overlap freely.
 */
/**
 * Y2 — the cross-track governance documents ported into design_principles/ per
 * design/shared/DEV-HANDOFF.md. Named explicitly (not a generic "everything at the
 * top of design_principles/" rule) so a future brand-level file dropped beside them
 * doesn't silently inherit the constitutional altitude by accident.
 */
const CONSTITUTIONAL_BASENAMES = ['CREATIVE_DIRECTION.md', 'INHERITED_CREATIVE_CONSTITUTION.md'];
const isConstitutionalDoc = (p: string) => CONSTITUTIONAL_BASENAMES.some((name) => baseIs(name)(p));

const OWNERSHIP_RULES: readonly OwnershipRule[] = [
  // Constitutional — cross-track creative-identity governance (Y2). Must be excluded from the
  // design_principles → brand catch-all below, or every match is ambiguous (two altitudes).
  { altitude: 'constitutional', match: isConstitutionalDoc },
  // Family — the role catalogue.
  { altitude: 'family', match: endsWith('/component-governance/components.md') },
  // Variant — the realized-layout SELECT index.
  { altitude: 'variant', match: endsWith('/component-governance/COMPOSITION.md') },
  // Block — the assembly grammar / molecule library.
  { altitude: 'block', match: endsWith('/component-governance/COMPOSE.md') },
  // Universal — brand-invariant reasoning, rules, and patterns true of everything.
  { altitude: 'universal', match: endsWith('/component-governance/COMPOSITION-REASONING.md') },
  { altitude: 'universal', match: baseIs('PHILOSOPHY.md') },
  { altitude: 'universal', match: baseIs('PURPOSE.md') },
  { altitude: 'universal', match: baseIs('OVERVIEW.md') },
  // Runtime — machine threshold values (read by rails, never semantic knowledge).
  { altitude: 'runtime', match: endsWith('/rulebooks/numerics.md') },
  // Universal — all OTHER rulebooks are rules-by-role (numerics handled above first).
  { altitude: 'universal', match: (p) => p.includes('/rulebooks/') && p.endsWith('.md') && !p.endsWith('/numerics.md') },
  // Brand — per-brand values + voice + the shared reference defaults pack.
  { altitude: 'brand', match: baseIs('colors_and_type.css') },
  { altitude: 'brand', match: baseIs('accent-palette.css') },
  { altitude: 'brand', match: baseIs('voice.md') },
  { altitude: 'brand', match: (p) => contains('/design_principles/')(p) && !isConstitutionalDoc(p) },
];

const norm = (p: string): string => p.replace(/\\/g, '/');

/**
 * Resolve the canonical altitude that OWNS a given source path, or `undefined` if
 * the path is not a canonical-knowledge source (e.g. a font binary, an exemplar
 * image, an asset). Fails loud when a single source matches two DIFFERENT altitudes
 * — an ownership ambiguity the architecture forbids (one altitude per fact).
 */
export function resolveSourceAltitude(path: string): Altitude | undefined {
  const p = norm(path);
  const matched = new Set<Altitude>();
  for (const rule of OWNERSHIP_RULES) {
    if (rule.match(p)) matched.add(rule.altitude);
  }
  if (matched.size > 1) {
    throw new Error(
      `resolveSourceAltitude: ambiguous ownership for "${path}" — matches altitudes ` +
        `{${[...matched].join(', ')}}. A canonical source must belong to exactly one altitude.`,
    );
  }
  return matched.size === 1 ? [...matched][0] : undefined;
}
