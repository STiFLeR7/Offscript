/**
 * Sprint W9 — Spatial Model Consumption (Governed Spatial Intent).
 *
 * Spatial is the first Governance Model that governs HOW selected sections should occupy SPACE.
 * Information governs structure (W5), Progression order (W6), Mechanism purpose (W7), Communication
 * expression (W8); Spatial governs spatial intent. The World-B planner consumes ONLY the World-A
 * `spatial` Model and APPEND-only enriches every PlanItem's reasoning. It records spatial INTENT only —
 * it NEVER computes layout, assigns a grid, calculates spacing, emits CSS / design tokens, emits HTML,
 * reorders (W6), changes selection, overwrites role / orderingRationale / transition, or consumes
 * another Model. No model / no-op model → byte-identical.
 *
 * Category mapping (instruction's labels → authored MODEL_SCHEMA.spatial keys, §17):
 *   allocation + density + readingFlow                  → communicationObjective (append)
 *   containment + spatialRelationships + composition    → relationships (append)
 *   hierarchy                                           → selectionRationale (append)
 *   (allocation → spatialAllocation, hierarchy → spatialHierarchy; the rest match verbatim.)
 */
import { describe, it, expect } from 'vitest';
import {
  applySpatial,
  type SpatialConsumptionOpts,
} from '../../src/generate/reasoning/spatial-consumption.js';
import { verifySpatialConsumption } from '../../src/generate/reasoning/verify-spatial-consumption.js';
import { enrichPlanWithInformation } from '../../src/generate/reasoning/information-consumption.js';
import { applyProgression } from '../../src/generate/reasoning/progression-consumption.js';
import { applyMechanism } from '../../src/generate/reasoning/mechanism-consumption.js';
import { applyCommunication } from '../../src/generate/reasoning/communication-consumption.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type RawBrief, type GovernedModel, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

// ── World-A model fixtures ───────────────────────────────────────────────────────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
const opts: SpatialConsumptionOpts = { repositoryIdentity: REPO_ID };
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
async function buildSet(spatial: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(draftsFor('spatial', spatial)));
}
async function spatialModel(spatial: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'spatial'>> {
  return (await buildSet(spatial, b)).models.spatial;
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
function fullSpatial(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    spatialAllocation: ['hero dominant, proof supporting'],
    density: ['spacious at hero, balanced in body'],
    readingFlow: ['guided top-to-bottom'],
    containment: ['cards contain the proof points'],
    spatialRelationships: ['proof adjacent to mechanism'],
    composition: ['single-focus per band'],
    spatialHierarchy: ['hero primary, cta secondary'],
    ...over,
  };
}

// ── spatial-intent enrichment ───────────────────────────────────────────────────────
describe('W9 — applySpatial governs HOW sections occupy space (intent only)', () => {
  it('enriches every retained section with spatial reasoning', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.communicationObjective).toBeTruthy();
      expect(it.reasoning!.relationships).toBeTruthy();
      expect(it.reasoning!.selectionRationale).toBeTruthy();
    }
  });

  it('maps allocation + density + readingFlow → communicationObjective', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.communicationObjective).toContain('hero dominant, proof supporting');
    expect(r.communicationObjective).toContain('spacious at hero, balanced in body');
    expect(r.communicationObjective).toContain('guided top-to-bottom');
  });

  it('maps containment + spatialRelationships + composition → relationships', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.relationships).toContain('cards contain the proof points');
    expect(r.relationships).toContain('proof adjacent to mechanism');
    expect(r.relationships).toContain('single-focus per band');
  });

  it('maps hierarchy → selectionRationale', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    expect(plan.items[0].reasoning!.selectionRationale).toContain('hero primary, cta secondary');
  });

  it('consumes the Example Brand APA spatial model the same way', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial(), APA_BRIEF), opts);
    expect(plan.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });

  it('handles multiple plan sizes (single + larger)', async () => {
    const single = planOf(['only']);
    applySpatial(single, await spatialModel({ spatialAllocation: ['full bleed'] }), opts);
    expect(single.items[0].reasoning!.communicationObjective).toContain('full bleed');
    const big = planOf(['a', 'b', 'c', 'd', 'e', 'f']);
    applySpatial(big, await spatialModel(fullSpatial()), opts);
    expect(big.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });
});

// ── boundary: never changes ordering / selection / W6-W7-owned fields ───────────────
describe('W9 — never changes ordering / selection; never overwrites role / orderingRationale / transition', () => {
  it('never adds / removes / renames a section (set + count unchanged)', async () => {
    const plan = freshPlan();
    const before = [...plan.items.map((i) => i.anchor.id)].sort();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    expect([...plan.items.map((i) => i.anchor.id)].sort()).toEqual(before);
    expect(plan.items.length).toBe(IDS.length);
  });

  it('never reorders — plan item order is preserved', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS);
  });

  it('never writes role / orderingRationale / transition', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.role).toBeUndefined();
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
    }
  });

  it('the enriched reasoning is frozen (immutable)', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { relationships?: string }).relationships = 'x';
    }).toThrow();
  });

  it('is deterministic — two fresh plans enrich identically (replay)', async () => {
    const m = await spatialModel(fullSpatial());
    const a = freshPlan();
    const b = freshPlan();
    applySpatial(a, m, opts);
    applySpatial(b, m, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

// ── empty / byte-identical default ─────────────────────────────────────────────────
describe('W9 — no-op model + byte-identical default', () => {
  it('a no-op spatial model is byte-identical (no enrichment)', async () => {
    const plan = freshPlan();
    applySpatial(plan, await spatialModel({}), opts);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── composition with W5 / W6 / W7 / W8; only Spatial consumed ───────────────────────
describe('W9 — composes with W5 + W6 + W7 + W8 (append, never overwrite); only Spatial consumed', () => {
  it('preserves every prior layer and appends spatial intent', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModelFor({ informationPriorities: ['cost = critical'] }), opts);
    applyProgression(plan, await progModelFor({ encounterSequence: IDS, progressionObjectives: ['o1', 'o2', 'o3', 'o4'] }), opts);
    applyMechanism(plan, await mechModelFor({ requiredMechanisms: IDS, responsibilities: ['r1', 'r2', 'r3', 'r4'] }), opts);
    applyCommunication(plan, await commModelFor({ perceptualEntry: ['headline first'] }), opts);
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.selectionRationale).toContain('Information priority: cost = critical'); // W5
    expect(hero.reasoning!.orderingRationale).toContain('Encounter position'); // W6 (untouched)
    expect(hero.reasoning!.role).toContain('r1'); // W7 (untouched)
    expect(hero.reasoning!.communicationObjective).toContain('headline first'); // W8
    expect(hero.reasoning!.communicationObjective).toContain('hero dominant'); // W9 appended
    expect(hero.reasoning!.selectionRationale).toContain('hero primary, cta secondary'); // W9 appended
  });

  it('order preserved through W6 then W9', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModelFor({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'] }), opts);
    const orderAfterW6 = plan.items.map((i) => i.anchor.id);
    applySpatial(plan, await spatialModel(fullSpatial()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(orderAfterW6);
  });

  it('ignores all other Models — passing any non-spatial Model throws', async () => {
    const set = await buildSet(fullSpatial());
    for (const kind of MODEL_KINDS.filter((k) => k !== 'spatial') as ModelKind[]) {
      expect(() => applySpatial(freshPlan(), set.models[kind] as unknown as GovernedModel<'spatial'>, opts)).toThrow(/spatial|model/i);
    }
  });
});

// ── fail-loud validation ────────────────────────────────────────────────────────────
describe('W9 — fail-loud validation (never infer / calculate layout / synthesize spacing)', () => {
  it('missing model', () => {
    expect(() => applySpatial(freshPlan(), undefined as unknown as GovernedModel<'spatial'>, opts)).toThrow(/missing|spatial/i);
  });
  it('wrong model kind', async () => {
    const info = await infoModelFor({ informationPriorities: ['x'] });
    expect(() => applySpatial(freshPlan(), info as unknown as GovernedModel<'spatial'>, opts)).toThrow(/spatial|expected/i);
  });
  it('mutable (non-frozen) model', () => {
    const mutable = { kind: 'spatial', result: { spatialAllocation: { content: ['x'], governanceRef: { document: 'SECTION_LAYOUT.md', section: '§17' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'spatial'>;
    expect(() => applySpatial(freshPlan(), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });
  it('repository mismatch', async () => {
    const m = await spatialModel(fullSpatial());
    expect(() => applySpatial(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });
  it('unknown category (a result key outside the authored spatial schema)', () => {
    const bad = Object.freeze({
      kind: 'spatial',
      result: Object.freeze({
        spatialAllocation: Object.freeze({ content: Object.freeze(['x']), governanceRef: Object.freeze({ document: 'SECTION_LAYOUT.md', section: '§17' }) }),
        spatialSorcery: Object.freeze({ content: Object.freeze(['nope']), governanceRef: Object.freeze({ document: 'X', section: '§0' }) }),
      }),
      evidence: Object.freeze({ repositoryIdentity: REPO_ID }),
    }) as unknown as GovernedModel<'spatial'>;
    expect(() => applySpatial(freshPlan(), bad, opts)).toThrow(/unknown|categor/i);
  });
  it('malformed allocation (non-string entry)', async () => {
    const m = await spatialModel({ spatialAllocation: ['ok', 5] });
    expect(() => applySpatial(freshPlan(), m, opts)).toThrow(/allocation|malformed|string/i);
  });
  it('malformed hierarchy (unsupported shape)', async () => {
    const m = await spatialModel({ spatialHierarchy: { level: 1 } });
    expect(() => applySpatial(freshPlan(), m, opts)).toThrow(/hierarchy|malformed|shape|string/i);
  });
  it('malformed density (empty entry)', async () => {
    const m = await spatialModel({ density: ['dense', ''] });
    expect(() => applySpatial(freshPlan(), m, opts)).toThrow(/density|malformed|string/i);
  });
  it('malformed reading flow (unsupported shape)', async () => {
    const m = await spatialModel({ readingFlow: { flow: 'linear' } });
    expect(() => applySpatial(freshPlan(), m, opts)).toThrow(/reading flow|readingflow|flow|malformed|shape|string/i);
  });
});

// ── harness ──────────────────────────────────────────────────────────────────────
describe('W9 — verification harness', () => {
  it('verifies a spatial run: selection stable, reasoning enriched, immutable, replay', async () => {
    const report = await verifySpatialConsumption(freshPlan(), await spatialModel(fullSpatial()), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['selection', 'evidence', 'immutability', 'scope', 'replay']) expect(cats.has(dim as never)).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });
  it('verifies the Example Brand APA spatial the same way', async () => {
    const report = await verifySpatialConsumption(freshPlan(), await spatialModel(fullSpatial(), APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });
  it('reports NOT ok when consumption fails (malformed allocation)', async () => {
    const report = await verifySpatialConsumption(freshPlan(), await spatialModel({ spatialAllocation: { x: 1 } }), opts);
    expect(report.ok).toBe(false);
  });
});
