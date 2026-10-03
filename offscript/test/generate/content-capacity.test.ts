/**
 * P24 — Content Contract v2 Foundation: Content Capacity (RED-first).
 *
 * Mirrors the W18/W20 loader+provider shape exactly (see semantic-author-context.test.ts). This
 * module is pure TRANSPORT for a P23-designed, OPTIONAL W17 body section — `## Content Capacity` —
 * declaring per-slot shape (a closed 9-value vocabulary) + bounds (required/optional, min-max).
 * Nothing here consumes the parsed model; these tests pin parser correctness, fail-loud validation,
 * digest/cache determinism, and provider isolation only.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSemanticBody } from '../../src/knowledge/semantic-body.js';
import {
  CONTENT_SHAPES,
  ContentCapacityError,
  parseContentCapacitySlots,
  extractContentCapacity,
  createContentCapacityProvider,
} from '../../src/generate/content-capacity.js';

function fullBody(contentCapacityLines?: string): string {
  return [
    '# demo',
    '',
    'lede.',
    '',
    '## Purpose',
    'Why it exists.',
    '',
    '## Choose when',
    'when X.',
    '',
    '## Avoid when',
    'when Y.',
    '',
    '## Character',
    '- minimal',
    '- decisive',
    '',
    '## Composition',
    'follows hero.',
    '',
    '## Contract',
    'assumes Z.',
    '',
    '## Judgement',
    'fails when W.',
    '',
    ...(contentCapacityLines ? ['## Content Capacity', '', contentCapacityLines, ''] : []),
  ].join('\n');
}

const VALID_SLOTS_MD = [
  '- headline: heading, required, 1',
  '- body-copy: paragraph, optional, 0-1',
  '- proof-items: stat, optional, 2-4',
  '- hero-image: image, required, 1',
  '- cta-label: cta-label, optional, 0-1',
].join('\n');

function writeComponent(root: string, slug: string, body: string): void {
  const dir = join(root, 'canonical', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'component.md'), `---\nkind: component\n---\n\n${body}`, 'utf8');
}

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), 'p24-'));
}

describe('P24 — the closed Content Shape vocabulary', () => {
  it('is exactly the nine P23 §5.2 values, in order', () => {
    expect([...CONTENT_SHAPES]).toEqual([
      'heading', 'paragraph', 'list-item', 'stat', 'quote', 'logo', 'image', 'cta-label', 'link',
    ]);
  });
});

describe('P24 — parseContentCapacitySlots', () => {
  it('parses the P23 §5.1 example into five typed slots', () => {
    const slots = parseContentCapacitySlots(VALID_SLOTS_MD, 'demo');
    expect(slots).toEqual([
      { name: 'headline', shape: 'heading', required: true, min: 1, max: 1 },
      { name: 'body-copy', shape: 'paragraph', required: false, min: 0, max: 1 },
      { name: 'proof-items', shape: 'stat', required: false, min: 2, max: 4 },
      { name: 'hero-image', shape: 'image', required: true, min: 1, max: 1 },
      { name: 'cta-label', shape: 'cta-label', required: false, min: 0, max: 1 },
    ]);
  });

  it('a bare count (no dash) means an exact min=max, matching the P23 example\'s "required, 1"', () => {
    const [slot] = parseContentCapacitySlots('- headline: heading, required, 1', 'demo');
    expect(slot.min).toBe(1);
    expect(slot.max).toBe(1);
  });

  it('preserves authored slot order', () => {
    const slots = parseContentCapacitySlots(VALID_SLOTS_MD, 'demo');
    expect(slots.map((s) => s.name)).toEqual(['headline', 'body-copy', 'proof-items', 'hero-image', 'cta-label']);
  });

  it('throws ContentCapacityError on an unknown shape', () => {
    expect(() => parseContentCapacitySlots('- headline: subtitle, required, 1', 'demo')).toThrow(ContentCapacityError);
    expect(() => parseContentCapacitySlots('- headline: subtitle, required, 1', 'demo')).toThrow(/unknown.*shape/i);
  });

  it('throws on a malformed line (missing bounds)', () => {
    expect(() => parseContentCapacitySlots('- headline: heading, required', 'demo')).toThrow(ContentCapacityError);
    expect(() => parseContentCapacitySlots('- headline: heading, required', 'demo')).toThrow(/malformed/i);
  });

  it('throws on a malformed line (not required|optional)', () => {
    expect(() => parseContentCapacitySlots('- headline: heading, mandatory, 1', 'demo')).toThrow(/malformed/i);
  });

  it('throws on a duplicate slot name', () => {
    const md = ['- headline: heading, required, 1', '- headline: paragraph, optional, 0-1'].join('\n');
    expect(() => parseContentCapacitySlots(md, 'demo')).toThrow(/duplicate/i);
  });

  it('throws when min > max', () => {
    expect(() => parseContentCapacitySlots('- headline: heading, required, 4-2', 'demo')).toThrow(/bounds|min.*max/i);
  });

  it('throws on an empty section (no slot lines at all)', () => {
    expect(() => parseContentCapacitySlots('', 'demo')).toThrow(ContentCapacityError);
  });

  it('is pure and deterministic — same markdown parses to structurally identical slots', () => {
    const a = parseContentCapacitySlots(VALID_SLOTS_MD, 'demo');
    const b = parseContentCapacitySlots(VALID_SLOTS_MD, 'demo');
    expect(a).toEqual(b);
  });
});

describe('P24 — extractContentCapacity (over an already-parsed W18 body)', () => {
  it('returns null when the body has no Content Capacity section — absence is a valid state', () => {
    const k = parseSemanticBody(fullBody(), 'demo');
    const cc = extractContentCapacity({ ...k, sourceFile: 'demo' });
    expect(cc).toBeNull();
  });

  it('returns the parsed model when the section is present', () => {
    const k = parseSemanticBody(fullBody(VALID_SLOTS_MD), 'demo');
    const cc = extractContentCapacity({ ...k, sourceFile: 'demo' });
    expect(cc).not.toBeNull();
    expect(cc!.slots.map((s) => s.name)).toEqual(['headline', 'body-copy', 'proof-items', 'hero-image', 'cta-label']);
  });

  it('digest participation: carries the SAME whole-body digest the W18 loader already computed (no second digest scheme)', () => {
    const k = parseSemanticBody(fullBody(VALID_SLOTS_MD), 'demo');
    const cc = extractContentCapacity({ ...k, sourceFile: 'demo' })!;
    expect(cc.digest).toBe(k.digest);
  });

  it('is deep-frozen', () => {
    const k = parseSemanticBody(fullBody(VALID_SLOTS_MD), 'demo');
    const cc = extractContentCapacity({ ...k, sourceFile: 'demo' })!;
    expect(Object.isFrozen(cc)).toBe(true);
    expect(Object.isFrozen(cc.slots)).toBe(true);
    expect(Object.isFrozen(cc.slots[0])).toBe(true);
  });
});

describe('P24 — provider over a repository root', () => {
  it('loads a component WITH Content Capacity, returns null for one WITHOUT, null for absent, fail-loud on malformed slots', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'with-capacity', fullBody(VALID_SLOTS_MD));
      writeComponent(root, 'without-capacity', fullBody());
      writeComponent(root, 'plain', '# plain\n\nA one-line descriptor.\n'); // no ## sections at all
      writeComponent(root, 'malformed-slots', fullBody('- headline: subtitle, required, 1'));
      const p = createContentCapacityProvider(root);

      expect(p.capacityFor('with-capacity')!.slots.map((s) => s.name)).toEqual([
        'headline', 'body-copy', 'proof-items', 'hero-image', 'cta-label',
      ]);
      expect(p.capacityFor('without-capacity')).toBeNull();
      expect(p.capacityFor('plain')).toBeNull();
      expect(p.capacityFor('absent')).toBeNull();
      expect(() => p.capacityFor('malformed-slots')).toThrow(/unknown.*shape/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('multiple components are transported independently', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'a', fullBody('- headline: heading, required, 1'));
      writeComponent(root, 'b', fullBody('- hero-image: image, required, 1'));
      const p = createContentCapacityProvider(root);
      expect(p.capacityFor('a')!.slots[0].name).toBe('headline');
      expect(p.capacityFor('b')!.slots[0].name).toBe('hero-image');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('digest replay: same slug returns the identical cached object', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'a', fullBody(VALID_SLOTS_MD));
      const p = createContentCapacityProvider(root);
      const first = p.capacityFor('a');
      const second = p.capacityFor('a');
      expect(first).toBe(second); // cache replay — identical object reference
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a real repository component with no authored Content Capacity yet returns null (today\'s entire corpus)', () => {
    const p = createContentCapacityProvider();
    expect(p.capacityFor('hero-bento')).toBeNull();
  });
});
