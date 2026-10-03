/**
 * P47 — cross-page novelty persistence: the section-usage store (unit).
 *
 * A per-deliverable slug→use-count history persisted across generate.ts invocations.
 * Pure read/write/record — no hidden mutable state, no randomness. These tests prove the
 * persistence contract the findings' Candidate Remedy #1 requires: new clients start empty,
 * the store round-trips, updates are immutable, serialization is deterministic, an older
 * partial store migrates safely, and a corrupt store fails loud (never silent memory loss).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  EMPTY_SECTION_USAGE,
  readSectionUsage,
  writeSectionUsage,
  serializeSectionUsage,
  recordSectionUsage,
} from '../../src/generate/section-usage.js';

const DIR = join(tmpdir(), 'offscript-p47-section-usage-test');
const FILE = join(DIR, 'section-usage.json');

beforeEach(() => {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
});
afterEach(() => rmSync(DIR, { recursive: true, force: true }));

describe('P47 section-usage — persistence', () => {
  it('new client: an absent store reads as empty history', () => {
    expect(existsSync(FILE)).toBe(false);
    expect(readSectionUsage(FILE).size).toBe(0);
  });

  it('round-trips through disk (persists correctly)', () => {
    const h = recordSectionUsage(EMPTY_SECTION_USAGE, ['hero-bento', 'feature-trio', 'hero-bento']);
    writeSectionUsage(FILE, h);
    const back = readSectionUsage(FILE);
    expect(back.get('hero-bento')).toBe(2);
    expect(back.get('feature-trio')).toBe(1);
    expect(back.size).toBe(2);
  });

  it('recordSectionUsage is pure — the prior map is never mutated', () => {
    const prior = recordSectionUsage(EMPTY_SECTION_USAGE, ['a']);
    const next = recordSectionUsage(prior, ['a', 'b']);
    expect(prior.get('a')).toBe(1); // unchanged
    expect(prior.has('b')).toBe(false); // unchanged
    expect(next.get('a')).toBe(2);
    expect(next.get('b')).toBe(1);
  });

  it('deterministic serialization — same history ⇒ identical bytes, keys sorted', () => {
    const h1 = recordSectionUsage(EMPTY_SECTION_USAGE, ['zeta', 'alpha', 'alpha']);
    const h2 = recordSectionUsage(EMPTY_SECTION_USAGE, ['alpha', 'zeta', 'alpha']);
    expect(serializeSectionUsage(h1)).toBe(serializeSectionUsage(h2));
    const s = serializeSectionUsage(h1);
    expect(s.indexOf('alpha')).toBeLessThan(s.indexOf('zeta')); // sorted keys
  });

  it('migrates safely — an older partial store loads; unknown slugs default to 0', () => {
    writeFileSync(FILE, JSON.stringify({ 'hero-bento': 3 }), 'utf8');
    const h = readSectionUsage(FILE);
    expect(h.get('hero-bento')).toBe(3);
    expect(h.get('never-seen') ?? 0).toBe(0);
  });

  it('fails loud on a corrupt store (not silent memory loss)', () => {
    writeFileSync(FILE, '{ this is not json', 'utf8');
    expect(() => readSectionUsage(FILE)).toThrow();
  });

  it('fails loud on a non-integer / negative count (drift detection)', () => {
    writeFileSync(FILE, JSON.stringify({ 'hero-bento': -1 }), 'utf8');
    expect(() => readSectionUsage(FILE)).toThrow();
  });
});
