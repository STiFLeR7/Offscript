import { describe, it, expect } from 'vitest';
import { CreativeArtifactValidator } from '../src/artifact/validate.js';
import { computeContentDigest } from '../src/artifact/digest.js';
import type { CreativeArtifact } from '../src/artifact/types.js';

const validator = new CreativeArtifactValidator();

describe('one intent, multiple artifacts', () => {
  it('accepts two independently valid artifacts sharing the same intentDigest', () => {
    const intentDigest = computeContentDigest('the-one-intent');

    const desktop: CreativeArtifact = {
      contractVersion: 1,
      id: 'exception-triage-queue-desktop',
      intentDigest,
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-1/desktop.html',
      artifactDigest: computeContentDigest('<html>desktop</html>'),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation' },
      approval: { status: 'approved', source: 'creative-generation' },
    };

    const mobile: CreativeArtifact = {
      contractVersion: 1,
      id: 'exception-triage-queue-mobile',
      intentDigest,
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-1/mobile.html',
      artifactDigest: computeContentDigest('<html>mobile</html>'),
      createdAt: '2026-08-11T00:00:05.000Z',
      generation: { sourceSystem: 'creative-generation' },
      approval: { status: 'pending', source: 'creative-generation' },
    };

    expect(validator.validate(desktop).ok).toBe(true);
    expect(validator.validate(mobile).ok).toBe(true);
    expect(desktop.intentDigest).toBe(mobile.intentDigest);
    expect(desktop.artifactDigest).not.toBe(mobile.artifactDigest);
    expect(desktop.id).not.toBe(mobile.id);
    // Independent approval per artifact of the same intent.
    expect(desktop.approval.status).not.toBe(mobile.approval.status);
  });
});

describe('regeneration lifecycle (A1 -> A2)', () => {
  it('models a regenerated artifact as a wholly new, independently-identified record', () => {
    const intentDigest = computeContentDigest('regeneration-intent');

    const a1: CreativeArtifact = {
      contractVersion: 1,
      id: 'run-1-artifact',
      intentDigest,
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-1/artifact.html',
      artifactDigest: computeContentDigest('<html>version one</html>'),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation', runId: 'run-1' },
      approval: { status: 'approved', source: 'creative-generation' },
    };

    const a2: CreativeArtifact = {
      contractVersion: 1,
      id: 'run-2-artifact',
      intentDigest,
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-2/artifact.html',
      artifactDigest: computeContentDigest('<html>version two, regenerated</html>'),
      createdAt: '2026-08-11T01:00:00.000Z',
      generation: { sourceSystem: 'creative-generation', runId: 'run-2' },
      approval: { status: 'pending', source: 'creative-generation' },
    };

    expect(validator.validate(a1).ok).toBe(true);
    expect(validator.validate(a2).ok).toBe(true);
    // Both remain independently addressable and valid — A2 does not overwrite or
    // invalidate A1's record; nothing in this contract deletes or mutates a prior artifact.
    expect(a1.id).not.toBe(a2.id);
    expect(a1.artifactDigest).not.toBe(a2.artifactDigest);
    expect(a1.intentDigest).toBe(a2.intentDigest);
  });

  it('a byte-identical regeneration under a new id legitimately shares the prior artifactDigest', () => {
    const intentDigest = computeContentDigest('idempotent-intent');
    const content = '<html>unchanged output</html>';

    const a1: CreativeArtifact = {
      contractVersion: 1,
      id: 'run-1-artifact',
      intentDigest,
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-1/artifact.html',
      artifactDigest: computeContentDigest(content),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation', runId: 'run-1' },
      approval: { status: 'approved', source: 'creative-generation' },
    };

    const a2: CreativeArtifact = {
      ...a1,
      id: 'run-2-artifact',
      location: 'projects/example-brand-apa/creative-assets/run-2/artifact.html',
      createdAt: '2026-08-11T02:00:00.000Z',
      generation: { sourceSystem: 'creative-generation', runId: 'run-2' },
    };

    expect(validator.validate(a1).ok).toBe(true);
    expect(validator.validate(a2).ok).toBe(true);
    expect(a1.artifactDigest).toBe(a2.artifactDigest); // same bytes, legitimately
    expect(a1.id).not.toBe(a2.id); // still distinct, immutable records
  });
});

describe('intentDigest independence from artifactDigest', () => {
  it('a shared intentDigest never implies a shared artifactDigest, and vice versa', () => {
    const sameIntent = computeContentDigest('shared-intent');
    const artifactA = computeContentDigest('content A');
    const artifactB = computeContentDigest('content B');

    expect(artifactA).not.toBe(sameIntent);
    expect(artifactB).not.toBe(sameIntent);
    expect(artifactA).not.toBe(artifactB);
  });
});

describe('portability across offscript -> offscript-portable', () => {
  it('a portable, project-relative artifact reference stays valid with no path rewrite', () => {
    const artifact: CreativeArtifact = {
      contractVersion: 1,
      id: 'portable-artifact',
      intentDigest: computeContentDigest('portable-intent'),
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-1/artifact.html',
      artifactDigest: computeContentDigest('<html>portable</html>'),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation' },
      approval: { status: 'approved', source: 'creative-generation' },
    };
    // The same relative reference is valid whether resolved from D:/offscript/offscript
    // or from D:/EXAMPLE BRAND/Offscript/offscript-portable — identity/validity never depends on
    // which repo root it's read from.
    expect(validator.validate(artifact).ok).toBe(true);
  });

  it('rejects an artifact reference naming Repo B directly', () => {
    const artifact = {
      contractVersion: 1,
      id: 'non-portable-artifact',
      intentDigest: computeContentDigest('intent'),
      artifactType: 'html',
      location: 'D:/Offscript-creatives-generation/Output/exception-triage-queue.html',
      artifactDigest: computeContentDigest('<html>x</html>'),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation' },
      approval: { status: 'approved', source: 'creative-generation' },
    };
    expect(validator.validate(artifact).ok).toBe(false);
  });
});

describe('approval origin never implies Offscript readiness', () => {
  it('an approved artifact carries no Offscript ReadinessState-shaped data', () => {
    const artifact: CreativeArtifact = {
      contractVersion: 1,
      id: 'approval-boundary-artifact',
      intentDigest: computeContentDigest('intent'),
      artifactType: 'html',
      location: 'projects/example-brand-apa/creative-assets/run-1/artifact.html',
      artifactDigest: computeContentDigest('<html>x</html>'),
      createdAt: '2026-08-11T00:00:00.000Z',
      generation: { sourceSystem: 'creative-generation' },
      approval: { status: 'approved', source: 'creative-generation' },
    };
    expect(artifact.approval.source).toBe('creative-generation');
    expect(artifact.approval.source).not.toBe('offscript');
    const asRecord = artifact as unknown as Record<string, unknown>;
    expect(asRecord.readinessState).toBeUndefined();
    expect(asRecord.admission).toBeUndefined();
  });
});
