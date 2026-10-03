/**
 * Sprint W8 — Communication Model Consumption (Governed HOW).
 *
 * Communication is the first Governance Model that governs HOW every retained section should
 * communicate (Mechanism answered WHY). The World-B planner consumes ONLY the World-A
 * `communication` Model and AUGMENTS every PlanItem's reasoning communicationObjective (the HOW),
 * append-only into selectionRationale + relationships. It NEVER authors copy/headlines/body text,
 * never reorders (W6), never changes the selected section set, never overwrites role / orderingRationale
 * / transition, and never consumes another Model. No model → byte-identical.
 *
 * Category mapping (instruction's labels → authored MODEL_SCHEMA.communication keys):
 *   perceptualEntry      → perceptualEntry (§3)        ─┐
 *   meaningExpression    → meaningExpressionSystem (§5)  ├─ communicationObjective (append)
 *   communicationEnergy  → communicationEnergy (§8)     ─┘
 *   beliefFormation      → beliefFormation (§7)          → selectionRationale (append)
 *   expressionHierarchy  → expressionHierarchy (§6)       → relationships (append, if authored)
 *   NOT consumed: communicationArchitecture (§4), creativeAssetIntelligence (§9),
 *                 experienceConstruction (§10), visualRhythmSystem (§11), interactionAsCommunication (§12).
 */
import { describe, it, expect } from 'vitest';
import {
  applyCommunication,
  type CommunicationConsumptionOpts,
} from '../../src/generate/reasoning/communication-consumption.js';
import { verifyCommunicationConsumption } from '../../src/generate/reasoning/verify-communication-consumption.js';
import { enrichPlanWithInformation } from '../../src/generate/reasoning/information-consumption.js';
import { applyProgression } from '../../src/generate/reasoning/progression-consumption.js';
import { applyMechanism } from '../../src/generate/reasoning/mechanism-consumption.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type RawBrief, type GovernedModel, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

// ── World-A model fixtures ───────────────────────────────────────────────────────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
const opts: CommunicationConsumptionOpts = { repositoryIdentity: REPO_ID };
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
async function buildSet(communication: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(draftsFor('communication', communication)));
}
async function commModel(communication: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'communication'>> {
  return (await buildSet(communication, b)).models.communication;
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
function fullComm(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    perceptualEntry: ['the headline enters first'],
    meaningExpressionSystem: ['benefit expressed as outcome'],
    communicationEnergy: ['high energy at entry, calm in body'],
    beliefFormation: ['claim then proof then outcome'],
    expressionHierarchy: ['primary: value; secondary: evidence'],
    ...over,
  };
}

// ── HOW enrichment: every retained section gets a communication objective ───────────
describe('W8 — applyCommunication governs HOW every section communicates', () => {
  it('enriches communicationObjective on every retained section', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    for (const it of plan.items) expect(it.reasoning!.communicationObjective).toBeTruthy();
  });

  it('maps perceptualEntry + meaningExpression + energy → communicationObjective', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    const r = plan.items[0].reasoning!;
    expect(r.communicationObjective).toContain('the headline enters first');
    expect(r.communicationObjective).toContain('benefit expressed as outcome');
    expect(r.communicationObjective).toContain('high energy at entry');
  });

  it('maps beliefFormation → selectionRationale (append)', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    expect(plan.items[0].reasoning!.selectionRationale).toContain('claim then proof then outcome');
  });

  it('maps expressionHierarchy → relationships (append, if authored)', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    expect(plan.items[0].reasoning!.relationships).toContain('primary: value; secondary: evidence');
  });

  it('writes communicationObjective even when only the HOW categories are authored', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel({ perceptualEntry: ['entry only'] }), opts);
    for (const it of plan.items) expect(it.reasoning!.communicationObjective).toContain('entry only');
  });

  it('consumes the Example Brand APA communication model the same way', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm(), APA_BRIEF), opts);
    expect(plan.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });

  it('handles multiple plan sizes (single + larger)', async () => {
    const single = planOf(['only']);
    applyCommunication(single, await commModel({ meaningExpressionSystem: ['say it plainly'] }), opts);
    expect(single.items[0].reasoning!.communicationObjective).toContain('say it plainly');
    const big = planOf(['a', 'b', 'c', 'd', 'e', 'f']);
    applyCommunication(big, await commModel(fullComm()), opts);
    expect(big.items.every((i) => i.reasoning?.communicationObjective)).toBe(true);
  });
});

// ── boundary: never changes ordering / selection / W6-W7-owned fields ───────────────
describe('W8 — never changes ordering / selection; never overwrites role / orderingRationale / transition', () => {
  it('never adds / removes / renames a section (set + count unchanged)', async () => {
    const plan = freshPlan();
    const before = [...plan.items.map((i) => i.anchor.id)].sort();
    applyCommunication(plan, await commModel(fullComm()), opts);
    expect([...plan.items.map((i) => i.anchor.id)].sort()).toEqual(before);
    expect(plan.items.length).toBe(IDS.length);
  });

  it('never reorders — plan item order is preserved', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS);
  });

  it('never writes role / orderingRationale / transition', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.role).toBeUndefined();
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
    }
  });

  it('the enriched reasoning is frozen (immutable)', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel(fullComm()), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { communicationObjective?: string }).communicationObjective = 'x';
    }).toThrow();
  });

  it('is deterministic — two fresh plans enrich identically (replay)', async () => {
    const m = await commModel(fullComm());
    const a = freshPlan();
    const b = freshPlan();
    applyCommunication(a, m, opts);
    applyCommunication(b, m, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

// ── empty / byte-identical default ─────────────────────────────────────────────────
describe('W8 — empty communication + byte-identical default', () => {
  it('an empty communication model is a no-op (no enrichment) — byte-identical', async () => {
    const plan = freshPlan();
    applyCommunication(plan, await commModel({}), opts);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── composition with W5 / W6 / W7; only Communication consumed ──────────────────────
describe('W8 — composes with W5 + W6 + W7 (append, never overwrite); only Communication consumed', () => {
  it('W5 information evidence is preserved and W8 appends to it', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModelFor({ informationPriorities: ['cost = critical'], informationRelationships: ['hero ~ proof'] }), opts);
    applyCommunication(plan, await commModel(fullComm()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.selectionRationale).toContain('Information priority: cost = critical'); // W5 preserved
    expect(hero.reasoning!.selectionRationale).toContain('claim then proof then outcome'); // W8 appended
    expect(hero.reasoning!.relationships).toContain('hero ~ proof'); // W5 preserved
    expect(hero.reasoning!.relationships).toContain('primary: value'); // W8 appended
  });

  it('W6 progression ordering + evidence are preserved (W8 never touches orderingRationale/transition)', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModelFor({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'], transitionLogic: ['hero -> proof'], progressionObjectives: ['c', 'h', 'p', 'm'] }), opts);
    const orderAfterW6 = plan.items.map((i) => i.anchor.id);
    applyCommunication(plan, await commModel(fullComm()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(orderAfterW6); // W8 did not reorder
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.orderingRationale).toContain('Encounter position'); // W6 preserved
    expect(hero.reasoning!.communicationObjective).toContain('the headline enters first'); // W8 added
  });

  it('W7 mechanism evidence is preserved; communicationObjective appends (never overwrites role)', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModelFor({ requiredMechanisms: IDS, purposes: ['orient', 'reveal', 'prove', 'convert'], responsibilities: ['set context', 'carry capability', 'evidence', 'convert'] }), opts);
    applyCommunication(plan, await commModel(fullComm()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.role).toContain('set context'); // W7 preserved, never overwritten
    expect(hero.reasoning!.communicationObjective).toContain('Purpose: orient'); // W7 preserved
    expect(hero.reasoning!.communicationObjective).toContain('the headline enters first'); // W8 appended
  });

  it('ignores all other Models — passing any non-communication Model throws', async () => {
    const set = await buildSet(fullComm());
    for (const kind of MODEL_KINDS.filter((k) => k !== 'communication') as ModelKind[]) {
      expect(() => applyCommunication(freshPlan(), set.models[kind] as unknown as GovernedModel<'communication'>, opts)).toThrow(/communication|model/i);
    }
  });
});

// ── fail-loud validation ────────────────────────────────────────────────────────────
describe('W8 — fail-loud validation (never infer / synthesize messaging)', () => {
  it('missing model', () => {
    expect(() => applyCommunication(freshPlan(), undefined as unknown as GovernedModel<'communication'>, opts)).toThrow(/missing|communication/i);
  });
  it('wrong model kind', async () => {
    const info = await infoModelFor({ informationPriorities: ['x'] });
    expect(() => applyCommunication(freshPlan(), info as unknown as GovernedModel<'communication'>, opts)).toThrow(/communication|expected/i);
  });
  it('mutable (non-frozen) model', () => {
    const mutable = { kind: 'communication', result: { perceptualEntry: { content: ['x'], governanceRef: { document: 'COMMUNICATION_AND_PERCEPTION_SYSTEM.md', section: '§3' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'communication'>;
    expect(() => applyCommunication(freshPlan(), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });
  it('repository mismatch', async () => {
    const m = await commModel(fullComm());
    expect(() => applyCommunication(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });
  it('unknown category (a result key outside the authored communication schema)', () => {
    const bad = Object.freeze({
      kind: 'communication',
      result: Object.freeze({
        perceptualEntry: Object.freeze({ content: Object.freeze(['x']), governanceRef: Object.freeze({ document: 'COMMUNICATION_AND_PERCEPTION_SYSTEM.md', section: '§3' }) }),
        communicationSorcery: Object.freeze({ content: Object.freeze(['nope']), governanceRef: Object.freeze({ document: 'X', section: '§0' }) }),
      }),
      evidence: Object.freeze({ repositoryIdentity: REPO_ID }),
    }) as unknown as GovernedModel<'communication'>;
    expect(() => applyCommunication(freshPlan(), bad, opts)).toThrow(/unknown|categor/i);
  });
  it('malformed expression (non-string entry)', async () => {
    const m = await commModel({ meaningExpressionSystem: ['ok', 5] });
    expect(() => applyCommunication(freshPlan(), m, opts)).toThrow(/expression|malformed|string/i);
  });
  it('malformed hierarchy (unsupported shape)', async () => {
    const m = await commModel({ expressionHierarchy: [{ level: 1 }] });
    expect(() => applyCommunication(freshPlan(), m, opts)).toThrow(/hierarchy|malformed|shape|string/i);
  });
  it('malformed belief chain (empty entry)', async () => {
    const m = await commModel({ beliefFormation: ['claim', ''] });
    expect(() => applyCommunication(freshPlan(), m, opts)).toThrow(/belief|malformed|string/i);
  });
  it('malformed energy (unsupported shape)', async () => {
    const m = await commModel({ communicationEnergy: { level: 'high' } });
    expect(() => applyCommunication(freshPlan(), m, opts)).toThrow(/energy|malformed|shape|string/i);
  });
});

// ── harness ──────────────────────────────────────────────────────────────────────
describe('W8 — verification harness', () => {
  it('verifies a communication run: selection stable, communicationObjective enriched, immutable, replay', async () => {
    const report = await verifyCommunicationConsumption(freshPlan(), await commModel(fullComm()), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['selection', 'evidence', 'immutability', 'scope', 'replay']) expect(cats.has(dim as never)).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });
  it('verifies the Example Brand APA communication the same way', async () => {
    const report = await verifyCommunicationConsumption(freshPlan(), await commModel(fullComm(), APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });
  it('reports NOT ok when consumption fails (malformed energy)', async () => {
    const report = await verifyCommunicationConsumption(freshPlan(), await commModel({ communicationEnergy: { x: 1 } }), opts);
    expect(report.ok).toBe(false);
  });
});
