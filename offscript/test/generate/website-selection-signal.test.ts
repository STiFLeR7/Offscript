/**
 * Sprint W16 — Goals 2+3: brief-aware website component selection.
 *
 * Goal 3 (metadata): fragmentAffinities derives selection-relevant character tags from a
 *   FragmentEntry's EXISTING metadata (layout / interaction / blocks / serves / surface) — additive,
 *   no governance rewrite, no new authored files.
 * Goal 2 (selection): briefSelectionProfile derives a weighted character profile from the brief text;
 *   fragmentBriefScore scores a candidate against it. Different briefs ⇒ different best-fit candidate
 *   among equal structural candidates, so selection intentionally diversifies instead of always taking
 *   the first catalog row.
 */
import { describe, it, expect } from 'vitest';
import {
  fragmentAffinities,
  briefSelectionProfile,
  fragmentBriefScore,
} from '../../src/generate/website-selection-signal.js';
import type { FragmentEntry } from '../../src/generate/catalog.js';

// Minimal FragmentEntry fixtures mirroring the real COMPOSITION.md hero rows.
function entry(slug: string, partial: Partial<FragmentEntry>): FragmentEntry {
  return {
    slug,
    serves: ['hero'],
    surface: ['base'],
    layout: [],
    interaction: [],
    blocks: [],
    direction: '',
    limits: {},
    cat: 'section',
    ...partial,
  };
}
const HERO_BENTO = entry('hero-bento', {
  layout: ['centered-stack', 'asymmetric-bento'],
  interaction: ['reveal-only'],
  serves: ['hero', 'feature', 'logos', 'cta'],
  blocks: ['nav-bar', 'chip-row', 'headline-cluster', 'body-copy', 'cta-row', 'logo-row', 'bento-tiles', 'media-frame'],
});
const HERO_LENDING = entry('hero-lending', {
  layout: ['centered-stack', 'n-up-card-grid'],
  interaction: ['reveal-only'],
  serves: ['hero', 'feature', 'logos', 'integrations'],
  blocks: ['nav-bar', 'chip-row', 'headline-cluster', 'body-copy', 'cta-row', 'media-frame', 'creative-panel', 'logo-row'],
});
const HERO_ACTIONS = entry('hero-actions', {
  layout: ['two-col-text+creative'],
  interaction: ['static', 'toggle'],
  serves: ['hero', 'feature', 'logos'],
  blocks: ['nav-bar', 'headline-cluster', 'body-copy', 'cta-row', 'creative-panel', 'toggle-control', 'logo-row'],
});
const HERO_AGENT = entry('hero-agent', {
  layout: ['two-col-text+creative', 'tabs+swap-panel'],
  interaction: ['form', 'tabs', 'reveal-only'],
  serves: ['hero', 'feature', 'contact'],
  blocks: ['nav-bar', 'headline-cluster', 'body-copy', 'form-block', 'creative-panel', 'tab-bar', 'media-frame'],
});
const HEROES = [HERO_BENTO, HERO_LENDING, HERO_ACTIONS, HERO_AGENT];

// Real brief texts (condensed) for the corpus clients.
const VEYRA = 'Veyra turns the conversation in the exam room into a finished coded clinical note. Ambient capture that listens, structures, and codes the visit. Accuracy, clinician review, safety guardrails. Writes back into Epic, Cerner. Testimonials: what clinical leaders saw.';
const LEDGERWISE = 'One API to embed payments, payouts, and treasury. Built for engineers — typed SDKs, sandbox, and clear docs. Uptime, settlement speed, and the margin you keep. Comparison: Ledgerwise versus a processor plus a ledger plus a compliance vendor.';
const FORGELINE = 'See every machine on the floor. Connect, normalize, and act in three steps. Throughput, downtime, and yield in one live view. OEE gains measured on real production lines. Case study: a 40-year-old line made visible in two weeks.';

function bestHero(briefText: string): string {
  const profile = briefSelectionProfile({ oneLiner: briefText });
  let best = HEROES[0];
  let bestScore = fragmentBriefScore(best, profile);
  for (const h of HEROES.slice(1)) {
    const s = fragmentBriefScore(h, profile);
    if (s > bestScore) { best = h; bestScore = s; }
  }
  return best.slug;
}

describe('W16 — fragmentAffinities (Goal 3: derived from existing metadata)', () => {
  it('tags product-demo from a toggle control (hero-actions) but NOT the chat hero', () => {
    expect([...fragmentAffinities(HERO_ACTIONS)]).toContain('product-demo'); // toggle-control
    expect([...fragmentAffinities(HERO_AGENT)]).not.toContain('product-demo');
  });
  it('tags conversational from a form/tab surface (hero-agent) but NOT the toggle hero', () => {
    expect([...fragmentAffinities(HERO_AGENT)]).toContain('conversational');   // form-block/tab-bar
    expect([...fragmentAffinities(HERO_ACTIONS)]).not.toContain('conversational');
  });
  it('tags proof-dense from bento-tiles / stat blocks / stats-serves', () => {
    expect([...fragmentAffinities(HERO_BENTO)]).toContain('proof-dense'); // bento-tiles
  });
  it('tags cards-proof from n-up-card-grid + creative-panel', () => {
    expect([...fragmentAffinities(HERO_LENDING)]).toContain('cards-proof');
  });
  it('is deterministic and derived (same entry → same tags)', () => {
    expect([...fragmentAffinities(HERO_BENTO)].sort()).toEqual([...fragmentAffinities(HERO_BENTO)].sort());
  });
});

describe('W16 — briefSelectionProfile + fragmentBriefScore (Goal 2: brief-aware)', () => {
  it('a conversational/ambient brief leans toward the chat/agent hero', () => {
    expect(bestHero(VEYRA)).toBe('hero-agent');
  });
  it('a developer/API brief leans toward the product-state (toggle) hero, not the chat or proof-tile hero', () => {
    expect(bestHero(LEDGERWISE)).toBe('hero-actions');
  });
  it('a metrics/OEE proof brief leans toward the proof-tile hero', () => {
    expect(bestHero(FORGELINE)).toBe('hero-bento');
  });
  it('three differently-charactered briefs do NOT all collapse to one hero', () => {
    const picks = new Set([bestHero(VEYRA), bestHero(LEDGERWISE), bestHero(FORGELINE)]);
    expect(picks.size).toBeGreaterThanOrEqual(2);
  });
  it('an empty/characterless brief yields an empty profile (no signal → caller falls back)', () => {
    const profile = briefSelectionProfile({ oneLiner: '' });
    expect([...profile.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});
