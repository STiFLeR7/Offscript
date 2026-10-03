/**
 * P32 — Designer Author Script Foundation: execution context + structured exit model.
 *
 * Mirrors platform-harness.ts's OWN Execution-Context + exit-status pattern (P02/P03) —
 * deliberately a SEPARATE, independent module that never imports platform-harness.ts. P30
 * §4 established that platform-harness.ts owns only the (unwired) HarnessProposalResult
 * transport shape and "owns nothing about... sequencing, triggering, or wiring Designer
 * Author into any run"; reusing HarnessExecutionContext/HarnessStageSequencer here would
 * quietly recouple the two "separate scripts" through a shared runner P30 explicitly ruled
 * out. This module has its own, independent execution-context and exit-status vocabulary.
 *
 * Pure, total, zero filesystem — this module ONLY models state, exactly like
 * createHarnessExecutionContext/buildHarnessRunResult do for scripts/generate.ts.
 */
import type { RunArtifactDiscovery, RunArtifactDiscoveryStatus } from './run-artifacts.js';

export interface DesignerAuthorInput {
  readonly dir: string;
}

export interface DesignerAuthorExecutionContext {
  readonly input: DesignerAuthorInput;
  readonly startedAt: string;
}

export interface CreateDesignerAuthorExecutionContextOptions {
  readonly now?: () => string;
}

/**
 * Build the immutable execution context for one Designer Author script run. Pure aside from
 * the timestamp read; never mutates the caller's input. Mirrors createHarnessExecutionContext.
 */
export function createDesignerAuthorExecutionContext(
  input: DesignerAuthorInput,
  opts: CreateDesignerAuthorExecutionContextOptions = {},
): DesignerAuthorExecutionContext {
  const now = opts.now ?? (() => new Date().toISOString());
  const frozenInput: DesignerAuthorInput = Object.freeze({ ...input });
  return Object.freeze({
    input: frozenInput,
    startedAt: now(),
  });
}

/**
 * The four outcomes this Foundation phase can reach — named identically to
 * run-artifacts.ts's own discovery statuses, since (in this phase) an outcome IS a 1:1
 * reflection of what was discovered on disk; no proposal/review/overlay outcome exists yet.
 */
export type DesignerAuthorOutcomeKind = RunArtifactDiscoveryStatus;

/**
 * 'invalid-directory' and 'malformed-artifacts' are genuine errors (bad CLI input / corrupt
 * state); 'not-ready' and 'ready' are both legitimate, CI-safe exits — mirrors
 * scripts/actuate.ts's own "no harden output yet" exit(0) convention, which is a valid
 * not-yet-ready state, never a failure.
 */
export function exitCodeFor(outcome: DesignerAuthorOutcomeKind): 0 | 1 {
  return outcome === 'invalid-directory' || outcome === 'malformed-artifacts' ? 1 : 0;
}

export interface DesignerAuthorRunResult {
  readonly context: DesignerAuthorExecutionContext;
  readonly outcome: DesignerAuthorOutcomeKind;
  readonly exitCode: 0 | 1;
  readonly discovery: RunArtifactDiscovery;
}

/**
 * Assemble the final run result. `exitCode` is always derived from `exitCodeFor` — one
 * outcome→exit-code mapping, never a second (mirrors buildHarnessRunResult).
 */
export function buildDesignerAuthorRunResult(input: {
  context: DesignerAuthorExecutionContext;
  discovery: RunArtifactDiscovery;
}): DesignerAuthorRunResult {
  return Object.freeze({
    context: input.context,
    outcome: input.discovery.status,
    exitCode: exitCodeFor(input.discovery.status),
    discovery: input.discovery,
  });
}
