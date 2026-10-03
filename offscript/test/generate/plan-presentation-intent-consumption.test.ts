/**
 * Sprint W53 — plan.ts's collateral routing (WS5 flagship/spatial-hero routing +
 * WS1 composition assignment) CONSUMES the transported PresentationIntent instead of
 * independently re-deriving the content signal, once presentation-intent transport is
 * enabled (PlanOptions.presentationIntent).
 *
 * Proof strategy: fabricate a mismatched PresentationIntent (every item claims a rich
 * spatial+diagram signal, via a scoped mock of createPresentationIntentProvider) and
 * observe the routing follow the FABRICATED signal rather than each section's real
 * (prose-only) bound content. A passive "still passes" test cannot distinguish real
 * consumption from a no-op refactor; only a deliberately WRONG transported value that the
 * consumer visibly follows proves the derivation ownership actually moved.
 *
 * Scoped to this file only (vi.mock is file-local) so plan.test.ts's own W52 transport
 * tests — which assert presentationIntent reflects REAL content — are untouched.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';

vi.mock('../../src/generate/presentation-intent.js', async (importOriginal) => {
  const actual = await importOriginal();
  const FABRICATED = Object.freeze({
    intentClass: 'spatial',
    commitment: 'dominant',
    source: Object.freeze(['spatial', 'diagram']),
    digest: 'w53-fabricated-fixture',
    validationState: 'valid',
  });
  return {
    ...(actual as object),
    createPresentationIntentProvider: () => ({
      intentFor: () => FABRICATED,
    }),
  };
});

const { plan } = await import('../../src/generate/plan.js');
const { buildContext } = await import('../../src/generate/context.js');

const FIXTURE_CLIENT = '__w53_plan_consumption__';

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
    'track: collateral',
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

describe('W53 — plan.ts collateral routing consumes the transported PresentationIntent', () => {
  afterEach(() => {
    rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
  });

  it('WS5 flagship routing follows the fabricated transported signal, not the real (prose) content', () => {
    scaffoldClient();
    // Pure prose — a fresh deriveContentSignal on any of these would yield ['generic'], never
    // 'diagram'/'spatial', so richShapeCount() would be 0 for every item on the legacy path.
    writeBrief(['Cover', 'Our Story', 'What We Believe', 'Close']);
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx, { presentationIntent: true });
    const flagship = p.items.find((i) => i.flagshipVisual);
    expect(flagship).toBeDefined();
    expect(flagship!.intent).toBe('Our Story');
  });

  it('the cover gets the spatial-hero treatment on a prose deck once the fabricated signal reports system-density', () => {
    scaffoldClient();
    writeBrief(['Cover', 'Our Story', 'What We Believe', 'How We Work', 'Close']);
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx, { presentationIntent: true });
    const cover = p.items.find((i) => i.archetype === 'CoverPage')!;
    expect(cover.composition).toMatch(/SPATIAL HERO COVER/);
  });

  it('composition assignment follows the fabricated spatial/diagram signal, not the real prose content', () => {
    scaffoldClient();
    writeBrief(['Cover', 'Our Story', 'Close']);
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx, { presentationIntent: true });
    const body = p.items.find((i) => i.intent === 'Our Story')!;
    // The fabricated signal (['spatial', 'diagram']) resolves to the SPATIAL SYSTEM /
    // RELATIONSHIP DIAGRAM / INLINE-SVG DIAGRAM candidates — never a prose-only default
    // (e.g. NUMBERED EDITORIAL LIST) a real 'generic' signal would pick.
    expect(body.composition).toMatch(/DIAGRAM|SPATIAL SYSTEM/);
  });

  it('disabled (default): presentationIntent is never attached, so the fabricated mock has no effect', () => {
    scaffoldClient();
    writeBrief(['Cover', 'Our Story', 'What We Believe', 'Close']);
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx); // presentationIntent option omitted
    for (const item of p.items) expect(item.presentationIntent).toBeUndefined();
    expect(p.items.some((i) => i.flagshipVisual)).toBe(false);
  });
});
