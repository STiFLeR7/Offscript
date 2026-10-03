/**
 * Sprint W4 — the Governed Reasoning verification harness.
 *
 * A single command that verifies the Governed Reasoning Runtime obeys its invariants. It VALIDATES
 * reasoning; it never participates in the generate pipeline. It drives the runtime through its public
 * entry (runGovernedReasoning + injected deps) and emits a structured report. Mirrors the World-A
 * derivation harness (verify-derivation.ts) in shape — never throws on a finding; records a failed
 * check and continues.
 *
 * Dimensions:
 *   existence     — a reasoning artifact exists, with ≥1 WHY field
 *   immutability  — the reasoning + its evidence are deep-frozen
 *   evidence      — the full evidence chain is present + well-formed (reasoner, snapshot id,
 *                   brief identity, version, trace id)
 *   governance    — the recorded governance snapshot id matches the acquired grounding (versioned)
 *   replay        — recipe replay: the trace id recomputes from the persisted artifact, NO reasoner
 *   transport     — the reasoning is a valid SectionReasoning (W1/W2 transport-ready)
 *
 * Per GRR §7.3 the replay dimension is RECIPE-replay (recompute identity from the persisted
 * artifact), NOT reasoner-replay — correct under a non-deterministic reasoner.
 */
import { hasReasoning, validateReasoning } from '../section-reasoning.js';
import type { ReasoningContext } from './types.js';
import {
  runGovernedReasoning,
  computeTraceId,
  validateEvidence,
  REASONING_RUNTIME_VERSION,
  type GovernedReasoning,
  type GovernedReasoningDeps,
} from './governed-producer.js';

export const REASONING_HARNESS_VERSION = '0.1.0';

const SHA = /^sha256:[0-9a-f]{64}$/;
const REASONING_DIMENSIONS = ['existence', 'immutability', 'evidence', 'governance', 'replay', 'transport'] as const;
export type ReasoningCheckCategory = (typeof REASONING_DIMENSIONS)[number];

export interface ReasoningCheck {
  readonly category: ReasoningCheckCategory;
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface GovernedReasoningReport {
  readonly ok: boolean;
  readonly harnessVersion: string;
  readonly sectionId: string;
  readonly traceId: string;
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly byCategory: Record<ReasoningCheckCategory, { passed: number; failed: number }>;
  };
  readonly checks: readonly ReasoningCheck[];
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value as Record<string, unknown>).every(deepFrozen);
}

type Checks = ReasoningCheck[];
function check(out: Checks, category: ReasoningCheckCategory, name: string, passed: boolean, detail = ''): void {
  out.push({ category, name, passed, detail });
}

/**
 * Verify one governed reasoning run end-to-end and produce a report. Runs the runtime once, then
 * checks the artifact + re-acquires the snapshot to confirm the recorded id, and recomputes the
 * trace id from the artifact (recipe replay). Never throws on a finding; a runtime that fails the
 * lifecycle (e.g. missing governance) is recorded as a failed `existence` check.
 */
export async function verifyGovernedReasoning(
  deps: GovernedReasoningDeps,
  context: ReasoningContext,
): Promise<GovernedReasoningReport> {
  const out: Checks = [];
  const sectionId = context?.item?.anchor?.id ?? '';

  let artifact: GovernedReasoning | undefined;
  try {
    artifact = await runGovernedReasoning(deps, context);
  } catch (e) {
    check(out, 'existence', 'runtime completes the lifecycle', false, e instanceof Error ? e.message : String(e));
    return finalize(out, sectionId, '');
  }
  if (!artifact) {
    check(out, 'existence', 'reasoning artifact exists', false, 'the reasoning unit declined (no artifact)');
    return finalize(out, sectionId, '');
  }

  // existence
  check(out, 'existence', 'reasoning artifact exists', true);
  check(out, 'existence', 'reasoning carries at least one WHY field', hasReasoning(artifact.reasoning));

  // immutability
  check(out, 'immutability', 'reasoning is deep-frozen', deepFrozen(artifact.reasoning));
  check(out, 'immutability', 'evidence is deep-frozen', deepFrozen(artifact.evidence));

  // transport
  const transportProblems = validateReasoning(artifact.reasoning);
  check(out, 'transport', 'reasoning is a valid SectionReasoning (W1/W2 transport-ready)', transportProblems.length === 0, transportProblems.join('; '));

  // evidence
  const ev = artifact.evidence;
  let evidenceWellFormed = true;
  try {
    validateEvidence(ev);
  } catch (e) {
    evidenceWellFormed = false;
    check(out, 'evidence', 'evidence chain is well-formed', false, e instanceof Error ? e.message : String(e));
  }
  if (evidenceWellFormed) {
    check(out, 'evidence', 'evidence chain is well-formed', true);
    check(out, 'evidence', 'reasoner recorded (provider-agnostic name)', typeof ev.reasoner === 'string' && ev.reasoner.length > 0, ev.reasoner);
    check(out, 'evidence', 'brief identity is a content hash', SHA.test(ev.briefIdentity));
    check(out, 'evidence', 'reasoning version recorded', ev.reasoningVersion === REASONING_RUNTIME_VERSION, ev.reasoningVersion);
    check(out, 'evidence', 'trace id is a content hash', SHA.test(ev.traceId));
  }

  // governance — the recorded snapshot id must be a hash AND match the acquired grounding
  check(out, 'governance', 'governance snapshot id is a content hash', SHA.test(ev.governanceSnapshotId), ev.governanceSnapshotId);
  try {
    const snap = await deps.acquireSnapshot(context);
    check(out, 'governance', 'recorded snapshot id matches the acquired grounding', !!snap && snap.id === ev.governanceSnapshotId, '');
  } catch (e) {
    check(out, 'governance', 'recorded snapshot id matches the acquired grounding', false, e instanceof Error ? e.message : String(e));
  }

  // replay — recipe replay: recompute the trace id from the persisted artifact, NO reasoner call
  const recomputed = computeTraceId({
    reasoner: ev.reasoner,
    governanceSnapshotId: ev.governanceSnapshotId,
    briefIdentity: ev.briefIdentity,
    reasoningVersion: ev.reasoningVersion,
    sectionId,
    reasoning: artifact.reasoning,
  });
  check(out, 'replay', 'recipe replay reproduces the trace id (no reasoner)', recomputed === ev.traceId, '');

  return finalize(out, sectionId, ev.traceId);
}

function finalize(out: Checks, sectionId: string, traceId: string): GovernedReasoningReport {
  const byCategory = Object.fromEntries(
    REASONING_DIMENSIONS.map((c) => [c, { passed: 0, failed: 0 }]),
  ) as Record<ReasoningCheckCategory, { passed: number; failed: number }>;
  let passed = 0;
  for (const c of out) {
    if (c.passed) {
      passed++;
      byCategory[c.category].passed++;
    } else {
      byCategory[c.category].failed++;
    }
  }
  return {
    ok: passed === out.length && out.length > 0,
    harnessVersion: REASONING_HARNESS_VERSION,
    sectionId,
    traceId,
    summary: { total: out.length, passed, failed: out.length - passed, byCategory },
    checks: out,
  };
}

/** Stable canonical text of a report — for snapshotting / equality in tests. */
export function governedReasoningReportText(report: GovernedReasoningReport): string {
  return JSON.stringify(report, Object.keys(report).sort(), 2);
}
