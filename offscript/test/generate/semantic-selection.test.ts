/**
 * Sprint W19 — Semantic Knowledge Consumption (RED-first).
 *
 * The FIRST consumer of W18 ComponentSemanticKnowledge. It consumes ONLY Choose when / Avoid when /
 * Composition, and ONLY as the final tie-breaker in selection (after structural / governance /
 * adjacency). These tests pin: choose-when preference, avoid-when exclusion, composition
 * compatibility, the no-body / invalid-body paths, determinism + replay, and the pickFragment
 * tie-break integration (omitted ⇒ byte-identical).
 */
import { describe, it, expect } from 'vitest';
import { parseSemanticBody } from '../../src/knowledge/semantic-body.js';
import {
  briefTermsOf,
  roleTermsForArchetype,
  scoreSemanticKnowledge,
  tryParseSemanticBody,
  type SemanticSelectionContext,
} from '../../src/generate/semantic-selection.js';
import { pickFragment, type FragmentEntry } from '../../src/generate/catalog.js';

// Build a complete W17-template body with the three consumable sections set to given content.
function body(parts: { choose: string; avoid: string; composition: string }): string {
  return [
    '# demo',
    '',
    'lede.',
    '',
    '## Purpose',
    'filler.',
    '',
    '## Choose when',
    parts.choose,
    '',
    '## Avoid when',
    parts.avoid,
    '',
    '## Character',
    'filler.',
    '',
    '## Composition',
    parts.composition,
    '',
    '## Contract',
    'filler.',
    '',
    '## Judgement',
    'filler.',
    '',
  ].join('\n');
}

const fintechBrief = { oneLiner: 'An embedded fintech API for developers to integrate payments via a sandbox.' };
const ctxFintech = (): SemanticSelectionContext => ({ briefTerms: briefTermsOf(fintechBrief) });

describe('W19 — choose-when preference', () => {
  it('prefers the component whose Choose-when matches the brief character', () => {
    const apiK = parseSemanticBody(body({
      choose: 'For a developer or engineer integrating an API or SDK via a sandbox.',
      avoid: 'When there is no product to demonstrate.',
      composition: 'Follows the hero.',
    }), 'api');
    const clinicalK = parseSemanticBody(body({
      choose: 'For a clinician in a calm healthcare setting finishing patient notes.',
      avoid: 'When the audience is technical.',
      composition: 'Follows the hero.',
    }), 'clinical');

    const ctx = ctxFintech();
    const api = scoreSemanticKnowledge(apiK, ctx);
    const clinical = scoreSemanticKnowledge(clinicalK, ctx);
    expect(api.excluded).toBe(false);
    expect(api.score).toBeGreaterThan(clinical.score);
  });
});

describe('W19 — avoid-when exclusion', () => {
  it('excludes a component whose Avoid-when matches the brief context', () => {
    const k = parseSemanticBody(body({
      choose: 'When real proof exists.',
      avoid: 'When the product is a pre-proof launch or vision with no real developer sandbox or api numbers.',
      composition: 'Opens the page.',
    }), 'k');
    // brief IS about an api/sandbox launch → avoid-when overlaps strongly → excluded
    const ctx: SemanticSelectionContext = {
      briefTerms: briefTermsOf({ oneLiner: 'A pre-proof launch: our vision for a developer sandbox and api, no real numbers yet.' }),
    };
    const v = scoreSemanticKnowledge(k, ctx);
    expect(v.excluded).toBe(true);
  });
});

describe('W19 — composition compatibility', () => {
  it('penalizes an incompatible preceding neighbour named in a negative clause', () => {
    const k = parseSemanticBody(body({
      choose: 'A final ask.',
      avoid: 'Mid-page.',
      composition: 'It hands off to the footer below it. It should not sit beside another call-to-action.',
    }), 'cta');
    const base: SemanticSelectionContext = { briefTerms: new Set<string>() };
    const besideCta: SemanticSelectionContext = { briefTerms: new Set<string>(), precedingRoleTerms: roleTermsForArchetype('cta-banner') };
    const besideFooter: SemanticSelectionContext = { briefTerms: new Set<string>(), precedingRoleTerms: roleTermsForArchetype('footer') };

    expect(scoreSemanticKnowledge(k, besideCta).score).toBeLessThan(scoreSemanticKnowledge(k, base).score);
    expect(scoreSemanticKnowledge(k, besideFooter).score).toBeGreaterThanOrEqual(scoreSemanticKnowledge(k, besideCta).score);
  });
});

describe('W19 — no semantic body / invalid semantic body', () => {
  it('returns null for a non-template body (no ## sections) — no opinion', () => {
    expect(tryParseSemanticBody('# nav\n\nThe page top bar.\n', 'nav')).toBeNull();
  });
  it('fails loud for a partial/invalid template body', () => {
    expect(() => tryParseSemanticBody('# x\n\nlede\n\n## Purpose\n\nonly one section.\n', 'x')).toThrow(/missing/i);
  });
  it('fails loud for an unknown section', () => {
    const b = body({ choose: 'a', avoid: 'b', composition: 'c' }) + '\n## Bananas\n\noops\n';
    expect(() => tryParseSemanticBody(b, 'x')).toThrow(/unknown section/i);
  });
});

describe('W19 — determinism + replay', () => {
  it('scoring is deterministic and order-independent in brief terms', () => {
    const k = parseSemanticBody(body({ choose: 'developer api sandbox', avoid: 'consumer retail', composition: 'follows hero' }), 'k');
    const ctx = ctxFintech();
    const a = scoreSemanticKnowledge(k, ctx);
    const b = scoreSemanticKnowledge(k, ctx);
    expect(a).toEqual(b);
  });
});

// ── pickFragment integration: semantic as the final tie-breaker ──
function frag(slug: string, serves: string[]): FragmentEntry {
  return { slug, serves, surface: ['base'], layout: [], interaction: [], blocks: [], direction: '', limits: {}, cat: 'section' };
}

describe('W19 — pickFragment tie-break integration', () => {
  const A = frag('alpha', ['hero']);
  const B = frag('bravo', ['hero']);

  it('omitted semantic scorer ⇒ catalog-order tiebreak (byte-identical)', () => {
    expect(pickFragment([B, A], new Set(), new Map(), 'hero')).toBe('bravo'); // first in catalog
  });

  it('resolves an otherwise-perfect tie by semantic score', () => {
    const semantic = (f: FragmentEntry) => (f.slug === 'alpha' ? 10 : 1);
    // bravo is catalog-first, but alpha wins on semantic — proving the tie-break fires
    expect(pickFragment([B, A], new Set(), new Map(), 'hero', undefined, undefined, semantic)).toBe('alpha');
  });

  it('never overrides a superior structural (best-fit) match', () => {
    const heroPrimary = frag('primary', ['hero']);
    const heroSecondary = frag('secondary', ['cta', 'hero']); // serves hero only secondarily
    // even with a huge semantic score for the secondary, best-fit (serves[0]==='hero') wins
    const semantic = (f: FragmentEntry) => (f.slug === 'secondary' ? 1000 : 0);
    expect(pickFragment([heroPrimary, heroSecondary], new Set(), new Map(), 'hero', undefined, undefined, semantic)).toBe('primary');
  });

  it('an excluded candidate (large penalty) loses the tie but is not removed', () => {
    const semantic = (f: FragmentEntry) => (f.slug === 'bravo' ? -1e6 : 0);
    expect(pickFragment([B, A], new Set(), new Map(), 'hero', undefined, undefined, semantic)).toBe('alpha');
    // when it is the ONLY candidate, it is still chosen (never empties the role)
    expect(pickFragment([B], new Set(), new Map(), 'hero', undefined, undefined, semantic)).toBe('bravo');
  });
});
