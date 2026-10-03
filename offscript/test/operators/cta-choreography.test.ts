import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import type { Archetype, ArchetypeModel, ArchetypeAssignment } from '../../src/archetype.js';
import { ctaChoreography } from '../../src/operators/cta-choreography.js';

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;

const assign = (archetype: Archetype): ArchetypeAssignment => ({
  archetype,
  decidedBy: 'inferred',
  confidence: 1,
});

const model = (entries: Array<[string, Archetype]>): ArchetypeModel =>
  new Map(entries.map(([id, a]) => [id, assign(a)]));

const ctxWith = (archetypeModel?: ArchetypeModel): OperatorContext => ({ params: {}, archetypeModel });

describe('cta-choreography operator (Tier-1)', () => {
  it('is Tier 1', () => {
    expect(ctaChoreography.tier).toBe(1);
  });

  it('hero with two primary CTAs → escalated', () => {
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(`<section id="hero"><button>Start trial</button><button>Talk to sales</button></section>`),
    );
    const findings = ctaChoreography.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('escalated');
    expect(findings[0].id).toBe('cta-choreography:hero-multi-cta:hero');
  });

  it('mid-page section with two primary CTAs → warning', () => {
    const ctx = ctxWith(model([['banner', 'cta-banner']]));
    const tree = parseHtml(
      doc(`<section id="banner"><button>Get started</button><a class="btn">Buy now</a></section>`),
    );
    const findings = ctaChoreography.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('warning');
    expect(findings[0].id).toBe('cta-choreography:multi-cta:banner');
  });

  it('a single primary CTA → clear', () => {
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(doc(`<section id="hero"><button>Start trial</button></section>`));
    expect(ctaChoreography.detect(tree, ctx)).toHaveLength(0);
  });

  it('one primary + secondary CTAs (ghost / link) → clear', () => {
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(
        `<section id="hero">` +
          `<button class="btn-primary">Start trial</button>` +
          `<button class="btn ghost">Watch demo</button>` +
          `<a class="btn link">Learn more</a>` +
          `</section>`,
      ),
    );
    expect(ctaChoreography.detect(tree, ctx)).toHaveLength(0);
  });

  it('plain anchors are not CTA candidates (only buttons / button-styled links count)', () => {
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(`<section id="hero"><a href="/a">nav a</a><a href="/b">nav b</a><button>Start</button></section>`),
    );
    expect(ctaChoreography.detect(tree, ctx)).toHaveLength(0);
  });

  it('flags each offending section independently', () => {
    const ctx = ctxWith(
      model([
        ['hero', 'hero'],
        ['mid', 'feature-spotlight'],
        ['clean', 'pricing'],
      ]),
    );
    const tree = parseHtml(
      doc(
        `<section id="hero"><button>A</button><button>B</button></section>` +
          `<section id="mid"><button>C</button><a class="cta">D</a></section>` +
          `<section id="clean"><button>One</button></section>`,
      ),
    );
    const findings = ctaChoreography.detect(tree, ctx);
    expect(findings.map((f) => f.id).sort()).toEqual([
      'cta-choreography:hero-multi-cta:hero',
      'cta-choreography:multi-cta:mid',
    ]);
  });

  it('a nav CTA inside the hero is exempt (nav chrome, not a competing primary)', () => {
    // The house composition puts the nav INSIDE the hero. The nav "Let's talk"
    // pill + the hero's own "Book a demo" CTA must NOT escalate — the nav one is
    // persistent navigation chrome, exempt from the per-section primary count.
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(
        `<section id="hero">` +
          `<nav><button class="navcta">Let's talk</button></nav>` +
          `<a class="cta">Book a Demo Call</a>` +
          `</section>`,
      ),
    );
    expect(ctaChoreography.detect(tree, ctx)).toHaveLength(0);
  });

  it('two genuine primary CTAs in the hero BODY (outside nav) still escalate', () => {
    // The nav exemption must not blind the rail to real body-level competition.
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(
        `<section id="hero">` +
          `<nav><button class="navcta">Let's talk</button></nav>` +
          `<a class="cta">Book a Demo</a>` +
          `<button>Start free trial</button>` +
          `</section>`,
      ),
    );
    const findings = ctaChoreography.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('cta-choreography:hero-multi-cta:hero');
    expect(findings[0].outcome).toBe('escalated');
  });

  it('a mobile nav drawer / toggle hoisted OUTSIDE <nav> is still nav chrome — exempt', () => {
    // The house mobile pattern: the burger toggle and the drawer are SIBLINGS of
    // <nav> (the drawer is position-hoisted out for layout), not inside it. Their
    // duplicate nav pills are persistent navigation chrome, not competing
    // conversion CTAs — they must not escalate alongside the real hero CTA. The
    // exemption anchors on the nav-affordance attrs (data-nav-drawer /
    // data-nav-toggle) and role="navigation", not only the literal <nav> tag.
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(
        `<section id="hero">` +
          `<nav><button class="navpill">Talk to us</button>` +
          `<button data-nav-toggle aria-label="Open menu">Menu</button></nav>` +
          `<div data-nav-drawer hidden><button class="navpill">Talk to us</button></div>` +
          `<a class="cta">Start with helix init</a>` +
          `</section>`,
      ),
    );
    expect(ctaChoreography.detect(tree, ctx)).toHaveLength(0);
  });

  it('a role="navigation" container CTA (non-<nav> tag) is exempt nav chrome', () => {
    const ctx = ctxWith(model([['hero', 'hero']]));
    const tree = parseHtml(
      doc(
        `<section id="hero">` +
          `<div role="navigation"><button class="navpill">Talk to us</button></div>` +
          `<a class="cta">Book a Demo</a>` +
          `</section>`,
      ),
    );
    expect(ctaChoreography.detect(tree, ctx)).toHaveLength(0);
  });

  it('no archetype model → single warning, no analysis', () => {
    const ctx = ctxWith(undefined);
    const tree = parseHtml(doc(`<section id="hero"><button>A</button><button>B</button></section>`));
    const findings = ctaChoreography.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('cta-choreography:no-archetype-model');
    expect(findings[0].outcome).toBe('warning');
  });

  it('a section with no archetype assignment is still checked (mid-page severity)', () => {
    // model present but this section id not in it
    const ctx = ctxWith(model([['other', 'hero']]));
    const tree = parseHtml(doc(`<section id="loose"><button>A</button><button>B</button></section>`));
    const findings = ctaChoreography.detect(tree, ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('cta-choreography:multi-cta:loose');
    expect(findings[0].outcome).toBe('warning');
  });
});
