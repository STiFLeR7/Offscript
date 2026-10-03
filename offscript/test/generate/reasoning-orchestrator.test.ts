/**
 * Sprint W13 — Production Wiring & Pipeline Unification.
 *
 * The reasoning orchestrator is the SINGLE production path that turns the seven World-A Governance
 * Models into PlanItem.reasoning. It invokes the seven consumers in the canonical authored governance
 * descent (the deterministic merge contract recorded in WORLD-B-EVOLUTION-ARCHITECTURE.md §6 /
 * GOVERNANCE-GATES-G1-G2-G3-RESOLUTION.md, superseding the order listed in the W13 prompt):
 *
 *   Communication → Information → Progression → Spatial → Mechanism → Visual → Experience Character
 *
 * These tests prove: the full production pipeline (all seven consumers invoked, deterministic order,
 * immutable + replayable outputs); the merge contract (append, no duplicate clauses, no overwrites,
 * preserved provenance); ownership (Progression sole authority over ordering/transition; Mechanism sole
 * authority over role; no other consumer touches them); and disabled-mode byte-identity.
 */
import { describe, it, expect } from 'vitest';
import {
  enrichPlanWithGovernedReasoning,
  GOVERNED_REASONING_ORDER,
} from '../../src/generate/reasoning/reasoning-orchestrator.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import {
  MODEL_KINDS,
  MODEL_SCHEMA,
  type ModelDraft,
  type RawBrief,
  type ModelKind,
  type DerivedModelSet,
} from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

// ── World-A model-set fixtures (real derivation → frozen, evidence-bound) ───────────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
function rawBrief(over: Partial<RawBrief> = {}): RawBrief {
  return { brand: 'Example Brand', oneLiner: 'synthetic', audience: 'ops', goals: ['g'], mustInclude: ['hero'], tone: 'confident', successCriteria: ['book a demo'], body: 'b', ...over };
}
const APA_BRIEF = rawBrief({ oneLiner: 'Autonomous digital workers remove the manual glue between the systems operations teams already run — without replacing the software.' });

/** Build drafts for ALL seven kinds; each category null unless supplied in `perKind[kind]`. */
function draftsAll(perKind: Partial<Record<ModelKind, Record<string, unknown>>>): ModelDraft[] {
  return MODEL_KINDS.map((kind) => ({
    kind,
    categories: Object.fromEntries(
      MODEL_SCHEMA[kind].categories.map((c) => [c.key, perKind[kind]?.[c.key] ?? null]),
    ),
    rationale: 'test',
  }));
}
async function buildSet(perKind: Partial<Record<ModelKind, Record<string, unknown>>>, b = rawBrief()): Promise<DerivedModelSet> {
  return deriveModels(b, repo, scriptedDeriver(draftsAll(perKind)));
}

// A FULL set over the default plan: every consumer has authored content (mechanism + progression cover
// all four ids so their coverage/permutation guards are satisfied).
const IDS = ['hero', 'mechanism', 'proof', 'cta'];
function fullPerKind(over: Partial<Record<ModelKind, Record<string, unknown>>> = {}): Partial<Record<ModelKind, Record<string, unknown>>> {
  return {
    communication: { perceptualEntry: ['headline first'], meaningExpressionSystem: ['plain language'], communicationEnergy: ['calm'], beliefFormation: ['claim → proof'], expressionHierarchy: ['headline > body'] },
    information: { informationPriorities: ['cost = critical'], completenessModel: 'covers all must-includes', informationRelationships: ['hero ~ proof'], informationDependencies: ['proof <- mechanism'], informationClusters: ['cost + proof'] },
    progression: { encounterSequence: IDS, transitionLogic: ['hero -> mechanism', 'mechanism -> proof', 'proof -> cta'], progressionObjectives: ['orient', 'reveal', 'prove', 'convert'] },
    spatial: { spatialAllocation: ['hero dominant'], density: ['airy'], readingFlow: ['Z-pattern'], containment: ['cards'], spatialRelationships: ['proof beside mechanism'], composition: ['asymmetric'], spatialHierarchy: ['hero first'] },
    mechanism: { requiredMechanisms: IDS, purposes: ['orient the reader', 'reveal capability', 'prove the outcome', 'drive action'], responsibilities: ['establish context', 'carry capability', 'evidence claim', 'convert intent'], relationships: ['hero sets-up mechanism'], dependencies: ['proof <- mechanism'] },
    visual: { perceivedImportanceAndStanding: ['hero loudest'], perceivedDistinction: ['accent on cta'], perceivedRelationshipsAndGrouping: ['proof groups metrics'], perceivedContinuity: ['shared rhythm'], perceivedAffordance: ['clickable cta'], motionPerception: ['subtle fade'], iconographyPerception: ['line icons'], illustrationPerception: ['data viz'] },
    experienceCharacter: { experienceCharacter: ['calm, authoritative, precise'], creativePrinciples: ['restraint over decoration'], decisionFilters: ['does it build trust?'], behaviouralIdentity: ['responsive, never flashy'], creativeConstraints: ['no stock imagery'], creativeOpportunities: ['lean into data viz'], validationPrinciples: ['reads credible to an ops lead'], embodiment: ['visual embodies the calm character'] },
    ...over,
  };
}

// ── plan fixtures ────────────────────────────────────────────────────────────────
function planOf(ids: string[]): AuthoringPlan {
  return {
    track: 'website',
    items: ids.map((id) => ({ anchor: { id, anchor: id }, archetype: 'hero', tokenRoles: ['--cr-bg'], intent: id })) as PlanItem[],
    warnings: [],
  };
}
function freshPlan(): AuthoringPlan {
  return planOf(IDS);
}

// ─────────────────────────────────────────────────────────────────────────────────
describe('W13 — the production reasoning pipeline (single path; all seven consumers)', () => {
  it('exposes the canonical authored-descent order (the merge contract)', () => {
    expect(GOVERNED_REASONING_ORDER).toEqual([
      'communication',
      'information',
      'progression',
      'spatial',
      'mechanism',
      'visual',
      'experienceCharacter',
    ]);
  });

  it('invokes all seven consumers, in canonical order, when governed reasoning is enabled', async () => {
    const plan = freshPlan();
    const result = enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    expect(result.enabled).toBe(true);
    expect(result.applied).toEqual([...GOVERNED_REASONING_ORDER]);
  });

  it('all seven Governance Models actively participate (each model\'s signature reaches the reasoning)', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!.reasoning!;
    expect(hero.communicationObjective).toContain('headline first'); // Communication
    expect(hero.selectionRationale).toContain('Information priority: cost = critical'); // Information
    expect(hero.orderingRationale).toContain('Encounter position'); // Progression
    expect(hero.communicationObjective).toContain('hero dominant'); // Spatial
    expect(hero.role).toContain('establish context'); // Mechanism (role)
    expect(hero.communicationObjective).toContain('clickable cta'); // Visual
    expect(hero.communicationObjective).toContain('calm, authoritative, precise'); // Experience
  });

  it('produces immutable (deep-frozen) reasoning on every item', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    for (const it of plan.items) {
      expect(Object.isFrozen(it.reasoning)).toBe(true);
      expect(() => {
        (it.reasoning as { role?: string }).role = 'x';
      }).toThrow();
    }
  });

  it('is deterministic + replayable — two fresh plans enrich byte-for-byte identically', async () => {
    const models = await buildSet(fullPerKind());
    const a = freshPlan();
    const b = freshPlan();
    enrichPlanWithGovernedReasoning(a, { models });
    enrichPlanWithGovernedReasoning(b, { models });
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });

  it('drives the same pipeline for the Example Brand APA scenario', async () => {
    const plan = freshPlan();
    const result = enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind(), APA_BRIEF) });
    expect(result.applied).toEqual([...GOVERNED_REASONING_ORDER]);
    expect(plan.items.every((i) => i.reasoning?.communicationObjective && i.reasoning?.role)).toBe(true);
  });
});

// ── merge contract ─────────────────────────────────────────────────────────────────
describe('W13 — deterministic merge contract (append · no-dup · no-overwrite · provenance)', () => {
  it('appends each contributor\'s clause in canonical order (no contribution lost)', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    const sel = plan.items[0].reasoning!.selectionRationale!;
    // Communication (belief) before Information (priority) before Spatial (hierarchy) before Mechanism
    // (required) before Visual (importance) before Experience (behaviour) — canonical order.
    const order = [
      'Belief formation', // Communication
      'Information priority', // Information
      'Spatial hierarchy', // Spatial
      'Required mechanism', // Mechanism (constant) — survives (append, not dropped)
      'Importance & standing', // Visual
      'responsive, never flashy', // Experience (behaviour)
    ].map((p) => sel.indexOf(p));
    expect(order.every((i) => i >= 0)).toBe(true); // every contribution present
    expect(order).toEqual([...order].sort((a, b) => a - b)); // in canonical order
  });

  it('preserves provenance — every contributor\'s prefixed clause survives (no overwrite)', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    const r = plan.items[0].reasoning!;
    // selectionRationale carries Communication + Information + Spatial + Mechanism + Visual + Experience
    expect(r.selectionRationale).toContain('Belief formation:');
    expect(r.selectionRationale).toContain('Information priority:');
    expect(r.selectionRationale).toContain('Required mechanism'); // the W7 constant is NOT dropped
    expect(r.selectionRationale).toContain('Importance & standing:');
    // communicationObjective carries Communication + Spatial + Mechanism(purpose) + Visual + Experience
    expect(r.communicationObjective).toContain('Perceptual entry:');
    expect(r.communicationObjective).toContain('Spatial allocation:');
    expect(r.communicationObjective).toContain('Purpose:');
    expect(r.communicationObjective).toContain('Affordance:');
    expect(r.communicationObjective).toContain('Experience character:');
  });

  it('produces no duplicate clauses (every ·-delimited fragment is unique per field)', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    for (const it of plan.items) {
      for (const field of ['selectionRationale', 'relationships', 'communicationObjective'] as const) {
        const value = it.reasoning![field];
        if (!value) continue;
        const frags = value.split(' · ');
        expect(new Set(frags).size).toBe(frags.length);
      }
    }
  });

  it('the merge order is fixed regardless of which models carry content (deterministic)', async () => {
    // Sparse set: only Information + Visual carry selectionRationale content. Order still canonical.
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, {
      models: await buildSet({
        information: { informationPriorities: ['p'] },
        visual: { perceivedImportanceAndStanding: ['loud'] },
      }),
    });
    const sel = plan.items[0].reasoning!.selectionRationale!;
    expect(sel.indexOf('Information priority')).toBeLessThan(sel.indexOf('Importance & standing'));
  });
});

// ── ownership guarantees ────────────────────────────────────────────────────────────
describe('W13 — ownership: Progression owns ordering; Mechanism owns role', () => {
  it('Progression is the sole authority over ordering — the final order is its encounter sequence', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, {
      models: await buildSet(fullPerKind({ progression: { encounterSequence: ['cta', 'hero', 'proof', 'mechanism'] } })),
    });
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['cta', 'hero', 'proof', 'mechanism']);
  });

  it('no other model influences ordering — empty Progression ⇒ planner order preserved', async () => {
    const plan = freshPlan();
    // progression empty (encounterSequence null) but every other model full.
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind({ progression: {} })) });
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS); // unchanged by the other six
    for (const it of plan.items) {
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
    }
  });

  it('Mechanism is the sole authority over role — empty Mechanism ⇒ no role written by anyone', async () => {
    const plan = freshPlan();
    // mechanism empty (requiredMechanisms null) but every other model full.
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind({ mechanism: {} })) });
    for (const it of plan.items) {
      expect(it.reasoning!.role).toBeUndefined(); // no consumer other than Mechanism writes role
    }
  });

  it('with Mechanism present, role carries the mechanism responsibility only', async () => {
    const plan = freshPlan();
    enrichPlanWithGovernedReasoning(plan, { models: await buildSet(fullPerKind()) });
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!.reasoning!;
    expect(hero.role).toBe('Responsibility: establish context'); // exactly the mechanism role, nothing appended
  });
});

// ── disabled mode (byte-identical fallback) ─────────────────────────────────────────
describe('W13 — disabled mode is byte-identical (no governed reasoning)', () => {
  it('no models ⇒ disabled, plan untouched, rulebook equals the baseline', () => {
    const plan = freshPlan();
    const result = enrichPlanWithGovernedReasoning(plan, {});
    expect(result.enabled).toBe(false);
    expect(result.applied).toEqual([]);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });

  it('an all-inert model set (every category null) enriches nothing — byte-identical', async () => {
    const plan = freshPlan();
    const result = enrichPlanWithGovernedReasoning(plan, { models: await buildSet({}) });
    expect(result.enabled).toBe(true); // the pipeline ran…
    for (const it of plan.items) expect('reasoning' in it).toBe(false); // …but every consumer no-opped
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── fail-loud (a malformed model set surfaces, never silently mis-enriches) ──────────
describe('W13 — fail-loud propagation', () => {
  it('a malformed model (bad content shape) throws through the orchestrator', async () => {
    const plan = freshPlan();
    const bad = await buildSet({ information: { informationPriorities: 5 } }); // non-string/array
    expect(() => enrichPlanWithGovernedReasoning(plan, { models: bad })).toThrow(/malformed|shape|priorit/i);
  });

  it('an incomplete-coverage mechanism throws (every retained section must be covered)', async () => {
    const plan = freshPlan();
    const bad = await buildSet(fullPerKind({ mechanism: { requiredMechanisms: ['hero'] } })); // plan has 4
    expect(() => enrichPlanWithGovernedReasoning(plan, { models: bad })).toThrow(/cover|coverage|every retained/i);
  });
});
