/**
 * Sprint W1 — Reasoned Planning Foundation: the reasoning CHANNEL only.
 *
 * Proves the architectural capacity exists (PlanItem can carry the WHY) while the default
 * path is byte-identical (the planner never populates it). Per WORLD-B-EVOLUTION-ARCHITECTURE.md
 * §5 + AUTHOR-QUALITY-ROOT-CAUSE-ANALYSIS.md: reasoning is OPTIONAL, immutable, never synthesized,
 * never inferred, never auto-populated; the Author still receives nothing new; no HTML changes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeSections, serializeRulebook } from '../../src/generate/plan.js';
import {
  REASONING_FIELDS,
  hasReasoning,
  validateReasoning,
  freezeReasoning,
  serializeReasoningLines,
} from '../../src/generate/section-reasoning.js';
import type { AuthoringPlan, PlanItem, SectionReasoning } from '../../src/generate/types.js';

// ── minimal fixtures (no buildContext — this is the transport layer in isolation) ──
function item(over: Partial<PlanItem> = {}): PlanItem {
  return {
    anchor: { id: 'hero', anchor: 'hero' },
    archetype: 'hero',
    tokenRoles: ['--cr-bg'],
    intent: 'frame the hidden cost',
    ...over,
  };
}
function planOf(items: PlanItem[]): AuthoringPlan {
  return { track: 'website', items, warnings: [] };
}
const FULL: SectionReasoning = {
  role: 'open the diagnostic tension',
  selectionRationale: 'hero over feature-grid: the brief leads with a cost problem',
  orderingRationale: 'first — everything downstream answers this tension',
  transition: 'hands to the mechanism reveal',
  relationships: 'sets up the proof section; contrasts the APA-vs-RPA band',
  communicationObjective: 'make the reader feel the cost they already pay',
};

describe('SectionReasoning channel — helpers (capacity, not producer)', () => {
  it('REASONING_FIELDS is the six architecture §5 responsibilities, in stable order', () => {
    expect([...REASONING_FIELDS]).toEqual([
      'role',
      'selectionRationale',
      'orderingRationale',
      'transition',
      'relationships',
      'communicationObjective',
    ]);
  });

  it('hasReasoning is false for absent / empty channels, true when any field is present', () => {
    expect(hasReasoning(undefined)).toBe(false);
    expect(hasReasoning({})).toBe(false);
    expect(hasReasoning({ role: 'x' })).toBe(true);
    expect(hasReasoning(FULL)).toBe(true);
  });

  it('validateReasoning accepts a sound partial channel and reports problems (never repairs)', () => {
    expect(validateReasoning({})).toEqual([]);
    expect(validateReasoning({ role: 'x' })).toEqual([]);
    expect(validateReasoning(FULL)).toEqual([]);
    // non-string field
    expect(validateReasoning({ role: 5 as unknown as string }).some((p) => /role must be a string/.test(p))).toBe(true);
    // empty string
    expect(validateReasoning({ transition: '   ' }).some((p) => /transition must not be empty/.test(p))).toBe(true);
    // unknown key
    expect(validateReasoning({ bogus: 'x' } as unknown as SectionReasoning).some((p) => /unknown reasoning field 'bogus'/.test(p))).toBe(true);
  });

  it('freezeReasoning returns a deep-frozen copy, strips undefined, never mutates input', () => {
    const input: SectionReasoning = { role: 'x', transition: undefined };
    const frozen = freezeReasoning(input);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect('transition' in frozen).toBe(false); // undefined stripped
    expect(frozen.role).toBe('x');
    expect(Object.isFrozen(input)).toBe(false); // input untouched
    expect(() => {
      (frozen as { role?: string }).role = 'y';
    }).toThrow();
  });
});

describe('serializeReasoningLines — omitted when absent, present fields in stable order', () => {
  it('returns [] for an absent or empty channel', () => {
    expect(serializeReasoningLines(undefined)).toEqual([]);
    expect(serializeReasoningLines({})).toEqual([]);
  });

  it('emits only the present fields, in REASONING_FIELDS order, as rulebook bullets', () => {
    expect(serializeReasoningLines({ communicationObjective: 'book a demo', role: 'open' })).toEqual([
      '- **role:** open',
      '- **communication-objective:** book a demo',
    ]);
  });

  it('emits every field for a full channel', () => {
    expect(serializeReasoningLines(FULL)).toEqual([
      '- **role:** open the diagnostic tension',
      '- **selection-rationale:** hero over feature-grid: the brief leads with a cost problem',
      '- **ordering-rationale:** first — everything downstream answers this tension',
      '- **transition:** hands to the mechanism reveal',
      '- **relationships:** sets up the proof section; contrasts the APA-vs-RPA band',
      '- **communication-objective:** make the reader feel the cost they already pay',
    ]);
  });
});

describe('serializeRulebook — default byte-identical; reasoning surfaced only when present', () => {
  it('a reasoning-less plan emits NO reasoning markers (byte-identical default)', () => {
    const rb = serializeRulebook(planOf([item(), item({ anchor: { id: 'footer', anchor: 'footer' }, archetype: 'footer', intent: 'close' })]), 'example-brand');
    expect(rb).not.toContain('### Reasoning');
    expect(rb).not.toContain('selection-rationale');
    expect(rb).not.toContain('communication-objective');
  });

  it('omitting the field vs setting it undefined produces identical output', () => {
    const a = serializeRulebook(planOf([item()]), 'example-brand');
    const b = serializeRulebook(planOf([item({ reasoning: undefined })]), 'example-brand');
    expect(a).toBe(b);
  });

  it('a populated channel surfaces a ### Reasoning block with the present bullets', () => {
    const rb = serializeRulebook(planOf([item({ reasoning: FULL })]), 'example-brand');
    expect(rb).toContain('### Reasoning');
    expect(rb).toContain('- **role:** open the diagnostic tension');
    expect(rb).toContain('- **communication-objective:** make the reader feel the cost they already pay');
  });

  it('the reasoning block does NOT alter the operator lines (declarative invariant intact)', () => {
    const OPERATOR_LINE_RE = /^- \*\*([a-z-]+)\*\* — params: `(\{.*\})`$/;
    const withR = serializeRulebook(planOf([item({ reasoning: FULL })]), 'example-brand');
    const withoutR = serializeRulebook(planOf([item()]), 'example-brand');
    const ops = (s: string) => s.split('\n').filter((l) => OPERATOR_LINE_RE.test(l));
    expect(ops(withR)).toEqual(ops(withoutR)); // identical operator set
  });

  it('is deterministic — same plan serializes identically twice', () => {
    const p = planOf([item({ reasoning: FULL })]);
    expect(serializeRulebook(p, 'example-brand')).toBe(serializeRulebook(p, 'example-brand'));
  });

  it('does not mutate the plan or its items', () => {
    const p = planOf([item({ reasoning: freezeReasoning(FULL) })]);
    const snapshot = JSON.stringify(p);
    serializeRulebook(p, 'example-brand');
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('serializeSections — the WHERE-map ignores the reasoning channel entirely', () => {
  it('reasoning never affects sections.md (existing snapshots unchanged)', () => {
    const withR = serializeSections(planOf([item({ reasoning: FULL })]));
    const withoutR = serializeSections(planOf([item()]));
    expect(withR).toBe(withoutR);
    expect(withR).not.toContain('role');
    expect(withR).not.toContain('reasoning');
  });
});

describe('compatibility — existing reasoning-less plans remain valid', () => {
  it('a PlanItem without the field has no reasoning key and serializes today exactly', () => {
    const it0 = item();
    expect('reasoning' in it0).toBe(false);
    expect(hasReasoning(it0.reasoning)).toBe(false);
  });
});

describe('Author wiring — the channel does not reach the HTML/contract path', () => {
  // The house contract + the document author orchestrator must NOT consume the reasoning
  // channel: reasoning is never folded into the contract or the HTML composition. (W2 added
  // TRANSPORT into the request renderer in authoring-seam.ts — see the positive assertion
  // below — but that transport is dormant by default: with no reasoning the request is
  // byte-identical, proven behaviourally in section-intent-request.test.ts.)
  const REASONING_FREE = ['author.ts', 'author-contract.ts'];
  for (const f of REASONING_FREE) {
    it(`${f} does not reference the reasoning channel`, () => {
      const src = readFileSync(fileURLToPath(new URL(`../../src/generate/${f}`, import.meta.url)), 'utf8');
      expect(src.includes('SectionReasoning')).toBe(false);
      expect(/\.reasoning\b/.test(src)).toBe(false);
      expect(src.includes('section-reasoning')).toBe(false);
    });
  }

  it('authoring-seam.ts transports the reasoning channel into the request (W2)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/generate/authoring-seam.ts', import.meta.url)), 'utf8');
    expect(src.includes('section-reasoning')).toBe(true); // imports the channel helpers
    expect(/req\.item\.reasoning/.test(src)).toBe(true); // reads it off the carried PlanItem
  });
});
