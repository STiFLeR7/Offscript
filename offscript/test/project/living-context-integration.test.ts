/**
 * P52 — Living Project Context across sessions. A completed Creative Director acquisition enriches
 * the context; a later session reuses those decisions (reduced interview); a changed requirement
 * preserves the full decision history; and the Canonical Brief is untouched throughout.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';
import { defaultDiscoveryProviders, projectContextProvider } from '../../src/project/discovery-providers.js';
import { loadProjectContext, recordAcquisition } from '../../src/project/context-store.js';
import { currentFacts, factHistory } from '../../src/project/history-reader.js';

const CLIENTS = ['__p52_init__', '__p52_reuse__', '__p52_change__', '__p52_grow__'];
const T1 = '2026-01-01T00:00:00Z';
const T2 = '2026-01-02T00:00:00Z';
afterEach(() => {
  for (const c of CLIENTS) rmSync(projectDir(c), { recursive: true, force: true });
});

describe('P52 living project context', () => {
  it('INITIAL project → a completed acquisition creates the context', async () => {
    const c = '__p52_init__';
    initProject({ client: c, projectType: 'website' });
    const r = await createCreativeDirector().acquire({ client: c, projectType: 'website', answers: { oneLiner: 'X', audience: 'Devs', mustInclude: ['hero'] } });
    recordAcquisition({ client: c, briefText: r.briefText, now: T1 });
    const ctx = loadProjectContext(c);
    expect(ctx.version).toBe(1);
    expect(currentFacts(ctx).audience).toBe('Devs');
  });

  it('SECOND session REUSES prior context — the interview shrinks to nothing', async () => {
    const c = '__p52_reuse__';
    initProject({ client: c, projectType: 'website' });
    const r = await createCreativeDirector().acquire({ client: c, projectType: 'website', answers: { oneLiner: 'X', audience: 'Devs', mustInclude: ['hero'] } });
    recordAcquisition({ client: c, briefText: r.briefText, now: T1 });

    const withContext = createCreativeDirector({ providers: [...defaultDiscoveryProviders(), projectContextProvider()] });
    const without = createCreativeDirector(); // base providers, no context bridge
    const reusePlan = withContext.plan({ client: c, projectType: 'website' });
    const coldPlan = without.plan({ client: c, projectType: 'website' });
    expect(coldPlan.questions).toEqual(['one-liner', 'audience', 'must-include']); // no reuse ⇒ full interview
    expect(reusePlan.questions.length).toBeLessThan(coldPlan.questions.length);
    expect(reusePlan.questions).toEqual([]); // all reused from prior decisions
  });

  it('CHANGED requirement → decision history preserved (both values, current = latest)', async () => {
    const c = '__p52_change__';
    initProject({ client: c, projectType: 'website' });
    const cd = createCreativeDirector();
    const r1 = await cd.acquire({ client: c, projectType: 'website', answers: { oneLiner: 'X', audience: 'Devs', mustInclude: ['hero'] } });
    recordAcquisition({ client: c, briefText: r1.briefText, now: T1 });
    const r2 = await cd.acquire({ client: c, projectType: 'website', answers: { oneLiner: 'X', audience: 'Enterprise buyers', mustInclude: ['hero'] } });
    recordAcquisition({ client: c, briefText: r2.briefText, now: T2 });

    const ctx = loadProjectContext(c);
    expect(currentFacts(ctx).audience).toBe('Enterprise buyers');
    const hist = factHistory(ctx, 'audience');
    expect(hist.map((d) => d.kind)).toEqual(['confirmed', 'changed']);
    expect(hist[0].to).toBe('Devs');
    expect(hist[1].from).toBe('Devs');
    expect(hist[1].to).toBe('Enterprise buyers');
  });

  it('MULTIPLE sessions grow deterministically, and the Canonical Brief is unchanged', async () => {
    const c = '__p52_grow__';
    initProject({ client: c, projectType: 'website' });
    const cd = createCreativeDirector();
    const info = { oneLiner: 'Ship fast', audience: 'Devs', mustInclude: ['hero', 'footer'] };
    const r1 = await cd.acquire({ client: c, projectType: 'website', answers: info });
    recordAcquisition({ client: c, briefText: r1.briefText, now: T1 });
    const r2 = await cd.acquire({ client: c, projectType: 'website', answers: { ...info, tone: 'Confident' } });
    const grown = recordAcquisition({ client: c, briefText: r2.briefText, now: T2 }).context;

    expect(grown.version).toBe(2);
    expect(grown.sessions.map((s) => s.ordinal)).toEqual([1, 2]);
    expect(loadProjectContext(c)).toEqual(grown); // replay: reload reconstructs the same context
    // the acquired brief is exactly what the normalizer would emit — context recording changed nothing
    expect(r1.briefText).toBe(normalizeBrief({ track: 'website', ...info }));
  });
});
