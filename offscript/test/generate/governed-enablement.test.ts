/**
 * Sprint W15 — Governed Production Enablement.
 *
 * Proves the production enablement seam end-to-end with the SAME composition scripts/generate.ts uses:
 *   persisted Governed Producer drafts → loadGovernanceDrafts → deriveGovernanceModels (World-A
 *   deriveModels) → enrichPlanWithGovernedReasoning (the W13 orchestrator) → PlanItem.reasoning →
 *   the W2 Section Intent block in the author request.
 *
 * No model pack (the default) ⇒ undefined ⇒ orchestrator no-op ⇒ byte-identical (the disabled mode).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadGovernanceDrafts,
  deriveGovernanceModels,
  GOVERNANCE_PACK_FILENAME,
} from '../../src/generate/reasoning/governance-pack.js';
import { enrichPlanWithGovernedReasoning, GOVERNED_REASONING_ORDER } from '../../src/generate/reasoning/reasoning-orchestrator.js';
import { createSubagentAuthor } from '../../src/generate/authoring-seam.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { MODEL_KINDS, MODEL_SCHEMA, type ModelDraft, type ModelKind } from '../../src/knowledge/derivation/models.js';
import type { AuthoringPlan, PlanItem } from '../../src/generate/types.js';

const REPO_ID = 'sha256:' + 'a'.repeat(64);
const BRIEF = { brand: 'Acme', oneLiner: 'Acme removes the manual glue between systems', audience: 'ops', goals: ['demo'], mustInclude: ['hero'], tone: 'confident', successCriteria: ['book'], body: 'b' };
const IDS = ['hero', 'mechanism', 'proof', 'cta'];

function draftsAll(per: Partial<Record<ModelKind, Record<string, unknown>>>): ModelDraft[] {
  return MODEL_KINDS.map((kind) => ({
    kind,
    categories: Object.fromEntries(MODEL_SCHEMA[kind].categories.map((c) => [c.key, per[kind]?.[c.key] ?? null])),
    rationale: 'w15-test',
  }));
}
function fullPack(): ModelDraft[] {
  return draftsAll({
    communication: { perceptualEntry: ['headline first'], beliefFormation: ['claim → proof'] },
    information: { informationPriorities: ['cost = critical'] },
    progression: { encounterSequence: ['cta', 'hero', 'proof', 'mechanism'], progressionObjectives: ['convert', 'orient', 'prove', 'reveal'] },
    spatial: { spatialAllocation: ['hero dominant'] },
    mechanism: { requiredMechanisms: IDS, purposes: ['orient', 'reveal', 'prove', 'convert'], responsibilities: ['establish context', 'carry capability', 'evidence claim', 'convert intent'] },
    visual: { perceivedAffordance: ['clickable cta'] },
    experienceCharacter: { experienceCharacter: ['calm, precise'] },
  });
}
function planOf(ids: string[]): AuthoringPlan {
  return { track: 'website', items: ids.map((id) => ({ anchor: { id, anchor: id }, archetype: 'hero', tokenRoles: ['--cr-bg'], intent: id })) as PlanItem[], warnings: [] };
}

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-w15-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
});

// ── enablement: persist → load → derive → orchestrate ───────────────────────────────
describe('W15 — Governed Producer enablement (pack → models → orchestrator)', () => {
  it('loadGovernanceDrafts returns undefined when no pack is present (disabled, byte-identical)', () => {
    const dir = freshDir();
    expect(loadGovernanceDrafts(join(dir, GOVERNANCE_PACK_FILENAME))).toBeUndefined();
  });

  it('loads persisted drafts and derives the seven Governance Models', async () => {
    const dir = freshDir();
    const path = join(dir, GOVERNANCE_PACK_FILENAME);
    writeFileSync(path, JSON.stringify(fullPack()), 'utf8');
    const drafts = loadGovernanceDrafts(path)!;
    expect(drafts).toHaveLength(7);
    const models = await deriveGovernanceModels(drafts, BRIEF, REPO_ID);
    expect(Object.keys(models.models).sort()).toEqual([...MODEL_KINDS].sort());
    for (const k of MODEL_KINDS) expect(models.models[k].kind).toBe(k);
  });

  it('feeds the orchestrator → all seven consumers run, reasoning is populated', async () => {
    const dir = freshDir();
    const path = join(dir, GOVERNANCE_PACK_FILENAME);
    writeFileSync(path, JSON.stringify(fullPack()), 'utf8');
    const models = await deriveGovernanceModels(loadGovernanceDrafts(path)!, BRIEF, REPO_ID);
    const plan = planOf(IDS);
    const result = enrichPlanWithGovernedReasoning(plan, { models });
    expect(result.enabled).toBe(true);
    expect(result.applied).toEqual([...GOVERNED_REASONING_ORDER]);
    for (const it of plan.items) {
      expect(it.reasoning).toBeDefined();
      expect(Object.isFrozen(it.reasoning)).toBe(true);
    }
  });

  it('progression reorders the plan under enablement (governed ordering)', async () => {
    const models = await deriveGovernanceModels(fullPack(), BRIEF, REPO_ID);
    const plan = planOf(IDS);
    enrichPlanWithGovernedReasoning(plan, { models });
    expect(plan.items.map((i) => i.anchor.id)).toEqual(['cta', 'hero', 'proof', 'mechanism']);
  });

  it('the author request carries the Section Intent block once reasoning is populated (W2 transport)', async () => {
    const dispatchDir = freshDir();
    const models = await deriveGovernanceModels(fullPack(), BRIEF, REPO_ID);
    const plan = planOf(IDS);
    enrichPlanWithGovernedReasoning(plan, { models });
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<section/>' });
    const hero = plan.items.find((i) => i.anchor.id === 'hero')!;
    await author.author({ item: hero, guidance: '', oneLiner: BRIEF.oneLiner, tone: 'confident' });
    const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
    expect(md).toContain('## Section Intent');
    expect(md).toContain('Role:');               // Mechanism → role
    expect(md).toContain('Communication objective:'); // Communication/Visual/Experience
    expect(md).toContain('Ordering rationale:');  // Progression
  });
});

// ── disabled mode: byte-identical ───────────────────────────────────────────────────
describe('W15 — disabled mode (no pack) is byte-identical', () => {
  it('no pack ⇒ orchestrator no-op ⇒ plan untouched, rulebook equals baseline', () => {
    const dir = freshDir();
    const drafts = loadGovernanceDrafts(join(dir, GOVERNANCE_PACK_FILENAME)); // undefined
    const plan = planOf(IDS);
    const result = enrichPlanWithGovernedReasoning(plan, { models: drafts ? undefined : undefined });
    expect(result.enabled).toBe(false);
    for (const it of plan.items) expect('reasoning' in it).toBe(false);
    expect(serializeRulebook(plan, 'acme')).toBe(serializeRulebook(planOf(IDS), 'acme'));
  });

  it('a malformed pack file fails loud (never silently disables)', () => {
    const dir = freshDir();
    const path = join(dir, GOVERNANCE_PACK_FILENAME);
    writeFileSync(path, '{"not":"an array"}', 'utf8');
    expect(() => loadGovernanceDrafts(path)).toThrow(/array|drafts/i);
  });
});
