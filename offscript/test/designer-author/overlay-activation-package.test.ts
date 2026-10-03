/**
 * P16 — overlay activation package. RED-first. Mirrors
 * overlay-approval-package.test.ts's (P14) and
 * overlay-materialization-package.test.ts's (P15) manifest-correctness and
 * falsification patterns exactly.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { materializeOverlayCandidate } from '../../src/designer-author/overlay-materialization.js';
import { recordOverlayActivation } from '../../src/designer-author/overlay-activation.js';
import { buildActivationPackage } from '../../src/designer-author/overlay-activation-package.js';

function sampleActivation(now = () => '2026-07-17T00:00:00.000Z') {
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
  const approval = recordOverlayApproval(
    { candidate, reviewer: 'designer:amina', status: 'approved', rationale: 'matches brief intent' },
    { now: () => '2026-07-15T00:00:00.000Z' },
  );
  const materialized = materializeOverlayCandidate(candidate, approval, { now: () => '2026-07-16T00:00:00.000Z' }).materialized;
  return recordOverlayActivation(materialized, { activatedBy: 'offscript-activate:cli' }, { now });
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

describe('buildActivationPackage', () => {
  it('produces a manifest with exactly one artifact indexing the activation', () => {
    const activation = sampleActivation();
    const pkg = buildActivationPackage({ activation }, { now: () => '2026-07-17T01:00:00.000Z' });
    expect(pkg.manifest.activationId).toBe(activation.id);
    expect(pkg.manifest.packagedAt).toBe('2026-07-17T01:00:00.000Z');
    expect(pkg.manifest.artifacts).toHaveLength(1);
    expect(pkg.manifest.artifacts[0].name).toBe('overlay-activation.json');
  });

  it('manifest correctness: the recorded hash matches a fresh recomputation over the packaged activation', () => {
    const activation = sampleActivation();
    const pkg = buildActivationPackage({ activation });
    const expectedHash = createHash('sha256').update(stableStringifyForTest(activation)).digest('hex');
    expect(pkg.manifest.artifacts[0].sha256).toBe(expectedHash);
  });

  it('is deterministic: identical activation content produces an identical manifest hash', () => {
    const a = buildActivationPackage({ activation: sampleActivation() }, { now: () => '2026-01-01T00:00:00.000Z' });
    const b = buildActivationPackage({ activation: sampleActivation() }, { now: () => '2026-12-31T00:00:00.000Z' });
    expect(a.manifest.artifacts[0].sha256).toBe(b.manifest.artifacts[0].sha256);
    expect(a.manifest.activationId).toBe(b.manifest.activationId);
  });

  it('embeds the activation verbatim', () => {
    const activation = sampleActivation();
    const pkg = buildActivationPackage({ activation });
    expect(pkg.activation).toEqual(activation);
  });

  it('is deep-frozen', () => {
    const pkg = buildActivationPackage({ activation: sampleActivation() });
    expect(Object.isFrozen(pkg)).toBe(true);
    expect(Object.isFrozen(pkg.manifest)).toBe(true);
    expect(Object.isFrozen(pkg.manifest.artifacts)).toBe(true);
  });

  it('falsification: two different activation actors produce different manifest hashes', () => {
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
    const approval = recordOverlayApproval({ candidate, reviewer: 'designer:amina', status: 'approved', rationale: 'matches brief intent' });
    const materialized = materializeOverlayCandidate(candidate, approval).materialized;
    const a = buildActivationPackage({ activation: recordOverlayActivation(materialized, { activatedBy: 'offscript-activate:cli' }) });
    const b = buildActivationPackage({ activation: recordOverlayActivation(materialized, { activatedBy: 'designer:hill' }) });
    expect(a.manifest.artifacts[0].sha256).not.toBe(b.manifest.artifacts[0].sha256);
  });
});

describe('structural isolation: overlay-activation-package.ts touches no filesystem and no overlay store', () => {
  it('imports nothing from node:fs or overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-activation-package.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });
});
