/**
 * W3-S4 — Intent Consumption · DIFFERENTIAL PROOF (planner output only).
 *
 * The frozen contract (W3-S4-CONTRACT-RECONCILIATION.md): consumption exists IFF a change
 * in IntentBrief content produces a deterministic, attributable change in a planner DECISION.
 * Proof site (D8): collateral composition routing (PlanItem.composition).
 *
 * These tests observe ONLY deterministic planner output (plan().items[].composition). No
 * author output, no HTML, no prompt, no request. They deliberately import only `plan` +
 * `buildContext` (NOT the consumer module) so the FIRST RED failure demonstrates the
 * pre-implementation state: "intent changes but composition does not."
 */

import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import type { DesignContext } from '../../src/generate/types.js';
import type { IntentBrief } from '../../src/generate/intent-brief.js';
import { makeBriefFixture } from './_brief-fixture.js';

const FIXTURE_CLIENT = '__intent_consume_test__';
const { scaffoldClient, writeBrief } = makeBriefFixture(FIXTURE_CLIENT);

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

/** A collateral DesignContext whose IntentBrief.how is set (all other categories empty). */
function ctxWithHow(base: DesignContext, how: string | undefined): DesignContext {
  if (how === undefined) return { ...base, intentBrief: undefined };
  const intentBrief: IntentBrief = {
    oneThing: '',
    what: '',
    why: '',
    how,
    constraints: '',
    antiPatterns: '',
  };
  return { ...base, intentBrief };
}

/** A 4-page collateral deck: Cover, two generic ContentPages, Closing. */
function collateralBase(): DesignContext {
  scaffoldClient();
  writeBrief(['Overview', 'Approach', 'Method', 'Wrap up'], 'collateral');
  return buildContext(FIXTURE_CLIENT, 'collateral');
}

const compositions = (ctx: DesignContext): Array<string | undefined> =>
  plan(ctx).items.map((i) => i.composition);

describe('W3-S4 differential — intent.how moves a collateral composition decision', () => {
  it('AC-1: two different how values produce a different composition on ≥1 page', () => {
    const base = collateralBase();
    const calm = compositions(ctxWithHow(base, 'calm, unhurried, spare'));
    const bold = compositions(ctxWithHow(base, 'bold, confident, dynamic'));
    expect(calm).not.toEqual(bold);
  });

  it('AC-10: the delta is attributable to how alone (only IntentBrief varies)', () => {
    const base = collateralBase();
    // Identical context except IntentBrief.how → any composition delta is intent-caused.
    const a = compositions(ctxWithHow(base, 'calm, unhurried, spare'));
    const b = compositions(ctxWithHow(base, 'bold, confident, dynamic'));
    const deltaPages = a.filter((c, i) => c !== b[i]);
    expect(deltaPages.length).toBeGreaterThan(0);
  });
});
