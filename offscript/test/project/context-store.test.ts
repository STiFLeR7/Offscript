/**
 * P52 — Context persistence + history retrieval + the reuse bridge. The context is stored as an
 * append-only session log (context.json), reloaded by reconstruction, and a discovery provider
 * surfaces prior confirmed facts as evidence so future sessions build on previous ones.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { getProjectType } from '../../src/project/project-registry.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import {
  loadProjectContext,
  recordProjectSession,
  recordAcquisition,
  projectContextPath,
} from '../../src/project/context-store.js';
import { projectContextProvider } from '../../src/project/discovery-providers.js';

const CLIENT = '__p52_store__';
const T1 = '2026-01-01T00:00:00Z';
const T2 = '2026-01-02T00:00:00Z';
const T3 = '2026-01-03T00:00:00Z';
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));

describe('P52 context store', () => {
  it('a fresh project loads an empty (version 0) context from its manifest identity', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    const c = loadProjectContext(CLIENT);
    expect(c.version).toBe(0);
    expect(c.identity.projectType).toBe('website');
    expect(c.identity.deliverables).toEqual(['website']);
  });

  it('recordProjectSession persists to context.json; reloading RECONSTRUCTS the identical context', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    const c1 = recordProjectSession(CLIENT, { goal: 'acquire', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }, T1);
    expect(c1.version).toBe(1);
    expect(existsSync(projectContextPath(CLIENT))).toBe(true);
    expect(loadProjectContext(CLIENT)).toEqual(c1); // reload == in-memory
  });

  it('multiple sessions accumulate deterministically and survive a reload', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    recordProjectSession(CLIENT, { goal: 's1', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }, T1);
    recordProjectSession(CLIENT, { goal: 's2', decisions: [{ kind: 'confirmed', subject: 'brand', to: 'Acme' }] }, T2);
    const c3 = recordProjectSession(CLIENT, { goal: 's3', decisions: [{ kind: 'changed', subject: 'audience', from: 'Devs', to: 'Ops' }] }, T3);
    expect(c3.version).toBe(3);
    expect(c3.sessions.map((s) => s.ordinal)).toEqual([1, 2, 3]);
    expect(c3.confirmedFacts.audience.value).toBe('Ops');
    expect(c3.confirmedFacts.brand.value).toBe('Acme');
    expect(loadProjectContext(CLIENT)).toEqual(c3);
  });

  it('recordAcquisition turns an acquired brief into confirmed-fact decisions', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    const briefText = normalizeBrief({ track: 'website', oneLiner: 'Ship fast', audience: 'Devs', mustInclude: ['hero'] });
    const { context } = recordAcquisition({ client: CLIENT, briefText, answers: {}, now: T1 });
    expect(context.confirmedFacts['one-liner'].value).toBe('Ship fast');
    expect(context.confirmedFacts.audience.value).toBe('Devs');
    expect(context.confirmedFacts['must-include'].value).toEqual(['hero']);
  });

  it('the project-context discovery provider surfaces prior confirmed facts as evidence', () => {
    initProject({ client: CLIENT, projectType: 'website' });
    recordProjectSession(CLIENT, { goal: 'acquire', decisions: [{ kind: 'confirmed', subject: 'audience', to: 'Devs' }] }, T1);
    const evs = projectContextProvider().discover({ client: CLIENT, projectType: getProjectType('website'), track: 'website', now: T1 });
    const aud = evs.find((e) => e.field === 'audience');
    expect(aud).toBeDefined();
    expect(aud!.value).toBe('Devs');
    expect(aud!.source).toBe('project-context');
    expect(aud!.confidence).toBeGreaterThanOrEqual(0.7);
  });
});
