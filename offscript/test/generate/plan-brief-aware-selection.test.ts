/**
 * Sprint W16 — Goal 2 (integration): plan() routes the brief-affinity score into fragment selection
 * ONLY when governed selection is enabled. Two differently-charactered briefs then pick DIFFERENT hero
 * variants; the default (disabled) plan stays brief-blind (catalog-order tiebreak) — byte-identical.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../../src/paths.js';
import { buildContext } from '../../src/generate/context.js';
import { plan } from '../../src/generate/plan.js';
import { makeBriefFixture } from './_brief-fixture.js';

const CLIENT = '__w16_brief_aware_select__';
const { scaffoldClient, writeBrief } = makeBriefFixture(CLIENT);
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));

// A conversational/ambient product (no proof/metric vocabulary).
const CONV_MUST = ['hero: an ambient assistant', 'feature-spotlight: how it listens', 'integrations', 'faq', 'footer'];
const CONV_BODY = 'It listens to the conversation, an ambient assistant and chat copilot. The agent captures intent through a natural dialog. Conversation first.';

// A proof/metrics product (no conversational vocabulary).
const PROOF_MUST = ['hero: proven on real lines', 'metrics: OEE and throughput', 'feature', 'faq', 'footer'];
const PROOF_BODY = 'Measured OEE, throughput, downtime and yield. Uptime and settlement numbers. Results and proof on real production lines.';

function heroFragmentId(governed: boolean, must: string[], body: string): string {
  writeBrief(must, 'website', body);
  const p = governed
    ? plan(buildContext(CLIENT, 'website'), { governedSelection: true })
    : plan(buildContext(CLIENT, 'website'));
  const hero = p.items.find((i) => i.archetype === 'hero');
  expect(hero?.fragmentId, 'hero item must have a selected fragment').toBeDefined();
  return hero!.fragmentId!;
}

describe('W16 — plan() brief-aware hero selection', () => {
  it('DISABLED (default): brief character does NOT change the hero — both briefs pick the same variant', () => {
    scaffoldClient();
    const conv = heroFragmentId(false, CONV_MUST, CONV_BODY);
    const proof = heroFragmentId(false, PROOF_MUST, PROOF_BODY);
    expect(conv).toBe(proof); // catalog-order tiebreak — brief-blind, byte-identical
  });

  it('ENABLED: the conversational brief picks the chat/agent hero', () => {
    scaffoldClient();
    expect(heroFragmentId(true, CONV_MUST, CONV_BODY)).toContain('agent');
  });

  it('ENABLED: two differently-charactered briefs diversify to DIFFERENT hero variants', () => {
    scaffoldClient();
    const conv = heroFragmentId(true, CONV_MUST, CONV_BODY);
    const proof = heroFragmentId(true, PROOF_MUST, PROOF_BODY);
    expect(conv).not.toBe(proof);
    expect(proof).not.toContain('agent'); // proof brief does not pick the conversational hero
  });
});
