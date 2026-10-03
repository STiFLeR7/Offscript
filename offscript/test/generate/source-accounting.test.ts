/**
 * W2-S3 — Source Fidelity Accounting.
 *
 * Account for EVERY source unit and EVERY consumer, so the system can answer the
 * eight fidelity questions (extracted / bound / unmatched / unused; grounded /
 * ungrounded; brief-grounded / source-doc-grounded). ACCOUNTING ONLY — DATA, no
 * AuthoritySignals, no Failure emission, no ledger, no headline (those are W2-S4,
 * owner `source-fidelity`). Governed by W2-EXECUTION-PACKAGE.md +
 * W2-FIDELITY-FAILURE-OWNERSHIP.md.
 *
 * The carry-forward from W2-S2 is the load-bearing case here: source-DOCUMENT
 * grounding must participate in the accounting — a consumer grounded through
 * `attachSourceContent` (collateral source-doc) must NOT appear authored-from-void.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { extractSourceUnits } from '../../src/generate/source-units.js';
import { bindSourceUnits, type BindConsumer } from '../../src/generate/source-binding.js';
import { buildSourceAccounting } from '../../src/generate/source-accounting.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { makeBriefFixture, minimalCss } from './_brief-fixture.js';

// A trivial archetype inferer for the pure tests (the planner injects its real one).
const inferArchetype = (label: string): string => {
  const l = label.toLowerCase();
  if (/pricing|price/.test(l)) return 'pricing';
  if (/hero/.test(l)) return 'hero';
  return 'feature-grid';
};
const consumer = (id: string, intent: string, archetype = 'feature-grid'): BindConsumer => ({
  id,
  intent,
  archetype,
});

// A binding with one bound unit (hero, tier-1 + tier-2), one unused tier-1 (dropped),
// one unmatched tier-2 (orphan): exercises all three unit dispositions.
function mixedBinding() {
  const units = extractSourceUnits({
    mustInclude: ['Hero', 'Dropped'],
    body: `## Hero\nthe hero.\n## Orphan\norphan body with no consumer.`,
  });
  return bindSourceUnits(units, [consumer('hero', 'Hero', 'hero')], inferArchetype).result;
}

describe('W2-S3 buildSourceAccounting — complete source accounting', () => {
  it('every extracted unit is accounted exactly once, in order, with its disposition', () => {
    const binding = mixedBinding();
    const acc = buildSourceAccounting(binding);

    expect(acc.units).toHaveLength(binding.bindings.length);
    expect(acc.extractedCount).toBe(binding.bindings.length);
    binding.bindings.forEach((b, i) => {
      expect(acc.units[i].unitSlug).toBe(b.unitSlug);
      expect(acc.units[i].tier).toBe(b.tier);
      expect(acc.units[i].disposition).toBe(b.disposition);
    });
    // partition: bound + unmatched + unused === every unit (no silent gap)
    const partitioned =
      acc.boundUnitSlugs.length + acc.unmatchedUnitSlugs.length + acc.unusedUnitSlugs.length;
    expect(partitioned).toBe(acc.units.length);
  });
});

describe('W2-S3 buildSourceAccounting — complete consumer accounting', () => {
  it('every consumer has exactly one grounding state', () => {
    const binding = mixedBinding();
    const acc = buildSourceAccounting(binding);

    expect(acc.consumers).toHaveLength(binding.consumers.length);
    for (const c of acc.consumers) {
      expect(['brief', 'source-doc', 'none']).toContain(c.groundedBy);
      expect(c.grounded).toBe(c.groundedBy !== 'none');
    }
    // partition: grounded + ungrounded === every consumer
    expect(acc.groundedConsumerIds.length + acc.ungroundedConsumerIds.length).toBe(
      acc.consumers.length,
    );
  });
});

describe('W2-S3 buildSourceAccounting — brief grounding', () => {
  it('a consumer the binding grounded is identified as brief-grounded', () => {
    const acc = buildSourceAccounting(mixedBinding());
    const hero = acc.consumers.find((c) => c.consumerId === 'hero');
    expect(hero?.grounded).toBe(true);
    expect(hero?.groundedBy).toBe('brief');
    expect(acc.briefGroundedConsumerIds).toContain('hero');
    expect(acc.sourceDocGroundedConsumerIds).not.toContain('hero');
  });
});

describe('W2-S3 buildSourceAccounting — source-document grounding (W2-S2 carry-forward)', () => {
  it('a consumer grounded ONLY by source-doc content is grounded, not authored-from-void', () => {
    // A brief-ungrounded consumer (no units bind to it).
    const binding = bindSourceUnits(
      extractSourceUnits({ mustInclude: [], body: '' }),
      [consumer('cover', 'Cover', 'CoverPage')],
      inferArchetype,
    ).result;
    expect(binding.consumers.find((c) => c.consumerId === 'cover')?.grounded).toBe(false);

    // The source-doc fill grounded it (its id is reported as source-grounded).
    const acc = buildSourceAccounting(binding, ['cover']);
    const cover = acc.consumers.find((c) => c.consumerId === 'cover');
    expect(cover?.grounded).toBe(true);
    expect(cover?.groundedBy).toBe('source-doc');
    expect(acc.sourceDocGroundedConsumerIds).toContain('cover');
    // the carry-forward guarantee: NOT void
    expect(acc.ungroundedConsumerIds).not.toContain('cover');
  });

  it('brief grounding wins over source-doc when a consumer has both', () => {
    const acc = buildSourceAccounting(mixedBinding(), ['hero']);
    const hero = acc.consumers.find((c) => c.consumerId === 'hero');
    expect(hero?.groundedBy).toBe('brief');
    expect(acc.briefGroundedConsumerIds).toContain('hero');
    expect(acc.sourceDocGroundedConsumerIds).not.toContain('hero');
  });
});

describe('W2-S3 buildSourceAccounting — void consumers + fidelity readiness', () => {
  it('a consumer grounded by neither brief nor source-doc is a void consumer', () => {
    const binding = bindSourceUnits(
      extractSourceUnits({ mustInclude: [], body: '' }),
      [consumer('void', 'Void', 'footer')],
      inferArchetype,
    ).result;
    const acc = buildSourceAccounting(binding); // no source-grounded ids
    const v = acc.consumers.find((c) => c.consumerId === 'void');
    expect(v?.grounded).toBe(false);
    expect(v?.groundedBy).toBe('none');
    expect(acc.ungroundedConsumerIds).toContain('void');
  });

  it('W2-S4 can read lost unit / unbound segment / void consumer from rollups (no re-traversal)', () => {
    const acc = buildSourceAccounting(mixedBinding(), []);
    // lost unit — a declared (tier-1) must-include with no surviving consumer
    expect(acc.unusedUnitSlugs).toContain('dropped');
    // unbound segment — a tier-2 body segment that matched no consumer
    expect(acc.unmatchedUnitSlugs).toContain('orphan');
    // void consumer rollup is present (every rollup is an array, derivable directly)
    expect(Array.isArray(acc.ungroundedConsumerIds)).toBe(true);
  });
});

// ── Wiring through plan() ───────────────────────────────────────────────────────

describe('W2-S3 wiring — plan() attaches accounting consistent with its binding (website)', () => {
  const FIXTURE = '__w2s3_web__';
  const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE);
  afterEach(() => rmSync(projectDir(FIXTURE), { recursive: true, force: true }));

  it('accounting covers every binding unit + every binding consumer, with no gap', () => {
    scaffoldClient();
    writeBrief(
      ['Hero', 'Pricing', 'Metrics', 'FAQ', 'Footer'],
      'website',
      `## Hero\nThe hero copy.\n## Pricing\n18% flat fee.`,
    );
    const p = plan(buildContext(FIXTURE, 'website'));

    expect(p.binding).toBeDefined();
    expect(p.accounting).toBeDefined();
    expect(p.accounting!.units).toHaveLength(p.binding!.bindings.length);
    expect(p.accounting!.consumers).toHaveLength(p.binding!.consumers.length);
    expect(
      p.accounting!.groundedConsumerIds.length + p.accounting!.ungroundedConsumerIds.length,
    ).toBe(p.accounting!.consumers.length);
    // every consumer in the binding appears in the accounting (no silent gap)
    for (const c of p.binding!.consumers) {
      expect(p.accounting!.consumers.some((a) => a.consumerId === c.consumerId)).toBe(true);
    }
  });
});

describe('W2-S3 wiring — collateral source-doc grounding participates (the carry-forward)', () => {
  const FIXTURE = '__w2s3_collateral__';
  const { scaffoldClient } = makeBriefFixture(FIXTURE);
  afterEach(() => rmSync(projectDir(FIXTURE), { recursive: true, force: true }));

  // Empty must-include → the plan pads to the 4 default pages (all brief-ungrounded).
  // A source-doc heading uniquely matching the CoverPage intent ("dark hero sheet …")
  // fills the cover page from the source doc → it must be SOURCE-DOC grounded, not void.
  function writeCollateralFixtureWithSourceDoc(): void {
    const refs = projectReferencesDir(FIXTURE);
    const brief = [
      '---',
      'schemaVersion: 1',
      'track: collateral',
      'one-liner: "Test deliverable"',
      'audience: "Developers"',
      'goals:',
      '  - Drive signups',
      'must-include: []',
      'source-doc: source.md',
      '---',
      '',
    ].join('\n');
    writeFileSync(join(refs, 'brief.md'), brief, 'utf8');
    const source = ['## dark hero sheet', 'Cover substance straight from the source doc.'].join(
      '\n',
    );
    writeFileSync(join(refs, 'source.md'), source, 'utf8');
  }

  it('a page grounded only through the source doc shows groundedBy "source-doc", never void', () => {
    scaffoldClient();
    writeCollateralFixtureWithSourceDoc();
    const p = plan(buildContext(FIXTURE, 'collateral'));

    expect(p.accounting).toBeDefined();
    const cover = p.accounting!.consumers.find((c) => c.consumerId === 'coverpage');
    expect(cover, 'the CoverPage consumer must be accounted').toBeDefined();
    expect(cover!.groundedBy).toBe('source-doc');
    expect(cover!.grounded).toBe(true);
    expect(p.accounting!.sourceDocGroundedConsumerIds).toContain('coverpage');
    expect(p.accounting!.ungroundedConsumerIds).not.toContain('coverpage');
  });
});

// Touch the imported minimalCss so an unused-import lint never trips (parity with siblings).
void minimalCss;
