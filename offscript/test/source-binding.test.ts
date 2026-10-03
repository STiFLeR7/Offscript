import { describe, it, expect } from 'vitest';
import { extractSourceUnits, segmentBody } from '../src/generate/source-units.js';
import {
  bindSourceUnits,
  type BindConsumer,
  type BindingResult,
} from '../src/generate/source-binding.js';

// W2-S2 — Source Unit → Consumer Binding.
// Governed by docs/internals/W2-EXECUTION-PACKAGE.md (Contract 2: planner-owned,
// explicit, inspectable binding) and W2-FIDELITY-FAILURE-OWNERSHIP.md.
// BINDING ONLY — declares unit→consumer dispositions as DATA. No AuthoritySignals,
// no ledger, no headline, no Failure emission (those are W2-S3/S4).

// A trivial archetype inferer for tests (the planner injects its real one).
const inferArchetype = (label: string): string => {
  const l = label.toLowerCase();
  if (/pricing|price/.test(l)) return 'pricing';
  if (/cta|call to action/.test(l)) return 'cta-banner';
  if (/hero/.test(l)) return 'hero';
  return 'feature-grid';
};

function consumer(id: string, intent: string, archetype = 'feature-grid'): BindConsumer {
  return { id, intent, archetype };
}

describe('heading-based binding (existing mappings continue to work)', () => {
  it('binds a heading segment to the consumer whose intent slug matches', () => {
    const units = extractSourceUnits({ mustInclude: ['Pricing'], body: `## Pricing\n18% flat fee.` });
    const out = bindSourceUnits(units, [consumer('pricing', 'Pricing', 'pricing')], inferArchetype);
    expect(out.contentByConsumer.get('pricing')).toContain('18% flat fee');
    const seg = out.result.bindings.find((b) => b.tier === 2 && b.kind === 'heading');
    expect(seg?.disposition).toBe('bound');
    expect(seg?.consumerId).toBe('pricing');
  });

  it('falls back to archetype-equality when the slug does not match', () => {
    const units = extractSourceUnits({ mustInclude: [], body: `## Final CTA\nStart your trial.` });
    const out = bindSourceUnits(units, [consumer('cta', 'Primary call to action', 'cta-banner')], inferArchetype);
    expect(out.contentByConsumer.get('cta')).toContain('Start your trial');
  });
});

describe('heading-less binding — no early-return silent loss', () => {
  it('binds a heading-less body segment to a consumer by slug', () => {
    const units = extractSourceUnits({ mustInclude: [], body: `Pricing details here in plain prose.` });
    const out = bindSourceUnits(units, [consumer('pricing-details-here-in-plain-prose', 'Pricing details here in plain prose', 'pricing')], inferArchetype);
    const seg = out.result.bindings.find((b) => b.tier === 2);
    expect(seg?.kind).toBe('blank-block');
    expect(seg?.disposition).toBe('bound');
  });

  it('a heading-less segment that matches no consumer is UNMATCHED, never dropped', () => {
    const units = extractSourceUnits({ mustInclude: [], body: `Some orphan prose with no home.` });
    const out = bindSourceUnits(units, [consumer('hero', 'Hero', 'hero')], inferArchetype);
    const seg = out.result.bindings.find((b) => b.tier === 2);
    expect(seg?.disposition).toBe('unmatched');
    // present in the accounting, not silently discarded
    expect(out.result.bindings.filter((b) => b.tier === 2)).toHaveLength(1);
  });
});

describe('token-overlap fallback (W50 source fidelity) — heading wording drift still binds', () => {
  it('binds a heading whose wording drifts from the must-include label via strong token overlap', () => {
    // The real logistics case: must-include "Coordinating logistics operations"
    // vs body heading "How agents coordinate logistics operations" — no slug,
    // archetype, or substring match, but a strong shared-token overlap.
    const units = extractSourceUnits({
      mustInclude: [],
      body: `## How agents coordinate logistics operations\nAgents plan, dispatch, and route.`,
    });
    const out = bindSourceUnits(
      units,
      [consumer('coordinating-logistics-operations', 'Coordinating logistics operations', 'content-page')],
      inferArchetype,
    );
    expect(out.contentByConsumer.get('coordinating-logistics-operations')).toContain('Agents plan');
    const seg = out.result.bindings.find((b) => b.tier === 2 && b.kind === 'heading');
    expect(seg?.disposition).toBe('bound');
    expect(seg?.consumerId).toBe('coordinating-logistics-operations');
  });

  it('binds real-time / faster-deliveries wording drift (plural + reorder tolerant)', () => {
    const units = extractSourceUnits({
      mustInclude: [],
      body: `## Real-time visibility across the network\nlive picture.\n\n## Faster deliveries, lower logistics costs\nleaner chain.`,
    });
    const out = bindSourceUnits(
      units,
      [
        consumer('real-time-network-visibility', 'Real-time network visibility', 'content-page'),
        consumer('faster-deliveries-lower-cost', 'Faster deliveries, lower cost', 'content-page'),
      ],
      inferArchetype,
    );
    expect(out.contentByConsumer.get('real-time-network-visibility')).toContain('live picture');
    expect(out.contentByConsumer.get('faster-deliveries-lower-cost')).toContain('leaner chain');
  });

  it('ABSTAINS on a genuine tie — two equally-overlapping segments stay unmatched (fail-loud preserved)', () => {
    const units = extractSourceUnits({
      mustInclude: [],
      body: `## Shipment Planning Engine\nfirst.\n\n## Shipment Planning Console\nsecond.`,
    });
    const out = bindSourceUnits(
      units,
      [consumer('shipment-planning', 'Shipment Planning Workflow', 'content-page')],
      inferArchetype,
    );
    // consumer shares {shipment, planning} equally with BOTH segments → abstain
    expect(out.contentByConsumer.has('shipment-planning')).toBe(false);
    const unmatched = out.result.bindings.filter((b) => b.tier === 2 && b.disposition === 'unmatched');
    expect(unmatched).toHaveLength(2);
    const c = out.result.consumers.find((x) => x.consumerId === 'shipment-planning');
    expect(c?.grounded).toBe(false);
  });

  it('does NOT over-bind on weak overlap (a single shared token) — stays unmatched', () => {
    const units = extractSourceUnits({
      mustInclude: [],
      body: `## Logistics overview and background\nunrelated prose.`,
    });
    const out = bindSourceUnits(
      units,
      [consumer('coordinating-logistics-operations', 'Coordinating logistics operations', 'content-page')],
      inferArchetype,
    );
    expect(out.contentByConsumer.has('coordinating-logistics-operations')).toBe(false);
    const seg = out.result.bindings.find((b) => b.tier === 2);
    expect(seg?.disposition).toBe('unmatched');
  });
});

describe('preamble binding — content before the first heading stays bindable', () => {
  it('exposes the preamble segment as a bindable unit (not dropped)', () => {
    const units = extractSourceUnits({ mustInclude: [], body: `Intro prose first.\n\n## Section A\nthe body.` });
    // two tier-2 units: the preamble block + the heading segment
    expect(units.tier2.length).toBeGreaterThanOrEqual(2);
    const out = bindSourceUnits(units, [consumer('intro-prose-first', 'Intro prose first', 'feature-grid')], inferArchetype);
    const preamble = out.result.bindings.find((b) => b.kind === 'blank-block');
    expect(preamble).toBeDefined();
    expect(preamble?.disposition).toBe('bound'); // available + bound to its consumer
  });
});

describe('unmatched visibility — every unit is explicitly accounted', () => {
  it('partitions every extracted unit into exactly one of bound | unmatched | unused', () => {
    const units = extractSourceUnits({
      mustInclude: ['Hero', 'Dropped Feature'],
      body: `## Hero\nthe hero.\n## Orphan Section\northis body has no consumer.`,
    });
    // consumer for Hero only; "Dropped Feature" has no surviving consumer; the
    // "Orphan Section" heading segment matches no consumer
    const out = bindSourceUnits(units, [consumer('hero', 'Hero', 'hero')], inferArchetype);

    const total = units.tier1.length + units.tier2.length;
    expect(out.result.bindings).toHaveLength(total);
    for (const b of out.result.bindings) {
      expect(['bound', 'unmatched', 'unused']).toContain(b.disposition);
    }
    // Hero tier-1 → bound; "Dropped Feature" tier-1 → unused (no surviving consumer)
    const dropped = out.result.bindings.find((b) => b.tier === 1 && b.unitSlug === 'dropped-feature');
    expect(dropped?.disposition).toBe('unused');
    // the orphan trailing block → unmatched
    const orphan = out.result.bindings.find((b) => b.tier === 2 && b.disposition === 'unmatched');
    expect(orphan).toBeDefined();
  });
});

describe('consumer grounding — consumers can tell whether source grounding exists', () => {
  it('a consumer that received content (or a bound must-include) is grounded; a bare default is not', () => {
    const units = extractSourceUnits({ mustInclude: ['Hero'], body: `## Hero\nthe hero copy.` });
    const out = bindSourceUnits(
      units,
      [consumer('hero', 'Hero', 'hero'), consumer('footer', 'Navigation, legal, and contact', 'footer')],
      inferArchetype,
    );
    const hero = out.result.consumers.find((c) => c.consumerId === 'hero');
    const footer = out.result.consumers.find((c) => c.consumerId === 'footer');
    expect(hero?.grounded).toBe(true); // bound must-include + bound body
    expect(footer?.grounded).toBe(false); // engine-default-style consumer, no brief origin
  });
});

describe('accounting readiness — the system can answer the four questions', () => {
  it('which bound / which unmatched / which consumers got content / which got none', () => {
    const units = extractSourceUnits({
      mustInclude: ['Hero'],
      body: `## Hero\nhero copy.\n## Leftover\nleftover block with no consumer.`,
    });
    const out: { result: BindingResult; contentByConsumer: Map<string, string> } = bindSourceUnits(
      units,
      [consumer('hero', 'Hero', 'hero'), consumer('cta', 'Primary call to action', 'cta-banner')],
      inferArchetype,
    );

    const bound = out.result.bindings.filter((b) => b.disposition === 'bound');
    const unmatched = out.result.bindings.filter((b) => b.disposition === 'unmatched');
    const grounded = out.result.consumers.filter((c) => c.grounded);
    const ungrounded = out.result.consumers.filter((c) => !c.grounded);

    expect(bound.length).toBeGreaterThanOrEqual(1);
    expect(unmatched.length).toBeGreaterThanOrEqual(1); // the leftover block
    expect(grounded.map((c) => c.consumerId)).toContain('hero');
    expect(ungrounded.map((c) => c.consumerId)).toContain('cta');
  });
});
