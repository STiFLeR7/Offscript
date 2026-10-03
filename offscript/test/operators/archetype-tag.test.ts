import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import { loadSections } from '../../src/sections.js';
import type { OperatorContext } from '../../src/operator.js';
import { archetypeTag, ALL_ARCHETYPES, isArchetype } from '../../src/operators/archetype-tag.js';

const doc = (body: string) =>
  `<!doctype html><html><head></head><body>${body}</body></html>`;

/** Fresh context per call — ctx.archetypeModel is mutated by the tagger. */
const ctxWith = (params: Record<string, unknown> = {}, extra: Partial<OperatorContext> = {}): OperatorContext => ({
  params,
  ...extra,
});

describe('archetype-tag operator (Tier-0 tagger)', () => {
  it('is Tier 0 and named archetype-tag', () => {
    expect(archetypeTag.tier).toBe(0);
    expect(archetypeTag.name).toBe('archetype-tag');
  });

  it('populates ctx.archetypeModel as a side-effect (does not return it)', () => {
    const ctx = ctxWith();
    const tree = parseHtml(doc(`<footer id="foot"><a href="#">x</a></footer>`));
    expect(ctx.archetypeModel).toBeUndefined();
    archetypeTag.detect(tree, ctx);
    expect(ctx.archetypeModel).toBeInstanceOf(Map);
    expect(ctx.archetypeModel!.get('foot')?.archetype).toBe('footer');
  });

  // ───────── inference-only path ─────────
  describe('inference-only path (decidedBy: inferred)', () => {
    it('h1 + image in the first section → hero', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(`<section id="top"><h1>Ship faster</h1><img src="hero.png" alt=""></section>`),
      );
      archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('top');
      expect(a?.archetype).toBe('hero');
      expect(a?.decidedBy).toBe('inferred');
      expect(a?.confidence).toBeGreaterThan(0.5);
    });

    it('≥3 q&a pairs → faq', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(
          `<section id="questions">` +
            `<details><summary>Q1?</summary><p>A1</p></details>` +
            `<details><summary>Q2?</summary><p>A2</p></details>` +
            `<details><summary>Q3?</summary><p>A3</p></details>` +
            `</section>`,
        ),
      );
      archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('questions');
      expect(a?.archetype).toBe('faq');
      expect(a?.decidedBy).toBe('inferred');
    });

    it('quote + attribution → testimonial', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(
          `<section id="proof"><blockquote>It changed everything.</blockquote>` +
            `<cite>Jane Doe, Acme</cite></section>`,
        ),
      );
      archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('proof');
      expect(a?.archetype).toBe('testimonial');
      expect(a?.decidedBy).toBe('inferred');
    });

    it('a <footer> tags as footer with full confidence', () => {
      const ctx = ctxWith();
      const tree = parseHtml(doc(`<footer id="f"><nav><a href="#">Home</a></nav></footer>`));
      archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('f');
      expect(a?.archetype).toBe('footer');
      expect(a?.confidence).toBe(1);
    });

    it('class/id keyword cues classify (pricing, logo-bar, comparison)', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(
          `<section id="s1" class="pricing-table"><div>plans</div></section>` +
            `<section id="s2" class="logo-bar"><img src="a.svg"></section>` +
            `<section id="s3" class="plan-comparison"><table></table></section>`,
        ),
      );
      archetypeTag.detect(tree, ctx);
      expect(ctx.archetypeModel!.get('s1')?.archetype).toBe('pricing');
      expect(ctx.archetypeModel!.get('s2')?.archetype).toBe('logo-bar');
      expect(ctx.archetypeModel!.get('s3')?.archetype).toBe('plan-comparison');
    });

    it('warns and skips a section it cannot classify confidently', () => {
      const ctx = ctxWith();
      // mid-page section, no keyword, no strong structural signal
      const tree = parseHtml(
        doc(
          `<section id="lead"><h1>Lead</h1></section>` +
            `<section id="mystery"><p>just some prose with no signal at all</p></section>`,
        ),
      );
      const findings = archetypeTag.detect(tree, ctx);
      expect(ctx.archetypeModel!.has('mystery')).toBe(false);
      expect(findings.some((f) => f.id === 'archetype-tag:unclassified:mystery')).toBe(true);
      expect(findings.every((f) => f.outcome === 'warning')).toBe(true);
    });
  });

  // ───────── declared-wins-inference path ─────────
  describe('declared-wins-inference path', () => {
    it('a declared archetype overrides what inference would pick', () => {
      const ctx = ctxWith({ declared: { top: 'pricing' } });
      // structurally this would infer 'hero' (first section, h1 + img)
      const tree = parseHtml(
        doc(`<section id="top"><h1>Ship faster</h1><img src="hero.png" alt=""></section>`),
      );
      archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('top');
      expect(a?.archetype).toBe('pricing');
      expect(a?.decidedBy).toBe('declared');
      expect(a?.confidence).toBe(1);
    });

    it('an override beats a declared value (override > declared > inferred)', () => {
      const ctx = ctxWith({ declared: { top: 'pricing' }, override: { top: 'faq' } });
      const tree = parseHtml(
        doc(`<section id="top"><h1>Ship faster</h1><img src="hero.png" alt=""></section>`),
      );
      archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('top');
      expect(a?.archetype).toBe('faq');
      expect(a?.decidedBy).toBe('override');
    });
  });

  // ───────── closed-enum guarantee ─────────
  describe('closed-enum guarantee', () => {
    it('never emits an archetype outside the closed enum', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(
          `<header id="h"><h1>Hi</h1><img src="x.png"></header>` +
            `<section id="g" class="feature-grid"><div class="card"><h3>A</h3></div>` +
            `<div class="card"><h3>B</h3></div><div class="card"><h3>C</h3></div></section>` +
            `<section id="faq" class="faq"></section>` +
            `<footer id="ft"><a href="#">x</a></footer>`,
        ),
      );
      archetypeTag.detect(tree, ctx);
      for (const assignment of ctx.archetypeModel!.values()) {
        expect(ALL_ARCHETYPES).toContain(assignment.archetype);
        expect(isArchetype(assignment.archetype)).toBe(true);
      }
    });

    it('ignores an out-of-enum declared value (warns) and falls through to inference', () => {
      const ctx = ctxWith({ declared: { top: 'not-a-real-archetype' } });
      const tree = parseHtml(
        doc(`<section id="top"><h1>Ship faster</h1><img src="hero.png" alt=""></section>`),
      );
      const findings = archetypeTag.detect(tree, ctx);
      const a = ctx.archetypeModel!.get('top');
      // bogus declared ignored → inference picks hero
      expect(a?.archetype).toBe('hero');
      expect(a?.decidedBy).toBe('inferred');
      expect(findings.some((f) => f.id === 'archetype-tag:invalid-declared:top')).toBe(true);
    });

    it('ALL_ARCHETYPES has the 20 catalog archetypes and isArchetype rejects junk', () => {
      expect(ALL_ARCHETYPES).toHaveLength(20);
      expect(isArchetype('hero')).toBe(true);
      expect(isArchetype('footer')).toBe(true);
      // Phase-3 vocabulary additions (the design-team library's contact + resources
      // sections) are first-class members the rails validate against.
      expect(isArchetype('contact')).toBe(true);
      expect(isArchetype('resources')).toBe(true);
      // nav / divider were deliberately NOT added (composition guidance, not archetypes).
      expect(isArchetype('nav')).toBe(false);
      expect(isArchetype('divider')).toBe(false);
      expect(isArchetype('nonsense')).toBe(false);
      expect(isArchetype(undefined)).toBe(false);
    });

    it('infers contact and resources from class/id cues', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(
          `<section id="contact-us" class="contact"><h2>Get in touch</h2></section>` +
            `<section id="ins" class="latest-insights"><h2>Latest insights</h2></section>`,
        ),
      );
      archetypeTag.detect(tree, ctx);
      expect(ctx.archetypeModel!.get('contact-us')?.archetype).toBe('contact');
      // "latest-insights" must beat the editorial cue (resources cue is ordered first).
      expect(ctx.archetypeModel!.get('ins')?.archetype).toBe('resources');
    });
  });

  // ───────── sections-map path ─────────
  describe('sections-map path (ctx.sections)', () => {
    it('keys the model by declared section id, resolving anchors by element id', () => {
      const sections = loadSections(
        `sections:\n  - id: hero\n    anchor: top\n  - id: closing\n    anchor: end\n`,
      );
      const ctx = ctxWith({}, { sections });
      const tree = parseHtml(
        doc(
          `<header id="top"><h1>Hi</h1><img src="x.png"></header>` +
            `<footer id="end"><a href="#">x</a></footer>`,
        ),
      );
      archetypeTag.detect(tree, ctx);
      expect(ctx.archetypeModel!.get('hero')?.archetype).toBe('hero');
      expect(ctx.archetypeModel!.get('closing')?.archetype).toBe('footer');
    });

    it('warns when a declared anchor is not present in the document', () => {
      const sections = loadSections(`sections:\n  - id: ghost\n    anchor: nowhere\n`);
      const ctx = ctxWith({}, { sections });
      const tree = parseHtml(doc(`<section id="real"><p>x</p></section>`));
      const findings = archetypeTag.detect(tree, ctx);
      expect(findings.some((f) => f.id === 'archetype-tag:unresolved-anchor:ghost')).toBe(true);
      expect(ctx.archetypeModel!.has('ghost')).toBe(false);
    });
  });

  // ───────── robustness / idempotency ─────────
  describe('robustness', () => {
    it('emits a single no-sections warning on a document with no sections', () => {
      const ctx = ctxWith();
      const tree = parseHtml(doc(`<div><p>no semantic sections here</p></div>`));
      const findings = archetypeTag.detect(tree, ctx);
      expect(ctx.archetypeModel!.size).toBe(0);
      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe('archetype-tag:no-sections');
    });

    it('is idempotent: apply twice yields an equal model', () => {
      const ctx = ctxWith();
      const tree = parseHtml(
        doc(`<header id="top"><h1>Hi</h1><img src="x.png"></header><footer id="f"><a href="#">x</a></footer>`),
      );
      archetypeTag.apply(tree, ctx);
      const first = new Map(ctx.archetypeModel!);
      archetypeTag.apply(tree, ctx);
      const second = ctx.archetypeModel!;
      expect(second.size).toBe(first.size);
      for (const [k, v] of first) {
        expect(second.get(k)).toEqual(v);
      }
    });
  });
});
