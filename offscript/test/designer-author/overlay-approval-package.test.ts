/**
 * P14 — overlay approval package. RED-first. Mirrors
 * proposal-overlay-package.test.ts's manifest-correctness and falsification
 * patterns exactly.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { buildApprovalPackage } from '../../src/designer-author/overlay-approval-package.js';

function sampleApproval(now = () => '2026-07-14T00:00:00.000Z') {
  const proposal = buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section.',
    },
    { now: () => '2026-07-13T00:00:00.000Z' },
  );
  const candidate = translateProposalToOverlayCandidate(proposal, { now: () => '2026-07-13T01:00:00.000Z' }).candidate;
  return recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief intent' }, { now });
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

describe('buildApprovalPackage', () => {
  it('produces a manifest with exactly one artifact indexing the approval', () => {
    const approval = sampleApproval();
    const pkg = buildApprovalPackage({ approval }, { now: () => '2026-07-14T01:00:00.000Z' });
    expect(pkg.manifest.approvalId).toBe(approval.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-14T01:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('overlay-approval.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged approval', () => {
    const approval = sampleApproval();
    const pkg = buildApprovalPackage({ approval });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(approval)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical approval content produces an identical manifest hash', () => {
    const a = buildApprovalPackage({ approval: sampleApproval() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildApprovalPackage({ approval: sampleApproval() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.approvalId).toBe(b.manifest.approvalId);
  });

  it('embeds the approval verbatim', () => {
    const approval = sampleApproval();
    const pkg = buildApprovalPackage({ approval });
    expect(pkg.approval).toEqual(approval);
  });

  it('is deep-frozen', () => {
    const pkg = buildApprovalPackage({ approval: sampleApproval() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
  });

  it('falsification: two different decisions produce different manifest hashes', () => {
    const proposal = buildAuthorProposal(
      {
        kind: 'section',
        origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
        semanticFamily: 'family-hero',
        content: 'A well-formed proposed hero section.',
      },
      { now: () => '2026-07-13T00:00:00.000Z' },
    );
    const candidate = translateProposalToOverlayCandidate(proposal, { now: () => '2026-07-13T01:00:00.000Z' }).candidate;
    const a = buildApprovalPackage({
      approval: recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'approved', rationale: 'matches brief intent' }),
    });
    const b = buildApprovalPackage({
      approval: recordOverlayApproval({ candidate, reviewer: 'designer:hill', status: 'rejected', rationale: 'off-brand tone' }),
    });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: overlay-approval-package.ts touches no filesystem and no overlay store', () => {
  it('imports nothing from node:fs or overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-approval-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });
});
