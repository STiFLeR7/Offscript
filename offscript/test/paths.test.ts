import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  repoRoot,
  trackDir,
  projectDir,
  projectReferencesDir,
  designPrinciplesDir,
  designProcessesDir,
  resolveBrandContract,
  websiteCatalogDir,
  catalogManifestPath,
  catalogShellPath,
  catalogToolsDir,
  v2AssetSource,
} from '../src/paths.js';
import { resolveTrack } from '../src/track-resolve.js';

// A throwaway client name so the brand-contract test can create/remove a real
// projects/<client>/references/ tree without touching any actual project.
const TMP = '__paths_test_client__';
const tmpRefs = projectReferencesDir(TMP);

afterEach(() => {
  rmSync(projectDir(TMP), { recursive: true, force: true });
});

describe('paths', () => {
  it('builds client-first project + track dirs under repoRoot', () => {
    expect(trackDir('acme', 'website')).toBe(join(repoRoot, 'projects', 'acme', 'website'));
    expect(trackDir('acme', 'collateral')).toBe(join(repoRoot, 'projects', 'acme', 'collateral'));
  });

  it('resolves governance dirs by type, design_processes by track', () => {
    expect(designPrinciplesDir()).toBe(join(repoRoot, 'resources', 'design_principles'));
    expect(designProcessesDir('website')).toBe(
      join(repoRoot, 'resources', 'design_processes', 'website'),
    );
    expect(designProcessesDir('collateral')).toBe(
      join(repoRoot, 'resources', 'design_processes', 'collateral'),
    );
  });

  it('resolveBrandContract falls back to the reference defaults when the client has no tokens', () => {
    expect(resolveBrandContract(TMP)).toBe(designPrinciplesDir());
  });

  it('resolveBrandContract prefers the client refs when colors_and_type.css is present', () => {
    mkdirSync(tmpRefs, { recursive: true });
    writeFileSync(join(tmpRefs, 'colors_and_type.css'), ':root{}', 'utf8');
    expect(resolveBrandContract(TMP)).toBe(tmpRefs);
  });
});

describe('website v2 catalog (Path C)', () => {
  it('resolves the vendored catalog dirs under design_processes/website', () => {
    expect(websiteCatalogDir()).toBe(join(designProcessesDir('website'), 'catalog'));
    expect(catalogManifestPath()).toBe(join(websiteCatalogDir(), 'fragments', 'manifest.json'));
    expect(catalogShellPath()).toBe(join(websiteCatalogDir(), 'fragments', '_shell.html'));
    expect(catalogToolsDir()).toBe(join(websiteCatalogDir(), 'tools'));
  });

  // RETIRED: website pivoted to author-from-governance; the Path-C catalog is dormant (see docs/internals/OFFSCRIPT-WEBSITE-STACK-INGESTION-PLAN.md P3).
  it.skip('the lean-vendored machine layer exists on disk', () => {
    expect(existsSync(catalogManifestPath())).toBe(true);
    expect(existsSync(catalogShellPath())).toBe(true);
    expect(existsSync(join(catalogToolsDir(), 'validate-page.js'))).toBe(true);
    expect(existsSync(join(catalogToolsDir(), '_curation.js'))).toBe(true);
  });

  it('v2AssetSource honours the env override', () => {
    const prev = process.env.V2_ASSET_SOURCE;
    process.env.V2_ASSET_SOURCE = '/tmp/some-assets';
    expect(v2AssetSource()).toBe('/tmp/some-assets');
    if (prev === undefined) delete process.env.V2_ASSET_SOURCE;
    else process.env.V2_ASSET_SOURCE = prev;
  });
});

describe('resolveTrack', () => {
  it('honours an explicit --track flag', () => {
    expect(resolveTrack(['--track', 'deck'], '')).toBe('deck');
    expect(resolveTrack(['--track', 'collateral'], '')).toBe('collateral');
    expect(resolveTrack(['--track', 'website'], '')).toBe('website');
  });

  it('detects collateral via cr-doc, deck via marker, else defaults to website', () => {
    expect(resolveTrack([], '<div class="cr-doc">…</div>')).toBe('collateral');
    expect(resolveTrack([], '<div data-deck>…</div>')).toBe('deck');
    expect(resolveTrack([], '<main>hello</main>')).toBe('website');
  });
});
