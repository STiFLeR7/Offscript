/**
 * E6 — Execution Admission: the deterministic gate a caller consults BEFORE letting a session begin
 * (E3/E4). It performs no execution and mutates nothing — it only evaluates, from an already-built
 * `ExecutionPipelineResult` (E2), whether execution is admissible right now. No AI, no browser, no
 * regeneration.
 *
 * Ownership (`docs/execution/E6-EXECUTION-ADMISSION.md` §2 for the full grounding):
 *   1. **What execution already guarantees (re-confirmed by re-reading the source):** E3
 *      (`native-review-execution.ts`) already guarantees an HONEST post-hoc report — including its
 *      own structural-integrity check (`stagesComplete`/`referencesConsistent`), which produces
 *      `FAILED` for a malformed `ExecutionPipelineResult`. This module does NOT re-check that
 *      structural invariant — E2's `orchestrateExecution` always builds a well-formed result by
 *      construction, and re-verifying construction-time guarantees here would be exactly the kind
 *      of redundant re-derivation this program's own modules consistently avoid.
 *   2. **Which checks belong BEFORE execution:** whether the underlying REVIEW is even in a state
 *      that makes attempting execution meaningful — i.e. R6's own `ReadinessDecision`, already
 *      computed and sitting on `pipelineResult.contract.references.readiness`. Nothing currently
 *      gates E3/E4 on this — they run unconditionally and merely REPORT the readiness afterward.
 *      This module is the explicit, addressable PRE-FLIGHT decision point a future orchestrating
 *      caller checks first (§7 of the report) — never wired into E3/E4 itself, the same "ships the
 *      gate, proves it correct, leaves the wiring to a future sprint" posture R6 §8 and every
 *      "Future X integration" section in this program already holds.
 *   3. **Which checks belong INSIDE execution:** E3's own structural-integrity check — that stays
 *      exactly where it is; this module never duplicates it.
 *
 * **Reuse, never re-decide (RULES: "Never duplicate R6 logic. Reuse where possible.")** The default
 * `ExecutionAdmissionRule` copies R6's OWN blockers VERBATIM — `category`/`severity`/`reason`/
 * `resolution` untouched, tagged with a `source` provenance string — exactly the recipe R8's own
 * `deriveConstraints` already used for the identical situation. `ExecutionAdmission` (this module's
 * state enum) is a pure RELABELING of R6's `RegenerationReadiness` vocabulary — `READY→ADMITTED`,
 * `WAITING_FOR_WORKSPACE`/`WAITING_FOR_PROJECT→WAITING` (collapsed, since from admission's own
 * perspective both simply mean "not yet, but resolvable"), `BLOCKED→BLOCKED`, `INVALID→INVALID`,
 * `UNKNOWN→UNKNOWN` — never a re-decision of WHICH categories are blocking or how severe they are;
 * `ExecutionAdmissionRule` is injectable (mirroring R6's own `RegenerationReadinessPolicy` seam)
 * precisely so `state` remains genuinely responsive to whatever blockers a future rule returns,
 * rather than being hardcoded to ignore the injection point.
 */
import type { ExecutionPipelineResult } from './review-execution-orchestration.js';
import type { ReadinessBlockerCategory, ReadinessBlockerSeverity } from '../review/regeneration-readiness.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const EXECUTION_ADMISSION_VERSION_TAG = 'e6-execution-admission@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, EXECUTION_ADMISSION_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

/** Explicit states — never a boolean (STATE). A pure relabeling of R6's `RegenerationReadiness`
 *  (header note, "Reuse, never re-decide"). */
export type ExecutionAdmission = 'ADMITTED' | 'WAITING' | 'BLOCKED' | 'INVALID' | 'UNKNOWN';

/** `category`/`severity` are REUSED from R6's own vocabulary (never a parallel one invented);
 *  `reason`/`resolution` are copied VERBATIM from the underlying `ReadinessBlocker` — never
 *  re-authored. `source` is a provenance tag, the same pattern R8's `ExecutionConstraint.source`
 *  already established. */
export interface ExecutionAdmissionBlocker {
  readonly category: ReadinessBlockerCategory;
  readonly severity: ReadinessBlockerSeverity;
  readonly reason: string;
  readonly resolution: string;
  readonly source: string;
}

/** A compact, construction-consistent index over data this module derives — mirrors R8's own
 *  `ExecutionManifest` / E3's `ExecutionDiagnostics` posture. */
export interface ExecutionAdmissionSummary {
  readonly blockerCount: number;
  readonly blockingBlockerCount: number;
  readonly warningBlockerCount: number;
  readonly executableTaskCount: number;
  readonly blockedTaskCount: number;
}

export interface ExecutionAdmissionDecision {
  readonly sessionId: string;
  readonly state: ExecutionAdmission;
  readonly blockers: readonly ExecutionAdmissionBlocker[];
  readonly summary: ExecutionAdmissionSummary;
  /** The exact `ExecutionPipelineResult` this decision was evaluated against — a reference, never
   *  duplicated (VALIDATION: "Reference identity preserved... Pipeline untouched"). */
  readonly pipeline: ExecutionPipelineResult;
  readonly digest: string;
}

/** Injectable — mirrors R6's own `RegenerationReadinessPolicy` seam. The default implementation
 *  invents no new logic; it only re-exposes R6's own already-computed blockers. */
export interface ExecutionAdmissionRule {
  evaluate(pipelineResult: ExecutionPipelineResult): readonly ExecutionAdmissionBlocker[];
}

export interface ExecutionAdmissionEvaluator {
  decide(pipelineResult: ExecutionPipelineResult, rule?: ExecutionAdmissionRule): ExecutionAdmissionDecision;
}

/** Every real blocker R6 already found, copied verbatim — including WARNING severity, so a caller
 *  sees the full picture (R6's own "every real issue found is reported, not just the winning one"
 *  philosophy, reused here unchanged). */
export function createDefaultExecutionAdmissionRule(): ExecutionAdmissionRule {
  return {
    evaluate(pipelineResult) {
      return pipelineResult.contract.references.readiness.blockers.map(
        (b): ExecutionAdmissionBlocker => ({
          category: b.category,
          severity: b.severity,
          reason: b.reason,
          resolution: b.resolution,
          source: `r6:${b.category}`,
        }),
      );
    },
  };
}

const ADMISSION_BY_CATEGORY: Record<ReadinessBlockerCategory, ExecutionAdmission> = {
  INVALID_INPUT: 'INVALID',
  WORKSPACE_MISSING: 'WAITING',
  PROJECT_NOT_GENERATED: 'WAITING',
  WORKSPACE_UNHEALTHY: 'BLOCKED',
  UNRESOLVED_SCOPE: 'BLOCKED',
  INDETERMINATE_CAPABILITY: 'UNKNOWN',
};

const ADMISSION_RANK: Record<ExecutionAdmission, number> = { INVALID: 0, WAITING: 1, BLOCKED: 2, UNKNOWN: 3, ADMITTED: 4 };

/** Worst-of-BLOCKING-severity reduction — the same shape as R6's own `deriveState`, operating on
 *  THIS module's own (reused-category) blockers, so `state` stays genuinely responsive to whatever
 *  a custom `ExecutionAdmissionRule` returns rather than being hardcoded to the default rule. */
function deriveAdmissionState(blockers: readonly ExecutionAdmissionBlocker[]): ExecutionAdmission {
  const blocking = blockers.filter((b) => b.severity === 'BLOCKING');
  if (blocking.length === 0) return 'ADMITTED';
  return blocking.reduce<ExecutionAdmission>((worst, b) => {
    const candidate = ADMISSION_BY_CATEGORY[b.category];
    return ADMISSION_RANK[candidate] < ADMISSION_RANK[worst] ? candidate : worst;
  }, 'ADMITTED');
}

export function createExecutionAdmissionEvaluator(): ExecutionAdmissionEvaluator {
  return {
    decide(pipelineResult, rule = createDefaultExecutionAdmissionRule()) {
      const blockers = Object.freeze(rule.evaluate(pipelineResult).map((b) => Object.freeze({ ...b })));
      const state = deriveAdmissionState(blockers);
      const summary: ExecutionAdmissionSummary = Object.freeze({
        blockerCount: blockers.length,
        blockingBlockerCount: blockers.filter((b) => b.severity === 'BLOCKING').length,
        warningBlockerCount: blockers.filter((b) => b.severity === 'WARNING').length,
        executableTaskCount: pipelineResult.contract.scope.executableTaskIds.length,
        blockedTaskCount: pipelineResult.contract.scope.blockedTaskIds.length,
      });

      const core = {
        sessionId: pipelineResult.identity.sessionId,
        state,
        blockers,
        summary,
        pipeline: pipelineResult,
      };
      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors R6/E1–E5's own convenience-function idiom. */
export function evaluateExecutionAdmission(
  pipelineResult: ExecutionPipelineResult,
  evaluator: ExecutionAdmissionEvaluator = createExecutionAdmissionEvaluator(),
  rule?: ExecutionAdmissionRule,
): ExecutionAdmissionDecision {
  return evaluator.decide(pipelineResult, rule);
}
