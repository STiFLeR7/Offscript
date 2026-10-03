/**
 * Sprint 7 — digest integrity enforcement at consumption time.
 *
 * Sprint 6 discovered a real, undocumented-until-then gap: `loadArtifactInventory` and
 * `selectArtifactForItem` never recomputed/verified `artifactDigest` against the artifact's
 * actual content. This suite proves the closed gap: an artifact is DISCOVERED (still present
 * in the inventory — never collapsed into "not found") but is REJECTED from selection whenever
 * its declared `artifactDigest` doesn't match its real content, or its content is unreadable.
 *
 * Deliberately verifies `intentDigest` is untouched by this check (Phase 3's required
 * distinction) — an artifact's own content integrity is independent of whether its paired
 * intent.json was edited afterward.
 */
import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlanItem } from '../src/generate/types.js';
import {
  loadArtifactInventory,
  selectArtifactForItem,
  assignCreativeArtifacts,
  verifyArtifactIntegrity,
} from '../src/generate/creative-artifact-consumption.js';

const here = dirname(fileURLToPath(import.meta.url));
const SPRINT7_DIR = join(here, 'fixtures', 'sprint7-digest-integrity');
const SPRINT6_NEG_DIR = join(here, 'fixtures', 'sprint6-negative-cases');

function minimalItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    anchor: { id: 'x', anchor: 'x' },
    archetype: 'feature' as PlanItem['archetype'],
    tokenRoles: [],
    intent: 'automation integrity trust boundary',
    ...overrides,
  } as PlanItem;
}

describe('1 — valid artifactDigest: artifact remains eligible', () => {
  it('is discovered with no integrity rejection and is selected', () => {
    const inventory = loadArtifactInventory(SPRINT7_DIR).filter((e) => e.artifact.id === 'sprint7-valid');
    expect(inventory).toHaveLength(1);
    expect(inventory[0].integrityInvalid).toBeUndefined();
    const selected = selectArtifactForItem(minimalItem(), inventory);
    expect(selected?.artifact.id).toBe('sprint7-valid');
  });
});

describe('2/3 — declared artifactDigest does not match real content: rejected', () => {
  it('digest-mismatch fixture is discovered but flagged integrity-invalid, and never selected', () => {
    const inventory = loadArtifactInventory(SPRINT6_NEG_DIR).filter((e) => e.artifact.id === 'digest-mismatch');
    expect(inventory).toHaveLength(1); // still DISCOVERED
    expect(inventory[0].integrityInvalid).toBe('digest-mismatch');
    const selected = selectArtifactForItem(minimalItem({ intent: 'automation gap' }), inventory);
    expect(selected).toBeUndefined();
  });
});

describe('4 — modified intent.json while artifactDigest remains valid', () => {
  it('the artifact stays integrity-valid and selectable — artifactDigest never covers intent content', () => {
    const inventory = loadArtifactInventory(SPRINT7_DIR).filter((e) => e.artifact.id === 'sprint7-intent-modified');
    expect(inventory).toHaveLength(1);
    expect(inventory[0].integrityInvalid).toBeUndefined();
    const selected = selectArtifactForItem(minimalItem({ intent: 'post-render edit automation' }), inventory);
    expect(selected?.artifact.id).toBe('sprint7-intent-modified');
  });
});

describe('5 — missing visual: rejected safely, never selected', () => {
  it('is discovered (well-formed record) but flagged integrity-invalid as missing content', () => {
    const inventory = loadArtifactInventory(SPRINT6_NEG_DIR).filter((e) => e.artifact.id === 'missing-visual');
    expect(inventory).toHaveLength(1);
    expect(inventory[0].integrityInvalid).toBe('missing-content');
    const selected = selectArtifactForItem(minimalItem({ intent: 'never select an unreadable visual automation' }), inventory);
    expect(selected).toBeUndefined();
  });
});

describe('6 — malformed artifact: rejected safely, no crash', () => {
  it('is skipped from the inventory entirely (missing required "approval" key — unchanged from Sprint 6)', () => {
    const inventory = loadArtifactInventory(SPRINT6_NEG_DIR);
    expect(inventory.find((e) => e.artifact.id === 'malformed-no-approval')).toBeUndefined();
  });
});

describe('7 — approved + relevant + valid digest: selected normally', () => {
  it('selects the artifact', () => {
    const inventory = loadArtifactInventory(SPRINT7_DIR).filter((e) => e.artifact.id === 'sprint7-valid');
    const selected = selectArtifactForItem(minimalItem({ intent: 'integrity trust boundary automation' }), inventory);
    expect(selected?.artifact.id).toBe('sprint7-valid');
  });
});

describe('8 — approved + relevant + invalid digest: never selected', () => {
  it('assignCreativeArtifacts leaves the item unset rather than attaching the invalid artifact', () => {
    const inventory = loadArtifactInventory(SPRINT6_NEG_DIR).filter((e) => e.artifact.id === 'digest-mismatch');
    const items = [minimalItem({ intent: 'automation gap' })];
    const result = assignCreativeArtifacts(items, inventory);
    expect(result[0].creativeArtifact).toBeUndefined();
  });
});

describe('9 — irrelevant + valid digest: still not selected', () => {
  it('a valid artifact with zero term overlap is not selected', () => {
    const inventory = loadArtifactInventory(SPRINT7_DIR).filter((e) => e.artifact.id === 'sprint7-valid');
    const item = minimalItem({ archetype: 'faq', intent: 'zzz totally unrelated qqq wibble' });
    expect(selectArtifactForItem(item, inventory)).toBeUndefined();
  });
});

describe('10 — pending/unapproved + valid digest: still not selected', () => {
  it('integrity-valid does not override the approval gate', () => {
    const inventory = loadArtifactInventory(SPRINT7_DIR).filter((e) => e.artifact.id === 'sprint7-pending');
    expect(inventory[0].integrityInvalid).toBeUndefined(); // digest itself is fine
    const selected = selectArtifactForItem(minimalItem({ intent: 'pending review automation' }), inventory);
    expect(selected).toBeUndefined(); // but approval status still gates it
  });
});

describe('11 — zero artifacts: existing behavior unchanged', () => {
  it('assignCreativeArtifacts against an empty inventory leaves every item unset', () => {
    const items = [minimalItem()];
    const result = assignCreativeArtifacts(items, []);
    expect(result[0].creativeArtifact).toBeUndefined();
  });
});

describe('12 — digest verification is deterministic', () => {
  it('verifyArtifactIntegrity returns the same result across repeated calls', () => {
    const inventory = loadArtifactInventory(SPRINT7_DIR).filter((e) => e.artifact.id === 'sprint7-valid');
    const artifact = inventory[0].artifact;
    expect(verifyArtifactIntegrity(artifact)).toBeUndefined();
    expect(verifyArtifactIntegrity(artifact)).toBeUndefined();
    expect(verifyArtifactIntegrity(artifact)).toBeUndefined();
  });

  it('and consistently returns the same rejection reason for a mismatched artifact', () => {
    const inventory = loadArtifactInventory(SPRINT6_NEG_DIR).filter((e) => e.artifact.id === 'digest-mismatch');
    const artifact = inventory[0].artifact;
    expect(verifyArtifactIntegrity(artifact)).toBe('digest-mismatch');
    expect(verifyArtifactIntegrity(artifact)).toBe('digest-mismatch');
  });
});
