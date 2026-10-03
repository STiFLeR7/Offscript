/**
 * P13 — Designer Author Proposal→Overlay Translation. RED-first.
 *
 * Investigation (see docs/internals/P13-...md §3) proved Frozen cannot be
 * reused directly: `pass` and `findingIds` are REQUIRED Frozen fields with
 * no legitimate proposal-derived value (no rail/actuation pass ever runs
 * against a proposal; no operator Finding[] was ever produced for one).
 * `OverlayCandidate` (Option B — an intermediate model) is the result.
 *
 * `FROZEN_FIELD_MAPPING` is the closed, deterministic documentation of every
 * one of Frozen's 7 fields' classification (direct/derived/unavailable) —
 * itself a testable artifact, never derived from a run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER, type AuthorProposal, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import {
  FROZEN_FIELD_MAPPING,
  translateProposalToOverlayCandidate,
  type OverlayCandidate,
} from '../../src/designer-author/proposal-overlay.js';
import type { Frozen } from '../../src/overlay.js';

function origin(overrides: Partial<ProposalOrigin> = {}): ProposalOrigin {
  return {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: 'example-brand',
    track: 'website',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

function sampleProposal(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): AuthorProposal {
  return buildAuthorProposal(
    {
      kind: 'section',
      origin: origin(),
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section with a live workflow demo.',
      evidence: [{ description: 'brief calls for an agentic-product hero', reference: 'brief.md#hero' }],
      ...overrides,
    },
    { now: () => '2026-07-13T00:00:00.000Z' },
  );
}

// Compile-time exhaustiveness: if overlay.ts's Frozen gains/loses a field, this
// object literal fails to type-check — the SAME idiom
// test/platform-harness.test.ts uses for HarnessStageName ("kept in the test
// file, not production code, per 'no new engine behaviour'").
const ALL_FROZEN_FIELDS: Record<keyof Frozen, true> = {
  id: true,
  pass: true,
  findingIds: true,
  snapshotHtml: true,
  reason: true,
  decidedAt: true,
  decidedBy: true,
};

describe('FROZEN_FIELD_MAPPING — mapping correctness / exhaustiveness', () => {
  it('covers EXACTLY the 7 real Frozen fields — no more, no fewer', () => {
    expect(FROZEN_FIELD_MAPPING.map((m) => m.frozenField).sort()).toEqual(Object.keys(ALL_FROZEN_FIELDS).sort());
  });

  it('is a closed, frozen, deterministic constant', () => {
    expect(Object.isFrozen(FROZEN_FIELD_MAPPING)).toBe(true);
    for (const m of FROZEN_FIELD_MAPPING) expect(Object.isFrozen(m)).toBe(true);
  });

  it('pass, findingIds, and snapshotHtml are classified unavailable, each with a rationale and no candidateField', () => {
    for (const field of ['pass', 'findingIds', 'snapshotHtml'] as const) {
      const entry = FROZEN_FIELD_MAPPING.find((m) => m.frozenField === field)!;
      expect(entry.kind).toBe('unavailable');
      expect(entry.candidateField).toBeUndefined();
      expect(entry.rationale.length).toBeGreaterThan(0);
    }
  });

  it('id, reason, decidedAt, decidedBy are classified derived, each naming a real candidateField', () => {
    for (const field of ['id', 'reason', 'decidedAt', 'decidedBy'] as const) {
      const entry = FROZEN_FIELD_MAPPING.find((m) => m.frozenField === field)!;
      expect(entry.kind).toBe('derived');
      expect(typeof entry.candidateField).toBe('string');
    }
  });

  it('every entry with a candidateField names a field that actually exists on a real OverlayCandidate', () => {
    const candidate = translateProposalToOverlayCandidate(sampleProposal()).candidate;
    const candidateKeys = new Set(Object.keys(candidate));
    for (const m of FROZEN_FIELD_MAPPING) {
      if (m.candidateField !== undefined) expect(candidateKeys.has(m.candidateField)).toBe(true);
    }
  });

  it('is never derived from a run — identical across two independently-built candidates', () => {
    const a = translateProposalToOverlayCandidate(sampleProposal());
    const b = translateProposalToOverlayCandidate(sampleProposal({ semanticFamily: 'family-cta' }));
    expect(a.fieldMapping).toEqual(b.fieldMapping);
    expect(a.fieldMapping).toBe(FROZEN_FIELD_MAPPING);
  });
});

describe('translateProposalToOverlayCandidate — deterministic translation', () => {
  it('produces a fully-populated, deep-frozen candidate', () => {
    const proposal = sampleProposal();
    const report = translateProposalToOverlayCandidate(proposal, { now: () => '2026-07-13T01:00:00.000Z' });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.candidate)).toBe(true);
    expect(report.candidate.sourceProposalId).toBe(proposal.identity.id);
    expect(report.candidate.sourceProposalStatus).toBe(proposal.status);
    expect(report.candidate.kind).toBe(proposal.kind);
    expect(report.candidate.semanticFamily).toBe(proposal.semanticFamily);
    expect(report.candidate.proposedContent).toBe(proposal.content);
    expect(report.candidate.decidedBy).toBe(proposal.origin.authoredBy);
    expect(report.candidate.decidedAt).toBe('2026-07-13T01:00:00.000Z');
    expect(report.translatedAt).toBe('2026-07-13T01:00:00.000Z');
  });

  it("the candidate id is `proposal-overlay:<proposal.identity.id>` — content-derived, not fabricated", () => {
    const proposal = sampleProposal();
    const report = translateProposalToOverlayCandidate(proposal);
    expect(report.candidate.id).toBe(`proposal-overlay:${proposal.identity.id}`);
  });

  it('the reason is assembled deterministically from status + evidence count, never generative', () => {
    const withEvidence = translateProposalToOverlayCandidate(sampleProposal()).candidate.reason;
    const withoutEvidence = translateProposalToOverlayCandidate(sampleProposal({ evidence: [] })).candidate.reason;
    expect(withEvidence).toContain('evidence item(s) supplied');
    expect(withoutEvidence).toContain('no evidence supplied');
  });

  describe('missing-field handling', () => {
    it('omits parentComponent from the candidate when the proposal has none — not undefined-but-present', () => {
      const report = translateProposalToOverlayCandidate(sampleProposal());
      expect(report.candidate.parentComponent).toBeUndefined();
      expect('parentComponent' in report.candidate).toBe(false);
    });

    it('carries parentComponent through verbatim when present', () => {
      const report = translateProposalToOverlayCandidate(sampleProposal({ parentComponent: 'canonical::hero-bento' }));
      expect(report.candidate.parentComponent).toBe('canonical::hero-bento');
    });

    it('never has a `pass`, `findingIds`, or `snapshotHtml` key on the candidate — unavailable fields stay unavailable', () => {
      const candidate = translateProposalToOverlayCandidate(sampleProposal()).candidate as unknown as Record<string, unknown>;
      expect('pass' in candidate).toBe(false);
      expect('findingIds' in candidate).toBe(false);
      expect('snapshotHtml' in candidate).toBe(false);
    });
  });

  describe('replay stability / determinism', () => {
    it('same proposal (same now) produces a deep-equal report on every call', () => {
      const proposal = sampleProposal();
      const now = () => '2026-07-13T02:00:00.000Z';
      expect(translateProposalToOverlayCandidate(proposal, { now })).toEqual(translateProposalToOverlayCandidate(proposal, { now }));
    });

    it('changing ONLY the clock leaves every field but decidedAt/translatedAt identical', () => {
      const proposal = sampleProposal();
      const a = translateProposalToOverlayCandidate(proposal, { now: () => '2020-01-01T00:00:00.000Z' });
      const b = translateProposalToOverlayCandidate(proposal, { now: () => '2030-01-01T00:00:00.000Z' });
      expect(a.candidate.id).toBe(b.candidate.id);
      expect(a.candidate.sourceProposalId).toBe(b.candidate.sourceProposalId);
      expect(a.candidate.reason).toBe(b.candidate.reason);
      expect(a.candidate.decidedAt).not.toBe(b.candidate.decidedAt);
    });
  });

  describe('proposal integrity', () => {
    it('never mutates the input proposal — it stays frozen and unchanged', () => {
      const proposal = sampleProposal();
      const before = JSON.stringify(proposal);
      translateProposalToOverlayCandidate(proposal);
      expect(JSON.stringify(proposal)).toBe(before);
      expect(Object.isFrozen(proposal)).toBe(true);
    });

    it('re-translating the SAME unchanged proposal always yields the same candidate id (content-derived stability)', () => {
      const proposal = sampleProposal();
      const ids = [1, 2, 3].map(() => translateProposalToOverlayCandidate(proposal).candidate.id);
      expect(new Set(ids).size).toBe(1);
    });

    it("a genuine proposal's translation is traceable: sourceProposalId round-trips to the exact proposal it came from", () => {
      const proposal = sampleProposal();
      const other = sampleProposal({ semanticFamily: 'family-cta' });
      const report = translateProposalToOverlayCandidate(proposal);
      expect(report.candidate.sourceProposalId).toBe(proposal.identity.id);
      expect(report.candidate.sourceProposalId).not.toBe(other.identity.id);
    });
  });
});

describe('P13 — falsification: translation never touches Overlay storage', () => {
  it('proposal-overlay.ts imports nothing from overlay.js as a VALUE — Frozen is type-only', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-overlay.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      if (line.includes("overlay.js")) {
        expect(line, `overlay.js import must be type-only: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
      expect(line).not.toMatch(/generate\/validate\.js/);
      expect(line).not.toMatch(/governance/i);
      expect(line).not.toMatch(/node:fs/);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog/filterFrozenFindings — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-overlay.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(', 'filterFrozenFindings(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
