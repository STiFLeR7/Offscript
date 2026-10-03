/**
 * tier-2-advisory — the human-in-the-loop lane for Tier-2 escalations (M2,
 * Track B Task 7).
 *
 * Tier-2 findings (single fragile elements the systematic core can't safely
 * touch) are escalated, not auto-remediated — that's the v1 "not autonomous"
 * charter. M2 opens a bounded lane for them: an ADVISORY pass that dispatches a
 * subagent per Tier-2 finding to DRAFT a one-line edit + rationale + confidence
 * — a `TierTwoProposal` — but applies NOTHING. The proposals are persisted to
 * `output/<brand>/tier-2-proposals.json`; the human walks them via
 * `scripts/harden-review.ts` (Task 8), and only accepted proposals are applied
 * (appended to the actuator recipe's edits[]).
 *
 * The advisory instruction REUSES the frozen `composeInstruction` (same bounds:
 * standing brief, brand contract, playbook excerpts, rail bounds) with a
 * PassSpec of `kind: 'advisory'`, then appends an advisory directive that
 * overrides the composer's "edit ONE HTML file" framing — composeInstruction
 * does not branch on `kind`, so the override lives here.
 *
 * Idempotency (load-bearing, like overlay.ts's decidedAt preservation): a
 * re-run must NOT clobber a human decision or churn the file. Already-decided
 * proposals (accepted / rejected) are preserved verbatim and NOT re-dispatched;
 * pending proposals keep their original `proposedAt` but refresh the draft;
 * the file is written content-compare so an unchanged run is a filesystem no-op.
 *
 * Spec: M2 charter §4 Task 7; src/actuator-recipe.ts (TierTwoProposal);
 *       src/overlay.ts (Frozen); src/instruction.ts (composeInstruction).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Finding, BrandContract } from './operator.js';
import type { TokenModel } from './tokens.js';
import type { PassSpec } from './actuation.js';
import type { Frozen } from './overlay.js';
import type { TierTwoProposal } from './actuator-recipe.js';
import { composeInstruction, type ComposePaths } from './instruction.js';
import type { Playbook } from './playbook.js';

/** What an advisory subagent is asked to draft for one Tier-2 finding. */
export interface AdvisoryRequest {
  /** The Tier-2 finding to propose an edit for. */
  finding: Finding;
  /** The originating rail/pass name (e.g. 'layout-alignment'). */
  originPass: string;
  /** The frozen overlay id, if this finding is already frozen. */
  frozenId?: string;
  /** The fully composed advisory instruction (bounds + the propose-don't-edit directive). */
  instruction: string;
  /** The current artifact HTML the proposed `find` must be an exact substring of. */
  html: string;
}

/** The subagent's drafted proposal — the parts it authors (the pass assigns the rest). */
export interface AdvisoryProposalDraft {
  /** A value-substitution edit, actuator-recipe shape, so accept slots into edits[]. */
  proposedEdit: { find: string; replace: string };
  /** Why — citing the playbook excerpt / bound that motivated it. */
  rationale: string;
  /** Subagent's self-assessed confidence. */
  confidence: 'high' | 'medium' | 'low';
}

/** The seam to the advisory subagent (parallel to actuator.ts's Actuator). */
export interface AdvisoryDispatcher {
  propose(request: AdvisoryRequest): Promise<AdvisoryProposalDraft>;
}

/** Everything the advisory pass needs beyond the findings + frozen entries. */
export interface AdvisoryRunContext {
  /** Brand subject — names the output dir and the standing brief. */
  brand: string;
  /** `output/<brand>/` — where tier-2-proposals.json is written. */
  outputDir: string;
  /** The current artifact HTML (proposed edits target this). */
  html: string;
  /** The advisory subagent seam. */
  dispatcher: AdvisoryDispatcher;
  /** ISO timestamp for newly drafted proposals (injected for determinism). */
  proposedAt: string;
  /** Paths embedded in the composed instruction (reference / index / tokens). */
  composePaths: ComposePaths;
  artifactType?: string;
  creativeDirection?: string;
  brandContract?: BrandContract;
  tokens?: TokenModel;
  /** Injectable playbook for tests; defaults to the canonical cached parse. */
  playbook?: Playbook;
  /** Reference markdown bounds to embed (defaults to none). */
  railBounds?: string[];
}

const PROPOSALS_FILE = 'tier-2-proposals.json';
const ADVISORY_PASS = 'tier-2-advisory';

/** The directive appended after the composed bounds to flip the pass into propose-only mode. */
const ADVISORY_DIRECTIVE = [
  '===== ADVISORY MODE (override) =====',
  'This is a Tier-2 ADVISORY dispatch (kind: advisory). The standing brief above',
  'says "edit ONE HTML file" — for THIS dispatch that is OVERRIDDEN. You must NOT',
  'modify, write, or apply anything. Produce a PROPOSAL only.',
  '',
  'Return exactly one proposed edit for the single finding below, as:',
  '  - proposedEdit: { find, replace } — a VALUE substitution where `find` is an',
  '    EXACT substring of index.html (copy it verbatim) and `replace` is the',
  '    corrected fragment. Every value in `replace` MUST be a brand token var().',
  '  - rationale: one or two sentences citing the playbook bound that motivates it.',
  '  - confidence: high | medium | low — your honesty about whether this edit is',
  '    safe to apply unreviewed.',
  '',
  'If you cannot find a safe one-line value substitution, say so in the rationale',
  'and return confidence: low with the closest find/replace you can justify. Never',
  'invent a `find` that is not literally present in index.html.',
].join('\n');

interface Candidate {
  findingId: string;
  finding: Finding;
  originPass: string;
  frozenId?: string;
}

/**
 * Run the Tier-2 advisory pass. Gathers Tier-2 findings (escalated this run from
 * `perRail`, plus those already frozen in `frozenEntries`), dispatches one
 * advisory subagent per finding to draft a proposal, persists the merged
 * proposal set to `output/<brand>/tier-2-proposals.json`, and returns it.
 * Applies no edits.
 */
export async function runTier2AdvisoryPass(
  perRail: ReadonlyArray<{ operator: { name: string }; findings: Finding[] }>,
  frozenEntries: ReadonlyArray<Frozen>,
  ctx: AdvisoryRunContext,
): Promise<TierTwoProposal[]> {
  const candidates = gatherCandidates(perRail, frozenEntries);

  const existing = readProposals(path.join(ctx.outputDir, PROPOSALS_FILE));
  const existingByFinding = new Map(existing.map((p) => [p.findingId, p]));

  const proposals: TierTwoProposal[] = [];
  for (const candidate of candidates) {
    const prior = existingByFinding.get(candidate.findingId);

    // A human decision is durable — never re-dispatch or overwrite it.
    if (prior && prior.status !== 'pending') {
      proposals.push(prior);
      continue;
    }

    const instruction = buildAdvisoryInstruction(candidate, ctx);
    const draft = await ctx.dispatcher.propose({
      finding: candidate.finding,
      originPass: candidate.originPass,
      frozenId: candidate.frozenId,
      instruction,
      html: ctx.html,
    });

    const proposal: TierTwoProposal = {
      findingId: candidate.findingId,
      pass: ADVISORY_PASS,
      proposedEdit: draft.proposedEdit,
      rationale: draft.rationale,
      confidence: draft.confidence,
      status: 'pending',
      // Preserve the original proposedAt across re-runs (idempotency).
      proposedAt: prior?.proposedAt ?? ctx.proposedAt,
    };
    if (candidate.frozenId !== undefined) proposal.frozenId = candidate.frozenId;
    proposals.push(proposal);
  }

  proposals.sort((a, b) => (a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0));
  writeProposals(path.join(ctx.outputDir, PROPOSALS_FILE), proposals);
  return proposals;
}

/**
 * Tier-2 candidates: escalated findings this run (full Finding objects), unioned
 * with frozen-entry findings (synthesised Finding from the entry). Deduped by
 * findingId; a frozen id is attached to its matching escalated candidate.
 */
function gatherCandidates(
  perRail: ReadonlyArray<{ operator: { name: string }; findings: Finding[] }>,
  frozenEntries: ReadonlyArray<Frozen>,
): Candidate[] {
  const byFinding = new Map<string, Candidate>();

  for (const { operator, findings } of perRail) {
    for (const finding of findings) {
      if (finding.outcome !== 'escalated') continue;
      if (!byFinding.has(finding.id)) {
        byFinding.set(finding.id, { findingId: finding.id, finding, originPass: operator.name });
      }
    }
  }

  for (const entry of frozenEntries) {
    for (const findingId of entry.findingIds) {
      const existing = byFinding.get(findingId);
      if (existing) {
        // already escalated this run — just remember it's frozen
        existing.frozenId = existing.frozenId ?? entry.id;
        continue;
      }
      byFinding.set(findingId, {
        findingId,
        originPass: entry.pass,
        frozenId: entry.id,
        finding: {
          id: findingId,
          description:
            `frozen Tier-2 region from pass "${entry.pass}"` +
            (entry.reason ? ` — ${entry.reason}` : ''),
          outcome: 'escalated',
        },
      });
    }
  }

  return [...byFinding.values()];
}

/** Compose the frozen bounds (composeInstruction) + the advisory override directive. */
function buildAdvisoryInstruction(candidate: Candidate, ctx: AdvisoryRunContext): string {
  const pass: PassSpec = {
    name: ADVISORY_PASS,
    instruction: '', // composeInstruction does not read this
    rails: [],
    kind: 'advisory',
  };
  const base = composeInstruction(
    pass,
    {
      brand: ctx.brand,
      artifactType: ctx.artifactType ?? 'website',
      creativeDirection: ctx.creativeDirection,
      brandContract: ctx.brandContract,
      tokens: ctx.tokens,
      railBounds: ctx.railBounds,
      findings: [candidate.finding],
      playbook: ctx.playbook,
    },
    ctx.composePaths,
  );
  return `${base}\n\n${ADVISORY_DIRECTIVE}`;
}

// ───────────────────────── persistence ─────────────────────────

/** Read the proposals file. Returns [] if absent; tolerates a missing array. */
export function readProposals(filePath: string): TierTwoProposal[] {
  if (!fs.existsSync(filePath)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
  if (parsed === null || typeof parsed !== 'object') return [];
  const arr = (parsed as { proposals?: unknown }).proposals;
  if (!Array.isArray(arr)) return [];
  return arr.filter(isTierTwoProposal);
}

/** Write proposals as stable JSON (sorted keys, trailing newline), content-compare. */
export function writeProposals(filePath: string, proposals: TierTwoProposal[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = stableStringify({ proposals });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) return;
  fs.writeFileSync(filePath, content, 'utf8');
}

function isTierTwoProposal(v: unknown): v is TierTwoProposal {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const edit = o.proposedEdit as Record<string, unknown> | undefined;
  return (
    typeof o.findingId === 'string' &&
    typeof o.pass === 'string' &&
    !!edit &&
    typeof edit.find === 'string' &&
    typeof edit.replace === 'string' &&
    typeof o.rationale === 'string' &&
    (o.confidence === 'high' || o.confidence === 'medium' || o.confidence === 'low') &&
    (o.status === 'pending' || o.status === 'accepted' || o.status === 'rejected') &&
    typeof o.proposedAt === 'string'
  );
}

/** Stable-key JSON: recursively sorted object keys, 2-space indent, trailing newline. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedKeys(value), 2) + '\n';
}

function sortedKeys(root: unknown): string[] {
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
