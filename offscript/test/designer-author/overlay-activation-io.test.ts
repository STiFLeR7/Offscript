/**
 * P16 — overlay activation package persistence. RED-first. Mirrors
 * overlay-approval-io.test.ts (P14) and
 * overlay-materialization-io.test.ts's (P15) exact structure: a real Frozen
 * entry is written via the REAL writeOverlay/readOverlay, an
 * ActivationPackage is written elsewhere, and the real overlay store is
 * proven byte-identical before and after.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync as readFileSyncRoot } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { recordOverlayApproval } from '../../src/designer-author/overlay-approval.js';
import { materializeOverlayCandidate } from '../../src/designer-author/overlay-materialization.js';
import { recordOverlayActivation } from '../../src/designer-author/overlay-activation.js';
import { buildActivationPackage } from '../../src/designer-author/overlay-activation-package.js';
import { writeActivationPackage, readActivationPackage } from '../../src/designer-author/overlay-activation-io.js';
import { freezeFromDecisionLog, writeOverlay, readOverlay } from '../../src/overlay.js';
import type { DecisionLogEntry } from '../../src/actuation.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'p16-overlay-activation-io-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function samplePackage() {
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
  const activation = recordOverlayActivation(materialized, { activatedBy: 'offscript-activate:cli' }, { now: () => '2026-07-17T00:00:00.000Z' });
  return buildActivationPackage({ activation }, { now: () => '2026-07-17T00:01:00.000Z' });
}

describe('writeActivationPackage / readActivationPackage', () => {
  it('round-trips a package through disk unchanged', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'activation.json');
    writeActivationPackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
    expect(readActivationPackage(filePath)).toEqual(pkg);
  });

  it('creates intermediate directories', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'nested', 'deep', 'activation.json');
    writeActivationPackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
  });

  it('is idempotent: re-writing identical content does not change file bytes', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'activation.json');
    writeActivationPackage(filePath, pkg);
    const first = readFileSync(filePath, 'utf8');
    writeActivationPackage(filePath, pkg);
    const second = readFileSync(filePath, 'utf8');
    expect(second).toBe(first);
  });

  it('readActivationPackage returns undefined for a missing file', () => {
    expect(readActivationPackage(join(dir, 'nope.json'))).toBeUndefined();
  });

  it('readActivationPackage returns undefined for malformed JSON', () => {
    const filePath = join(dir, 'bad.json');
    writeFileSync(filePath, 'not json{{{', 'utf8');
    expect(readActivationPackage(filePath)).toBeUndefined();
  });

  it('writes stable, sorted-key JSON with a trailing newline', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'activation.json');
    writeActivationPackage(filePath, pkg);
    const raw = readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('P16 — falsification: writing/reading an ActivationPackage never touches the live Overlay store or runtime', () => {
  it('a real Frozen entry, written via the real writeOverlay, is byte-identical before and after an ActivationPackage is written elsewhere', () => {
    const overlayDir = join(dir, 'overlay');
    const entry: DecisionLogEntry = {
      pass: 'brand-fidelity',
      rails: ['brand-fidelity-scan'],
      status: 'escalated',
      loops: 1,
      residualViolations: [{ id: 'finding-1', description: 'off-token color', outcome: 'escalated' }],
    };
    const frozen = freezeFromDecisionLog(entry, { decidedBy: 'reviewer:hill', now: () => '2026-07-07T00:00:00.000Z' });
    const overlayPath = writeOverlay(overlayDir, frozen);
    const before = readFileSync(overlayPath, 'utf8');
    const beforeEntries = readOverlay(overlayDir);

    const activationPath = join(dir, 'activations', 'activation.json');
    writeActivationPackage(activationPath, samplePackage());

    const after = readFileSync(overlayPath, 'utf8');
    const afterEntries = readOverlay(overlayDir);
    expect(after).toBe(before);
    expect(afterEntries).toEqual(beforeEntries);
  });

  it('overlay-activation-io.ts imports nothing from overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-author/overlay-activation-io.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-author/overlay-activation-io.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
