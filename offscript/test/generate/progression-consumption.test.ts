/**
 * Sprint W6 — Progression Model Consumption (Governed Sequencing).
 *
 * The FIRST Governance Model allowed to change planner BEHAVIOUR — specifically section ORDERING.
 * The World-B planner consumes ONLY the World-A `progression` Model and reorders the EXISTING
 * PlanItems by its `encounterSequence` (a pure permutation — never add / remove / rename / merge /
 * split). `transitionLogic` is validated as an acyclic graph + preserved as evidence;
 * `progressionObjectives` become per-section evidence. Selection is untouched; Information enrichment
 * (W5) is preserved; the other five Models stay transport-only. No model → byte-identical.
 *
 * Resolves the Phase-D blockers in World B: the encounter sequence references PlanItem anchor ids
 * (the planner's own namespace), and W6 consumes only string[] content — failing loud on any other
 * shape rather than inventing one (G1).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import {
  applyProgression,
  type ProgressionConsumptionOpts,
} from '../../src/generate/reasoning/progression-consumption.js';
import { verifyProgressionConsumption } from '../../src/generate/reasoning/verify-progression-consumption.js';
import { enrichPlanWithInformation } from '../../src/generate/reasoning/information-consumption.js';
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
const opts: ProgressionConsumptionOpts = { repositoryIdentity: REPO_ID };
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
async function buildSet(progression: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(draftsFor('progression', progression)));
}
async function progModel(progression: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'progression'>> {
  return (await buildSet(progression, b)).models.progression;
}
async function infoModelFor(info: Record<string, unknown>): Promise<GovernedModel<'information'>> {
  return (await deriveModels(rawBrief(), repo, scriptedDeriver(draftsFor('information', info)))).models.information;
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

// ── ordering: the encounter sequence reorders existing items (pure permutation) ────
describe('W6 — applyProgression reorders PlanItems by the encounter sequence', () => {
  it('reorders items to the encounter sequence order', async () => {
    const plan = freshPlan();
    const m = await progModel({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'] });
    applyProgression(plan, m, opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['cta', 'hero', 'proof', 'mechanism']);
  });

  it('changes ONLY ordering — the section set is identical (no add / remove / rename)', async () => {
    const plan = freshPlan();
    const before = [...plan.items.map((i) => i.anchor.id)].sort();
    applyProgression(plan, await progModel({ encounterSequence: ['proof', 'cta', 'hero', 'mechanism'] }), opts);
    expect([...plan.items.map((i) => i.anchor.id)].sort()).toEqual(before);
    expect(plan.items.length).toBe(IDS.length);
  });

  it('linear progression: a single-line sequence reorders to that line', async () => {
    const plan = planOf(['c', 'a', 'b']);
    applyProgression(plan, await progModel({ encounterSequence: ['a', 'b', 'c'] }), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['a', 'b', 'c']);
  });

  it('single-section progression: trivial permutation, unchanged', async () => {
    const plan = planOf(['only']);
    applyProgression(plan, await progModel({ encounterSequence: ['only'] }), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['only']);
  });

  it('branching transition graph (acyclic) is accepted and reorders by the sequence', async () => {
    const plan = freshPlan();
    const m = await progModel({
      encounterSequence: ['hero', 'mechanism', 'proof', 'cta'],
      transitionLogic: ['hero -> mechanism', 'hero -> proof', 'mechanism -> cta', 'proof -> cta'],
    });
    applyProgression(plan, m, opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['hero', 'mechanism', 'proof', 'cta']);
  });

  it('consumes the Example Brand APA progression model the same way', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModel({ encounterSequence: ['cta', 'proof', 'mechanism', 'hero'] }, APA_BRIEF), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['cta', 'proof', 'mechanism', 'hero']);
  });

  it('is deterministic — two fresh plans reorder identically', async () => {
    const m = await progModel({ encounterSequence: ['proof', 'hero', 'cta', 'mechanism'], transitionLogic: ['hero -> proof'] });
    const a = freshPlan();
    const b = freshPlan();
    applyProgression(a, m, opts);
    applyProgression(b, m, opts);
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

// ── evidence: transition logic + objectives + position, in the W6-owned fields ────
describe('W6 — ordering/transition evidence (the fields W5 left untouched)', () => {
  it('records encounter position + objective in orderingRationale, and transition in transition', async () => {
    const plan = freshPlan();
    const m = await progModel({
      encounterSequence: ['hero', 'mechanism', 'proof', 'cta'],
      transitionLogic: ['hero -> mechanism', 'mechanism -> proof'],
      progressionObjectives: ['open tension', 'reveal mechanism', 'prove outcomes', 'convert'],
    });
    applyProgression(plan, m, opts);
    const hero = plan.items[0];
    expect(hero.reasoning!.orderingRationale).toContain('Encounter position: 1 of 4');
    expect(hero.reasoning!.orderingRationale).toContain('Objective: open tension');
    expect(hero.reasoning!.transition).toContain('mechanism'); // hands to mechanism
    expect(plan.items[1].reasoning!.transition).toContain('proof');
  });

  it('preserves transition evidence + progression objectives verbatim', async () => {
    const plan = planOf(['a', 'b']);
    applyProgression(plan, await progModel({ encounterSequence: ['a', 'b'], transitionLogic: ['a -> b'], progressionObjectives: ['first', 'second'] }), opts);
    expect(plan.items.find((i) => i.anchor.id === 'b')!.reasoning!.orderingRationale).toContain('Objective: second');
    expect(plan.items.find((i) => i.anchor.id === 'a')!.reasoning!.transition).toContain('b');
  });

  it('the enriched reasoning is frozen (immutable)', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModel({ encounterSequence: ['hero', 'mechanism', 'proof', 'cta'] }), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { orderingRationale?: string }).orderingRationale = 'x';
    }).toThrow();
  });
});

// ── empty / byte-identical default ────────────────────────────────────────────────
describe('W6 — empty progression + byte-identical default', () => {
  it('an empty encounter sequence is a no-op (no reorder, no reasoning) — byte-identical', async () => {
    const plan = freshPlan();
    applyProgression(plan, await progModel({}), opts); // encounterSequence null
    expect(plan.items.map((i) => i.anchor.id)).toEqual(IDS);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });

  it('an un-consumed plan rulebook equals the baseline (HTML/recipe stable when model absent)', () => {
    expect(serializeRulebook(freshPlan(), 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });
});

// ── Information behaviour preserved; only-progression consumed ─────────────────────
describe('W6 — Information enrichment preserved; only Progression consumed', () => {
  it('W5 information evidence survives W6 reordering (composes, never overwrites)', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModelFor({ informationPriorities: ['cost = critical'], informationDependencies: ['proof <- mechanism'] }), opts);
    applyProgression(plan, await progModel({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'], progressionObjectives: ['convert', 'open', 'prove', 'reveal'] }), opts);
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    expect(hero.reasoning!.selectionRationale).toContain('Information priority: cost = critical'); // W5 preserved
    expect(hero.reasoning!.orderingRationale).toContain('Encounter position'); // W6 added
  });

  it('ignores all other Models — passing any non-progression Model throws', async () => {
    const set = await buildSet({ encounterSequence: ['hero'] });
    for (const kind of MODEL_KINDS.filter((k) => k !== 'progression') as ModelKind[]) {
      expect(() => applyProgression(freshPlan(), set.models[kind] as unknown as GovernedModel<'progression'>, opts)).toThrow(/progression|model/i);
    }
  });
});

// ── fail-loud validation ─────────────────────────────────────────────────────────
describe('W6 — fail-loud validation (never repair / infer / synthesize ordering)', () => {
  it('missing model', () => {
    expect(() => applyProgression(freshPlan(), undefined as unknown as GovernedModel<'progression'>, opts)).toThrow(/missing|progression/i);
  });
  it('mutable (non-frozen) model', () => {
    const mutable = { kind: 'progression', result: { encounterSequence: { content: ['hero'], governanceRef: { document: 'PAGE_STRUCTURE.md', section: '§12' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'progression'>;
    expect(() => applyProgression(planOf(['hero']), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });
  it('repository mismatch', async () => {
    const m = await progModel({ encounterSequence: IDS });
    expect(() => applyProgression(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });
  it('duplicate sequence entries', async () => {
    const m = await progModel({ encounterSequence: ['hero', 'hero', 'proof', 'cta'] });
    expect(() => applyProgression(freshPlan(), m, opts)).toThrow(/duplicate/i);
  });
  it('unknown sequence reference', async () => {
    const m = await progModel({ encounterSequence: ['hero', 'ghost', 'proof', 'cta'] });
    expect(() => applyProgression(freshPlan(), m, opts)).toThrow(/unknown|reference/i);
  });
  it('incomplete coverage would remove a section (permutation required)', async () => {
    const m = await progModel({ encounterSequence: ['hero', 'proof'] }); // plan has 4
    expect(() => applyProgression(freshPlan(), m, opts)).toThrow(/cover|remove|permut/i);
  });
  it('broken transition graph (unknown reference / unparseable)', async () => {
    const broken = await progModel({ encounterSequence: IDS, transitionLogic: ['hero -> ghost'] });
    expect(() => applyProgression(freshPlan(), broken, opts)).toThrow(/broken|transition|unknown/i);
    const unparseable = await progModel({ encounterSequence: IDS, transitionLogic: ['hero then proof'] });
    expect(() => applyProgression(freshPlan(), unparseable, opts)).toThrow(/broken|transition/i);
  });
  it('cyclic progression', async () => {
    const m = await progModel({ encounterSequence: IDS, transitionLogic: ['hero -> proof', 'proof -> hero'] });
    expect(() => applyProgression(freshPlan(), m, opts)).toThrow(/cycl/i);
  });
  it('malformed objectives (length mismatch / non-string)', async () => {
    const lenBad = await progModel({ encounterSequence: IDS, progressionObjectives: ['only one'] });
    expect(() => applyProgression(freshPlan(), lenBad, opts)).toThrow(/objectiv|malformed/i);
    const typeBad = await progModel({ encounterSequence: IDS, progressionObjectives: ['a', 'b', 5, 'd'] });
    expect(() => applyProgression(freshPlan(), typeBad, opts)).toThrow(/objectiv|malformed|string/i);
  });
  it('malformed encounter sequence (non-string entry)', async () => {
    const m = await progModel({ encounterSequence: ['hero', 5, 'proof', 'cta'] });
    expect(() => applyProgression(freshPlan(), m, opts)).toThrow(/malformed|sequence|string/i);
  });
});

// ── harness ──────────────────────────────────────────────────────────────────────
describe('W6 — verification harness', () => {
  it('verifies a progression run: ordering follows the sequence, selection stable, evidence, replay', async () => {
    const report = await verifyProgressionConsumption(freshPlan(), await progModel({ encounterSequence: ['cta', 'hero', 'proof', 'mechanism'], transitionLogic: ['hero -> proof'], progressionObjectives: ['c', 'h', 'p', 'm'] }), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['ordering', 'selection', 'evidence', 'replay']) expect(cats.has(dim as never)).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });
  it('verifies the Example Brand APA progression the same way', async () => {
    const report = await verifyProgressionConsumption(freshPlan(), await progModel({ encounterSequence: ['hero', 'mechanism', 'proof', 'cta'] }, APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });
  it('reports NOT ok when consumption fails (cycle)', async () => {
    const report = await verifyProgressionConsumption(freshPlan(), await progModel({ encounterSequence: IDS, transitionLogic: ['hero -> proof', 'proof -> hero'] }), opts);
    expect(report.ok).toBe(false);
  });
});

// ── W83 — track-neutral governance references (real planner, W82 regression) ─────
describe('W83 — progression consumption is track-neutral (real buildContext + plan())', () => {
  const CLIENT = '__w83_progression_test__';
  const { scaffoldClient, writeBrief } = makeBriefFixture(CLIENT);

  afterEach(() => {
    rmSync(projectDir(CLIENT), { recursive: true, force: true });
  });

  /** A website-authored governance progression model, sourced from a REAL website plan's own
   * ids — mirroring exactly how derive-governance.ts builds a pack (reads the website plan's
   * ids, never collateral's). Reverses the order so consumption is provably NOT a no-op. */
  async function websiteSourcedProgressionModel(websiteIds: string[]): Promise<GovernedModel<'progression'>> {
    return progModel({ encounterSequence: [...websiteIds].reverse() });
  }

  it('website: consumes its own governance pack unchanged (no regression from W83)', async () => {
    scaffoldClient();
    // 5 distinct declared archetypes ⇒ no floor-padding, so this brief exercises pure prefix
    // stripping only (parseMustInclude), isolating that mechanism from the padding one below.
    writeBrief([
      'Hero: A calmer way to run daily operations',
      'The manual grind before automation',
      'Feature-grid: What the platform actually does',
      'Metrics: Proof the numbers move',
      'CTA-banner: Talk to the team',
      'Footer: Company and contact details',
    ]);
    const ctx = buildContext(CLIENT, 'website');
    const websitePlan = buildPlan(ctx);
    const websiteIds = websitePlan.items.map((i) => i.anchor.id);

    const model = await websiteSourcedProgressionModel(websiteIds);
    applyProgression(websitePlan, model, opts);
    expect(websitePlan.items.map((i) => i.anchor.id)).toEqual([...websiteIds].reverse());
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

    // Prove this is a REAL reproduction of the W82 divergence: collateral's own raw anchor ids
    // are NOT the same set as website's (the declared-archetype prefix is baked into 4/6 of
    // them, e.g. "hero-a-calmer-way-to-run-daily-operations" vs website's stripped
    // "a-calmer-way-to-run-daily-operations").
    const collateralRawIds = collateralPlan.items.map((i) => i.anchor.id);
    expect(new Set(collateralRawIds)).not.toEqual(new Set(websiteIds));

    // Pre-W83 this threw `progression-consumption: unknown sequence reference '...' (no such
    // section)` for every prefixed id — exactly the W82 failure. Post-W83 it must succeed.
    const model = await websiteSourcedProgressionModel(websiteIds);
    expect(() => applyProgression(collateralPlan, model, opts)).not.toThrow();
    // The plan was genuinely reordered (governed sequencing actually took effect).
    expect(collateralPlan.items.map((i) => i.governanceReferenceId)).toEqual([...websiteIds].reverse());
  });

  it('W82 regression B (floor-padding asymmetry): website-only structural defaults are excluded, not errors', async () => {
    scaffoldClient();
    // A short brief forces website to floor-pad with hero/features/metrics/cta/footer
    // defaults that collateral (no floor-padding, GAP-1) never produces.
    writeBrief([
      'Manual work has a hidden cost',
      'The connector links every system',
      'Quarter one shows the outcome',
    ]);
    const websitePlan = buildPlan(buildContext(CLIENT, 'website'));
    const websiteIds = websitePlan.items.map((i) => i.anchor.id);
    expect(websiteIds.length).toBeGreaterThan(3); // confirms floor-padding actually fired

    const collateralPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    expect(collateralPlan.items.length).toBe(3); // collateral: one page per must-include, no padding

    const model = await websiteSourcedProgressionModel(websiteIds);
    // Pre-W83: threw on the FIRST padded id (e.g. 'footer', since the sequence is reversed).
    // Post-W83: padded ids are recognized as website's own structural defaults and excluded;
    // the 3 real, brief-derived ids must still fully and exactly cover collateral's plan.
    expect(() => applyProgression(collateralPlan, model, opts)).not.toThrow();
    expect(collateralPlan.items).toHaveLength(3);
    expect(new Set(collateralPlan.items.map((i) => i.governanceReferenceId))).toEqual(
      new Set(collateralPlan.items.map((i) => i.anchor.id)), // brief-derived ids are unaffected by the fix
    );
  });

  it('cross-track identity stability: a brief-derived item has the SAME governanceReferenceId on both tracks', async () => {
    scaffoldClient();
    writeBrief(['Hero: A calmer way to run daily operations', 'Metrics: Proof the numbers move', 'CTA-banner: Talk to the team', 'Footer: Company and contact details', 'Feature-grid: What the platform actually does']);
    const websiteItems = buildPlan(buildContext(CLIENT, 'website')).items;
    const collateralItems = buildPlan(buildContext(CLIENT, 'collateral')).items;
    const websiteRefs = new Set(websiteItems.map((i) => i.governanceReferenceId));
    const collateralRefs = new Set(collateralItems.map((i) => i.governanceReferenceId));
    // Every collateral item's reference id is present in website's reference-id set (both
    // derive from the SAME must-include entries, via the SAME shared derivation).
    for (const id of collateralRefs) expect(websiteRefs.has(id)).toBe(true);
  });

  it('unknown reference still fails loud on collateral (a genuine typo is never excused)', async () => {
    scaffoldClient();
    writeBrief(['Manual work has a hidden cost', 'The connector links every system', 'Quarter one shows the outcome']);
    const collateralPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    const model = await progModel({ encounterSequence: [...collateralPlan.items.map((i) => i.anchor.id).slice(0, 2), 'totally-made-up-nonexistent-section'] });
    expect(() => applyProgression(collateralPlan, model, opts)).toThrow(/unknown|reference/i);
  });

  it('deterministic replay: two independently-built collateral plans reorder identically', async () => {
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
    const model = await websiteSourcedProgressionModel(websiteIds);
    const a = buildPlan(buildContext(CLIENT, 'collateral'));
    const b = buildPlan(buildContext(CLIENT, 'collateral'));
    applyProgression(a, model, opts);
    applyProgression(b, model, opts);
    expect(a.items.map((i) => i.anchor.id)).toEqual(b.items.map((i) => i.anchor.id));
    expect(JSON.stringify(a.items.map((i) => i.reasoning))).toBe(JSON.stringify(b.items.map((i) => i.reasoning)));
  });

  it('mixed authored/unauthored governance packs: an unauthored pack stays a no-op on the SAME plan shape that an authored one reorders', async () => {
    scaffoldClient();
    writeBrief(['Manual work has a hidden cost', 'The connector links every system', 'Quarter one shows the outcome']);
    const websiteIds = buildPlan(buildContext(CLIENT, 'website')).items.map((i) => i.anchor.id);

    const unauthoredPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    const beforeIds = unauthoredPlan.items.map((i) => i.anchor.id);
    applyProgression(unauthoredPlan, await progModel({}), opts); // encounterSequence null — no-op
    expect(unauthoredPlan.items.map((i) => i.anchor.id)).toEqual(beforeIds);
    for (const it of unauthoredPlan.items) expect('reasoning' in it).toBe(false);

    const authoredPlan = buildPlan(buildContext(CLIENT, 'collateral'));
    applyProgression(authoredPlan, await websiteSourcedProgressionModel(websiteIds), opts);
    expect(authoredPlan.items.some((i) => i.reasoning?.orderingRationale)).toBe(true);
  });
});
