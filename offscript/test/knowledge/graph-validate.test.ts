/**
 * Sprint 2 — Repository Builder: graph-level validation (semantic inconsistency).
 */
import { describe, it, expect } from 'vitest';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { buildSemanticGraph } from '../../src/knowledge/graph.js';
import { validateGraphs } from '../../src/knowledge/graph-validate.js';

const base = {
  schema_version: '1.0',
  kind: 'component',
  ownership: { owner: 'ds' },
  scope: { class: 'canonical', identity: 'offscript' },
  governance: { authority: 'canonical-global' },
};

function asset(loose: Record<string, unknown>): NormalizedAsset {
  const { asset, findings } = parseAsset(loose, 'loc');
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}

describe('validateGraphs — semantic inconsistency', () => {
  it('passes when every specialized concept is produced by some asset', () => {
    const family = asset({ ...base, identity: { id: 'canonical::family', title: 'F' }, semantics: { produces: ['concept:role'] } });
    const variant = asset({ ...base, identity: { id: 'canonical::v', title: 'V' }, semantics: { specializes: ['concept:role'] } });
    expect(validateGraphs(buildSemanticGraph([family, variant]))).toEqual([]);
  });

  it('flags a specialization of a concept no asset produces (broken join)', () => {
    const variant = asset({ ...base, identity: { id: 'canonical::v', title: 'V' }, semantics: { specializes: ['concept:orphan-role'] } });
    const findings = validateGraphs(buildSemanticGraph([variant]));
    expect(findings.map((f) => f.code)).toContain('SEMANTIC_INCONSISTENCY');
    expect(findings[0].location).toBe('canonical::v');
  });

  it('flags a derives_from of an unproduced concept', () => {
    const variant = asset({ ...base, identity: { id: 'canonical::d', title: 'D' }, semantics: { derives_from: ['concept:ghost'] } });
    expect(validateGraphs(buildSemanticGraph([variant])).map((f) => f.code)).toContain('SEMANTIC_INCONSISTENCY');
  });
});
