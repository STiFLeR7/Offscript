/**
 * PKG — Repository Builder: build-identity strength (M1).
 *
 * Behavior, not implementation: the build identity must be deterministic for a fixed
 * snapshot AND sensitive to the things that change the published output — the inputs,
 * the governed vocabulary, the builder version, and (the M1 fix) the derived artifact
 * content itself, so a change to derivation logic cannot leave the identity unchanged.
 */
import { describe, it, expect } from 'vitest';
import { buildManifest } from '../../src/knowledge/manifest.js';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';
import type { GraphArtifact } from '../../src/knowledge/graph.js';

const VOCAB = makeVocabulary({ owners: ['ds'], scopeIdentities: ['offscript'] });

function assetOf(id: string): NormalizedAsset {
  const { asset, findings } = parseAsset(
    {
      schema_version: '1.0',
      kind: 'component',
      identity: { id, title: id },
      ownership: { owner: 'ds' },
      scope: { class: 'canonical', identity: 'offscript' },
      governance: { authority: 'canonical-global' },
    },
    'loc',
  );
  if (!asset) throw new Error(JSON.stringify(findings));
  return asset;
}

const SEM: GraphArtifact = { name: 'semantic-graph', nodes: [], edges: [] };
const depWith = (edges: GraphArtifact['edges']): GraphArtifact => ({
  name: 'dependency-graph',
  nodes: [{ id: 'canonical::a', type: 'asset' }],
  edges,
});

const identity = (
  graphs: GraphArtifact[],
  opts: { assets?: NormalizedAsset[]; version?: string } = {},
): string =>
  buildManifest({
    builderVersion: opts.version ?? '0.1.0',
    assets: opts.assets ?? [assetOf('canonical::a')],
    vocabulary: VOCAB,
    graphs,
  }).buildIdentity;

describe('buildManifest — build identity (M1)', () => {
  it('is stable for a fixed snapshot (deterministic)', () => {
    expect(identity([depWith([]), SEM])).toBe(identity([depWith([]), SEM]));
  });

  it('changes when the derived artifact content changes (logic-change sensitivity)', () => {
    const before = identity([depWith([]), SEM]);
    const after = identity([depWith([{ source: 'canonical::a', kind: 'prerequisite', target: 'canonical::b' }]), SEM]);
    expect(after).not.toBe(before);
  });

  it('changes when an input asset changes', () => {
    const before = identity([depWith([]), SEM], { assets: [assetOf('canonical::a')] });
    const after = identity([depWith([]), SEM], { assets: [assetOf('canonical::z')] });
    expect(after).not.toBe(before);
  });

  it('changes when the builder version changes', () => {
    expect(identity([depWith([]), SEM], { version: '0.2.0' })).not.toBe(identity([depWith([]), SEM]));
  });
});
