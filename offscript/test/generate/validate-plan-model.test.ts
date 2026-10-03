/**
 * E1 — planning → validation wiring.
 *
 * Proves validation consumes the AUTHORITATIVE planner model (the plan's stamped
 * section anchors + archetypes) instead of re-inferring it from the DOM. The
 * consumer capability already existed: archetype-tag resolves ctx.sections and
 * honours ctx.params.declared (declared-wins-inference) when present. The missing
 * edge was that validate() never supplied them. `planOperatorModel` projects an
 * AuthoringPlan onto that operator-context shape; this test pins the projection AND
 * proves the consumer (archetype-tag) decides by 'declared' once it is supplied.
 *
 * Mirrors the plain-literal ctx pattern in test/operators/archetype-tag.test.ts —
 * no governance/posture dependency.
 */
import { describe, it, expect } from 'vitest';
import { planOperatorModel } from '../../src/generate/validate.js';
import { archetypeTag } from '../../src/operators/archetype-tag.js';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import type { AuthoringPlan } from '../../src/generate/types.js';

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;

/** A minimal website plan: two items whose anchors are generated (anchor === id). */
function planOf(): AuthoringPlan {
  return {
    track: 'website',
    warnings: [],
    items: [
      { anchor: { id: 'hero', anchor: 'hero' }, archetype: 'hero', tokenRoles: [], intent: 'a' },
      { anchor: { id: 'faq', anchor: 'faq' }, archetype: 'faq', tokenRoles: [], intent: 'b' },
    ],
  };
}

describe('E1 — planOperatorModel projects the plan onto the operator context', () => {
  it('builds a SectionsModel from the item anchors (sections in order + byId lookup)', () => {
    const model = planOperatorModel(planOf());
    expect(model.sections!.sections.map((s) => s.id)).toEqual(['hero', 'faq']);
    expect(model.sections!.byId.get('faq')?.anchor).toBe('faq');
  });

  it('builds params.declared as section-id → archetype', () => {
    const model = planOperatorModel(planOf());
    expect((model.params as { declared?: unknown }).declared).toEqual({ hero: 'hero', faq: 'faq' });
  });

  it('an empty plan yields empty sections + empty declared (no throw)', () => {
    const model = planOperatorModel({ track: 'website', warnings: [], items: [] });
    expect(model.sections!.sections).toEqual([]);
    expect((model.params as { declared?: unknown }).declared).toEqual({});
  });
});

describe('E1 — archetype-tag consumes the projected model as decidedBy: declared', () => {
  // Sections whose minimal structure would NOT confidently infer hero/faq; the only
  // way the model resolves them is via the supplied declared plan model.
  const html = doc('<section id="hero"><p>copy</p></section><section id="faq"><p>copy</p></section>');

  it('without the plan model, archetype-tag does not decide hero by declared', () => {
    const ctx: OperatorContext = { params: {} };
    archetypeTag.detect(parseHtml(html), ctx);
    expect(ctx.archetypeModel?.get('hero')?.decidedBy).not.toBe('declared');
  });

  it('with the plan model supplied, archetype-tag decides hero + faq by declared', () => {
    const model = planOperatorModel(planOf());
    const ctx: OperatorContext = { params: model.params, sections: model.sections };
    archetypeTag.detect(parseHtml(html), ctx);
    expect(ctx.archetypeModel?.get('hero')?.decidedBy).toBe('declared');
    expect(ctx.archetypeModel?.get('hero')?.archetype).toBe('hero');
    expect(ctx.archetypeModel?.get('faq')?.decidedBy).toBe('declared');
    expect(ctx.archetypeModel?.get('faq')?.archetype).toBe('faq');
  });
});
