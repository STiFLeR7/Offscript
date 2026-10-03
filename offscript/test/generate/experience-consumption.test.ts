/**
 * Sprint W11 — Experience Character Model Consumption (the seventh and FINAL governance consumer).
 *
 * Experience Character governs HOW the overall experience should BEHAVE — not what components exist,
 * where they appear, or how they are rendered. The World-B planner consumes ONLY the World-A
 * `experienceCharacter` Model and APPEND-only enriches every PlanItem's reasoning with behavioural /
 * experiential intent. It carries intent only — it NEVER changes selection, ordering, layout,
 * realization, prompts, copy, or HTML; never overwrites role / orderingRationale / transition; never
 * consumes another Model. No model / empty model → byte-identical.
 *
 * Category mapping (all 8 authored MODEL_SCHEMA.experienceCharacter keys, §21, are consumed):
 *   experienceCharacter (§8) + creativePrinciples (§9) + decisionFilters (§12) → communicationObjective (append)
 *   behaviouralIdentity (§10) + creativeConstraints (§13) + creativeOpportunities (§14)
 *     + validationPrinciples (§15)                                              → selectionRationale (append)
 *   embodiment (§11)                                                            → relationships (append)
 *   (Constitution BRAND_EXPRESSION.md §21 and MODEL_SCHEMA agree — no divergence. validationPrinciples
 *   is not in the sprint's "suggested ownership"; it is mapped to selectionRationale to avoid orphaning.)
 */
import { describe, it, expect } from 'vitest';
import {
  applyExperience,
  type ExperienceConsumptionOpts,
} from '../../src/generate/reasoning/experience-consumption.js';
import { verifyExperienceConsumption } from '../../src/generate/reasoning/verify-experience-consumption.js';
import { enrichPlanWithInformation } from '../../src/generate/reasoning/information-consumption.js';
import { applyProgression } from '../../src/generate/reasoning/progression-consumption.js';
import { applyMechanism } from '../../src/generate/reasoning/mechanism-consumption.js';
import { applyCommunication } from '../../src/generate/reasoning/communication-consumption.js';
import { applySpatial } from '../../src/generate/reasoning/spatial-consumption.js';
import { applyVisual } from '../../src/generate/reasoning/visual-consumption.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type RawBrief, type GovernedModel, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

// ── World-A model fixtures ───────────────────────────────────────────────────────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
const opts: ExperienceConsumptionOpts = { repositoryIdentity: REPO_ID };
function rawBrief(over: Partial<RawBrief> = {}): RawBrief {
  return { brand: 'Example Brand', oneLiner: 'synthetic', audience: 'ops', goals: ['g'], mustInclude: ['hero'], tone: 'confident', successCriteria: ['book a demo'], body: 'b', ...over };
}
const APA_BRIEF = rawBrief({ oneLiner: 'Autonomous digital workers remove the manual glue between the systems operations teams already run — without replacing the software.' });
function draftsFor(kind: ModelKind, cats: Record<string, unknown>): ModelDraft[] {
  return MODEL_KINDS.map((k) => ({
    kind: k,
    categories: Object.fromEntries(MODEL_SCHEMA[k].categories.map((c) => [c.key, k === kind ? (cats[c.key] ?? null) : null])),
    rationale: 'test',
  }));
}
async function buildSet(experience: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(draftsFor('experienceCharacter', experience)));
}
async function expModel(experience: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'experienceCharacter'>> {
  return (await buildSet(experience, b)).models.experienceCharacter;
}
async function infoModelFor(info: Record<string, unknown>): Promise<GovernedModel<'information'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('information', info)))).models.information;
}
async function progModelFor(progression: Record<string, unknown>): Promise<GovernedModel<'progression'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('progression', progression)))).models.progression;
}
async function mechModelFor(mechanism: Record<string, unknown>): Promise<GovernedModel<'mechanism'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('mechanism', mechanism)))).models.mechanism;
}
async function commModelFor(communication: Record<string, unknown>): Promise<GovernedModel<'communication'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('communication', communication)))).models.communication;
}
async function spatialModelFor(spatial: Record<string, unknown>): Promise<GovernedModel<'spatial'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('spatial', spatial)))).models.spatial;
}
async function visualModelFor(visual: Record<string, unknown>): Promise<GovernedModel<'visual'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('visual', visual)))).models.visual;
}

// ── plan fixtures ────────────────────────────────────────────────────────────────
function planOf(ids: string[]): AuthoringPlan {
  return {
    track: 'website',
    items: ids.map((id) => ({ anchor: { id, anchor: id }, archetype: 'hero', tokenRoles: ['--cr-bg'], intent: id })) as PlanItem[],
    warnings: [],
  };
}
const IDS = ['hero', 'mechanism', 'proof', 'cta'];
function freshPlan(): AuthoringPlan {
  return planOf(IDS);
}
function fullExperience(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    experienceCharacter: ['calm, authoritative, precise'],
    creativePrinciples: ['restraint over decoration'],
    decisionFilters: ['does it build trust?'],
    behaviouralIdentity: ['responsive, never flashy'],
    creativeConstraints: ['no stock imagery'],
    creativeOpportunities: ['lean into data visualisation'],
    validationPrinciples: ['reads credible to an ops lead'],
    embodiment: ['the visual model embodies the calm character'],
    ...over,
  };
}

// ── behavioural-intent enrichment ────────────────────────────────────────────────────
describe('W11 — applyExperience governs how the overall experience behaves (intent only)', () => {
  it('enriches every retained section with experience reasoning', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.communicationObjective).toBeTruthy();
      expect(it.reasoning!.selectionRationale).toBeTruthy();
      expect(it.reasoning!.relationships).toBeTruthy();
    }
  });

  it('maps experienceCharacter + creativePrinciples + decisionFilters → communicationObjective', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.communicationObjective).toContain('calm, authoritative, precise');
    expect(r.communicationObjective).toContain('restraint over decoration');
    expect(r.communicationObjective).toContain('does it build trust?');
  });

  it('maps behaviour + constraints + opportunities + validation → selectionRationale', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.selectionRationale).toContain('responsive, never flashy');
    expect(r.selectionRationale).toContain('no stock imagery');
    expect(r.selectionRationale).toContain('lean into data visualisation');
    expect(r.selectionRationale).toContain('reads credible to an ops lead');
  });

  it('maps embodiment → relationships', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    expect(plan.items[0].reasoning!.relationships).toContain('the visual model embodies the calm character');
  });

  it('consumes the Example Brand APA experience model the same way', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience(), APA_BRIEF), opts);
    expect(plan.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });

  it('handles multiple plan sizes (single + larger)', async () => {
    const single = planOf(['only']);
    applyExperience(single, await expModel({ experienceCharacter: ['singular voice'] }), opts);
    expect(single.items[0].reasoning!.communicationObjective).toContain('singular voice');
    const big = planOf(['a', 'b', 'c', 'd', 'e', 'f']);
    applyExperience(big, await expModel(fullExperience()), opts);
    expect(big.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });
});

// ── boundary: never changes ordering / selection / W6-W7-owned fields ───────────────
describe('W11 — never changes ordering / selection; never overwrites role / orderingRationale / transition', () => {
  it('never adds / removes / renames a section (set + count unchanged)', async () => {
    const plan = freshPlan();
    const before = [...plan.items.map((i) => i.anchor.id)].sort();
    applyExperience(plan, await expModel(fullExperience()), opts);
    expect([...plan.items.map((i) => i.anchor.id)].sort()).toEqual(before);
    expect(plan.items.length).toBe(IDS.length);
  });

  it('never reorders — plan item order is preserved', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS);
  });

  it('never writes role / orderingRationale / transition', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.role).toBeUndefined();
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
    }
  });

  it('the enriched reasoning is frozen (immutable)', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel(fullExperience()), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { selectionRationale?: string }).selectionRationale = 'x';
    }).toThrow();
  });

  it('is deterministic — two fresh plans enrich identically (replay)', async () => {
    const m = await expModel(fullExperience());
    const a = freshPlan();
    const b = freshPlan();
    applyExperience(a, m, opts);
    applyExperience(b, m, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

// ── empty / byte-identical default ─────────────────────────────────────────────────
describe('W11 — empty model + byte-identical default', () => {
  it('an empty experience model is a no-op (no enrichment) — byte-identical', async () => {
    const plan = freshPlan();
    applyExperience(plan, await expModel({}), opts);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── composition with W5..W10; only Experience consumed ──────────────────────────────
describe('W11 — composes with W5..W10 (append, never overwrite); only Experience consumed', () => {
  it('preserves every prior layer and appends experience intent (full seven-model stack)', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModelFor({ informationPriorities: ['cost = critical'] }), opts);
    applyProgression(plan, await progModelFor({ encounterSequence: IDS, progressionObjectives: ['o1', 'o2', 'o3', 'o4'] }), opts);
    applyMechanism(plan, await mechModelFor({ requiredMechanisms: IDS, responsibilities: ['r1', 'r2', 'r3', 'r4'] }), opts);
    applyCommunication(plan, await commModelFor({ perceptualEntry: ['headline first'] }), opts);
    applySpatial(plan, await spatialModelFor({ spatialAllocation: ['hero dominant'] }), opts);
    applyVisual(plan, await visualModelFor({ perceivedAffordance: ['clickable'] }), opts);
    applyExperience(plan, await expModel(fullExperience()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.selectionRationale).toContain('Information priority: cost = critical'); // W5
    expect(hero.reasoning!.orderingRationale).toContain('Encounter position'); // W6 (untouched)
    expect(hero.reasoning!.role).toContain('r1'); // W7 (untouched)
    expect(hero.reasoning!.communicationObjective).toContain('headline first'); // W8
    expect(hero.reasoning!.communicationObjective).toContain('hero dominant'); // W9
    expect(hero.reasoning!.communicationObjective).toContain('clickable'); // W10
    expect(hero.reasoning!.communicationObjective).toContain('calm, authoritative, precise'); // W11 appended
    expect(hero.reasoning!.selectionRationale).toContain('responsive, never flashy'); // W11 appended
  });

  it('order preserved through W6 then W11', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModelFor({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'] }), opts);
    const orderAfterW6 = plan.items.map((i) => i.anchor.id);
    applyExperience(plan, await expModel(fullExperience()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(orderAfterW6);
  });

  it('ignores all other Models — passing any non-experience Model throws', async () => {
    const set = await buildSet(fullExperience());
    for (const kind of MODEL_KINDS.filter((k) => k !== 'experienceCharacter') as ModelKind[]) {
      expect(() => applyExperience(freshPlan(), set.models[kind] as unknown as GovernedModel<'experienceCharacter'>, opts)).toThrow(/experience|model/i);
    }
  });
});

// ── fail-loud validation ────────────────────────────────────────────────────────────
describe('W11 — fail-loud validation (never infer / synthesize tone / invent personality)', () => {
  it('missing model', () => {
    expect(() => applyExperience(freshPlan(), undefined as unknown as GovernedModel<'experienceCharacter'>, opts)).toThrow(/missing|experience/i);
  });
  it('wrong model kind', async () => {
    const info = await infoModelFor({ informationPriorities: ['x'] });
    expect(() => applyExperience(freshPlan(), info as unknown as GovernedModel<'experienceCharacter'>, opts)).toThrow(/experience|expected/i);
  });
  it('mutable (non-frozen) model', () => {
    const mutable = { kind: 'experienceCharacter', result: { experienceCharacter: { content: ['x'], governanceRef: { document: 'BRAND_EXPRESSION.md', section: '§21' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'experienceCharacter'>;
    expect(() => applyExperience(freshPlan(), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });
  it('repository mismatch', async () => {
    const m = await expModel(fullExperience());
    expect(() => applyExperience(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });
  it('unknown category (a result key outside the authored experience schema)', () => {
    const bad = Object.freeze({
      kind: 'experienceCharacter',
      result: Object.freeze({
        experienceCharacter: Object.freeze({ content: Object.freeze(['x']), governanceRef: Object.freeze({ document: 'BRAND_EXPRESSION.md', section: '§21' }) }),
        experienceSorcery: Object.freeze({ content: Object.freeze(['nope']), governanceRef: Object.freeze({ document: 'X', section: '§0' }) }),
      }),
      evidence: Object.freeze({ repositoryIdentity: REPO_ID }),
    }) as unknown as GovernedModel<'experienceCharacter'>;
    expect(() => applyExperience(freshPlan(), bad, opts)).toThrow(/unknown|categor/i);
  });
  it('malformed behavioural data (non-string entry)', async () => {
    const m = await expModel({ behaviouralIdentity: ['ok', 5] });
    expect(() => applyExperience(freshPlan(), m, opts)).toThrow(/behaviour|malformed|string/i);
  });
  it('malformed constraints (unsupported shape)', async () => {
    const m = await expModel({ creativeConstraints: { a: 1 } });
    expect(() => applyExperience(freshPlan(), m, opts)).toThrow(/constraint|malformed|shape|string/i);
  });
  it('malformed opportunities (empty entry)', async () => {
    const m = await expModel({ creativeOpportunities: ['lean in', ''] });
    expect(() => applyExperience(freshPlan(), m, opts)).toThrow(/opportunit|malformed|string/i);
  });
  it('malformed decision filters (unsupported shape)', async () => {
    const m = await expModel({ decisionFilters: { filter: 'trust' } });
    expect(() => applyExperience(freshPlan(), m, opts)).toThrow(/decision|filter|malformed|shape|string/i);
  });
});

// ── harness ──────────────────────────────────────────────────────────────────────
describe('W11 — verification harness', () => {
  it('verifies an experience run: selection stable, reasoning enriched, immutable, replay', async () => {
    const report = await verifyExperienceConsumption(freshPlan(), await expModel(fullExperience()), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['selection', 'evidence', 'immutability', 'scope', 'replay']) expect(cats.has(dim as never)).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });
  it('verifies the Example Brand APA experience the same way', async () => {
    const report = await verifyExperienceConsumption(freshPlan(), await expModel(fullExperience(), APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });
  it('reports NOT ok when consumption fails (malformed constraints)', async () => {
    const report = await verifyExperienceConsumption(freshPlan(), await expModel({ creativeConstraints: { x: 1 } }), opts);
    expect(report.ok).toBe(false);
  });
});
