/**
 * W86 — World A Knowledge Invariant Guard.
 *
 * W84 §3.2 found that "World A digests unchanged" was a real, load-bearing invariant that
 * every sprint since W1 verified by hand (run `knowledge:build`, eyeball the printed digests
 * against `OFFSCRIPT-RUNTIME-ARCHITECTURE.md §2`) — but nothing failed loudly if it silently broke.
 * `test/knowledge/builder.test.ts` and `test/knowledge/integration.test.ts` only assert
 * *self-consistency* (two builds in the same run agree with each other); neither pins the
 * five artifact digests against their frozen historical values.
 *
 * This is the ONE canonical place that invariant is asserted — pinned once here, not
 * sprinkled across other World A tests (avoids duplicate/drifting assertions).
 *
 * The five digests (`test/knowledge/integration.test.ts`'s real-repository build, current as
 * of W86 grounding — reproduced via `npm run knowledge:build`):
 *   dependency-graph sha256:14d69b87… · semantic-graph sha256:74f9e373… ·
 *   diagnostics sha256:86e7f512… · statistics sha256:175e5445… · build identity sha256:c1a3ff4f…
 *
 * The golden values below are authoritative. Changing them is an explicit engineering
 * decision (a real World A content/logic change) — never an automatic regeneration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildRepository } from '../../src/knowledge/builder.js';
import { parseAsset, type NormalizedAsset } from '../../src/knowledge/model.js';
import { makeVocabulary } from '../../src/knowledge/vocabulary.js';

const REAL_REPO = fileURLToPath(new URL('../../repository', import.meta.url));

/** The five golden World A digests (W84 §3.2 / W86). Do not "fix" a failure by editing these
 *  — a mismatch means World A's published output changed; that requires a human decision. */
const GOLDEN_ARTIFACTS = {
  'dependency-graph': 'sha256:14d69b87840e3f56464a87a2ad9adbd3630ba33a52f26ac3e2e6caada21a85bf',
  'semantic-graph': 'sha256:74f9e373cfdbcd85ef1d40cf74dcfd7ec9db38ecad6f2693deed9f610eb06715',
  diagnostics: 'sha256:86e7f5123ac858fdc417dd76509624f50e3d6ae4a42add8871876767a61baabb',
  statistics: 'sha256:175e5445c0d2d64709eccb6169083901c9c64ab49a3cdf9fefc2817338eade66',
} as const;
// October 3, 2026: current Offscript authored ownership/scope metadata baseline.
// The repository build identity covers this metadata as well as asset contents.
// The four graph/diagnostic artifact digests above remain unchanged. Keep this value
// pinned rather than recomputing the expectation; mutation and replay guards still apply.
const GOLDEN_BUILD_IDENTITY = 'sha256:c1a3ff4f70aedb5c6ea678470918f606939520adf79f039c976d4c351f3a22ea';

describe('World A golden digest invariant (W86)', () => {
  it('current golden digests — the real repository build matches the frozen historical values exactly', () => {
    const r = buildRepository({ root: REAL_REPO });
    expect(r.manifest.artifacts).toEqual(GOLDEN_ARTIFACTS);
    expect(r.manifest.buildIdentity).toBe(GOLDEN_BUILD_IDENTITY);
  });

  it('deterministic replay — a second build of the same repository reproduces the golden values', () => {
    const r = buildRepository({ root: REAL_REPO });
    expect(r.manifest.artifacts).toEqual(GOLDEN_ARTIFACTS);
    expect(r.manifest.buildIdentity).toBe(GOLDEN_BUILD_IDENTITY);
  });

  it('repeatability across consecutive runs — five back-to-back builds all agree with the golden values', () => {
    for (let i = 0; i < 5; i++) {
      const r = buildRepository({ root: REAL_REPO });
      expect(r.manifest.artifacts, `run ${i + 1}`).toEqual(GOLDEN_ARTIFACTS);
      expect(r.manifest.buildIdentity, `run ${i + 1}`).toBe(GOLDEN_BUILD_IDENTITY);
    }
  });
});

describe('World A golden digest invariant — mutation sensitivity (W86)', () => {
  const VOCAB = makeVocabulary({ owners: ['ds'], scopeIdentities: ['offscript'] });

  function assetOf(id: string, title: string): NormalizedAsset {
    const { asset, findings } = parseAsset(
      {
        schema_version: '1.0',
        kind: 'component',
        identity: { id, title },
        ownership: { owner: 'ds' },
        scope: { class: 'canonical', identity: 'offscript' },
        governance: { authority: 'canonical-global' },
      },
      'probe',
    );
    if (!asset) throw new Error(JSON.stringify(findings));
    return asset;
  }

  // The build-identity digest folds `digest(assetCanonical(a))` for EVERY asset
  // unconditionally (manifest.ts:45) — it is the one artifact guaranteed sensitive to
  // ANY authored content change, structural or not. The four derived artifacts
  // (dependency-graph/semantic-graph/diagnostics/statistics) are intentionally
  // STRUCTURAL summaries (ids, edge kinds, counts) — by design they do NOT encode prose
  // like `title` (diagnostics.ts/statistics.ts headers: "NEVER authored metadata" /
  // "INFORMATIONAL ONLY"), so a title-only edit correctly leaves them unchanged. This is
  // real, intended behavior, not a gap: buildIdentity is itself one of the five golden
  // digests pinned above, so a prose-only World A change is still caught.
  it('a single-character title mutation changes the build-identity digest (content-sensitive by construction)', () => {
    const before = buildRepository({ loaded: { assets: [assetOf('canonical::probe', 'Probe')], parseFindings: [], vocabulary: VOCAB } });
    const after = buildRepository({ loaded: { assets: [assetOf('canonical::probe', 'Probes')], parseFindings: [], vocabulary: VOCAB } });

    expect(after.manifest.buildIdentity).not.toBe(before.manifest.buildIdentity);
    // The structural artifacts are correctly unaffected — asserted explicitly so a future
    // change to their shape (making them content-sensitive) doesn't silently pass either way.
    expect(after.manifest.artifacts).toEqual(before.manifest.artifacts);
  });

  // A structural mutation (a second asset added) DOES flow into every derived artifact:
  // an extra node in both graphs, a changed diagnostics.isolatedAssets list, and a
  // changed statistics.assetsByKind tally — proving the full pipeline (not just
  // buildIdentity) is sensitive to real repository changes.
  it('a one-asset structural mutation changes every one of the five digests', () => {
    const before = buildRepository({ loaded: { assets: [assetOf('canonical::probe', 'Probe')], parseFindings: [], vocabulary: VOCAB } });
    const after = buildRepository({
      loaded: {
        assets: [assetOf('canonical::probe', 'Probe'), assetOf('canonical::probe-two', 'Probe Two')],
        parseFindings: [],
        vocabulary: VOCAB,
      },
    });

    expect(after.manifest.buildIdentity).not.toBe(before.manifest.buildIdentity);
    for (const key of Object.keys(before.manifest.artifacts)) {
      expect(after.manifest.artifacts[key], `artifact "${key}"`).not.toBe(before.manifest.artifacts[key]);
    }
  });

  it('an unmutated rebuild of the same probe repository is byte-identical (the mutation tests have no false positives)', () => {
    const a = buildRepository({ loaded: { assets: [assetOf('canonical::probe', 'Probe')], parseFindings: [], vocabulary: VOCAB } });
    const b = buildRepository({ loaded: { assets: [assetOf('canonical::probe', 'Probe')], parseFindings: [], vocabulary: VOCAB } });
    expect(b.manifest.buildIdentity).toBe(a.manifest.buildIdentity);
    expect(b.manifest.artifacts).toEqual(a.manifest.artifacts);
  });
});

describe('World A architectural isolation from World B (W86 — structural guard)', () => {
  // The exact transitive import closure reachable from `buildRepository()` (builder.ts),
  // traced by hand during W86 grounding — NOT "everything under src/knowledge/". That
  // directory also holds `projection.ts` (PKG-3), which legitimately imports
  // `../generate/composition-md.js`: it is a derived planner-facing read model consumed
  // ONLY by src/generate/* callers and is never reached by buildRepository(). Asserting
  // "no src/knowledge/*.ts file imports generate/" would be false and would wrongly flag
  // projection.ts — the guard below is scoped to the digest-producing pipeline only.
  const PIPELINE_FILES = [
    'builder.ts',
    'digest.ts',
    'finding.ts',
    'graph.ts',
    'manifest.ts',
    'validate.ts',
    'graph-validate.ts',
    'diagnostics.ts',
    'statistics.ts',
    'model.ts',
    'vocabulary.ts',
    'edge.ts',
    'identity.ts',
    'dependency-extractor.ts',
    'semantic-extractor.ts',
    'source/index.ts',
    'source/markdown-source.ts',
    'source/scan.ts',
    'source/yaml-source.ts',
  ];

  it('no file in the buildRepository() transitive closure imports from src/generate (World B)', () => {
    const knowledgeDir = fileURLToPath(new URL('../../src/knowledge/', import.meta.url));
    const offenders: string[] = [];
    for (const rel of PIPELINE_FILES) {
      const text = readFileSync(join(knowledgeDir, rel), 'utf8');
      if (/from\s+['"](\.\.\/)*generate\//.test(text)) offenders.push(rel);
    }
    expect(offenders, `World-B import found in the World A build pipeline: ${offenders.join(', ')}`).toEqual([]);
  });
});
