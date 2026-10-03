import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { freezeEscalatedFindings } from '../src/freeze-wiring.js';
import { readOverlay } from '../src/overlay.js';
import type { Operator, Finding } from '../src/operator.js';

function stubOp(name: string): Operator {
  return {
    name,
    tier: 2,
    detect: () => [],
    apply: () => [],
  };
}

function finding(id: string, outcome: Finding['outcome']): Finding {
  return { id, description: `desc ${id}`, outcome };
}

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-freeze-wiring-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('freezeEscalatedFindings', () => {
  it('writes one overlay per rail that has escalated findings; ignores warnings and clear rails', () => {
    const overlayDir = path.join(tmp, 'overlay');
    const perRail = [
      {
        operator: stubOp('layout-alignment'),
        findings: [
          finding('layout-alignment:misaligned:section:4', 'escalated'),
          finding('layout-alignment:misaligned:section:5', 'escalated'),
        ],
      },
      {
        operator: stubOp('responsive-need'),
        findings: [finding('responsive-need:viewport-meta', 'warning')],
      },
      {
        operator: stubOp('contrast'),
        findings: [],
      },
    ];

    const wrote = freezeEscalatedFindings({
      overlayDir,
      perRail,
      decidedBy: 'offscript-harden:v1',
    });

    expect(wrote).toHaveLength(1);
    expect(wrote[0].frozenId).toMatch(/^layout-alignment:/);
    expect(wrote[0].findingIds).toEqual([
      'layout-alignment:misaligned:section:4',
      'layout-alignment:misaligned:section:5',
    ]);
    expect(fs.existsSync(wrote[0].overlayPath)).toBe(true);

    const stored = readOverlay(overlayDir);
    expect(stored).toHaveLength(1);
    expect(stored[0].pass).toBe('layout-alignment');
    expect(stored[0].findingIds).toEqual([
      'layout-alignment:misaligned:section:4',
      'layout-alignment:misaligned:section:5',
    ]);
    expect(stored[0].decidedBy).toBe('offscript-harden:v1');
  });

  it('writes a snapshot HTML next to the JSON when snapshotHtml is provided', () => {
    const overlayDir = path.join(tmp, 'overlay');
    const wrote = freezeEscalatedFindings({
      overlayDir,
      perRail: [
        {
          operator: stubOp('layout-alignment'),
          findings: [finding('layout-alignment:misaligned:x:0', 'escalated')],
        },
      ],
      decidedBy: 'offscript-harden:v1',
      snapshotHtml: '<html><body>snap</body></html>',
    });
    const htmlPath = wrote[0].overlayPath.replace(/\.json$/, '.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe('<html><body>snap</body></html>');
  });

  it('returns empty array and writes nothing when there are no escalated findings', () => {
    const overlayDir = path.join(tmp, 'overlay');
    const wrote = freezeEscalatedFindings({
      overlayDir,
      perRail: [
        {
          operator: stubOp('responsive-need'),
          findings: [finding('responsive-need:viewport-meta', 'warning')],
        },
        {
          operator: stubOp('contrast'),
          findings: [],
        },
      ],
      decidedBy: 'offscript-harden:v1',
    });
    expect(wrote).toEqual([]);
    // overlayDir is only created when something is written.
    expect(fs.existsSync(overlayDir)).toBe(false);
  });

  it('is idempotent on the filesystem when called with the SAME Frozen content (no mtime bump)', () => {
    // To exercise writeOverlay's content-compare idempotency we must reuse the
    // EXACT same Frozen object — freezeEscalatedFindings stamps a fresh
    // decidedAt every call, so we round-trip the written entry through
    // writeOverlay directly.
    const overlayDir = path.join(tmp, 'overlay');
    const perRail = [
      {
        operator: stubOp('layout-alignment'),
        findings: [finding('layout-alignment:misaligned:x:0', 'escalated')],
      },
    ];
    const wrote1 = freezeEscalatedFindings({
      overlayDir,
      perRail,
      decidedBy: 'offscript-harden:v1',
    });
    const mtime1 = fs.statSync(wrote1[0].overlayPath).mtimeMs;

    // Re-importing overlay helpers and re-writing the *same* Frozen object —
    // overlay.ts's writeIfChanged should leave the file alone.
    const stored = readOverlay(overlayDir);
    expect(stored).toHaveLength(1);
    // Sleep is unreliable in tests; instead, manually re-write via writeOverlay
    // (overlay.ts) and assert mtime unchanged.
    // We use require-style dynamic import to keep this scoped to the idempotency check.
    return import('../src/overlay.js').then(({ writeOverlay }) => {
      writeOverlay(overlayDir, stored[0]);
      const mtime2 = fs.statSync(wrote1[0].overlayPath).mtimeMs;
      expect(mtime2).toBe(mtime1);
    });
  });
});
