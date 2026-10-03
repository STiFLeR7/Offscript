/**
 * P54 — Project Readiness Gate at the end of the Project Platform:
 *   … → Workflow Plan → Project Readiness Assessment → (Generation, downstream & unchanged)
 *
 * The five production archetypes get explicit, self-explaining readiness states from a real Creative
 * Director plan (P51) + Workflow Plan (P53) + Living Project Context (P52); admission is an explicit
 * decision; and the Canonical Brief is untouched.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';
import { recordProjectSession, loadProjectContext } from '../../src/project/context-store.js';
import { evaluateReadinessFor } from '../../src/project/readiness-evaluator.js';
import type { SessionInput } from '../../src/project/project-context.js';

const CLIENTS = ['__p54_simple__', '__p54_ent__', '__p54_info__', '__p54_blocked__', '__p54_done__', '__p54_brief__'];
const T = '2026-01-01T00:00:00Z';
afterEach(() => {
  for (const c of CLIENTS) rmSync(projectDir(c), { recursive: true, force: true });
});

/** Init a project and fold one authored session into its persisted living context. */
function seed(client: string, projectType: string, session: SessionInput) {
  initProject({ client, projectType });
  recordProjectSession(client, session, T);
  return loadProjectContext(client);
}

const withDecisions = (goal: string, decisions: SessionInput['decisions'], artifacts?: string[]): SessionInput => ({ goal, decisions, artifacts });

describe('P54 project readiness & generation admission', () => {
  it('SIMPLE project → READY (admitted)', () => {
    const c = '__p54_simple__';
    const ctx = seed(c, 'website', withDecisions('prep', [
      { kind: 'confirmed', subject: 'brand', to: 'Acme' },
      { kind: 'confirmed', subject: 'audience', to: 'Growth teams' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' },
      { kind: 'asset', subject: 'logo.svg' },
    ]));
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: { audience: 'Growth teams' } });
    const a = evaluateReadinessFor(acq, { context: ctx });
    expect(a.state).toBe('READY');
    expect(a.admission.admitted).toBe(true);
  });

  it('ENTERPRISE project → WAITING_FOR_APPROVAL', () => {
    const c = '__p54_ent__';
    const ctx = seed(c, 'website', withDecisions('prep', [
      { kind: 'confirmed', subject: 'brand', to: 'BigBank' },
      { kind: 'confirmed', subject: 'audience', to: 'Retail banking customers' },
      { kind: 'confirmed', subject: 'tone', to: 'Trusted' },
      { kind: 'asset', subject: 'logo.svg' },
    ]));
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: { audience: 'Retail banking customers' } });
    expect(acq.strategy.riskLevel).toBe('high');
    const a = evaluateReadinessFor(acq, { context: ctx });
    expect(a.state).toBe('WAITING_FOR_APPROVAL');
    expect(a.admission.admitted).toBe(false);
    expect(a.blockers.some((b) => b.category === 'approval')).toBe(true);
  });

  it('MISSING BRAND KIT → WAITING_FOR_INFORMATION', () => {
    const c = '__p54_info__';
    const ctx = seed(c, 'website', withDecisions('prep', [{ kind: 'confirmed', subject: 'audience', to: 'Growth teams' }]));
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: { audience: 'Growth teams' } });
    const a = evaluateReadinessFor(acq, { context: ctx });
    expect(a.state).toBe('WAITING_FOR_INFORMATION');
    expect(a.blockers.some((b) => b.category === 'asset' || b.category === 'evidence')).toBe(true);
  });

  it('BLOCKED dependency (rejected, unresolved decision) → BLOCKED', () => {
    const c = '__p54_blocked__';
    const ctx = seed(c, 'website', withDecisions('prep', [
      { kind: 'confirmed', subject: 'brand', to: 'Acme' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' },
      { kind: 'asset', subject: 'logo.svg' },
      { kind: 'rejected', subject: 'audience' },
    ]));
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: {} });
    const a = evaluateReadinessFor(acq, { context: ctx });
    expect(a.state).toBe('BLOCKED');
    expect(a.blockers.some((b) => b.severity === 'critical')).toBe(true);
  });

  it('PREVIOUSLY COMPLETED project → READY immediately', () => {
    const c = '__p54_done__';
    const ctx = seed(c, 'website', withDecisions('prior build', [
      { kind: 'confirmed', subject: 'brand', to: 'Acme' },
      { kind: 'confirmed', subject: 'audience', to: 'Devs' },
      { kind: 'confirmed', subject: 'tone', to: 'Confident' },
      { kind: 'asset', subject: 'logo.svg' },
    ], ['website.html']));
    const acq = createCreativeDirector().plan({ client: c, projectType: 'website', answers: { audience: 'Devs' } });
    const a = evaluateReadinessFor(acq, { context: ctx });
    expect(a.state).toBe('READY');
    expect(a.admission.admitted).toBe(true);
  });

  it('the Canonical Brief is untouched: readiness is a downstream evaluation, not a mutation', async () => {
    const c = '__p54_brief__';
    const info = { oneLiner: 'Ship on-brand sites fast', audience: 'Growth teams', mustInclude: ['hero', 'footer'] };
    initProject({ client: c, projectType: 'website' });
    const r = await createCreativeDirector().acquire({ client: c, projectType: 'website', answers: info });
    evaluateReadinessFor(createCreativeDirector().plan({ client: c, projectType: 'website', answers: info }));
    expect(r.briefText).toBe(normalizeBrief({ track: 'website', ...info }));
  });
});
