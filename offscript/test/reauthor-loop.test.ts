/**
 * AP-3 — violation-aware re-authoring loop tests (deterministic WIRING proof).
 *
 * The real proof (an LLM artifact improving across passes) is an in-session
 * follow-up that cannot run here. Instead we prove the loop's WIRING with a
 * scripted author DOUBLE whose output differs ONLY when req.priorFindings is
 * non-empty, plus injected validate doubles that control the score progression.
 *
 * Coverage:
 *  (1) mapFindingsToItems — section-attributed findings route to the right item by
 *      DELIMITED anchor-id segment; document-global findings map to no item; a raw
 *      substring (hero vs hero-banner) does NOT mismatch.
 *  (2) authorDocument threads findingsByItem → req.priorFindings (offenders only).
 *  (3) renderAuthorRequest surfaces priorFindings as a "fix, not redesign" block.
 *  (4) runReauthorLoop:
 *      (a) detects sub-target score / escalations and re-dispatches the offending
 *          item WITH its findings populated;
 *      (b) the second pass improves (ratio up / escalations down) → goal-met;
 *      (c) the governance guard REJECTS a "fix" that introduces slop / drift;
 *      (d) the default scripted author stays a 1-pass no-op (identical html →
 *          no-progress guard fires; determinism preserved).
 */

import { describe, it, expect } from 'vitest';
import {
  mapFindingsToItems,
  runReauthorLoop,
  runGenerateGovernance,
  type ValidateOutcome,
  type PerRailEntry,
} from '../src/generate/reauthor-loop.js';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { scriptedAuthor } from '../src/generate/authoring-seam.js';
import type { AuthoringRequest } from '../src/generate/authoring-seam.js';
import type { AuthoringPlan, PlanItem } from '../src/generate/types.js';
import type { Finding, Operator } from '../src/operator.js';
import type { RunScore } from '../src/score.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function planItem(id: string): PlanItem {
  return {
    anchor: { id, anchor: id, landmark: undefined },
    archetype: 'hero',
    tokenRoles: ['--cr-ink'],
    intent: `intent for ${id}`,
  };
}

function makePlan(ids: string[]): AuthoringPlan {
  return { track: 'website', items: ids.map(planItem), warnings: [] };
}

function fakeOperator(name: string): Operator {
  return { name, tier: 1, detect: () => [], apply: () => [] };
}

function perRail(entries: Array<{ op: string; findings: Finding[] }>): PerRailEntry[] {
  return entries.map((e) => ({ operator: fakeOperator(e.op), findings: e.findings }));
}

function makeScore(ratio: number): RunScore {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    subject: 'test',
    buckets: { tier0: 0, tier1: 0, tier2: 0, warnings: 0, total: 0 },
    systematicRatio: ratio,
    railBreakdown: [],
  };
}

function finding(id: string, outcome: Finding['outcome'] = 'escalated'): Finding {
  return { id, description: `desc ${id}`, outcome };
}

// ── (1) mapFindingsToItems ──────────────────────────────────────────────────

describe('mapFindingsToItems — finding → item by delimited anchor segment', () => {
  it('routes a section-attributed finding to the item whose anchor id it embeds', () => {
    const p = makePlan(['hero', 'features', 'footer']);
    const pr = perRail([
      { op: 'landmark-semantics', findings: [finding('landmark-semantics:hero')] },
      { op: 'archetype-tag', findings: [finding('archetype-tag:unresolved-anchor:footer')] },
    ]);
    const map = mapFindingsToItems(pr, p);
    expect([...map.keys()].sort()).toEqual(['footer', 'hero']);
    expect(map.get('hero')!.map((f) => f.id)).toEqual(['landmark-semantics:hero']);
    expect(map.get('footer')!.map((f) => f.id)).toEqual([
      'archetype-tag:unresolved-anchor:footer',
    ]);
  });

  it('drops document-global findings (no embedded anchor id) from the per-item map', () => {
    const p = makePlan(['hero', 'features']);
    const pr = perRail([
      { op: 'brand-fidelity-scan', findings: [finding('brand-fidelity-scan:#ff0000')] },
      { op: 'accent-saturation-budget', findings: [finding('accent-saturation-budget:over')] },
      { op: 'lang-attr', findings: [finding('lang-attr:missing')] },
    ]);
    const map = mapFindingsToItems(pr, p);
    expect(map.size).toBe(0);
  });

  it('matches a delimited segment, NOT a raw substring (hero ≠ hero-banner)', () => {
    const p = makePlan(['hero']);
    const pr = perRail([
      // anchor id is "hero"; this finding targets "hero-banner" → must NOT match.
      { op: 'landmark-semantics', findings: [finding('landmark-semantics:hero-banner')] },
    ]);
    const map = mapFindingsToItems(pr, p);
    expect(map.size).toBe(0);
  });

  it('matches arrow-delimited pair-site ids (adjacency findings)', () => {
    const p = makePlan(['hero', 'features']);
    const pr = perRail([
      {
        op: 'archetype-neighbour-collisions',
        findings: [finding('archetype-neighbour-collisions:collide:hero->features')],
      },
    ]);
    const map = mapFindingsToItems(pr, p);
    // both hero and features are delimited segments → both items get the finding.
    expect([...map.keys()].sort()).toEqual(['features', 'hero']);
  });
});

// ── (2) authorDocument threads findingsByItem → req.priorFindings ────────────

describe('authorDocument — threads per-item findings into priorFindings', () => {
  it('attaches findings only to offending items; clean items get no priorFindings', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const offenderId = p.items[0].anchor.id;

    const seen: Array<{ id: string; priorCount: number }> = [];
    const spy = scriptedAuthor((req: AuthoringRequest) => {
      seen.push({ id: req.item.anchor.id, priorCount: req.priorFindings?.length ?? 0 });
      return `<section id="${req.item.anchor.id}"><h2>x</h2></section>`;
    });

    const findingsByItem = new Map<string, Finding[]>([
      [offenderId, [finding(`landmark-semantics:${offenderId}`)]],
    ]);

    await authorDocument(p, ctx, spy, findingsByItem);

    const offenderSeen = seen.find((s) => s.id === offenderId)!;
    expect(offenderSeen.priorCount).toBe(1);
    // Every other item dispatched with zero priorFindings.
    for (const s of seen.filter((s) => s.id !== offenderId)) {
      expect(s.priorCount).toBe(0);
    }
  });

  it('omits priorFindings entirely when no findingsByItem map is passed', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    let sawUndefined = true;
    const spy = scriptedAuthor((req: AuthoringRequest) => {
      if (req.priorFindings !== undefined) sawUndefined = false;
      return `<section id="${req.item.anchor.id}"><h2>x</h2></section>`;
    });
    await authorDocument(p, ctx, spy);
    expect(sawUndefined).toBe(true);
  });
});

// ── (3) renderAuthorRequest surfaces priorFindings (via request file) ─────────
// The seam writes the rendered brief to <item-id>.request.md (createSubagentAuthor).
// We assert the rendered brief carries a "fix, not redesign" block when findings
// are present, and omits it when absent. We exercise the renderer through
// createSubagentAuthor's request-file write.

describe('renderAuthorRequest — surfaces priorFindings as a fix-not-redesign brief', () => {
  it('renders the rail-findings block + "better, not different" steer when present', async () => {
    const { createSubagentAuthor } = await import('../src/generate/authoring-seam.js');
    const { mkdtempSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const dispatchDir = mkdtempSync(join(tmpdir(), 'offscript-reauthor-req-'));
    const author = createSubagentAuthor({
      dispatchDir,
      dispatch: async () => '<section id="hero"></section>',
    });
    const req: AuthoringRequest = {
      item: planItem('hero'),
      guidance: '',
      oneLiner: 'a thing',
      tone: 'plain',
      priorFindings: [finding('landmark-semantics:hero', 'auto-remediated')],
    };
    await author.author(req);
    const brief = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(brief).toContain('Rail findings to FIX');
    expect(brief).toContain('landmark-semantics:hero');
    expect(brief).toMatch(/better, not different/i);
    expect(brief).toMatch(/without introducing slop/i);
  });

  it('omits the rail-findings block when priorFindings is absent', async () => {
    const { createSubagentAuthor } = await import('../src/generate/authoring-seam.js');
    const { mkdtempSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const dispatchDir = mkdtempSync(join(tmpdir(), 'offscript-reauthor-req2-'));
    const author = createSubagentAuthor({
      dispatchDir,
      dispatch: async () => '<section id="hero"></section>',
    });
    await author.author({
      item: planItem('hero'),
      guidance: '',
      oneLiner: 'a thing',
      tone: 'plain',
    });
    const brief = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(brief).not.toContain('Rail findings to FIX');
  });
});

// ── (4) runReauthorLoop — the loop wiring ─────────────────────────────────────

describe('runReauthorLoop — detects, re-dispatches with findings, improves', () => {
  it('re-authors the offender WITH findings and converges when pass 2 clears', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = makePlan(['hero', 'features']);

    // Validate double: pass 1 sub-target with an escalated landmark finding on
    // hero; once the author has "fixed" hero (it emits clean html), pass 2 is clean.
    let validateCall = 0;
    const validate = async (html: string): Promise<ValidateOutcome> => {
      validateCall += 1;
      const fixed = html.includes('data-fixed="hero"');
      if (fixed) {
        return { score: makeScore(0.95), frozen: [], perRail: perRail([]) };
      }
      return {
        score: makeScore(0.5),
        frozen: [{ overlayPath: '/x', frozenId: 'f1', findingIds: ['landmark-semantics:hero'] }],
        perRail: perRail([
          { op: 'landmark-semantics', findings: [finding('landmark-semantics:hero')] },
        ]),
      };
    };

    // Author double: only "fixes" hero when its priorFindings are populated.
    const dispatched: Array<{ offenders: string[]; heroPriorCount: number }> = [];
    const author = async (findingsByItem?: Map<string, Finding[]>) => {
      const heroPrior = findingsByItem?.get('hero') ?? [];
      dispatched.push({
        offenders: findingsByItem ? [...findingsByItem.keys()] : [],
        heroPriorCount: heroPrior.length,
      });
      // var()-only, no off-token colour, keeps both sections → no slop / no drift.
      const heroAttr = heroPrior.length > 0 ? ' data-fixed="hero"' : '';
      const html =
        `<main><section id="hero"${heroAttr} style="color:var(--cr-ink)"><h2>h</h2></section>` +
        `<section id="features" style="color:var(--cr-ink)"><h2>f</h2></section></main>`;
      return { html, warnings: [] };
    };

    const initialHtml =
      `<main><section id="hero" style="color:var(--cr-ink)"><h2>h</h2></section>` +
      `<section id="features" style="color:var(--cr-ink)"><h2>f</h2></section></main>`;

    const result = await runReauthorLoop({
      initialHtml,
      plan: p,
      context: ctx,
      author,
      validate,
      targetRatio: 0.8,
      maxPasses: 2,
    });

    // (a) it detected the sub-target + re-dispatched WITH findings on the offender.
    expect(dispatched.length).toBe(1);
    expect(dispatched[0].offenders).toEqual(['hero']);
    expect(dispatched[0].heroPriorCount).toBe(1);
    // (b) pass 2 improved → goal met.
    expect(result.stoppedBy).toBe('goal-met');
    expect(result.passes).toBe(2);
    expect(result.finalOutcome.score.systematicRatio).toBeGreaterThanOrEqual(0.8);
    expect(result.finalOutcome.frozen.length).toBe(0);
    expect(validateCall).toBe(2);
  });

  it('(b2) stops at max-passes when re-authors keep improving the doc but never hit target', async () => {
    // The primary long-run termination path once the LLM author lands: every pass
    // produces a DISTINCT, in-bounds candidate (no no-progress, no guard reject),
    // but validate never reaches the target → the loop runs to MAX_PASSES.
    const ctx = buildContext('example-brand', 'website');
    const p = makePlan(['hero']);
    const maxPasses = 4;

    // Always sub-target (ratio < target), never frozen.
    const validate = async (): Promise<ValidateOutcome> => ({
      score: makeScore(0.5),
      frozen: [],
      perRail: perRail([
        { op: 'landmark-semantics', findings: [finding('landmark-semantics:hero')] },
      ]),
    });

    // Distinct, in-bounds html every call (a monotonic counter in a comment keeps
    // each candidate byte-unique so the no-progress guard never fires; var()-only
    // and the same single section so the governance guard stays in bounds).
    let n = 0;
    const author = async () => {
      n += 1;
      return {
        html:
          `<main><!--pass ${n}--><section id="hero" style="color:var(--cr-ink)">` +
          `<h2>h</h2></section></main>`,
        warnings: [],
      };
    };

    const initialHtml =
      `<main><!--pass 0--><section id="hero" style="color:var(--cr-ink)"><h2>h</h2></section></main>`;

    const result = await runReauthorLoop({
      initialHtml,
      plan: p,
      context: ctx,
      author,
      validate,
      targetRatio: 0.8,
      maxPasses,
    });

    expect(result.stoppedBy).toBe('max-passes');
    expect(result.passes).toBe(maxPasses);
  });

  it('(c) governance guard REJECTS a re-author that introduces slop', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = makePlan(['hero']);

    // Always sub-target so the loop tries to re-author.
    const validate = async (): Promise<ValidateOutcome> => ({
      score: makeScore(0.4),
      frozen: [],
      perRail: perRail([
        { op: 'landmark-semantics', findings: [finding('landmark-semantics:hero')] },
      ]),
    });

    // Author "fixes" the finding but smuggles a generic stock-semantic off-token
    // colour (#ff0000) into an inline style — a slop tell antiSlopGovernance catches.
    const author = async () => ({
      html: `<main><section id="hero" style="color:#ff0000"><h2>h</h2></section></main>`,
      warnings: [],
    });

    const initialHtml = `<main><section id="hero" style="color:var(--cr-ink)"><h2>h</h2></section></main>`;

    const result = await runReauthorLoop({
      initialHtml,
      plan: p,
      context: ctx,
      author,
      validate,
      targetRatio: 0.8,
      maxPasses: 3,
    });

    // The candidate is rejected; the prior (clean) html is kept.
    expect(result.stoppedBy).toBe('guard-rejected');
    expect(result.html).toBe(initialHtml);
  });

  it('(c2) governance guard REJECTS a re-author that drops a section (drift)', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = makePlan(['hero', 'features']);

    const validate = async (): Promise<ValidateOutcome> => ({
      score: makeScore(0.4),
      frozen: [],
      perRail: perRail([
        { op: 'landmark-semantics', findings: [finding('landmark-semantics:hero')] },
      ]),
    });

    // Author drops the features <section> entirely (section count 2 → 1) — drift.
    const author = async () => ({
      html: `<main><section id="hero" style="color:var(--cr-ink)"><h2>h</h2></section></main>`,
      warnings: [],
    });

    const initialHtml =
      `<main><section id="hero" style="color:var(--cr-ink)"><h2>h</h2></section>` +
      `<section id="features" style="color:var(--cr-ink)"><h2>f</h2></section></main>`;

    const result = await runReauthorLoop({
      initialHtml,
      plan: p,
      context: ctx,
      author,
      validate,
      targetRatio: 0.8,
      maxPasses: 3,
    });

    expect(result.stoppedBy).toBe('guard-rejected');
    expect(result.html).toBe(initialHtml);
  });

  it('(d) the DEFAULT scripted author stays a deterministic 1-pass no-op', async () => {
    // Real example-brand context + the real default scripted author through the real
    // authorDocument → byte-identical re-author → no-progress guard fires in 1 pass.
    const { defaultScriptedAuthor } = await import('../src/generate/authoring-seam.js');
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const scripted = defaultScriptedAuthor();

    const author = (findingsByItem?: Map<string, Finding[]>) =>
      authorDocument(p, ctx, scripted, findingsByItem);

    const { html: initialHtml } = await author();

    // Validate double: always sub-target with a section-attributed finding, so the
    // loop WANTS to re-author — only the no-progress guard can stop it.
    const offenderId = p.items[0].anchor.id;
    const validate = async (): Promise<ValidateOutcome> => ({
      score: makeScore(0.57),
      frozen: [],
      perRail: perRail([
        { op: 'landmark-semantics', findings: [finding(`landmark-semantics:${offenderId}`)] },
      ]),
    });

    const result = await runReauthorLoop({
      initialHtml,
      plan: p,
      context: ctx,
      author,
      validate,
      targetRatio: 0.8,
      maxPasses: 2,
    });

    expect(result.stoppedBy).toBe('no-progress');
    expect(result.passes).toBe(1);
    expect(result.html).toBe(initialHtml);
  });
});

// ── runGenerateGovernance — direct guard sanity ───────────────────────────────

describe('runGenerateGovernance — in-bounds vs out-of-bounds', () => {
  it('var()-only, same-structure candidate is in bounds', () => {
    const ctx = buildContext('example-brand', 'website');
    const prior = `<main><section id="a" style="color:var(--cr-ink)"></section></main>`;
    const cand = `<main><section id="a" style="color:var(--cr-ink)"><p>more</p></section></main>`;
    const gov = runGenerateGovernance(cand, prior, ctx);
    expect(gov.inBounds).toBe(true);
  });

  it('a candidate that introduces an off-token stock colour is out of bounds (slop)', () => {
    const ctx = buildContext('example-brand', 'website');
    const prior = `<main><section id="a" style="color:var(--cr-ink)"></section></main>`;
    const cand = `<main><section id="a" style="color:#ff0000"></section></main>`;
    const gov = runGenerateGovernance(cand, prior, ctx);
    expect(gov.inBounds).toBe(false);
    expect(gov.slop.length).toBeGreaterThan(0);
  });
});
