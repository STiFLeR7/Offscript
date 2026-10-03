/**
 * Sprint W10 — Visual Model Consumption (Governed Perceptual Intent).
 *
 * Visual is the Governance Model that governs HOW each section should be PERCEIVED. Spatial governs
 * spatial intent (W9); Visual governs perception. Visual never realizes. The World-B planner consumes
 * ONLY the World-A `visual` Model and APPEND-only enriches every PlanItem's reasoning with perceptual
 * intent. It records perception only — it NEVER computes layout, generates CSS / animation / icons /
 * illustrations, rewrites HTML, reorders (W6), changes the selected section set, overwrites role /
 * orderingRationale / transition, or consumes another Model. No model / empty model → byte-identical.
 *
 * Category mapping (instruction's labels → authored MODEL_SCHEMA.visual keys, §25):
 *   hierarchyDominance → perceivedImportanceAndStanding (§8)  ─┐
 *   contrast           → perceivedDistinction (§9)             ├─ selectionRationale (append)
 *   grouping           → perceivedRelationshipsAndGrouping (§10) ─┐
 *   continuity         → perceivedContinuity (§11)               ├─ relationships (append)
 *   affordance         → perceivedAffordance (§14)              ─┐
 *   motion             → motionPerception (§15)                  │
 *   iconography        → iconographyPerception (§16)             ├─ communicationObjective (append)
 *   illustration       → illustrationPerception (§17)           ─┘
 *   NOTE: the instruction's `rhythmBalance` + `clarity` are NOT authored visual categories (rhythm is
 *   Communication's visualRhythmSystem; clarity is unauthored) — per "consume exactly the authored
 *   categories, do not invent any", they are not consumed.
 */
import { describe, it, expect } from 'vitest';
import {
  applyVisual,
  type VisualConsumptionOpts,
} from '../../src/generate/reasoning/visual-consumption.js';
import { verifyVisualConsumption } from '../../src/generate/reasoning/verify-visual-consumption.js';
import { enrichPlanWithInformation } from '../../src/generate/reasoning/information-consumption.js';
import { applyProgression } from '../../src/generate/reasoning/progression-consumption.js';
import { applyMechanism } from '../../src/generate/reasoning/mechanism-consumption.js';
import { applyCommunication } from '../../src/generate/reasoning/communication-consumption.js';
import { applySpatial } from '../../src/generate/reasoning/spatial-consumption.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type RawBrief, type GovernedModel, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

// ── World-A model fixtures ───────────────────────────────────────────────────────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
const opts: VisualConsumptionOpts = { repositoryIdentity: REPO_ID };
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
async function buildSet(visual: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(draftsFor('visual', visual)));
}
async function visualModel(visual: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'visual'>> {
  return (await buildSet(visual, b)).models.visual;
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
function fullVisual(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    perceivedImportanceAndStanding: ['hero dominant in the visual field'],
    perceivedDistinction: ['primary CTA high contrast'],
    perceivedRelationshipsAndGrouping: ['proof points grouped'],
    perceivedContinuity: ['consistent rhythm across bands'],
    perceivedAffordance: ['buttons read as clickable'],
    motionPerception: ['subtle entrance motion'],
    iconographyPerception: ['line icons, consistent weight'],
    illustrationPerception: ['abstract supporting illustration'],
    ...over,
  };
}

// ── perceptual-intent enrichment ────────────────────────────────────────────────────
describe('W10 — applyVisual governs how each section is perceived (intent only)', () => {
  it('enriches every retained section with perceptual reasoning', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.selectionRationale).toBeTruthy();
      expect(it.reasoning!.relationships).toBeTruthy();
      expect(it.reasoning!.communicationObjective).toBeTruthy();
    }
  });

  it('maps hierarchyDominance + contrast → selectionRationale', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.selectionRationale).toContain('hero dominant in the visual field');
    expect(r.selectionRationale).toContain('primary CTA high contrast');
  });

  it('maps grouping + continuity → relationships', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.relationships).toContain('proof points grouped');
    expect(r.relationships).toContain('consistent rhythm across bands');
  });

  it('maps affordance + motion + iconography + illustration → communicationObjective', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.communicationObjective).toContain('buttons read as clickable');
    expect(r.communicationObjective).toContain('subtle entrance motion');
    expect(r.communicationObjective).toContain('line icons, consistent weight');
    expect(r.communicationObjective).toContain('abstract supporting illustration');
  });

  it('consumes the Example Brand APA visual model the same way', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual(), APA_BRIEF), opts);
    expect(plan.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });

  it('handles multiple plan sizes (single + larger)', async () => {
    const single = planOf(['only']);
    applyVisual(single, await visualModel({ motionPerception: ['fade in'] }), opts);
    expect(single.items[0].reasoning!.communicationObjective).toContain('fade in');
    const big = planOf(['a', 'b', 'c', 'd', 'e', 'f']);
    applyVisual(big, await visualModel(fullVisual()), opts);
    expect(big.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });
});

// ── boundary: never changes ordering / selection / W6-W7-owned fields ───────────────
describe('W10 — never changes ordering / selection; never overwrites role / orderingRationale / transition', () => {
  it('never adds / removes / renames a section (set + count unchanged)', async () => {
    const plan = freshPlan();
    const before = [...plan.items.map((i) => i.anchor.id)].sort();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    expect([...plan.items.map((i) => i.anchor.id)].sort()).toEqual(before);
    expect(plan.items.length).toBe(IDS.length);
  });

  it('never reorders — plan item order is preserved', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS);
  });

  it('never writes role / orderingRationale / transition', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.role).toBeUndefined();
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
    }
  });

  it('the enriched reasoning is frozen (immutable)', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel(fullVisual()), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { communicationObjective?: string }).communicationObjective = 'x';
    }).toThrow();
  });

  it('is deterministic — two fresh plans enrich identically (replay)', async () => {
    const m = await visualModel(fullVisual());
    const a = freshPlan();
    const b = freshPlan();
    applyVisual(a, m, opts);
    applyVisual(b, m, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

// ── empty / byte-identical default ─────────────────────────────────────────────────
describe('W10 — empty model + byte-identical default', () => {
  it('an empty visual model is a no-op (no enrichment) — byte-identical', async () => {
    const plan = freshPlan();
    applyVisual(plan, await visualModel({}), opts);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── composition with W5 / W6 / W7 / W8 / W9; only Visual consumed ───────────────────
describe('W10 — composes with W5..W9 (append, never overwrite); only Visual consumed', () => {
  it('preserves every prior layer and appends perceptual intent', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModelFor({ informationPriorities: ['cost = critical'] }), opts);
    applyProgression(plan, await progModelFor({ encounterSequence: IDS, progressionObjectives: ['o1', 'o2', 'o3', 'o4'] }), opts);
    applyMechanism(plan, await mechModelFor({ requiredMechanisms: IDS, responsibilities: ['r1', 'r2', 'r3', 'r4'] }), opts);
    applyCommunication(plan, await commModelFor({ perceptualEntry: ['headline first'] }), opts);
    applySpatial(plan, await spatialModelFor({ spatialAllocation: ['hero dominant'] }), opts);
    applyVisual(plan, await visualModel(fullVisual()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.selectionRationale).toContain('Information priority: cost = critical'); // W5
    expect(hero.reasoning!.orderingRationale).toContain('Encounter position'); // W6 (untouched)
    expect(hero.reasoning!.role).toContain('r1'); // W7 (untouched)
    expect(hero.reasoning!.communicationObjective).toContain('headline first'); // W8
    expect(hero.reasoning!.communicationObjective).toContain('hero dominant'); // W9
    expect(hero.reasoning!.communicationObjective).toContain('buttons read as clickable'); // W10 appended
    expect(hero.reasoning!.selectionRationale).toContain('hero dominant in the visual field'); // W10 appended
  });

  it('order preserved through W6 then W10', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModelFor({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'] }), opts);
    const orderAfterW6 = plan.items.map((i) => i.anchor.id);
    applyVisual(plan, await visualModel(fullVisual()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(orderAfterW6);
  });

  it('ignores all other Models — passing any non-visual Model throws', async () => {
    const set = await buildSet(fullVisual());
    for (const kind of MODEL_KINDS.filter((k) => k !== 'visual') as ModelKind[]) {
      expect(() => applyVisual(freshPlan(), set.models[kind] as unknown as GovernedModel<'visual'>, opts)).toThrow(/visual|model/i);
    }
  });
});

// ── fail-loud validation ────────────────────────────────────────────────────────────
describe('W10 — fail-loud validation (never infer / synthesize perception / calculate styling)', () => {
  it('missing model', () => {
    expect(() => applyVisual(freshPlan(), undefined as unknown as GovernedModel<'visual'>, opts)).toThrow(/missing|visual/i);
  });
  it('wrong model kind', async () => {
    const info = await infoModelFor({ informationPriorities: ['x'] });
    expect(() => applyVisual(freshPlan(), info as unknown as GovernedModel<'visual'>, opts)).toThrow(/visual|expected/i);
  });
  it('mutable (non-frozen) model', () => {
    const mutable = { kind: 'visual', result: { perceivedImportanceAndStanding: { content: ['x'], governanceRef: { document: 'VISUAL_LANGUAGE.md', section: '§25' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'visual'>;
    expect(() => applyVisual(freshPlan(), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });
  it('repository mismatch', async () => {
    const m = await visualModel(fullVisual());
    expect(() => applyVisual(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });
  it('unknown category (a result key outside the authored visual schema)', () => {
    const bad = Object.freeze({
      kind: 'visual',
      result: Object.freeze({
        perceivedImportanceAndStanding: Object.freeze({ content: Object.freeze(['x']), governanceRef: Object.freeze({ document: 'VISUAL_LANGUAGE.md', section: '§25' }) }),
        visualSorcery: Object.freeze({ content: Object.freeze(['nope']), governanceRef: Object.freeze({ document: 'X', section: '§0' }) }),
      }),
      evidence: Object.freeze({ repositoryIdentity: REPO_ID }),
    }) as unknown as GovernedModel<'visual'>;
    expect(() => applyVisual(freshPlan(), bad, opts)).toThrow(/unknown|categor/i);
  });
  it('malformed hierarchy (non-string entry)', async () => {
    const m = await visualModel({ perceivedImportanceAndStanding: ['ok', 5] });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/importance|standing|hierarchy|malformed|string/i);
  });
  it('malformed contrast (unsupported shape)', async () => {
    const m = await visualModel({ perceivedDistinction: { level: 'high' } });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/distinction|contrast|malformed|shape|string/i);
  });
  it('malformed grouping (empty entry)', async () => {
    const m = await visualModel({ perceivedRelationshipsAndGrouping: ['grouped', ''] });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/grouping|relationship|malformed|string/i);
  });
  it('malformed continuity (unsupported shape)', async () => {
    const m = await visualModel({ perceivedContinuity: { flow: 1 } });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/continuity|malformed|shape|string/i);
  });
  it('malformed affordance (non-string entry)', async () => {
    const m = await visualModel({ perceivedAffordance: [true] });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/affordance|malformed|string/i);
  });
  it('malformed motion (unsupported shape)', async () => {
    const m = await visualModel({ motionPerception: { type: 'fade' } });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/motion|malformed|shape|string/i);
  });
  it('malformed iconography (empty entry)', async () => {
    const m = await visualModel({ iconographyPerception: [''] });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/iconograph|malformed|string/i);
  });
  it('malformed illustration (unsupported shape)', async () => {
    const m = await visualModel({ illustrationPerception: { style: 'abstract' } });
    expect(() => applyVisual(freshPlan(), m, opts)).toThrow(/illustration|malformed|shape|string/i);
  });
});

// ── harness ──────────────────────────────────────────────────────────────────────
describe('W10 — verification harness', () => {
  it('verifies a visual run: selection stable, reasoning enriched, immutable, replay', async () => {
    const report = await verifyVisualConsumption(freshPlan(), await visualModel(fullVisual()), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['selection', 'evidence', 'immutability', 'scope', 'replay']) expect(cats.has(dim as never)).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });
  it('verifies the Example Brand APA visual the same way', async () => {
    const report = await verifyVisualConsumption(freshPlan(), await visualModel(fullVisual(), APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });
  it('reports NOT ok when consumption fails (malformed motion)', async () => {
    const report = await verifyVisualConsumption(freshPlan(), await visualModel({ motionPerception: { x: 1 } }), opts);
    expect(report.ok).toBe(false);
  });
});
