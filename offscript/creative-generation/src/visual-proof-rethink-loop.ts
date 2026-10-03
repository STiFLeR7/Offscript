/**
 * Sprint 10S — the bounded rethink/retry orchestration loop: the piece that finally closes
 *
 *   Visual Proof Judgment -> FAIL -> RevisionRequest -> VisualProofRevisionExecutor ->
 *   Revised VisualProofValidationRequest -> re-judge -> repeat until bounded termination
 *
 * every seam it composes is pre-existing and UNMODIFIED this sprint: `selectCamera` (Sprint 10B),
 * `componentsForFeature` (Sprint 10A), `VisualProofJudgmentExecutor` (Sprint 10K),
 * `VisualProofRevisionExecutor` (Sprint 10R), and `produceCreativeArtifact` (Sprint 6/10A-D). This
 * module does not touch `visual-proof-orchestrator.ts` — that file's `orchestrateCreativeGeneration`
 * is a deliberately single-shot, terminal-on-first-fail tool (Sprint 10L's own scope); a multi-
 * attempt loop needs to keep control across several judgment calls, so this is an independent
 * sibling that composes the same lower-level primitives (`selectCamera`/`componentsForFeature`)
 * rather than wrapping the single-shot orchestrator. `buildInitialCandidateRequest` below is a
 * small, intentional duplication of that file's own private `buildRequest` — the same "sibling files
 * independently re-derive a few lines rather than widen another file's exports" precedent this
 * package has already established (e.g. `visual-proof-revision-executor.ts`'s own `sixQuestionsText`).
 *
 * STRUCTURAL PRECEDENT ONLY: `offscript/src/generate/reauthor-loop.ts` (Website Generation's bounded
 * violation-aware re-authoring loop) was read in full before writing this module. What is reused is
 * the *shape* — a bounded while-loop, an injectable `onEvent` progress sink, a no-progress guard, a
 * typed `ReauthorLoopResult`-style discriminated result. What is deliberately NOT reused: its
 * `MAX_PASSES = 2` (that constant is not even in `reauthor-loop.ts` itself — it is the CALLER's
 * (`validate-loop-driver.ts:78`) own hardcoded, explicitly-commented-provisional choice, with no
 * stated rationale beyond "empirical stand-in... provisional"; there is no source-methodology
 * justification to inherit). Its slop/fidelity-drift governance guards (`runGenerateGovernance`,
 * `antiSlopGovernance`, `detectFidelityDrift`) are POST-RENDER, per-element HTML concerns that have
 * no analogue here — this loop operates entirely pre-render, on `VisualProofValidationRequest`
 * objects with no per-element addressing (no `roles=` exists to route findings to). Its
 * `mapFindingsToItems`/`Finding[]` machinery is likewise not reused — Visual Proof Revision (Sprint
 * 10Q/10R) deliberately carries no `Finding[]`, no revision-target enum, and no per-item routing;
 * this module imports neither `Finding` nor `reauthor-loop.ts` (verified by isolation tests).
 *
 * RETRY BOUND — engineering policy, not a designer law (see `DEFAULT_MAX_REVISION_ATTEMPTS` below):
 * no source methodology (`HANDOFF-v2.md`, `HANDOFF-v3-composition-laws.md`) states a revision-attempt
 * count. `maxAttempts` is therefore a caller-supplied, explicit `RethinkLoopOptions` field — never a
 * hardcoded module constant inside the loop body, mirroring `ReauthorLoopOptions.maxPasses`'s own
 * "the loop is bound-agnostic; the caller decides" shape.
 */
import { selectCamera, type CameraSelection } from './camera-selection.js';
import { componentsForFeature } from './feature-mapping.js';
import { getCompositionCameraBias } from './composition-camera-bias.js';
import type { EnvironmentSlug } from './environment-library.js';
import type { RoleAssignment } from './role-assignment.js';
import { produceCreativeArtifact, dimensionsForRatio, type CreativeIntentInput, type ProduceOptions } from './producer.js';
import type {
  VisualProofValidationRequest,
  VisualProofValidationOutcome,
} from './visual-proof-validation.js';
import type { VisualProofJudgmentExecutor } from './visual-proof-judgment-executor.js';
import type { RevisionRequest, RevisionOutcome, VisualProofRevisionExecutor } from './visual-proof-revision.js';
import type { CreativeAuthoringExecutor, CreativeAuthoringRequest } from './creative-authoring.js';
import type { CreativeArtifact } from 'creative-artifact-contract/src/artifact/types.js';

/** Identifies the Creative Authoring Layer's generator identity, carried in
 * `artifact.generation.generatorVersion` when a real `authoringExecutor` produced the render —
 * distinct from `renderCreativeVisual`'s own `'v1-deterministic-placeholder'`. */
export const CREATIVE_AUTHORING_GENERATOR_VERSION = 'v2-llm-authored';

/**
 * Conservative default: up to 2 revision attempts (3 judged candidates total: attempt 0, 1, 2).
 * ENGINEERING POLICY, not a designer law — no ported methodology document states a revision-attempt
 * count. Chosen to match `validate-loop-driver.ts`'s own `MAX_PASSES = 2` for consistency with the
 * only existing precedent for a bounded semantic re-loop in this repository, while remaining fully
 * overridable via `RethinkLoopOptions.maxAttempts` — this constant is never read inside the loop
 * body itself, only used as the options default.
 */
export const DEFAULT_MAX_REVISION_ATTEMPTS = 2;

/** One judged (or unavailable) candidate in the loop's history, plus the revision attempted against
 * it, if any. `revision` is present iff this attempt failed and a revision was attempted — absent
 * on a passed or unavailable-judgment attempt (no revision is ever attempted after either). */
export interface RethinkAttempt {
  readonly attempt: number;
  readonly request: VisualProofValidationRequest;
  readonly judgment: VisualProofValidationOutcome;
  readonly revision?: RevisionOutcome;
}

export type RethinkTerminalStatus =
  | 'PASSED'
  | 'FAILED_RETRY_EXHAUSTED'
  | 'UNAVAILABLE_JUDGMENT'
  | 'UNAVAILABLE_REVISION'
  | 'UNAVAILABLE_AUTHORING'
  | 'NO_PROGRESS';

/**
 * Progress events, mirroring `reauthor-loop.ts`'s own discriminated-union `onEvent` pattern —
 * independently defined, not imported. `'failed-retry-available'` is the PER-ATTEMPT, non-terminal
 * marker Phase 3 asked this loop to distinguish: it fires whenever an attempt fails and the retry
 * bound has not yet been reached (the loop is about to revise) — it never appears as a final
 * `RethinkLoopResult.status`, because a loop that still has retries available does not stop.
 */
export type RethinkLoopEvent =
  | { kind: 'judged'; attempt: number; outcome: VisualProofValidationOutcome }
  | { kind: 'passed'; attempt: number }
  | { kind: 'failed-retry-available'; attempt: number }
  | { kind: 'unavailable-judgment'; attempt: number; reason: string }
  | { kind: 'revising'; attempt: number }
  | { kind: 'revised'; attempt: number; outcome: RevisionOutcome }
  | { kind: 'unavailable-revision'; attempt: number; reason: string }
  | { kind: 'no-progress'; attempt: number }
  | { kind: 'retry-exhausted'; attempt: number }
  | { kind: 'rendering'; attempt: number }
  | { kind: 'unavailable-authoring'; attempt: number; reason: string };

export interface RethinkLoopOptions {
  readonly judgmentExecutor: VisualProofJudgmentExecutor;
  readonly revisionExecutor: VisualProofRevisionExecutor;
  readonly produceOptions: ProduceOptions;
  /** Injectable for tests — defaults to the real, unmodified `produceCreativeArtifact`. */
  readonly produce?: typeof produceCreativeArtifact;
  /** Maximum number of REVISION attempts permitted (not counting the initial, always-free
   * judgment). See `DEFAULT_MAX_REVISION_ATTEMPTS` for the default and its rationale. */
  readonly maxAttempts?: number;
  readonly onEvent?: (event: RethinkLoopEvent) => void;
  /** Sprint 10AE — the environment already selected (by a real or scripted Environment Selection
   * executor, run BEFORE this loop) for this creative's very first candidate. Plain data, never an
   * executor call — this loop never selects an environment itself, only carries an already-decided
   * one into the initial `VisualProofValidationRequest`. Absent means no environment selection was
   * performed upstream; the initial request then carries no `environment` field, exactly as before
   * this sprint. */
  readonly initialEnvironment?: EnvironmentSlug;
  /** Sprint 10AE — the SAME eligible-candidate set the upstream environment selection used, passed
   * through unchanged into every `RevisionRequest` this loop builds, so a proposed environment
   * revision can be validated against it (`visual-proof-revision-executor.ts`'s own eligible-set
   * check) — this loop never recomputes eligibility. */
  readonly eligibleEnvironments?: readonly EnvironmentSlug[];
  /** Sprint 10AG — the role assignment already produced (by a real or scripted
   * `RoleAssignmentExecutor`, run BEFORE this loop) for this creative's very first candidate. Plain
   * data, never an executor call — this loop never assigns roles itself, only carries an
   * already-decided assignment into the initial `VisualProofValidationRequest`. Absent means no role
   * assignment was performed upstream; the initial request then carries no `roles` field, exactly as
   * before this sprint. Unlike `eligibleEnvironments`, no separate eligibility set is threaded into
   * `RevisionRequest` for roles — a proposed role revision validates directly against
   * `priorRequest.components`, already present on every request this loop builds. */
  readonly initialRoles?: RoleAssignment;
  /** Creative Authoring Layer seam. When given, a PASSED judgment is realized by this real
   * executor instead of the deterministic placeholder renderer — an authoring failure (mechanism
   * error, refusal, or a structurally invalid response) becomes the terminal status
   * `UNAVAILABLE_AUTHORING`, never a silent fallback to the placeholder (fail-closed, per the
   * Creative Authoring Layer's own fallback policy). Absent (the default): behavior is
   * byte-identical to before this seam existed — the deterministic placeholder renders as always. */
  readonly authoringExecutor?: CreativeAuthoringExecutor;
}

interface RethinkResultCommon {
  readonly attempts: readonly RethinkAttempt[];
  /** The last request actually sent to judgment (never a revised-but-rejected/unjudged candidate). */
  readonly finalRequest: VisualProofValidationRequest;
  /** The last outcome actually returned by judgment. */
  readonly finalJudgment: VisualProofValidationOutcome;
}

export type RethinkLoopResult =
  | (RethinkResultCommon & {
      readonly status: 'PASSED';
      readonly artifact: CreativeArtifact;
      readonly html: string;
      /** False when the passed candidate's `components` differ from `componentsForFeature(feature)`
       * — `producer.ts`'s `CreativeIntentInput` has no `components` override field (untouched this
       * sprint, per DO NOT TOUCH), so `renderCreativeVisual` always shows the feature's FULL
       * authoritative component list regardless of any revision-trimmed subset that passed
       * judgment. This flag makes that gap observable rather than silently glossing over it — see
       * the implementation report's "Known Limitations". Camera revisions have no such gap:
       * `CreativeIntentInput.camera` faithfully carries the revised camera into the render. */
      readonly componentsFullyReflectedInRender: boolean;
    })
  | (RethinkResultCommon & { readonly status: Exclude<RethinkTerminalStatus, 'PASSED'> });

/** Independently re-derived (not imported) from `visual-proof-orchestrator.ts`'s own private
 * `buildRequest` — see module header for why. Never fabricates a camera/components beyond what
 * Feature Mapping / Camera Selection (both unmodified) actually resolve for this intent. */
function buildInitialCandidateRequest(
  intent: CreativeIntentInput,
  cameraSelection: CameraSelection,
  environment: EnvironmentSlug | undefined,
  roles: RoleAssignment | undefined,
): VisualProofValidationRequest {
  const components = componentsForFeature(intent.feature);
  return {
    belief: intent.belief,
    feature: intent.feature,
    mustInclude: intent.mustInclude,
    ...(cameraSelection.selected ? { camera: cameraSelection.selected } : {}),
    ...(components.length > 0 ? { components } : {}),
    ...(environment ? { environment } : {}),
    ...(roles ? { roles } : {}),
  };
}

function stringArraysEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** Sprint 10AG — plain field-by-field role comparison, the same "no hashing, no diffing library"
 * discipline `requestsStructurallyEqual` already applies to every other field. */
function roleAssignmentsEqual(a: RoleAssignment | undefined, b: RoleAssignment | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.hero === b.hero &&
    stringArraysEqual(a.support, b.support) &&
    stringArraysEqual(a.signal, b.signal) &&
    stringArraysEqual(a.subordinateContext, b.subordinateContext) &&
    stringArraysEqual(a.unassigned, b.unassigned)
  );
}

/**
 * Phase 5's no-progress detector: the revised candidate is structurally identical to the prior
 * (just-judged) request, field by field. No hashing, no diffing library, no similarity score — a
 * plain field comparison, now over `VisualProofValidationRequest`'s six flat/array fields (Sprint
 * 10AE adds `environment` as the sixth). Retry-policy/bound behavior is unchanged — this function
 * only decides equality, never how many attempts remain.
 */
function requestsStructurallyEqual(a: VisualProofValidationRequest, b: VisualProofValidationRequest): boolean {
  return (
    a.belief === b.belief &&
    a.feature === b.feature &&
    stringArraysEqual(a.mustInclude, b.mustInclude) &&
    a.camera === b.camera &&
    stringArraysEqual(a.components, b.components) &&
    a.environment === b.environment &&
    roleAssignmentsEqual(a.roles, b.roles)
  );
}

/**
 * Runs the bounded rethink loop for one `CreativeIntentInput`: judge -> if passed, render and stop;
 * if unavailable, stop; if failed and retries remain, revise -> re-judge the revised candidate ->
 * repeat. `intent` is never mutated — every candidate after the first is a freshly-built object; the
 * final render call spreads `intent` into a NEW object with only `camera` possibly overridden.
 */
export async function runRethinkLoop(
  intent: CreativeIntentInput,
  opts: RethinkLoopOptions,
): Promise<RethinkLoopResult> {
  const emit = opts.onEvent ?? (() => {});
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_REVISION_ATTEMPTS;
  const cameraSelection = selectCamera(intent);

  let request = buildInitialCandidateRequest(intent, cameraSelection, opts.initialEnvironment, opts.initialRoles);
  const attempts: RethinkAttempt[] = [];
  let revisionsUsed = 0;

  while (true) {
    const attemptNumber = attempts.length;
    const judgment = await opts.judgmentExecutor(request);
    emit({ kind: 'judged', attempt: attemptNumber, outcome: judgment });

    if (judgment.outcome === 'unavailable') {
      attempts.push({ attempt: attemptNumber, request, judgment });
      emit({ kind: 'unavailable-judgment', attempt: attemptNumber, reason: judgment.reason });
      return { status: 'UNAVAILABLE_JUDGMENT', attempts, finalRequest: request, finalJudgment: judgment };
    }

    if (judgment.answer.passed) {
      attempts.push({ attempt: attemptNumber, request, judgment });
      emit({ kind: 'passed', attempt: attemptNumber });
      emit({ kind: 'rendering', attempt: attemptNumber });
      const finalIntent: CreativeIntentInput = { ...intent, camera: request.camera ?? intent.camera };
      const authoritativeComponents = componentsForFeature(intent.feature);
      const componentsFullyReflectedInRender =
        request.components === undefined || stringArraysEqual(request.components, authoritativeComponents);

      const produce = opts.produce ?? produceCreativeArtifact;
      let produceOptions = opts.produceOptions;
      if (opts.authoringExecutor) {
        const compositionBias = request.camera ? getCompositionCameraBias(request.camera) : undefined;
        const [canvasWidth, canvasHeight] = dimensionsForRatio(intent.ratio);
        const authoringRequest: CreativeAuthoringRequest = {
          belief: request.belief,
          feature: request.feature,
          mustInclude: request.mustInclude,
          ratio: intent.ratio,
          canvasWidth,
          canvasHeight,
          components: authoritativeComponents,
          ...(request.camera ? { camera: request.camera } : {}),
          ...(compositionBias ? { compositionBias } : {}),
          ...(request.environment ? { environment: request.environment } : {}),
          ...(request.roles ? { roles: request.roles } : {}),
        };
        const authored = await opts.authoringExecutor(authoringRequest);
        if (authored.outcome === 'unavailable') {
          emit({ kind: 'unavailable-authoring', attempt: attemptNumber, reason: authored.reason });
          return { status: 'UNAVAILABLE_AUTHORING', attempts, finalRequest: request, finalJudgment: judgment };
        }
        produceOptions = {
          ...produceOptions,
          render: () => authored.html,
          generatorVersion: CREATIVE_AUTHORING_GENERATOR_VERSION,
        };
      }

      const { artifact, html } = produce(finalIntent, produceOptions);
      return {
        status: 'PASSED',
        attempts,
        finalRequest: request,
        finalJudgment: judgment,
        artifact,
        html,
        componentsFullyReflectedInRender,
      };
    }

    // Failed. Never call the revision executor after passed/unavailable (both handled above).
    if (revisionsUsed >= maxAttempts) {
      attempts.push({ attempt: attemptNumber, request, judgment });
      emit({ kind: 'retry-exhausted', attempt: attemptNumber });
      return { status: 'FAILED_RETRY_EXHAUSTED', attempts, finalRequest: request, finalJudgment: judgment };
    }

    emit({ kind: 'failed-retry-available', attempt: attemptNumber });
    revisionsUsed += 1;
    emit({ kind: 'revising', attempt: attemptNumber });
    const revisionRequest: RevisionRequest = {
      priorRequest: request,
      priorAnswer: judgment.answer,
      attempt: revisionsUsed,
      ...(opts.eligibleEnvironments ? { eligibleCandidates: opts.eligibleEnvironments } : {}),
    };
    const revision = await opts.revisionExecutor(revisionRequest);
    emit({ kind: 'revised', attempt: attemptNumber, outcome: revision });
    attempts.push({ attempt: attemptNumber, request, judgment, revision });

    if (revision.outcome === 'unavailable') {
      emit({ kind: 'unavailable-revision', attempt: attemptNumber, reason: revision.reason });
      return { status: 'UNAVAILABLE_REVISION', attempts, finalRequest: request, finalJudgment: judgment };
    }

    if (requestsStructurallyEqual(revision.candidate, request)) {
      emit({ kind: 'no-progress', attempt: attemptNumber });
      return { status: 'NO_PROGRESS', attempts, finalRequest: request, finalJudgment: judgment };
    }

    request = revision.candidate;
    // loop continues: the next iteration judges this newly-revised request.
  }
}
