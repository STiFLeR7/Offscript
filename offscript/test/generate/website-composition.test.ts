import { describe, it, expect } from 'vitest';
import { assignWebsiteCompositions, candidatesFor } from '../../src/generate/website-composition.js';
import { resolveGovernedActivation } from '../../src/generate/governed-activation.js';
import { ARCHETYPE_TO_SERVES } from '../../src/generate/catalog.js';
import type { CompositionRow } from '../../src/generate/composition-md.js';
import type { PlanItem } from '../../src/generate/types.js';

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

const CATALOG: CompositionRow[] = [
  row('hero-bento', ['hero']),
  row('hero-lending', ['hero']),
  row('feature-trio', ['feature'], 'base', { maxPerPage: 1 }),
  row('feature-bento', ['feature', 'stats'], 'base', { avoidAdjacent: 'stats' }),
  row('stat-cards', ['stats', 'feature'], 'contrast'),
  row('feature-stack', ['feature'], 'base', { minBands: 5 }),
  row('faq-split', ['faq']),
];

function item(archetype: string, id = archetype): PlanItem {
  return { anchor: { id, anchor: id }, archetype, tokenRoles: [], intent: `${archetype} intent` };
}

describe('assignWebsiteCompositions', () => {
  it('routes an archetype to a serves-matched variant and sets all fields', () => {
    const items = [item('hero')];
    assignWebsiteCompositions(items, CATALOG, []);
    expect(items[0].componentVariant).toMatch(/^hero-/);
    expect(items[0].surfaceRole).toBe('base');
    expect(items[0].composition).toContain('Direction for hero');
    expect(items[0].sectionGuidance).toContain('Chosen variant');
  });

  it('rotates among equals (no immediate repeat when alternatives exist)', () => {
    const items = [item('hero', 'h1'), item('hero', 'h2')];
    assignWebsiteCompositions(items, CATALOG, []);
    expect(items[0].componentVariant).not.toBe(items[1].componentVariant);
  });

  it('respects maxPerPage across the page', () => {
    const items = [item('feature-grid', 'f1'), item('feature-grid', 'f2')];
    assignWebsiteCompositions(items, CATALOG, []);
    const trioCount = items.filter((i) => i.componentVariant === 'feature-trio').length;
    expect(trioCount).toBeLessThanOrEqual(1);
  });

  it('skips a minBands variant on a short page', () => {
    const items = [item('feature-grid')];
    assignWebsiteCompositions(items, CATALOG, []);
    expect(items[0].componentVariant).not.toBe('feature-stack');
  });

  it('warns and leaves fields unset for an archetype with no candidate', () => {
    const warnings: string[] = [];
    const items = [item('founder')];
    assignWebsiteCompositions(items, CATALOG, warnings);
    expect(items[0].componentVariant).toBeUndefined();
    expect(warnings.join(' ')).toContain('founder');
  });

  it('is deterministic (same input → same assignment)', () => {
    const a = [item('hero', 'h1'), item('feature-grid', 'f1'), item('metrics', 'm1')];
    const b = [item('hero', 'h1'), item('feature-grid', 'f1'), item('metrics', 'm1')];
    assignWebsiteCompositions(a, CATALOG, []);
    assignWebsiteCompositions(b, CATALOG, []);
    expect(a.map((i) => i.componentVariant)).toEqual(b.map((i) => i.componentVariant));
  });

  it('respects avoidAdjacent — skips a feature variant that bans a preceding stats band', () => {
    // metrics(→stats) immediately precedes feature(→feature). The feature candidate
    // `feature-bento` carries {avoidAdjacent:'stats'}; `feature-trio` does not. Route both
    // in ONE call so the feature item reads the routed prev's serves.
    const cat: CompositionRow[] = [
      row('stat-only', ['stats']),
      row('feature-bento', ['feature'], 'base', { avoidAdjacent: 'stats' }),
      row('feature-trio', ['feature']),
    ];
    const items = [item('metrics', 'm1'), item('feature-grid', 'f1')];
    assignWebsiteCompositions(items, cat, []);
    expect(items[0].componentVariant).toBe('stat-only');
    expect(items[1].componentVariant).toBe('feature-trio');
    expect(items[1].componentVariant).not.toBe('feature-bento');
  });

  it('handles an empty catalog — no variant slug, A4 skeleton composition, warning pushed, no throw', () => {
    const warnings: string[] = [];
    const items = [item('hero')];
    // No catalog candidate → A4 §B skeleton fallback (real COMPOSE.md via the default param):
    // never stamps a componentVariant, but composes from the skeleton and still warns.
    expect(() => assignWebsiteCompositions(items, [], warnings)).not.toThrow();
    expect(items[0].componentVariant).toBeUndefined();
    expect(items[0].composition).toContain('COMPOSE §B');
    expect(warnings.length).toBeGreaterThan(0);
  });

  // ── W85 — selector contract unification (SPRINT-W84 §3.1 regression) ────────────────────
  // Before W85, this file's private ARCHETYPE_INTENT mapped case-study→testimonials while
  // catalog.ts's ARCHETYPE_TO_SERVES mapped case-study→social-proof: the router and the
  // fragment picker consulted DIFFERENT intents for the same archetype. These tests prove
  // the router now consults the SAME canonical intent the picker uses.
  it('case-study regression: candidatesFor consults the canonical (picker-shared) intent, not a stray copy', () => {
    // A catalog where social-proof-only and testimonials-only candidates are disjoint sets —
    // this catalog shape would have exposed the pre-W85 divergence (router picking from the
    // testimonials-only row, picker's selectCandidates picking from the social-proof-only row).
    const cat: CompositionRow[] = [
      row('proof-only-a', ['social-proof']),
      row('proof-only-b', ['social-proof']),
      row('voice-only-a', ['testimonials']),
      row('voice-only-b', ['testimonials']),
    ];
    const cands = candidatesFor('case-study', cat);
    const canonicalIntent = ARCHETYPE_TO_SERVES['case-study' as keyof typeof ARCHETYPE_TO_SERVES];
    expect(canonicalIntent).toBe('testimonials');
    expect(cands.map((r) => r.slug).sort()).toEqual(['voice-only-a', 'voice-only-b']);
  });

  it('selector parity: for every archetype, candidatesFor consults exactly ARCHETYPE_TO_SERVES[archetype]', () => {
    // General parity guard (not just case-study): build one row per canonical intent value and
    // confirm the router's candidate set for each archetype is driven by the SAME table the
    // fragment picker (catalog.ts) exports — proven by object identity in archetype-contract
    // .test.ts and re-proven here behaviourally via candidatesFor's actual filtering.
    const intents = Array.from(new Set(Object.values(ARCHETYPE_TO_SERVES)));
    const cat: CompositionRow[] = intents.flatMap((intent) => [
      row(`${intent}-a`, [intent]),
      row(`${intent}-b`, [intent]),
    ]);
    for (const [archetype, intent] of Object.entries(ARCHETYPE_TO_SERVES)) {
      const cands = candidatesFor(archetype, cat);
      expect(cands.every((r) => r.serves.includes(intent)), archetype).toBe(true);
      expect(cands.length, `${archetype} → "${intent}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it('falls back when every candidate violates a limit — routes rather than fabricates', () => {
    // The ONLY feature candidate is feature-trio {maxPerPage:1}. Two feature items: the
    // second has no non-violating candidate, so the pool falls back to the full candidate
    // set and the section is still routed (satisfy, never fabricate).
    const cat: CompositionRow[] = [row('feature-trio', ['feature'], 'base', { maxPerPage: 1 })];
    const items = [item('feature-grid', 'f1'), item('feature-grid', 'f2')];
    assignWebsiteCompositions(items, cat, []);
    expect(items[0].componentVariant).toBe('feature-trio');
    expect(items[1].componentVariant).toBe('feature-trio');
  });
});

describe('B-1 hero-family cap', () => {
  // A hero variant that ALSO serves feature (the COMPOSITION.md Serves-includes-feature bug).
  const CAP_CAT: CompositionRow[] = [
    row('hero-bento', ['hero', 'feature']),          // base, hero-family, leaks into feature
    row('feature-trio', ['feature']),                // base, the legit non-hero candidate
    row('stat-cards', ['stats', 'feature'], 'contrast'),
  ];

  it('a non-hero section never wears a hero-family variant', () => {
    const items = [item('hero', 'h1'), item('feature-grid', 'f1')];
    assignWebsiteCompositions(items, CAP_CAT, []);
    // The cap forbids the hero-family variant; the feature section lands on a
    // non-hero candidate (feature-trio or, via the B-2 rhythm guarantee, the
    // contrast stat-cards — both legitimate non-hero picks).
    expect(items[1].componentVariant).not.toBe('hero-bento');
    expect(['feature-trio', 'stat-cards']).toContain(items[1].componentVariant);
  });

  it('caps hero-family to one per page (second hero-intent section falls through)', () => {
    const items = [item('hero', 'h1'), item('sub-hero', 's1')];
    assignWebsiteCompositions(items, CAP_CAT, []);
    const heroCount = items.filter((i) => i.componentVariant === 'hero-bento').length;
    expect(heroCount).toBeLessThanOrEqual(1);
  });
});

describe('B-2 surface-rhythm guarantee', () => {
  // Only stat-cards (contrast) carries rhythm; the page is otherwise all-base.
  const RHY_CAT: CompositionRow[] = [
    row('hero-bento', ['hero']),
    row('feature-trio', ['feature'], 'base', { maxPerPage: 1 }),
    row('feature-bento', ['feature'], 'base'),
    row('stat-cards', ['stats', 'feature'], 'contrast'),
  ];

  it('promotes one band to contrast when the page is all base/rest', () => {
    const items = [item('hero', 'h1'), item('feature-grid', 'f1'), item('metrics', 'm1')];
    assignWebsiteCompositions(items, RHY_CAT, []);
    const rhythm = items.filter((i) => i.surfaceRole === 'contrast' || i.surfaceRole === 'figure');
    expect(rhythm.length).toBeGreaterThanOrEqual(1);
  });

  it('is a no-op when a contrast band already exists (no double-promote)', () => {
    // metrics → stat-cards(contrast) is picked naturally; nothing else should flip.
    const items = [item('hero', 'h1'), item('metrics', 'm1')];
    assignWebsiteCompositions(items, RHY_CAT, []);
    const rhythm = items.filter((i) => i.surfaceRole === 'contrast' || i.surfaceRole === 'figure');
    expect(rhythm.length).toBe(1);
  });

  it('leaves the page as-is when no section has a contrast-capable candidate', () => {
    const flat: CompositionRow[] = [row('hero-bento', ['hero']), row('faq-split', ['faq'])];
    const items = [item('hero', 'h1'), item('faq', 'q1')];
    expect(() => assignWebsiteCompositions(items, flat, [])).not.toThrow();
    expect(items.every((i) => i.surfaceRole !== 'contrast' && i.surfaceRole !== 'figure')).toBe(true);
  });

  it('stays deterministic with the guarantee active', () => {
    const a = [item('hero', 'h1'), item('feature-grid', 'f1'), item('metrics', 'm1')];
    const b = [item('hero', 'h1'), item('feature-grid', 'f1'), item('metrics', 'm1')];
    assignWebsiteCompositions(a, RHY_CAT, []);
    assignWebsiteCompositions(b, RHY_CAT, []);
    expect(a.map((i) => i.surfaceRole)).toEqual(b.map((i) => i.surfaceRole));
  });
});

describe('W50 Track 3 — presentation cadence (surface-only, information unchanged)', () => {
  // Feature intent has base + contrast variants → an alternate surface always exists.
  const CAD_CAT: CompositionRow[] = [
    row('hero-bento', ['hero']),
    row('feat-b1', ['feature'], 'base'),
    row('feat-b2', ['feature'], 'base'),
    row('feat-c1', ['feature'], 'contrast'),
    row('feat-c2', ['feature'], 'contrast'),
    row('footer-mega', ['footer']),
  ];
  const fourFeatures = () => [
    item('hero', 'h'),
    item('feature-grid', 'f1'),
    item('feature-grid', 'f2'),
    item('feature-grid', 'f3'),
    item('feature-grid', 'f4'),
    item('footer', 'ft'),
  ];
  const call = (items: PlanItem[], cadence: boolean, audit?: unknown[]) =>
    (assignWebsiteCompositions as unknown as (...a: unknown[]) => void)(
      items, CAD_CAT, [], undefined, undefined, undefined, undefined, undefined, 0, cadence, audit,
    );

  it('OFF (default): leaves the monotonous run untouched and emits no audit', () => {
    const off = fourFeatures();
    const audit: unknown[] = [];
    call(off, false, audit);
    const featSurfaces = off.slice(1, 5).map((i) => i.surfaceRole);
    // baseline monotony exists: at least one adjacent same-surface pair among the 4 features
    const hasAdjacentDup = featSurfaces.some((s, k) => k > 0 && s === featSurfaces[k - 1]);
    expect(hasAdjacentDup).toBe(true);
    expect(audit).toHaveLength(0);
  });

  it('ON: breaks adjacent same-surface repetition (no two adjacent same-archetype bands share a surface)', () => {
    const on = fourFeatures();
    call(on, true);
    for (let i = 1; i < on.length; i++) {
      if (String(on[i].archetype) === String(on[i - 1].archetype)) {
        expect(on[i].surfaceRole).not.toBe(on[i - 1].surfaceRole);
      }
    }
  });

  it('ON: information is IDENTICAL — archetype sequence, order, and count all unchanged', () => {
    const off = fourFeatures();
    const on = fourFeatures();
    call(off, false);
    call(on, true);
    expect(on.map((i) => String(i.archetype))).toEqual(off.map((i) => String(i.archetype)));
    expect(on.map((i) => i.anchor.id)).toEqual(off.map((i) => i.anchor.id));
    expect(on.length).toBe(off.length);
  });

  it('Track 3.5: emits an audit trail recording surface-only changes with a reason', () => {
    const on = fourFeatures();
    const audit: Array<Record<string, unknown>> = [];
    call(on, true, audit);
    expect(audit.length).toBeGreaterThanOrEqual(1);
    for (const a of audit) {
      expect(a.beforeSurface).not.toBe(a.afterSurface); // surface actually changed
      expect(String(a.reason).toLowerCase()).toContain('surface');
      expect(typeof a.sectionIndex).toBe('number');
    }
  });

  it('is deterministic — two ON runs produce identical surfaces and identical audit', () => {
    const a = fourFeatures();
    const b = fourFeatures();
    const auditA: unknown[] = [];
    const auditB: unknown[] = [];
    call(a, true, auditA);
    call(b, true, auditB);
    expect(a.map((i) => i.surfaceRole)).toEqual(b.map((i) => i.surfaceRole));
    expect(auditA).toEqual(auditB);
  });

  it('does NOT force a change when no alternate surface exists (all-base feature variants)', () => {
    const flatCat: CompositionRow[] = [
      row('hero-bento', ['hero']),
      row('feat-b1', ['feature'], 'base'),
      row('feat-b2', ['feature'], 'base'),
      row('footer-mega', ['footer']),
    ];
    const items = [item('hero', 'h'), item('feature-grid', 'f1'), item('feature-grid', 'f2'), item('footer', 'ft')];
    const audit: unknown[] = [];
    expect(() =>
      (assignWebsiteCompositions as unknown as (...a: unknown[]) => void)(
        items, flatCat, [], undefined, undefined, undefined, undefined, undefined, 0, true, audit,
      ),
    ).not.toThrow();
    // no contrast/figure alternative to move to → surfaces stay all 'base', audit empty (never invents)
    expect(audit).toHaveLength(0);
  });

  // ── W63 — governed default activation (reuses W60's resolveGovernedActivation exactly) ──────
  describe('W63 — governed activation', () => {
    it('governance enabled + env unset → cadence activates (breaks adjacent same-surface repetition)', () => {
      const cadence = resolveGovernedActivation(undefined, true);
      expect(cadence).toBe(true);
      const on = fourFeatures();
      call(on, cadence);
      for (let i = 1; i < on.length; i++) {
        if (String(on[i].archetype) === String(on[i - 1].archetype)) {
          expect(on[i].surfaceRole).not.toBe(on[i - 1].surfaceRole);
        }
      }
    });

    it('governance disabled + env unset → cadence stays inactive (byte-identical default)', () => {
      const cadence = resolveGovernedActivation(undefined, false);
      expect(cadence).toBe(false);
      const off = fourFeatures();
      const audit: unknown[] = [];
      call(off, cadence, audit);
      expect(audit).toHaveLength(0);
    });

    it('explicit env="1" overrides governance disabled → still activates', () => {
      const cadence = resolveGovernedActivation('1', false);
      expect(cadence).toBe(true);
      const on = fourFeatures();
      const audit: unknown[] = [];
      call(on, cadence, audit);
      expect(audit.length).toBeGreaterThanOrEqual(1);
    });

    it('explicit env="0" overrides governance enabled → stays inactive', () => {
      const cadence = resolveGovernedActivation('0', true);
      expect(cadence).toBe(false);
      const off = fourFeatures();
      const audit: unknown[] = [];
      call(off, cadence, audit);
      expect(audit).toHaveLength(0);
    });

    it('replay determinism: governed activation produces identical results across repeated builds', () => {
      const cadence = resolveGovernedActivation(undefined, true);
      const a = fourFeatures();
      const auditA: unknown[] = [];
      const b = fourFeatures();
      const auditB: unknown[] = [];
      call(a, cadence, auditA);
      call(b, cadence, auditB);
      expect(a.map((i) => i.surfaceRole)).toEqual(b.map((i) => i.surfaceRole));
      expect(auditA).toEqual(auditB);
    });
  });
});

describe('A4 — skeleton fallback when no whole variant fits', () => {
  it('composes from the §B skeleton for an archetype with no catalog candidate', () => {
    const emptyCatalog: any[] = [];
    const items: any[] = [{ archetype: 'feature-grid', anchor: { id: 'feat' } }];
    const warnings: string[] = [];
    const skeletons = [{ intent: 'feature', slots: ['[headline-cluster]', '[proof: card-grid]'] }];
    assignWebsiteCompositions(items as any, emptyCatalog as any, warnings, skeletons as any);
    expect(items[0].composition).toContain('COMPOSE §B');
    expect(items[0].composition).toContain('headline-cluster');
    expect(items[0].sectionGuidance).toContain('skeleton');
    expect(warnings.some((w) => w.includes('A4 fallback'))).toBe(true);
  });
});
