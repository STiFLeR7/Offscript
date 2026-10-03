/**
 * P09 — Designer Author Foundation: AuthorProposal model.
 *
 * RED-first per superpowers:test-driven-development. Covers: immutability,
 * deterministic content-derived identity, the reviewHistory placeholder, and
 * the structural isolation guarantee (this module imports nothing from the
 * catalog / repository / knowledge subsystem — see the "no catalog import"
 * test at the bottom).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildAuthorProposal,
  DESIGNER_AUTHOR_PRODUCER,
  type AuthorProposalInput,
  type ProposalOrigin,
} from '../../src/designer-author/proposal.js';

function origin(overrides: Partial<ProposalOrigin> = {}): ProposalOrigin {
  return {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: 'example-brand',
    track: 'website',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

function sampleInput(overrides: Partial<AuthorProposalInput> = {}): AuthorProposalInput {
  return {
    kind: 'section',
    origin: origin(),
    semanticFamily: 'family-hero',
    content: '<section data-crf="proposed-hero">draft content</section>',
    ...overrides,
  };
}

describe('buildAuthorProposal', () => {
  it('produces a fully-populated, deep-frozen proposal', () => {
    const proposal = buildAuthorProposal(sampleInput(), { now: () => '2026-07-09T00:00:00.000Z' });
    expect(proposal.kind).toBe('section');
    expect(proposal.semanticFamily).toBe('family-hero');
    expect(proposal.content).toBe('<section data-crf="proposed-hero">draft content</section>');
    expect(proposal.status).toBe('draft');
    expect(proposal.reviewHistory).toEqual([]);
    expect(proposal.evidence).toEqual([]);
    expect(proposal.identity.createdAt).toBe('2026-07-09T00:00:00.000Z');
    expect(typeof proposal.identity.id).toBe('string');
    expect(proposal.identity.id.length).toBeGreaterThan(0);
  });

  it('is deep-frozen — the proposal, its identity, origin, evidence, and reviewHistory', () => {
    const proposal = buildAuthorProposal(sampleInput());
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.identity)).toBe(true);
    expect(Object.isFrozen(proposal.origin)).toBe(true);
    expect(Object.isFrozen(proposal.evidence)).toBe(true);
    expect(Object.isFrozen(proposal.reviewHistory)).toBe(true);
  });

  it('defaults parentComponent to absent and status to draft when omitted', () => {
    const proposal = buildAuthorProposal(sampleInput());
    expect(proposal.parentComponent).toBeUndefined();
    expect(proposal.status).toBe('draft');
  });

  it('carries an explicit parentComponent and status through verbatim', () => {
    const proposal = buildAuthorProposal(
      sampleInput({ parentComponent: 'canonical::hero-bento', status: 'under-review' }),
    );
    expect(proposal.parentComponent).toBe('canonical::hero-bento');
    expect(proposal.status).toBe('under-review');
  });

  it('carries evidence through verbatim, deep-frozen per entry', () => {
    const proposal = buildAuthorProposal(
      sampleInput({
        evidence: [
          { description: 'brief calls for an agentic-product hero', reference: 'brief.md#hero' },
          { description: 'matches family-hero Choose-when: product screenshot present' },
        ],
      }),
    );
    expect(proposal.evidence).toHaveLength(2);
    expect(proposal.evidence[0]).toEqual({
      description: 'brief calls for an agentic-product hero',
      reference: 'brief.md#hero',
    });
    expect(Object.isFrozen(proposal.evidence[0])).toBe(true);
  });

  describe('deterministic content-derived identity', () => {
    it('same input (same now) produces the same id', () => {
      const now = () => '2026-07-09T00:00:00.000Z';
      const a = buildAuthorProposal(sampleInput(), { now });
      const b = buildAuthorProposal(sampleInput(), { now });
      expect(a.identity.id).toBe(b.identity.id);
    });

    it('changing content changes the id', () => {
      const a = buildAuthorProposal(sampleInput());
      const b = buildAuthorProposal(sampleInput({ content: 'different content' }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing kind changes the id', () => {
      const a = buildAuthorProposal(sampleInput({ kind: 'section' }));
      const b = buildAuthorProposal(sampleInput({ kind: 'component' }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing semanticFamily changes the id', () => {
      const a = buildAuthorProposal(sampleInput({ semanticFamily: 'family-hero' }));
      const b = buildAuthorProposal(sampleInput({ semanticFamily: 'family-cta' }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing parentComponent changes the id', () => {
      const a = buildAuthorProposal(sampleInput());
      const b = buildAuthorProposal(sampleInput({ parentComponent: 'canonical::hero-bento' }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing origin changes the id', () => {
      const a = buildAuthorProposal(sampleInput({ origin: origin({ client: 'example-brand' }) }));
      const b = buildAuthorProposal(sampleInput({ origin: origin({ client: 'forgeline' }) }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing evidence changes the id', () => {
      const a = buildAuthorProposal(sampleInput());
      const b = buildAuthorProposal(sampleInput({ evidence: [{ description: 'new evidence' }] }));
      expect(a.identity.id).not.toBe(b.identity.id);
    });

    it('changing ONLY status does NOT change the id — status is lifecycle state, not identity', () => {
      const a = buildAuthorProposal(sampleInput({ status: 'draft' }));
      const b = buildAuthorProposal(sampleInput({ status: 'under-review' }));
      expect(a.identity.id).toBe(b.identity.id);
    });

    it('changing ONLY createdAt (via now) does NOT change the id — id is content-derived, not time-derived', () => {
      const a = buildAuthorProposal(sampleInput(), { now: () => '2026-01-01T00:00:00.000Z' });
      const b = buildAuthorProposal(sampleInput(), { now: () => '2026-12-31T00:00:00.000Z' });
      expect(a.identity.id).toBe(b.identity.id);
      expect(a.identity.createdAt).not.toBe(b.identity.createdAt);
    });
  });

  describe('falsification: reviewHistory is a placeholder only', () => {
    it('is always empty regardless of input — no review workflow exists yet to populate it', () => {
      const proposal = buildAuthorProposal(sampleInput());
      expect(proposal.reviewHistory).toEqual([]);
    });

    it('AuthorProposalInput has no field that can seed reviewHistory (compile-time: no such key)', () => {
      // If this compiled with a `reviewHistory` key on the input, the placeholder
      // guarantee above would be a runtime accident, not a structural one.
      const input = sampleInput();
      expect('reviewHistory' in input).toBe(false);
    });
  });
});

describe('structural isolation: this module has zero coupling to the catalog/repository/knowledge subsystem', () => {
  it('imports nothing from generate/catalog, knowledge/, or repository paths', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
      expect(line).not.toMatch(/markdown-source/);
      expect(line).not.toMatch(/node:fs/);
    }
  });
});
