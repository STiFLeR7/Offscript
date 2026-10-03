import { describe, it, expect } from 'vitest';
import { computeContentDigest } from '../src/artifact/digest.js';
import type { CreativeArtifact } from '../src/artifact/types.js';

function minimalArtifact(overrides: Partial<CreativeArtifact> = {}): CreativeArtifact {
  return {
    contractVersion: 1,
    id: 'exception-triage-queue-desktop',
    intentDigest: computeContentDigest('intent-payload'),
    artifactType: 'html',
    location: 'projects/example-brand-apa/creative-assets/run-1/exception-triage-queue.html',
    artifactDigest: computeContentDigest('<html>the artifact</html>'),
    createdAt: '2026-08-11T00:00:00.000Z',
    generation: { sourceSystem: 'creative-generation' },
    approval: { status: 'approved', source: 'creative-generation' },
    ...overrides,
  };
}

describe('CreativeArtifact shape', () => {
  it('a minimal valid object satisfies the required fields', () => {
    const artifact = minimalArtifact();
    expect(artifact.contractVersion).toBe(1);
    expect(artifact.generation.sourceSystem).toBe('creative-generation');
    expect(artifact.approval.status).toBe('approved');
  });

  it('does not define, and is not shaped like, a Offscript ReadinessState', () => {
    const artifact = minimalArtifact();
    // A future explicit bridge may exist someday; today nothing here should
    // accidentally read as Offscript project-readiness admission.
    expect((artifact as unknown as Record<string, unknown>).admission).toBeUndefined();
    expect((artifact as unknown as Record<string, unknown>).readinessState).toBeUndefined();
    expect((artifact as unknown as Record<string, unknown>).blockers).toBeUndefined();
  });

  it('intentDigest and artifactDigest are independent fields that may differ', () => {
    const artifact = minimalArtifact();
    expect(artifact.intentDigest).not.toBe(artifact.artifactDigest);
  });

  it('supports optional validation and provenance', () => {
    const artifact = minimalArtifact({
      validation: { status: 'passed', validator: 'creative-generation/visual-proof-validation' },
      provenance: { note: 'from Repo B Output/_LOG.md' },
    });
    expect(artifact.validation?.status).toBe('passed');
    expect(artifact.provenance?.note).toBe('from Repo B Output/_LOG.md');
  });
});
