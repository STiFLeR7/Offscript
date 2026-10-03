/**
 * PKG — Repository Builder: model-level validation (vocabulary, F2 consistency,
 * cross-asset resolution, single producer).
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import { validateRepository } from '../../src/knowledge/validate.js';

function asset(loose: Record<string, unknown>, loc: string): NormalizedAsset {
  const { asset, findings } = parseAsset(loose, loc);
  if (!asset) throw new Error(`fixture not well-formed: ${JSON.stringify(findings)}`);
  return asset;
}

const VOCAB = makeVocabulary({
  concepts: ['concept:aff', 'concept:color'],
  capabilities: ['capability:cta'],
  obligations: ['obligation:legible'],
  owners: ['ds', 'acme-auth'],
  scopeIdentities: ['offscript', 'acme', 'other'],
  guarantees: ['guarantee:g1'],
});

const canonicalButton = {
  schema_version: '1.0',
  kind: 'component',
  identity: { id: 'canonical::button', title: 'Button' },
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
  semantics: { produces: ['concept:aff'] },
};

const codesOf = (assets: NormalizedAsset[]) =>
  validateRepository(assets, VOCAB).map((f) => f.code);

describe('validateRepository — a clean repository', () => {
  it('produces no findings', () => {
    expect(codesOf([asset(canonicalButton, 'canonical/button')])).toEqual([]);
  });
});

describe('validateRepository — vocabulary', () => {
  it('flags an ungoverned concept', () => {
    const a = asset(
      { ...canonicalButton, semantics: { produces: ['concept:ghost'] } },
      'loc',
    );
    expect(codesOf([a])).toContain('VOCAB_UNKNOWN');
  });
});

describe('validateRepository — F2 document-local consistency', () => {
  it('scope↔governance: canonical-global on a brand scope', () => {
    const a = asset(
      {
        ...canonicalButton,
        identity: { id: 'brand:acme::x', title: 'X' },
        ownership: { owner: 'acme-auth' },
        scope: { class: 'brand', identity: 'acme' },
        // authority stays canonical-global -> contradiction
        semantics: { consumes: ['concept:aff'] },
      },
      'loc',
    );
    expect(codesOf([a])).toContain('SCOPE_GOVERNANCE');
  });

  it('lineage↔scope: adapted-local requires lineage', () => {
    const a = asset(
      {
        ...canonicalButton,
        identity: { id: 'brand:acme::x', title: 'X' },
        ownership: { owner: 'acme-auth' },
        scope: { class: 'brand', identity: 'acme' },
        governance: { authority: 'adapted-local' },
        semantics: {},
      },
      'loc',
    );
    expect(codesOf([a])).toContain('LINEAGE_REQUIRED');
  });

  it('identity↔evolution: superseded requires a valid superseded_by', () => {
    const a = asset(
      { ...canonicalButton, evolution: { status: 'superseded' } },
      'loc',
    );
    expect(codesOf([a])).toContain('EVOLUTION_SUPERSEDED_BY');
  });
});

describe('validateRepository — cross-asset', () => {
  it('flags duplicate ids', () => {
    const codes = codesOf([
      asset(canonicalButton, 'a'),
      asset(canonicalButton, 'b'),
    ]);
    expect(codes).toContain('DUP_ID');
  });

  it('flags a concept produced by two assets', () => {
    const second = asset(
      {
        ...canonicalButton,
        identity: { id: 'canonical::button2', title: 'B2' },
        semantics: { produces: ['concept:aff'] },
      },
      'b',
    );
    expect(codesOf([asset(canonicalButton, 'a'), second])).toContain('DUP_PRODUCER');
  });

  it('flags an unlawful cross-scope prerequisite', () => {
    const acme = asset(
      {
        schema_version: '1.0',
        kind: 'component',
        identity: { id: 'brand:acme::x', title: 'X' },
        ownership: { owner: 'acme-auth' },
        scope: { class: 'brand', identity: 'acme' },
        governance: { authority: 'adapted-local', lineage: { derives_from: 'canonical::button' } },
        dependencies: { prerequisite: ['brand:other::y'] },
      },
      'acme',
    );
    const other = asset(
      {
        schema_version: '1.0',
        kind: 'component',
        identity: { id: 'brand:other::y', title: 'Y' },
        ownership: { owner: 'acme-auth' },
        scope: { class: 'brand', identity: 'other' },
        governance: { authority: 'adapted-local', lineage: { derives_from: 'canonical::button' } },
      },
      'other',
    );
    expect(codesOf([asset(canonicalButton, 'c'), acme, other])).toContain('CROSS_SCOPE');
  });

  it('flags an unresolved guarantee reference', () => {
    const a = asset(
      { ...canonicalButton, dependencies: { realizes: ['guarantee:ghost'] } },
      'loc',
    );
    expect(codesOf([a])).toContain('GUARANTEE_UNRESOLVED');
  });
});
