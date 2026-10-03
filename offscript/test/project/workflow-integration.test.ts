/**
 * P53 — Creative Workflow Plan at the end of the lifecycle:
 *   … → Living Project Context → Creative Workflow Plan → (Generation, downstream & unchanged)
 *
 * A real Creative Director plan (P51 strategy) + the Living Project Context (P52) drive an explicit,
 * validated, deterministic Workflow Plan. The four production archetypes get proportionate workflows,
 * and the workflow layer never touches the Canonical Brief.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';
import { recordAcquisition, loadProjectContext } from '../../src/project/context-store.js';
import { workflowFromAcquisition } from '../../src/project/workflow-planner.js';
import { validateWorkflow } from '../../src/project/workflow.js';

const CLIENTS = ['__p53_simple__', '__p53_ent__', '__p53_multi__', '__p53_ctx__', '__p53_brief__'];
afterEach(() => {
  for (const c of CLIENTS) rmSync(projectDir(c), { recursive: true, force: true });
});

describe('P53 creative workflow planning', () => {
  it('SIMPLE WEBSITE → minimal, valid workflow (no stakeholder/approval tasks)', () => {
    const c = '__p53_simple__';
    initProject({ client: c, projectType: 'website' });
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: { audience: 'Growth teams' } });
    const wf = workflowFromAcquisition(acq);
    expect(wf.tasks.some((t) => t.id === 'generate-website')).toBe(true);
    expect(wf.tasks.some((t) => t.id === 'stakeholder-review')).toBe(false);
    expect(wf.tasks.some((t) => t.id.startsWith('approval-'))).toBe(false);
    expect(validateWorkflow(wf).valid).toBe(true);
  });

  it('ENTERPRISE WEBSITE → expanded workflow (stakeholder + approval, longer critical path)', () => {
    const simpleC = '__p53_simple__';
    const c = '__p53_ent__';
    initProject({ client: simpleC, projectType: 'website' });
    initProject({ client: c, projectType: 'website' });
    const simple = workflowFromAcquisition(createCreativeDirector().plan({ client: simpleC, projectType: 'website', answers: { audience: 'Growth teams' } }));
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: { audience: 'Retail banking customers' } });
    expect(acq.strategy.riskLevel).toBe('high');
    const ent = workflowFromAcquisition(acq);
    expect(ent.tasks.some((t) => t.id === 'stakeholder-review')).toBe(true);
    expect(ent.tasks.some((t) => t.id.startsWith('approval-'))).toBe(true);
    expect(ent.tasks.length).toBeGreaterThan(simple.tasks.length);
    expect(ent.analysis.criticalPath.length).toBeGreaterThan(simple.analysis.criticalPath.length);
    expect(validateWorkflow(ent).valid).toBe(true);
  });

  it('WEBSITE + COLLATERAL → cross-deliverable dependency', () => {
    const c = '__p53_multi__';
    initProject({ client: c, projectType: 'full-brand-package' });
    const acq = createCreativeDirector().plan({ client: c, projectType: 'full-brand-package', answers: { audience: 'Buyers', brand: 'Acme' } });
    const wf = workflowFromAcquisition(acq);
    const collateral = wf.tasks.find((t) => t.id === 'prepare-collateral')!;
    expect(collateral.dependsOn).toContain('generate-website');
    expect(validateWorkflow(wf).valid).toBe(true);
  });

  it('EXISTING CONTEXT → reduced workflow (prior work marked complete)', async () => {
    const c = '__p53_ctx__';
    initProject({ client: c, projectType: 'website' });
    const cd = createCreativeDirector();
    const answers = { oneLiner: 'Ship fast', audience: 'Devs', brand: 'Acme', mustInclude: ['hero', 'footer'] };
    const r = await cd.acquire({ client: c, projectType: 'website', answers });
    recordAcquisition({ client: c, briefText: r.briefText, answers, now: '2026-01-01T00:00:00Z', artifacts: ['website.html'] });

    const cold = workflowFromAcquisition(cd.plan({ client: c, projectType: 'website', answers }));
    const warm = workflowFromAcquisition(cd.plan({ client: c, projectType: 'website', answers }), { context: loadProjectContext(c) });
    const done = new Set(warm.analysis.completed);
    expect(done.has('review-brand-kit')).toBe(true);
    expect(done.has('confirm-audience')).toBe(true);
    expect(done.has('generate-website')).toBe(true);
    expect(warm.analysis.completed.length).toBeGreaterThan(cold.analysis.completed.length);
    expect(warm.version).toBe(loadProjectContext(c).version);
    expect(validateWorkflow(warm).valid).toBe(true);
  });

  it('the Canonical Brief is untouched: the workflow layer is downstream and pure', async () => {
    const c = '__p53_brief__';
    const info = { oneLiner: 'Ship on-brand sites fast', audience: 'Growth teams', mustInclude: ['hero', 'footer'] };
    initProject({ client: c, projectType: 'website' });
    const r = await createCreativeDirector().acquire({ client: c, projectType: 'website', answers: info });
    workflowFromAcquisition(createCreativeDirector().plan({ client: c, projectType: 'website', answers: info }));
    expect(r.briefText).toBe(normalizeBrief({ track: 'website', ...info })); // brief unchanged by workflow planning
  });
});
