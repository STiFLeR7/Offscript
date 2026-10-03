/**
 * P51 — Creative Director drives an explicit Acquisition Plan (not raw gaps). The four production
 * archetypes get proportionate interviews, the plan carries a Creative Strategy, and — because the
 * planning layer is purely upstream — the Canonical Brief is byte-identical for equivalent info.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';

const CLIENTS = ['__p51_startup__', '__p51_bank__', '__p51_kit__', '__p51_complete__', '__p51_cd__', '__p51_ci__'];
afterEach(() => {
  for (const c of CLIENTS) rmSync(projectDir(c), { recursive: true, force: true });
});

describe('P51 strategy-driven Creative Director', () => {
  it('plan() surfaces a Creative Strategy + an explicit question plan (not just raw gaps)', () => {
    const c = '__p51_cd__';
    initProject({ client: c, projectType: 'website' });
    const p = createCreativeDirector().plan({ client: c, projectType: 'website' });
    expect(p.strategy).toBeDefined();
    expect(p.strategy.projectComplexity).toBe('standard');
    expect(p.questionPlan.questions.map((q) => q.field)).toEqual(['one-liner', 'audience', 'must-include']);
    expect(p.questions).toEqual(['one-liner', 'audience', 'must-include']); // backward-compatible view
  });

  it('SIMPLE STARTUP → minimal interview; ENTERPRISE BANKING → structured interview', () => {
    const startup = '__p51_startup__';
    const bank = '__p51_bank__';
    initProject({ client: startup, projectType: 'website' });
    initProject({ client: bank, projectType: 'website' });
    const cd = createCreativeDirector();

    // Same known audience field; only the industry differs.
    const startupPlan = cd.plan({ client: startup, projectType: 'website', answers: { audience: 'Growth teams' } });
    const bankPlan = cd.plan({ client: bank, projectType: 'website', answers: { audience: 'Retail banking customers' } });

    expect(startupPlan.strategy.riskLevel).toBe('low');
    expect(startupPlan.questions).toEqual(['one-liner', 'must-include']); // audience known, no confirmation

    expect(bankPlan.strategy.riskLevel).toBe('high');
    expect(bankPlan.questions).toContain('audience'); // high-risk ⇒ confirm even the known audience
    expect(bankPlan.questions.length).toBeGreaterThan(startupPlan.questions.length); // structured > minimal
    expect(bankPlan.strategy.requiredApprovals.length).toBeGreaterThan(0);
  });

  it('EXISTING BRAND KIT → reduced interview; COMPLETE EVIDENCE → near-zero interview', async () => {
    const kit = '__p51_kit__';
    const complete = '__p51_complete__';
    initProject({ client: kit, projectType: 'website' });
    initProject({ client: complete, projectType: 'website' });
    writeFileSync(join(projectReferencesDir(kit), 'brand-kit.json'), JSON.stringify({ brand: 'Acme', audience: 'Growth teams' }), 'utf8');
    writeFileSync(
      join(projectReferencesDir(complete), 'brief.md'),
      normalizeBrief({ track: 'website', oneLiner: 'Ship fast', audience: 'Growth teams', mustInclude: ['hero', 'footer'] }),
      'utf8',
    );
    const cd = createCreativeDirector();

    const kitPlan = cd.plan({ client: kit, projectType: 'website' });
    expect(kitPlan.questions).toEqual(['one-liner', 'must-include']); // reduced (audience from kit)

    const completePlan = cd.plan({ client: complete, projectType: 'website' });
    expect(completePlan.questions).toEqual([]); // near-zero
    expect(completePlan.ready).toBe(true);
  });

  it('CANONICAL BRIEF UNCHANGED: the planning layer never alters the acquired brief', async () => {
    const c = '__p51_ci__';
    const info = { oneLiner: 'Ship on-brand sites fast', audience: 'Growth teams', mustInclude: ['hero', 'footer'] };
    initProject({ client: c, projectType: 'website' });
    writeFileSync(join(projectReferencesDir(c), 'brand-kit.json'), JSON.stringify(info), 'utf8');
    const discovered = await createCreativeDirector().acquire({ client: c, projectType: 'website' });
    const interviewed = normalizeBrief({ track: 'website', ...info });
    expect(discovered.briefText).toBe(interviewed); // equivalent info ⇒ identical brief, planning notwithstanding
  });
});
