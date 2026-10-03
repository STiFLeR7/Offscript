/**
 * P10 — Designer Author Consumption: proposal-report.ts, the first real
 * CONSUMER of AuthorProposal (a pure "report generation" reader — Classify:
 * Presentation). RED-first.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import {
  buildProposalManifestReport,
  renderProposalManifestReport,
  summarizeProposal,
} from '../../src/designer-author/proposal-report.js';

function proposal(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}) {
  return buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: '<section data-crf="proposed-hero">draft content</section>',
      ...overrides,
    },
    { now: () => '2026-07-10T00:00:00.000Z' },
  );
}

describe('summarizeProposal', () => {
  it('derives a summary with every field taken verbatim from the proposal', () => {
    const p = proposal({
      parentComponent: 'canonical::hero-bento',
      evidence: [{ description: 'a' }, { description: 'b' }],
      status: 'under-review',
    });
    const summary = summarizeProposal(p);
    expect(summary).toEqual({
      id: p.identity.id,
      kind: p.kind,
      status: 'under-review',
      semanticFamily: p.semanticFamily,
      parentComponent: 'canonical::hero-bento',
      authoredBy: p.origin.authoredBy,
      evidenceCount: 2,
    });
  });

  it('omits parentComponent when absent', () => {
    const summary = summarizeProposal(proposal());
    expect(summary.parentComponent).toBeUndefined();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(summarizeProposal(proposal()))).toBe(true);
  });

  it('never reads or reproduces the proposal content field', () => {
    const p = proposal({ content: 'UNIQUE-MARKER-CONTENT-STRING' });
    const summary = summarizeProposal(p);
    expect(JSON.stringify(summary)).not.toContain('UNIQUE-MARKER-CONTENT-STRING');
  });
});

describe('buildProposalManifestReport', () => {
  it('summarizes every proposal, sorted by id for determinism regardless of input order', () => {
    const a = proposal({ semanticFamily: 'family-hero' });
    const b = proposal({ semanticFamily: 'family-cta' });
    const forward = buildProposalManifestReport([a, b], { now: () => '2026-07-10T01:00:00.000Z' });
    const backward = buildProposalManifestReport([b, a], { now: () => '2026-07-10T01:00:00.000Z' });
    expect(forward).toEqual(backward);
    expect(forward.proposalCount).toBe(2);
    expect(forward.proposals.map((s) => s.id)).toEqual([...forward.proposals.map((s) => s.id)].sort());
  });

  it('is empty for an empty proposal list', () => {
    const report = buildProposalManifestReport([], { now: () => '2026-07-10T02:00:00.000Z' });
    expect(report.proposalCount).toBe(0);
    expect(report.proposals).toEqual([]);
  });

  it('is frozen, including the proposals array and each summary', () => {
    const report = buildProposalManifestReport([proposal()]);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.proposals)).toBe(true);
    expect(Object.isFrozen(report.proposals[0])).toBe(true);
  });
});

describe('renderProposalManifestReport', () => {
  it('renders deterministic markdown containing every proposal id, kind, status, and family', () => {
    const p = proposal({ semanticFamily: 'family-hero', status: 'draft' });
    const report = buildProposalManifestReport([p], { now: () => '2026-07-10T03:00:00.000Z' });
    const md = renderProposalManifestReport(report);
    expect(md).toContain(p.identity.id);
    expect(md).toContain('section');
    expect(md).toContain('draft');
    expect(md).toContain('family-hero');
  });

  it('renders a "no proposals" placeholder for an empty report — never blank/undefined', () => {
    const md = renderProposalManifestReport(buildProposalManifestReport([]));
    expect(md.toLowerCase()).toContain('no proposals');
  });

  it('is deterministic — same report renders identical markdown', () => {
    const report = buildProposalManifestReport([proposal()], { now: () => '2026-07-10T04:00:00.000Z' });
    expect(renderProposalManifestReport(report)).toBe(renderProposalManifestReport(report));
  });
});

describe('structural: proposal-report.ts is presentation-only — no catalog/knowledge/fs coupling', () => {
  it('imports nothing from node:fs, catalog, repository, or knowledge/', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-report.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
    }
  });
});
