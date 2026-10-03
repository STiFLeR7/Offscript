/**
 * P09 — Designer Author Foundation: the AuthorProposal model.
 *
 * Designer Author is a PROPOSAL system, not the catalog. Everything this
 * module produces is provisional and immutable. `buildAuthorProposal` never
 * reads or writes `repository/`, never validates against the fragment
 * catalog or the W23 family vocabulary, and never dereferences
 * `parentComponent` — those would each be a real, load-bearing dependency on
 * the catalog subsystem, and this module has deliberately zero such
 * dependency (see the structural "no catalog import" tests in
 * test/designer-author/proposal.test.ts). `semanticFamily` and
 * `parentComponent` are opaque strings the CALLER is responsible for
 * grounding against real vocabulary (e.g. a `family-*` slug, a
 * `canonical::<slug>` id) — validating them is future, explicitly
 * out-of-scope work (see docs/internals/P09-DESIGNER-AUTHOR-FOUNDATION.md
 * §7, "Future Implementation Phases").
 *
 * Identity is content-derived, not time-derived — mirrors `overlay.ts`'s
 * `Frozen.id` and Doctor's `computeReplayIdentity` (P08): the same proposed
 * substance (kind + origin + parentComponent + semanticFamily + content +
 * evidence) always yields the same id, REGARDLESS of `status` or
 * `createdAt`. This is deliberate — a proposal's identity names WHAT was
 * proposed, and that does not change as it moves through its review
 * lifecycle (draft -> overlay-anchored -> under-review ->
 * promotion-recommended | rejected).
 */
import { createHash } from 'node:crypto';

/** Fixed producer tag for every proposal this system creates. */
export const DESIGNER_AUTHOR_PRODUCER = 'designer-author';

/** The kinds of provisional substance Designer Author may propose. Never a canonical fragment. */
export type ProposalKind = 'component' | 'section' | 'variant' | 'overlay';

/**
 * The proposal's position in its own lifecycle (Proposal -> Overlay ->
 * Designer Review -> Promotion Decision). Deliberately stops short of
 * "promoted" / "canonical" — promotion is a separate, explicit, human-gated
 * workflow this sprint does not build (see the STOP list); a proposal that
 * has cleared review is `promotion-recommended`, never further than that.
 */
export type ProposalStatus = 'draft' | 'overlay-anchored' | 'under-review' | 'promotion-recommended' | 'rejected';

/** Who/what produced this proposal, and in what generation context. */
export interface ProposalOrigin {
  readonly producer: string;
  readonly client: string;
  readonly track: 'website' | 'collateral' | 'deck';
  readonly authoredBy: string;
}

/** One piece of grounding for why this proposal is reasonable — never generated advice. */
export interface ProposalEvidence {
  readonly description: string;
  readonly reference?: string;
}

/**
 * PLACEHOLDER ONLY. No review workflow exists yet — `buildAuthorProposal`
 * always yields `reviewHistory: []`. The shape is declared now, ungenerated,
 * so a future review-workflow sprint has a transport contract to fill
 * without changing `AuthorProposal`'s shape.
 */
export interface ProposalReviewEntry {
  readonly reviewer: string;
  readonly decision: string;
  readonly at: string;
  readonly note?: string;
}

/** Content-derived, deterministic identity. */
export interface ProposalIdentity {
  readonly id: string;
  readonly createdAt: string;
}

export interface AuthorProposal {
  readonly identity: ProposalIdentity;
  readonly kind: ProposalKind;
  readonly origin: ProposalOrigin;
  readonly parentComponent?: string;
  readonly semanticFamily: string;
  readonly status: ProposalStatus;
  readonly content: string;
  readonly evidence: readonly ProposalEvidence[];
  readonly reviewHistory: readonly ProposalReviewEntry[];
}

export interface AuthorProposalInput {
  readonly kind: ProposalKind;
  readonly origin: ProposalOrigin;
  readonly parentComponent?: string;
  readonly semanticFamily: string;
  readonly content: string;
  readonly evidence?: readonly ProposalEvidence[];
  readonly status?: ProposalStatus;
}

export interface BuildAuthorProposalOptions {
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

function computeProposalId(input: AuthorProposalInput): string {
  const identityContent = {
    kind: input.kind,
    origin: input.origin,
    parentComponent: input.parentComponent,
    semanticFamily: input.semanticFamily,
    content: input.content,
    evidence: input.evidence ?? [],
  };
  return createHash('sha256').update(stableStringify(identityContent)).digest('hex');
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

/** Build an immutable, deterministic AuthorProposal. Pure — no filesystem, no catalog access. */
export function buildAuthorProposal(
  input: AuthorProposalInput,
  opts: BuildAuthorProposalOptions = {},
): AuthorProposal {
  const now = opts.now ?? (() => new Date().toISOString());
  const proposal: AuthorProposal = {
    identity: {
      id: computeProposalId(input),
      createdAt: now(),
    },
    kind: input.kind,
    origin: { ...input.origin },
    ...(input.parentComponent !== undefined ? { parentComponent: input.parentComponent } : {}),
    semanticFamily: input.semanticFamily,
    status: input.status ?? 'draft',
    content: input.content,
    evidence: (input.evidence ?? []).map((e) => ({ ...e })),
    reviewHistory: [],
  };
  return deepFreeze(proposal);
}
