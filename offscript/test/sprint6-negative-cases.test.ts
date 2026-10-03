/**
 * Sprint 6 Phase 10 — the four negative cases not already covered by Sprint 5's suite
 * (malformed artifact, missing visual, digest mismatch, duplicate artifact intent).
 * The system must fail safely (skip / not-select), never crash — and where a real gap
 * exists (digest mismatch is currently unenforced at consumption time), the test proves
 * and documents that gap rather than silently assuming protection that doesn't exist.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../src/paths.js';
import {
  loadArtifactInventory,
  extractArtifactVisual,
  selectArtifactForItem,
} from '../src/generate/creative-artifact-consumption.js';
import type { PlanItem } from '../src/generate/types.js';

const FIXTURES_DIR = join(repoRoot, 'test', 'fixtures', 'sprint6-negative-cases');

function minimalItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    anchor: { id: 'x', anchor: 'x' },
    archetype: 'faq' as PlanItem['archetype'],
    tokenRoles: [],
    intent: 'automation workflow',
    ...overrides,
  } as PlanItem;
}

describe('negative case 5 — malformed artifact (missing required "approval" key)', () => {
  it('is silently skipped from the inventory, not crashed on', () => {
    const inventory = loadArtifactInventory(FIXTURES_DIR);
    expect(inventory.find((e) => e.artifact.id === 'malformed-no-approval')).toBeUndefined();
  });
});

describe('negative case 6 — approved artifact whose visual file does not exist', () => {
  it('is discovered (structurally well-formed) but extraction returns undefined', () => {
    const inventory = loadArtifactInventory(FIXTURES_DIR);
    const entry = inventory.find((e) => e.artifact.id === 'missing-visual');
    expect(entry).toBeDefined();
    expect(extractArtifactVisual(entry!)).toBeUndefined();
  });

  it('Sprint 7 — is flagged integrity-invalid (missing-content) and selectArtifactForItem never returns it', () => {
    const inventory = loadArtifactInventory(FIXTURES_DIR).filter((e) => e.artifact.id === 'missing-visual');
    expect(inventory[0].integrityInvalid).toBe('missing-content');
    const item = minimalItem({ intent: 'never select an unreadable visual automation' });
    expect(selectArtifactForItem(item, inventory)).toBeUndefined();
  });
});

describe('negative case 7 — declared artifactDigest does not match the visual file\'s real content', () => {
  it('Sprint 7 — is flagged integrity-invalid (digest-mismatch) and rejected from selection, even though extraction alone would still succeed', () => {
    const inventory = loadArtifactInventory(FIXTURES_DIR);
    const entry = inventory.find((e) => e.artifact.id === 'digest-mismatch');
    expect(entry).toBeDefined();

    const realContent = readFileSync(join(FIXTURES_DIR, 'digest-mismatch', 'visual.html'), 'utf8');
    const realDigest = `sha256:${createHash('sha256').update(realContent).digest('hex')}`;
    expect(entry!.artifact.artifactDigest).not.toBe(realDigest); // the fixture is deliberately wrong
    expect(entry!.integrityInvalid).toBe('digest-mismatch');

    const item = minimalItem({ intent: 'automation gap' });
    const selected = selectArtifactForItem(item, [entry!]);
    expect(selected).toBeUndefined(); // rejected at selection — never reaches authoring
    expect(extractArtifactVisual(entry!)).toBeDefined(); // extraction alone still succeeds; selection is the enforcement point
  });
});

describe('negative case 9 — two artifacts sharing the same intentDigest (multiple renders of one intent)', () => {
  it('both are discovered as independent inventory entries; no crash, no dedup, no special-casing', () => {
    const inventory = loadArtifactInventory(FIXTURES_DIR).filter((e) => e.intent.id === 'shared-intent');
    expect(inventory.map((e) => e.artifact.id).sort()).toEqual(['shared-intent-variant-a', 'shared-intent-variant-b']);
    expect(inventory[0].artifact.intentDigest).toBe(inventory[1].artifact.intentDigest);
  });

  it('selection picks one deterministically (first-scored-highest wins) without erroring on the duplicate', () => {
    const inventory = loadArtifactInventory(FIXTURES_DIR).filter((e) => e.intent.id === 'shared-intent');
    const item = minimalItem({ intent: 'automation workflow variant' });
    const selected = selectArtifactForItem(item, inventory);
    expect(['shared-intent-variant-a', 'shared-intent-variant-b']).toContain(selected?.artifact.id);
  });
});
