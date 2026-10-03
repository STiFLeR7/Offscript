/**
 * P47 — cross-page novelty persistence: the history reaches selection (integration through plan()).
 *
 * Proves Candidate Remedy #1's behavioural contract end-to-end via the real plan() path
 * (PlanOptions.sectionUsageHistory → buildWebsitePlan → assignWebsiteFragments → pickFragment's
 * `recent` key): an empty history is byte-identical to the pre-P47 baseline, identical history
 * reproduces identical selection (determinism / replay), and a non-empty history deterministically
 * shifts selection away from previously-used sections toward unused inventory — with no role emptied
 * and no randomness.
 *
 * The ungoverned default plan is used deliberately: with governance off, cross-page recency (the
 * picker's 9th rank key) is the first discriminator after best-fit / within-page, so the shift is
 * directly observable. Under a governance pack the brief/W19/W24/W30 keys resolve most ties first,
 * so the shift is smaller — that reach limitation is documented in P47, not asserted here.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan, type PlanOptions } from '../../src/generate/plan.js';
import { recordSectionUsage, EMPTY_SECTION_USAGE } from '../../src/generate/section-usage.js';
import { makeBriefFixture } from './_brief-fixture.js';

const CLIENT = '__p47_section_usage_select__';
const { scaffoldClient, writeBrief } = makeBriefFixture(CLIENT);
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));

// Two feature slots on one page exercise both within-page and cross-page rotation.
const MUST = ['hero', 'feature: one', 'feature: two', 'faq', 'footer'];

function fragmentIds(opts: PlanOptions = {}): string[] {
  writeBrief(MUST, 'website');
  return plan(buildContext(CLIENT, 'website'), opts)
    .items.map((i) => i.fragmentId)
    .filter((s): s is string => !!s);
}

describe('P47 — cross-page novelty persistence feeds selection', () => {
  it('empty history ⇒ byte-identical to the no-history baseline (default preserved)', () => {
    scaffoldClient();
    const base = fragmentIds();
    const withEmpty = fragmentIds({ sectionUsageHistory: EMPTY_SECTION_USAGE });
    expect(withEmpty).toEqual(base);
  });

  it('identical history ⇒ identical selection (determinism / replay)', () => {
    scaffoldClient();
    const hist = recordSectionUsage(EMPTY_SECTION_USAGE, ['hero-bento']);
    expect(fragmentIds({ sectionUsageHistory: hist })).toEqual(fragmentIds({ sectionUsageHistory: hist }));
  });

  it('different history ⇒ deterministic variety shift (used sections yield to unused siblings)', () => {
    scaffoldClient();
    const base = fragmentIds();
    // Seed the base run's own winners as "already shipped on prior pages".
    const seeded = recordSectionUsage(EMPTY_SECTION_USAGE, base);
    const shifted = fragmentIds({ sectionUsageHistory: seeded });

    expect(shifted).not.toEqual(base); // variety moved
    expect(shifted.length).toBe(base.length); // no role emptied — every slot still selected
    // deterministic: the same seed reproduces the same shift
    expect(fragmentIds({ sectionUsageHistory: seeded })).toEqual(shifted);
  });
});
