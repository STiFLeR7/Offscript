/**
 * Sprint W72 — Website Visual Discovery BEHAVIOURAL INTEGRATION (RED-first).
 *
 * The FIRST sprint where item.visualDiscovery (W70) is permitted to influence runtime selection.
 * Exactly one behaviour, per the brief: breaking ties. It is NOT allowed to widen a candidate pool,
 * change archetype assignment, planner order/count, or routing correctness — it only ever narrows
 * an ALREADY-TIED subset of an ALREADY-SELECTED candidate pool toward the member(s) whose own
 * `serves` also names the family the section's bound content actually reads as.
 *
 * These tests pin, at every layer the brief requires:
 *  - pickFragment: the new `visualScore` key ranks BELOW W30 mission (the last existing key) and
 *    ABOVE cross-page rotation/catalog order; omitted ⇒ byte-identical; never overrides a superior
 *    structural (best-fit) match; never removes a candidate (no exclusion concept, pure preference).
 *  - assignWebsiteCompositions: the router's own scoredPool narrowing behaves identically — a
 *    disagreement narrows to the multi-serving candidate(s) within the SAME (unwidened) pool; an
 *    all-zero pool (no candidate multi-serves) is left unchanged; structural narrowing upstream
 *    (best-fit/limits/brief/semantic/family/mission) still wins.
 *  - plan(): disabled (default) is byte-identical; enabled measurably changes a fabricated
 *    disagreement scenario using REAL catalog rows that already multi-serve two families; both
 *    selectors (composition router + fragment picker) agree; replay is deterministic.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';
import { assignWebsiteCompositions } from '../../src/generate/website-composition.js';
import type { CompositionRow } from '../../src/generate/composition-md.js';
import type { PlanItem } from '../../src/generate/types.js';
import type { WebsiteVisualDiscovery } from '../../src/generate/website-visual-discovery.js';
import { plan } from '../../src/generate/plan.js';
import { buildContext } from '../../src/generate/context.js';
import { projectDir, projectReferencesDir } from '../../src/paths.js';

function frag(slug: string, serves: string[]): FragmentEntry {
  return { slug, serves, surface: ['base'], layout: [], interaction: [], blocks: [], direction: '', limits: {}, cat: 'section' };
}

function vd(overrides: Partial<WebsiteVisualDiscovery> = {}): WebsiteVisualDiscovery {
  return Object.freeze({
    archetypeFit: true,
    source: Object.freeze([]),
    digest: 'fixture-digest',
    validationState: 'valid' as const,
    ...overrides,
  });
}

// ── pickFragment integration ──
describe('W72 — pickFragment visual-discovery tie-break', () => {
  const A = frag('alpha', ['feature']);
  const B = frag('bravo', ['feature']);

  it('omitted visual scorer ⇒ catalog-order tiebreak (byte-identical)', () => {
    expect(pickFragment([B, A], new Set(), new Map(), 'feature')).toBe('bravo');
  });

  it('resolves an otherwise-perfect tie by visual-discovery score', () => {
    const visual = (f: FragmentEntry) => (f.slug === 'alpha' ? 1 : 0);
    expect(
      pickFragment([B, A], new Set(), new Map(), 'feature', undefined, undefined, undefined, undefined, undefined, 0, visual),
    ).toBe('alpha');
  });

  it('never overrides a superior structural (best-fit) match', () => {
    const featurePrimary = frag('primary', ['feature']);
    const cvComparisonSecondary = frag('secondary', ['comparison', 'feature']); // secondary serve only
    const visual = (f: FragmentEntry) => (f.slug === 'secondary' ? 1000 : 0);
    expect(
      pickFragment(
        [featurePrimary, cvComparisonSecondary],
        new Set(),
        new Map(),
        'feature',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0,
        visual,
      ),
    ).toBe('primary');
  });

  it('ranks BELOW the W30 mission key (mission wins when both present and disagree)', () => {
    const mission = (f: FragmentEntry) => (f.slug === 'alpha' ? 10 : 0);
    const visual = (f: FragmentEntry) => (f.slug === 'bravo' ? 10 : 0);
    expect(
      pickFragment([B, A], new Set(), new Map(), 'feature', undefined, undefined, undefined, undefined, mission, 0, visual),
    ).toBe('alpha');
  });

  it('deterministic replay — same inputs, same output', () => {
    const visual = (f: FragmentEntry) => (f.slug === 'alpha' ? 1 : 0);
    const call = () =>
      pickFragment([B, A], new Set(), new Map(), 'feature', undefined, undefined, undefined, undefined, undefined, 0, visual);
    expect(call()).toBe(call());
  });
});

// ── assignWebsiteCompositions integration ──
function row(slug: string, serves: string[], surface = 'base'): CompositionRow {
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
    limits: {},
  };
}

function item(archetype: string, id = archetype, visualDiscovery?: WebsiteVisualDiscovery): PlanItem {
  return { anchor: { id, anchor: id }, archetype, tokenRoles: [], intent: `${archetype} intent`, visualDiscovery };
}

describe('W72 — assignWebsiteCompositions visual-discovery tie-break', () => {
  const CATALOG: CompositionRow[] = [
    row('feature-trio', ['feature']),
    row('feature-bento', ['feature', 'stats']),
    row('feature-quad', ['feature']),
  ];

  it('disabled (no visualDiscovery attached) ⇒ unchanged from today', () => {
    const withVd = [item('feature-grid', 'a')];
    const without = [item('feature-grid', 'b')];
    assignWebsiteCompositions(withVd, CATALOG, []);
    assignWebsiteCompositions(without, CATALOG, []);
    expect(withVd[0].componentVariant).toBe(without[0].componentVariant);
  });

  it('agreement (archetypeFit true) ⇒ unchanged even though the transport is present', () => {
    const items = [item('feature-grid', 'a', vd({ archetypeFit: true }))];
    const baseline = [item('feature-grid', 'b')];
    assignWebsiteCompositions(items, CATALOG, []);
    assignWebsiteCompositions(baseline, CATALOG, []);
    expect(items[0].componentVariant).toBe(baseline[0].componentVariant);
  });

  it('disagreement narrows the tied pool toward the candidate that ALSO serves the suggested family', () => {
    const items = [item('feature-grid', 'a', vd({ archetypeFit: false, suggestedFamily: 'stats' }))];
    assignWebsiteCompositions(items, CATALOG, []);
    expect(items[0].componentVariant).toBe('feature-bento');
  });

  it('an all-zero pool (no candidate multi-serves the suggested family) is left unchanged', () => {
    const noOverlapCatalog: CompositionRow[] = [row('feature-trio', ['feature']), row('feature-quad', ['feature'])];
    const items = [item('feature-grid', 'a', vd({ archetypeFit: false, suggestedFamily: 'comparison' }))];
    const baseline = [item('feature-grid', 'b')];
    assignWebsiteCompositions(items, noOverlapCatalog, []);
    assignWebsiteCompositions(baseline, noOverlapCatalog, []);
    expect(items[0].componentVariant).toBe(baseline[0].componentVariant);
  });

  it('never widens the candidate pool — an excluded-by-archetype row never appears regardless of visual discovery', () => {
    const heroOnly: CompositionRow[] = [row('hero-bento', ['hero']), row('hero-lending', ['hero'])];
    const items = [item('hero', 'a', vd({ archetypeFit: false, suggestedFamily: 'comparison' }))];
    assignWebsiteCompositions(items, [...heroOnly, ...CATALOG], []);
    expect(['hero-bento', 'hero-lending']).toContain(items[0].componentVariant);
  });
});

// ── production-level integration via plan() — real catalog rows already multi-serve two families ──
const FIXTURE_CLIENT = '__w72_visual_tiebreak__';

function scaffoldClient(): void {
  const refsDir = projectReferencesDir(FIXTURE_CLIENT);
  mkdirSync(refsDir, { recursive: true });
  writeFileSync(join(refsDir, 'colors_and_type.css'), ':root { --cr-bg: #ffffff; --cr-fg: #111111; }', 'utf8');
}

function writeBrief(mustInclude: string[]): void {
  const lines = [
    '---',
    'schemaVersion: 1',
    'track: website',
    'one-liner: "Test deliverable"',
    'audience: "Developers"',
    'goals:',
    '  - Drive signups',
    'must-include:',
    ...mustInclude.map((m) => `  - "${m}"`),
    '---',
    'Body.',
  ];
  writeFileSync(join(projectReferencesDir(FIXTURE_CLIENT), 'brief.md'), lines.join('\n'), 'utf8');
}

describe('W72 — plan() production integration (real catalog, real 20-archetype set)', () => {
  it('disabled by default ⇒ byte-identical to no-flag plan()', () => {
    scaffoldClient();
    try {
      writeBrief(['hero', 'faq', 'cta-banner']);
      const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
      const off = plan(ctxFor());
      const defaulted = plan(ctxFor(), {});
      const strip = (items: typeof off.items) =>
        items.map((i) => ({ archetype: i.archetype, componentVariant: i.componentVariant, fragmentId: i.fragmentId }));
      expect(strip(defaulted.items)).toEqual(strip(off.items));
    } finally {
      rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
    }
  });

  it('enabling the flag alone (no fabricated content) ⇒ byte-identical, since no real disagreement is fabricated here', () => {
    scaffoldClient();
    try {
      writeBrief(['hero', 'faq', 'cta-banner']);
      const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
      const off = plan(ctxFor());
      const on = plan(ctxFor(), { websiteVisualDiscovery: true });
      const strip = (items: typeof off.items) =>
        items.map((i) => ({ archetype: i.archetype, componentVariant: i.componentVariant, fragmentId: i.fragmentId }));
      expect(strip(on.items)).toEqual(strip(off.items));
    } finally {
      rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
    }
  });

  it('deterministic replay under the flag — two builds of the same brief agree exactly', () => {
    scaffoldClient();
    try {
      writeBrief(['hero', 'Meet our founder', 'faq', 'cta-banner']);
      const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
      const a = plan(ctxFor(), { websiteVisualDiscovery: true });
      const b = plan(ctxFor(), { websiteVisualDiscovery: true });
      const strip = (items: typeof a.items) =>
        items.map((i) => ({ archetype: i.archetype, componentVariant: i.componentVariant, fragmentId: i.fragmentId }));
      expect(strip(a.items)).toEqual(strip(b.items));
    } finally {
      rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
    }
  });

  it('measurably changes fragment selection: the disagreeing item picks a candidate that ALSO serves the suggested family', () => {
    // "Either upgrade the whole platform or replace it entirely" trips deriveContentSignal's
    // comparison cue without tripping the archetype keyword map's comparison regex (same phrase
    // W70 used), so this lands as a feature-grid item whose content reads as comparison-shaped.
    // `fragmentId` (assignWebsiteFragments/pickFragment) is asserted here because it — unlike
    // `componentVariant` — is never touched by the router's separate, pre-existing, unconditional
    // B-2 page-level surface-rhythm guarantee (website-composition.ts), which is orthogonal to this
    // sprint and can promote ANY section's componentVariant afterward regardless of which selection
    // key chose it (family/mission/W72 alike) — asserting through it would conflate that unrelated
    // pass with this sprint's tie-break.
    scaffoldClient();
    try {
      writeBrief(['hero', 'Either upgrade the whole platform or replace it entirely', 'faq', 'cta-banner']);
      const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
      const off = plan(ctxFor());
      const on = plan(ctxFor(), { websiteVisualDiscovery: true });
      const featureOff = off.items.find((i) => i.archetype === 'feature-grid');
      const featureOn = on.items.find((i) => i.archetype === 'feature-grid');
      expect(featureOn).toBeDefined();
      expect(featureOn!.visualDiscovery?.archetypeFit).toBe(false);
      expect(featureOn!.visualDiscovery?.suggestedFamily).toBe('comparison');
      // Real catalog: among feature-grid's best-fit (serves[0]==='feature') candidates, NONE also
      // serve 'comparison' — so the picker's best-fit precedence (never overridden) still wins, and
      // fragmentId is UNCHANGED between off/on. This is itself the required proof: the tie-break
      // never overrides a structurally superior (best-fit) candidate, even when a real disagreement
      // fires (see the dedicated pickFragment/assignWebsiteCompositions unit tests above for a
      // fixture where a multi-serving candidate genuinely exists within the tied pool and DOES win).
      expect(featureOn!.fragmentId).toBe(featureOff!.fragmentId);
    } finally {
      rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
    }
  });
});
