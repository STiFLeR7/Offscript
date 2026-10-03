/**
 * Sprint W4 — Governed Reasoning Runtime (Shadow Mode).
 *
 * The FIRST operational governed reasoning runtime, built behind the W3 ReasoningProducer seam,
 * following GOVERNED-REASONING-RUNTIME-ARCHITECTURE.md: validate → acquire governance snapshot →
 * invoke the INJECTED (provider-agnostic) reasoning unit → validate → freeze → attach evidence →
 * return. The reasoning is an OBSERVABLE artifact with an evidence chain (reasoner, governance
 * snapshot id, brief identity, reasoning version, trace id) and a recipe-replay guarantee.
 *
 * Shadow mode: the runtime is real and proven here, but it is NOT wired into the default generate
 * pipeline (the only reasoning unit available is a test double; production keeps the inert W3
 * default). So the planner ignores reasoning and the website stays byte-identical. When the governed
 * producer IS used, reasoning reaches PlanItem.reasoning → the Author request (W2 transport) — the
 * Author RECEIVES it — but the scripted author ignores it, so HTML is byte-identical.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  snapshotGovernance,
  reasoningDigest,
  type GovernanceSnapshot,
} from '../../src/generate/reasoning/governance-snapshot.js';
import {
  runGovernedReasoning,
  createGovernedReasoningProducer,
  scriptedReasoningUnit,
  createSubagentReasoningUnit,
  computeTraceId,
  validateEvidence,
  REASONING_RUNTIME_VERSION,
  type GovernedReasoningDeps,
  type ReasoningEvidence,
  type RawReasoning,
} from '../../src/generate/reasoning/governed-producer.js';
import { verifyGovernedReasoning } from '../../src/generate/reasoning/verify-reasoning.js';
import { produceReasoning } from '../../src/generate/reasoning/producer.js';
import { defaultScriptedProducer } from '../../src/generate/reasoning/scripted-producer.js';
import type { ReasoningContext } from '../../src/generate/reasoning/types.js';
import { defaultScriptedAuthor, createSubagentAuthor } from '../../src/generate/authoring-seam.js';
import type { PlanItem, SectionReasoning } from '../../src/generate/types.js';

// ── fixtures ──────────────────────────────────────────────────────────────────
function item(over: Partial<PlanItem> = {}): PlanItem {
  return { anchor: { id: 'hero', anchor: 'hero' }, archetype: 'hero', tokenRoles: ['--cr-bg'], intent: 'frame the hidden cost', ...over };
}
function ctx(over: Partial<ReasoningContext> = {}): ReasoningContext {
  return { item: item(), track: 'website', oneLiner: 'Synthetic product', ...over };
}
// Example Brand APA — the one-liner verbatim from GRR §3.3 (the proof brief).
const APA_ONELINER =
  'Autonomous digital workers remove the manual glue between the systems operations teams already run — without replacing the software.';
function apaCtx(): ReasoningContext {
  return { item: item({ intent: 'frame the hidden cost of manual glue' }), track: 'website', oneLiner: APA_ONELINER };
}
const GROUNDING =
  'PAGE_STRUCTURE.md §12 — Progression: a page is an ordered sequence of progression units, each handing to the next toward the success criterion (encounter sequence, transition logic, per-unit objectives).';
const FULL: SectionReasoning = {
  role: 'open the diagnostic tension',
  selectionRationale: 'hero over feature-grid: the brief leads with a cost problem',
  orderingRationale: 'first — everything downstream answers this tension',
  transition: 'hands to the mechanism reveal',
  relationships: 'sets up the proof section',
  communicationObjective: 'make the reader feel the cost they already pay',
};

function deps(verdict: RawReasoning | ((req: { context: ReasoningContext; governanceGrounding: string }) => RawReasoning) = { reasoning: FULL }, grounding = GROUNDING): GovernedReasoningDeps {
  return {
    reasoningUnit: scriptedReasoningUnit(verdict),
    acquireSnapshot: () => snapshotGovernance(grounding),
  };
}

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-w4-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
});

// ── governance snapshot ─────────────────────────────────────────────────────────
describe('W4 — governance snapshot acquisition (G2)', () => {
  it('snapshotGovernance content-hashes the grounding into a sha256 id', () => {
    const snap = snapshotGovernance(GROUNDING);
    expect(snap.grounding).toBe(GROUNDING);
    expect(snap.id).toBe(reasoningDigest(GROUNDING));
    expect(snap.id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.isFrozen(snap)).toBe(true);
  });
  it('fails loud on missing / empty governance grounding', () => {
    expect(() => snapshotGovernance('')).toThrow(/governance|grounding/i);
    expect(() => snapshotGovernance('   ')).toThrow(/governance|grounding/i);
  });
});

// ── the runtime lifecycle ───────────────────────────────────────────────────────
describe('W4 — runGovernedReasoning produces an evidence-bearing, immutable artifact', () => {
  it('returns a frozen reasoning + a complete evidence chain', async () => {
    const art = await runGovernedReasoning(deps(), ctx());
    expect(art).toBeDefined();
    expect(art!.reasoning).toEqual(FULL);
    expect(Object.isFrozen(art!.reasoning)).toBe(true);
    expect(Object.isFrozen(art!.evidence)).toBe(true);
    const ev = art!.evidence;
    expect(ev.reasoner).toBe('reasoning::unit-scripted');
    expect(ev.governanceSnapshotId).toBe(reasoningDigest(GROUNDING));
    expect(ev.briefIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(ev.reasoningVersion).toBe(REASONING_RUNTIME_VERSION);
    expect(ev.traceId).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('the reasoning artifact is immutable (mutation throws)', async () => {
    const art = await runGovernedReasoning(deps(), ctx());
    expect(() => {
      (art!.reasoning as { role?: string }).role = 'mutated';
    }).toThrow();
    expect(() => {
      (art!.evidence as { reasoner?: string }).reasoner = 'mutated';
    }).toThrow();
  });

  it('is deterministic — same deps + context reproduce the same artifact incl. trace id', async () => {
    const a = await runGovernedReasoning(deps(), ctx());
    const b = await runGovernedReasoning(deps(), ctx());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('binds different briefs to different identities (APA ≠ synthetic)', async () => {
    const a = await runGovernedReasoning(deps(), ctx());
    const b = await runGovernedReasoning(deps(), apaCtx());
    expect(a!.evidence.briefIdentity).not.toBe(b!.evidence.briefIdentity);
    expect(a!.evidence.traceId).not.toBe(b!.evidence.traceId);
  });

  it('invokes the injected reasoning unit exactly once and grounds it on the snapshot text', async () => {
    let calls = 0;
    let grounded = '';
    const d: GovernedReasoningDeps = {
      reasoningUnit: scriptedReasoningUnit((req) => {
        calls++;
        grounded = req.governanceGrounding;
        return { reasoning: { role: 'open' } };
      }),
      acquireSnapshot: () => snapshotGovernance(GROUNDING),
    };
    await runGovernedReasoning(d, ctx());
    expect(calls).toBe(1);
    expect(grounded).toBe(GROUNDING);
  });

  it('a declining unit ({} / undefined reasoning) produces no artifact (undefined)', async () => {
    expect(await runGovernedReasoning(deps({ reasoning: undefined }), ctx())).toBeUndefined();
    expect(await runGovernedReasoning(deps({ reasoning: {} }), ctx())).toBeUndefined();
  });

  it('injection is provider-agnostic — an async subagent unit is awaited the same way', async () => {
    const d: GovernedReasoningDeps = {
      reasoningUnit: createSubagentReasoningUnit({ dispatch: async () => ({ reasoning: { communicationObjective: 'book a demo' } }) }),
      acquireSnapshot: () => snapshotGovernance(GROUNDING),
    };
    const art = await runGovernedReasoning(d, ctx());
    expect(art!.reasoning).toEqual({ communicationObjective: 'book a demo' });
    expect(art!.evidence.reasoner).toBe('reasoning::unit-subagent');
  });
});

// ── fail-loud validation ─────────────────────────────────────────────────────────
describe('W4 — fail-loud validation (never repair, never infer)', () => {
  it('fails on missing governance (snapshot empty / invalid)', async () => {
    const noGov: GovernedReasoningDeps = { reasoningUnit: scriptedReasoningUnit({ reasoning: FULL }), acquireSnapshot: () => ({ id: '', grounding: '' } as GovernanceSnapshot) };
    await expect(runGovernedReasoning(noGov, ctx())).rejects.toThrow(/governance|snapshot/i);
  });
  it('fails on a tampered snapshot (id does not match grounding)', async () => {
    const tampered: GovernedReasoningDeps = { reasoningUnit: scriptedReasoningUnit({ reasoning: FULL }), acquireSnapshot: () => ({ id: reasoningDigest('something else'), grounding: GROUNDING } as GovernanceSnapshot) };
    await expect(runGovernedReasoning(tampered, ctx())).rejects.toThrow(/snapshot|match|tamper/i);
  });
  it('fails on malformed reasoning from the unit (unknown key / empty / non-string)', async () => {
    await expect(runGovernedReasoning(deps({ reasoning: { bogus: 'x' } as unknown as SectionReasoning }), ctx())).rejects.toThrow(/unknown|reasoning/i);
    await expect(runGovernedReasoning(deps({ reasoning: { role: '  ' } }), ctx())).rejects.toThrow(/empty|reasoning/i);
    await expect(runGovernedReasoning(deps({ reasoning: { role: 5 as unknown as string } }), ctx())).rejects.toThrow(/string|reasoning/i);
  });
  it('fails on an invalid context (no plan item)', async () => {
    await expect(runGovernedReasoning(deps(), {} as ReasoningContext)).rejects.toThrow(/context|item/i);
  });
  it('fails at construction on invalid deps (no unit / no acquireSnapshot)', () => {
    expect(() => createGovernedReasoningProducer({ acquireSnapshot: () => snapshotGovernance(GROUNDING) } as unknown as GovernedReasoningDeps)).toThrow(/unit|deps/i);
    expect(() => createGovernedReasoningProducer({ reasoningUnit: scriptedReasoningUnit() } as unknown as GovernedReasoningDeps)).toThrow(/snapshot|deps|acquire/i);
  });
  it('validateEvidence rejects evidence with a missing trace / invalid field', () => {
    const sound: ReasoningEvidence = { reasoner: 'r', governanceSnapshotId: reasoningDigest('g'), briefIdentity: reasoningDigest('b'), reasoningVersion: REASONING_RUNTIME_VERSION, traceId: reasoningDigest('t') };
    expect(() => validateEvidence(sound)).not.toThrow();
    expect(() => validateEvidence({ ...sound, traceId: '' })).toThrow(/trace/i);
    expect(() => validateEvidence({ ...sound, reasoner: '' })).toThrow(/reasoner|evidence/i);
    expect(() => validateEvidence({ ...sound, governanceSnapshotId: 'not-a-hash' })).toThrow(/snapshot|hash|evidence/i);
  });
});

// ── the harness ──────────────────────────────────────────────────────────────────
describe('W4 — verification harness', () => {
  it('verifies a governed run end-to-end: existence, immutability, evidence, governance, replay, transport', async () => {
    const report = await verifyGovernedReasoning(deps(), ctx());
    expect(report.ok).toBe(true);
    const cats = new Set(report.checks.map((c) => c.category));
    for (const dim of ['existence', 'immutability', 'evidence', 'governance', 'replay', 'transport']) {
      expect(cats.has(dim as never)).toBe(true);
    }
    expect(report.checks.every((c) => c.passed)).toBe(true);
  });

  it('verifies the Example Brand APA brief the same way', async () => {
    const report = await verifyGovernedReasoning(deps(), apaCtx());
    expect(report.ok).toBe(true);
  });

  it('replay recipe valid — the trace id recomputes from the persisted artifact with NO reasoner call', async () => {
    const art = await runGovernedReasoning(deps(), apaCtx());
    const recomputed = computeTraceId({
      reasoner: art!.evidence.reasoner,
      governanceSnapshotId: art!.evidence.governanceSnapshotId,
      briefIdentity: art!.evidence.briefIdentity,
      reasoningVersion: art!.evidence.reasoningVersion,
      sectionId: apaCtx().item.anchor.id,
      reasoning: art!.reasoning,
    });
    expect(recomputed).toBe(art!.evidence.traceId);
  });

  it('the harness reports NOT ok when the runtime fails (missing governance)', async () => {
    const bad: GovernedReasoningDeps = { reasoningUnit: scriptedReasoningUnit({ reasoning: FULL }), acquireSnapshot: () => ({ id: '', grounding: '' } as GovernanceSnapshot) };
    const report = await verifyGovernedReasoning(bad, ctx());
    expect(report.ok).toBe(false);
  });
});

// ── the governed producer plugs into the W3 seam ──────────────────────────────────
describe('W4 — createGovernedReasoningProducer behind the W3 producer seam', () => {
  it('produceReasoning(governed) returns the frozen reasoning (clean SectionReasoning, no evidence leakage)', async () => {
    const out = await produceReasoning(createGovernedReasoningProducer(deps()), ctx());
    expect(out).toEqual(FULL);
    expect(Object.isFrozen(out)).toBe(true);
    expect('evidence' in (out as object)).toBe(false); // evidence rides the artifact, NOT PlanItem.reasoning
  });
  it('a declining unit → produceReasoning returns undefined (inert, like W3)', async () => {
    expect(await produceReasoning(createGovernedReasoningProducer(deps({ reasoning: undefined })), ctx())).toBeUndefined();
  });
});

// ── planner ignores · HTML byte-identical · author receives · transport preserved ──
describe('W4 — shadow-mode guarantees', () => {
  async function attach(items: PlanItem[], producer = createGovernedReasoningProducer(deps())): Promise<PlanItem[]> {
    for (const it of items) {
      const r = await produceReasoning(producer, { item: it, track: 'website', oneLiner: 'x' });
      if (r !== undefined) it.reasoning = r;
    }
    return items;
  }

  it('HTML byte-identical — the scripted author emits the same fragment with vs without reasoning', async () => {
    const author = defaultScriptedAuthor();
    const plain = await author.author({ item: item(), guidance: '', oneLiner: 'x', tone: 't' });
    const [withR] = await attach([item()]);
    const reasoned = await author.author({ item: withR, guidance: '', oneLiner: 'x', tone: 't' });
    expect(reasoned).toBe(plain);
  });

  it('author RECEIVES reasoning — the request markdown gains the W2 Section Intent block (transport preserved)', async () => {
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<x/>' });
    const [it] = await attach([item()]);
    await author.author({ item: it, guidance: '', oneLiner: 'Test product', tone: 'confident' });
    const md = readFileSync(join(dispatchDir, `${it.anchor.id}.request.md`), 'utf8');
    expect(md).toContain('## Section Intent');
    expect(md).toContain('- **Role:** open the diagnostic tension');
    expect(md).toContain('- **Communication objective:** make the reader feel the cost they already pay');
  });

  it('the deterministic scripted producer (W3) is unaffected — still produces nothing', async () => {
    expect(await defaultScriptedProducer().produce(ctx())).toEqual({ reasoning: undefined });
    expect(await produceReasoning(defaultScriptedProducer(), ctx())).toBeUndefined();
  });
});
