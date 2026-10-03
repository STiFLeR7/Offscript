import { describe, it, expect } from 'vitest';
import { serializeCreativeArtifact, deserializeCreativeArtifact } from '../src/artifact/serialize.js';
import { computeContentDigest } from '../src/artifact/digest.js';
import type { CreativeArtifact } from '../src/artifact/types.js';

function sample(): CreativeArtifact {
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
  };
}

describe('serializeCreativeArtifact', () => {
  it('is deterministic for the same input', () => {
    const artifact = sample();
    expect(serializeCreativeArtifact(artifact)).toBe(serializeCreativeArtifact(artifact));
  });

  it('produces output that round-trips through deserializeCreativeArtifact', () => {
    const artifact = sample();
    const text = serializeCreativeArtifact(artifact);
    const parsed = deserializeCreativeArtifact(text);
    expect(parsed).toEqual(artifact);
  });

  it('produces valid, parseable JSON', () => {
    const text = serializeCreativeArtifact(sample());
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

describe('deserializeCreativeArtifact', () => {
  it('throws on an unsupported contractVersion', () => {
    const text = JSON.stringify({ ...sample(), contractVersion: 2 });
    expect(() => deserializeCreativeArtifact(text)).toThrow(/contractVersion/);
  });
});
