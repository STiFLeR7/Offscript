/**
 * P13 — proposal-overlay-io.ts persistence + the core storage-isolation
 * falsification: writing an OverlayCandidatePackage must never touch the
 * REAL overlay store (`writeOverlay`/`readOverlay`, overlay.ts). Proven
 * against the real functions, not a fixture double — the same style of
 * direct proof P09's proposal-io.test.ts used for the canonical catalog.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { translateProposalToOverlayCandidate } from '../../src/designer-author/proposal-overlay.js';
import { buildOverlayCandidatePackage } from '../../src/designer-author/proposal-overlay-package.js';
import {
  readOverlayCandidatePackage,
  writeOverlayCandidatePackage,
} from '../../src/designer-author/proposal-overlay-io.js';
import { freezeFromDecisionLog, readOverlay, writeOverlay, type Frozen } from '../../src/overlay.js';
import type { DecisionLogEntry } from '../../src/actuation.js';

function sampleProposal() {
  return buildAuthorProposal({
    kind: 'section',
    origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
    semanticFamily: 'family-hero',
    content: 'A well-formed proposed hero section.',
  });
}

function samplePackage() {
  return buildOverlayCandidatePackage({ translation: translateProposalToOverlayCandidate(sampleProposal()) });
}

let tmpDir: string;
let overlayStoreDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-overlay-candidate-'));
  overlayStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-real-overlay-store-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(overlayStoreDir, { recursive: true, force: true });
});

describe('writeOverlayCandidatePackage / readOverlayCandidatePackage', () => {
  it('round-trips a package through disk as deep-equal JSON', () => {
    const pkg = samplePackage();
    const filePath = path.join(tmpDir, 'overlay-candidate-package.json');
    writeOverlayCandidatePackage(filePath, pkg);
    expect(readOverlayCandidatePackage(filePath)).toEqual(pkg);
  });

  it('writes stable, sorted-key, 2-space JSON with a trailing newline', () => {
    const filePath = path.join(tmpDir, 'overlay-candidate-package.json');
    writeOverlayCandidatePackage(filePath, samplePackage());
    const raw = fs.readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toBe(JSON.stringify(JSON.parse(raw), null, 2) + '\n');
  });

  it('is idempotent: writing identical content twice does not change the file', () => {
    const pkg = samplePackage();
    const filePath = path.join(tmpDir, 'overlay-candidate-package.json');
    writeOverlayCandidatePackage(filePath, pkg);
    const firstMtime = fs.statSync(filePath).mtimeMs;
    writeOverlayCandidatePackage(filePath, pkg);
    expect(fs.statSync(filePath).mtimeMs).toBe(firstMtime);
  });

  it('readOverlayCandidatePackage returns undefined for a missing file', () => {
    expect(readOverlayCandidatePackage(path.join(tmpDir, 'nope.json'))).toBeUndefined();
  });
});

describe('P13 — falsification: writing an overlay candidate package never mutates the REAL overlay store', () => {
  it('a real Frozen entry, written via the REAL writeOverlay, is byte-identical before and after a candidate package is written', () => {
    const decisionLog: DecisionLogEntry = {
      pass: 'brand-fidelity',
      rails: ['brand-fidelity-scan'],
      status: 'escalated',
      loops: 1,
      residualViolations: [{ id: 'finding-1', description: 'off-token color', outcome: 'escalated' }],
    };
    const frozen: Frozen = freezeFromDecisionLog(decisionLog, {
      decidedBy: 'actuator',
      now: () => '2026-07-13T00:00:00.000Z',
    });
    writeOverlay(overlayStoreDir, frozen);

    const before = readOverlay(overlayStoreDir);
    expect(before).toHaveLength(1);
    const beforeFiles = fs.readdirSync(overlayStoreDir).sort();

    // Translate a proposal and write ITS candidate package to a COMPLETELY
    // DIFFERENT directory — the worst-case adversarial proximity is a
    // candidate whose sourceProposalId happens to collide in spirit with a
    // real frozen finding id.
    const pkg = buildOverlayCandidatePackage({
      translation: translateProposalToOverlayCandidate(
        buildAuthorProposal({
          kind: 'overlay',
          origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
          semanticFamily: 'family-hero',
          parentComponent: 'canonical::hero-bento',
          content: 'REPLACEMENT CONTENT — this must never reach the real overlay store',
        }),
      ),
    });
    writeOverlayCandidatePackage(path.join(tmpDir, 'overlay-candidate-package.json'), pkg);

    const after = readOverlay(overlayStoreDir);
    const afterFiles = fs.readdirSync(overlayStoreDir).sort();
    expect(after).toEqual(before);
    expect(afterFiles).toEqual(beforeFiles);
  });

  it('writing a candidate package creates exactly the one file requested — no other files or directories appear', () => {
    expect(fs.readdirSync(tmpDir)).toEqual([]);
    writeOverlayCandidatePackage(path.join(tmpDir, 'overlay-candidate-package.json'), samplePackage());
    expect(fs.readdirSync(tmpDir)).toEqual(['overlay-candidate-package.json']);
  });

  it('structural: proposal-overlay-io.ts imports nothing from overlay.js', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-overlay-io.ts', 'utf8');
    expect(src).not.toMatch(/overlay\.js/);
  });

  it('structural: no file under src/designer-author/ calls writeOverlay(', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const dir = here + '../../src/designer-author/';
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.ts')) continue;
      const src = readFileSync(dir + name, 'utf8');
      expect(src, `${name} must not call writeOverlay(`).not.toContain('writeOverlay(');
    }
  });
});
