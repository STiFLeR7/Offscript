/**
 * PKG — Repository Builder: end-to-end build (scanner → loader → normalize →
 * validate → graphs → manifest), determinism, atomic publication, fail-loud.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRepository } from '../../src/knowledge/builder.js';
import { KnowledgeValidationError } from '../../src/knowledge/finding.js';
import { parseAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';

const ROOT = fileURLToPath(new URL('./fixtures/sample-repo', import.meta.url));
const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('buildRepository — end to end on the sample repo', () => {
  it('validates, derives both graphs, and a manifest', () => {
    const r = buildRepository({ root: ROOT });
    expect(r.assetCount).toBe(4);

    const dep = r.dependencyGraph;
    expect(dep.nodes.find((n) => n.id === 'guarantee:legible-actions')?.type).toBe('guarantee');
    expect(dep.edges).toContainEqual({
      source: 'brand:acme::cta',
      kind: 'prerequisite',
      target: 'brand:acme::tokens',
    });
    expect(dep.edges).toContainEqual({
      source: 'brand:acme::cta',
      kind: 'lineage',
      target: 'canonical::button',
    });

    const sem = r.semanticGraph;
    expect(sem.nodes.find((n) => n.id === 'concept:interactive-affordance')?.type).toBe('concept');

    expect(r.manifest.buildIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.keys(r.manifest.inputs)).toHaveLength(4);
  });

  it('is deterministic: two builds yield identical identities + artifact digests', () => {
    const a = buildRepository({ root: ROOT });
    const b = buildRepository({ root: ROOT });
    expect(b.manifest.buildIdentity).toBe(a.manifest.buildIdentity);
    expect(b.manifest.artifacts).toEqual(a.manifest.artifacts);
  });

  it('publishes atomically and the manifest is reproducible on disk', () => {
    const out = mkdtempSync(join(tmpdir(), 'kb-'));
    temps.push(out);
    const r = buildRepository({ root: ROOT, outputDir: out, publish: true });
    const onDisk = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(onDisk.build_identity).toBe(r.manifest.buildIdentity);
    expect(() => readFileSync(join(out, 'dependency-graph.json'), 'utf8')).not.toThrow();
    expect(() => readFileSync(join(out, 'semantic-graph.json'), 'utf8')).not.toThrow();
  });
});

describe('buildRepository — atomic publication (M2)', () => {
  it('overwrites a pre-existing build cleanly, leaving no transient dirs', () => {
    const out = mkdtempSync(join(tmpdir(), 'kb-pub-'));
    temps.push(out);
    const target = join(out, '.knowledge-build');
    // a stale prior build that must be replaced atomically
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'stale.json'), 'stale', 'utf8');

    buildRepository({ root: ROOT, outputDir: target, publish: true });
    buildRepository({ root: ROOT, outputDir: target, publish: true }); // re-publish over itself

    const published = readdirSync(target).sort();
    expect(published).toEqual([
      'dependency-graph.json',
      'diagnostics.json',
      'manifest.json',
      'semantic-graph.json',
      'statistics.json',
    ]);
    // no leftover staging/backup directories beside the target
    const beside = readdirSync(out).filter((n) => n !== '.knowledge-build');
    expect(beside).toEqual([]);
  });
});

// Loader parity through the COMPLETE builder pipeline (not just the parser): a YAML
// repository and an equivalent Markdown repository must produce identical manifests.
describe('buildRepository — serialization independence end to end', () => {
  const ASSET_YAML = `schema_version: "1.0"
kind: component
identity:
  id: "canonical::widget"
  title: "Widget"
ownership:
  owner: "ds"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  produces:
    - "concept:x"
`;
  const VOCAB_YAML = `concepts:\n  - "concept:x"\nowners:\n  - "ds"\nscope_identities:\n  - "offscript"\n`;

  function repo(metaFile: string, metaText: string): string {
    const root = mkdtempSync(join(tmpdir(), 'kb-parity-'));
    temps.push(root);
    mkdirSync(join(root, 'canonical', 'widget'), { recursive: true });
    writeFileSync(join(root, 'canonical', 'widget', metaFile), metaText, 'utf8');
    writeFileSync(join(root, 'vocabulary.yaml'), VOCAB_YAML, 'utf8');
    return root;
  }

  it('YAML and Markdown repositories yield identical manifests', () => {
    const yamlRoot = repo('component.yaml', ASSET_YAML);
    const mdRoot = repo('component.md', `---\n${ASSET_YAML}---\n\n# Widget\n\nProse the loader ignores.\n`);
    const a = buildRepository({ root: yamlRoot });
    const b = buildRepository({ root: mdRoot });
    expect(b.manifest.buildIdentity).toBe(a.manifest.buildIdentity);
    expect(b.manifest.artifacts).toEqual(a.manifest.artifacts);
  });
});

describe('buildRepository — fail-loud, no partial publication', () => {
  it('throws on a graph-level semantic inconsistency (specializes an unproduced concept)', () => {
    const { asset } = parseAsset(
      {
        schema_version: '1.0',
        kind: 'component',
        identity: { id: 'canonical::v', title: 'V' },
        ownership: { owner: 'ds' },
        scope: { class: 'canonical', identity: 'offscript' },
        governance: { authority: 'canonical-global' },
        semantics: { specializes: ['concept:role'] }, // governed, but produced by no asset
      },
      'v',
    );
    expect(() =>
      buildRepository({
        loaded: {
          assets: [asset!],
          parseFindings: [],
          vocabulary: makeVocabulary({ owners: ['ds'], scopeIdentities: ['offscript'], concepts: ['concept:role'] }),
        },
      }),
    ).toThrow(KnowledgeValidationError);
  });

  it('throws on a Stage-1 selection fact off the governed obligations vocabulary', () => {
    const { asset } = parseAsset(
      {
        schema_version: '1.0',
        kind: 'component',
        identity: { id: 'canonical::v', title: 'V' },
        ownership: { owner: 'ds' },
        scope: { class: 'canonical', identity: 'offscript' },
        governance: { authority: 'canonical-global' },
        capabilities: { satisfies: ['serves:ghost'] }, // not declared in vocabulary.obligations
      },
      'v',
    );
    expect(() =>
      buildRepository({
        loaded: {
          assets: [asset!],
          parseFindings: [],
          vocabulary: makeVocabulary({ owners: ['ds'], scopeIdentities: ['offscript'] }), // no obligations
        },
      }),
    ).toThrow(KnowledgeValidationError);
  });

  it('throws KnowledgeValidationError on a contradictory asset (DI, disk-free)', () => {
    const { asset } = parseAsset(
      {
        schema_version: '1.0',
        kind: 'component',
        identity: { id: 'brand:acme::x', title: 'X' },
        ownership: { owner: 'acme-brand-authority' },
        scope: { class: 'brand', identity: 'acme' },
        governance: { authority: 'canonical-global' }, // contradiction: brand scope
      },
      'x',
    );
    expect(() =>
      buildRepository({
        loaded: {
          assets: [asset!],
          parseFindings: [],
          vocabulary: makeVocabulary({ owners: ['acme-brand-authority'], scopeIdentities: ['acme'] }),
        },
      }),
    ).toThrow(KnowledgeValidationError);
  });
});
