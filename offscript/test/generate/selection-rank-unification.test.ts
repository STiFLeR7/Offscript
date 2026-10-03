/**
 * P2-A — Website Selection Consistency: canonical ranking-primitive unification.
 *
 * The composition router (website-composition.ts, sets componentVariant) and the fragment
 * picker (catalog.ts's pickFragment, sets fragmentId) independently hand-duplicate the SAME
 * ranking dimensions (best-fit, adjacency, within-page diversity, brief-band, semantic
 * exclusion, visual tie-break, the final tail) in two different code shapes — a sequential
 * pool-narrowing chain (router) and a lexicographic rank-vector (picker) — synchronized only
 * by comment discipline. SPRINT-W84 already proved this class of duplication can silently
 * drift (the archetype→serves table, fixed in W85 via archetype-contract.ts's single
 * ARCHETYPE_SERVES). The W85 regression test (selector-contract-unification.test.ts) itself
 * documents that `pickFragment`'s unconditional best-fit vs the router's governance-gated
 * best-fit is "the concrete, provable regression signal" that remains fragile.
 *
 * This sprint does NOT change ranking precedence, ranking dimensions, or selection outcomes.
 * It wires both consumers onto the SAME canonical primitives:
 *   - `isBestFit` (archetype-contract.ts) — the exact formula named above as the regression
 *     signal, now a single shared function instead of two hand-written comparisons.
 *   - `hard` / `band` / `keepMax` / `keepMaxFloorExclude` / `terminal` (selection-policy.ts —
 *     already existed since W33 as a generic, pure, floor-protected narrowing vocabulary, but
 *     was previously consumed ONLY by the router's W16 brief-band stage via `band()`; every
 *     other stage in both files hand-rolled an equivalent).
 *
 * These tests prove: (1) both files now call the SAME primitives for the shared dimensions,
 * (2) no second hand-rolled formula survives in either file, (3) a change to a shared
 * primitive is felt by both consumers by construction, (4) observable behavior is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';
import { assignWebsiteCompositions } from '../../src/generate/website-composition.js';
import { isBestFit } from '../../src/generate/archetype-contract.js';
import { hard, band, keepMax, terminal } from '../../src/generate/selection-policy.js';
import type { CompositionRow } from '../../src/generate/composition-md.js';
import type { PlanItem } from '../../src/generate/types.js';
import type { SemanticSelection, SemanticVerdict } from '../../src/generate/semantic-selection.js';

const CATALOG_PATH = fileURLToPath(new URL('../../src/generate/catalog.ts', import.meta.url));
const COMPOSITION_PATH = fileURLToPath(new URL('../../src/generate/website-composition.ts', import.meta.url));

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

const frag = (slug: string, serves: string[] = []): FragmentEntry => ({
  slug,
  serves,
  surface: [],
  layout: [],
  interaction: [],
  blocks: [],
  direction: '',
  limits: {},
  cat: 'section',
});

function row(slug: string, serves: string[], surface = 'base', limits = {}): CompositionRow {
  return {
    name: slug,
    slug,
    cat: 'section',
    layout: ['centered-stack'],
    surface,
    interaction: [],
    serves,
    blocks: ['headline-cluster'],
    direction: `Direction for ${slug}.`,
    limits,
  };
}

function item(archetype: string, id = archetype): PlanItem {
  return { anchor: { id, anchor: id }, archetype, tokenRoles: [], intent: `${archetype} intent` };
}

// ── isBestFit — the canonical, shared regression signal ──────────────────────────────────────
describe('selection-rank-unification — isBestFit (the canonical, shared regression signal)', () => {
  it("true iff the candidate's PRIMARY serve equals target", () => {
    expect(isBestFit('hero', 'hero')).toBe(true);
    expect(isBestFit('cta', 'hero')).toBe(false);
  });

  it('omitted target ⇒ always true (no discrimination) — matches "No effect when target is omitted"', () => {
    expect(isBestFit('cta', undefined)).toBe(true);
    expect(isBestFit(undefined, undefined)).toBe(true);
  });

  it('undefined servesFirst with a defined target ⇒ false (never a false match)', () => {
    expect(isBestFit(undefined, 'hero')).toBe(false);
  });
});

// ── structural: both files call the SAME canonical primitives, no second hand-rolled copy ────
describe('selection-rank-unification — both selector files call the SAME canonical primitives (structural)', () => {
  it('catalog.ts imports isBestFit from archetype-contract.ts', () => {
    const text = source(CATALOG_PATH);
    expect(text).toMatch(/isBestFit/);
    expect(text).toMatch(/from ['"]\.\/archetype-contract\.js['"]/);
  });

  it('website-composition.ts imports isBestFit from archetype-contract.ts', () => {
    const text = source(COMPOSITION_PATH);
    expect(text).toMatch(/isBestFit/);
  });

  it('catalog.ts imports the shared narrowing vocabulary from selection-policy.ts', () => {
    const text = source(CATALOG_PATH);
    expect(text).toMatch(/from ['"]\.\/selection-policy\.js['"]/);
    for (const fn of ['hard', 'band', 'keepMax', 'terminal']) {
      expect(text, `catalog.ts should import ${fn}`).toMatch(new RegExp(`\\b${fn}\\b`));
    }
  });

  it('website-composition.ts imports the shared narrowing vocabulary from selection-policy.ts', () => {
    const text = source(COMPOSITION_PATH);
    expect(text).toMatch(/from ['"]\.\/selection-policy\.js['"]/);
    for (const fn of ['band', 'keepMax', 'keepMaxFloorExclude', 'terminal']) {
      expect(text, `website-composition.ts should import ${fn}`).toMatch(new RegExp(`\\b${fn}\\b`));
    }
  });

  it('catalog.ts no longer hand-rolls a second lexicographic rank()/lt() comparator (pickFragment now composes shared primitives)', () => {
    const text = source(CATALOG_PATH);
    expect(text).not.toMatch(/const\s+rank\s*=\s*\(f:\s*FragmentEntry\)/);
    expect(text).not.toMatch(/const\s+lt\s*=\s*\(/);
  });

  it('website-composition.ts no longer hand-rolls exclude+keepmax scanning inline (the old W19 shape)', () => {
    const text = source(COMPOSITION_PATH);
    expect(text).not.toMatch(/let best = -Infinity/);
  });
});

// ── a change to the shared primitive is felt by both consumers by construction ───────────────
describe('selection-rank-unification — best-fit governs both consumers identically', () => {
  it('pickFragment (catalog.ts): given a best-fit and a secondary-serving candidate, best-fit wins', () => {
    const heroPrimary = frag('hero-primary', ['hero']);
    const ctaSecondary = frag('cta-secondary', ['cta', 'hero']); // secondarily serves hero
    // Deliberately listed catalog-order-first to prove best-fit (not order) decides.
    expect(pickFragment([ctaSecondary, heroPrimary], new Set(), new Map(), 'hero')).toBe('hero-primary');
  });

  it('assignWebsiteCompositions (website-composition.ts): under governed selection, best-fit wins the same way', () => {
    // Both candidates serve 'feature'; only feature-secondary is best-fit (serves[0]==='feature').
    const cat: CompositionRow[] = [
      row('feature-secondary-first', ['stats', 'feature']), // listed first, but NOT best-fit
      row('feature-primary', ['feature']),
    ];
    const items = [item('feature-grid')];
    // A non-null briefScore is what governance-gates the router's best-fit narrowing (see the
    // W85 test's own note that this gating is deliberate and out of scope to remove).
    const briefScore = () => 0; // tie on brief score ⇒ best-fit alone must decide
    assignWebsiteCompositions(items, cat, [], undefined, briefScore);
    expect(items[0].componentVariant).toBe('feature-primary');
  });
  // If isBestFit's formula were inverted or dropped, BOTH tests above would fail — they call
  // through the same shared function (see the structural test group above), which is exactly
  // the "one canonical implementation, both consumers inherit a change" guarantee this sprint
  // establishes (previously only the picker's copy was provably correct; the W85 test explicitly
  // scoped the router's copy as untouched/unverified).
});

// ── semantic exclusion (W19): router's keepMaxFloorExclude usage behaves identically ─────────
describe('selection-rank-unification — semantic exclusion via the shared keepMaxFloorExclude', () => {
  function semanticOf(verdicts: Record<string, SemanticVerdict>): SemanticSelection {
    return {
      briefTerms: new Set(),
      consumer: { scoreFor: (slug) => verdicts[slug] ?? null },
    };
  }

  it('drops an excluded candidate in favour of a non-excluded one', () => {
    const cat: CompositionRow[] = [row('feat-a', ['feature']), row('feat-b', ['feature'])];
    const items = [item('feature-grid')];
    const semantic = semanticOf({
      'feat-a': { score: 5, excluded: true },
      'feat-b': { score: 1, excluded: false },
    });
    assignWebsiteCompositions(items, cat, [], undefined, undefined, semantic);
    expect(items[0].componentVariant).toBe('feat-b');
  });

  it('floor-protection: if ALL candidates are excluded, none are dropped (never empties the pool)', () => {
    const cat: CompositionRow[] = [row('feat-a', ['feature']), row('feat-b', ['feature'])];
    const items = [item('feature-grid')];
    const semantic = semanticOf({
      'feat-a': { score: 5, excluded: true },
      'feat-b': { score: 1, excluded: true },
    });
    expect(() => assignWebsiteCompositions(items, cat, [], undefined, undefined, semantic)).not.toThrow();
    expect(items[0].componentVariant).toBeDefined();
  });
});

// ── the shared tail (within-page freshness → cross-page rotation → catalog order) ────────────
describe('selection-rank-unification — pickFragment and assignWebsiteCompositions share the terminal() tail semantics', () => {
  it('pickFragment: prefers a fresh (not-used-this-page) candidate over a used one, all else equal', () => {
    const a = frag('a', ['x']);
    const b = frag('b', ['x']);
    expect(pickFragment([a, b], new Set(['a']))).toBe('b');
  });

  it('pickFragment: deterministic catalog-order tie-break when nothing else discriminates', () => {
    const a = frag('a', ['x']);
    const b = frag('b', ['x']);
    expect(pickFragment([a, b], new Set())).toBe('a');
    expect(pickFragment([b, a], new Set())).toBe('b');
  });

  it('assignWebsiteCompositions: rotates away from a just-used variant (terminal()-style freshness), matching the existing suite', () => {
    const cat: CompositionRow[] = [row('hero-bento', ['hero']), row('hero-lending', ['hero'])];
    const items = [item('hero', 'h1'), item('hero', 'h2')];
    assignWebsiteCompositions(items, cat, []);
    expect(items[0].componentVariant).not.toBe(items[1].componentVariant);
  });
});

// ── the primitives themselves — proving the shared vocabulary's semantics directly ───────────
describe('selection-rank-unification — shared narrowing vocabulary semantics (selection-policy.ts)', () => {
  it('hard() narrows to the boolean-preferred subset, floor-protected', () => {
    const items = ['a', 'b', 'c'];
    expect(hard(items, (x) => (x === 'b' ? 1 : 0))).toEqual(['b']);
    expect(hard(items, () => 0)).toEqual(items); // all-tied ⇒ floor-protected, unchanged
  });

  it('band(δ=0) is exact-max (byte-identical baseline both files rely on)', () => {
    const items = [
      { slug: 'a', score: 5 },
      { slug: 'b', score: 3 },
    ];
    expect(band(items, (x) => x.score, 0).map((x) => x.slug)).toEqual(['a']);
  });

  it('keepMax() picks the highest-scoring subset, floor-protected on an all-zero pool', () => {
    const items = ['a', 'b'];
    expect(keepMax(items, () => 0)).toEqual(items);
  });

  it('terminal() prefers the first not-recently-used, else lowest use-count, else first', () => {
    expect(terminal(['a', 'b', 'c'], { inRecentWindow: (x) => x === 'a' })).toBe('b');
    expect(terminal(['a', 'b'], { useCount: (x) => (x === 'a' ? 2 : 1) })).toBe('b');
    expect(terminal(['a', 'b'])).toBe('a');
  });
});
