/**
 * P16 — Overlay Activation Architecture. RED-first.
 *
 * Fresh investigation (see docs/internals/P16-OVERLAY-ACTIVATION-ARCHITECTURE.md
 * §3) re-traces the REAL overlay loading pipeline from source, not from prior
 * reports: `readOverlay` has exactly two production call sites
 * (scripts/harden.ts, tagging Tier-2 advisory candidates; and
 * validate-loop-driver.ts, feeding Doctor's read-only report) — both
 * informational, never a live gate. `filterFrozenFindings`, the one function
 * whose own docstring describes gating re-actuation on frozen entries, has
 * ZERO production call sites — it exists only in overlay.ts's own module doc
 * comment and test/overlay.test.ts. Activation, as this sprint defines it,
 * therefore matches how the real runtime already treats overlay entries:
 * available to be read, never an automatic behavioral gate.
 *
 * Architecture: Option A (materialize into literal Frozen) and the literal
 * reading of Option B ("Activation Package produces Frozen") both still
 * require fabricating `pass`/`findingIds` — both REQUIRED Frozen fields,
 * still unavailable, unchanged since P13/P15 (activation adds accountability
 * metadata, never new rail-actuation provenance). Option C (wire the real
 * overlay runtime to consume MaterializedOverlay) would require modifying
 * `overlay.ts`/`scripts/harden.ts` — forbidden by this sprint's own "no
 * automatic runtime consumption" constraint and by the whole program's
 * established never-touch-overlay.ts isolation discipline. This module is
 * therefore a dedicated `OverlayActivation` model (Option B's SPIRIT — a
 * deterministic, packaged activation record — corrected to never fabricate
 * a literal `Frozen`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER, type AuthorProposal, type ProposalOrigin } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate, type OverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { materializeOverlayCandidate } from '../../src/designer-author/overlay-materialization.js';
import type { MaterializedFrozenOverlay } from '../../src/designer-author/overlay-materialization.js';
import {
  ActivationError,
  recordOverlayActivation,
  revokeOverlayActivation,
  resolveActivationStatus,
  type OverlayActivation,
} from '../../src/designer-author/overlay-activation.js';

function origin(overrides: Partial<ProposalOrigin> = {}): ProposalOrigin {
  return {
    producer: DESIGNER_AUTHOR_PRODUCER,
    client: 'example-brand',
    track: 'website',
    authoredBy: 'designer:hill',
    ...overrides,
  };
}

function sampleProposal(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): AuthorProposal {
  return buildAuthorProposal(
    {
      kind: 'section',
      origin: origin(),
      semanticFamily: 'family-hero',
      content: 'A well-formed proposed hero section with a live workflow demo.',
      evidence: [{ description: 'brief calls for an agentic-product hero', reference: 'brief.md#hero' }],
      ...overrides,
    },
    { now: () => '2026-07-13T00:00:00.000Z' },
  );
}

function sampleCandidate(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): OverlayCandidate {
  return translateProposalToOverlayCandidate(sampleProposal(overrides), { now: () => '2026-07-13T01:00:00.000Z' }).candidate;
}

function sampleMaterialized(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}): MaterializedFrozenOverlay {
  const candidate = sampleCandidate(overrides);
  const approval = recordOverlayApproval(
    { candidate, reviewer: 'designer:amina', status: 'approved', rationale: 'matches brief intent, evidence checks out' },
    { now: () => '2026-07-15T00:00:00.000Z' },
  );
  return materializeOverlayCandidate(candidate, approval, { now: () => '2026-07-16T00:00:00.000Z' }).materialized;
}

describe('recordOverlayActivation — the activation model captures only facts', () => {
  it('produces a deep-frozen OverlayActivation', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'offscript-activate:cli' }, { now: () => '2026-07-17T00:00:00.000Z' });
    expect(Object.isFrozen(activation)).toBe(true);
  });

  it('carries sourceMaterializedId/sourceApprovalId/sourceCandidateId/sourceProposalId verbatim from the materialized overlay', () => {
    const materialized = sampleMaterialized();
    const activation = recordOverlayActivation(materialized, { activatedBy: 'offscript-activate:cli' });
    expect(activation.sourceMaterializedId).toBe(materialized.id);
    expect(activation.sourceApprovalId).toBe(materialized.sourceApprovalId);
    expect(activation.sourceCandidateId).toBe(materialized.sourceCandidateId);
    expect(activation.sourceProposalId).toBe(materialized.sourceProposalId);
  });

  it('carries the activation actor and timestamp verbatim — never generated, never inferred', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' }, { now: () => '2026-07-17T00:00:00.000Z' });
    expect(activation.activatedBy).toBe('designer:hill');
    expect(activation.activatedAt).toBe('2026-07-17T00:00:00.000Z');
  });

  it('does NOT duplicate reason/decidedAt/decidedBy — those stay owned by the MaterializedFrozenOverlay, never re-carried', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' }) as unknown as Record<string, unknown>;
    expect('reason' in activation).toBe(false);
    expect('decidedAt' in activation).toBe(false);
    expect('decidedBy' in activation).toBe(false);
  });

  it('never has a `pass`, `findingIds`, or `snapshotHtml` key — activation introduces no new rail-actuation provenance', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' }) as unknown as Record<string, unknown>;
    expect('pass' in activation).toBe(false);
    expect('findingIds' in activation).toBe(false);
    expect('snapshotHtml' in activation).toBe(false);
  });

  describe('activation integrity — fail loud on missing facts', () => {
    it('throws ActivationError when activatedBy is empty', () => {
      expect(() => recordOverlayActivation(sampleMaterialized(), { activatedBy: '  ' })).toThrow(ActivationError);
    });

    it('throws ActivationError when the materialized overlay has an empty id', () => {
      const materialized = { ...sampleMaterialized(), id: '' };
      expect(() => recordOverlayActivation(materialized, { activatedBy: 'designer:hill' })).toThrow(ActivationError);
    });

    it('throws ActivationError when the materialized overlay has an empty sourceApprovalId', () => {
      const materialized = { ...sampleMaterialized(), sourceApprovalId: '' };
      expect(() => recordOverlayActivation(materialized, { activatedBy: 'designer:hill' })).toThrow(ActivationError);
    });
  });
});

describe('deterministic identity / replay stability', () => {
  it('same materialized overlay + same activatedBy (same now) produces a deep-equal activation on every call', () => {
    const materialized = sampleMaterialized();
    const now = () => '2026-07-17T00:00:00.000Z';
    const input = { activatedBy: 'designer:hill' };
    expect(recordOverlayActivation(materialized, input, { now })).toEqual(recordOverlayActivation(materialized, input, { now }));
  });

  it('changing ONLY the clock leaves id and every fact but activatedAt identical — id is content-derived, not time-derived', () => {
    const materialized = sampleMaterialized();
    const input = { activatedBy: 'designer:hill' };
    const a = recordOverlayActivation(materialized, input, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = recordOverlayActivation(materialized, input, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).toBe(b.id);
    expect(a.sourceMaterializedId).toBe(b.sourceMaterializedId);
    expect(a.activatedBy).toBe(b.activatedBy);
    expect(a.activatedAt).not.toBe(b.activatedAt);
  });

  it('a different activatedBy on the same materialized overlay produces a different id', () => {
    const materialized = sampleMaterialized();
    const a = recordOverlayActivation(materialized, { activatedBy: 'designer:hill' });
    const b = recordOverlayActivation(materialized, { activatedBy: 'designer:amina' });
    expect(a.id).not.toBe(b.id);
  });

  it('a different materialized overlay produces a different activation id', () => {
    const a = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    const b = recordOverlayActivation(sampleMaterialized({ semanticFamily: 'family-cta' }), { activatedBy: 'designer:hill' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('mapping correctness / integrity', () => {
  it('never mutates the input materialized overlay — it stays frozen and unchanged', () => {
    const materialized = sampleMaterialized();
    const before = JSON.stringify(materialized);
    recordOverlayActivation(materialized, { activatedBy: 'designer:hill' });
    expect(JSON.stringify(materialized)).toBe(before);
    expect(Object.isFrozen(materialized)).toBe(true);
  });
});

describe('revokeOverlayActivation / resolveActivationStatus — reversibility', () => {
  it('an activation with no revocations resolves to "activated"', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    expect(resolveActivationStatus(activation, [])).toBe('activated');
  });

  it('revoking produces a deep-frozen ActivationRevocation referencing the original activation id', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    const revocation = revokeOverlayActivation(activation, { revokedBy: 'designer:amina', reason: 'upstream brand tokens changed' }, { now: () => '2026-07-18T00:00:00.000Z' });
    expect(Object.isFrozen(revocation)).toBe(true);
    expect(revocation.activationId).toBe(activation.id);
    expect(revocation.revokedBy).toBe('designer:amina');
    expect(revocation.reason).toBe('upstream brand tokens changed');
    expect(revocation.revokedAt).toBe('2026-07-18T00:00:00.000Z');
  });

  it('resolveActivationStatus returns "revoked" once a matching revocation exists', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    const revocation = revokeOverlayActivation(activation, { revokedBy: 'designer:amina', reason: 'no longer needed' });
    expect(resolveActivationStatus(activation, [revocation])).toBe('revoked');
  });

  it('a revocation for a DIFFERENT activation does not affect this one\'s status', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    const other = recordOverlayActivation(sampleMaterialized({ semanticFamily: 'family-cta' }), { activatedBy: 'designer:hill' });
    const revocationForOther = revokeOverlayActivation(other, { revokedBy: 'designer:amina', reason: 'unrelated' });
    expect(resolveActivationStatus(activation, [revocationForOther])).toBe('activated');
  });

  it('revoking never mutates the original activation', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    const before = JSON.stringify(activation);
    revokeOverlayActivation(activation, { revokedBy: 'designer:amina', reason: 'test' });
    expect(JSON.stringify(activation)).toBe(before);
  });

  it('throws ActivationError when revokedBy or reason is empty', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    expect(() => revokeOverlayActivation(activation, { revokedBy: '', reason: 'ok' })).toThrow(ActivationError);
    expect(() => revokeOverlayActivation(activation, { revokedBy: 'designer:amina', reason: '' })).toThrow(ActivationError);
  });

  it('revocation id is content-derived, not time-derived', () => {
    const activation = recordOverlayActivation(sampleMaterialized(), { activatedBy: 'designer:hill' });
    const input = { revokedBy: 'designer:amina', reason: 'consistent reason' };
    const a = revokeOverlayActivation(activation, input, { now: () => '2020-01-01T00:00:00.000Z' });
    const b = revokeOverlayActivation(activation, input, { now: () => '2030-01-01T00:00:00.000Z' });
    expect(a.id).toBe(b.id);
    expect(a.revokedAt).not.toBe(b.revokedAt);
  });
});

describe('P16 — falsification: activation never touches the live Overlay store or runtime', () => {
  it('overlay-activation.ts imports nothing from overlay.js as a VALUE, and nothing from node:fs', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-activation.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      if (line.includes('overlay.js')) {
        expect(line, `overlay.js import must be type-only: ${line}`).toMatch(/^\s*import\s+type\b/);
      }
      expect(line).not.toMatch(/node:fs/);
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/governance/i);
      expect(line).not.toMatch(/harden\.js/);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog/filterFrozenFindings — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/overlay-activation.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(', 'filterFrozenFindings(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
