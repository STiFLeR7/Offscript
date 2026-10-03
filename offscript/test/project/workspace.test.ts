/**
 * P49 — Project bootstrap / workspace. `offscript init`'s core: create the project, register its
 * identity + prepare the execution context. It must NOT collect branding or creative info — its
 * responsibility ends once the project exists.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { initProject, readProjectManifest } from '../../src/project/workspace.js';

const CLIENT = '__p49_ws__';
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));

describe('P49 workspace bootstrap', () => {
  it('creates the project, references dir, and a deterministic project.json manifest', () => {
    const m = initProject({ client: CLIENT, projectType: 'website' });
    expect(existsSync(projectDir(CLIENT))).toBe(true);
    expect(existsSync(projectReferencesDir(CLIENT))).toBe(true);
    expect(existsSync(join(projectDir(CLIENT), 'project.json'))).toBe(true);
    expect(m).toEqual({ schemaVersion: 1, client: CLIENT, projectType: 'website', deliverables: ['website'] });
    // manifest is deterministic (no clock/rng) — re-serialization is byte-stable
    expect(readProjectManifest(CLIENT)).toEqual(m);
  });

  it('registers identity + deliverables from the project TYPE only — never branding/creative info', () => {
    initProject({ client: CLIENT, projectType: 'full-brand-package' });
    const raw = readFileSync(join(projectDir(CLIENT), 'project.json'), 'utf8');
    expect(JSON.parse(raw).deliverables).toEqual(['website', 'collateral', 'deck']);
    // no brand / one-liner / audience keys leaked into the manifest
    for (const forbidden of ['brand', 'one-liner', 'oneLiner', 'audience', 'tone', 'goals']) {
      expect(raw).not.toContain(`"${forbidden}"`);
    }
    // and it did NOT write a brief.md (bootstrap ≠ brief acquisition)
    expect(existsSync(join(projectReferencesDir(CLIENT), 'brief.md'))).toBe(false);
  });

  it('rejects an unknown project type and refuses to clobber an existing project', () => {
    expect(() => initProject({ client: CLIENT, projectType: 'nope' })).toThrow(/unknown project type/i);
    initProject({ client: CLIENT, projectType: 'website' });
    expect(() => initProject({ client: CLIENT, projectType: 'website' })).toThrow(/already exists/i);
  });
});
