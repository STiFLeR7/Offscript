/**
 * Sprint W24 — Family Semantic Selection Consumption (RED-first).
 *
 * The FIRST runtime consumer of the W23 ComponentFamilyKnowledge layer. It consumes ONLY the 16
 * authored family dimensions, and ONLY inside website selection, as a SECONDARY discriminator that
 * sits BELOW structural fitness / governance affinity / W19 component semantics — it may raise or
 * lower confidence, break a tie, or eliminate an unsuitable family WITHIN a tie, but NEVER invents a
 * candidate, empties a role, reorders, or overrides a superior structural match.
 *
 * These tests pin: the pure family scorer (strengths/decision/conversion preference, avoid-when
 * exclusion, neighbour penalty, only-the-16-sections discipline), the pure narrowing
 * (applyFamilyKnowledge), the contract guard (verifyFamilySelection), the consumer
 * (variant → canonical family via the projection, label normalization, fail-loud on repository
 * mismatch / missing knowledge / mutable object), and the pickFragment family tie-break
 * (omitted ⇒ byte-identical).
 */
import { describe, it, expect } from 'vitest';
import { parseFamilyBody, createFamilyKnowledgeProvider, type ComponentFamilyKnowledge } from '../../src/generate/family-semantics.js';
import {
  scoreFamilyKnowledge,
  applyFamilyKnowledge,
  verifyFamilySelection,
  familySlugForLabel,
  createFamilySelectionConsumer,
  FamilySelectionError,
  type FamilySelectionContext,
} from '../../src/generate/family-selection.js';
import { roleTermsForArchetype, briefTermsOf } from '../../src/generate/semantic-selection.js';
import { loadProjection } from '../../src/knowledge/projection.js';
import { KNOWN_FAMILIES } from '../../src/generate/family-semantics.js';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';

// ── a valid 16-section family body, with named sections overridable ──
const SECTIONS = [
  'Purpose', 'Mission', 'Information Density', 'Reading Behaviour', 'Interaction Style',
  'Decision Style', 'Strengths', 'Weaknesses', 'Avoid When', 'Typical Inputs',
  'Typical Outputs', 'Sibling Differences', 'Escalation Rules', 'Family Character',
  'Conversion Style', 'Expected Visitor State',
] as const;

function famBody(overrides: Partial<Record<(typeof SECTIONS)[number], string>> = {}): string {
  const lines: string[] = ['# demo', '', 'lede.', ''];
  for (const s of SECTIONS) {
    lines.push(`## ${s}`);
    lines.push(overrides[s] ?? 'filler content.');
    lines.push('');
  }
  return lines.join('\n');
}

const devBrief = { oneLiner: 'An embedded developer sandbox API for integrating payments and proof of numbers.' };
const ctxDev = (): FamilySelectionContext => ({ briefTerms: briefTermsOf(devBrief) });

describe('W24 — scoreFamilyKnowledge: confidence from the positive dimensions', () => {
  it('prefers the family whose Strengths/Decision/Conversion fit the brief character', () => {
    const fit = parseFamilyBody(famBody({
      Strengths: 'Converts a developer integrating an API via a sandbox; proof through numbers.',
      'Decision Style': 'Reached for when a developer needs the sandbox integration story.',
    }), 'fit');
    const unfit = parseFamilyBody(famBody({
      Strengths: 'Reassures a clinician finishing patient notes in a calm care setting.',
      'Decision Style': 'Reached for when the audience is a hospital ward.',
    }), 'unfit');
    const ctx = ctxDev();
    const a = scoreFamilyKnowledge(fit, ctx);
    const b = scoreFamilyKnowledge(unfit, ctx);
    expect(a.excluded).toBe(false);
    expect(a.score).toBeGreaterThan(b.score);
  });
});

describe('W24 — scoreFamilyKnowledge: avoid-when exclusion', () => {
  it('excludes a family whose Avoid When overlaps the brief context', () => {
    const k = parseFamilyBody(famBody({
      'Avoid When': 'When there is a developer sandbox api with payments and numbers to integrate — reach for another role.',
    }), 'k');
    const v = scoreFamilyKnowledge(k, ctxDev());
    expect(v.excluded).toBe(true);
  });
});

describe('W24 — scoreFamilyKnowledge: neighbour compatibility', () => {
  it('penalizes a preceding neighbour named in a negative escalation clause', () => {
    const k = parseFamilyBody(famBody({
      'Escalation Rules': 'It closes the page and should not sit beside another call-to-action band.',
    }), 'k');
    const base: FamilySelectionContext = { briefTerms: new Set<string>() };
    const besideCta: FamilySelectionContext = { briefTerms: new Set<string>(), precedingRoleTerms: roleTermsForArchetype('cta-banner') };
    expect(scoreFamilyKnowledge(k, besideCta).score).toBeLessThan(scoreFamilyKnowledge(k, base).score);
  });
});

describe('W24 — scoreFamilyKnowledge: consumes ONLY the scored dimensions', () => {
  it('a brief term present ONLY in Purpose/Mission does not move the score', () => {
    const word = 'zeppelin';
    const ctx: FamilySelectionContext = { briefTerms: new Set([word]) };
    const inPurpose = parseFamilyBody(famBody({ Purpose: `A ${word} of a purpose.`, Mission: `${word} mission.` }), 'p');
    const plain = parseFamilyBody(famBody(), 'plain');
    expect(scoreFamilyKnowledge(inPurpose, ctx).score).toBe(scoreFamilyKnowledge(plain, ctx).score);
    // but the same term in Strengths DOES move it (proves the scorer reads the positive dims)
    const inStrengths = parseFamilyBody(famBody({ Strengths: `A ${word} strength.` }), 's');
    expect(scoreFamilyKnowledge(inStrengths, ctx).score).toBeGreaterThan(scoreFamilyKnowledge(plain, ctx).score);
  });
});

describe('W24 — determinism + replay', () => {
  it('scoring is deterministic for the same inputs', () => {
    const k = parseFamilyBody(famBody({ Strengths: 'developer api sandbox', 'Avoid When': 'retail consumer' }), 'k');
    const ctx = ctxDev();
    expect(scoreFamilyKnowledge(k, ctx)).toEqual(scoreFamilyKnowledge(k, ctx));
  });
});

describe('W24 — familySlugForLabel: deterministic projection-label → family slug', () => {
  it('normalizes every real projection family label to a KNOWN family (bijective, no orphan)', () => {
    const known = new Set<string>(KNOWN_FAMILIES);
    const families = loadProjection('website').families;
    expect(families.length).toBeGreaterThan(0);
    for (const label of families) expect(known.has(familySlugForLabel(label))).toBe(true);
  });
  it('maps the compound labels exactly', () => {
    expect(familySlugForLabel('Hero')).toBe('family-hero');
    expect(familySlugForLabel('Feature / value-prop')).toBe('family-feature-value-prop');
    expect(familySlugForLabel('Social proof / logos')).toBe('family-social-proof-logos');
    expect(familySlugForLabel('Call-to-action')).toBe('family-call-to-action');
  });
});

describe('W24 — createFamilySelectionConsumer: variant → family knowledge', () => {
  it('scores a real catalog variant by its canonical family', () => {
    const consumer = createFamilySelectionConsumer();
    const v = consumer.scoreFor('hero-bento', ctxDev());
    expect(v).not.toBeNull();
    expect(typeof v!.score).toBe('number');
    expect(typeof v!.excluded).toBe('boolean');
  });

  it('returns null (no opinion) for a variant absent from the projection', () => {
    const consumer = createFamilySelectionConsumer();
    expect(consumer.scoreFor('not-a-real-variant-xyz', ctxDev())).toBeNull();
  });

  it('fails loud (repository mismatch) when a variant family does not normalize to a known family', () => {
    const consumer = createFamilySelectionConsumer({
      variantToFamily: new Map([['weird', 'Totally Made Up Family']]),
    });
    expect(() => consumer.scoreFor('weird', ctxDev())).toThrow(FamilySelectionError);
    expect(() => consumer.scoreFor('weird', ctxDev())).toThrow(/repository mismatch|unknown family/i);
  });

  it('fails loud (missing knowledge) when a known family has no authored document', () => {
    // a provider over an empty root: every knowledgeFor returns null
    const emptyRoot = new URL('./__nonexistent_family_root__', import.meta.url).pathname;
    const consumer = createFamilySelectionConsumer({
      variantToFamily: new Map([['hero-bento', 'Hero']]),
      provider: createFamilyKnowledgeProvider(emptyRoot),
    });
    expect(() => consumer.scoreFor('hero-bento', ctxDev())).toThrow(/missing family knowledge/i);
  });
});

describe('W24 — applyFamilyKnowledge: in-tie narrowing (pure)', () => {
  type C = { slug: string };
  const cands: C[] = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];

  it('keeps the highest-scoring candidates and drops excluded ones', () => {
    const verdict = (c: C) =>
      c.slug === 'a' ? { score: 5, excluded: false }
      : c.slug === 'b' ? { score: 1, excluded: false }
      : { score: 99, excluded: true };
    const kept = applyFamilyKnowledge(cands, verdict);
    expect(kept.map((k) => k.slug)).toEqual(['a']); // c excluded, a beats b
  });

  it('never empties the pool — if all are excluded, all are kept', () => {
    const verdict = () => ({ score: 0, excluded: true });
    const kept = applyFamilyKnowledge(cands, verdict);
    expect(kept).toEqual(cands);
  });

  it('null verdict (no opinion) scores 0 and is not excluded', () => {
    const verdict = (c: C) => (c.slug === 'a' ? { score: 3, excluded: false } : null);
    expect(applyFamilyKnowledge(cands, verdict).map((k) => k.slug)).toEqual(['a']);
  });
});

describe('W24 — verifyFamilySelection: contract guard (fail loud)', () => {
  const before = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
  it('passes for an order-preserving subset', () => {
    expect(() => verifyFamilySelection(before, [before[0], before[2]])).not.toThrow();
  });
  it('throws when the result invents a candidate', () => {
    expect(() => verifyFamilySelection(before, [{ slug: 'a' }])).toThrow(FamilySelectionError); // different identity
  });
  it('throws when the result empties a non-empty role', () => {
    expect(() => verifyFamilySelection(before, [])).toThrow(/empt/i);
  });
  it('throws when the result reorders', () => {
    expect(() => verifyFamilySelection(before, [before[2], before[0]])).toThrow(/order/i);
  });
});

// ── pickFragment integration: family score as a tie-break BELOW the existing keys ──
function frag(slug: string, serves: string[]): FragmentEntry {
  return { slug, serves, surface: ['base'], layout: [], interaction: [], blocks: [], direction: '', limits: {}, cat: 'section' };
}

describe('W24 — pickFragment family tie-break integration', () => {
  const A = frag('alpha', ['hero']);
  const B = frag('bravo', ['hero']);

  it('omitted family scorer ⇒ catalog-order tiebreak (byte-identical)', () => {
    expect(pickFragment([B, A], new Set(), new Map(), 'hero')).toBe('bravo');
  });

  it('resolves an otherwise-perfect tie by family score', () => {
    const family = (f: FragmentEntry) => (f.slug === 'alpha' ? 10 : 1);
    expect(pickFragment([B, A], new Set(), new Map(), 'hero', undefined, undefined, undefined, family)).toBe('alpha');
  });

  it('never overrides a superior structural (best-fit) match', () => {
    const heroPrimary = frag('primary', ['hero']);
    const heroSecondary = frag('secondary', ['cta', 'hero']);
    const family = (f: FragmentEntry) => (f.slug === 'secondary' ? 1000 : 0);
    expect(pickFragment([heroPrimary, heroSecondary], new Set(), new Map(), 'hero', undefined, undefined, undefined, family)).toBe('primary');
  });

  it('ranks BELOW the W19 semantic key (semantic wins when both present)', () => {
    const semantic = (f: FragmentEntry) => (f.slug === 'alpha' ? 10 : 0);
    const family = (f: FragmentEntry) => (f.slug === 'bravo' ? 10 : 0);
    // semantic prefers alpha, family prefers bravo; semantic is higher-priority ⇒ alpha
    expect(pickFragment([B, A], new Set(), new Map(), 'hero', undefined, undefined, semantic, family)).toBe('alpha');
  });

  it('an excluded candidate (large penalty) loses the tie but is not removed', () => {
    const family = (f: FragmentEntry) => (f.slug === 'bravo' ? -1e6 : 0);
    expect(pickFragment([B, A], new Set(), new Map(), 'hero', undefined, undefined, undefined, family)).toBe('alpha');
    expect(pickFragment([B], new Set(), new Map(), 'hero', undefined, undefined, undefined, family)).toBe('bravo');
  });
});
