/**
 * Sprint W5 — Information Model Consumption (Structural Planning).
 *
 * The FIRST point where planning consults governed reasoning: the World-B planner consumes ONLY the
 * World-A `information` Governance Model and enriches PlanItem.reasoning with information-derived
 * evidence (priority/selection, dependency, cluster, relationship, coverage). It NEVER reorders,
 * re-sequences, generates reasoning, invokes an LLM, changes authoring/prompts/HTML, or consumes any
 * other Model. When no model is supplied the planner is byte-identical; when one is, only planning
 * evidence becomes richer (the website HTML is unchanged — the scripted author ignores reasoning).
 *
 * The information model content shape is unauthored (G1); W5 consumes string / string[] content and
 * FAILS LOUD on any other shape rather than inventing one.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  enrichPlanWithInformation,
  buildInformationEvidence,
  type InformationConsumptionOpts,
} from '../../src/generate/reasoning/information-consumption.js';
import { verifyInformationConsumption } from '../../src/generate/reasoning/verify-information-consumption.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { freezeReasoning } from '../../src/generate/section-reasoning.js';
import { defaultScriptedAuthor, createSubagentAuthor } from '../../src/generate/authoring-seam.js';
import { deriveModels } from '../../src/knowledge/derivation/deriver.js';
import { scriptedDeriver } from '../../src/knowledge/derivation/scripted-deriver.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type RawBrief, type GovernedModel, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem, SectionReasoning } from '../../src/generate/types.js';

// ── World-A model fixtures (real assembly → properly frozen, evidence-bound) ──────
const REPO_ID = 'sha256:' + 'a'.repeat(64);
const repo = { repositoryIdentity: REPO_ID, assetCount: 3 };
const opts: InformationConsumptionOpts = { repositoryIdentity: REPO_ID };
function rawBrief(over: Partial<RawBrief> = {}): RawBrief {
  return { brand: 'Example Brand', oneLiner: 'synthetic', audience: 'ops', goals: ['g'], mustInclude: ['hero'], tone: 'confident', successCriteria: ['book a demo'], body: 'b', ...over };
}
const APA_BRIEF = rawBrief({ oneLiner: 'Autonomous digital workers remove the manual glue between the systems operations teams already run — without replacing the software.' });
function drafts(info: Record<string, unknown>): ModelDraft[] {
  return MODEL_KINDS.map((kind) => ({
    kind,
    categories: Object.fromEntries(MODEL_SCHEMA[kind].categories.map((c) => [c.key, kind === 'information' ? (info[c.key] ?? null) : null])),
    rationale: 'test',
  }));
}
async function buildSet(info: Record<string, unknown>, b = rawBrief()) {
  return deriveModels(b, repo, scriptedDeriver(drafts(info)));
}
async function infoModel(info: Record<string, unknown>, b = rawBrief()): Promise<GovernedModel<'information'>> {
  return (await buildSet(info, b)).models.information;
}

const INFO = {
  informationPriorities: ['hidden cost = critical', 'four layers = high'],
  informationDependencies: ['proof depends on mechanism'],
  informationRelationships: ['mechanism supports proof'],
  informationClusters: ['cost + proof cluster'],
  completenessModel: 'covers all four must-includes',
  // informationDomains intentionally null — W5 does not consume it
};

// ── plan fixtures ────────────────────────────────────────────────────────────────
function item(over: Partial<PlanItem> = {}): PlanItem {
  return { anchor: { id: 'hero', anchor: 'hero' }, archetype: 'hero', tokenRoles: ['--cr-bg'], intent: 'frame the hidden cost', ...over };
}
function planOf(items: PlanItem[]): AuthoringPlan {
  return { track: 'website', items, warnings: [] };
}
function freshPlan(): AuthoringPlan {
  return planOf([item(), item({ anchor: { id: 'proof', anchor: 'proof' }, archetype: 'metrics', intent: 'prove outcomes' })]);
}

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-w5-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
});

// ── consumption maps the information model into reasoning evidence ─────────────────
describe('W5 — enrichPlanWithInformation maps the Information Model into PlanItem.reasoning', () => {
  it('enriches every item with priority+coverage (selection) and dependency+cluster+relationship', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    for (const it of plan.items) {
      expect(it.reasoning).toBeDefined();
      expect(it.reasoning!.selectionRationale).toContain('Information priority: hidden cost = critical; four layers = high');
      expect(it.reasoning!.selectionRationale).toContain('Coverage: covers all four must-includes');
      expect(it.reasoning!.relationships).toContain('Dependencies: proof depends on mechanism');
      expect(it.reasoning!.relationships).toContain('Clusters: cost + proof cluster');
      expect(it.reasoning!.relationships).toContain('Relationships: mechanism supports proof');
    }
  });

  it('preserves priority / dependency / cluster / coverage evidence distinctly (verifiable labels)', async () => {
    const ev = buildInformationEvidence(await infoModel(INFO));
    expect(ev.selectionRationale).toMatch(/Information priority:/);
    expect(ev.selectionRationale).toMatch(/Coverage:/);
    expect(ev.relationships).toMatch(/Dependencies:/);
    expect(ev.relationships).toMatch(/Clusters:/);
  });

  it('NEVER touches ordering / transition / role / communicationObjective (no sequencing change)', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    for (const it of plan.items) {
      expect(it.reasoning!.orderingRationale).toBeUndefined();
      expect(it.reasoning!.transition).toBeUndefined();
      expect(it.reasoning!.role).toBeUndefined();
      expect(it.reasoning!.communicationObjective).toBeUndefined();
    }
  });

  it('does NOT reorder the plan items (selection + ordering unchanged)', async () => {
    const plan = freshPlan();
    const before = plan.items.map((i) => i.anchor.id);
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    expect(plan.items.map((i) => i.anchor.id)).toEqual(before);
  });

  it('produces frozen (immutable) reasoning', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    const r = plan.items[0].reasoning!;
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { selectionRationale?: string }).selectionRationale = 'x';
    }).toThrow();
  });

  it('appends, never overwrites — prior reasoning is preserved and information evidence appended (W13 merge contract)', async () => {
    const plan = planOf([item({ reasoning: freezeReasoning({ selectionRationale: 'pre-existing', role: 'keep me' }) })]);
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    const r = plan.items[0].reasoning!;
    // existing content preserved at the front, W5 evidence appended after ' · ' (no overwrite)
    expect(r.selectionRationale).toBe('pre-existing · Information priority: hidden cost = critical; four layers = high · Coverage: covers all four must-includes');
    expect(r.role).toBe('keep me'); // role is not an information field — untouched
    expect(r.relationships).toContain('Dependencies: proof depends on mechanism'); // empty field: append-to-empty = set
  });

  it('is deterministic — two fresh plans enrich identically', async () => {
    const m = await infoModel(INFO);
    const a = freshPlan();
    const b = freshPlan();
    enrichPlanWithInformation(a, m, opts);
    enrichPlanWithInformation(b, m, opts);
    expect(JSON.stringify(a.items.map((i) => i.reasoning))).toBe(JSON.stringify(b.items.map((i) => i.reasoning)));
  });

  it('consumes the Example Brand APA information model the same way', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModel(INFO, APA_BRIEF), opts);
    expect(plan.items[0].reasoning!.selectionRationale).toMatch(/Information priority:/);
  });
});

// ── default byte-identical ───────────────────────────────────────────────────────
describe('W5 — default behaviour byte-identical', () => {
  it('an un-enriched plan rulebook equals the baseline (no consumption ⇒ no change)', () => {
    const baseline = serializeRulebook(freshPlan(), 'example-brand');
    expect(serializeRulebook(freshPlan(), 'example-brand')).toBe(baseline);
  });

  it('an INERT information model (all consumed content null) enriches nothing — no-op', async () => {
    const plan = freshPlan();
    enrichPlanWithInformation(plan, await infoModel({}), opts); // all categories null
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'example-brand')).toBe(serializeRulebook(freshPlan(), 'example-brand'));
  });

  it('HTML byte-identical — the scripted author emits the same fragment with vs without enrichment', async () => {
    const author = defaultScriptedAuthor();
    const plain = await author.author({ item: item(), guidance: '', oneLiner: 'x', tone: 't' });
    const plan = planOf([item()]);
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    const enriched = await author.author({ item: plan.items[0], guidance: '', oneLiner: 'x', tone: 't' });
    expect(enriched).toBe(plain);
  });

  it('the author request carries the enriched reasoning (W2 transport)', async () => {
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<x/>' });
    const plan = planOf([item()]);
    enrichPlanWithInformation(plan, await infoModel(INFO), opts);
    await author.author({ item: plan.items[0], guidance: '', oneLiner: 'Test', tone: 'confident' });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).toContain('## Section Intent');
    expect(md).toContain('Information priority: hidden cost = critical');
    expect(md).toContain('Dependencies: proof depends on mechanism');
  });
});

// ── fail loud ────────────────────────────────────────────────────────────────────
describe('W5 — fail-loud validation (never infer, never repair)', () => {
  it('fails when the Information Model is missing', () => {
    expect(() => enrichPlanWithInformation(freshPlan(), undefined as unknown as GovernedModel<'information'>, opts)).toThrow(/missing|information model/i);
  });

  it('ignores all six remaining Models — passing any non-information Model throws', async () => {
    const set = await buildSet(INFO);
    for (const kind of MODEL_KINDS.filter((k) => k !== 'information') as ModelKind[]) {
      expect(() => enrichPlanWithInformation(freshPlan(), set.models[kind] as unknown as GovernedModel<'information'>, opts)).toThrow(/information|model/i);
    }
  });

  it('fails on a mutable (non-frozen) model', () => {
    const mutable = { kind: 'information', result: { informationPriorities: { content: ['p'], governanceRef: { document: 'INFORMATION_ARCHITECTURE.md', section: '§13' } } }, evidence: { repositoryIdentity: REPO_ID } } as unknown as GovernedModel<'information'>;
    expect(() => enrichPlanWithInformation(freshPlan(), mutable, opts)).toThrow(/immutable|frozen|mutable/i);
  });

  it('fails on unknown categories', () => {
    const unknown = Object.freeze({
      kind: 'information',
      result: Object.freeze({ bogusCategory: Object.freeze({ content: 'x', governanceRef: Object.freeze({ document: 'INFORMATION_ARCHITECTURE.md', section: '§13' }) }) }),
      evidence: Object.freeze({ repositoryIdentity: REPO_ID }),
    }) as unknown as GovernedModel<'information'>;
    expect(() => enrichPlanWithInformation(freshPlan(), unknown, opts)).toThrow(/unknown|categor/i);
  });

  it('fails on a repository mismatch', async () => {
    const m = await infoModel(INFO);
    expect(() => enrichPlanWithInformation(freshPlan(), m, { repositoryIdentity: 'sha256:' + 'b'.repeat(64) })).toThrow(/repository|mismatch/i);
  });

  it('fails on malformed evidence (non-string/array content)', async () => {
    const m = await infoModel({ informationPriorities: 5 });
    expect(() => enrichPlanWithInformation(freshPlan(), m, opts)).toThrow(/malformed|shape|priorit/i);
  });

  it('fails on broken dependencies (empty / non-string entry)', async () => {
    const m = await infoModel({ informationDependencies: ['valid', ''] });
    expect(() => enrichPlanWithInformation(freshPlan(), m, opts)).toThrow(/dependenc|malformed|broken/i);
  });
});

// ── the harness ──────────────────────────────────────────────────────────────────
describe('W5 — verification harness', () => {
  it('verifies a consumption run: enrichment, immutability, evidence preserved, scope, replay', async () => {
    const report = await verifyInformationConsumption(freshPlan(), await infoModel(INFO), opts);
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['existence', 'immutability', 'evidence', 'scope', 'replay']) {
      expect(cats.has(dim as never)).toBe(true);
    }
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it('verifies the Example Brand APA model the same way', async () => {
    const report = await verifyInformationConsumption(freshPlan(), await infoModel(INFO, APA_BRIEF), opts);
    expect(report.ok).toBe(true);
  });

  it('reports NOT ok when consumption fails (repository mismatch)', async () => {
    const report = await verifyInformationConsumption(freshPlan(), await infoModel(INFO), { repositoryIdentity: 'sha256:' + 'c'.repeat(64) });
    expect(report.ok).toBe(false);
  });
});
