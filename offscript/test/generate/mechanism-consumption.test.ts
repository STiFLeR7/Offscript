/**
 * Sprint W7 — Mechanism Model Consumption (Governed Selection Justification).
 *
 * The SECOND Governance Model allowed to change planner behaviour — but unlike W6 (ordering),
 * Mechanism governs the SELECTION JUSTIFICATION: WHY each retained section exists. The World-B
 * planner consumes ONLY the World-A `mechanism` Model and enriches every retained PlanItem's
 * reasoning with role / selectionRationale / relationships / communicationObjective evidence. It
 * NEVER reorders (W6's job), never changes the selected section set, never authors HTML/components,
 * never performs realization, and never consumes another Model. No model → byte-identical.
 *
 * Category mapping (the W7 instruction's semantic labels → the authored MODEL_SCHEMA.mechanism keys):
 *   mechanismDiscovery + mechanismSelection → requiredMechanisms (§6)  — section anchor.id refs
 *   mechanismPurpose                        → purposes (§9)            — 1:1 → communicationObjective
 *   mechanismResponsibilities               → responsibilities (§14)   — 1:1 → role (authored 1:1)
 *   mechanismRelationships                  → relationships (§11)      — page-level → relationships
 *   mechanismDependencies                   → dependencies (§15)       — page-level → relationships
 *   NOT consumed: orchestration (§12), composition (§13), hierarchy (§10).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import {
  applyMechanism,
  type MechanismConsumptionOpts,
} from '../../src/generate/reasoning/mechanism-consumption.js';
import { verifyMechanismConsumption } from '../../src/generate/reasoning/verify-mechanism-consumption.js';
import { enrichPlanWithInformation } from '../../src/generate/reasoning/information-consumption.js';
import { applyProgression } from '../../src/generate/reasoning/progression-consumption.js';
import { serializeRulebook, plan as buildPlan } from '../../src/generate/plan.js';
import { buildContext } from '../../src/generate/context.js';
import { projectDir } from '../../src/paths.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type RawBrief, type GovernedModel, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';
import { makeBriefFixture } from './_brief-fixture.js';

// ── World-A model fixtures ───────────────────────────────────────────────────────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
const opts: MechanismConsumptionOpts = { repositoryIdentity: REPO_ID };
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
async function buildSet(mechanism: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(draftsFor('mechanism', mechanism)));
}
async function mechModel(mechanism: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'mechanism'>> {
  return (await buildSet(mechanism, b)).models.mechanism;
}
async function infoModelFor(info: Record<string, unknown>): Promise<GovernedModel<'information'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('information', info)))).models.information;
}
async function progModelFor(progression: Record<string, unknown>): Promise<GovernedModel<'progression'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('progression', progression)))).models.progression;
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
/** A full-coverage mechanism model over the default plan. */
function fullMech(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requiredMechanisms: ['hero', 'mechanism', 'proof', 'cta'],
    purposes: ['orient the reader', 'reveal the capability', 'prove the outcome', 'drive the action'],
    responsibilities: ['establish context', 'carry the core capability', 'evidence the claim', 'convert intent'],
    relationships: ['hero sets-up mechanism', 'proof completes hero'],
    dependencies: ['proof <- mechanism'],
    ...over,
  };
}

// ── selection justification: every retained section gets mechanism evidence ────────
describe('W7 — applyMechanism justifies every retained section (WHY it exists)', () => {
  it('attaches role / selectionRationale / relationships / communicationObjective to every section', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    for (const it of plan.items) {
      const r = it.reasoning!;
      expect(r.selectionRationale).toBeTruthy();
      expect(r.role).toBeTruthy();
      expect(r.communicationObjective).toBeTruthy();
      expect(r.relationships).toBeTruthy();
    }
  });

  it('maps purposes → communicationObjective and responsibilities → role per section (1:1)', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    const cta = plan.items.find((i) => i.anchor.id === 'cta')!;
    expect(hero.reasoning!.communicationObjective).toContain('orient the reader');
    expect(hero.reasoning!.role).toContain('establish context');
    expect(cta.reasoning!.communicationObjective).toContain('drive the action');
    expect(cta.reasoning!.role).toContain('convert intent');
  });

  it('maps relationships + dependencies → relationships evidence (page-level, uniform)', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.relationships).toContain('hero sets-up mechanism');
      expect(it.reasoning!.relationships).toContain('proof <- mechanism');
    }
  });

  it('records the governed selection fact in selectionRationale (cites Component System)', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    expect(plan.items[0].reasoning!.selectionRationale).toMatch(/required mechanism|component system/i);
  });

  it('attaches selectionRationale even when only requiredMechanisms is authored', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel({ requiredMechanisms: IDS }), opts);
    for (const it of plan.items) expect(it.reasoning!.selectionRationale).toBeTruthy();
  });

  it('consumes the Example Brand APA mechanism model the same way', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech(), APA_BRIEF), opts);
    expect(plan.items.every((i) => i.reasoning?.role && i.reasoning?.communicationObjective)).toBe(true);
  });

  it('handles multiple plan sizes (single section, and a larger plan)', async () => {
    const single = planOf(['only']);
    applyMechanism(single, await mechModel({ requiredMechanisms: ['only'], purposes: ['do the one thing'], responsibilities: ['be the page'] }), opts);
    expect(single.items[0].reasoning!.communicationObjective).toContain('do the one thing');

    const big = planOf(['a', 'b', 'c', 'd', 'e', 'f']);
    applyMechanism(big, await mechModel({ requiredMechanisms: ['a', 'b', 'c', 'd', 'e', 'f'] }), opts);
    expect(big.items.every((i) => i.reasoning?.selectionRationale)).toBe(true);
  });
});

// ── W7 does NOT change selection set or ordering (W6's domain) ──────────────────────
describe('W7 — selection set deterministic; ordering belongs to W6', () => {
  it('never adds / removes / renames a section (the set + count are unchanged)', async () => {
    const plan = freshPlan();
    const before = [...plan.items.map((i) => i.anchor.id)].sort();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    expect([...plan.items.map((i) => i.anchor.id)].sort()).toEqual(before);
    expect(plan.items.length).toBe(IDS.length);
  });

  it('never reorders — plan item order is preserved exactly', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech({ requiredMechanisms: ['cta', 'proof', 'mechanism', 'hero'] })), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS); // model list order does NOT reorder the plan
  });

  it('never writes orderingRationale or transition (W6-owned fields)', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
    }
  });

  it('the enriched reasoning is frozen (immutable)', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel(fullMech()), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { role?: string }).role = 'x';
    }).toThrow();
  });

  it('is deterministic — two fresh plans enrich identically (repeated replay)', async () => {
    const m = await mechModel(fullMech());
    const a = freshPlan();
    const b = freshPlan();
    applyMechanism(a, m, opts);
    applyMechanism(b, m, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

// ── empty / byte-identical default ─────────────────────────────────────────────────
describe('W7 — empty mechanism + byte-identical default', () => {
  it('an empty mechanism model is a no-op (no enrichment) — byte-identical', async () => {
    const plan = freshPlan();
    applyMechanism(plan, await mechModel({}), opts); // requiredMechanisms null
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });

  it('an un-consumed plan rulebook equals the baseline (HTML/recipe stable when model absent)', () => {
    expect(serializeRulebook(freshPlan(), 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── composition with W5 / W6; only Mechanism consumed ──────────────────────────────
describe('W7 — composes with W5 + W6; only Mechanism consumed', () => {
  it('W5 information evidence survives W7 (augment, never overwrite)', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModelFor({ informationPriorities: ['cost = critical'], informationRelationships: ['hero ~ proof'] }), opts);
    applyMechanism(plan, await mechModel(fullMech()), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.selectionRationale).toContain('Information priority: cost = critical'); // W5 preserved (not overwritten)
    expect(hero.reasoning!.relationships).toContain('hero ~ proof'); // W5 preserved
    expect(hero.reasoning!.role).toContain('establish context'); // W7 added (W5 left role empty)
    expect(hero.reasoning!.communicationObjective).toContain('orient the reader'); // W7 added
  });

  it('W6 progression evidence + ordering survive W7 (composes, never overwrites)', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModelFor({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'], progressionObjectives: ['convert', 'open', 'prove', 'reveal'] }), opts);
    const orderAfterW6 = plan.items.map((i) => i.anchor.id);
    applyMechanism(plan, await mechModel(fullMech()), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(orderAfterW6); // W7 did not reorder
    const cta = plan.items.find((i) => i.anchor.id === 'cta')!;
    expect(cta.reasoning!.orderingRationale).toContain('Encounter position'); // W6 preserved
    expect(cta.reasoning!.role).toBeTruthy(); // W7 added
  });

  it('ignores all other Models — passing any non-mechanism Model throws', async () => {
    const set = await buildSet(fullMech());
    for (const kind of MODEL_KINDS.filter((k) => k !== 'mechanism') as ModelKind[]) {
      expect(() => applyMechanism(freshPlan(), set.models[kind] as unknown as GovernedModel<'mechanism'>, opts)).toThrow(/mechanism|model/i);
    }
  });
});

// ── fail-loud validation (never infer / repair / fabricate purpose) ─────────────────
describe('W7 — fail-loud validation', () => {
  it('missing model', () => {
    expect(() => applyMechanism(freshPlan(), undefined as unknown as GovernedModel<'mechanism'>, opts)).toThrow(/missing|mechanism/i);
  });
  it('wrong model kind', async () => {
    const info = await infoModelFor({ informationPriorities: ['x'] });
    expect(() => applyMechanism(freshPlan(), info as unknown as GovernedModel<'mechanism'>, opts)).toThrow(/mechanism|expected/i);
  });
  it('mutable (non-frozen) model', () => {
    const mutable = { kind: 'mechanism', result: { requiredMechanisms: { content: IDS, governanceRef: { document: 'COMPONENT_SYSTEM.md', section: '§23' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'mechanism'>;
    expect(() => applyMechanism(freshPlan(), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });
  it('repository mismatch', async () => {
    const m = await mechModel(fullMech());
    expect(() => applyMechanism(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });
  it('unknown category (a result key outside the authored mechanism schema)', () => {
    const bad = Object.freeze({
      kind: 'mechanism',
      result: Object.freeze({
        requiredMechanisms: Object.freeze({ content: Object.freeze([...IDS]), governanceRef: Object.freeze({ document: 'COMPONENT_SYSTEM.md', section: '§23' }) }),
        mechanismSorcery: Object.freeze({ content: Object.freeze(['nope']), governanceRef: Object.freeze({ document: 'X', section: '§0' }) }),
      }),
      evidence: Object.freeze({ repositoryIdentity: REPO_ID }),
    }) as unknown as GovernedModel<'mechanism'>;
    expect(() => applyMechanism(freshPlan(), bad, opts)).toThrow(/unknown|categor/i);
  });
  it('duplicate mechanism (a section named twice in requiredMechanisms)', async () => {
    const m = await mechModel({ requiredMechanisms: ['hero', 'hero', 'proof', 'cta'] });
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/duplicate/i);
  });
  it('unknown section reference (requiredMechanisms names a section not in the plan)', async () => {
    const m = await mechModel({ requiredMechanisms: ['hero', 'ghost', 'proof', 'cta'] });
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/unknown|reference/i);
  });
  it('incomplete coverage (a retained section has no authored mechanism)', async () => {
    const m = await mechModel({ requiredMechanisms: ['hero', 'proof'] }); // plan has 4
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/cover|coverage|every retained/i);
  });
  it('malformed responsibilities (length mismatch with requiredMechanisms)', async () => {
    const m = await mechModel({ requiredMechanisms: IDS, responsibilities: ['only one'] });
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/responsibilit|malformed|1:1|align/i);
  });
  it('malformed responsibilities (non-string entry)', async () => {
    const m = await mechModel({ requiredMechanisms: IDS, responsibilities: ['a', 'b', 5, 'd'] });
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/responsibilit|malformed|string/i);
  });
  it('malformed dependencies (broken / non-string entry)', async () => {
    const m = await mechModel({ requiredMechanisms: IDS, dependencies: ['ok', ''] });
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/dependenc|malformed|string/i);
  });
  it('malformed relationships (unsupported shape)', async () => {
    const m = await mechModel({ requiredMechanisms: IDS, relationships: [{ a: 1 }] });
    expect(() => applyMechanism(freshPlan(), m, opts)).toThrow(/relationship|malformed|shape|string/i);
  });
});

// ── harness ──────────────────────────────────────────────────────────────────────
describe('W7 — verification harness', () => {
  it('verifies a mechanism run: selection stable, evidence present, immutable, replay', async () => {
    const report = await verifyMechanismConsumption(freshPlan(), await mechModel(fullMech()), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['selection', 'evidence', 'immutability', 'replay']) expect(cats.has(dim as never)).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });
  it('verifies the Example Brand APA mechanism the same way', async () => {
    const report = await verifyMechanismConsumption(freshPlan(), await mechModel(fullMech(), APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });
  it('reports NOT ok when consumption fails (incomplete coverage)', async () => {
    const report = await verifyMechanismConsumption(freshPlan(), await mechModel({ requiredMechanisms: ['hero'] }), opts);
    expect(report.ok).toBe(false);
  });
});

// ── W83 — track-neutral governance references (real planner, W82 regression) ─────
describe('W83 — mechanism consumption is track-neutral (real buildContext + plan())', () => {
  const CLIENT = '__w83_mechanism_test__';
  const { scaffoldClient, writeBrief } = makeBriefFixture(CLIENT);

  afterEach(() => {
    rmSync(projectDir(CLIENT), { recursive: true, force: true });
  });

  /** A website-authored governance mechanism model, sourced from a REAL website plan's own
   * ids — mirroring exactly how derive-governance.ts builds requiredMechanisms (from website's
   * sections.md). Order is irrelevant for mechanism (coverage, not sequencing). */
  async function websiteSourcedMechanismModel(websiteIds: string[]): Promise<GovernedModel<'mechanism'>> {
    return mechModel({ requiredMechanisms: websiteIds });
  }

  it('website: consumes its own governance pack unchanged (no regression from W83)', async () => {
    scaffoldClient();
    writeBrief([
      'Hero: A calmer way to run daily operations',
      'The manual grind before automation',
      'Feature-grid: What the platform actually does',
      'Metrics: Proof the numbers move',
      'CTA-banner: Talk to the team',
      'Footer: Company and contact details',
    ]);
    const websitePlan = buildPlan(buildContext(CLIENT, 'website'));
    const websiteIds = websitePlan.items.map((i) => i.anchor.id);
    applyMechanism(websitePlan, await websiteSourcedMechanismModel(websiteIds), opts);
    expect(websitePlan.items.every((i) => i.reasoning?.selectionRationale)).toBe(true);
  });

  it('W82 regression A (prefix-stripping asymmetry): a website-sourced pack now succeeds on collateral', async () => {
    scaffoldClient();
    writeBrief([
      'Hero: A calmer way to run daily operations',
      'The manual grind before automation',
      'Feature-grid: What the platform actually does',
      'Metrics: Proof the numbers move',
      'CTA-banner: Talk to the team',
      'Footer: Company and contact details',
    ]);
    const websiteIds = buildPlan(buildContext(CLIENT, 'website')).items.map((i) => i.anchor.id);
    const collateralPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    expect(new Set(collateralPlan.items.map((i) => i.anchor.id))).not.toEqual(new Set(websiteIds));

    // Pre-W83 this threw `mechanism-consumption: unknown section reference '...'`.
    const model = await websiteSourcedMechanismModel(websiteIds);
    expect(() => applyMechanism(collateralPlan, model, opts)).not.toThrow();
    expect(collateralPlan.items.every((i) => i.reasoning?.selectionRationale)).toBe(true);
  });

  it('W82 regression B (floor-padding asymmetry): website-only structural defaults are excluded from coverage, not required', async () => {
    scaffoldClient();
    writeBrief([
      'Manual work has a hidden cost',
      'The connector links every system',
      'Quarter one shows the outcome',
    ]);
    const websiteIds = buildPlan(buildContext(CLIENT, 'website')).items.map((i) => i.anchor.id);
    expect(websiteIds.length).toBeGreaterThan(3); // confirms floor-padding fired

    const collateralPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    expect(collateralPlan.items).toHaveLength(3);

    // Pre-W83: threw "unknown section reference" on the first padded id. Post-W83: padded ids
    // are recognized as website's own structural defaults and excluded from collateral's
    // coverage requirement — the 3 real ids must still fully cover collateral's plan.
    const model = await websiteSourcedMechanismModel(websiteIds);
    expect(() => applyMechanism(collateralPlan, model, opts)).not.toThrow();
    expect(collateralPlan.items.every((i) => i.reasoning?.selectionRationale)).toBe(true);
  });

  it('deterministic replay: two independently-built collateral plans enrich identically', async () => {
    scaffoldClient();
    writeBrief([
      'Hero: A calmer way to run daily operations',
      'The manual grind before automation',
      'Feature-grid: What the platform actually does',
      'Metrics: Proof the numbers move',
      'CTA-banner: Talk to the team',
      'Footer: Company and contact details',
    ]);
    const websiteIds = buildPlan(buildContext(CLIENT, 'website')).items.map((i) => i.anchor.id);
    const model = await websiteSourcedMechanismModel(websiteIds);
    const a = buildPlan(buildContext(CLIENT, 'collateral'));
    const b = buildPlan(buildContext(CLIENT, 'collateral'));
    applyMechanism(a, model, opts);
    applyMechanism(b, model, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });

  it('unknown reference still fails loud on collateral (a genuine typo is never excused)', async () => {
    scaffoldClient();
    writeBrief(['Manual work has a hidden cost', 'The connector links every system', 'Quarter one shows the outcome']);
    const collateralPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    const badIds = [...collateralPlan.items.map((i) => i.anchor.id).slice(0, 2), 'totally-made-up-nonexistent-section'];
    const model = await websiteSourcedMechanismModel(badIds);
    expect(() => applyMechanism(collateralPlan, model, opts)).toThrow(/unknown|reference/i);
  });
});
