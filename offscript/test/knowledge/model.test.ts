/**
 * PKG — Repository Builder: normalized-model parse + schema validation.
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, assetCanonical } from '../../src/knowledge/model.js';

const minimal = {
  schema_version: '1.0',
  kind: 'component',
  identity: { id: 'canonical::button', title: 'Button' },
  ownership: { owner: 'offscript-authority' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};

describe('parseAsset — a well-formed document', () => {
  it('parses with no findings and defaults empty Band-B sections', () => {
    const { asset, findings } = parseAsset(minimal, 'canonical/button/component.yaml');
    expect(findings).toEqual([]);
    expect(asset?.kind).toBe('component');
    expect(asset?.dependencies.prerequisite).toEqual([]);
    expect(asset?.semantics.produces).toEqual([]);
  });

  it('normalizes Band-B lists: NFC, dedupe, sort', () => {
    const { asset } = parseAsset(
      { ...minimal, semantics: { produces: ['b', 'a', 'a'] } },
      'loc',
    );
    expect(asset?.semantics.produces).toEqual(['a', 'b']);
  });
});

describe('parseAsset — frozen region set (ES-1R F1)', () => {
  it('rejects a top-level `spec` (or any unknown) key', () => {
    const { asset, findings } = parseAsset({ ...minimal, spec: { archetype: 'x' } }, 'loc');
    expect(asset).toBeUndefined();
    expect(findings.some((f) => f.code === 'SCHEMA_UNKNOWN_KEY' && f.location === 'loc.spec')).toBe(true);
  });
});

describe('parseAsset — mandatory core + enums', () => {
  it('flags a missing mandatory section', () => {
    const { ownership: _omit, ...noOwner } = minimal;
    const { asset, findings } = parseAsset(noOwner, 'loc');
    expect(asset).toBeUndefined();
    expect(findings.some((f) => f.code === 'SCHEMA_MISSING' && f.location === 'loc.ownership')).toBe(true);
  });

  it('flags an invalid enum', () => {
    const { findings } = parseAsset({ ...minimal, kind: 'widget' }, 'loc');
    expect(findings.some((f) => f.code === 'SCHEMA_ENUM' && f.location === 'loc.kind')).toBe(true);
  });

  it('flags an unsupported schema_version', () => {
    const { findings } = parseAsset({ ...minimal, schema_version: '9.9' }, 'loc');
    expect(findings.some((f) => f.code === 'SCHEMA_ENUM' && f.location === 'loc.schema_version')).toBe(true);
  });
});

describe('assetCanonical — canonical projection', () => {
  it('drops empty optional sections (absence is meaning)', () => {
    const { asset } = parseAsset(minimal, 'loc');
    const c = assetCanonical(asset!);
    expect(c).not.toHaveProperty('dependencies');
    expect(c).not.toHaveProperty('semantics');
    expect((c.governance as Record<string, unknown>)).not.toHaveProperty('constraints');
    expect(c).not.toHaveProperty('location');
  });

  // M3: the canonical form is structurally derived, so a populated field cannot be
  // silently excluded from the digest. Every non-empty band must surface (snake_cased).
  it('reflects every populated field (no drift between model and digest shape)', () => {
    const { asset } = parseAsset(
      {
        ...minimal,
        identity: { id: 'brand:acme::x', title: 'X' },
        ownership: { owner: 'acme' },
        scope: { class: 'brand', identity: 'acme' },
        governance: {
          authority: 'adapted-local',
          lineage: { derives_from: 'canonical::button' },
          constraints: ['c1'],
        },
        dependencies: { prerequisite: ['canonical::button'], realizes: ['guarantee:g'] },
        semantics: { consumes: ['concept:a'], derives_from: ['concept:b'] },
        capabilities: { communicates: ['capability:c'] },
        composition: { requires_companion: ['canonical::button'], fallback_class: 'hybrid' },
        evolution: { status: 'superseded', superseded_by: 'brand:acme::y' },
        validation: { expects: ['e'], tests: ['t'] },
      },
      'loc',
    );
    const c = assetCanonical(asset!) as Record<string, Record<string, unknown>>;
    // camelCase model keys must appear in their serialized snake_case form
    expect(c.governance).toHaveProperty('lineage');
    expect((c.governance.lineage as Record<string, unknown>)).toHaveProperty('derives_from');
    expect(c.semantics).toHaveProperty('derives_from');
    expect(c.composition).toHaveProperty('requires_companion');
    expect(c.composition).toHaveProperty('fallback_class');
    expect(c.evolution).toHaveProperty('superseded_by');
    expect(c).not.toHaveProperty('location');
  });
});
