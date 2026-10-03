/**
 * P04 — Designer Doctor Foundation (RED-first). P05 adds a Consumption addendum below.
 *
 * `buildDoctorReport` is a PURE transform: it consumes the run's ALREADY-COMPUTED
 * diagnostic surface (RunHealth.delivered — the ledger-delivered AuthoritySignal[]
 * from composeRunHealth; PerRailEntry[] — the SAME per-rail residual validate()
 * already returns; Frozen[] — the SAME overlay entries overlay.ts already persists;
 * optionally AuthoringPlan for component linkage) and reframes them into a
 * DoctorReport. It runs no rail, calls no detect/apply, computes no score, and
 * mints no timestamp — every fact in a DoctorFinding traces back to an input field
 * verbatim (see the "consumes, does not recompute" describe block below).
 *
 * Mirrors the W18/P02 Foundation pattern: one immutable model, pure builder. AT P04
 * this had zero consumers (true then — the isolation test captured that snapshot).
 * P05 CONSUMPTION ADDENDUM: src/generate/validate-loop-driver.ts now consumes this
 * module as the canonical review-artifact builder — see test/doctor/doctor-
 * consumption.test.ts and test/doctor/doctor-report-io.test.ts for the P05 wiring
 * tests. The "zero consumers" test below was replaced with a whitelist ("exactly
 * EXPECTED_CONSUMERS"), the same P02→P03 transition applied to
 * test/platform-harness.test.ts. This file (doctor-report.ts) itself is UNCHANGED
 * since P04 — P05 only wires it in, per the brief's "consume P04 exactly as
 * authored".
 *
 * P12 ADDENDUM: src/designer-author/proposal-review.ts now also imports
 * `DoctorSeverity` (a TYPE-ONLY reuse of the existing four-level severity
 * taxonomy — informational/advisory/concern/critical — for proposal-quality
 * findings; see docs/internals/P12-DESIGNER-AUTHOR-PROPOSAL-REVIEW.md §3's
 * reuse matrix) — the SAME deliberate whitelist-growth pattern as every
 * prior P0x addendum. doctor-report.ts itself is unchanged this sprint.
 *
 * P18 ADDENDUM: src/designer-feedback/designer-feedback-subjects.ts now also
 * imports `DoctorFinding` (TYPE-ONLY — `feedbackSubjectForFinding` reads only
 * `finding.id`, the SAME join key doctor-report.ts already exposes) — see
 * docs/internals/P18-DESIGNER-FEEDBACK-FOUNDATION.md. doctor-report.ts itself
 * is unchanged this sprint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import {
  buildDoctorReport,
  severityFromAuthorityLevel,
  type DoctorReportInput,
  type DoctorReport,
  type DoctorFinding,
  type DoctorSeverity,
} from '../../src/doctor/doctor-report.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import type { Frozen } from '../../src/overlay.js';
import type { Operator, Finding } from '../../src/operator.js';
import type { AuthoringPlan } from '../../src/generate/types.js';

// ── Fixtures — hand-built, NOT produced by running any rail/validate/detect ────

function signal(over: Partial<AuthoritySignal> = {}): AuthoritySignal {
  return {
    producer: 'contrast',
    level: 'failure',
    where: 'contrast:hero',
    what: 'insufficient contrast',
    why: 'objective guarantee violation: WCAG AA contrast ratio',
    nature: 'objective',
    ...over,
  };
}

function health(delivered: AuthoritySignal[], goalMet = true, systematicRatio = 1): RunHealth {
  const failures = delivered.filter((s) => s.level === 'failure');
  const criticals = delivered.filter((s) => s.level === 'critical-warning');
  const warnings = delivered.filter((s) => s.level === 'warning');
  const status = failures.length > 0 ? 'failed' : criticals.length > 0 ? 'review-required' : 'success';
  return {
    headline: {
      status,
      goalMet,
      systematicRatio,
      failures,
      criticals,
      warnings,
      signalCount: delivered.length,
    },
    severed: { ok: true, severed: [], unregistered: [], rejected: [], failures: [] },
    delivered,
  };
}

function op(name: string, tier: 0 | 1 | 2): Operator {
  return { name, tier, detect: () => [], apply: () => [] };
}

function frozenEntry(id: string, findingIds: string[]): Frozen {
  return { id, pass: 'contrast', findingIds, decidedAt: '2026-01-01T00:00:00.000Z', decidedBy: 'test' };
}

function baseInput(over: Partial<DoctorReportInput> = {}): DoctorReportInput {
  return {
    subject: 'projects/example-brand/website',
    generatedAt: '2026-07-09T00:00:00.000Z',
    health: health([]),
    perRail: [],
    frozen: [],
    ...over,
  };
}

// ── Report construction ─────────────────────────────────────────────────────

describe('P04 — buildDoctorReport: report construction', () => {
  it('carries subject/generatedAt/headlineStatus/systematicRatio verbatim from the input — no recomputation', () => {
    const input = baseInput({
      health: health([], true, 0.8123),
      subject: 'projects/acme/collateral',
      generatedAt: '2026-03-01T12:00:00.000Z',
    });
    const report = buildDoctorReport(input);
    expect(report.subject).toBe('projects/acme/collateral');
    expect(report.generatedAt).toBe('2026-03-01T12:00:00.000Z');
    expect(report.headlineStatus).toBe(input.health.headline.status);
    expect(report.systematicRatio).toBe(0.8123);
  });

  it('produces exactly one DoctorFinding per delivered signal — 1:1, no fan-out or drop', () => {
    const delivered = [
      signal({ where: 'a', producer: 'contrast' }),
      signal({ where: 'b', producer: 'landmark-semantics', level: 'warning' }),
      signal({ where: 'c', producer: 'source-fidelity', level: 'information' }),
    ];
    const report = buildDoctorReport(baseInput({ health: health(delivered) }));
    expect(report.findings).toHaveLength(3);
    expect(report.findingCount).toBe(3);
    const ids = report.findings.map((f) => f.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('an empty delivered set produces an empty, valid report (no crash on the vacuous case)', () => {
    const report = buildDoctorReport(baseInput());
    expect(report.findings).toEqual([]);
    expect(report.findingCount).toBe(0);
  });
});

// ── Consumes, does not recompute (the falsification requirement) ───────────

describe('P04 — buildDoctorReport: consumes existing diagnostics, recomputes nothing', () => {
  it('what/why/rail on every finding are copied VERBATIM from the input signal (producer→rail, what→what, why→why)', () => {
    const s = signal({
      producer: 'brand-fidelity-scan',
      what: 'off-token color #123456',
      why: 'not traceable to a brand token',
      where: 'brand-fidelity-scan:#123456',
    });
    const report = buildDoctorReport(baseInput({ health: health([s]) }));
    const [finding] = report.findings;
    expect(finding.rail).toBe('brand-fidelity-scan');
    expect(finding.what).toBe('off-token color #123456');
    expect(finding.why).toBe('not traceable to a brand token');
    expect(finding.id).toBe('brand-fidelity-scan:#123456');
  });

  it('tier is read from the supplied perRail operator, never invented (a rail with no perRail entry has no tier)', () => {
    const withTier = buildDoctorReport(
      baseInput({
        health: health([signal({ producer: 'contrast', where: 'x' })]),
        perRail: [{ operator: op('contrast', 1), findings: [] }],
      }),
    );
    expect(withTier.findings[0].tier).toBe(1);

    const withoutTier = buildDoctorReport(
      baseInput({ health: health([signal({ producer: 'contrast', where: 'x' })]), perRail: [] }),
    );
    expect(withoutTier.findings[0].tier).toBeUndefined();
  });

  it('overlayId is resolved ONLY from the supplied frozen[] entries — a signal not covered by any Frozen carries no overlayId', () => {
    const withOverlay = buildDoctorReport(
      baseInput({
        health: health([signal({ producer: 'contrast', where: 'contrast:hero' })]),
        frozen: [frozenEntry('contrast:abc123', ['contrast:hero'])],
      }),
    );
    expect(withOverlay.findings[0].overlayId).toBe('contrast:abc123');

    const withoutOverlay = buildDoctorReport(
      baseInput({
        health: health([signal({ producer: 'contrast', where: 'contrast:hero' })]),
        frozen: [frozenEntry('contrast:other', ['contrast:some-other-finding'])],
      }),
    );
    expect(withoutOverlay.findings[0].overlayId).toBeUndefined();
  });

  it('component is resolved ONLY via the supplied plan (reusing the SAME anchor-matching mapFindingsToItems already uses) — no plan, no component', () => {
    const finding: Finding = { id: 'landmark-semantics:hero-section', description: 'x', outcome: 'escalated' };
    const plan = {
      items: [{ anchor: { id: 'hero-section' }, archetype: 'hero', fragmentId: 'hero-bento' }],
    } as unknown as AuthoringPlan;

    const withPlan = buildDoctorReport(
      baseInput({
        health: health([signal({ producer: 'landmark-semantics', where: finding.id })]),
        perRail: [{ operator: op('landmark-semantics', 1), findings: [finding] }],
        plan,
      }),
    );
    expect(withPlan.findings[0].component).toBe('hero-section');

    const withoutPlan = buildDoctorReport(
      baseInput({
        health: health([signal({ producer: 'landmark-semantics', where: finding.id })]),
        perRail: [{ operator: op('landmark-semantics', 1), findings: [finding] }],
      }),
    );
    expect(withoutPlan.findings[0].component).toBeUndefined();
  });

  it('structural (no forbidden imports): doctor-report.ts imports no rail/detect/scoring machinery', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../src/doctor/doctor-report.ts', import.meta.url)),
      'utf8',
    );
    // Only the IMPORT statements are checked — prose in doc comments (e.g. this very
    // module explaining "calls no runGate/validate") legitimately mentions these names
    // without importing them; only a real import is a re-detection/re-scoring risk.
    const importLines = src.split('\n').filter((line) => /^\s*import\b/.test(line));
    const importBlock = importLines.join('\n');
    const forbidden = [
      'runGate',
      'parseHtml',
      'RenderRuntime',
      'scoreFindingsByRail',
      "'../generate/validate.js'",
      "'../gate.js'",
      'defaultRegistry',
    ];
    const offenders = forbidden.filter((token) => importBlock.includes(token));
    expect(offenders, `forbidden re-detection/re-scoring import(s) found: ${offenders.join(', ')}`).toEqual([]);
  });
});

// ── Severity mapping (pure, total, derived from the existing AuthorityLevel) ─

describe('P04 — severityFromAuthorityLevel: total, deterministic mapping', () => {
  it('maps every AuthorityLevel to exactly one DoctorSeverity', () => {
    const cases: Array<[Parameters<typeof severityFromAuthorityLevel>[0], DoctorSeverity]> = [
      ['information', 'informational'],
      ['warning', 'advisory'],
      ['critical-warning', 'concern'],
      ['failure', 'critical'],
    ];
    for (const [level, expected] of cases) {
      expect(severityFromAuthorityLevel(level)).toBe(expected);
    }
  });
});

// ── Recommendations (closed vocabulary, deterministic decision table) ───────

describe('P04 — buildDoctorReport: recommendations are deterministic, never generative', () => {
  it('informational → no-action; advisory → monitor; concern → review-intent (P06: category-aware, superseding the P04 generic human-review)', () => {
    const report = buildDoctorReport(
      baseInput({
        health: health([
          signal({ where: 'i', level: 'information' }),
          signal({ where: 'w', level: 'warning' }),
          signal({ where: 'c', level: 'critical-warning', producer: 'intent-critic', nature: 'subjective' }),
        ]),
      }),
    );
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('i')!.recommendation.kind).toBe('no-action');
    expect(byId.get('w')!.recommendation.kind).toBe('monitor');
    // intent-critic → category 'intent' → P06's grounded review-intent, not the old generic human-review.
    expect(byId.get('c')!.recommendation.kind).toBe('review-intent');
  });

  it('critical + already frozen → review-overlay (a human already owns re-deciding it)', () => {
    const report = buildDoctorReport(
      baseInput({
        health: health([signal({ where: 'contrast:hero', level: 'failure' })]),
        frozen: [frozenEntry('contrast:abc', ['contrast:hero'])],
      }),
    );
    expect(report.findings[0].recommendation.kind).toBe('review-overlay');
  });

  it('critical + not frozen + resolvable component → reconsider-component', () => {
    const finding: Finding = { id: 'landmark-semantics:hero-section', description: 'x', outcome: 'escalated' };
    const plan = {
      items: [{ anchor: { id: 'hero-section' }, archetype: 'hero', fragmentId: 'hero-bento' }],
    } as unknown as AuthoringPlan;
    const report = buildDoctorReport(
      baseInput({
        health: health([signal({ producer: 'landmark-semantics', where: finding.id, level: 'failure' })]),
        perRail: [{ operator: op('landmark-semantics', 1), findings: [finding] }],
        plan,
      }),
    );
    expect(report.findings[0].recommendation.kind).toBe('reconsider-component');
  });

  it('critical + not frozen + no component → human-review (nothing more specific to say)', () => {
    const report = buildDoctorReport(
      baseInput({ health: health([signal({ where: 'brand-fidelity-scan:#fff', level: 'failure', producer: 'brand-fidelity-scan' })]) }),
    );
    expect(report.findings[0].recommendation.kind).toBe('human-review');
  });
});

// ── Category classification (structural vs content vs intent) ──────────────

describe('P04 — buildDoctorReport: category classification', () => {
  it('source-fidelity signals are "content"; intent-readiness/intent-critic are "intent"; everything else is "structural"', () => {
    const report = buildDoctorReport(
      baseInput({
        health: health([
          signal({ where: 'a', producer: 'source-fidelity' }),
          signal({ where: 'b', producer: 'intent-readiness' }),
          signal({ where: 'c', producer: 'intent-critic', level: 'critical-warning', nature: 'subjective' }),
          signal({ where: 'd', producer: 'contrast' }),
        ]),
      }),
    );
    const byId = new Map(report.findings.map((f) => [f.id, f]));
    expect(byId.get('a')!.category).toBe('content');
    expect(byId.get('b')!.category).toBe('intent');
    expect(byId.get('c')!.category).toBe('intent');
    expect(byId.get('d')!.category).toBe('structural');
  });
});

// ── Deterministic ordering ──────────────────────────────────────────────────

describe('P04 — buildDoctorReport: deterministic ordering', () => {
  it('orders by severity (critical first) then rail then id — same input order-independent', () => {
    const delivered = [
      signal({ where: 'w1', producer: 'zeta', level: 'warning' }),
      signal({ where: 'c1', producer: 'contrast', level: 'failure' }),
      signal({ where: 'i1', producer: 'alpha', level: 'information' }),
      signal({ where: 'c0', producer: 'alpha', level: 'failure' }),
    ];
    const report = buildDoctorReport(baseInput({ health: health(delivered) }));
    expect(report.findings.map((f) => f.id)).toEqual(['c0', 'c1', 'w1', 'i1']);

    // Reversed input order must yield the SAME output order — sort, not passthrough.
    const reversedReport = buildDoctorReport(baseInput({ health: health([...delivered].reverse()) }));
    expect(reversedReport.findings.map((f) => f.id)).toEqual(['c0', 'c1', 'w1', 'i1']);
  });
});

// ── Immutable findings / frozen transport ───────────────────────────────────

describe('P04 — immutability', () => {
  it('the DoctorReport and its findings array are frozen', () => {
    const report = buildDoctorReport(baseInput({ health: health([signal({ where: 'a' })]) }));
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.findings)).toBe(true);
    expect(Object.isFrozen(report.findings[0])).toBe(true);
  });

  it('mutating a frozen finding has no effect (strict-mode immutability)', () => {
    const report = buildDoctorReport(baseInput({ health: health([signal({ where: 'a' })]) }));
    expect(() => {
      // @ts-expect-error — deliberately violating readonly to prove runtime freeze
      report.findings[0].severity = 'informational';
    }).toThrow();
  });
});

// ── Deterministic replay ────────────────────────────────────────────────────

describe('P04 — deterministic replay', () => {
  it('the same input produces a deep-equal report on every call — no hidden clock/random state', () => {
    const input = baseInput({
      health: health([signal({ where: 'a' }), signal({ where: 'b', level: 'warning' })]),
      frozen: [frozenEntry('x', ['a'])],
    });
    const first: DoctorReport = buildDoctorReport(input);
    const second: DoctorReport = buildDoctorReport(input);
    expect(first).toEqual(second);
  });
});

// ── Foundation consumption — was "zero consumers" at P04; P05 wires the first
// real one (validate-loop-driver.ts), so this is now a whitelist, exactly the
// same P02→P03 transition applied to test/platform-harness.test.ts. ─────────

describe('P05 — Foundation consumption is exactly the expected surface (was "zero consumers" at P04)', () => {
  const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
  const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));
  const SCRIPTS_ROOT = fileURLToPath(new URL('../../scripts', import.meta.url));

  // The ONLY file P05 wires to import doctor-report.js — the lowest common consumer
  // seam both tracks (website + collateral) already funnel through. Any OTHER
  // importer is either an undocumented expansion (update this list deliberately)
  // or a regression (a second, competing Doctor wiring path).
  const EXPECTED_CONSUMERS = [
    'src/generate/validate-loop-driver.ts',
    'src/designer-author/proposal-review.ts',
    'src/designer-author/run-artifacts.ts',
    'src/designer-feedback/designer-feedback-subjects.ts',
    // P56 — the Doctor Contract Adapter: makes the P55 Generation Contract Doctor's official input
    // surface (sources subject/client/track from the contract, passes diagnostics through verbatim).
    // doctor-report.ts itself is UNCHANGED — this is the same deliberate whitelist growth as P05/P12/P18.
    'src/project/doctor-contract-adapter.ts',
  ];

  function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...collectTsFiles(full));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  it('the doctor-report.js importer set is exactly EXPECTED_CONSUMERS — no more, no fewer', () => {
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter(
      (f) => !f.replace(/\\/g, '/').endsWith('/src/doctor/doctor-report.ts'),
    );
    const actualConsumers: string[] = [];
    for (const file of candidates) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"](\.\.\/)*doctor\/doctor-report\.js['"]/.test(text)) {
        actualConsumers.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(actualConsumers.sort()).toEqual([...EXPECTED_CONSUMERS].sort());
  });
});
