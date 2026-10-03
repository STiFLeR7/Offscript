/**
 * W85 — Selector Contract Unification: real-planner regression + replay.
 *
 * SPRINT-W84 §3.1 proved a live divergence: for the `case-study` archetype, the composition
 * router (`assignWebsiteCompositions`, sets `componentVariant`) and the fragment picker
 * (`assignWebsiteFragments`, sets `fragmentId` — the band `assembleWebsiteBySelection` actually
 * pastes) drew from DIFFERENT candidate pools (testimonials vs social-proof), because each
 * consulted its own copy of the archetype→serves table. These tests build a REAL website plan
 * (real `buildContext` + `plan()`, real catalog — not synthetic rows) for a brief that declares
 * a case-study section exactly the way a real client (`cartage`) does, and prove the two
 * selectors now agree, and that the result is deterministic under replay.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { plan as buildPlan } from '../../src/generate/plan.js';
import { buildContext } from '../../src/generate/context.js';
import { loadFragmentCatalog } from '../../src/generate/catalog.js';
import { projectDir } from '../../src/paths.js';
import { makeBriefFixture } from './_brief-fixture.js';
import type { FragmentEntry } from '../../src/generate/catalog.js';

const FIXTURE_CLIENT = '__w85_selector_contract_test__';
const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE_CLIENT);

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

function buildCaseStudyPlan() {
  scaffoldClient();
  writeBrief([
    'hero',
    'features',
    'case-study: A national shipper that cut exceptions in half',
    'pricing',
    'footer',
  ]);
  const ctx = buildContext(FIXTURE_CLIENT, 'website');
  return buildPlan(ctx);
}

/** Look up a catalog entry's `serves` list by slug (undefined if the slug is unknown). */
function servesOf(slug: string | undefined, catalog: FragmentEntry[]): string[] | undefined {
  if (!slug) return undefined;
  return catalog.find((f) => f.slug === slug)?.serves;
}

describe('W85 — selector contract unification (real buildContext + plan())', () => {
  it('routes an explicit "case-study: …" declaration to the case-study archetype', () => {
    const p = buildCaseStudyPlan();
    const caseStudyItems = p.items.filter((i) => i.archetype === 'case-study');
    expect(caseStudyItems.length).toBeGreaterThanOrEqual(1);
  });

  it('case-study regression: router (componentVariant) and picker (fragmentId) agree on the SAME intent pool', () => {
    const p = buildCaseStudyPlan();
    const catalog = loadFragmentCatalog();
    const caseStudy = p.items.find((i) => i.archetype === 'case-study');
    expect(caseStudy).toBeDefined();
    expect(caseStudy!.componentVariant, 'router did not route a componentVariant').toBeDefined();
    expect(caseStudy!.fragmentId, 'picker did not select a fragmentId').toBeDefined();

    const routerServes = servesOf(caseStudy!.componentVariant, catalog);
    const pickerServes = servesOf(caseStudy!.fragmentId, catalog);
    expect(routerServes, `router slug "${caseStudy!.componentVariant}" not in catalog`).toBeDefined();
    expect(pickerServes, `picker slug "${caseStudy!.fragmentId}" not in catalog`).toBeDefined();

    // The router's within-pool tie-break is UNCHANGED by this sprint (governance-gated best-fit
    // narrowing is scoring behaviour, out of scope — see the brief's "do not change selector
    // scoring") — so only membership is asserted for the router: it must draw from the pool
    // that serves "testimonials".
    expect(routerServes, `router slug "${caseStudy!.componentVariant}"`).toContain('testimonials');

    // `pickFragment` (the picker) ALWAYS ranks best-fit (serves[0] === target) as its #1 key,
    // unconditionally — this is the concrete, provable regression signal. Many "case
    // study"-flavoured catalog rows multi-serve both intents (e.g. results-proof serves
    // social-proof AND testimonials secondarily), so a bare `.includes('testimonials')` check
    // would NOT have detected the pre-W85 divergence. Pre-W85 the picker's sole best-fit for
    // the drifted "social-proof" target was 'results-proof' (serves[0] === 'social-proof') — a
    // proof-hybrid card, not a Testimonials-family component. Post-W85 the picker's target is
    // "testimonials", so its best-fit primary must now be "testimonials" too.
    expect(pickerServes![0], `picker fragmentId "${caseStudy!.fragmentId}"`).toBe('testimonials');
    expect(caseStudy!.fragmentId, 'picker must no longer default to the social-proof best-fit "results-proof"').not.toBe('results-proof');
  });

  it('deterministic replay: building the same plan twice yields byte-identical selector output', () => {
    const a = buildCaseStudyPlan();
    const b = buildCaseStudyPlan();
    const aCaseStudy = a.items.find((i) => i.archetype === 'case-study');
    const bCaseStudy = b.items.find((i) => i.archetype === 'case-study');
    expect(aCaseStudy?.componentVariant).toBe(bCaseStudy?.componentVariant);
    expect(aCaseStudy?.fragmentId).toBe(bCaseStudy?.fragmentId);
    expect(aCaseStudy?.candidates).toEqual(bCaseStudy?.candidates);
    // Full-plan replay, not just the one archetype under regression.
    expect(a.items.map((i) => i.componentVariant)).toEqual(b.items.map((i) => i.componentVariant));
    expect(a.items.map((i) => i.fragmentId)).toEqual(b.items.map((i) => i.fragmentId));
  });

  it('selector parity holds for every archetype present on a full-page plan, not only case-study', () => {
    const p = buildCaseStudyPlan();
    const catalog = loadFragmentCatalog();
    for (const item of p.items) {
      if (!item.componentVariant || !item.fragmentId) continue; // unrouted archetypes are out of scope
      const routerServes = servesOf(item.componentVariant, catalog) ?? [];
      const pickerServes = servesOf(item.fragmentId, catalog) ?? [];
      // Both must overlap on at least one shared serves token — they were selected for the
      // SAME archetype from the SAME canonical intent, even though the specific chosen slug
      // may legitimately differ between router and picker (different internal tie-break state).
      const overlap = routerServes.some((s) => pickerServes.includes(s));
      expect(overlap, `archetype "${item.archetype}": router=${item.componentVariant} (${routerServes}) vs picker=${item.fragmentId} (${pickerServes})`).toBe(true);
    }
  });
});
