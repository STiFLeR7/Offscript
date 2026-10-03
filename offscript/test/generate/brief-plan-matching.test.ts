/**
 * C2 regression-lock — brief ↔ plan matching (WEBSITE track).
 *
 * Phase-2 closes C2 (the brief body's per-section copy is forwarded to the matching
 * plan item, and copy that matches no planned section is surfaced LOUDLY rather than
 * silently dropped). The behaviour itself already ships in `attachBriefContent`
 * (src/generate/plan.ts); this file LOCKS it against regression. It adds NO engine
 * code — it pins the two C2 guarantees on the website path:
 *
 *   (a) MATCHED  — a brief body heading that matches a planned section forwards that
 *                  section's verbatim substance onto `item.content` (heading-slug match).
 *   (b) UNMATCHED — a brief body chunk that matches NO planned section is reported via
 *                  `plan().warnings` (never silently lost).
 *
 * DETERMINISM of the unmatched case (this is the subtle part):
 *   Every unmatched heading falls back to the `feature-grid` archetype
 *   (mustIncludeToArchetype's final fallback). So an orphan body chunk could be
 *   accidentally consumed by tier-2 archetype-equality if any unconsumed
 *   `feature-grid` plan item existed. To make the orphan deterministically unmatched
 *   we construct the brief so:
 *     1. There are EXACTLY 5 mustInclude entries (= WEBSITE_MIN_SECTIONS) with 5
 *        DISTINCT archetypes (= WEBSITE_MIN_DISTINCT) → NO floor-padding runs, so the
 *        planner adds nothing (in particular, no padding `feature-grid`/`metrics`/
 *        `cta`/`footer` items appear).
 *     2. NONE of those 5 archetypes is `feature-grid` (hero / pricing / metrics / faq /
 *        footer). So the orphan chunk's `feature-grid` fallback has no item to attach
 *        to (tier-1 slug miss, tier-2 archetype miss), and its slug is not a substring
 *        of any intent (tier-3 miss) → it is reported unmatched.
 *   Verified against the real plan() output (not assumed).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { makeBriefFixture } from './_brief-fixture.js';

// ── Fixture client (own dir; torn down after each test) ──────────────────────
const FIXTURE_CLIENT = '__c2_brief_plan_match__';

// Shared brief/brand fixture helpers (test/generate/_brief-fixture.ts), bound to
// this file's fixture client.
const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE_CLIENT);

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

// 5 distinct, non-feature-grid archetypes → NO floor-padding, NO feature-grid item.
const MUST = ['hero', 'pricing', 'metrics', 'faq', 'footer'];

// Body: a matched section (## Hero → the hero item) + an orphan chunk whose
// heading slugs to "zzz-orphan-notes" and falls back to feature-grid (which has no
// plan item) → deterministically unmatched. A preamble proves the preamble drop.
const ORPHAN_SLUG = 'zzz-orphan-notes';
const BODY = [
  'Whole-brief preamble that belongs to no single section.',
  '',
  '## Hero',
  '- Headline: Coding agents are the hands. Helix is the team brain.',
  '- Sub: the substance the author must typeset, not invent.',
  '',
  '## Zzz Orphan Notes',
  '- This chunk matches no planned section and must be surfaced, not dropped.',
].join('\n');

describe('C2 — brief ↔ plan matching (website): matched content is forwarded', () => {
  it('(a) a body heading that matches a planned section forwards its substance', () => {
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));

    const hero = p.items.find((i) => i.intent === 'hero');
    expect(hero, 'the hero plan item must exist').toBeDefined();
    // The hero item carries the verbatim brief substance — not invented copy.
    expect(hero!.content).toContain('Helix is the team brain');
    expect(hero!.content).toContain('the substance the author must typeset');
  });

  it('the brief preamble (text before the first heading) is forwarded to NO item', () => {
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    for (const item of p.items) {
      expect(item.content ?? '').not.toContain('Whole-brief preamble');
    }
  });

  it('the plan stays at the 5-section floor (no padding) — proves the orphan setup', () => {
    // This is the load-bearing precondition for (b)'s determinism: 5 distinct
    // non-feature-grid archetypes means the planner adds nothing.
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    expect(p.items.length).toBe(5);
    const archetypes = p.items.map((i) => i.archetype);
    expect(archetypes).toEqual(MUST); // hero / pricing / metrics / faq / footer, in order
    // No feature-grid item exists for the orphan's fallback archetype to attach to.
    expect(archetypes).not.toContain('feature-grid');
  });
});

describe('C2 — brief ↔ plan matching (website): unmatched copy is surfaced loudly', () => {
  it('(b) a body chunk that matches no planned section is reported via plan().warnings', () => {
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const { warnings } = plan(buildContext(FIXTURE_CLIENT, 'website'));

    // The warning names the orphan chunk's slug and the "matched no planned section" reason.
    const matched = warnings.filter(
      (w) => /matched no planned section/.test(w) && w.includes(ORPHAN_SLUG),
    );
    expect(matched.length, `warnings were: ${JSON.stringify(warnings)}`).toBe(1);
  });

  it('the unmatched chunk is NOT silently swallowed onto any item.content', () => {
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    for (const item of p.items) {
      expect(item.content ?? '').not.toContain('This chunk matches no planned section');
    }
  });

  it('the matched hero raises NO warning; the orphan is surfaced (W2-S2: preamble now surfaced too, not dropped)', () => {
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const { warnings } = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const unmatchedWarnings = warnings.filter((w) => /matched no planned section/.test(w));
    // The orphan is surfaced; the matched hero never raises a warning. W2-S2 no longer
    // DROPS the preamble — it is preserved and surfaced as unmatched too (no silent loss),
    // so the count is ≥1 and none of the unmatched warnings is for the hero.
    expect(unmatchedWarnings.length).toBeGreaterThanOrEqual(1);
    expect(unmatchedWarnings.some((w) => w.includes(ORPHAN_SLUG))).toBe(true);
    expect(unmatchedWarnings.every((w) => !w.includes('hero'))).toBe(true);
  });
});

describe('C2 — brief ↔ plan matching (website): the lock is deterministic', () => {
  it('two plans of the same brief yield identical content + warnings', () => {
    scaffoldClient();
    writeBrief(MUST, 'website', BODY);
    const p1 = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const p2 = plan(buildContext(FIXTURE_CLIENT, 'website'));
    expect(p1.items.map((i) => i.content)).toEqual(p2.items.map((i) => i.content));
    expect(p1.warnings).toEqual(p2.warnings);
  });
});
