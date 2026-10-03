/**
 * V3 Foundation Hardening — GAP-1 / GAP-2 / GAP-3.
 *
 * Surgical hardening of the v3 foundation (V3-FOUNDATION-HARDENING-PLAN.md). No new
 * concepts; frozen guarantees/accounting/producer logic. Each gap:
 *   GAP-1 — engine-default padding must reach the fidelity classifier → Warning (not
 *           G4 Failure). The producer already supports the downgrade; this proves the
 *           planner now DECLARES padding identity and the single G4 decision point
 *           classifies it correctly.
 *   GAP-2 — Warnings must be visible in the headline regardless of status (no silent
 *           SUCCESS over a degraded run). Status precedence is UNCHANGED.
 *   GAP-3 — the declared-but-missing source-doc diagnostic must reach a surfaced
 *           channel (plan().warnings carries it; the runtime loop prints it).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { fidelitySignals } from '../../src/generate/source-fidelity.js';
import type { SourceAccounting } from '../../src/generate/source-accounting.js';
import { buildRunHeadline, formatRunHeadline } from '../../src/run-headline.js';
import type { AuthoritySignal } from '../../src/authority.js';
import { makeBriefFixture } from './_brief-fixture.js';

// ── GAP-1 ────────────────────────────────────────────────────────────────────

describe('GAP-1 — engine-default padding is classified as Warning, not G4 Failure', () => {
  const FIXTURE = '__hardening_gap1__';
  const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE);
  afterEach(() => rmSync(projectDir(FIXTURE), { recursive: true, force: true }));

  it('plan() declares the engine-default padding consumer ids (planner-owned DATA)', () => {
    scaffoldClient();
    writeBrief(['Hero', 'Pricing'], 'website', ''); // sub-floor → floor-padding kicks in
    const p = plan(buildContext(FIXTURE, 'website'));

    expect(p.enginePaddingConsumerIds).toBeDefined();
    expect(p.enginePaddingConsumerIds!.length).toBeGreaterThan(0);
    // padding consumers are, by definition, ungrounded in the accounting
    for (const id of p.enginePaddingConsumerIds!) {
      expect(p.accounting!.ungroundedConsumerIds).toContain(id);
    }
  });

  it('feeding the padding ids flips those G4 Failures to Warnings (the live fix)', () => {
    scaffoldClient();
    writeBrief(['Hero', 'Pricing'], 'website', '');
    const p = plan(buildContext(FIXTURE, 'website'));

    // BEFORE the fix (no opt): padding sections are G4 Failures.
    const before = fidelitySignals(p.accounting!);
    const beforePaddingFailures = before.filter(
      (s) => s.level === 'failure' && p.enginePaddingConsumerIds!.includes(s.where),
    );
    expect(beforePaddingFailures.length).toBeGreaterThan(0);

    // AFTER the fix (padding ids supplied): zero padding Failures; all padding → Warning.
    const after = fidelitySignals(p.accounting!, {
      enginePaddingConsumerIds: p.enginePaddingConsumerIds,
    });
    const afterPaddingFailures = after.filter(
      (s) => s.level === 'failure' && p.enginePaddingConsumerIds!.includes(s.where),
    );
    expect(afterPaddingFailures).toHaveLength(0);
    for (const id of p.enginePaddingConsumerIds!) {
      const sig = after.find((s) => s.where === id);
      expect(sig?.level).toBe('warning');
    }
  });

  it('a genuine authored-from-void consumer still produces a G4 Failure', () => {
    const accounting: SourceAccounting = {
      units: [],
      consumers: [],
      extractedCount: 3,
      boundUnitSlugs: [],
      unmatchedUnitSlugs: [],
      unusedUnitSlugs: [],
      groundedConsumerIds: [],
      ungroundedConsumerIds: ['genuine-void', 'pad-1'],
      briefGroundedConsumerIds: [],
      sourceDocGroundedConsumerIds: [],
    };
    const signals = fidelitySignals(accounting, {
      briefSupplied: true,
      enginePaddingConsumerIds: ['pad-1'],
    });
    expect(signals.find((s) => s.where === 'genuine-void')?.level).toBe('failure');
    expect(signals.find((s) => s.where === 'pad-1')?.level).toBe('warning');
  });
});

// ── GAP-2 ────────────────────────────────────────────────────────────────────

function sig(level: AuthoritySignal['level'], where: string): AuthoritySignal {
  return { producer: 'source-fidelity', level, where, what: `${level} at ${where}`, why: 'test', nature: 'objective' };
}

describe('GAP-2 — warnings are visible in the headline regardless of status', () => {
  it('buildRunHeadline exposes warnings as their own axis (status precedence unchanged)', () => {
    const h = buildRunHeadline({ signals: [sig('warning', 'a'), sig('warning', 'b')], goalMet: true, systematicRatio: 1 });
    expect(h.status).toBe('success'); // warnings NEVER change status
    expect(h.warnings).toHaveLength(2);
  });

  it('a SUCCESS run with warnings no longer renders completely clean', () => {
    // distinctive `where` token so the assertion cannot be satisfied by the existing
    // "Critical Warnings" boilerplate — it must be the warning actually being surfaced.
    const h = buildRunHeadline({ signals: [sig('warning', 'coarse-seg-xyz')], goalMet: true, systematicRatio: 1 });
    const text = formatRunHeadline(h);
    expect(h.status).toBe('success');
    expect(text).toMatch(/SUCCESS/);
    expect(text).toContain('coarse-seg-xyz'); // the warning content is surfaced, not hidden
  });

  it('warnings remain visible under REVIEW REQUIRED and FAILED', () => {
    const review = formatRunHeadline(
      buildRunHeadline({ signals: [sig('critical-warning', 'crit-aaa'), sig('warning', 'warn-bbb')], goalMet: true, systematicRatio: 1 }),
    );
    const failed = formatRunHeadline(
      buildRunHeadline({ signals: [sig('failure', 'fail-ccc'), sig('warning', 'warn-ddd')], goalMet: false, systematicRatio: 0.8 }),
    );
    expect(review).toMatch(/REVIEW REQUIRED/);
    expect(review).toContain('warn-bbb'); // warning surfaced alongside the critical
    expect(failed).toMatch(/FAILED/);
    expect(failed).toContain('warn-ddd'); // warning surfaced alongside the failure
  });

  it('status semantics are unchanged (warnings never gate or escalate)', () => {
    expect(buildRunHeadline({ signals: [sig('failure', 'f')], goalMet: true, systematicRatio: 1 }).status).toBe('failed');
    expect(buildRunHeadline({ signals: [sig('critical-warning', 'c')], goalMet: true, systematicRatio: 1 }).status).toBe('review-required');
    expect(buildRunHeadline({ signals: [sig('information', 'i')], goalMet: true, systematicRatio: 1 }).status).toBe('success');
  });
});

// ── GAP-3 ────────────────────────────────────────────────────────────────────

describe('GAP-3 — the declared-but-missing source-doc diagnostic reaches a surfaced channel', () => {
  const FIXTURE = '__hardening_gap3__';
  const { scaffoldClient } = makeBriefFixture(FIXTURE);
  afterEach(() => rmSync(projectDir(FIXTURE), { recursive: true, force: true }));

  it('plan().warnings carries the source-doc-not-found diagnostic (the data the runtime surfaces)', () => {
    scaffoldClient();
    const refs = projectReferencesDir(FIXTURE);
    // a collateral brief that DECLARES a source-doc which does not exist on disk
    const brief = [
      '---',
      'schemaVersion: 1',
      'track: collateral',
      'one-liner: "Test"',
      'audience: "Devs"',
      'goals:',
      '  - Drive signups',
      'must-include:',
      '  - "Overview"',
      'source-doc: nonexistent-source.md',
      '---',
      'Body copy.',
    ].join('\n');
    writeFileSync(join(refs, 'brief.md'), brief, 'utf8');

    const p = plan(buildContext(FIXTURE, 'collateral'));
    expect(p.warnings.some((w) => /was not found under/.test(w))).toBe(true);
  });
});
