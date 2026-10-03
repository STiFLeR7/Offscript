/**
 * Sprint W3 — Reasoning Producer Seam.
 *
 * The producer BOUNDARY only — not real reasoning, not heuristics, not LLM generation, not a
 * planner redesign. Tomorrow's planner will produce PlanItem + SectionReasoning; this sprint
 * builds the seam that lets it. The DEFAULT scripted producer produces NOTHING
 * (`{ reasoning: undefined }`), so the default path is byte-identical and no HTML changes.
 *
 * Structure mirrors the derivation seam (scripted-deriver.ts) and the director/critic seams:
 * a deterministic scripted DOUBLE (inert default), a test fixture, and an unwired in-session
 * subagent seam — with a deterministic lifecycle (validate → invoke → validate → freeze → return).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  defaultScriptedProducer,
  scriptedProducer,
  createSubagentProducer,
} from '../../src/generate/reasoning/scripted-producer.js';
import { produceReasoning } from '../../src/generate/reasoning/producer.js';
import type {
  ReasoningContext,
  ReasoningProducer,
  ReasoningResult,
} from '../../src/generate/reasoning/types.js';
import { serializeRulebook } from '../../src/generate/plan.js';
import { createSubagentAuthor } from '../../src/generate/authoring-seam.js';
import type { AuthoringPlan, PlanItem, SectionReasoning } from '../../src/generate/types.js';

// ── fixtures ──────────────────────────────────────────────────────────────────
function item(over: Partial<PlanItem> = {}): PlanItem {
  return {
    anchor: { id: 'hero', anchor: 'hero' },
    archetype: 'hero',
    tokenRoles: ['--cr-bg'],
    intent: 'frame the hidden cost',
    ...over,
  };
}
function ctx(over: Partial<ReasoningContext> = {}): ReasoningContext {
  return { item: item(), track: 'website', oneLiner: 'Test product', ...over };
}
function planOf(items: PlanItem[]): AuthoringPlan {
  return { track: 'website', items, warnings: [] };
}
const FULL: SectionReasoning = {
  role: 'open the diagnostic tension',
  selectionRationale: 'hero over feature-grid: the brief leads with a cost problem',
  orderingRationale: 'first — everything downstream answers this tension',
  transition: 'hands to the mechanism reveal',
  relationships: 'sets up the proof section',
  communicationObjective: 'make the reader feel the cost they already pay',
};

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-w3-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
});

// ── the scripted producer is inert by default ──────────────────────────────────
describe('W3 — default scripted producer produces nothing', () => {
  it('defaultScriptedProducer().produce(ctx) returns { reasoning: undefined }', async () => {
    const p = defaultScriptedProducer();
    expect(typeof p.name).toBe('string');
    expect(p.name.length).toBeGreaterThan(0);
    expect(await p.produce(ctx())).toEqual({ reasoning: undefined });
  });

  it('produceReasoning with the default producer returns undefined for any context', async () => {
    const p = defaultScriptedProducer();
    expect(await produceReasoning(p, ctx())).toBeUndefined();
    expect(await produceReasoning(p, ctx({ item: item({ archetype: 'footer', anchor: { id: 'footer', anchor: 'footer' } }) }))).toBeUndefined();
  });
});

// ── lifecycle: validate → invoke → validate → freeze → return ───────────────────
describe('W3 — produceReasoning lifecycle', () => {
  it('invokes the injected producer exactly once', async () => {
    let calls = 0;
    const counting: ReasoningProducer = {
      name: 'reasoning::counting',
      produce: () => {
        calls++;
        return { reasoning: undefined };
      },
    };
    await produceReasoning(counting, ctx());
    expect(calls).toBe(1);
  });

  it('returns a deep-frozen reasoning when the producer emits one (immutable output)', async () => {
    const out = await produceReasoning(scriptedProducer({ reasoning: { role: 'open' } }), ctx());
    expect(out).toEqual({ role: 'open' });
    expect(Object.isFrozen(out)).toBe(true);
    expect(() => {
      (out as { role?: string }).role = 'mutated';
    }).toThrow();
  });

  it('strips undefined fields and never mutates the producer-returned object', async () => {
    const returned: ReasoningResult = { reasoning: { role: 'open', transition: undefined } };
    const out = await produceReasoning(scriptedProducer(returned), ctx());
    expect(out).toEqual({ role: 'open' }); // undefined transition stripped
    // the producer's own object is untouched (lifecycle copies before freezing)
    expect(returned.reasoning && Object.isFrozen(returned.reasoning)).toBeFalsy();
  });

  it('treats an empty channel ({} or all-undefined) as "produced nothing"', async () => {
    expect(await produceReasoning(scriptedProducer({ reasoning: {} }), ctx())).toBeUndefined();
    expect(await produceReasoning(scriptedProducer({ reasoning: { role: undefined } }), ctx())).toBeUndefined();
    expect(await produceReasoning(scriptedProducer({}), ctx())).toBeUndefined();
    expect(await produceReasoning(scriptedProducer(undefined as unknown as ReasoningResult), ctx())).toBeUndefined();
  });

  it('is deterministic — same producer + same context replays identically', async () => {
    const p = scriptedProducer({ reasoning: FULL });
    const a = await produceReasoning(p, ctx());
    const b = await produceReasoning(p, ctx());
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('injection works for an async (subagent) producer — the lifecycle awaits it', async () => {
    const sub = createSubagentProducer({
      dispatch: async () => ({ reasoning: { communicationObjective: 'book a demo' } }),
    });
    const out = await produceReasoning(sub, ctx());
    expect(out).toEqual({ communicationObjective: 'book a demo' });
    expect(Object.isFrozen(out)).toBe(true);
  });
});

// ── fail-loud validation (never repair, never infer) ────────────────────────────
describe('W3 — fail-loud validation', () => {
  it('rejects an invalid producer (null / no produce / empty name)', async () => {
    await expect(produceReasoning(null as unknown as ReasoningProducer, ctx())).rejects.toThrow(/producer/i);
    await expect(produceReasoning({ name: 'x' } as unknown as ReasoningProducer, ctx())).rejects.toThrow(/producer/i);
    await expect(
      produceReasoning({ name: '', produce: () => ({ reasoning: undefined }) } as ReasoningProducer, ctx()),
    ).rejects.toThrow(/producer/i);
  });

  it('rejects an invalid context (no plan item)', async () => {
    await expect(produceReasoning(defaultScriptedProducer(), {} as ReasoningContext)).rejects.toThrow(/context|item/i);
  });

  it('rejects a reasoning with an unknown key', async () => {
    const bad = scriptedProducer({ reasoning: { bogus: 'x' } as unknown as SectionReasoning });
    await expect(produceReasoning(bad, ctx())).rejects.toThrow(/unknown|reasoning/i);
  });

  it('rejects a reasoning field that is an empty string', async () => {
    const bad = scriptedProducer({ reasoning: { role: '   ' } });
    await expect(produceReasoning(bad, ctx())).rejects.toThrow(/empty|reasoning/i);
  });

  it('rejects a reasoning field that is not a string (number / object / function / array)', async () => {
    await expect(produceReasoning(scriptedProducer({ reasoning: { role: 5 as unknown as string } }), ctx())).rejects.toThrow(/string|reasoning/i);
    await expect(produceReasoning(scriptedProducer({ reasoning: { role: {} as unknown as string } }), ctx())).rejects.toThrow(/string|reasoning/i);
    await expect(produceReasoning(scriptedProducer({ reasoning: { role: (() => 'x') as unknown as string } }), ctx())).rejects.toThrow(/string|reasoning/i);
    await expect(produceReasoning(scriptedProducer({ reasoning: { role: [] as unknown as string } }), ctx())).rejects.toThrow(/string|reasoning/i);
  });

  it('rejects a result whose reasoning is an array / number / function (not a SectionReasoning object)', async () => {
    await expect(produceReasoning(scriptedProducer({ reasoning: [] as unknown as SectionReasoning }), ctx())).rejects.toThrow(/reasoning/i);
    await expect(produceReasoning(scriptedProducer({ reasoning: 5 as unknown as SectionReasoning }), ctx())).rejects.toThrow(/reasoning/i);
    await expect(produceReasoning(scriptedProducer({ reasoning: (() => ({})) as unknown as SectionReasoning }), ctx())).rejects.toThrow(/reasoning/i);
  });

  it('rejects a result that is not a ReasoningResult object (array / number / function)', async () => {
    // Build raw producers: scriptedProducer treats a function verdict as a verdict-COMPUTER
    // (by design), so a function-shaped *result* must come from a hand-built produce().
    const raw = (value: unknown): ReasoningProducer => ({ name: 'reasoning::raw', produce: () => value as ReasoningResult });
    await expect(produceReasoning(raw([]), ctx())).rejects.toThrow(/result|reasoning/i);
    await expect(produceReasoning(raw(5), ctx())).rejects.toThrow(/result|reasoning/i);
    await expect(produceReasoning(raw(() => ({})), ctx())).rejects.toThrow(/result|reasoning/i);
  });
});

// ── default path byte-identical (the planner integration is a no-op under default) ──
describe('W3 — default path byte-identical (no plan / HTML / serialization change)', () => {
  // Simulate the generate.ts Stage-2 attach loop: produce per item, attach only when non-undefined.
  async function attach(items: PlanItem[], producer: ReasoningProducer): Promise<PlanItem[]> {
    for (const it of items) {
      const r = await produceReasoning(producer, { item: it, track: 'website', oneLiner: 'x' });
      if (r !== undefined) it.reasoning = r;
    }
    return items;
  }

  it('the default-producer attach loop leaves every item reasoning-free', async () => {
    const items = await attach([item(), item({ anchor: { id: 'footer', anchor: 'footer' }, archetype: 'footer', intent: 'close' })], defaultScriptedProducer());
    for (const it of items) expect('reasoning' in it).toBe(false);
  });

  it('rulebook is byte-identical to a plan that never saw a producer', async () => {
    const baseline = serializeRulebook(planOf([item(), item({ anchor: { id: 'cta', anchor: 'cta' }, archetype: 'cta-banner', intent: 'ask' })]), 'example-brand');
    const withLoop = serializeRulebook(planOf(await attach([item(), item({ anchor: { id: 'cta', anchor: 'cta' }, archetype: 'cta-banner', intent: 'ask' })], defaultScriptedProducer())), 'example-brand');
    expect(withLoop).toBe(baseline);
  });

  it('the author request is byte-identical under the default producer (no Section Intent)', async () => {
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<x/>' });
    const [it] = await attach([item()], defaultScriptedProducer());
    await author.author({ item: it, guidance: '', oneLiner: 'Test product', tone: 'confident' });
    const md = readFileSync(join(dispatchDir, `${it.anchor.id}.request.md`), 'utf8');
    expect(md).not.toContain('## Section Intent');
  });
});

// ── the reasoning pipeline is now complete: Producer → PlanItem → Author request ──
describe('W3 — producer-populated reasoning still transports to the Author request (W2 path)', () => {
  it('a producer that emits reasoning flows through attach → request markdown', async () => {
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<x/>' });
    const it = item();
    const r = await produceReasoning(scriptedProducer({ reasoning: FULL }), { item: it, track: 'website', oneLiner: 'x' });
    if (r !== undefined) it.reasoning = r;
    await author.author({ item: it, guidance: '', oneLiner: 'Test product', tone: 'confident' });
    const md = readFileSync(join(dispatchDir, `${it.anchor.id}.request.md`), 'utf8');
    expect(md).toContain('## Section Intent');
    expect(md).toContain('- **Role:** open the diagnostic tension');
    expect(md).toContain('- **Communication objective:** make the reader feel the cost they already pay');
  });
});
