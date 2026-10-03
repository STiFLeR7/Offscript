/**
 * Sprint 10L — the smallest orchestration layer that enforces the SOURCE-REQUIRED pre-render
 * ordering: decision/sketch -> Visual Proof Validation -> pass? -> render. `producer.ts` is never
 * modified — it remains the actual renderer; this module only decides WHETHER to call it:
 *
 *   orchestrator -> Visual Proof -> if passed: producer     (this sprint)
 *
 * never:
 *
 *   producer -> Visual Proof                                (explicitly rejected, per Sprint 10G §8)
 *
 * Derives Feature Mapping's component list and Camera Selection's resolved camera candidate
 * (both unmodified, Sprint 10A/10B) to assemble the `VisualProofValidationRequest`, and derives
 * Composition Camera Bias (unmodified, Sprint 10D) purely for observability/traceability in the
 * result — it is not part of the Visual Proof request itself (no question references it).
 *
 * No retry, no rethink, no approval automation, no Decision Record. A failed or unavailable
 * judgment is a terminal STOP for this call — the executor is invoked exactly once, the intent is
 * never mutated, and `producer.ts`'s `produceCreativeArtifact` (the only render entry point) is
 * called at most once, only after `passed === true`.
 */
import { componentsForFeature } from './feature-mapping.js';
import { selectCamera, type CameraSelection } from './camera-selection.js';
import { getCompositionCameraBias, type CompositionCameraBias } from './composition-camera-bias.js';
import {
  produceCreativeArtifact,
  type CreativeIntentInput,
  type ProduceOptions,
} from './producer.js';
import type {
  VisualProofValidationRequest,
  VisualProofValidationAnswer,
  VisualProofValidationExecutor,
  VisualProofValidationOutcome,
} from './visual-proof-validation.js';
import type { VisualProofJudgmentExecutor } from './visual-proof-judgment-executor.js';
import type { CreativeArtifact } from 'creative-artifact-contract/src/artifact/types.js';

/**
 * Adapts a plain, answer-only `VisualProofValidationExecutor` (e.g. `createScriptedStubExecutor`,
 * Sprint 10J — proves the plumbing, never claims semantic judgment) into the wider
 * `VisualProofJudgmentExecutor` shape this orchestrator's `executor` option requires. Every
 * resolved answer is wrapped as `{ outcome: 'judged', answer }` — a scripted stub has no concept
 * of "unavailable," so this adapter never produces that branch. Exported because deterministic
 * orchestration tests need it (Phase 6), and it is a generic, honest piece of glue, not a second
 * competing judgment mechanism.
 */
export function judgedFrom(executor: VisualProofValidationExecutor): VisualProofJudgmentExecutor {
  return async (request) => ({ outcome: 'judged', answer: await executor(request) });
}

export interface OrchestrateOptions {
  /** The judgment mechanism — a real executor (Sprint 10K's `createRealJudgmentExecutor`) or a
   * scripted one wrapped via `judgedFrom`. Invoked exactly once per call; never retried here. */
  readonly executor: VisualProofJudgmentExecutor;
  readonly produceOptions: ProduceOptions;
  /** Injectable for tests — defaults to the real, unmodified `produceCreativeArtifact` from
   * `producer.ts`. Never used to substitute a different renderer in production; the default IS
   * the real one, so this exists purely to make the "was the producer actually called" boundary
   * directly observable in tests without fighting ESM module-spy mechanics. */
  readonly produce?: typeof produceCreativeArtifact;
}

interface OrchestrationCommon {
  /** Exactly what was sent to the judge — belief/feature/mustInclude/camera?/components? only. */
  readonly request: VisualProofValidationRequest;
  /** Camera Selection's (Sprint 10B, unmodified) full decision trace for this intent. */
  readonly cameraSelection: CameraSelection;
  /** Composition Camera Bias's (Sprint 10D, unmodified) starting bias for the resolved camera —
   * observability only; no Visual Proof question reads this. */
  readonly compositionBias: CompositionCameraBias | undefined;
}

export type OrchestrationResult =
  | (OrchestrationCommon & {
      readonly status: 'RENDERED';
      readonly reason: 'passed';
      readonly answer: VisualProofValidationAnswer;
      readonly artifact: CreativeArtifact;
      readonly html: string;
    })
  | (OrchestrationCommon & {
      readonly status: 'NOT_RENDERED';
      readonly reason: 'failed';
      readonly answer: VisualProofValidationAnswer;
    })
  | (OrchestrationCommon & {
      readonly status: 'NOT_RENDERED';
      readonly reason: 'unavailable';
      readonly unavailableReason: string;
    });

/**
 * Builds the Visual Proof request from exactly what Feature Mapping and Camera Selection
 * (both unmodified) already derive for this intent — never fabricates a component list or camera
 * candidate beyond what those two, already-ported methodologies actually produce. `components`/
 * `camera` are omitted entirely (not set to an empty/fabricated value) when nothing was resolved.
 */
function buildRequest(intent: CreativeIntentInput, cameraSelection: CameraSelection): VisualProofValidationRequest {
  const components = componentsForFeature(intent.feature);
  return {
    belief: intent.belief,
    feature: intent.feature,
    mustInclude: intent.mustInclude,
    ...(cameraSelection.selected ? { camera: cameraSelection.selected } : {}),
    ...(components.length > 0 ? { components } : {}),
  };
}

/**
 * Runs exactly one pass of: derive methodology outputs -> assemble the Visual Proof request ->
 * invoke the judgment executor once -> render iff passed. Never retries, never mutates `intent`,
 * never auto-approves, never builds a Decision Record beyond the request's own three-to-five
 * fields. A failed or unavailable judgment returns a `NOT_RENDERED` result and calls neither
 * `produce` nor anything that would touch disk.
 */
export async function orchestrateCreativeGeneration(
  intent: CreativeIntentInput,
  opts: OrchestrateOptions,
): Promise<OrchestrationResult> {
  const cameraSelection = selectCamera(intent);
  const compositionBias = getCompositionCameraBias(cameraSelection.selected ?? intent.camera);
  const request = buildRequest(intent, cameraSelection);

  const outcome: VisualProofValidationOutcome = await opts.executor(request);

  if (outcome.outcome === 'unavailable') {
    return {
      status: 'NOT_RENDERED',
      reason: 'unavailable',
      unavailableReason: outcome.reason,
      request,
      cameraSelection,
      compositionBias,
    };
  }

  if (!outcome.answer.passed) {
    return {
      status: 'NOT_RENDERED',
      reason: 'failed',
      answer: outcome.answer,
      request,
      cameraSelection,
      compositionBias,
    };
  }

  const produce = opts.produce ?? produceCreativeArtifact;
  const { artifact, html } = produce(intent, opts.produceOptions);
  return {
    status: 'RENDERED',
    reason: 'passed',
    answer: outcome.answer,
    artifact,
    html,
    request,
    cameraSelection,
    compositionBias,
  };
}
