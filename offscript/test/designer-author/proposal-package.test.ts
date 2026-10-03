/**
 * P09 — Designer Author Foundation: ProposalPackage / ProposalManifest.
 *
 * RED-first. Mirrors doctor/review-package.test.ts's manifest-correctness and
 * falsification patterns: the manifest's recorded hash must match a fresh
 * recomputation over the exact packaged content, and packaging must never
 * touch the filesystem (pure, in-memory).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { buildProposalPackage } from '../../src/designer-author/proposal-package.js';

function sampleProposal() {
  return buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: '<section data-crf="proposed-hero">draft content</section>',
    },
    { now: () => '2026-07-09T00:00:00.000Z' },
  );
}

function stableStringifyForTest(value: unknown): string {
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
  walk(value);
  return JSON.stringify(value, Array.from(keys).sort(), 2) + '\n';
}

describe('buildProposalPackage', () => {
  it('produces a manifest with exactly one artifact indexing the proposal', () => {
    const proposal = sampleProposal();
    const pkg = buildProposalPackage({ proposal }, { now: () => '2026-07-09T01:00:00.000Z' });
    expect(pkg.manifest.proposalId).toBe(proposal.identity.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-09T01:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('proposal.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged proposal', () => {
    const proposal = sampleProposal();
    const pkg = buildProposalPackage({ proposal });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(proposal)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical proposal content produces an identical manifest hash', () => {
    const a = buildProposalPackage({ proposal: sampleProposal() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildProposalPackage({ proposal: sampleProposal() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.proposalId).toBe(b.manifest.proposalId);
  });

  it('the package embeds the proposal verbatim', () => {
    const proposal = sampleProposal();
    const pkg = buildProposalPackage({ proposal });
    expect(pkg.proposal).toEqual(proposal);
  });

  it('is deep-frozen', () => {
    const pkg = buildProposalPackage({ proposal: sampleProposal() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts[0])).toBe(true);
  });

  it('falsification: two different proposals (different content) produce different manifest hashes', () => {
    const a = buildProposalPackage({ proposal: sampleProposal() });
    const b = buildProposalPackage({
      proposal: buildAuthorProposal({
        kind: 'section',
        origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
        semanticFamily: 'family-hero',
        content: 'totally different content',
      }),
    });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: proposal-package.ts touches no filesystem and no catalog', () => {
  it('imports nothing from node:fs, catalog, repository, or knowledge/', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
    }
  });
});
