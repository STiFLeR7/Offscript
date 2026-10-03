/**
 * P09 — Designer Author Foundation: ProposalPackage / ProposalManifest.
 *
 * The transport unit for handing a proposal to a designer for review. Unlike
 * Doctor's ReviewPackage (P08), which indexes artifacts the driver had
 * ALREADY written to disk, an AuthorProposal exists only in memory until
 * this module packages it — there is nothing upstream to index yet. The
 * manifest therefore carries exactly one artifact today (the proposal
 * itself); its shape is deliberately forward-compatible with a future
 * multi-artifact package (e.g. a rendered preview) without changing today's
 * fields.
 *
 * Pure and in-memory: no filesystem, no catalog access. Persistence lives in
 * proposal-io.ts.
 */
import { createHash } from 'node:crypto';
import type { AuthorProposal } from './proposal.js';

export interface ProposalManifestArtifact {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

export interface ProposalManifest {
  readonly proposalId: string;
  readonly packagedAt: string;
  readonly artifacts: readonly ProposalManifestArtifact[];
}

export interface ProposalPackage {
  readonly manifest: ProposalManifest;
  readonly proposal: AuthorProposal;
}

export interface ProposalPackageInput {
  readonly proposal: AuthorProposal;
}

export interface BuildProposalPackageOptions {
  readonly now?: () => string;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacerKeys(value), 2) + '\n';
}

function sortedReplacerKeys(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
  }
  return value;
}

/** Build an immutable ProposalPackage. Pure — hashes the in-memory proposal, touches no disk. */
export function buildProposalPackage(
  input: ProposalPackageInput,
  opts: BuildProposalPackageOptions = {},
): ProposalPackage {
  const now = opts.now ?? (() => new Date().toISOString());
  const proposalHash = createHash('sha256').update(stableStringify(input.proposal)).digest('hex');
  const pkg: ProposalPackage = {
    manifest: {
      proposalId: input.proposal.identity.id,
      packagedAt: now(),
      artifacts: [{ name: 'proposal.json', path: 'proposal.json', sha256: proposalHash }],
    },
    proposal: input.proposal,
  };
  return deepFreeze(pkg);
}
