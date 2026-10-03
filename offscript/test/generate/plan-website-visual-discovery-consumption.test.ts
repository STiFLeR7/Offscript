/**
 * Sprint W71 — plan.ts's website wiring site CONSUMES the transported
 * `createWebsiteVisualDiscoveryProvider()` output rather than independently re-deriving it.
 *
 * Investigation finding (see docs/internals/SPRINT-W71-WEBSITE-VISUAL-DISCOVERY-CONSUMPTION.md
 * §1 for the full inventory): unlike collateral before W53 — which had FOUR pre-existing
 * downstream consumers (WS5 flagship routing, WS1 composition assignment, the author dispatch
 * loop, buildFlagshipBlock) independently re-deriving `deriveContentSignal(item)` for their own
 * routing decisions — website has ZERO such pre-existing consumers. `mustIncludeToArchetype`
 * (the only pre-W70 content-shape classifier) is upstream of visual discovery by construction
 * (it runs at plan Stage 1, before content is even fully bound) and is explicitly out of scope
 * (frozen routing correctness, W69B). No other website file independently reasons about
 * process/comparison/stats content shape (confirmed by source-wide grep, report §1).
 *
 * The one thing this sprint CAN and DOES prove — with the SAME falsification discipline W53
 * used (fabricate a deliberately WRONG transported value and observe it win) — is that the
 * `plan.ts` wiring site introduced in W70 is a genuine PASS-THROUGH consumer of
 * `createWebsiteVisualDiscoveryProvider()`'s output, not an independent recomputation that
 * merely happens to agree with it. A passive "still passes" test cannot distinguish real
 * consumption from a coincidental no-op; a fabricated value the real bound content could never
 * produce, faithfully appearing on `item.visualDiscovery`, can.
 *
 * Scoped to this file only (vi.mock is file-local) so plan.test.ts's own W70 transport-gate
 * tests — which assert visualDiscovery reflects REAL content — are untouched.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';

vi.mock('../../src/generate/website-visual-discovery.js', async (importOriginal) => {
  const actual = await importOriginal();
  // Deliberately WRONG for every real item this file's briefs use: pure hero/faq/cta-banner
  // prose has no process/comparison/stats cue at all, so a real computation would always
  // report `archetypeFit: true` with `suggestedFamily` absent. This fabrication claims the
  // opposite for every item — the real bound content could never produce it.
  const FABRICATED = Object.freeze({
    archetypeFit: false,
    suggestedFamily: 'stats',
    source: Object.freeze(['stats']),
    digest: 'w71-fabricated-fixture',
    validationState: 'valid',
  });
  return {
    ...(actual as object),
    createWebsiteVisualDiscoveryProvider: () => ({
      discoveryFor: () => FABRICATED,
    }),
  };
});

const { plan } = await import('../../src/generate/plan.js');
const { buildContext } = await import('../../src/generate/context.js');

const FIXTURE_CLIENT = '__w71_plan_consumption__';

function scaffoldClient(): void {
  const refsDir = projectReferencesDir(FIXTURE_CLIENT);
  mkdirSync(refsDir, { recursive: true });
  writeFileSync(
    join(refsDir, 'colors_and_type.css'),
    ':root { --cr-bg: #ffffff; --cr-fg: #111111; }',
    'utf8',
  );
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

describe('W71 — plan.ts website wiring consumes the transported WebsiteVisualDiscovery', () => {
  afterEach(() => {
    rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
  });

  it('every item carries the FABRICATED discovery object, not a fresh independent computation', () => {
    scaffoldClient();
    // Pure hero/faq/cta-banner prose — a real computeWebsiteVisualDiscovery on any of these
    // would report archetypeFit: true, suggestedFamily: undefined (no process/comparison/stats
    // cue anywhere in this text). The mock claims the opposite.
    writeBrief(['hero', 'Meet our founder', 'faq', 'cta-banner']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx, { websiteVisualDiscovery: true });
    expect(p.items.length).toBeGreaterThan(0);
    for (const item of p.items) {
      expect(item.visualDiscovery).toBeDefined();
      expect(item.visualDiscovery!.archetypeFit).toBe(false);
      expect(item.visualDiscovery!.suggestedFamily).toBe('stats');
      expect(item.visualDiscovery!.digest).toBe('w71-fabricated-fixture');
    }
  });

  it('disabled (default): websiteVisualDiscovery is never attached, so the fabricated mock has no effect', () => {
    scaffoldClient();
    writeBrief(['hero', 'Meet our founder', 'faq', 'cta-banner']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx); // websiteVisualDiscovery option omitted
    for (const item of p.items) expect(item.visualDiscovery).toBeUndefined();
  });

  it('collateral track never attaches visualDiscovery, even with the flag on and the mock active', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx, { websiteVisualDiscovery: true });
    for (const item of p.items) expect(item.visualDiscovery).toBeUndefined();
  });

  it('fabricated consumption is deterministic — two plan() builds under the mock agree exactly', () => {
    scaffoldClient();
    writeBrief(['hero', 'Meet our founder', 'faq', 'cta-banner']);
    const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
    const a = plan(ctxFor(), { websiteVisualDiscovery: true });
    const b = plan(ctxFor(), { websiteVisualDiscovery: true });
    expect(a.items.map((i) => i.visualDiscovery)).toEqual(b.items.map((i) => i.visualDiscovery));
  });

  it('fabrication does NOT alter archetype, order, or item identity — W70 transport is structural-only', () => {
    scaffoldClient();
    writeBrief(['hero', 'Meet our founder', 'faq', 'cta-banner']);
    const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
    const off = plan(ctxFor());
    const on = plan(ctxFor(), { websiteVisualDiscovery: true });
    const strip = (items: typeof off.items) => items.map((i) => ({ archetype: i.archetype, id: i.anchor.id }));
    expect(strip(on.items)).toEqual(strip(off.items));
  });

  // W72 — Website Visual Discovery Behavioural Integration: item.visualDiscovery is now genuinely
  // CONSUMED as a late-stage selection tie-break (see website-visual-tiebreak.test.ts for the full
  // proof suite). This intentionally supersedes this file's OWN prior "fragmentId never changes"
  // assertion: the FABRICATED disagreement above (archetypeFit: false, suggestedFamily: 'stats')
  // is exactly the kind of signal W72 now acts on, so the feature-grid item's fragmentId DOES
  // change here — from catalog-order's 'feature-trio' to 'feature-bento' (the only best-fit
  // candidate that also serves 'stats') — precisely because the mock proves genuine pass-through
  // consumption, not because anything widened the candidate pool or changed archetype/order.
  it('W72: the fabricated disagreement now changes fragmentId to the multi-serving candidate (fragment picker)', () => {
    scaffoldClient();
    writeBrief(['hero', 'Meet our founder', 'faq', 'cta-banner']);
    const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
    const off = plan(ctxFor());
    const on = plan(ctxFor(), { websiteVisualDiscovery: true });
    const featureOff = off.items.find((i) => i.archetype === 'feature-grid');
    const featureOn = on.items.find((i) => i.archetype === 'feature-grid');
    expect(featureOff?.fragmentId).toBe('feature-trio');
    expect(featureOn?.fragmentId).toBe('feature-bento');
  });
});
