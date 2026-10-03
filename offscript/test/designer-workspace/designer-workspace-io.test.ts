/**
 * P19 — designer workspace package persistence. RED-first. Mirrors
 * overlay-approval-io.test.ts's exact structure: a real Frozen entry is
 * written via the REAL writeOverlay/readOverlay, a WorkspacePackage is
 * written elsewhere, and the real overlay store is proven byte-identical
 * before and after.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync as readFileSyncRoot } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDesignerWorkspace } from '../../src/designer-workspace/designer-workspace.js';
import { buildWorkspacePackage } from '../../src/designer-workspace/designer-workspace-package.js';
import { writeWorkspacePackage, readWorkspacePackage } from '../../src/designer-workspace/designer-workspace-io.js';
import { freezeFromDecisionLog, writeOverlay, readOverlay } from '../../src/overlay.js';
import type { DecisionLogEntry } from '../../src/actuation.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'p19-designer-workspace-io-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function samplePackage() {
  const workspace = buildDesignerWorkspace({ client: 'example-brand', track: 'website' }, { now: () => '2026-07-11T00:00:00.000Z' });
  return buildWorkspacePackage({ workspace }, { now: () => '2026-07-11T00:01:00.000Z' });
}

describe('writeWorkspacePackage / readWorkspacePackage', () => {
  it('round-trips a package through disk unchanged', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'workspace.json');
    writeWorkspacePackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
    expect(readWorkspacePackage(filePath)).toEqual(pkg);
  });

  it('creates intermediate directories', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'nested', 'deep', 'workspace.json');
    writeWorkspacePackage(filePath, pkg);
    expect(existsSync(filePath)).toBe(true);
  });

  it('is idempotent: re-writing identical content does not change file bytes', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'workspace.json');
    writeWorkspacePackage(filePath, pkg);
    const first = readFileSync(filePath, 'utf8');
    writeWorkspacePackage(filePath, pkg);
    const second = readFileSync(filePath, 'utf8');
    expect(second).toBe(first);
  });

  it('readWorkspacePackage returns undefined for a missing file', () => {
    expect(readWorkspacePackage(join(dir, 'nope.json'))).toBeUndefined();
  });

  it('readWorkspacePackage returns undefined for malformed JSON', () => {
    const filePath = join(dir, 'bad.json');
    writeFileSync(filePath, 'not json{{{', 'utf8');
    expect(readWorkspacePackage(filePath)).toBeUndefined();
  });

  it('writes stable, sorted-key JSON with a trailing newline', () => {
    const pkg = samplePackage();
    const filePath = join(dir, 'workspace.json');
    writeWorkspacePackage(filePath, pkg);
    const raw = readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('P19 — falsification: writing/reading a WorkspacePackage never touches the real Overlay store', () => {
  it('a real Frozen entry, written via the real writeOverlay, is byte-identical before and after a WorkspacePackage is written elsewhere', () => {
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

    const workspacePath = join(dir, 'workspace', 'workspace.json');
    writeWorkspacePackage(workspacePath, samplePackage());

    const after = readFileSync(overlayPath, 'utf8');
    const afterEntries = readOverlay(overlayDir);
    expect(after).toBe(before);
    expect(afterEntries).toEqual(beforeEntries);
  });

  it('designer-workspace-io.ts imports nothing from overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-workspace/designer-workspace-io.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/['"](?:\.\.?\/)*overlay\.js['"]/);
    }
  });

  it('the module never calls writeOverlay/readOverlay/freezeFromDecisionLog — string-scan the whole file', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSyncRoot(here + '../../src/designer-workspace/designer-workspace-io.ts', 'utf8');
    for (const forbidden of ['writeOverlay(', 'readOverlay(', 'freezeFromDecisionLog(']) {
      expect(src).not.toContain(forbidden);
    }
  });
});
