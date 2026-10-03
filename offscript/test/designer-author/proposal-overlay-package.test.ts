/**
 * P13 — proposal→overlay package. RED-first. Mirrors proposal-package.test.ts's
 * manifest-correctness and falsification patterns exactly.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { buildOverlayCandidatePackage } from '../../src/designer-author/proposal-overlay-package.js';

function sampleTranslation(now = () => '2026-07-13T00:00:00.000Z') {
  const proposal = buildAuthorProposal(
    {
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section.',
    },
    { now },
  );
  return translateProposalToOverlayCandidate(proposal, { now });
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

describe('buildOverlayCandidatePackage', () => {
  it('produces a manifest with exactly one artifact indexing the translation report', () => {
    const translation = sampleTranslation();
    const pkg = buildOverlayCandidatePackage({ translation }, { now: () => '2026-07-13T01:00:00.000Z' });
    expect(pkg.manifest.candidateId).toBe(translation.candidate.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-13T01:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('overlay-candidate.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged translation', () => {
    const translation = sampleTranslation();
    const pkg = buildOverlayCandidatePackage({ translation });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(translation)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical translation content produces an identical manifest hash', () => {
    const a = buildOverlayCandidatePackage({ translation: sampleTranslation() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildOverlayCandidatePackage({ translation: sampleTranslation() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.candidateId).toBe(b.manifest.candidateId);
  });

  it('embeds the translation report verbatim', () => {
    const translation = sampleTranslation();
    const pkg = buildOverlayCandidatePackage({ translation });
    expect(pkg.translation).toEqual(translation);
  });

  it('is deep-frozen', () => {
    const pkg = buildOverlayCandidatePackage({ translation: sampleTranslation() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
  });

  it('falsification: two different proposals produce different manifest hashes', () => {
    const a = buildOverlayCandidatePackage({ translation: sampleTranslation() });
    const b = buildOverlayCandidatePackage({
      translation: translateProposalToOverlayCandidate(
        buildAuthorProposal({
          kind: 'section',
          origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
          semanticFamily: 'family-hero',
          content: 'totally different content',
        }),
      ),
    });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: proposal-overlay-package.ts touches no filesystem and no overlay store', () => {
  it('imports nothing from node:fs or overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-overlay-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });
});
