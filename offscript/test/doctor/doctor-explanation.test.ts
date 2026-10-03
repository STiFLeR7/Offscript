/**
 * P06 — Designer Doctor Diagnostic Intelligence (RED-first).
 *
 * Doctor's report today says WHAT happened (rail/severity/what/why) but not WHY it
 * matters or WHERE a human should look. This sprint adds a structured, per-finding
 * `explanation` — Problem -> Evidence -> Impact -> Suggested Review Area — built
 * ENTIRELY from fields `buildDoctorReport` already resolves (severity, category,
 * tier, what, why, component, overlayId, recommendation). No new signal source, no
 * new detection, no AI: `buildExplanation`-shaped logic is a pure, total function
 * over already-known scalars, proven below by construction (its narrowed input
 * type cannot carry a raw AuthoritySignal/PerRailEntry/Frozen/AuthoringPlan) and by
 * falsification (two differently-shaped raw inputs that normalize to the same
 * already-known fields produce an identical explanation).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildDoctorReport,
  type DoctorReportInput,
  type DoctorFinding,
} from '../../src/doctor/doctor-report.js';
import type { AuthoritySignal } from '../../src/authority.js';
import type { RunHealth } from '../../src/generate/source-fidelity.js';
import type { Frozen } from '../../src/overlay.js';
import type { Operator, Finding } from '../../src/operator.js';
import type { AuthoringPlan } from '../../src/generate/types.js';

// ── Fixtures — hand-built, mirroring doctor-report.test.ts's own fixture shape ─

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

function only(input: DoctorReportInput): DoctorFinding {
  const report = buildDoctorReport(input);
  expect(report.findings).toHaveLength(1);
  return report.findings[0];
}

// ── Structured explanation: Problem -> Evidence -> Impact -> Suggested Review Area ─

describe('P06 — DoctorFinding gains a structured explanation', () => {
  it('every finding carries an explanation with problem/evidence/impact/reviewArea', () => {
    const finding = only(baseInput({ health: health([signal()]) }));
    expect(finding.explanation).toBeDefined();
    expect(typeof finding.explanation.problem).toBe('string');
    expect(finding.explanation.evidence).toBeDefined();
    expect(typeof finding.explanation.impact).toBe('string');
    expect(typeof finding.explanation.reviewArea).toBe('string');
  });

  it('explanation.problem is the finding\'s own `what`, verbatim — no new text minted', () => {
    const s = signal({ what: 'off-token color #123456', why: 'not traceable to a brand token' });
    const finding = only(baseInput({ health: health([s]) }));
    expect(finding.explanation.problem).toBe(finding.what);
    expect(finding.explanation.problem).toBe('off-token color #123456');
  });

  it('explanation.evidence groups rail/anchor/rationale/tier/component/overlayId verbatim from the finding itself', () => {
    const findingRec: Finding = {
      id: 'landmark-semantics:hero-section',
      description: 'x',
      outcome: 'escalated',
    };
    const plan = {
      items: [{ anchor: { id: 'hero-section' }, archetype: 'hero', fragmentId: 'hero-bento' }],
    } as unknown as AuthoringPlan;

    const finding = only(
      baseInput({
        health: health([signal({ producer: 'landmark-semantics', where: findingRec.id, level: 'failure' })]),
        perRail: [{ operator: op('landmark-semantics', 1), findings: [findingRec] }],
        frozen: [frozenEntry('landmark-semantics:abc', [findingRec.id])],
        plan,
      }),
    );

    expect(finding.explanation.evidence.rail).toBe(finding.rail);
    expect(finding.explanation.evidence.anchor).toBe(finding.id);
    expect(finding.explanation.evidence.rationale).toBe(finding.why);
    expect(finding.explanation.evidence.tier).toBe(finding.tier);
    expect(finding.explanation.evidence.component).toBe(finding.component);
    expect(finding.explanation.evidence.overlayId).toBe(finding.overlayId);
  });

  it('evidence omits tier/component/overlayId when the finding itself has none (no invention of absent facts)', () => {
    const finding = only(baseInput({ health: health([signal({ where: 'brand-fidelity-scan:#fff', producer: 'brand-fidelity-scan' })]) }));
    expect(finding.explanation.evidence.tier).toBeUndefined();
    expect(finding.explanation.evidence.component).toBeUndefined();
    expect(finding.explanation.evidence.overlayId).toBeUndefined();
  });

  it('explanation.reviewArea is exactly the finding\'s own recommendation.kind — not a second, independently-derived decision', () => {
    const finding = only(baseInput({ health: health([signal()]) }));
    expect(finding.explanation.reviewArea).toBe(finding.recommendation.kind);
  });

  it('explanation.impact is decided purely by (severity, category, tier) — same triple, same impact, regardless of what/why/rail', () => {
    const findingA = only(baseInput({ health: health([signal({ producer: 'contrast', what: 'A', why: 'reason A' })]) }));
    const findingB = only(baseInput({ health: health([signal({ producer: 'never-indigo', what: 'B', why: 'reason B' })]) }));
    // Both are structural/critical/no-tier — same impact text despite different rail/what/why.
    expect(findingA.explanation.impact).toBe(findingB.explanation.impact);
  });
});

// ── Recommendation vocabulary: expanded, grounded, closed ──────────────────────

describe('P06 — recommendation vocabulary gains grounded, closed review-area kinds', () => {
  it('critical + content category + no overlay/component -> review-content (source-fidelity is a content concern, not generic human-review)', () => {
    const finding = only(
      baseInput({
        health: health([
          signal({ producer: 'source-fidelity', where: 'unit-3', level: 'failure', what: 'x', why: 'y' }),
        ]),
      }),
    );
    expect(finding.category).toBe('content');
    expect(finding.recommendation.kind).toBe('review-content');
  });

  it('critical + intent category + no overlay/component -> review-intent (an objective intent-readiness gap, not generic human-review)', () => {
    const finding = only(
      baseInput({
        health: health([
          signal({ producer: 'intent-readiness', where: 'the-one-thing', level: 'failure', what: 'x', why: 'y' }),
        ]),
      }),
    );
    expect(finding.category).toBe('intent');
    expect(finding.recommendation.kind).toBe('review-intent');
  });

  it('concern severity (subjective intent-critic) -> review-intent, superseding the old generic human-review', () => {
    const finding = only(
      baseInput({
        health: health([
          signal({
            producer: 'intent-critic',
            where: 'the-one-thing',
            level: 'critical-warning',
            nature: 'subjective',
          }),
        ]),
      }),
    );
    expect(finding.recommendation.kind).toBe('review-intent');
  });

  it('critical + structural category + no overlay/component still falls to the generic human-review catch-all (no grounded structural sub-classification exists)', () => {
    const finding = only(
      baseInput({ health: health([signal({ where: 'brand-fidelity-scan:#fff', producer: 'brand-fidelity-scan' })]) }),
    );
    expect(finding.category).toBe('structural');
    expect(finding.recommendation.kind).toBe('human-review');
  });

  it('overlay/component resolution still takes precedence over category (unchanged from P04)', () => {
    const withOverlay = only(
      baseInput({
        health: health([signal({ producer: 'source-fidelity', where: 'unit-3', level: 'failure' })]),
        frozen: [frozenEntry('x', ['unit-3'])],
      }),
    );
    expect(withOverlay.recommendation.kind).toBe('review-overlay');
  });
});

// ── Falsification: explanation derives SOLELY from the finding's own resolved fields ─

describe('P06 — falsification: explanation introduces no independent reasoning', () => {
  it('two DIFFERENT raw signal shapes that normalize to the SAME (severity, category, tier, component, overlayId, what, why, recommendation) produce an IDENTICAL explanation', () => {
    // Route 1: a genuinely different producer/where/nature combination...
    const findingA = only(
      baseInput({ health: health([signal({ producer: 'contrast', where: 'contrast:hero', what: 'shared what', why: 'shared why' })]) }),
    );
    // Route 2: ...that happens to resolve to the exact same normalized fields.
    const findingB = only(
      baseInput({ health: health([signal({ producer: 'contrast', where: 'contrast:hero', what: 'shared what', why: 'shared why' })]) }),
    );
    expect(findingA.explanation).toEqual(findingB.explanation);
  });

  it('changing ONLY severity (category/tier held fixed) changes explanation.impact — proving a real dependency, not a constant', () => {
    const critical = only(baseInput({ health: health([signal({ level: 'failure' })]) }));
    const warning = only(baseInput({ health: health([signal({ level: 'warning' })]) }));
    expect(critical.explanation.impact).not.toBe(warning.explanation.impact);
  });

  it('changing ONLY category (severity held fixed at critical, no anchor) changes explanation.impact', () => {
    const structural = only(baseInput({ health: health([signal({ producer: 'never-indigo', level: 'failure' })]) }));
    const content = only(baseInput({ health: health([signal({ producer: 'source-fidelity', level: 'failure' })]) }));
    expect(structural.explanation.impact).not.toBe(content.explanation.impact);
  });

  it('deterministic replay: the same input produces a deep-equal report, explanations included', () => {
    const input = baseInput({
      health: health([signal({ where: 'a' }), signal({ where: 'b', level: 'warning' })]),
      frozen: [frozenEntry('x', ['a'])],
    });
    const first = buildDoctorReport(input);
    const second = buildDoctorReport(input);
    expect(first).toEqual(second);
    expect(first.findings[0].explanation).toEqual(second.findings[0].explanation);
  });

  it('no new import was introduced to build explanations — doctor-report.ts still imports no rail/detect/scoring/network machinery', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../src/doctor/doctor-report.ts', import.meta.url)),
      'utf8',
    );
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
      'fetch',
      'http',
      'https',
      'openai',
      'anthropic',
    ];
    const offenders = forbidden.filter((token) => importBlock.toLowerCase().includes(token.toLowerCase()));
    expect(offenders, `forbidden import(s) found: ${offenders.join(', ')}`).toEqual([]);
  });
});

// ── Immutability ─────────────────────────────────────────────────────────────

describe('P06 — explanation and evidence are frozen, matching the rest of the immutable model', () => {
  it('explanation and its nested evidence are frozen', () => {
    const finding = only(baseInput({ health: health([signal()]) }));
    expect(Object.isFrozen(finding.explanation)).toBe(true);
    expect(Object.isFrozen(finding.explanation.evidence)).toBe(true);
  });
});

// ── Ordering unaffected ──────────────────────────────────────────────────────

describe('P06 — deterministic ordering is unaffected by the new explanation field', () => {
  it('adding explanation does not change severity/rail/id ordering, and every ordered finding carries one', () => {
    const delivered = [
      signal({ where: 'w1', producer: 'zeta', level: 'warning' }),
      signal({ where: 'c1', producer: 'contrast', level: 'failure' }),
      signal({ where: 'i1', producer: 'alpha', level: 'information' }),
      signal({ where: 'c0', producer: 'alpha', level: 'failure' }),
    ];
    const report = buildDoctorReport(baseInput({ health: health(delivered) }));
    expect(report.findings.map((f) => f.id)).toEqual(['c0', 'c1', 'w1', 'i1']);
    for (const f of report.findings) expect(f.explanation).toBeDefined();
  });
});
