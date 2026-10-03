/**
 * W2-S4 — Source Fidelity Signals + W1 Composition.
 *
 * The FIRST live producer of Source Fidelity authority signals. It converts the
 * deterministic W2-S3 accounting into objective AuthoritySignals (G1–G4 Failures +
 * the two approved Warning cases), and composes them through the W1 substrate:
 *
 *   Produced → Bound → Accounted → Signaled → Delivered → Surfaced
 *
 * Frozen ownership (W2-FIDELITY-FAILURE-OWNERSHIP.md): `source-fidelity` is the
 * SOLE fidelity emitter; objective only (never critical-warning); Failure for a
 * violated guarantee, Warning for delivered-but-degraded (coarse segment /
 * engine-default padding). Single delivery surface (the ledger) — no bypass.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateSignal, type AuthoritySignal } from '../../src/authority.js';
import { createSignalLedger, detectSeveredPaths } from '../../src/signal-delivery.js';
import type { SourceAccounting } from '../../src/generate/source-accounting.js';
import {
  fidelitySignals,
  composeRunHealth,
  SOURCE_FIDELITY_PRODUCER,
} from '../../src/generate/source-fidelity.js';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { parseBrief } from '../../src/generate/brief.js';
import { briefToNormalized } from '../../src/project/brief-source.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { makeBriefFixture } from './_brief-fixture.js';

// Build a SourceAccounting literal with sane empty defaults; override per test.
function acct(over: Partial<SourceAccounting> = {}): SourceAccounting {
  return {
    units: [],
    consumers: [],
    extractedCount: 0,
    boundUnitSlugs: [],
    unmatchedUnitSlugs: [],
    unusedUnitSlugs: [],
    groundedConsumerIds: [],
    ungroundedConsumerIds: [],
    briefGroundedConsumerIds: [],
    sourceDocGroundedConsumerIds: [],
    ...over,
  };
}

const isFailure = (s: AuthoritySignal) => s.level === 'failure';
const isWarning = (s: AuthoritySignal) => s.level === 'warning';

describe('W2-S4 fidelitySignals — G1 reachability', () => {
  it('a declared (unused) source unit produces an objective Failure attributed to source-fidelity', () => {
    const signals = fidelitySignals(acct({ unusedUnitSlugs: ['dropped-feature'], extractedCount: 1 }));
    const g1 = signals.find((s) => s.where === 'dropped-feature');
    expect(g1).toBeDefined();
    expect(g1!.level).toBe('failure');
    expect(g1!.nature).toBe('objective');
    expect(g1!.producer).toBe(SOURCE_FIDELITY_PRODUCER);
    expect(g1!.why).toMatch(/G1|reachability/);
    expect(validateSignal(g1!).valid).toBe(true);
  });
});

describe('W2-S4 fidelitySignals — G2 no silent loss', () => {
  it('an unmatched body segment produces an objective Failure', () => {
    const signals = fidelitySignals(acct({ unmatchedUnitSlugs: ['orphan-section'], extractedCount: 1 }));
    const g2 = signals.find((s) => s.where === 'orphan-section');
    expect(g2!.level).toBe('failure');
    expect(g2!.why).toMatch(/G2|silent|loss/i);
    expect(validateSignal(g2!).valid).toBe(true);
  });
});

describe('W2-S4 fidelitySignals — G3 attribution', () => {
  it('a delivered (bound) unit with no recorded consumer produces a Failure', () => {
    const signals = fidelitySignals(
      acct({
        extractedCount: 1,
        units: [{ unitSlug: 'ghost', tier: 2, kind: 'heading', disposition: 'bound' }], // no consumerId
      }),
    );
    const g3 = signals.find((s) => s.where === 'ghost');
    expect(g3!.level).toBe('failure');
    expect(g3!.why).toMatch(/G3|attribution|consumer/i);
    expect(validateSignal(g3!).valid).toBe(true);
  });

  it('a properly-attributed bound unit produces NO G3 failure', () => {
    const signals = fidelitySignals(
      acct({
        extractedCount: 1,
        units: [{ unitSlug: 'hero', tier: 1, kind: 'must-include', disposition: 'bound', consumerId: 'hero' }],
      }),
    );
    expect(signals.filter(isFailure)).toHaveLength(0);
  });
});

describe('W2-S4 fidelitySignals — G4 no authoring from void', () => {
  it('an ungrounded consumer (brief supplied) produces an objective Failure', () => {
    const signals = fidelitySignals(
      acct({ extractedCount: 3, ungroundedConsumerIds: ['mystery-section'] }),
      { briefSupplied: true },
    );
    const g4 = signals.find((s) => s.where === 'mystery-section');
    expect(g4!.level).toBe('failure');
    expect(g4!.why).toMatch(/G4|void|grounding/i);
    expect(validateSignal(g4!).valid).toBe(true);
  });
});

describe('W2-S4 fidelitySignals — Warning preservation (never Failure)', () => {
  it('engine-default padding consumer is a Warning, not a Failure', () => {
    const signals = fidelitySignals(
      acct({ extractedCount: 3, ungroundedConsumerIds: ['cta'] }),
      { briefSupplied: true, enginePaddingConsumerIds: ['cta'] },
    );
    const s = signals.find((x) => x.where === 'cta');
    expect(s!.level).toBe('warning');
    expect(signals.filter(isFailure)).toHaveLength(0);
  });

  it('empty brief (nothing extracted) → ungrounded consumers are engine-default Warnings, never Failures', () => {
    const signals = fidelitySignals(
      acct({ extractedCount: 0, ungroundedConsumerIds: ['coverpage', 'closingpage'] }),
    );
    expect(signals.every(isWarning)).toBe(true);
    expect(signals.filter(isFailure)).toHaveLength(0);
  });

  it('a bound coarse blank-block segment is a Warning (delivered but degraded), not a Failure', () => {
    const signals = fidelitySignals(
      acct({
        extractedCount: 1,
        units: [{ unitSlug: 'prose', tier: 2, kind: 'blank-block', disposition: 'bound', consumerId: 'p1' }],
        boundUnitSlugs: ['prose'],
      }),
    );
    const w = signals.find((x) => x.where === 'prose');
    expect(w!.level).toBe('warning');
    expect(signals.filter(isFailure)).toHaveLength(0);
  });
});

describe('W2-S4 fidelitySignals — doctrine: objective only, sole owner, ledger-valid', () => {
  it('every emitted signal is objective, never critical-warning, owned by source-fidelity, ledger-valid', () => {
    const signals = fidelitySignals(
      acct({
        extractedCount: 4,
        unusedUnitSlugs: ['lost'],
        unmatchedUnitSlugs: ['orphan'],
        ungroundedConsumerIds: ['void'],
        units: [{ unitSlug: 'coarse', tier: 2, kind: 'blank-block', disposition: 'bound', consumerId: 'c1' }],
      }),
      { briefSupplied: true },
    );
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.nature).toBe('objective');
      expect(s.level).not.toBe('critical-warning');
      expect(['failure', 'warning', 'information']).toContain(s.level);
      expect(s.producer).toBe(SOURCE_FIDELITY_PRODUCER);
      expect(validateSignal(s).valid).toBe(true);
    }
  });
});

describe('W2-S4 composeRunHealth — single delivery surface (ledger), headline from delivered set', () => {
  it('routes fidelity + rail signals through ONE ledger; a G4 Failure surfaces as FAILED', () => {
    const fidelity = fidelitySignals(
      acct({ extractedCount: 2, ungroundedConsumerIds: ['void'] }),
      { briefSupplied: true },
    );
    const health = composeRunHealth({ fidelity, rail: [], goalMet: true, systematicRatio: 0.91 });

    // Surfaced via the headline — built from the ledger's delivered set.
    expect(health.headline.status).toBe('failed');
    expect(health.delivered.some((s) => s.producer === SOURCE_FIDELITY_PRODUCER && isFailure(s))).toBe(true);
    // The two reporting axes are carried verbatim (LOUD-MARK: run continues, not gated).
    expect(health.headline.goalMet).toBe(true);
    expect(health.headline.systematicRatio).toBe(0.91);
    // The live meta-check ran and found no severed path (everything was delivered).
    expect(health.severed.ok).toBe(true);
  });

  it('Goal Met=YES + Ratio=0.91 + G4 Failure → FAILED while execution continues (no throw)', () => {
    const fidelity: AuthoritySignal[] = [
      {
        producer: SOURCE_FIDELITY_PRODUCER,
        level: 'failure',
        where: 'sec-3',
        what: 'consumer "sec-3" authored with no bound source unit',
        why: 'objective guarantee G4 (no-authoring-from-void)',
        nature: 'objective',
      },
    ];
    const health = composeRunHealth({ fidelity, rail: [], goalMet: true, systematicRatio: 0.91 });
    expect(health.headline.status).toBe('failed');
    expect(health.headline.goalMet).toBe(true);
    expect(health.headline.systematicRatio).toBeCloseTo(0.91);
  });

  it('a clean run (no fidelity violations, no rail failures) surfaces as SUCCESS', () => {
    const health = composeRunHealth({ fidelity: [], rail: [], goalMet: true, systematicRatio: 1 });
    expect(health.headline.status).toBe('success');
    expect(health.severed.ok).toBe(true);
  });
});

describe('W2-S4 severed-path detection — a fidelity signal emitted but not delivered is surfaced', () => {
  it('an undelivered fidelity signal becomes a severed-path Failure via the W1-S2 mechanism', () => {
    const ledger = createSignalLedger();
    ledger.registerProducer(SOURCE_FIDELITY_PRODUCER);
    const sig = fidelitySignals(acct({ extractedCount: 1, unusedUnitSlugs: ['lost'] }))[0];
    ledger.emit(sig);
    // NOTE: deliberately do NOT deliver/drain — simulate a severed path.
    const report = detectSeveredPaths(ledger.entries(), ledger.rejectedSignals(), ledger.registeredProducers());
    expect(report.ok).toBe(false);
    expect(report.severed).toHaveLength(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].level).toBe('failure');
    expect(report.failures[0].producer).toBe('signal-delivery');
  });
});

describe('W2-S4 full chain through plan() — Produced→Bound→Accounted→Signaled→Delivered→Surfaced', () => {
  const FIXTURE = '__w2s4_chain__';
  const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE);
  afterEach(() => rmSync(projectDir(FIXTURE), { recursive: true, force: true }));

  it('a brief whose floor-padding leaves ungrounded sections surfaces a live G4 FAILED headline', () => {
    scaffoldClient();
    // 2 must-include + empty body → the plan pads to the 5-section floor; the padding
    // sections are ungrounded while a brief WAS supplied → G4 Failure(s).
    writeBrief(['Hero', 'Pricing'], 'website', '');
    const p = plan(buildContext(FIXTURE, 'website'));

    expect(p.accounting).toBeDefined(); // Produced → Bound → Accounted
    const fidelity = fidelitySignals(p.accounting!); // Signaled
    expect(fidelity.some(isFailure)).toBe(true);
    expect(fidelity.some((s) => s.why.includes('G4'))).toBe(true);

    const rail = []; // rails not run in this unit-level chain proof
    const health = composeRunHealth({
      fidelity,
      rail,
      goalMet: true,
      systematicRatio: 0.91,
    }); // Delivered (ledger) → Surfaced (headline)
    expect(health.headline.status).toBe('failed');
    expect(health.delivered.some((s) => s.producer === SOURCE_FIDELITY_PRODUCER)).toBe(true);
  });
});

describe('Brief-body / source-fidelity hardening — adapter boilerplate is not Tier-2 content', () => {
  // Reproduces the REAL generation failure observed end-to-end for the Creative Intent CLI path:
  //   [source-fidelity] body segment "..." bound to no consumer — objective guarantee G2
  // Root cause: an adapter's own explanatory body prose (never real generation content — genuine
  // grounding copy travels via `source-doc`) was forwarded verbatim by `briefToNormalized` (the
  // shared convergence point EVERY adapter-consuming BriefSource re-normalizes through), reaching
  // plan()'s body segmentation as if it were real Tier-2 source content.
  const FIXTURE = '__adapter_body_fidelity__';
  const { scaffoldClient } = makeBriefFixture(FIXTURE);
  afterEach(() => rmSync(projectDir(FIXTURE), { recursive: true, force: true }));

  // Verbatim from creative-intent-brief-adapter/src/mapper/serialize.ts
  const CREATIVE_INTENT_ADAPTER_BODY = [
    'This brief was generated by creative-intent-brief-adapter from Creative Intent `owned-task-handoff`.',
    '',
    'It carries INTENT ONLY, mapped one field at a time from the source Creative Intent',
    'artifact (Program CG). Fields with no grounded Creative Intent source were left',
    'absent, never fabricated. Full provenance is recorded opaquely in `provenance` above.',
    '',
  ].join('\n');

  // Verbatim from packet-brief-adapter/src/brief/serialize.ts
  const PACKET_ADAPTER_BODY = [
    'This brief was generated by packet-brief-adapter from content-engine packet `p-123`.',
    '',
    'It carries INTENT only. The approved page copy is grounded via the `source-doc`',
    'named above. Governance (claims, approvals, review gates) was enforced upstream',
    'by the adapter and is recorded opaquely in `provenance` (see manifest.json).',
    '',
  ].join('\n');

  /** Simulates a BriefSource's re-normalization step: parse the adapter's raw brief.md exactly as
   *  brief-source-content-core.ts / brief-source-creative-intent.ts do, then write the FINAL text
   *  that would actually land on disk in production (byte-identical path to acquire-brief.ts). */
  function writeReNormalizedAdapterBrief(rawAdapterBriefMd: string): void {
    const finalBriefText = normalizeBrief(briefToNormalized(parseBrief(rawAdapterBriefMd)));
    writeFileSync(join(projectReferencesDir(FIXTURE), 'brief.md'), finalBriefText, 'utf8');
  }

  it.each([
    ['creative-intent-brief-adapter', CREATIVE_INTENT_ADAPTER_BODY],
    ['packet-brief-adapter', PACKET_ADAPTER_BODY],
  ])('%s boilerplate body produces NO G2 unbound-body-segment failure through a real plan() run', (_name, adapterBody) => {
    scaffoldClient();
    const rawAdapterBriefMd = [
      '---',
      'schemaVersion: 1',
      'track: website',
      'one-liner: nothing falls through the cracks because every task always has a clear, visible owner',
      '---',
      '',
      adapterBody,
    ].join('\n');
    writeReNormalizedAdapterBrief(rawAdapterBriefMd);

    const p = plan(buildContext(FIXTURE, 'website'));
    expect(p.accounting).toBeDefined();
    const fidelity = fidelitySignals(p.accounting!);
    const g2Failures = fidelity.filter((s) => s.why.includes('G2'));
    expect(g2Failures).toEqual([]);
  });
});
