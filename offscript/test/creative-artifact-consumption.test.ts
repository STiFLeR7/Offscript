import { describe, it, expect, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { PlanItem } from '../src/generate/types.js';
import {
  loadArtifactInventory,
  extractArtifactVisual,
  extractVisualFromLocation,
  selectArtifactForItem,
  assignCreativeArtifacts,
} from '../src/generate/creative-artifact-consumption.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(here, 'fixtures', 'creative-assets-sample');

function minimalItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    anchor: { id: 'test-section', tag: 'section' } as PlanItem['anchor'],
    archetype: 'hero',
    tokenRoles: [],
    intent: 'a generic section',
    ...overrides,
  } as PlanItem;
}

describe('loadArtifactInventory', () => {
  it('loads every well-formed artifact/intent pair from the directory', () => {
    const inventory = loadArtifactInventory(FIXTURE_DIR);
    expect(inventory.length).toBe(3);
    const ids = inventory.map((e) => e.artifact.id).sort();
    expect(ids).toEqual([
      'approval-chain-status-desktop',
      'exception-triage-queue-desktop',
      'throughput-recovery-summary-desktop',
    ]);
  });

  it('returns an empty array for a directory that does not exist', () => {
    expect(loadArtifactInventory(join(here, 'fixtures', 'does-not-exist'))).toEqual([]);
  });

  it('preserves the paired intent fields verbatim', () => {
    const inventory = loadArtifactInventory(FIXTURE_DIR);
    const entry = inventory.find((e) => e.artifact.id === 'exception-triage-queue-desktop');
    expect(entry?.intent.feature).toBe('ai-intelligence');
    expect(entry?.intent.section).toBe('hero');
  });
});

describe('extractArtifactVisual', () => {
  it('extracts an <img src="data:..."> from an artifact HTML file', () => {
    const inventory = loadArtifactInventory(FIXTURE_DIR);
    const entry = inventory.find((e) => e.artifact.id === 'exception-triage-queue-desktop')!;
    const visual = extractArtifactVisual(entry);
    expect(visual).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('extracts a background-image: url(data:...) when no <img> is present', () => {
    const inventory = loadArtifactInventory(FIXTURE_DIR);
    const entry = inventory.find((e) => e.artifact.id === 'approval-chain-status-desktop')!;
    const visual = extractArtifactVisual(entry);
    expect(visual).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('returns undefined, never throws, when the artifact file does not resolve', () => {
    const inventory = loadArtifactInventory(FIXTURE_DIR);
    const entry = { ...inventory[0], artifact: { ...inventory[0].artifact, location: 'nowhere/missing.html' } };
    expect(() => extractArtifactVisual(entry)).not.toThrow();
    expect(extractArtifactVisual(entry)).toBeUndefined();
  });
});

// ── extractVisualFromLocation — real regression: the Creative Authoring layer's own
// embedBrandFont() (a real, legitimate, unrelated fix from an earlier sprint) unconditionally
// prepends a <style>@font-face{src:url(data:font/ttf;base64,...)} block to every authored
// creative's <head>. A CreativeArtifact whose own visual is embedded via CSS background-image
// (no <img> tag) has its FONT's url(data:...) appear earlier in the document than its real
// photo's url(data:...) — the website-embedding sprint's real CLI run against the real,
// geometry-fixed v5 APA artifact caught this extracting `data:font/ttf;base64,...` as the
// "visual" instead of the real environment photo. ────────────────────────────────────────────
describe('extractVisualFromLocation — real artifact regression: font url() must never win over the real visual', () => {
  let tempDir: string | undefined;
  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('extracts the real background-image photo, never an earlier @font-face url(data:font/...) in the same document', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'creative-artifact-consumption-'));
    const htmlPath = join(tempDir, 'visual.html');
    writeFileSync(
      htmlPath,
      '<!doctype html><html><head>' +
        '<style>@font-face{font-family:"Instrument Sans";src:url(data:font/ttf;base64,AAAAFONTBYTES) format("truetype");}</style>' +
        '</head><body>' +
        '<div id="cr-artifact-visual">' +
        '<div data-environment-slot="dawn-haze" style="background-image:url(data:image/jpeg;base64,AAAAREALPHOTOBYTES);background-size:cover"></div>' +
        '</div></body></html>',
      'utf8',
    );
    const visual = extractVisualFromLocation(htmlPath);
    expect(visual).toBe('data:image/jpeg;base64,AAAAREALPHOTOBYTES');
  });

  it('still extracts an <img src="data:image/..."> when one is present (unchanged behavior)', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'creative-artifact-consumption-'));
    const htmlPath = join(tempDir, 'visual.html');
    writeFileSync(
      htmlPath,
      '<!doctype html><html><body><img id="cr-artifact-visual" src="data:image/svg+xml;base64,AAAA"></body></html>',
      'utf8',
    );
    expect(extractVisualFromLocation(htmlPath)).toBe('data:image/svg+xml;base64,AAAA');
  });
});

describe('selectArtifactForItem — no hardcoded ids or section names', () => {
  const inventory = loadArtifactInventory(FIXTURE_DIR);

  it('selects the artifact whose intent terms best overlap the item intent, by lexical scoring only', () => {
    const item = minimalItem({
      intent: 'Show the exception queue with urgency ranking and escalation',
      archetype: 'hero',
    });
    const selected = selectArtifactForItem(item, inventory);
    expect(selected?.artifact.id).toBe('exception-triage-queue-desktop');
  });

  it('selects a different artifact for a differently-worded item, from the same generic function', () => {
    const item = minimalItem({
      intent: 'Explain the approval chain and workflow status',
      archetype: 'feature',
    });
    const selected = selectArtifactForItem(item, inventory);
    expect(selected?.artifact.id).toBe('approval-chain-status-desktop');
  });

  it('excludes unapproved artifacts from selection entirely', () => {
    const item = minimalItem({ intent: 'Show throughput recovery and trend' });
    const selected = selectArtifactForItem(item, inventory);
    // throughput-recovery-summary is the best lexical match but is NOT approved — must not be selected.
    expect(selected?.artifact.id).not.toBe('throughput-recovery-summary-desktop');
  });

  it('returns undefined when no candidate has any term overlap (legitimately irrelevant)', () => {
    // archetype deliberately not 'hero'/'feature'/'cta' — those coincide with fixture `section`
    // values and would otherwise pollute this specific no-overlap case via the archetype term.
    const item = minimalItem({ archetype: 'faq', intent: 'zzz completely unrelated content qqq wibble' });
    expect(selectArtifactForItem(item, inventory)).toBeUndefined();
  });

  it('the selection function contains no reference to a specific artifact id or section name', () => {
    const fnSource = selectArtifactForItem.toString();
    expect(fnSource).not.toMatch(/exception-triage-queue|approval-chain-status|throughput-recovery/);
    expect(fnSource).not.toMatch(/["'`]hero["'`]|["'`]feature["'`]|["'`]cta["'`]/);
  });
});

describe('assignCreativeArtifacts — pure, immutable, no mutation of the artifact', () => {
  const inventory = loadArtifactInventory(FIXTURE_DIR);

  it('attaches a creativeArtifact reference to a matching item without mutating the input', () => {
    const items = [
      minimalItem({ intent: 'Show the exception queue with urgency ranking and escalation' }),
    ];
    const result = assignCreativeArtifacts(items, inventory);
    expect(result).not.toBe(items);
    expect(items[0].creativeArtifact).toBeUndefined(); // original untouched
    expect(result[0].creativeArtifact?.id).toBe('exception-triage-queue-desktop');
  });

  it('the attached reference copies identity fields verbatim (id/intentDigest/artifactDigest/location)', () => {
    const items = [minimalItem({ intent: 'exception queue urgency ranking escalation' })];
    const result = assignCreativeArtifacts(items, inventory);
    const ref = result[0].creativeArtifact!;
    const source = inventory.find((e) => e.artifact.id === ref.id)!;
    expect(ref.intentDigest).toBe(source.artifact.intentDigest);
    expect(ref.artifactDigest).toBe(source.artifact.artifactDigest);
    expect(ref.location).toBe(source.artifact.location);
  });

  it('leaves items with no relevant artifact unset (undefined, not a forced fallback)', () => {
    const items = [minimalItem({ archetype: 'faq', intent: 'zzz unrelated qqq wibble' })];
    const result = assignCreativeArtifacts(items, inventory);
    expect(result[0].creativeArtifact).toBeUndefined();
  });

  it('does not assign the same artifact to two different items in one call', () => {
    const items = [
      minimalItem({ anchor: { id: 'a', tag: 'section' } as PlanItem['anchor'], intent: 'exception queue urgency ranking' }),
      minimalItem({ anchor: { id: 'b', tag: 'section' } as PlanItem['anchor'], intent: 'exception queue urgency ranking' }),
    ];
    const result = assignCreativeArtifacts(items, inventory);
    const assignedIds = result.map((i) => i.creativeArtifact?.id).filter(Boolean);
    expect(new Set(assignedIds).size).toBe(assignedIds.length);
  });

  it('with an empty inventory, no item gets a creativeArtifact (existing behavior unchanged)', () => {
    const items = [minimalItem({ intent: 'exception queue urgency ranking' })];
    const result = assignCreativeArtifacts(items, []);
    expect(result[0].creativeArtifact).toBeUndefined();
  });
});
