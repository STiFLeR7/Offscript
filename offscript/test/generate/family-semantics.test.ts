/**
 * Sprint W23 — Component Family Semantic Intelligence (RED-first).
 *
 * A typed, immutable, deterministically-cached loader for COMPONENT FAMILY knowledge — the abstract
 * role layer (Hero, FAQ, Footer, …), distinct from the per-component W17/W18 body. Mirrors the W18
 * architecture exactly: one parser, one immutable model, one loader, one validator, one digest, one
 * cache. NOTHING consumes it (this sprint establishes the layer only).
 *
 * No reasoning. No interpretation. No embeddings. No vectors. No LLM. Fail loud on every breach.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FAMILY_PARSER_VERSION,
  REQUIRED_FAMILY_SECTIONS,
  KNOWN_FAMILIES,
  FamilySemanticsError,
  parseFamilyBody,
  parseFamilyBodyCached,
  bodyDigest,
  clearFamilyCache,
  loadFamilyKnowledge,
  createFamilyKnowledgeProvider,
  defaultFamilyKnowledgeRoot,
} from '../../src/generate/family-semantics.js';

beforeEach(() => clearFamilyCache());

/** Build a valid 16-section body in canonical order. `omit`/`reorder`/`empty` perturb it. */
function bodyOf(opts: { omit?: string; empty?: string; reorder?: boolean; duplicate?: string; unknown?: boolean } = {}): string {
  let names: string[] = [...REQUIRED_FAMILY_SECTIONS];
  if (opts.omit) names = names.filter((n) => n !== opts.omit);
  if (opts.reorder) names = [names[1], names[0], ...names.slice(2)]; // swap first two → invalid order
  if (opts.duplicate) names = [...names, opts.duplicate];
  if (opts.unknown) names = [...names, 'Made Of'];
  const lines = ['# Demo Family', '', 'A role, brand-invariant.', ''];
  for (const n of names) {
    lines.push(`## ${n}`);
    lines.push(opts.empty === n ? '' : `Authored content for ${n}.`);
    lines.push('');
  }
  return lines.join('\n');
}

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), 'w23-'));
}
function writeFamilyDoc(root: string, family: string, body: string): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, `${family}.md`), `---\nfamily: ${family}\n---\n\n${body}`, 'utf8');
}

describe('W23 — registry + parser version', () => {
  it('exposes 16 ordered grounded dimensions and 17 known families', () => {
    expect(REQUIRED_FAMILY_SECTIONS[0]).toBe('Purpose');
    expect(REQUIRED_FAMILY_SECTIONS[1]).toBe('Mission');
    expect(REQUIRED_FAMILY_SECTIONS).toHaveLength(16);
    // the three governance-gap dimensions are absent from the model entirely
    expect(REQUIRED_FAMILY_SECTIONS).not.toContain('Primary Audience');
    expect(REQUIRED_FAMILY_SECTIONS).not.toContain('Suitable Business Types');
    expect(REQUIRED_FAMILY_SECTIONS).not.toContain('Unsuitable Business Types');
    expect(KNOWN_FAMILIES).toHaveLength(17);
    expect(KNOWN_FAMILIES).toContain('family-hero');
    expect(FAMILY_PARSER_VERSION).toMatch(/^w23-/);
  });
});

describe('W23 — parseFamilyBody validation (fail loud)', () => {
  it('parses a valid 16-section body in order: frozen, ordered, digest, verbatim markdown', () => {
    const parsed = parseFamilyBody(bodyOf(), 'demo');
    expect(parsed.validationState).toBe('valid');
    expect(parsed.sections.map((s) => s.name)).toEqual([...REQUIRED_FAMILY_SECTIONS]);
    expect(parsed.sections[0].markdown).toBe('Authored content for Purpose.');
    expect(parsed.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.sections)).toBe(true);
    expect(Object.isFrozen(parsed.sections[0])).toBe(true);
  });

  it('throws on missing Purpose', () => {
    expect(() => parseFamilyBody(bodyOf({ omit: 'Purpose' }), 'd')).toThrow(/Purpose/);
  });
  it('throws on missing Mission', () => {
    expect(() => parseFamilyBody(bodyOf({ omit: 'Mission' }), 'd')).toThrow(/Mission/);
  });
  it('throws on an empty section', () => {
    expect(() => parseFamilyBody(bodyOf({ empty: 'Strengths' }), 'd')).toThrow(/empty/i);
  });
  it('throws on a duplicate section', () => {
    expect(() => parseFamilyBody(bodyOf({ duplicate: 'Purpose' }), 'd')).toThrow(/duplicate section/i);
  });
  it('throws on an unknown section', () => {
    expect(() => parseFamilyBody(bodyOf({ unknown: true }), 'd')).toThrow(/unknown section/i);
  });
  it('throws on invalid ordering', () => {
    expect(() => parseFamilyBody(bodyOf({ reorder: true }), 'd')).toThrow(/order/i);
  });
  it('throws SemanticBody-style typed error', () => {
    try {
      parseFamilyBody(bodyOf({ omit: 'Purpose' }), 'd');
    } catch (e) {
      expect(e).toBeInstanceOf(FamilySemanticsError);
    }
  });
});

describe('W23 — digest + cache (identity = body + parser version only)', () => {
  it('cache replay returns the identical frozen object; digest stable', () => {
    const b = bodyOf();
    const first = parseFamilyBodyCached(b, 'd');
    const second = parseFamilyBodyCached(b, 'd');
    expect(first).toBe(second);
    expect(bodyDigest(b)).toBe(bodyDigest(b));
  });
  it('digest changes when the body changes', () => {
    expect(bodyDigest(bodyOf())).not.toBe(bodyDigest(bodyOf().replace('Purpose.', 'Purpose!!')));
  });
});

describe('W23 — loader + provider (unknown / duplicate family, digest mismatch)', () => {
  it('loads a valid family document and binds family + sourceFile', () => {
    const root = tmpRoot();
    try {
      writeFamilyDoc(root, 'family-hero', bodyOf());
      const k = loadFamilyKnowledge(join(root, 'family-hero.md'), root);
      expect(k.family).toBe('family-hero');
      expect(k.sourceFile).toBe('family-hero.md');
      expect(k.sections).toHaveLength(16);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws on a document with no frontmatter', () => {
    const root = tmpRoot();
    try {
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, 'family-hero.md'), bodyOf(), 'utf8'); // no frontmatter fence
      expect(() => loadFamilyKnowledge(join(root, 'family-hero.md'), root)).toThrow(/frontmatter/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws on an unknown family name', () => {
    const root = tmpRoot();
    try {
      writeFamilyDoc(root, 'family-nonsense', bodyOf());
      expect(() => loadFamilyKnowledge(join(root, 'family-nonsense.md'), root)).toThrow(/unknown family/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('provider.knowledgeFor caches; digest mismatch on a mid-run body change fails loud', () => {
    const root = tmpRoot();
    try {
      writeFamilyDoc(root, 'family-faq', bodyOf());
      const p = createFamilyKnowledgeProvider(root);
      expect(p.knowledgeFor('family-faq')!.family).toBe('family-faq');
      writeFamilyDoc(root, 'family-faq', bodyOf().replace('Purpose.', 'Mutated.'));
      expect(() => p.knowledgeFor('family-faq')).toThrow(/digest mismatch/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loadAll throws on a duplicate family declaration', () => {
    const root = tmpRoot();
    try {
      writeFamilyDoc(root, 'family-hero', bodyOf());
      // a second file declaring the SAME family
      writeFileSync(join(root, 'family-hero-copy.md'), `---\nfamily: family-hero\n---\n\n${bodyOf()}`, 'utf8');
      const p = createFamilyKnowledgeProvider(root);
      expect(() => p.loadAll()).toThrow(/duplicate family/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('W23 — the real authored family corpus', () => {
  it('loadAll over the default root yields all 17 known families, each valid with 16 sections', () => {
    const p = createFamilyKnowledgeProvider(defaultFamilyKnowledgeRoot());
    const all = p.loadAll();
    expect([...all.keys()].sort()).toEqual([...KNOWN_FAMILIES].sort());
    for (const family of KNOWN_FAMILIES) {
      const k = all.get(family)!;
      expect(k.sections.map((s) => s.name)).toEqual([...REQUIRED_FAMILY_SECTIONS]);
      expect(k.family).toBe(family);
    }
  });

  it('family-hero Purpose + Mission are authored, non-empty, and rebrand-invariant (no slugs/tokens)', () => {
    const k = createFamilyKnowledgeProvider(defaultFamilyKnowledgeRoot()).knowledgeFor('family-hero')!;
    const purpose = k.sections.find((s) => s.name === 'Purpose')!.markdown;
    const mission = k.sections.find((s) => s.name === 'Mission')!.markdown;
    expect(purpose.length).toBeGreaterThan(0);
    expect(mission.length).toBeGreaterThan(0);
    // brand-invariant: no variant slugs, no token/class artefacts
    const joined = k.sections.map((s) => s.markdown).join('\n');
    expect(joined).not.toMatch(/hero-bento|data-crf|var\(--|\.cr-/);
  });
});
