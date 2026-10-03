/**
 * Sprint W18 — Semantic Body Loader (RED-first).
 *
 * The loader makes the W17 semantic component bodies machine-readable WITHOUT any consumer.
 * These tests pin the parser contract: faithful preservation, fail-loud validation, deterministic
 * digest, deterministic cache, deep immutability. Nothing here consumes the body for reasoning.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
  PARSER_VERSION,
  REQUIRED_SECTIONS,
  OPTIONAL_SECTIONS,
  SemanticBodyError,
  bodyDigest,
  parseSemanticBody,
  parseSemanticBodyCached,
  clearSemanticCache,
  loadSemanticKnowledge,
} from '../../src/knowledge/semantic-body.js';

// A minimal, valid W17-template body (all seven sections, canonical order).
const VALID_BODY = [
  '# demo-component',
  '',
  'A one-line descriptor lede.',
  '',
  '## Purpose',
  '',
  'Why it exists and the problem it solves.',
  '',
  '## Choose when',
  '',
  '- a positive selection signal',
  '- another situation',
  '',
  '## Avoid when',
  '',
  'When it is the wrong choice; reach for something quieter.',
  '',
  '## Character',
  '',
  'Minimal and decisive; *read*, not operated.',
  '',
  '## Composition',
  '',
  'Follows the proof beat; hands off to the footer.',
  '',
  '## Contract',
  '',
  'Assumes the page earned the ask; expects one clear action.',
  '',
  '## Judgement',
  '',
  'Correct, incorrect, and failure modes described here.',
  '',
].join('\n');

function bodyWithSections(headings: string[]): string {
  const out = ['# x', '', 'lede', ''];
  for (const h of headings) {
    out.push(`## ${h}`, '', `content for ${h}`, '');
  }
  return out.join('\n');
}

const ALL = [...REQUIRED_SECTIONS];

beforeEach(() => clearSemanticCache());

describe('W18 semantic-body — valid body', () => {
  it('parses all seven sections and reports valid', () => {
    const k = parseSemanticBody(VALID_BODY, 'demo');
    expect(k.validationState).toBe('valid');
    expect(k.sections.map((s) => s.name)).toEqual([...REQUIRED_SECTIONS]);
    expect(k.title).toBe('demo-component');
    expect(k.lede).toBe('A one-line descriptor lede.');
    expect(k.digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W18 semantic-body — fail loud', () => {
  it('throws on an unknown section', () => {
    const body = bodyWithSections([...ALL, 'Bananas']);
    expect(() => parseSemanticBody(body, 'demo')).toThrow(SemanticBodyError);
    expect(() => parseSemanticBody(body, 'demo')).toThrow(/unknown section/i);
  });

  it('throws on a duplicate section', () => {
    const body = bodyWithSections([...ALL, 'Purpose']);
    expect(() => parseSemanticBody(body, 'demo')).toThrow(/duplicate section/i);
  });

  it('throws on a missing required section', () => {
    const body = bodyWithSections(ALL.filter((s) => s !== 'Contract'));
    expect(() => parseSemanticBody(body, 'demo')).toThrow(/missing/i);
    expect(() => parseSemanticBody(body, 'demo')).toThrow(/Contract/);
  });

  it('throws on an empty body', () => {
    expect(() => parseSemanticBody('   \n\n  ', 'demo')).toThrow(/empty body/i);
  });
});

describe('W18 semantic-body — faithful preservation', () => {
  it('preserves authored section ordering (does not canonicalize)', () => {
    // a complete but non-canonical order — valid, and the order must be kept verbatim
    const shuffled = ['Judgement', 'Purpose', 'Contract', 'Character', 'Choose when', 'Composition', 'Avoid when'];
    const k = parseSemanticBody(bodyWithSections(shuffled), 'demo');
    expect(k.sections.map((s) => s.name)).toEqual(shuffled);
  });

  it('preserves the section markdown verbatim (no summarize / normalize)', () => {
    const k = parseSemanticBody(VALID_BODY, 'demo');
    const chooseWhen = k.sections.find((s) => s.name === 'Choose when')!;
    expect(chooseWhen.markdown).toBe('- a positive selection signal\n- another situation');
    const character = k.sections.find((s) => s.name === 'Character')!;
    expect(character.markdown).toBe('Minimal and decisive; *read*, not operated.');
  });
});

describe('W18 semantic-body — determinism + cache', () => {
  it('digest depends only on body + parser version', () => {
    const d1 = bodyDigest(VALID_BODY);
    const d2 = bodyDigest(VALID_BODY);
    expect(d1).toBe(d2);
    expect(bodyDigest(VALID_BODY + '\n')).not.toBe(d1); // different content → different digest
    expect(d1.startsWith('')).toBe(true);
    expect(PARSER_VERSION).toMatch(/.+/);
  });

  it('CRLF and LF bodies produce the same digest (line-ending canonicalization only)', () => {
    expect(bodyDigest(VALID_BODY.replace(/\n/g, '\r\n'))).toBe(bodyDigest(VALID_BODY));
  });

  it('cache replay returns the identical frozen object', () => {
    const a = parseSemanticBodyCached(VALID_BODY);
    const b = parseSemanticBodyCached(VALID_BODY);
    expect(a).toBe(b); // same reference — served from cache
    clearSemanticCache();
    const c = parseSemanticBodyCached(VALID_BODY);
    expect(c).not.toBe(a); // fresh after clear
    expect(c.digest).toBe(a.digest); // but identical identity
  });

  it('parser is deterministic (equal structure for equal input)', () => {
    const a = parseSemanticBody(VALID_BODY, 'demo');
    const b = parseSemanticBody(VALID_BODY, 'demo');
    expect(a.digest).toBe(b.digest);
    expect(JSON.stringify(a.sections)).toBe(JSON.stringify(b.sections));
  });
});

describe('W18 semantic-body — immutability', () => {
  it('returns a deeply frozen object', () => {
    const k = parseSemanticBody(VALID_BODY, 'demo');
    expect(Object.isFrozen(k)).toBe(true);
    expect(Object.isFrozen(k.sections)).toBe(true);
    expect(Object.isFrozen(k.sections[0])).toBe(true);
    expect(() => {
      // @ts-expect-error — frozen
      k.sections[0].name = 'mutated';
    }).toThrow();
  });
});

describe('W18 semantic-body — loader over a real W17 file', () => {
  it('loads hero-bento and exposes its seven sections + source', () => {
    const root = fileURLToPath(new URL('../../repository', import.meta.url));
    const file = fileURLToPath(new URL('../../repository/canonical/hero-bento/component.md', import.meta.url));
    const k = loadSemanticKnowledge(file, root);
    expect(k.validationState).toBe('valid');
    expect(k.sections.map((s) => s.name)).toEqual([...REQUIRED_SECTIONS]);
    expect(k.sourceFile).toBe('canonical/hero-bento/component.md');
    expect(k.sections.find((s) => s.name === 'Purpose')!.markdown.length).toBeGreaterThan(0);
  });
});

describe('P24 — Content Capacity as an OPTIONAL section (widens the recognized vocabulary)', () => {
  it('OPTIONAL_SECTIONS declares exactly "Content Capacity"', () => {
    expect([...OPTIONAL_SECTIONS]).toEqual(['Content Capacity']);
  });

  it('a body with the seven required sections PLUS Content Capacity parses successfully', () => {
    const body = bodyWithSections([...ALL, 'Content Capacity']);
    const k = parseSemanticBody(body, 'demo');
    expect(k.validationState).toBe('valid');
    expect(k.sections.map((s) => s.name)).toEqual([...ALL, 'Content Capacity']);
  });

  it('Content Capacity may appear anywhere in authored order (not just last)', () => {
    const body = bodyWithSections(['Content Capacity', ...ALL]);
    const k = parseSemanticBody(body, 'demo');
    expect(k.sections.map((s) => s.name)).toEqual(['Content Capacity', ...ALL]);
  });

  it('a body WITHOUT Content Capacity is still perfectly valid — purely additive, no existing body needs to change', () => {
    const k = parseSemanticBody(VALID_BODY, 'demo');
    expect(k.validationState).toBe('valid');
    expect(k.sections.find((s) => s.name === 'Content Capacity')).toBeUndefined();
  });

  it('an unrecognized section (still not Content Capacity) still throws — widening is closed, not open', () => {
    const body = bodyWithSections([...ALL, 'Bananas']);
    expect(() => parseSemanticBody(body, 'demo')).toThrow(/unknown section/i);
  });

  it('Content Capacity is never required — omitting it never triggers the missing-section error', () => {
    const k = parseSemanticBody(VALID_BODY, 'demo');
    expect(k.validationState).toBe('valid'); // ALL 7 required present, Content Capacity absent ⇒ still valid
  });

  it('duplicate Content Capacity still throws (optional sections obey the same duplicate rule)', () => {
    const body = bodyWithSections([...ALL, 'Content Capacity', 'Content Capacity']);
    expect(() => parseSemanticBody(body, 'demo')).toThrow(/duplicate section/i);
  });

  it('PARSER_VERSION was bumped — the parsing contract genuinely changed', () => {
    expect(PARSER_VERSION).toBe('w18-semantic-body@2');
  });

  it('digest is still content-addressed and CRLF-canonicalized for a body carrying Content Capacity', () => {
    const body = bodyWithSections([...ALL, 'Content Capacity']);
    const d1 = bodyDigest(body);
    const d2 = bodyDigest(body.replace(/\n/g, '\r\n'));
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[0-9a-f]{64}$/);
  });
});
