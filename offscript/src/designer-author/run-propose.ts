/**
 * P33 — Designer Author Script: proposal-generation orchestration.
 *
 * Pure orchestration over ALREADY-BUILT Designer Author functions — this module authors no
 * proposal-generation logic of its own. `generateAndPersistProposalPackage` (proposal-generator.ts,
 * P11) does the validate+assemble+build+persist work verbatim; `buildProposalManifestReport` /
 * `renderProposalManifestReport` (proposal-report.ts, P10) do the reporting work verbatim. This
 * module's only job is: derive a ProposalGenerationRequest from the already-loaded run's own
 * client/track (ReadyDiscovery.reviewPackage.metadata — never re-typed by the caller) plus
 * caller-supplied CLI input, call the two reused functions in sequence, and persist the report
 * text — the ONE new IO primitive this sprint adds (a 4-line writeIfChanged), duplicated locally
 * per this codebase's own established idiom (see proposal-review.ts's own header: "every P0x
 * persistence/hashing module duplicates stableStringify rather than sharing it") rather than
 * imported cross-module from an unrelated writer.
 *
 * Never reviews the generated proposal (proposal-review.ts is not imported), never translates it
 * into an overlay candidate (proposal-overlay.ts is not imported), never dispatches a subagent
 * (no request/response-file pattern here) — see the isolation falsification tests in
 * run-propose.test.ts.
 *
 * Output lands under <discovery.dir>/designer-author/ — exactly proposal-package.json and
 * proposal-report.md, nothing else. A namespace scripts/generate.ts never creates, reads, or
 * references (P30 §6 / P31 §3). Re-running with identical input is idempotent (writeIfChanged);
 * re-running with different input overwrites both files with the new proposal — a deliberate,
 * flat (not proposalId-namespaced) layout per this sprint's own explicit brief, superseding
 * rather than accumulating across invocations.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateAndPersistProposalPackage } from './proposal-generator.js';
import type { ProposalGenerationRequest } from './proposal-generator.js';
import { buildProposalManifestReport, renderProposalManifestReport } from './proposal-report.js';
import { DESIGNER_AUTHOR_PRODUCER } from './proposal.js';
import type { ProposalKind, ProposalOrigin } from './proposal.js';
import type { ProposalPackage } from './proposal-package.js';
import type { ReadyDiscovery } from './run-artifacts.js';

export const DESIGNER_AUTHOR_OUTPUT_DIRNAME = 'designer-author';
export const PROPOSAL_PACKAGE_FILENAME = 'proposal-package.json';
export const PROPOSAL_REPORT_FILENAME = 'proposal-report.md';

/** Human-typed CLI input for the propose step — never LLM-generated, never subagent-dispatched. */
export interface ProposeCliInput {
  readonly intent: string;
  readonly family: string;
  readonly authoredBy: string;
  readonly kind?: ProposalKind;
  readonly parentComponent?: string;
}

export interface ProposeStepOptions {
  readonly now?: () => string;
}

export interface ProposeStepResult {
  readonly proposalPackage: ProposalPackage;
  readonly proposalPackagePath: string;
  readonly reportPath: string;
  readonly reportMarkdown: string;
}

function writeIfChanged(filePath: string, content: string): void {
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Derive a ProposalGenerationRequest from the already-loaded run's own client/track
 * (ReadyDiscovery.reviewPackage.metadata) plus caller-supplied CLI input. Pure — no filesystem,
 * no validation beyond what generateProposal (proposal-generator.ts) already performs downstream.
 */
export function buildProposeRequest(discovery: ReadyDiscovery, input: ProposeCliInput): ProposalGenerationRequest {
  const origin: ProposalOrigin = {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: discovery.reviewPackage.metadata.client,
    track: discovery.reviewPackage.metadata.track as ProposalOrigin['track'],
    authoredBy: input.authoredBy,
  };
  return {
    kind: input.kind ?? 'component',
    origin,
    semanticFamily: input.family,
    ...(input.parentComponent !== undefined ? { parentComponent: input.parentComponent } : {}),
    designerIntent: input.intent,
  };
}

/**
 * Orchestrate proposal generation: build the request, generate + persist the ProposalPackage
 * (generateAndPersistProposalPackage, verbatim), then build + persist the manifest report
 * (buildProposalManifestReport/renderProposalManifestReport, verbatim). Throws
 * ProposalGenerationError (proposal-generator.ts) unchanged on malformed input — this module adds
 * no additional validation of its own beyond what those reused functions already perform.
 */
export function runProposeStep(
  discovery: ReadyDiscovery,
  input: ProposeCliInput,
  opts: ProposeStepOptions = {},
): ProposeStepResult {
  const request = buildProposeRequest(discovery, input);
  const outDir = join(discovery.dir, DESIGNER_AUTHOR_OUTPUT_DIRNAME);
  mkdirSync(outDir, { recursive: true });

  const proposalPackagePath = join(outDir, PROPOSAL_PACKAGE_FILENAME);
  const proposalPackage = generateAndPersistProposalPackage(request, proposalPackagePath, opts);

  const manifestReport = buildProposalManifestReport([proposalPackage.proposal], opts);
  const reportMarkdown = renderProposalManifestReport(manifestReport);
  const reportPath = join(outDir, PROPOSAL_REPORT_FILENAME);
  writeIfChanged(reportPath, reportMarkdown);

  return { proposalPackage, proposalPackagePath, reportPath, reportMarkdown };
}
