/**
 * Stage 2 — Adaptive-Design-Intelligence: plan() tests.
 *
 * Coverage:
 *  (a) website plan over real example-brand DesignContext meets section-count-rhythm
 *      floor (≥5 sections, ≥5 distinct archetypes)
 *  (b) sections.md round-trips through loadSections() to the same anchors
 *  (c) rulebook.md is declarative (no control-flow tokens)
 *  (d) determinism: same DesignContext → identical AuthoringPlan (and serialized files)
 *  (e) plan(deckCtx) throws the blocked error
 *  (f) collateral plan satisfies page-count range (1–4)
 *  (g) website plan with brief.mustInclude uses brief intent in items
 */

import { describe, it, expect, afterEach } from 'vitest';
import { rmSync } from 'node:fs';
import { projectDir } from '../src/paths.js';
import { buildContext } from '../src/generate/context.js';
import { plan, serializeSections, serializeRulebook } from '../src/generate/plan.js';
import { loadFragmentCatalog } from '../src/generate/catalog.js';
import { deriveContentSignal } from '../src/generate/content-signal.js';
import { resolveGovernedActivation } from '../src/generate/governed-activation.js';
import { loadSections } from '../src/sections.js';
import type { DesignContext } from '../src/generate/types.js';
import { makeBriefFixture } from './generate/_brief-fixture.js';

// ── Fixture client ────────────────────────────────────────────────────────────
const FIXTURE_CLIENT = '__plan_test__';

// Shared brief/brand fixture helpers (see test/generate/_brief-fixture.ts), bound
// to this file's fixture client so call sites stay positional + unchanged.
const { scaffoldClient, writeBrief, writeBriefWithBody } = makeBriefFixture(FIXTURE_CLIENT);

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

// ── (a) Website floor: ≥5 sections, ≥5 distinct archetypes ───────────────────

describe('plan() — website floor (section-count-rhythm)', () => {
  it('example-brand reference defaults: items.length in [5, 9]', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    expect(p.items.length).toBeGreaterThanOrEqual(5);
    expect(p.items.length).toBeLessThanOrEqual(9);
  });

  it('example-brand reference defaults: ≥5 distinct archetypes', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const distinct = new Set(p.items.map((i) => i.archetype));
    expect(distinct.size).toBeGreaterThanOrEqual(5);
  });

  it('no two adjacent items have the same archetype (empty-brief default path)', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    for (let i = 1; i < p.items.length; i++) {
      expect(p.items[i].archetype).not.toBe(p.items[i - 1].archetype);
    }
  });

  it('breaks §2.8 adjacent repeats for a repeated-keyword brief', () => {
    // "features" and "benefits" both map to feature-grid → without the
    // adjacency-break pass these would sit back-to-back. The deterministic
    // greedy break must interleave a differing archetype between them.
    scaffoldClient();
    writeBrief(['features', 'benefits', 'faq', 'pricing']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    for (let i = 1; i < p.items.length; i++) {
      expect(p.items[i].archetype).not.toBe(p.items[i - 1].archetype);
    }
  });

  it('fixture client with minimal brief still meets the floor', () => {
    scaffoldClient();
    writeBrief(['hero section', 'features']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    expect(p.items.length).toBeGreaterThanOrEqual(5);
    const distinct = new Set(p.items.map((i) => i.archetype));
    expect(distinct.size).toBeGreaterThanOrEqual(5);
  });

  it('footer is always the last item on a website plan', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    expect(p.items[p.items.length - 1].archetype).toBe('footer');
  });

  it('plan track matches input context track', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    expect(p.track).toBe('website');
  });
});

// ── (a2) Section ceiling: brief mustInclude must not be silently dropped ─────

describe('plan() — section ceiling (>max mustInclude)', () => {
  it('caps at 9 sections and keeps the first 9 brief entries (no middle drop)', () => {
    scaffoldClient();
    // 11 distinct brief entries — well over the ceiling of 9.
    const entries = [
      'hero',
      'logos',
      'features',
      'spotlight',
      'process',
      'metrics',
      'testimonials',
      'case study',
      'pricing',
      'faq',          // 10th — dropped
      'integrations', // 11th — dropped
    ];
    writeBrief(entries);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);

    expect(p.items.length).toBe(9);

    // The retained items are the FIRST 9 brief intents — never the middle.
    // (Adjacency reordering may permute order, so assert as a set membership.)
    const keptIntents = new Set(p.items.map((i) => i.intent));
    for (const kept of entries.slice(0, 9)) {
      expect(keptIntents.has(kept)).toBe(true);
    }
    // The tail entries are the ones dropped.
    expect(keptIntents.has('faq')).toBe(false);
    expect(keptIntents.has('integrations')).toBe(false);
  });

  it('surfaces a warning (via plan.warnings) when brief mustInclude exceeds the ceiling', () => {
    scaffoldClient();
    const entries = [
      'hero', 'logos', 'features', 'spotlight', 'process',
      'metrics', 'testimonials', 'case study', 'pricing', 'faq', 'integrations',
    ];
    writeBrief(entries);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');

    const { warnings } = plan(ctx);
    expect(warnings.some((w) => /more entries than the/.test(w) && /faq/.test(w))).toBe(true);
  });

  it('plan.warnings only flags a padded duplicate hero on the happy path', () => {
    scaffoldClient();
    writeBrief(['hero', 'features', 'pricing']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    // A 3-section brief is padded to the website floor; the floor pad re-adds a
    // second `hero` (`hero-default`). The Fix-B hero-family CAP (one hero band per
    // page, spec §3.1 / §7 edge 3) refuses a 2nd hero variant, so that padded
    // section legitimately falls through to the COMPOSE §B skeleton fallback and
    // warns. That is the ONLY warning permitted; nothing else may leak.
    const warnings = plan(ctx).warnings;
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/archetype "hero".*A4 fallback/);
  });
});

// ── (g2) Brief body content forwarding (Option A: heading-match + archetype) ──
// writeBriefWithBody is the same shared fixture helper, bound above.

describe('plan() — brief body content forwarding', () => {
  const HELIX_MUST = [
    'hero',
    'how-it-works',
    'systematic-ratio-explainer',
    'social-proof',
    'metrics',
    'cta',
  ];
  const HELIX_BODY = [
    'Whole-brief preamble paragraph that belongs to no single section.',
    '',
    '## 1. Hero',
    '- Headline: Coding agents are the hands. Helix is the team brain.',
    '',
    '## 2. How It Works',
    '- ① UNDERSTAND — a discovery interview, not a prompt.',
    '- Load-bearing idea — cross-model verification: producer is never the checker.',
    '',
    '## 3. Systematic Ratio Explainer',
    '- Lead: every line your team ships sits on a spectrum.',
    '',
    '## 4. Social Proof',
    '- Trust line: open source, MIT-licensed, runs entirely local.',
    '',
    '## 5. Metrics',
    '- Real: 995+ tests passing; 0 self-reviewed merges.',
    '',
    '## 6. Final CTA',
    '- Headline: Give your agents a memory — and a second opinion.',
  ].join('\n');

  it('attaches each section body to its matching plan item (slug-match)', () => {
    scaffoldClient();
    writeBriefWithBody(HELIX_MUST, HELIX_BODY);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const byIntent = (s: string) => p.items.find((i) => i.intent === s);

    expect(byIntent('hero')?.content).toContain('Coding agents are the hands');
    expect(byIntent('how-it-works')?.content).toContain('UNDERSTAND');
    expect(byIntent('how-it-works')?.content).toContain('cross-model verification');
    expect(byIntent('systematic-ratio-explainer')?.content).toContain('spectrum');
    expect(byIntent('metrics')?.content).toContain('995+ tests');
  });

  it('matches "## 6. Final CTA" to the "cta" item via the archetype fallback', () => {
    scaffoldClient();
    writeBriefWithBody(HELIX_MUST, HELIX_BODY);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const cta = p.items.find((i) => i.intent === 'cta');
    expect(cta?.content).toContain('Give your agents a memory');
  });

  it('drops the preamble (text before the first heading) — no item receives it', () => {
    scaffoldClient();
    writeBriefWithBody(HELIX_MUST, HELIX_BODY);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    for (const item of p.items) {
      expect(item.content ?? '').not.toContain('Whole-brief preamble');
    }
  });

  it('floor-padding items with no matching body chunk keep content undefined', () => {
    scaffoldClient();
    writeBriefWithBody(['hero'], '## Hero\n- Headline: only the hero has copy.');
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const hero = p.items.find((i) => i.archetype === 'hero');
    expect(hero?.content).toContain('only the hero has copy');
    expect(p.items.some((i) => i.content === undefined)).toBe(true);
  });

  it('warns when a body section matches no planned section', () => {
    scaffoldClient();
    writeBriefWithBody(
      ['hero', 'features', 'faq', 'footer', 'metrics'],
      '## Hero\n- copy\n\n## Pricing\n- a pricing table the plan never asked for.',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const { warnings } = plan(ctx);
    expect(warnings.some((w) => /matched no planned section/.test(w) && /pricing/.test(w))).toBe(
      true,
    );
  });

  it('content-less brief (no headings) is no longer silently dropped — it binds (W2-S2)', () => {
    scaffoldClient();
    writeBriefWithBody(
      ['hero', 'features', 'faq', 'footer', 'metrics'],
      'Just a flat paragraph, no headings at all.',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    // W2-S2 kills the live R1: a heading-less body becomes a coarse Tier-2 segment
    // that is BOUND to a consumer (archetype fallback), not silently lost as before.
    expect(p.items.some((i) => i.content !== undefined)).toBe(true);
    // Every extracted unit is explicitly accounted in the binding — none disappears.
    expect(p.binding).toBeDefined();
    const tier2 = p.binding!.bindings.filter((b) => b.tier === 2);
    expect(tier2.length).toBeGreaterThanOrEqual(1);
    expect(tier2.every((b) => b.disposition === 'bound' || b.disposition === 'unmatched')).toBe(true);
  });

  it('is deterministic — same brief yields identical content attachment', () => {
    scaffoldClient();
    writeBriefWithBody(HELIX_MUST, HELIX_BODY);
    const p1 = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const p2 = plan(buildContext(FIXTURE_CLIENT, 'website'));
    expect(p1.items.length).toBe(p2.items.length);
    for (let i = 0; i < p1.items.length; i++) {
      expect(p1.items[i].content).toBe(p2.items[i].content);
    }
  });

  it('collateral: heading-slug matches a page intent verbatim', () => {
    scaffoldClient();
    writeBriefWithBody(
      ['overview', 'who it is for', 'closing'],
      '## Overview\n- The product overview copy.\n\n## Who It Is For\n- The audience copy.\n\n## Closing\n- The closing copy.',
      'collateral',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx);
    const overview = p.items.find((i) => i.intent === 'overview');
    expect(overview?.content).toContain('product overview copy');
  });
});

// ── (b) sections.md round-trip ────────────────────────────────────────────────

describe('serializeSections() + loadSections() round-trip', () => {
  it('example-brand website plan round-trips through loadSections()', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const yaml = serializeSections(p);

    const loaded = loadSections(yaml);
    expect(loaded.sections).toHaveLength(p.items.length);

    for (let i = 0; i < p.items.length; i++) {
      expect(loaded.sections[i].id).toBe(p.items[i].anchor.id);
      expect(loaded.sections[i].anchor).toBe(p.items[i].anchor.anchor);
      if (p.items[i].anchor.landmark) {
        expect(loaded.sections[i].landmark).toBe(p.items[i].anchor.landmark);
      } else {
        expect(loaded.sections[i].landmark).toBeUndefined();
      }
    }
  });

  it('byId map after round-trip contains all section ids', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const loaded = loadSections(serializeSections(p));
    for (const item of p.items) {
      expect(loaded.byId.has(item.anchor.id)).toBe(true);
    }
  });

  it('serialized YAML does not contain null landmark values', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const yaml = serializeSections(p);
    // Items without landmark should not emit 'landmark: null' or 'landmark: ~'
    expect(yaml).not.toMatch(/landmark:\s*(null|~)/);
  });
});

// ── (c) rulebook.md is declarative (structural — closed operator set) ────────

describe('serializeRulebook() — declarative invariant', () => {
  // The rulebook is declarative IFF every machine-generated operator line names
  // an operator from the CLOSED operator set with a fixed param shape. We assert
  // this STRUCTURALLY over the operator lines only — never by token-blocklisting
  // the whole document (a user brief intent like "pricing for teams" slugs into
  // ids/headings and would spuriously trip a control-flow word blocklist).
  const OPERATOR_SET = new Set(['token-normalize', 'contrast', 'accent-saturation-budget']);
  // An operator line: `- **<name>** — params: \`{ ... }\``
  const OPERATOR_LINE_RE = /^- \*\*([a-z-]+)\*\* — params: `(\{.*\})`$/;

  /** Extract every machine-generated operator line from the rulebook. */
  function operatorLines(rulebook: string): Array<{ name: string; params: string }> {
    const out: Array<{ name: string; params: string }> = [];
    for (const line of rulebook.split('\n')) {
      const m = OPERATOR_LINE_RE.exec(line);
      if (m) out.push({ name: m[1], params: m[2] });
    }
    return out;
  }

  it('every operator line names an operator from the closed set', () => {
    const ctx = buildContext('example-brand', 'website');
    const rulebook = serializeRulebook(plan(ctx), 'example-brand');
    const ops = operatorLines(rulebook);
    expect(ops.length).toBeGreaterThan(0);
    for (const op of ops) {
      expect(OPERATOR_SET.has(op.name)).toBe(true);
    }
  });

  it('every operator params block is a flat declarative object (no control flow)', () => {
    const ctx = buildContext('example-brand', 'website');
    const rulebook = serializeRulebook(plan(ctx), 'example-brand');
    const ops = operatorLines(rulebook);
    // Each params block is a single { key: value, ... } object — no nesting,
    // no function/arrow/conditional tokens. Assert the shape positively.
    for (const op of ops) {
      expect(op.params).toMatch(/^\{ [^{}]* \}$/);
      expect(op.params).not.toMatch(/=>|function|if |for |while |\breturn\b/);
    }
  });

  it('operator lines survive a control-flow-word brief intent (no spurious fail)', () => {
    // "pricing for teams" contains the word "for"; a prose blocklist would FAIL.
    // The structural check over operator lines must stay green.
    scaffoldClient();
    writeBrief(['hero', 'pricing for teams', 'faq', 'footer', 'features']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const rulebook = serializeRulebook(plan(ctx), FIXTURE_CLIENT);
    const ops = operatorLines(rulebook);
    expect(ops.length).toBeGreaterThan(0);
    for (const op of ops) {
      expect(OPERATOR_SET.has(op.name)).toBe(true);
    }
  });

  it('rulebook contains all section ids', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const rulebook = serializeRulebook(p, 'example-brand');
    for (const item of p.items) {
      expect(rulebook).toContain(item.anchor.id);
    }
  });

  it('rulebook contains all archetypes', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const rulebook = serializeRulebook(p, 'example-brand');
    for (const item of p.items) {
      expect(rulebook).toContain(String(item.archetype));
    }
  });

  it('rulebook is non-empty markdown', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const rulebook = serializeRulebook(p, 'example-brand');
    expect(rulebook.length).toBeGreaterThan(100);
    expect(rulebook).toContain('# Offscript Authoring Rulebook');
  });
});

// ── (d) Determinism: same DesignContext → identical plan + serialized files ───

describe('plan() — determinism', () => {
  it('two calls on the same DesignContext produce identical AuthoringPlan', () => {
    const ctx = buildContext('example-brand', 'website');
    const p1 = plan(ctx);
    const p2 = plan(ctx);
    expect(p1.items.length).toBe(p2.items.length);
    for (let i = 0; i < p1.items.length; i++) {
      expect(p1.items[i].anchor.id).toBe(p2.items[i].anchor.id);
      expect(p1.items[i].archetype).toBe(p2.items[i].archetype);
      expect(p1.items[i].intent).toBe(p2.items[i].intent);
    }
  });

  it('sections.md serialization is identical across two calls', () => {
    const ctx = buildContext('example-brand', 'website');
    const yaml1 = serializeSections(plan(ctx));
    const yaml2 = serializeSections(plan(ctx));
    expect(yaml1).toBe(yaml2);
  });

  it('rulebook.md serialization is identical across two calls', () => {
    const ctx = buildContext('example-brand', 'website');
    const rb1 = serializeRulebook(plan(ctx), 'example-brand');
    const rb2 = serializeRulebook(plan(ctx), 'example-brand');
    expect(rb1).toBe(rb2);
  });

  it('fixture client with same brief produces identical plans', () => {
    scaffoldClient();
    writeBrief(['hero section', 'pricing', 'faq section', 'footer']);

    const ctx1 = buildContext(FIXTURE_CLIENT, 'website');
    const ctx2 = buildContext(FIXTURE_CLIENT, 'website');
    const p1 = plan(ctx1);
    const p2 = plan(ctx2);

    expect(serializeSections(p1)).toBe(serializeSections(p2));
    expect(serializeRulebook(p1, FIXTURE_CLIENT)).toBe(serializeRulebook(p2, FIXTURE_CLIENT));
  });
});

// ── (e) Deck blocked ──────────────────────────────────────────────────────────

describe('plan() — deck blocked', () => {
  it('throws a clear blocked error for a deck DesignContext', () => {
    // We cannot call buildContext('example-brand','deck') — it throws first.
    // Construct a minimal hand-built deck DesignContext to test plan's own guard.
    const ctx = buildContext('example-brand', 'website');
    const deckCtx: DesignContext = { ...ctx, track: 'deck' };
    expect(() => plan(deckCtx)).toThrowError(/deck track is blocked/);
  });

  it('deck blocked error mentions design team', () => {
    const ctx = buildContext('example-brand', 'website');
    const deckCtx: DesignContext = { ...ctx, track: 'deck' };
    expect(() => plan(deckCtx)).toThrowError(/design team/);
  });
});

// ── (f) Collateral plan ────────────────────────────────────────────────────────

describe('plan() — collateral track', () => {
  it('collateral plan is within the page-count range [1, 24]', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    expect(p.items.length).toBeGreaterThanOrEqual(1);
    expect(p.items.length).toBeLessThanOrEqual(24);
  });

  it('collateral plan uses CoverPage / ContentPage / etc. archetypes', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const archetypes = p.items.map((i) => i.archetype);
    // All items should use the collateral archetype vocabulary
    for (const a of archetypes) {
      expect(['CoverPage', 'ContentPage', 'StatsPage', 'ClosingPage']).toContain(a);
    }
  });

  // ── Long-form: the page count FOLLOWS THE BRIEF (one page per must-include) ──
  it('long-form collateral: a 20-item brief yields 20 pages', () => {
    scaffoldClient();
    writeBrief(
      Array.from({ length: 20 }, (_, i) => `Section ${i + 1} — topic ${i + 1}`),
      'collateral',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx);

    // one page per brief item
    expect(p.items.length).toBe(20);
    // Cover first, Closing last; interiors are Content or Stats only
    expect(p.items[0].archetype).toBe('CoverPage');
    expect(p.items[19].archetype).toBe('ClosingPage');
    for (let i = 1; i < 19; i++) {
      expect(['ContentPage', 'StatsPage']).toContain(p.items[i].archetype);
    }
    // ids are unique — the dispatch keys request/response by anchor.id, so a
    // collision would collapse two pages onto one dispatch file.
    const ids = p.items.map((it) => it.anchor.id);
    expect(new Set(ids).size).toBe(ids.length);
    // intent traces back to the brief item verbatim
    expect(p.items.map((it) => it.intent)).toContain('Section 7 — topic 7');
  });

  it('long-form collateral is capped at the 24-page guard', () => {
    scaffoldClient();
    writeBrief(
      Array.from({ length: 40 }, (_, i) => `Overflow section ${i + 1}`),
      'collateral',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'collateral');
    const p = plan(ctx);
    expect(p.items.length).toBe(24);
  });

  it('collateral plan track is collateral', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    expect(p.track).toBe('collateral');
  });

  it('collateral sections.md round-trips through loadSections()', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const yaml = serializeSections(p);
    const loaded = loadSections(yaml);
    expect(loaded.sections).toHaveLength(p.items.length);
    for (let i = 0; i < p.items.length; i++) {
      expect(loaded.sections[i].id).toBe(p.items[i].anchor.id);
    }
  });

  // ── STATS_RE plural/suffix tolerance (WS4 A1) ────────────────────────────────
  // Mirror the established collateral-test shape: scaffold → writeBrief → buildContext.
  function makeCollateralCtx(mustInclude: string[], body?: string): DesignContext {
    scaffoldClient();
    writeBrief(mustInclude, 'collateral', body);
    return buildContext(FIXTURE_CLIENT, 'collateral');
  }

  it('classifies suffixed stat language as StatsPage (RC: STATS_RE plural miss)', () => {
    const ctx = makeCollateralCtx([
      'Cover',                              // 0 → CoverPage
      'Reliability metrics across pilots',  // 1 → StatsPage (was ContentPage)
      'Determinism numbers that matter',    // 2 → StatsPage
      'Benchmark comparisons vs baseline',  // 3 → StatsPage
      'How the zones connect',              // 4 → ContentPage (no stat language)
      'Close',                              // 5 → ClosingPage
    ]);
    const p = plan(ctx);
    expect(p.items[1].archetype).toBe('StatsPage');
    expect(p.items[2].archetype).toBe('StatsPage');
    expect(p.items[3].archetype).toBe('StatsPage');
    expect(p.items[4].archetype).toBe('ContentPage');
  });

  it('does NOT false-fire StatsPage on stat-prefixed non-stat words', () => {
    const ctx = makeCollateralCtx([
      'Cover',
      'Statutory framework and statements',  // "statutory"/"statements" must NOT be Stats
      'Static architecture overview',         // "static" must NOT be Stats
      'Close',
    ]);
    const p = plan(ctx);
    expect(p.items[1].archetype).toBe('ContentPage');
    expect(p.items[2].archetype).toBe('ContentPage');
  });

  it('classifies -ing stat verbs as StatsPage (compar/eval -ing parity)', () => {
    const ctx = makeCollateralCtx([
      'Cover',
      'Comparing approaches',     // 1 → StatsPage ("comparing")
      'Evaluating throughput',    // 2 → StatsPage ("evaluating")
      'Close',
    ]);
    const p = plan(ctx);
    expect(p.items[1].archetype).toBe('StatsPage');
    expect(p.items[2].archetype).toBe('StatsPage');
  });

  // ── attachBriefContent unique-substring tier (WS4 A2) ────────────────────────
  it('forwards brief-body copy by unique substring when slugs are not equal', () => {
    const body = [
      '## Zone Topology',
      'Zone 1 is the untrusted edge; Zone 3 is the deterministic core.',
      '## Closing',
      'Talk to us.',
    ].join('\n');
    const ctx = makeCollateralCtx(
      ['Cover', 'Zone Topology and Trust Boundaries', 'Closing'],
      body,
    );
    const p = plan(ctx);
    // intent slug "zone-topology-and-trust-boundaries" CONTAINS chunk slug "zone-topology"
    expect(p.items[1].content).toContain('untrusted edge');
  });

  it('token-overlap resolves a would-be substring tie to the uniquely-strongest chunk (W50)', () => {
    const body = [
      '## Zone',           // slug "zone" — shares only {zone} with the intent (weak)
      'A.',
      '## Zone Topology',  // slug "zone-topology" — shares {zone, topology} (strong, unique)
      'B.',
    ].join('\n');
    const ctx = makeCollateralCtx(['Cover', 'Zone Topology Detail', 'Closing'], body);
    const p = plan(ctx);
    // Under substring alone both chunks "qualified" (ambiguous → dropped). Token-overlap
    // discriminates: "Zone Topology" (2 shared tokens) is the unique strong match, so the
    // previously-lost content is now delivered. The weak "Zone" chunk is not grabbed.
    // (A GENUINE tie — two equally-strong chunks — still abstains: see
    // source-binding.test.ts "ABSTAINS on a genuine tie".)
    expect(p.items[1].content).toBeDefined();
    expect(p.items[1].content).toContain('B.');
    expect(p.items[1].content).not.toContain('A.');
  });

  // ── WS1 B4: content-aware lead-composition selection (anti-monotony) ──────────
  // NOTE on page titles: the interior page TITLES below are deliberately chosen NOT
  // to trip STATS_RE (which would make them StatsPages). 'Comparison'/'Proof' both
  // match STATS_RE → StatsPage, whose candidate set never contains the ContentPage
  // compositions the assertions check; 'Contrast'/'Testimonial' stay ContentPages
  // while their *content* still honestly fires the comparison/quote content-signal
  // cues. (Per the task: adjust the test INPUTS so cues fire — not the impl.)
  it('selects content-aware, non-monotonous compositions across same-archetype pages', () => {
    const body = [
      '## Contrast', 'maker vs checker, before vs after',
      '## Testimonial', '"It just works," said the lead. Trust the result.',
      '## Topology', 'zone 1 → zone 2 → zone 3 flow',
      '## Qualify', 'requirements: a, b, c, d must all hold',
    ].join('\n');
    const ctx = makeCollateralCtx(
      ['Cover', 'Contrast', 'Testimonial', 'Topology', 'Qualify', 'Close'],
      body,
    );
    const p = plan(ctx);
    const interior = p.items.slice(1, -1);
    // Each interior page got a composition...
    expect(interior.every((i) => typeof i.composition === 'string' && i.composition!.length > 0)).toBe(true);
    // ...content-fit: the comparison page leads with the comparison composition...
    expect(p.items[1].composition).toMatch(/TWO-COLUMN COMPARISON/);
    // ...the quote page leads with the pull-quote...
    expect(p.items[2].composition).toMatch(/PULL-QUOTE/);
    // ...and they are not all identical (anti-monotony).
    expect(new Set(interior.map((i) => i.composition)).size).toBeGreaterThan(1);
  });

  it('leaves Cover/Closing to their fixed treatments (no content-aware override)', () => {
    const ctx = makeCollateralCtx(['Cover', 'Body', 'Close']);
    const p = plan(ctx);
    expect(p.items[0].composition).toMatch(/COVER/);
    expect(p.items[p.items.length - 1].composition).toMatch(/CLOSE/);
  });

  it('is deterministic — two plans of the same brief select identical compositions', () => {
    const body = ['## A', 'this vs that', '## B', '"a quote here," she said', '## C', 'step 1 → step 2'].join('\n');
    const mk = () => plan(makeCollateralCtx(['Cover', 'A', 'B', 'C', 'Close'], body));
    expect(mk().items.map((i) => i.composition)).toEqual(mk().items.map((i) => i.composition));
  });

  // Same-signal rotation: 3 interior pages all fire ONLY the `list` cue (no vs/digits/
  // quotes/zone/step), so all three share the 2-candidate ContentPage `list` set
  // (NUMBERED EDITORIAL LIST idx0, ICON-FEATURE GRID idx1). This is the case that
  // genuinely exercises the anti-monotony window + least-used fallback (distinct-signal
  // pages would diversify trivially without the window ever firing).
  it('rotates same-signal pages through the candidate set, then falls back to least-used', () => {
    const body = [
      '## Roles', 'first the maker drafts, second the approver signs, third the record locks',
      '## Duties', 'first intake, second triage, third resolution',
      '## Phases', 'first plan, second build, third ship',
    ].join('\n');
    const ctx = makeCollateralCtx(['Cover', 'Roles', 'Duties', 'Phases', 'Close'], body);
    const p = plan(ctx);
    // All three are 'list'-signalled ContentPages → 2-candidate set (NUMBERED / ICON-FEATURE).
    expect(p.items[1].composition).toMatch(/NUMBERED EDITORIAL LIST/);   // 1st: canonical order
    expect(p.items[2].composition).toMatch(/ICON-FEATURE GRID/);          // 2nd: rotated (1st is recent)
    expect(p.items[3].composition).toMatch(/NUMBERED EDITORIAL LIST/);    // 3rd: both recent → least-used → canonical
    expect(p.items[1].composition).not.toBe(p.items[2].composition);      // genuine rotation
  });

  // ── WS5 — rich visual routing (flagship + spatial-hero cover) ────────────────
  it('designates exactly one flagship visual page when rich content exists', () => {
    const ctx = makeCollateralCtx([
      'Cover',
      'The operating model across three zones',  // spatial + diagram (2 cues → flagship)
      'How the nodes connect in the topology',   // diagram (1 cue)
      'Our pricing and plans',                   // no rich signal
      'Close',
    ]);
    const p = plan(ctx);
    const flagged = p.items.filter((i) => i.flagshipVisual);
    expect(flagged.length).toBe(1);
    const sig = deriveContentSignal(flagged[0]);
    expect(sig.includes('diagram') || sig.includes('spatial')).toBe(true);
    // strongest page wins: the 2-cue operating-model page, not the 1-cue topology page.
    expect(flagged[0].intent).toMatch(/operating model/i);
  });

  it('designates zero flagship pages for a prose deck', () => {
    const ctx = makeCollateralCtx(['Cover', 'Our Story', 'What We Believe', 'Close']);
    const p = plan(ctx);
    expect(p.items.some((i) => i.flagshipVisual)).toBe(false);
  });

  it('gives the cover a spatial hero when the deck is system/architecture heavy', () => {
    const ctx = makeCollateralCtx([
      'Cover',
      'The operating model across three zones',  // spatial
      'Platform architecture and ecosystem',     // spatial + diagram
      'How the nodes connect in the topology',   // diagram
      'Layered system architecture',             // spatial + diagram
      'Close',
    ]);
    const p = plan(ctx);
    const cover = p.items.find((i) => i.archetype === 'CoverPage')!;
    expect(cover.composition).toMatch(/SPATIAL HERO COVER/);
  });

  it('leaves the cover as the standard editorial cover for a prose deck', () => {
    const ctx = makeCollateralCtx(['Cover', 'Our Story', 'What We Believe', 'Close']);
    const p = plan(ctx);
    const cover = p.items.find((i) => i.archetype === 'CoverPage')!;
    expect(cover.composition).toMatch(/COVER/);
    expect(cover.composition).not.toMatch(/SPATIAL HERO/);
  });

  it('rich-visual routing is deterministic across runs', () => {
    const must = ['Cover', 'The operating model across three zones', 'Platform architecture and ecosystem', 'How the nodes connect in the topology', 'Close'];
    const mk = () => plan(makeCollateralCtx(must));
    const a = mk().items.map((i) => ({ c: i.composition, f: !!i.flagshipVisual }));
    const b = mk().items.map((i) => ({ c: i.composition, f: !!i.flagshipVisual }));
    expect(a).toEqual(b);
  });

  // ── W52 — Presentation Intent TRANSPORT (default OFF ⇒ byte-identical; collateral only) ──
  describe('W52 — presentationIntent transport gate', () => {
    const must = ['Cover', 'Reliability metrics 99.9% uptime', 'How the zones connect: step 1, step 2', 'Close'];

    it('default (option omitted): no item carries presentationIntent — plan stays byte-identical', () => {
      const ctx = makeCollateralCtx(must);
      const p = plan(ctx);
      for (const item of p.items) {
        expect(item.presentationIntent).toBeUndefined();
      }
    });

    it('enabled: every collateral item carries a frozen PresentationIntent grounded in its own content', () => {
      const ctx = makeCollateralCtx(must);
      const p = plan(ctx, { presentationIntent: true });
      for (const item of p.items) {
        expect(item.presentationIntent).toBeDefined();
        expect(item.presentationIntent!.validationState).toBe('valid');
        expect(Object.isFrozen(item.presentationIntent)).toBe(true);
      }
      const stats = p.items.find((i) => /Reliability metrics/.test(i.intent));
      expect(stats?.presentationIntent?.intentClass).toBe('chart');
      const diagram = p.items.find((i) => /How the zones connect/.test(i.intent));
      expect(diagram?.presentationIntent?.intentClass).toBe('diagram');
    });

    it('enabling presentationIntent changes NOTHING else — archetype/composition/order/count unchanged', () => {
      const ctx = () => makeCollateralCtx(must);
      const off = plan(ctx());
      const on = plan(ctx(), { presentationIntent: true });
      const strip = (items: typeof off.items) =>
        items.map((i) => ({ archetype: i.archetype, composition: i.composition, intent: i.intent, id: i.anchor.id }));
      expect(strip(on.items)).toEqual(strip(off.items));
    });

    it('never attached on the website track, even when the option is enabled', () => {
      const ctx = buildContext('example-brand', 'website');
      const p = plan(ctx, { presentationIntent: true });
      for (const item of p.items) {
        expect(item.presentationIntent).toBeUndefined();
      }
    });
  });

  // ── W63 — governed default activation (reuses W60's resolveGovernedActivation exactly) ──────
  describe('W63 — presentationIntent governed activation', () => {
    const must = ['Cover', 'Reliability metrics 99.9% uptime', 'Close'];

    it('governance enabled + env unset → resolveGovernedActivation resolves true → intent activates', () => {
      const ctx = makeCollateralCtx(must);
      const enabled = resolveGovernedActivation(undefined, true);
      expect(enabled).toBe(true);
      const p = plan(ctx, { presentationIntent: enabled });
      const stats = p.items.find((i) => /Reliability metrics/.test(i.intent));
      expect(stats?.presentationIntent?.intentClass).toBe('chart');
    });

    it('governance disabled + env unset → resolveGovernedActivation resolves false → byte-identical default', () => {
      const ctx = makeCollateralCtx(must);
      const enabled = resolveGovernedActivation(undefined, false);
      expect(enabled).toBe(false);
      const p = plan(ctx, { presentationIntent: enabled });
      for (const item of p.items) expect(item.presentationIntent).toBeUndefined();
    });

    it('explicit env="1" overrides governance disabled → still activates', () => {
      const ctx = makeCollateralCtx(must);
      const enabled = resolveGovernedActivation('1', false);
      expect(enabled).toBe(true);
      const p = plan(ctx, { presentationIntent: enabled });
      const stats = p.items.find((i) => /Reliability metrics/.test(i.intent));
      expect(stats?.presentationIntent?.intentClass).toBe('chart');
    });

    it('explicit env="0" overrides governance enabled → stays inactive', () => {
      const ctx = makeCollateralCtx(must);
      const enabled = resolveGovernedActivation('0', true);
      expect(enabled).toBe(false);
      const p = plan(ctx, { presentationIntent: enabled });
      for (const item of p.items) expect(item.presentationIntent).toBeUndefined();
    });

    it('replay determinism: governed activation produces identical plans across repeated builds', () => {
      const enabled = resolveGovernedActivation(undefined, true);
      const a = plan(makeCollateralCtx(must), { presentationIntent: enabled });
      const b = plan(makeCollateralCtx(must), { presentationIntent: enabled });
      expect(a.items.map((i) => i.presentationIntent)).toEqual(b.items.map((i) => i.presentationIntent));
    });
  });
});

// ── (g) Brief mustInclude is reflected in plan items ─────────────────────────

describe('plan() — brief.mustInclude traceability', () => {
  it('mustInclude items appear in the plan with matching intent', () => {
    scaffoldClient();
    writeBrief(['hero section', 'pricing page', 'faq section', 'footer section', 'features grid']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);

    const intents = p.items.map((i) => i.intent);
    expect(intents).toContain('hero section');
    expect(intents).toContain('pricing page');
    expect(intents).toContain('faq section');
  });

  it('hero mustInclude maps to hero archetype', () => {
    scaffoldClient();
    writeBrief(['hero section', 'pricing', 'faq', 'footer', 'features']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);

    const heroItem = p.items.find((i) => i.archetype === 'hero');
    expect(heroItem).toBeDefined();
  });

  it('pricing mustInclude maps to pricing archetype', () => {
    scaffoldClient();
    writeBrief(['hero', 'pricing page', 'faq', 'footer', 'features']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);

    const pricingItem = p.items.find((i) => i.archetype === 'pricing');
    expect(pricingItem).toBeDefined();
  });

  // ── Phase-3 vocabulary additions: contact + resources route from a real brief ──
  it('contact + resources mustInclude map to the new archetypes', () => {
    scaffoldClient();
    writeBrief(['hero', 'features', 'latest insights', 'contact us', 'footer']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);

    expect(p.items.some((i) => i.archetype === 'contact')).toBe(true);
    expect(p.items.some((i) => i.archetype === 'resources')).toBe(true);
  });

  it('"customer story" routes to case-study, not editorial (story-word precedence)', () => {
    scaffoldClient();
    writeBrief(['hero', 'features', 'customer story', 'pricing', 'footer']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);

    const story = p.items.find((i) => i.intent === 'customer story');
    expect(story?.archetype).toBe('case-study');
  });
});

// ── (h) Archetype-assignment fidelity (component-picking RC fixes) ────────────
// The design team caught real briefs collapsing to the feature-grid fallback
// (subject-named sections never hit the keyword map) and a "tiers" false-positive
// dragging non-pricing sections into pricing. These guard the three fixes:
//   RC-2  false-positive removal (bare "tiers"/"plans" no longer = pricing)
//   RC-1a content-structure cues (architecture/zones, flow arrows, "vs")
//   RC-1b explicit "<archetype>: intent" declaration (author-controlled, wins)

describe('plan() — archetype assignment fidelity', () => {
  // RC-2: a scheduler section that merely says "tiers from policy rows" must NOT
  // be hijacked into pricing by a bare "tiers" cue.
  it('a scheduler section mentioning "tiers from policy rows" is NOT classified pricing', () => {
    scaffoldClient();
    writeBrief([
      'hero',
      'Deterministic schedulers — 12 jobs, tiers from policy rows not model output',
      'features',
      'faq',
      'metrics',
    ]);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const sched = p.items.find((i) => i.intent.startsWith('Deterministic schedulers'));
    expect(sched).toBeDefined();
    expect(sched!.archetype).not.toBe('pricing');
  });

  // RC-2: genuine pricing language must still resolve to pricing.
  it('genuine pricing sections still resolve to the pricing archetype', () => {
    scaffoldClient();
    writeBrief(['hero', 'Pricing & plans', 'features', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    expect(p.items.some((i) => i.archetype === 'pricing')).toBe(true);
  });

  it('"our pricing tiers" still resolves to pricing (pricing-anchored)', () => {
    scaffoldClient();
    writeBrief(['hero', 'our pricing tiers', 'features', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const pr = p.items.find((i) => i.intent === 'our pricing tiers');
    expect(pr?.archetype).toBe('pricing');
  });

  // RC-1a: content-structure cues lift sections off the feature-grid fallback.
  it('an architecture / zones section maps to feature-spotlight', () => {
    scaffoldClient();
    writeBrief([
      'hero',
      'The three-zone architecture (Zone 1 · Zone 2 · Zone 3)',
      'features',
      'faq',
      'footer',
    ]);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const arch = p.items.find((i) => i.intent.includes('three-zone architecture'));
    expect(arch?.archetype).toBe('feature-spotlight');
  });

  it('an arrow / maker-checker flow section maps to process', () => {
    scaffoldClient();
    writeBrief([
      'hero',
      'Human-in-the-loop — Maker → Checker → Director → MD',
      'features',
      'faq',
      'footer',
    ]);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const flow = p.items.find((i) => i.intent.includes('Human-in-the-loop'));
    expect(flow?.archetype).toBe('process');
  });

  it('a "X vs Y" section maps to plan-comparison', () => {
    scaffoldClient();
    writeBrief(['hero', 'Manual vs autonomous', 'features', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const cmp = p.items.find((i) => i.intent === 'Manual vs autonomous');
    expect(cmp?.archetype).toBe('plan-comparison');
  });

  // RC-1b: explicit "<archetype>: intent" declaration WINS and strips the prefix.
  it('an explicit archetype declaration overrides keyword inference and strips the prefix', () => {
    scaffoldClient();
    writeBrief(['hero', 'metrics: our pricing wins for teams', 'features', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    // "pricing" keyword is present, but the explicit `metrics:` declaration wins,
    // and the `metrics:` prefix is stripped from the stored intent.
    const decl = p.items.find((i) => i.intent === 'our pricing wins for teams');
    expect(decl).toBeDefined();
    expect(decl!.archetype).toBe('metrics');
  });

  it('a declared archetype written with spaces ("feature spotlight:") is recognized', () => {
    scaffoldClient();
    writeBrief(['hero', 'feature spotlight: the engine internals', 'features', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const decl = p.items.find((i) => i.intent === 'the engine internals');
    expect(decl?.archetype).toBe('feature-spotlight');
  });

  it('a non-archetype prefix is treated as plain copy (colon preserved in intent)', () => {
    scaffoldClient();
    writeBrief(['hero', 'Statutory Determinism: GST 18%, TDS 10%', 'features', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    // "statutory determinism" is not an archetype → the full string is kept verbatim.
    expect(p.items.some((i) => i.intent === 'Statutory Determinism: GST 18%, TDS 10%')).toBe(true);
  });

  it('is deterministic — declared + inferred mix yields identical plans', () => {
    scaffoldClient();
    writeBrief(['hero', 'feature-spotlight: zones', 'Manual vs autonomous', 'faq', 'metrics']);
    const p1 = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const p2 = plan(buildContext(FIXTURE_CLIENT, 'website'));
    expect(serializeSections(p1)).toBe(serializeSections(p2));
    for (let i = 0; i < p1.items.length; i++) {
      expect(p1.items[i].archetype).toBe(p2.items[i].archetype);
      expect(p1.items[i].intent).toBe(p2.items[i].intent);
    }
  });
});

// ── Website fragment curation (WS9a): constitution-by-selection metadata ─────
// WS9a (EA-019/EA-020) restores the planner's catalog selection: after composition
// routing, assignWebsiteFragments sets each website item's `fragmentId` + `candidates`
// from the WS1 COMPOSITION-backed catalog via the EXISTING selection algebra
// (selectCandidates + pickFragment). The metadata is DORMANT: curation.ts emits a
// "## Curation Table" into rulebook.md, but it is not assembled into the shipped page
// until WS6/WS9b — the deliverable stays byte-identical. Collateral never uses the
// website catalog, so its items carry no fragmentId and its rulebook has no table.

describe('plan() — website fragment curation (WS9a)', () => {
  it('every website item carries a fragmentId in the catalog + ≥2 candidates including it', () => {
    const catalog = new Set(loadFragmentCatalog().map((f) => f.slug));
    const p = plan(buildContext('example-brand', 'website'));
    for (const item of p.items) {
      expect(typeof item.fragmentId, `intent: ${item.intent}`).toBe('string');
      expect(catalog.has(item.fragmentId!), `fragmentId "${item.fragmentId}" ∈ catalog`).toBe(true);
      expect(item.candidates, `intent: ${item.intent}`).toBeDefined();
      expect(item.candidates!.length, `intent: ${item.intent}`).toBeGreaterThanOrEqual(2);
      expect(item.candidates).toContain(item.fragmentId);
      for (const c of item.candidates!) expect(catalog.has(c), `candidate "${c}" ∈ catalog`).toBe(true);
    }
  });

  it('two same-archetype website sections curate different fragments (within-page rotation)', () => {
    scaffoldClient();
    writeBrief(['hero', 'features', 'more features', 'metrics', 'faq', 'footer']);
    const p = plan(buildContext(FIXTURE_CLIENT, 'website'));
    const feats = p.items.filter((i) => i.archetype === 'feature-grid');
    expect(feats.length).toBeGreaterThanOrEqual(2);
    const ids = feats.map((i) => i.fragmentId);
    expect(new Set(ids).size).toBe(ids.length); // all distinct — within-page diversity
  });

  it('is deterministic — two plan() calls curate the identical fragment sequence', () => {
    const p1 = plan(buildContext('example-brand', 'website'));
    const p2 = plan(buildContext('example-brand', 'website'));
    expect(p1.items.map((i) => i.fragmentId)).toEqual(p2.items.map((i) => i.fragmentId));
  });

  it('collateral items do NOT carry website fragmentIds', () => {
    scaffoldClient();
    writeBrief(['Cover', 'Details', 'Stats', 'Closing'], 'collateral');
    const p = plan(buildContext(FIXTURE_CLIENT, 'collateral'));
    expect(p.items.every((i) => i.fragmentId === undefined)).toBe(true);
  });
});

describe('plan() — rulebook Curation Table (WS9a website-only)', () => {
  it('website rulebook embeds a Curation Table', () => {
    const p = plan(buildContext('example-brand', 'website'));
    const rulebook = serializeRulebook(p, 'example-brand');
    expect(rulebook).toContain('## Curation Table');
  });

  it('collateral rulebook embeds no Curation Table', () => {
    const p = plan(buildContext('example-brand', 'collateral'));
    const rulebook = serializeRulebook(p, 'example-brand');
    expect(rulebook).not.toContain('## Curation Table');
  });
});

// ── W67 — semanticAuthorContext governed default activation (reuses W60's ───────────────────────
//    resolveGovernedActivation exactly; mirrors the W63 presentationIntent/cadence test shape) ──
describe('plan() — website semanticAuthorContext governed activation (W67)', () => {
  it('governance enabled + env unset → resolveGovernedActivation resolves true → every real item gains componentKnowledge', () => {
    const enabled = resolveGovernedActivation(undefined, true);
    expect(enabled).toBe(true);
    const p = plan(buildContext('example-brand', 'website'), { semanticAuthorContext: enabled });
    expect(p.items.length).toBeGreaterThan(0);
    for (const item of p.items) {
      expect(item.componentKnowledge, `intent: ${item.intent}`).toBeDefined();
    }
  });

  it('governance disabled + env unset → resolveGovernedActivation resolves false → byte-identical default (no componentKnowledge)', () => {
    const enabled = resolveGovernedActivation(undefined, false);
    expect(enabled).toBe(false);
    const p = plan(buildContext('example-brand', 'website'), { semanticAuthorContext: enabled });
    for (const item of p.items) expect(item.componentKnowledge).toBeUndefined();
  });

  it('explicit "1" overrides ON even when governance is disabled', () => {
    const enabled = resolveGovernedActivation('1', false);
    expect(enabled).toBe(true);
    const p = plan(buildContext('example-brand', 'website'), { semanticAuthorContext: enabled });
    for (const item of p.items) expect(item.componentKnowledge).toBeDefined();
  });

  it('explicit "0" overrides OFF even when governance is enabled', () => {
    const enabled = resolveGovernedActivation('0', true);
    expect(enabled).toBe(false);
    const p = plan(buildContext('example-brand', 'website'), { semanticAuthorContext: enabled });
    for (const item of p.items) expect(item.componentKnowledge).toBeUndefined();
  });

  it('is deterministic — two plan() calls under the governed default produce identical componentKnowledge digests', () => {
    const enabled = resolveGovernedActivation(undefined, true);
    const a = plan(buildContext('example-brand', 'website'), { semanticAuthorContext: enabled });
    const b = plan(buildContext('example-brand', 'website'), { semanticAuthorContext: enabled });
    expect(a.items.map((i) => i.componentKnowledge?.digest)).toEqual(
      b.items.map((i) => i.componentKnowledge?.digest),
    );
  });

  it('collateral items never carry componentKnowledge, regardless of the flag (cross-track isolation)', () => {
    const p = plan(buildContext('example-brand', 'collateral'), { semanticAuthorContext: true });
    for (const item of p.items) expect(item.componentKnowledge).toBeUndefined();
  });
});

// ── WEBSITE_KEYWORD_MAP correctness (W69A/W69B) ──────────────────────────────
// Three proven production routing bugs (SPRINT-W69A-WEBSITE-ROUTING-CORRECTNESS-AUDIT.md):
// a bare, unanchored `process` alternative substring-matches inside "processor", and a bare
// `team`/`about` alternative matches incidental whole words unrelated to founder/team-about
// content. These tests exercise `mustIncludeToArchetype` indirectly through plan() (the
// function is unexported, mirroring this codebase's established no-unit-test-seam pattern —
// see W64 §5) using the exact real-brief strings W69A traced.

describe('plan() — WEBSITE_KEYWORD_MAP correctness (W69A/W69B)', () => {
  it('"processor" no longer satisfies the process cue (ledgerwise real case)', () => {
    scaffoldClient();
    writeBrief([
      'comparison: Ledgerwise versus a processor plus a ledger plus a compliance vendor',
      'hero',
      'metrics',
      'faq',
      'cta-banner',
    ]);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) =>
      i.intent.startsWith('comparison: Ledgerwise versus a processor'),
    );
    expect(item).toBeDefined();
    expect(item!.archetype).not.toBe('process');
  });

  it('comparison declarations now win correctly (ledgerwise real case)', () => {
    scaffoldClient();
    writeBrief([
      'comparison: Ledgerwise versus a processor plus a ledger plus a compliance vendor',
      'hero',
      'metrics',
      'faq',
      'cta-banner',
    ]);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) =>
      i.intent.startsWith('comparison: Ledgerwise versus a processor'),
    );
    expect(item).toBeDefined();
    expect(item!.archetype).toBe('plan-comparison');
  });

  it('"teams" no longer satisfies the founder cue (medical real case)', () => {
    scaffoldClient();
    writeBrief([
      'The administrative burden on care teams',
      'hero',
      'metrics',
      'faq',
      'cta-banner',
    ]);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) => i.intent === 'The administrative burden on care teams');
    expect(item).toBeDefined();
    expect(item!.archetype).not.toBe('founder');
    expect(item!.archetype).toBe('feature-grid');
  });

  it('"about" no longer satisfies the founder cue (isolated case, no "team")', () => {
    scaffoldClient();
    writeBrief([
      'Everything you need to know about our platform',
      'hero',
      'metrics',
      'faq',
      'cta-banner',
    ]);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) => i.intent === 'Everything you need to know about our platform');
    expect(item).toBeDefined();
    expect(item!.archetype).not.toBe('founder');
    expect(item!.archetype).toBe('feature-grid');
  });

  it('legitimate founder routing still works (bare "founder" keyword, undeclared)', () => {
    scaffoldClient();
    writeBrief(['Meet our founder', 'hero', 'metrics', 'faq', 'cta-banner']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) => i.intent === 'Meet our founder');
    expect(item).toBeDefined();
    expect(item!.archetype).toBe('founder');
  });

  it('legitimate process routing still works (bare "process" keyword, undeclared)', () => {
    scaffoldClient();
    writeBrief([
      'Our process for onboarding new customers',
      'hero',
      'metrics',
      'faq',
      'cta-banner',
    ]);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) => i.intent === 'Our process for onboarding new customers');
    expect(item).toBeDefined();
    expect(item!.archetype).toBe('process');
  });

  it('"how-it-works:" declaration prefix still resolves to process (forgeline real case, unaffected)', () => {
    scaffoldClient();
    writeBrief([
      'how-it-works: Connect, normalize, and act in three steps on the existing floor',
      'hero',
      'metrics',
      'faq',
      'cta-banner',
    ]);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx);
    const item = p.items.find((i) => i.intent.startsWith('how-it-works: Connect, normalize'));
    expect(item).toBeDefined();
    expect(item!.archetype).toBe('process');
  });
});

// ── W70 — Website Visual Discovery TRANSPORT (default OFF ⇒ byte-identical; website only) ──────
describe('plan() — website websiteVisualDiscovery transport gate (W70)', () => {
  it('default (option omitted): no item carries visualDiscovery — plan stays byte-identical', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    for (const item of p.items) {
      expect(item.visualDiscovery).toBeUndefined();
    }
  });

  it('enabled: every website item carries a frozen WebsiteVisualDiscovery grounded in its own archetype + content', () => {
    scaffoldClient();
    writeBrief(['Either upgrade the whole platform or replace it entirely', 'hero', 'metrics', 'faq', 'cta-banner']);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    const p = plan(ctx, { websiteVisualDiscovery: true });
    for (const item of p.items) {
      expect(item.visualDiscovery).toBeDefined();
      expect(item.visualDiscovery!.validationState).toBe('valid');
      expect(Object.isFrozen(item.visualDiscovery)).toBe(true);
    }
    // No colon prefix and no comparison/compare/versus/vs keyword literal, so WEBSITE_KEYWORD_MAP
    // falls through to the generic feature-grid fallback — whose content still reads as
    // comparison-shaped per deriveContentSignal's broader "either…or" cue: a disagreement.
    const comparisonShaped = p.items.find((i) => i.intent === 'Either upgrade the whole platform or replace it entirely');
    expect(comparisonShaped?.archetype).toBe('feature-grid');
    expect(comparisonShaped?.visualDiscovery?.archetypeFit).toBe(false);
    expect(comparisonShaped?.visualDiscovery?.suggestedFamily).toBe('comparison');
  });

  it('enabling websiteVisualDiscovery changes NOTHING else — archetype/composition/fragmentId/order/count unchanged', () => {
    scaffoldClient();
    writeBrief(['Either upgrade the whole platform or replace it entirely', 'hero', 'metrics', 'faq', 'cta-banner']);
    const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
    const off = plan(ctxFor());
    const on = plan(ctxFor(), { websiteVisualDiscovery: true });
    const strip = (items: typeof off.items) =>
      items.map((i) => ({
        archetype: i.archetype,
        composition: i.composition,
        componentVariant: i.componentVariant,
        fragmentId: i.fragmentId,
        intent: i.intent,
        id: i.anchor.id,
      }));
    expect(strip(on.items)).toEqual(strip(off.items));
  });

  it('never attached on the collateral track, even when the option is enabled', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx, { websiteVisualDiscovery: true });
    for (const item of p.items) {
      expect(item.visualDiscovery).toBeUndefined();
    }
  });

  it('is deterministic — two plan() calls under the flag produce identical visualDiscovery digests', () => {
    scaffoldClient();
    writeBrief(['Either upgrade the whole platform or replace it entirely', 'hero', 'metrics', 'faq', 'cta-banner']);
    const ctxFor = () => buildContext(FIXTURE_CLIENT, 'website');
    const a = plan(ctxFor(), { websiteVisualDiscovery: true });
    const b = plan(ctxFor(), { websiteVisualDiscovery: true });
    expect(a.items.map((i) => i.visualDiscovery?.digest)).toEqual(b.items.map((i) => i.visualDiscovery?.digest));
  });

  it('grep isolation: no consumer reads item.visualDiscovery anywhere in src/ outside plan.ts/types.ts/website-visual-discovery.ts', () => {
    // A structural sanity check mirroring W52 §8's isolation grep, expressed as a test so a future
    // accidental consumer trips CI rather than requiring a manual re-grep.
    const behaviorUnaffected = () => {
      scaffoldClient();
      writeBrief(['Either upgrade the whole platform or replace it entirely', 'hero', 'metrics', 'faq', 'cta-banner']);
      const ctx = buildContext(FIXTURE_CLIENT, 'website');
      return plan(ctx, { websiteVisualDiscovery: true }).items.map((i) => i.fragmentId);
    };
    const withFlag = behaviorUnaffected();
    scaffoldClient();
    writeBrief(['Either upgrade the whole platform or replace it entirely', 'hero', 'metrics', 'faq', 'cta-banner']);
    const withoutFlag = plan(buildContext(FIXTURE_CLIENT, 'website')).items.map((i) => i.fragmentId);
    expect(withFlag).toEqual(withoutFlag);
  });
});

// ── P24 — Content Capacity TRANSPORT (Foundation stage; default OFF ⇒ byte-identical; website only) ──
describe('plan() — website contentCapacity transport gate (P24)', () => {
  it('default (option omitted): no item carries contentCapacity', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    for (const item of p.items) {
      expect(item.contentCapacity).toBeUndefined();
    }
  });

  it('enabled, against the real (un-authored) corpus: field stays undefined for every item — no component declares Content Capacity yet, so transport is provably inert on real content', () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx, { contentCapacity: true });
    expect(p.items.length).toBeGreaterThan(0);
    for (const item of p.items) {
      expect(item.contentCapacity).toBeUndefined();
    }
  });

  it('enabling contentCapacity changes NOTHING else — archetype/composition/fragmentId/order/count unchanged', () => {
    const ctxFor = () => buildContext('example-brand', 'website');
    const off = plan(ctxFor());
    const on = plan(ctxFor(), { contentCapacity: true });
    const strip = (items: typeof off.items) =>
      items.map((i) => ({
        archetype: i.archetype,
        composition: i.composition,
        componentVariant: i.componentVariant,
        fragmentId: i.fragmentId,
        intent: i.intent,
        id: i.anchor.id,
      }));
    expect(strip(on.items)).toEqual(strip(off.items));
  });

  it('never attached on the collateral track, even when the option is enabled', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx, { contentCapacity: true });
    for (const item of p.items) {
      expect(item.contentCapacity).toBeUndefined();
    }
  });

  it('is deterministic — two plan() calls under the flag produce identical results', () => {
    const ctxFor = () => buildContext('example-brand', 'website');
    const a = plan(ctxFor(), { contentCapacity: true });
    const b = plan(ctxFor(), { contentCapacity: true });
    expect(a.items.map((i) => i.contentCapacity)).toEqual(b.items.map((i) => i.contentCapacity));
  });

  it('grep isolation: no consumer reads item.contentCapacity anywhere outside plan.ts/types.ts/content-capacity.ts', () => {
    // Structural sanity check mirroring W52/W70's own isolation grep, expressed as a test so a
    // future accidental consumer trips CI rather than requiring a manual re-grep.
    const ctx = buildContext('example-brand', 'website');
    const off = plan(ctx).items.map((i) => i.fragmentId);
    const on = plan(buildContext('example-brand', 'website'), { contentCapacity: true }).items.map((i) => i.fragmentId);
    expect(on).toEqual(off);
  });
});
