/**
 * P32/P33/P36 — Designer Author Script Foundation: CLI argument parsing.
 *
 * Pure. `resolveTargetDir` is the ONE piece of CLI logic worth a testable function of its
 * own — mirrors scripts/actuate.ts's own `args.find((a) => !a.startsWith('--'))` convention
 * verbatim (P31 §8). `getFlagValue`/`parseProposalKind` (P33) extend this module for the new
 * `--step=propose` flags — still pure CLI-input parsing/validation, never proposal-generation
 * logic itself (that stays entirely in proposal-generator.ts, reused verbatim by run-propose.ts).
 * `parseApprovalStatus` (P36) extends it again for `--step=approve --status=...` — deliberately
 * has NO default, unlike `parseProposalKind`: an approval decision is "never inferred, never
 * automatic" (overlay-approval.ts's own docstring), so an absent `--status` is a CLI error, not
 * a silently-assumed 'approved'.
 */
import { resolve } from 'node:path';
import type { ProposalKind } from './proposal.js';
import type { ApprovalStatus } from './overlay-approval.js';

/**
 * Resolve the target directory from argv-style args: the first non-flag argument, resolved
 * to an absolute path, or `fallback` (also resolved) when no non-flag argument is present.
 */
export function resolveTargetDir(args: readonly string[], fallback: string): string {
  const targetArg = args.find((a) => !a.startsWith('--'));
  return resolve(targetArg ?? fallback);
}

export class DesignerAuthorCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignerAuthorCliError';
  }
}

/** Read a `--name=value` flag's value from argv-style args. Undefined when absent. */
export function getFlagValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found === undefined ? undefined : found.slice(prefix.length);
}

const PROPOSAL_KINDS: readonly ProposalKind[] = ['component', 'section', 'variant', 'overlay'];

/**
 * Validate a raw `--kind` value against ProposalKind's closed vocabulary (proposal.ts).
 * Defaults to 'component' when absent. Throws DesignerAuthorCliError on an invalid value —
 * CLI-input hygiene, distinct from (and never a substitute for) validateProposalGenerationRequest's
 * own required-field validation in proposal-generator.ts.
 */
export function parseProposalKind(raw: string | undefined): ProposalKind {
  if (raw === undefined) return 'component';
  if ((PROPOSAL_KINDS as readonly string[]).includes(raw)) return raw as ProposalKind;
  throw new DesignerAuthorCliError(`--kind must be one of ${PROPOSAL_KINDS.join(', ')}, got '${raw}'`);
}

const APPROVAL_STATUSES: readonly ApprovalStatus[] = ['approved', 'rejected'];

/**
 * Validate a raw `--status` value against ApprovalStatus's closed vocabulary
 * (overlay-approval.ts). NO default — throws DesignerAuthorCliError when absent OR invalid, since
 * an approval decision must always be an explicit human choice.
 */
export function parseApprovalStatus(raw: string | undefined): ApprovalStatus {
  if (raw !== undefined && (APPROVAL_STATUSES as readonly string[]).includes(raw)) return raw as ApprovalStatus;
  throw new DesignerAuthorCliError(`--status must be one of ${APPROVAL_STATUSES.join(', ')}, got '${String(raw)}'`);
}
