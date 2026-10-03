import { describe, it, expect } from 'vitest';
import {
  MISSION_AUDIENCE_VERSION,
  MISSION_TAGS,
  AUDIENCE_TAGS,
  missionAudienceVocabularyDigest,
  deriveVariantProfile,
  briefProfileOf,
  scoreMissionAudience,
  applyMissionAudience,
  verifyMissionSelection,
  createMissionAudienceConsumer,
  MissionAudienceError,
  type VariantFacts,
} from '../../src/generate/mission-audience.js';
import { briefTermsOf } from '../../src/generate/semantic-selection.js';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';

function entry(slug: string, serves: string[]): FragmentEntry {
  return { slug, serves, surface: ['base'], layout: ['grid'], interaction: [], blocks: [], direction: '', limits: {}, cat: 'section' };
}

// ── the versioned, immutable metadata layer ───────────────────────────────────
describe('mission-audience — metadata layer (versioned, immutable, deterministic)', () => {
  it('exposes an independent version string', () => {
    expect(typeof MISSION_AUDIENCE_VERSION).toBe('string');
    expect(MISSION_AUDIENCE_VERSION.length).toBeGreaterThan(0);
  });

  it('the mission + audience vocabularies are deeply frozen (immutable)', () => {
    expect(Object.isFrozen(MISSION_TAGS)).toBe(true);
    expect(Object.isFrozen(AUDIENCE_TAGS)).toBe(true);
    for (const v of Object.values(MISSION_TAGS)) expect(Object.isFrozen(v)).toBe(true);
    for (const v of Object.values(AUDIENCE_TAGS)) expect(Object.isFrozen(v)).toBe(true);
  });

  it('vocabulary digest is stable across calls (replay-deterministic)', () => {
    expect(missionAudienceVocabularyDigest()).toBe(missionAudienceVocabularyDigest());
  });
});

// ── deterministic tag derivation from a variant's own distinguishing prose ─────
describe('mission-audience — deriveVariantProfile (grounded in direction/angle/blocks)', () => {
  const facts = (o: Partial<VariantFacts>): VariantFacts => ({
    direction: '', angle: '', blocks: [], ...o,
  });

  it('derives a conversion mission from a demo/action-oriented direction', () => {
    const p = deriveVariantProfile(facts({ direction: 'Conversational demo hero with intent capture; book a call.' }));
    expect(p.missions.has('conversion')).toBe(true);
  });

  it('derives a trust mission from a proof/credibility direction', () => {
    const p = deriveVariantProfile(facts({ direction: 'Calm credibility hero; a cluster of real proof tiles.' }));
    expect(p.missions.has('trust')).toBe(true);
  });

  it('two same-family variants derive DIFFERENT profiles (within-family discrimination)', () => {
    const demo = deriveVariantProfile(facts({ direction: 'demo hero, book a call, start a trial' }));
    const proof = deriveVariantProfile(facts({ direction: 'credibility hero, compliance and audit proof' }));
    expect([...demo.missions].sort()).not.toEqual([...proof.missions].sort());
  });

  it('derives an audience tag from audience-signalling prose', () => {
    const p = deriveVariantProfile(facts({ direction: 'built for the regulated enterprise organization' }));
    expect(p.audiences.has('enterprise')).toBe(true);
  });

  it('derivation is pure/deterministic (same input → equal profile)', () => {
    const f = facts({ direction: 'compare plans versus alternatives', blocks: ['toggle', 'table'] });
    const a = deriveVariantProfile(f);
    const b = deriveVariantProfile(f);
    expect([...a.missions].sort()).toEqual([...b.missions].sort());
    expect([...a.audiences].sort()).toEqual([...b.audiences].sort());
  });

  it('empty prose yields an empty profile (no tags invented)', () => {
    const p = deriveVariantProfile(facts({}));
    expect(p.missions.size).toBe(0);
    expect(p.audiences.size).toBe(0);
  });
});

// ── brief profile + scoring ───────────────────────────────────────────────────
describe('mission-audience — scoreMissionAudience', () => {
  it('scores 0 when there is no overlap', () => {
    const variant = { missions: new Set(['trust']), audiences: new Set(['enterprise']) };
    const brief = { missions: new Set(['education']), audiences: new Set(['technical']) };
    expect(scoreMissionAudience(variant, brief)).toBe(0);
  });

  it('a matching mission raises the score above a non-matching variant', () => {
    const brief = { missions: new Set(['conversion']), audiences: new Set<string>() };
    const match = { missions: new Set(['conversion']), audiences: new Set<string>() };
    const noMatch = { missions: new Set(['trust']), audiences: new Set<string>() };
    expect(scoreMissionAudience(match, brief)).toBeGreaterThan(scoreMissionAudience(noMatch, brief));
  });

  it('mission overlap weighs at least as much as audience overlap', () => {
    const brief = { missions: new Set(['conversion']), audiences: new Set(['enterprise']) };
    const missionOnly = { missions: new Set(['conversion']), audiences: new Set<string>() };
    const audienceOnly = { missions: new Set<string>(), audiences: new Set(['enterprise']) };
    expect(scoreMissionAudience(missionOnly, brief)).toBeGreaterThanOrEqual(
      scoreMissionAudience(audienceOnly, brief),
    );
  });
});

// ── in-tie application (final quality discriminator; never removes valid candidates) ──
describe('mission-audience — applyMissionAudience', () => {
  it('keeps only the highest-scoring candidates (breaks a tie)', () => {
    const cands = ['a', 'b', 'c'];
    const score = (c: string): number | null => (c === 'b' ? 5 : 0);
    expect(applyMissionAudience(cands, score)).toEqual(['b']);
  });

  it('is the identity when all candidates score equally (no opinion → byte-identical)', () => {
    const cands = ['a', 'b', 'c'];
    expect(applyMissionAudience(cands, () => 0)).toEqual(['a', 'b', 'c']);
    expect(applyMissionAudience(cands, () => null)).toEqual(['a', 'b', 'c']);
  });

  it('preserves order among equal winners', () => {
    const cands = ['a', 'b', 'c'];
    const score = (c: string): number => (c === 'a' || c === 'c' ? 3 : 0);
    expect(applyMissionAudience(cands, score)).toEqual(['a', 'c']);
  });

  it('never empties the pool and never invents (≤1 candidate is identity)', () => {
    expect(applyMissionAudience(['only'], () => 0)).toEqual(['only']);
    expect(applyMissionAudience([], () => 0)).toEqual([]);
  });
});

// ── contract guard ────────────────────────────────────────────────────────────
describe('mission-audience — verifyMissionSelection (fail loud)', () => {
  it('accepts an order-preserving subset', () => {
    expect(() => verifyMissionSelection(['a', 'b', 'c'], ['a', 'c'])).not.toThrow();
  });
  it('throws on an invented candidate', () => {
    expect(() => verifyMissionSelection(['a', 'b'], ['a', 'z'])).toThrow(MissionAudienceError);
  });
  it('throws on a reorder', () => {
    expect(() => verifyMissionSelection(['a', 'b'], ['b', 'a'])).toThrow(MissionAudienceError);
  });
  it('throws on emptying a non-empty pool', () => {
    expect(() => verifyMissionSelection(['a'], [])).toThrow(MissionAudienceError);
  });
  it('throws on a duplicate', () => {
    expect(() => verifyMissionSelection(['a', 'b'], ['a', 'a'])).toThrow(MissionAudienceError);
  });
});

// ── the consumer (slug → projection facts → profile → score), fail-loud ────────
describe('mission-audience — createMissionAudienceConsumer', () => {
  const variantFacts = new Map<string, VariantFacts>([
    ['hero-demo', { direction: 'demo hero; book a call, start a trial', angle: 'conversion-first', blocks: [] }],
    ['hero-proof', { direction: 'credibility hero; compliance, audit, proof tiles', angle: 'trust-first', blocks: [] }],
  ]);

  it('scores a present variant and returns null for an absent one (no opinion)', () => {
    const c = createMissionAudienceConsumer({ variantFacts });
    const brief = briefProfileOf(briefTermsOf({ oneLiner: 'book a demo and start your trial today' } as never));
    expect(c.scoreFor('hero-demo', { briefProfile: brief })).not.toBeNull();
    expect(c.scoreFor('not-in-projection', { briefProfile: brief })).toBeNull();
  });

  it('a conversion brief scores the demo hero above the proof hero', () => {
    const c = createMissionAudienceConsumer({ variantFacts });
    const brief = briefProfileOf(briefTermsOf({ oneLiner: 'book a demo, start a free trial, convert faster' } as never));
    const demo = c.scoreFor('hero-demo', { briefProfile: brief }) ?? 0;
    const proof = c.scoreFor('hero-proof', { briefProfile: brief }) ?? 0;
    expect(demo).toBeGreaterThan(proof);
  });

  it('a trust brief scores the proof hero above the demo hero', () => {
    const c = createMissionAudienceConsumer({ variantFacts });
    const brief = briefProfileOf(briefTermsOf({ oneLiner: 'compliance, audit, and security proof for the regulated enterprise' } as never));
    const demo = c.scoreFor('hero-demo', { briefProfile: brief }) ?? 0;
    const proof = c.scoreFor('hero-proof', { briefProfile: brief }) ?? 0;
    expect(proof).toBeGreaterThan(demo);
  });

  it('the real website projection is loadable and derivable (default deps)', () => {
    const c = createMissionAudienceConsumer();
    // hero-bento exists in the real projection; scoring must not throw and returns a number.
    const brief = briefProfileOf(briefTermsOf({ oneLiner: 'enterprise automation' } as never));
    const s = c.scoreFor('hero-bento', { briefProfile: brief });
    expect(s === null || typeof s === 'number').toBe(true);
  });
});

// ── pickFragment integration: rank position + dominance guarantees ─────────────
describe('mission-audience — pickFragment integration (rank key 6, below family, above catalog order)', () => {
  const used = new Set<string>();

  it('OMITTED missionScore ⇒ byte-identical to catalog-order pick', () => {
    const cands = [entry('a', ['hero']), entry('b', ['hero'])];
    // no scorers at all → catalog order → 'a'
    expect(pickFragment(cands, used, new Map(), 'hero')).toBe('a');
  });

  it('mission breaks a tie when all higher keys are equal (picks higher missionScore)', () => {
    const cands = [entry('a', ['hero']), entry('b', ['hero'])];
    const missionScore = (f: FragmentEntry) => (f.slug === 'b' ? 5 : 0);
    expect(
      pickFragment(cands, used, new Map(), 'hero', undefined, undefined, undefined, undefined, missionScore),
    ).toBe('b');
  });

  it('NEVER overrides best-fit: a primary-serve match wins even with a lower missionScore', () => {
    // 'a' serves hero only secondarily; 'b' is hero-primary. Mission favours 'a' hugely.
    const cands = [entry('a', ['cta', 'hero']), entry('b', ['hero'])];
    const missionScore = (f: FragmentEntry) => (f.slug === 'a' ? 100 : 0);
    expect(
      pickFragment(cands, used, new Map(), 'hero', undefined, undefined, undefined, undefined, missionScore),
    ).toBe('b'); // best-fit (serves[0]==='hero') dominates
  });

  it('ranks BELOW the W24 family key: family wins when it differs, regardless of mission', () => {
    const cands = [entry('a', ['hero']), entry('b', ['hero'])];
    const familyScore = (f: FragmentEntry) => (f.slug === 'a' ? 10 : 0);
    const missionScore = (f: FragmentEntry) => (f.slug === 'b' ? 100 : 0); // mission loves 'b'
    // family prefers 'a'; family outranks mission ⇒ 'a' wins despite mission.
    expect(
      pickFragment(cands, used, new Map(), 'hero', undefined, undefined, undefined, familyScore, missionScore),
    ).toBe('a');
  });

  it('ranks ABOVE catalog order: mission wins the tie before recency/catalog order applies', () => {
    const cands = [entry('a', ['hero']), entry('b', ['hero'])];
    const missionScore = (f: FragmentEntry) => (f.slug === 'b' ? 3 : 0);
    // catalog order would pick 'a'; mission lifts 'b'.
    expect(
      pickFragment(cands, used, new Map(), 'hero', undefined, undefined, undefined, undefined, missionScore),
    ).toBe('b');
  });
});
