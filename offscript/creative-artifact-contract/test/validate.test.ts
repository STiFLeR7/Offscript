import { describe, it, expect } from 'vitest';
import { CreativeArtifactValidator } from '../src/artifact/validate.js';
import { computeContentDigest } from '../src/artifact/digest.js';

const validator = new CreativeArtifactValidator();

function validWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

describe('CreativeArtifactValidator — valid artifact', () => {
  it('passes a fully valid artifact', () => {
    const result = validator.validate(validWire());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes a valid artifact with optional validation + provenance', () => {
    const result = validator.validate(
      validWire({
        validation: { status: 'passed', validator: 'creative-generation/visual-proof-validation' },
        provenance: { sourceHash: 'abc123' },
      })
    );
    expect(result.ok).toBe(true);
  });
});

describe('CreativeArtifactValidator — invalid artifact', () => {
  it('rejects a missing identity (id)', () => {
    const wire = validWire();
    delete (wire as Record<string, unknown>).id;
    const result = validator.validate(wire);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects an unsupported artifact type', () => {
    const result = validator.validate(validWire({ artifactType: 'video' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid intentDigest format', () => {
    const result = validator.validate(validWire({ intentDigest: 'not-a-real-digest' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing intentDigest', () => {
    const wire = validWire();
    delete (wire as Record<string, unknown>).intentDigest;
    const result = validator.validate(wire);
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid artifactDigest format', () => {
    const result = validator.validate(validWire({ artifactDigest: 'sha256:short' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid provenance value type (nested object, not string/number/boolean)', () => {
    const result = validator.validate(validWire({ provenance: { nested: { bad: true } } }));
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid approval status', () => {
    const result = validator.validate(validWire({ approval: { status: 'maybe', source: 'creative-generation' } }));
    expect(result.ok).toBe(false);
  });

  it('rejects an approval object missing source', () => {
    const result = validator.validate(validWire({ approval: { status: 'approved' } }));
    expect(result.ok).toBe(false);
  });

  it('rejects a generation object missing sourceSystem', () => {
    const result = validator.validate(validWire({ generation: {} }));
    expect(result.ok).toBe(false);
  });

  it('rejects an absolute machine-specific location', () => {
    const result = validator.validate(
      validWire({ location: 'D:/Offscript-creatives-generation/Output/exception-triage-queue.html' })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /absolute|drive|portable/i.test(e))).toBe(true);
  });

  it('accepts a portable project-relative location', () => {
    const result = validator.validate(
      validWire({ location: 'projects/example-brand-apa/creative-assets/run-1/exception-triage-queue.html' })
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a content-addressed content:// location', () => {
    const result = validator.validate(
      validWire({ location: 'content://' + computeContentDigest('artifact-bytes') })
    );
    expect(result.ok).toBe(true);
  });
});
