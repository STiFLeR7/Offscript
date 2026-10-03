/**
 * P18 — designer feedback package persistence. RED-first. Mirrors
 * overlay-approval-io.test.ts's exact structure: a real Frozen entry is
 * written via the REAL writeOverlay/readOverlay, a FeedbackPackage is
 * written elsewhere, and the real overlay store is proven byte-identical
 * before and after.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync as readFileSyncRoot } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { recordDesignerFeedback } from '../../src/designer-feedback/designer-feedback.js';
import { buildFeedbackPackage } from '../../src/designer-feedback/designer-feedback-package.js';
import { writeFeedbackPackage, readFeedbackPackage } from '../../src/designer-feedback/designer-feedback-io.js';
import { freezeFromDecisionLog, writeOverlay, readOverlay } from '../../src/overlay.js';
import type { DecisionLogEntry } from '../../src/actuation.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'p18-designer-feedback-io-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function samplePackage() {
  const feedback = recordDesignerFeedback(
    { subject: { kind: 'doctor-finding', id: 'contrast:hero' }, reviewer: 'designer:hill', status: 'accept', note: 'looks right' },
    { now: () => '2026-07-10T00:00:00.000Z' },
  );
  return buildFeedbackPackage({ feedback }, { now: () => '2026-07-10T00:01:00.000Z' });
}

describe('writeFeedbackPackage / readFeedbackPackage', () => {
  it('round-trips a package through disk unchanged', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'feedback.json');
    writeFeedbackPackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
    expect(readFeedbackPackage(filePath)).toEqual(pkg);
  });

  it('creates intermediate directories', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'nested', 'deep', 'feedback.json');
    writeFeedbackPackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
  });

  it('is idempotent: re-writing identical content does not change file bytes', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'feedback.json');
    writeFeedbackPackage(filePath, pkg);
    const first = readFileSync(filePath, 'utf8');
    writeFeedbackPackage(filePath, pkg);
    const second = readFileSync(filePath, 'utf8');
    expect(second).toBe(first);
  });

  it('readFeedbackPackage returns undefined for a missing file', () => {
    expect(readFeedbackPackage(join(dir, 'nope.json'))).toBeUndefined();
  });

  it('readFeedbackPackage returns undefined for malformed JSON', () => {
    const filePath = join(dir, 'bad.json');
    writeFileSync(filePath, 'not json{{{', 'utf8');
    expect(readFeedbackPackage(filePath)).toBeUndefined();
  });

  it('writes stable, sorted-key JSON with a trailing newline', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'feedback.json');
    writeFeedbackPackage(filePath, pkg);
    const raw = readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('P18 — falsification: writing/reading a FeedbackPackage never touches the real Overlay store', () => {
  it('a real Frozen entry, written via the real writeOverlay, is byte-identical before and after a FeedbackPackage is written elsewhere', () => {
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

    const feedbackPath = join(dir, 'feedback', 'feedback.json');
    writeFeedbackPackage(feedbackPath, samplePackage());

    const after = readFileSync(overlayPath, 'utf8');
    const afterEntries = readOverlay(overlayDir);
    expect(after).toBe(before);
    expect(afterEntries).toEqual(beforeEntries);
  });

  it('designer-feedback-io.ts imports nothing from overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-feedback/designer-feedback-io.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-feedback/designer-feedback-io.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
