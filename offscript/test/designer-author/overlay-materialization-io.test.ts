/**
 * P15 — overlay materialization package persistence. RED-first. Mirrors
 * overlay-approval-io.test.ts's (P14) exact structure: a real Frozen entry
 * is written via the REAL writeOverlay/readOverlay, a MaterializationPackage
 * is written elsewhere, and the real overlay store is proven byte-identical
 * before and after.
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
import { buildMaterializationPackage } from '../../src/designer-author/overlay-materialization-package.js';
import { writeMaterializationPackage, readMaterializationPackage } from '../../src/designer-author/overlay-materialization-io.js';
import { freezeFromDecisionLog, writeOverlay, readOverlay } from '../../src/overlay.js';
import type { DecisionLogEntry } from '../../src/actuation.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'p15-overlay-materialization-io-'));
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
  const report = materializeOverlayCandidate(candidate, approval, { now: () => '2026-07-16T00:00:00.000Z' });
  return buildMaterializationPackage({ materialization: report }, { now: () => '2026-07-16T00:01:00.000Z' });
}

describe('writeMaterializationPackage / readMaterializationPackage', () => {
  it('round-trips a package through disk unchanged', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'materialized.json');
    writeMaterializationPackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
    expect(readMaterializationPackage(filePath)).toEqual(pkg);
  });

  it('creates intermediate directories', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'nested', 'deep', 'materialized.json');
    writeMaterializationPackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
  });

  it('is idempotent: re-writing identical content does not change file bytes', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'materialized.json');
    writeMaterializationPackage(filePath, pkg);
    const first = readFileSync(filePath, 'utf8');
    writeMaterializationPackage(filePath, pkg);
    const second = readFileSync(filePath, 'utf8');
    expect(second).toBe(first);
  });

  it('readMaterializationPackage returns undefined for a missing file', () => {
    expect(readMaterializationPackage(join(dir, 'nope.json'))).toBeUndefined();
  });

  it('readMaterializationPackage returns undefined for malformed JSON', () => {
    const filePath = join(dir, 'bad.json');
    writeFileSync(filePath, 'not json{{{', 'utf8');
    expect(readMaterializationPackage(filePath)).toBeUndefined();
  });

  it('writes stable, sorted-key JSON with a trailing newline', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'materialized.json');
    writeMaterializationPackage(filePath, pkg);
    const raw = readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('P15 — falsification: writing/reading a MaterializationPackage never touches the live Overlay store', () => {
  it('a real Frozen entry, written via the real writeOverlay, is byte-identical before and after a MaterializationPackage is written elsewhere', () => {
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

    const materializedPath = join(dir, 'materialized', 'materialized.json');
    writeMaterializationPackage(materializedPath, samplePackage());

    const after = readFileSync(overlayPath, 'utf8');
    const afterEntries = readOverlay(overlayDir);
    expect(after).toBe(before);
    expect(afterEntries).toEqual(beforeEntries);
  });

  it('overlay-materialization-io.ts imports nothing from overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-author/overlay-materialization-io.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-author/overlay-materialization-io.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
