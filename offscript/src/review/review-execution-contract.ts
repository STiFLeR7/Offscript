/**
 * R8 — Review Execution Contract: the immutable, content-addressed contract bridging the
 * deterministic Review Platform (R1–R7) to future execution. Pure derivation over a
 * `ReviewPipelineResult` (R7) — nothing executes, nothing new is planned or evaluated, nothing is
 * persisted. No AI, no browser, no HTML.
 *
 * Ownership (`docs/review/R8-REVIEW-EXECUTION-CONTRACT.md` §2/§6 for the full grounding):
 *   1. **How P55 separates planning from execution** (`docs/internals/P55-...md`, read-only
 *      precedent — P55's own source no longer exists in this repo, superseded by later
 *      legacy-retirement sprints; this module is grounded in the DOCUMENTED pattern, not live
 *      code): `evaluateReadiness → planGeneration → immutable GenerationPlan` — the plan is a
 *      pure, content-addressed SNAPSHOT of "what would happen," never itself an executor; a future,
 *      separate execution engine reads it through read-only accessors and never mutates it; a
 *      changed input requires a NEW plan, never an in-place edit.
 *   2. **Principles transferred from P55, verbatim in spirit:** content-addressed digest identity
 *      (`contractId === digest === manifest.checksum`, mirroring P55's "checksum === planId");
 *      "reference, never duplicate" upstream artifacts (already Program R's own convention since
 *      R3, continued here for the full R1–R7 chain); a self-verifying integrity check (re-hash and
 *      compare, mirroring P55's `verifyPlanIntegrity`); explicit TYPED constraint records, never
 *      free prose (mirrors P55's `{id,kind,description,source}` exactly); a manifest as a compact,
 *      construction-consistent INDEX; "the planner is the what, a future engine is the how" — this
 *      module ships ONLY the contract + verification, no execution engine.
 *   3. **A genuine upgrade, not previously present in Program R:** P55's plan is DEEP-frozen
 *      (`deepFreeze`, recursive) — R1–R7's own outputs are only frozen at the top level and at
 *      explicitly-wrapped arrays (e.g. R3's `ReviewDependency` objects inside a frozen array were
 *      never individually frozen). This module is the first in Program R to implement a real,
 *      recursive `deepFreeze` — applied to everything THIS module itself constructs (`scope`,
 *      `constraints`, `manifest`). It deliberately does NOT recurse into the REFERENCED R1–R7
 *      artifacts' own internals — `references` is frozen one level only — so this module never
 *      reaches into data it does not own, even just to freeze it further (RULES: "Never modify
 *      Review artifacts").
 *   4. **Review-specific fields with no P55 analog:** `ExecutionScope.executableTaskIds`/
 *      `.blockedTaskIds`/`.units` (P55's scope is deliverable-level, not task-level — Program R has
 *      no deliverable concept); constraints derived from `ReadinessDecision.blockers` (P55's derive
 *      from strategy/risk/approvals, a domain Program R has no analog for). P55 fields with no
 *      Program R analog, deliberately omitted rather than fabricated: `objective`, `brandContext`,
 *      `assumptions`, `supersedes` (no persisted prior contract exists to supersede — PERSISTENCE:
 *      "never persisted").
 */
import type { ReviewPipelineResult } from './review-orchestration.js';
import type { ReviewSession } from './review-session.js';
import type { ReviewAnalysis } from './review-analysis.js';
import type { ReviewPlan } from './review-planning.js';
import type { ReviewScope } from './review-scope.js';
import type { RegenerationPlan, RegenerationUnit } from './regeneration-planning.js';
import type { ReadinessDecision, ReadinessBlockerCategory } from './regeneration-readiness.js';
import { canonicalizeStructural, versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_EXECUTION_CONTRACT_VERSION_TAG = 'r8-review-execution-contract@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_EXECUTION_CONTRACT_VERSION_TAG);
}

/** Genuine recursive freeze — the first in Program R (header note 3). Applied only to structures
 *  THIS module owns; never called on a referenced R1–R7 artifact. Idempotent and cycle-safe (this
 *  program's data is always tree-shaped, never circular). */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

/** Direct object references to every R1–R7 artifact this contract is derived from — never a copy,
 *  never a restructured projection. Frozen one level only (header note 3). */
export interface ExecutionReferences {
  readonly session: ReviewSession;
  readonly analysis: ReviewAnalysis;
  readonly plan: ReviewPlan;
  readonly scope: ReviewScope;
  readonly regenerationPlan: RegenerationPlan;
  readonly readiness: ReadinessDecision;
}

export interface ExecutionScope {
  /** Mirrors `ReadinessDecision.state` exactly — never re-derived, only carried through for
   *  scope-level convenience (the same "compact index" posture P55's manifest holds). */
  readonly readinessState: ReadinessDecision['state'];
  readonly executableTaskIds: readonly string[];
  readonly blockedTaskIds: readonly string[];
  readonly units: readonly RegenerationUnit[];
}

export type ExecutionConstraintKind = 'capability' | 'boundary' | 'scope' | 'workspace';

export interface ExecutionConstraint {
  readonly id: string;
  readonly kind: ExecutionConstraintKind;
  readonly description: string;
  readonly source: string;
}

export interface ExecutionManifest {
  readonly contractId: string;
  readonly checksum: string;
  readonly client: string;
  readonly track: ReviewSession['track'];
  readonly sessionId: string;
  readonly readiness: ReadinessDecision['state'];
  readonly taskCount: number;
  readonly executableTaskCount: number;
  readonly blockedTaskCount: number;
  readonly constraintCount: number;
  readonly noteCount: number;
}

export interface ReviewExecutionContract {
  readonly schemaVersion: number;
  readonly contractId: string;
  readonly references: ExecutionReferences;
  readonly scope: ExecutionScope;
  readonly constraints: readonly ExecutionConstraint[];
  readonly manifest: ExecutionManifest;
  readonly digest: string;
}

export interface ExecutionVerification {
  readonly valid: boolean;
  readonly frozen: boolean;
  readonly digestValid: boolean;
  readonly versionSupported: boolean;
  readonly replayValid: boolean;
  readonly issues: readonly string[];
}

export interface ReviewExecutionPlanner {
  plan(pipelineResult: ReviewPipelineResult): ReviewExecutionContract;
}

// ── derivation — pure, never re-implements R1–R6's own decisions ───────────────────────────────

function deriveExecutionScope(regenerationPlan: RegenerationPlan, readiness: ReadinessDecision): ExecutionScope {
  // Blocked task ids come from R6's OWN blockers (already computed) — never re-derived from
  // `task.unit === 'UNKNOWN'` independently, which would duplicate R6's own decision.
  const blockedTaskIds = new Set(readiness.blockers.flatMap((b) => b.affectedTasks));
  const allTaskIds = regenerationPlan.tasks.map((t) => t.id);
  const executableTaskIds = allTaskIds.filter((id) => !blockedTaskIds.has(id)).sort();
  const units = [...new Set(regenerationPlan.tasks.map((t) => t.unit))].sort();
  return {
    readinessState: readiness.state,
    executableTaskIds: Object.freeze(executableTaskIds),
    blockedTaskIds: Object.freeze([...blockedTaskIds].sort()),
    units: Object.freeze(units),
  };
}

const BASE_CONSTRAINTS: readonly ExecutionConstraint[] = [
  {
    id: 'capability:whole-project-only',
    kind: 'capability',
    description:
      "Execution is limited to Program F's confirmed granularity (WHOLE_PROJECT) — no independent page/section/component/slot regeneration exists yet (R5 §4).",
    source: 'r5:capability-ceiling',
  },
  {
    id: 'boundary:read-only',
    kind: 'boundary',
    description:
      'Execution may only read this frozen ReviewExecutionContract — it must never modify or re-derive any referenced Review Platform artifact (R1–R7).',
    source: 'r8:immutability',
  },
];

const CONSTRAINT_KIND_BY_BLOCKER_CATEGORY: Record<ReadinessBlockerCategory, ExecutionConstraintKind> = {
  UNRESOLVED_SCOPE: 'scope',
  WORKSPACE_MISSING: 'workspace',
  PROJECT_NOT_GENERATED: 'workspace',
  WORKSPACE_UNHEALTHY: 'workspace',
  INVALID_INPUT: 'workspace',
  INDETERMINATE_CAPABILITY: 'workspace',
};

/** Every BLOCKING readiness blocker becomes exactly one constraint, its `description` the
 *  blocker's own `reason` VERBATIM — never re-authored, never interpreted (RULES: "Never interpret
 *  review text"). WARNING-severity blockers produce no constraint (they don't restrict execution,
 *  R6 §4.1). */
function deriveConstraints(readiness: ReadinessDecision): readonly ExecutionConstraint[] {
  const fromBlockers = readiness.blockers
    .filter((b) => b.severity === 'BLOCKING')
    .map((b): ExecutionConstraint => ({
      id: `readiness:${b.category}`,
      kind: CONSTRAINT_KIND_BY_BLOCKER_CATEGORY[b.category],
      description: b.reason,
      source: `r6:${b.category}`,
    }));
  return [...BASE_CONSTRAINTS, ...fromBlockers];
}

/** The manifest's own derived fields, EXCLUDING `contractId`/`checksum` — those are the RESULT of
 *  hashing a body that includes this, not an input to it (including them would be circular). */
type ManifestBody = Omit<ExecutionManifest, 'contractId' | 'checksum'>;

function manifestBodyOf(references: ExecutionReferences, scope: ExecutionScope, constraints: readonly ExecutionConstraint[]): ManifestBody {
  return {
    client: references.session.client,
    track: references.session.track,
    sessionId: references.session.id,
    readiness: scope.readinessState,
    taskCount: references.regenerationPlan.tasks.length,
    executableTaskCount: scope.executableTaskIds.length,
    blockedTaskCount: scope.blockedTaskIds.length,
    constraintCount: constraints.length,
    noteCount: references.session.notes.length,
  };
}

/** The body hashed for content-addressing. Includes `manifestBody` — every manifest field EXCEPT
 *  `contractId`/`checksum` (the hash's own output, excluded to avoid circularity) — so a manifest
 *  field tampered independently of `checksum` is still caught by `digestValid`. Found live during
 *  production validation (§4.4 of the report): the first version of this function excluded the
 *  manifest entirely, so `manifest.taskCount` could be tampered without tripping the digest check
 *  at all. Fixed before this sprint's own verification claims were made. */
function bodyOf(
  schemaVersion: number,
  references: ExecutionReferences,
  scope: ExecutionScope,
  constraints: readonly ExecutionConstraint[],
  manifestBody: ManifestBody,
) {
  return { schemaVersion, references, scope, constraints, manifestBody };
}

/** Shared by `plan()` and `verifyExecutionContract()`'s replay check — the ONE place this
 *  contract's shape is assembled, so both paths can never drift apart. */
function buildContract(references: ExecutionReferences): ReviewExecutionContract {
  const scope = deepFreeze(deriveExecutionScope(references.regenerationPlan, references.readiness));
  const constraints = deepFreeze(deriveConstraints(references.readiness));
  const manifestBody = manifestBodyOf(references, scope, constraints);
  const digest = digestOf(bodyOf(SCHEMA_VERSION, references, scope, constraints, manifestBody));
  const manifest = deepFreeze({ ...manifestBody, contractId: digest, checksum: digest });
  const core = { schemaVersion: SCHEMA_VERSION, references, scope, constraints, manifest, contractId: digest };
  return Object.freeze({ ...core, digest });
}

export function createReviewExecutionPlanner(): ReviewExecutionPlanner {
  return {
    plan(pipelineResult) {
      const references: ExecutionReferences = Object.freeze({
        session: pipelineResult.session,
        analysis: pipelineResult.analysis,
        plan: pipelineResult.plan,
        scope: pipelineResult.scope,
        regenerationPlan: pipelineResult.regenerationPlan,
        readiness: pipelineResult.readiness,
      });
      return buildContract(references);
    },
  };
}

/** The one-call entry point — mirrors R2–R7's own convenience-function idiom. */
export function planReviewExecution(
  pipelineResult: ReviewPipelineResult,
  planner: ReviewExecutionPlanner = createReviewExecutionPlanner(),
): ReviewExecutionContract {
  return planner.plan(pipelineResult);
}

/** Fixed-key-order, deterministic serialization (IMMUTABILITY: "Deterministically serialized") —
 *  reuses the shared `canonicalizeStructural()` (canonical-digest.ts), never a second serialization scheme. No
 *  `deserializeExecutionContract` is built: PERSISTENCE ("never persisted") means nothing in this
 *  module's own scope ever needs to reload a contract from a string — unlike P55's plan, which is
 *  read back by Doctor/Author across process boundaries. */
export function serializeExecutionContract(contract: ReviewExecutionContract): string {
  return JSON.stringify(canonicalizeStructural(contract), null, 2);
}

/** Validates Integrity / Digest / Replay / Version (VALIDATION). Accepts any object shaped like a
 *  `ReviewExecutionContract` — including a deserialized, potentially-tampered plain object, which is
 *  exactly the case this function exists to catch. */
export function verifyExecutionContract(contract: ReviewExecutionContract): ExecutionVerification {
  const issues: string[] = [];

  const frozen =
    Object.isFrozen(contract) &&
    Object.isFrozen(contract.references) &&
    Object.isFrozen(contract.scope) &&
    Object.isFrozen(contract.constraints) &&
    Object.isFrozen(contract.manifest);
  if (!frozen) issues.push('ReviewExecutionContract (or a sub-structure it owns) is not frozen.');

  const { contractId: _contractId, checksum: _checksum, ...manifestBody } = contract.manifest;
  const recomputedDigest = digestOf(bodyOf(contract.schemaVersion, contract.references, contract.scope, contract.constraints, manifestBody));
  const digestValid = recomputedDigest === contract.digest && contract.manifest.checksum === contract.digest && contract.contractId === contract.digest;
  if (!digestValid) issues.push('Digest mismatch — the contract has been tampered with or corrupted.');

  const versionSupported = contract.schemaVersion === SCHEMA_VERSION;
  if (!versionSupported) issues.push(`Unsupported schemaVersion ${contract.schemaVersion} (expected ${SCHEMA_VERSION}).`);

  // Re-derive scope/constraints/manifest FRESH from the contract's own referenced artifacts and
  // compare digests — proves the derivation is still reproducible from what the contract itself
  // points to, distinct from digestValid (which only checks internal self-consistency).
  const replayValid = buildContract(contract.references).digest === contract.digest;
  if (!replayValid) issues.push('Replay produced a different digest — not reproducibly derivable from its own referenced artifacts.');

  return Object.freeze({
    valid: frozen && digestValid && versionSupported && replayValid,
    frozen,
    digestValid,
    versionSupported,
    replayValid,
    issues: Object.freeze(issues),
  });
}
