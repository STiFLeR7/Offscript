/**
 * P50 — Creative Director becomes evidence-driven. The interview is the LAST step: discovery →
 * evidence → inference → gap analysis → questions. Three production scenarios (no / partial /
 * complete context) yield full / reduced / zero questions, all producing valid Canonical Briefs —
 * and equivalent information yields a BYTE-IDENTICAL brief whether it was discovered or interviewed.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../../src/paths.js';
import { initProject } from '../../src/project/workspace.js';
import { normalizeBrief } from '../../src/project/brief-normalizer.js';
import { loadBrief, parseBrief } from '../../src/generate/brief.js';
import { createCreativeDirector } from '../../src/project/creative-director.js';

const CLIENTS = ['__p50_none__', '__p50_partial__', '__p50_complete__', '__p50_conv_disc__', '__p50_conv_int__', '__p50_down__'];
afterEach(() => {
  for (const c of CLIENTS) rmSync(projectDir(c), { recursive: true, force: true });
});

describe('P50 evidence-driven Creative Director', () => {
  it('NO context ⇒ FULL interview (every required field asked)', () => {
    const c = '__p50_none__';
    initProject({ client: c, projectType: 'website' });
    const cd = createCreativeDirector();
    const plan = cd.plan({ client: c, projectType: 'website' });
    expect(plan.questions).toEqual(['one-liner', 'audience', 'must-include']);
    expect(plan.ready).toBe(false);
  });

  it('PARTIAL context (a brand kit) ⇒ REDUCED interview (already-known fields not re-asked)', () => {
    const c = '__p50_partial__';
    initProject({ client: c, projectType: 'website' });
    writeFileSync(
      join(projectReferencesDir(c), 'brand-kit.json'),
      JSON.stringify({ brand: 'Acme', audience: 'Growth teams' }),
      'utf8',
    );
    const cd = createCreativeDirector();
    const plan = cd.plan({ client: c, projectType: 'website' });
    // audience is evidenced by the brand kit ⇒ only the still-unknown fields remain
    expect(plan.questions).toEqual(['one-liner', 'must-include']);
    expect(plan.ready).toBe(false);
  });

  it('COMPLETE context (a prior brief) ⇒ ZERO questions, and acquires a valid brief with no interview', async () => {
    const c = '__p50_complete__';
    initProject({ client: c, projectType: 'website' });
    writeFileSync(
      join(projectReferencesDir(c), 'brief.md'),
      normalizeBrief({ track: 'website', oneLiner: 'Ship on-brand sites fast', audience: 'Growth teams', mustInclude: ['hero', 'features', 'footer'] }),
      'utf8',
    );
    const cd = createCreativeDirector();
    const plan = cd.plan({ client: c, projectType: 'website' });
    expect(plan.questions).toEqual([]);
    expect(plan.ready).toBe(true);
    // no answers supplied — discovery alone produces the brief
    const result = await cd.acquire({ client: c, projectType: 'website' });
    const b = parseBrief(result.briefText);
    expect(b.oneLiner).toBe('Ship on-brand sites fast');
    expect(b.audience).toBe('Growth teams');
    expect(b.mustInclude).toEqual(['hero', 'features', 'footer']);
  });

  it('CANONICAL BRIEF UNCHANGED: discovered facts and interviewed answers converge byte-identically', async () => {
    const info = { oneLiner: 'Ship on-brand sites fast', audience: 'Growth teams', mustInclude: ['hero', 'features', 'footer'] };

    // (a) DISCOVERED: a brand kit carries the info; no interview answers at all.
    const discClient = '__p50_conv_disc__';
    initProject({ client: discClient, projectType: 'website' });
    writeFileSync(join(projectReferencesDir(discClient), 'brand-kit.json'), JSON.stringify(info), 'utf8');
    const discovered = await createCreativeDirector().acquire({ client: discClient, projectType: 'website' });

    // (b) INTERVIEWED: the same info arrives as interview answers, no context on disk.
    const intClient = '__p50_conv_int__';
    initProject({ client: intClient, projectType: 'website' });
    const interviewed = await createCreativeDirector().acquire({ client: intClient, projectType: 'website', answers: info });

    expect(discovered.briefText).toBe(interviewed.briefText); // the generator can never tell them apart
  });

  it('DOWNSTREAM UNCHANGED: an evidence-acquired brief is consumed by the unchanged loadBrief', async () => {
    const c = '__p50_down__';
    initProject({ client: c, projectType: 'website' });
    writeFileSync(join(projectReferencesDir(c), 'brand-kit.json'), JSON.stringify({ audience: 'Devs' }), 'utf8');
    const cd = createCreativeDirector();
    // audience discovered; the rest arrive as interview answers for the remaining gaps
    const result = await cd.acquire({ client: c, projectType: 'website', answers: { oneLiner: 'X', mustInclude: ['hero'] } });
    writeFileSync(join(projectReferencesDir(c), 'brief.md'), result.briefText, 'utf8');
    const b = loadBrief(c);
    expect(b.oneLiner).toBe('X');
    expect(b.audience).toBe('Devs'); // backfilled from discovery, not asked
    expect(b.mustInclude).toEqual(['hero']);
  });
});
