import { describe, it, expect } from 'vitest';
import { CreativeIntentValidator } from '../src/intent/validate.js';
import { computeDigest } from '../src/intent/digest.js';
import type { CreativeIntentWire } from '../src/intent/types.js';

function validWire(): CreativeIntentWire {
  const digest = computeDigest({
    contractVersion: 1,
    id: 'owned-task-handoff',
    belief: 'nothing falls through the cracks',
    feature: 'collaboration',
    ratio: '16:9',
    camera: 'component',
    mustInclude: [],
    contentProvenance: 'augmented',
  });
  return {
    id: 'owned-task-handoff',
    contractVersion: 1,
    digest,
    belief: 'nothing falls through the cracks',
    feature: 'collaboration',
    ratio: '16:9',
    camera: 'component',
    'must-include': [],
    'content-provenance': 'augmented',
  };
}

describe('CreativeIntentValidator', () => {
  const validator = new CreativeIntentValidator();

  it('accepts a valid, digest-correct, approved wire object with no errors', () => {
    const result = validator.validate(validWire(), { sourceApproved: true });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails schema validation when a required field is missing', () => {
    const wire = validWire();
    // @ts-expect-error deliberately deleting a required field for the test
    delete wire.belief;
    const result = validator.validate(wire, { sourceApproved: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /belief/.test(e))).toBe(true);
  });

  it('fails schema validation on an unsupported enum value', () => {
    const wire = { ...validWire(), feature: 'customer-support' };
    const result = validator.validate(wire, { sourceApproved: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /feature/.test(e))).toBe(true);
  });

  it('fails on a digest mismatch even when the schema itself is satisfied', () => {
    const wire = { ...validWire(), digest: 'sha256:' + '0'.repeat(64) };
    const result = validator.validate(wire, { sourceApproved: true });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /digest/i.test(e))).toBe(true);
  });

  it('fails the trust precondition when the source creative was not approved=yes', () => {
    const result = validator.validate(validWire(), { sourceApproved: false });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /approved/i.test(e))).toBe(true);
  });

  it('warns (does not fail) on an unrecognized top-level key', () => {
    const wire = { ...validWire(), brand: 'example-brand' } as CreativeIntentWire;
    const result = validator.validate(wire, { sourceApproved: true });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => /brand/.test(w))).toBe(true);
  });

  it('accumulates all applicable errors rather than stopping at the first', () => {
    const wire = { ...validWire(), feature: 'bogus', digest: 'not-a-digest' };
    const result = validator.validate(wire, { sourceApproved: false });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
