/**
 * P50 — Context discovery: providers inspect real workspace artifacts and emit attributable
 * evidence, the runner isolates a broken provider, and new providers register without any
 * orchestration change.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { getProjectType } from '../../src/project/project-registry.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import {
  registerDiscoveryProvider,
  listDiscoveryProviders,
  discoverContext,
  _resetDiscoveryProviders,
  type DiscoveryContext,
  type DiscoveryProvider,
} from '../../src/project/discovery.js';
import {
  existingBriefProvider,
  brandKitProvider,
  workspaceManifestProvider,
  defaultDiscoveryProviders,
} from '../../src/project/discovery-providers.js';

const CLIENT = '__p50_disc__';
function ctxFor(): DiscoveryContext {
  return { client: CLIENT, projectType: getProjectType('website'), track: 'website', now: '2026-01-01T00:00:00Z' };
}
afterEach(() => {
  _resetDiscoveryProviders();
  rmSync(projectDir(CLIENT), { recursive: true, force: true });
});

describe('P50 discovery providers', () => {
  it('existing-brief provider evidences every present field of a prior brief.md', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    writeFileSync(
      join(projectReferencesDir(CLIENT), 'brief.md'),
      normalizeBrief({ track: 'website', oneLiner: 'Ship fast', audience: 'Devs', mustInclude: ['hero', 'footer'] }),
      'utf8',
    );
    const evs = existingBriefProvider().discover(ctxFor());
    const byField = Object.fromEntries(evs.map((e) => [e.field, e]));
    expect(byField['one-liner'].value).toBe('Ship fast');
    expect(byField['must-include'].value).toEqual(['hero', 'footer']);
    expect(byField['one-liner'].source).toBe('existing-brief');
    expect(byField['one-liner'].supportingArtifact).toBe('brief.md');
    expect(byField['one-liner'].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('brand-kit provider evidences brand/tone/audience from references/brand-kit.json', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    writeFileSync(
      join(projectReferencesDir(CLIENT), 'brand-kit.json'),
      JSON.stringify({ brand: 'Acme', tone: 'Confident', audience: 'Growth teams' }),
      'utf8',
    );
    const evs = brandKitProvider().discover(ctxFor());
    const byField = Object.fromEntries(evs.map((e) => [e.field, e]));
    expect(byField['brand'].value).toBe('Acme');
    expect(byField['tone'].value).toBe('Confident');
    expect(byField['brand'].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('workspace-manifest provider emits only a LOW-confidence brand signal from the client slug', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    const evs = workspaceManifestProvider().discover(ctxFor());
    const brand = evs.find((e) => e.field === 'brand');
    expect(brand).toBeDefined();
    expect(brand!.confidence).toBeLessThan(0.7); // a slug is never enough to skip the interview
  });

  it('providers return nothing when their artifact is absent (no project on disk)', () => {
    expect(existingBriefProvider().discover(ctxFor())).toEqual([]);
    expect(brandKitProvider().discover(ctxFor())).toEqual([]);
    expect(workspaceManifestProvider().discover(ctxFor())).toEqual([]);
  });

  it('the runner registers the default provider set and collects across all of them', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    writeFileSync(join(projectReferencesDir(CLIENT), 'brand-kit.json'), JSON.stringify({ brand: 'Acme' }), 'utf8');
    for (const p of defaultDiscoveryProviders()) registerDiscoveryProvider(p);
    expect(listDiscoveryProviders().map((p) => p.id)).toEqual(['existing-brief', 'brand-kit', 'workspace-manifest']);
    const evs = discoverContext(ctxFor());
    expect(evs.some((e) => e.source === 'brand-kit' && e.field === 'brand')).toBe(true);
  });

  it('ISOLATES a broken provider — one throw does not blind the whole sweep', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    writeFileSync(join(projectReferencesDir(CLIENT), 'brand-kit.json'), JSON.stringify({ brand: 'Acme' }), 'utf8');
    const boom: DiscoveryProvider = { id: 'boom', label: 'x', discover() { throw new Error('kaboom'); } };
    registerDiscoveryProvider(boom);
    registerDiscoveryProvider(brandKitProvider());
    const evs = discoverContext(ctxFor());
    expect(evs.some((e) => e.source === 'brand-kit')).toBe(true); // survived the broken provider
  });

  it('EXTENSIBILITY: a new provider registers and flows through discovery with no orchestration edit', () => {
    const contentCore: DiscoveryProvider = {
      id: 'content-core-outputs',
      label: 'Content-Core outputs',
      discover(ctx) {
        return [{ field: 'audience', value: 'Enterprise buyers', source: 'content-core-outputs', confidence: 0.85, timestamp: ctx.now, origin: 'content-core' }];
      },
    };
    registerDiscoveryProvider(contentCore);
    const evs = discoverContext(ctxFor());
    expect(evs).toEqual([
      { field: 'audience', value: 'Enterprise buyers', source: 'content-core-outputs', confidence: 0.85, timestamp: '2026-01-01T00:00:00Z', origin: 'content-core' },
    ]);
  });
});
