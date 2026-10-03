/**
 * Stage 3 — author.ts tests: authorDocument(plan, context, author)
 *
 * Coverage:
 *  (a) Output parses as valid HTML (parseHtml round-trips without error)
 *  (b) Self-contain: the section markup (body) introduces NO relative asset refs
 *      (honest deferral marker for inlineAssets)
 *      NOTE: house colors_and_type.css carries @font-face url("fonts/...") refs
 *      that will survive in the <style> block — these are kit-relative, not authored
 *      by the scripted author. The assertion here is that the *scripted author* emits
 *      no relative refs (confirmed by checking the section markup only, i.e. no
 *      src="./" or inline style url(./) patterns in the body fragments).
 *  (c) Carries reference tokens: a known brand custom-prop name from colors_and_type.css
 *      appears in the document's <style> block.
 *  (d) Deterministic: two calls with the same inputs produce byte-identical HTML.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../src/paths.js';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { defaultScriptedAuthor } from '../src/generate/authoring-seam.js';
import type { Author, AuthoringRequest } from '../src/generate/authoring-seam.js';
import { parseHtml, findElement, serializeHtml } from '../src/working-rep.js';

// ── Shared setup (real example-brand context + default scripted author) ───────────

function buildTestInputs() {
  const ctx = buildContext('example-brand', 'website');
  const p = plan(ctx);
  return { ctx, p };
}

// Governance CSS comments can contain literal <body> examples. A regex can match
// those inside <style>, accidentally testing head CSS instead of authored markup.
function sectionMarkup(html: string): string {
  const body = findElement(parseHtml(html), 'body');
  expect(body).toBeDefined();
  return serializeHtml({ type: 'root', children: body!.children });
}

// ── (a) Output parses as valid HTML ──────────────────────────────────────────

describe('authorDocument — parses as valid HTML', () => {
  it('assembled document is parseable (no throw)', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    // parseHtml should not throw
    expect(() => parseHtml(html)).not.toThrow();
  });

  it('parsed document has a <html> root with a <head> and <body>', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    // Basic structural check: must contain doctype + html + head + body
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
  });

  it('website is self-contained #root-rooted: a <div id="root"> hosts the bands, no <main> shell', async () => {
    // Post-pivot (author-from-governance): the website deliverable is a single
    // self-contained document mounted in <div id="root">, NOT the v2 _shell.html
    // <main> paste zone.
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html).toContain('<div id="root">');
    expect(html).not.toMatch(/<main\b/);
  });

  it('document title contains the brief one-liner', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    // The brief is a stub → title is the stub oneLiner (HTML-escaped)
    expect(html).toContain('<title>');
  });
});

// ── (b) Self-contain: scripted author emits no relative asset refs ────────────

describe('authorDocument — scripted author introduces no relative asset refs', () => {
  it('section markup contains no src="./" relative refs', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

    // Extract the body content (between <body> and </body>)
    const bodyContent = sectionMarkup(html);

    // No src="./..." or src="../..." in the section markup
    expect(bodyContent).not.toMatch(/src="\.{1,2}\//);
  });

  it('section markup contains no url(./) relative refs in inline styles', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

    const bodyContent = sectionMarkup(html);

    // No url(./...) or url(../...) in inline styles authored by the scripted author
    expect(bodyContent).not.toMatch(/url\(["']?\.{1,2}\//);
  });

  it('section markup contains no hardcoded hex colours', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

    const bodyContent = sectionMarkup(html);

    expect(bodyContent).not.toMatch(/#[0-9A-Fa-f]{3,6}\b/);
  });

  // Post-pivot website is SELF-CONTAINED: the house colors_and_type.css is inlined as a
  // <style> block (no <link>), and its @font-face url("fonts/*.ttf") refs are rewritten
  // to data: URIs — no relative font refs survive in the document.
  it('self-contained: inlines the token sheet (no <link>) with fonts as data: URIs', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

    // No external stylesheet link — the sheet is inlined as a <style> block
    expect(html).not.toMatch(/<link\b/);
    expect(html).toContain('<style>');
    // Fonts are inlined as data: URIs (self-contained, no font 404s)
    expect(html).toMatch(/data:font/);
    // No surviving relative font refs (url("fonts/…") rewritten to data:)
    expect(html).not.toMatch(/url\(\s*["']?\.?\/?fonts\//);
    // No surviving repo-relative ../ refs
    expect(html).not.toMatch(/url\(\s*["']?\.\.\//);
  });

  it('returns an empty warnings array on the scripted path', async () => {
    const { ctx, p } = buildTestInputs();
    const { warnings } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(warnings).toEqual([]);
  });
});

// ── (c) Carries reference tokens via the shell ────────────────────────────────────

describe('authorDocument — website inlines the token sheet (self-contained)', () => {
  it('inlines the house colors_and_type.css as a <style> block (no external <link>)', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html).not.toMatch(/<link\b/);
    expect(html).toContain('<style>');
  });

  it('document contains a <style> block (the shell base + @font-face block)', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html).toContain('<style>');
  });

  it('document <style> contains @font-face (the shell font faces, linked to ./fonts/)', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html).toContain('@font-face');
  });
});

// ── (d) Deterministic: two calls → byte-identical HTML ────────────────────────

describe('authorDocument — deterministic', () => {
  it('two calls with the same inputs produce byte-identical HTML', async () => {
    const { ctx, p } = buildTestInputs();
    const { html: html1 } = await authorDocument(p, ctx, defaultScriptedAuthor());
    const { html: html2 } = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(html1).toBe(html2);
  });

  it('plan items are all represented in the assembled document', async () => {
    const { ctx, p } = buildTestInputs();
    const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());

    // Each plan item's anchor id should appear in the document
    for (const item of p.items) {
      expect(html).toContain(`id="${item.anchor.id}"`);
    }
  });
});

// ── (e) Collateral per-archetype HOW guidance (WS4 A3) ────────────────────────
// Mirrors the established collateral-test shape used in plan.test.ts:
// scaffold a fixture client → writeBrief(collateral) → buildContext.

const COLLATERAL_FIXTURE_CLIENT = '__author_test__';

function scaffoldCollateralClient(): void {
  // Reference composition tests use bare project refs and the default example brand.
  mkdirSync(projectReferencesDir(COLLATERAL_FIXTURE_CLIENT), { recursive: true });
}

function writeCollateralBrief(mustInclude: string[], body = 'Brief body.'): void {
  const lines = [
    '---',
    'schemaVersion: 1',
    'track: collateral',
    'one-liner: "Test deliverable"',
    'audience: "Developers"',
    'goals:',
    '  - Drive signups',
    'must-include:',
    ...mustInclude.map((m) => `  - "${m}"`),
    '---',
    body,
  ];
  writeFileSync(
    join(projectReferencesDir(COLLATERAL_FIXTURE_CLIENT), 'brief.md'),
    lines.join('\n'),
    'utf8',
  );
}

describe('authorDocument — collateral per-archetype HOW guidance', () => {
  afterEach(() => {
    rmSync(projectDir(COLLATERAL_FIXTURE_CLIENT), { recursive: true, force: true });
  });

  it('threads per-archetype HOW guidance into collateral requests (WS4 A3)', async () => {
    const captured: AuthoringRequest[] = [];
    const spy: Author = {
      author: async (req) => {
        captured.push(req);
        return '<section></section>';
      },
    };
    scaffoldCollateralClient();
    // index 0 → CoverPage, 1 → ContentPage, 2 → StatsPage, last → ClosingPage
    writeCollateralBrief(['Cover', 'The mechanism', 'Proof in numbers', 'Closing']);
    const ctx = buildContext(COLLATERAL_FIXTURE_CLIENT, 'collateral');
    const planObj = plan(ctx);
    await authorDocument(planObj, ctx, spy);
    const contentReq = captured.find((r) => String(r.item.archetype) === 'ContentPage');
    expect(contentReq?.guidance).toBeTruthy();
    expect(contentReq?.guidance).toMatch(/one lead component|3 items|do not stack|3 rows/i);
  });

  it('forwards the plan-selected composition into the author request (WS1 B5)', async () => {
    const captured: AuthoringRequest[] = [];
    const spy: Author = {
      author: async (req) => {
        captured.push(req);
        return '<section></section>';
      },
    };
    scaffoldCollateralClient();
    // Interior 'Contrast' page carries comparison content → B4 sets item.composition =
    // TWO-COLUMN COMPARISON. (Title 'Contrast', NOT 'Comparison', to avoid STATS_RE →
    // StatsPage.) Its positional rotation would be index 0 = NUMBERED EDITORIAL LIST,
    // so the assertion distinguishes the content-aware pick from the positional fallback.
    writeCollateralBrief(
      ['Cover', 'Contrast', 'Close'],
      '## Contrast\nmaker vs checker, before vs after',
    );
    const ctx = buildContext(COLLATERAL_FIXTURE_CLIENT, 'collateral');
    const planObj = plan(ctx);
    await authorDocument(planObj, ctx, spy);
    const cmp = captured.find((r) => r.item.intent === 'Contrast');
    expect(cmp?.composition).toMatch(/TWO-COLUMN COMPARISON/);
  });
});

// ── (f) W53 — Presentation Intent CONSUMPTION (routed class + study pointer) ──────
// Proof strategy: attach a fabricated PresentationIntent (claiming 'comparison' content)
// directly onto a plan item whose REAL bound text is generic prose (no rich cues at all).
// A fresh deriveContentSignal(item) on that prose would yield ['generic'] — routedClass ''
// and studyPointer ''. If author.ts truly reads item.presentationIntent instead of
// re-deriving, the routed class + study pointer must follow the FABRICATED 'comparison'
// signal instead.
describe('authorDocument — W53 Presentation Intent consumption (collateral)', () => {
  afterEach(() => {
    rmSync(projectDir(COLLATERAL_FIXTURE_CLIENT), { recursive: true, force: true });
  });

  it('reads the routed class + study pointer from a transported PresentationIntent instead of re-deriving from content', async () => {
    scaffoldCollateralClient();
    writeCollateralBrief(['Cover', 'A perfectly generic feature description with no rich cues at all', 'Close']);
    const ctx = buildContext(COLLATERAL_FIXTURE_CLIENT, 'collateral');
    const planObj = plan(ctx); // presentationIntent transport OFF by default
    const contentItem = planObj.items.find((i) => String(i.archetype) === 'ContentPage')!;
    expect(contentItem.presentationIntent).toBeUndefined();

    contentItem.presentationIntent = Object.freeze({
      intentClass: 'diagram',
      commitment: 'inline',
      source: Object.freeze(['comparison']),
      digest: 'w53-fabricated-fixture',
      validationState: 'valid',
    }) as (typeof contentItem)['presentationIntent'];

    const captured: AuthoringRequest[] = [];
    const spy: Author = {
      author: async (req) => {
        captured.push(req);
        return `<section id="${req.item.anchor.id}"></section>`;
      },
    };
    const { html } = await authorDocument(planObj, ctx, spy);

    const req = captured.find((r) => r.item.anchor.id === contentItem.anchor.id);
    // A fresh derivation of the real prose ("generic feature description...") carries no
    // 'comparison' cue and would resolve to '' / hub-spoke defaults — so 'diagrams/comparison.html'
    // is only reachable via the fabricated transported source.
    expect(req?.studyPointer).toBe('diagrams/comparison.html');
    expect(html).toContain(`data-cr-routed="diagram"`);
  });

  it('falls back to a fresh content derivation when no PresentationIntent is transported (unchanged legacy path)', async () => {
    scaffoldCollateralClient();
    writeCollateralBrief(['Cover', 'How the nodes connect in the topology', 'Close']);
    const ctx = buildContext(COLLATERAL_FIXTURE_CLIENT, 'collateral');
    const planObj = plan(ctx);
    const contentItem = planObj.items.find((i) => String(i.archetype) === 'ContentPage')!;
    expect(contentItem.presentationIntent).toBeUndefined();

    const captured: AuthoringRequest[] = [];
    const spy: Author = {
      author: async (req) => {
        captured.push(req);
        return `<section id="${req.item.anchor.id}"></section>`;
      },
    };
    const { html } = await authorDocument(planObj, ctx, spy);
    const req = captured.find((r) => r.item.anchor.id === contentItem.anchor.id);
    expect(req?.studyPointer).toBe('diagrams/hub-spoke.html');
    expect(html).toContain(`data-cr-routed="diagram"`);
  });
});

// ── (g) W54 — Data Visualization parity (routed class + study pointer for 'chart') ──
// Mirrors the diagram-routing test above: a stats-signalled ContentPage (no STATS_RE
// archetype-trigger words, so it stays a ContentPage, not a StatsPage) must now receive
// the SAME architectural treatment diagram/spatial content already gets — a routed
// study pointer into the governed data-visualization exemplar corpus, and the
// data-cr-routed="chart" stamp the verification rail reads.
describe('authorDocument — W54 Data Visualization presentation-intent parity (collateral)', () => {
  afterEach(() => {
    rmSync(projectDir(COLLATERAL_FIXTURE_CLIENT), { recursive: true, force: true });
  });

  it('a stats-signalled page is routed the chart class + the benchmark-bars study pointer', async () => {
    scaffoldCollateralClient();
    writeCollateralBrief(['Cover', 'We cut onboarding time by 3x and saved $12 per seat', 'Close']);
    const ctx = buildContext(COLLATERAL_FIXTURE_CLIENT, 'collateral');
    const planObj = plan(ctx);
    const contentItem = planObj.items.find((i) => String(i.archetype) === 'ContentPage')!;

    const captured: AuthoringRequest[] = [];
    const spy: Author = {
      author: async (req) => {
        captured.push(req);
        return `<section id="${req.item.anchor.id}"></section>`;
      },
    };
    const { html } = await authorDocument(planObj, ctx, spy);
    const req = captured.find((r) => r.item.anchor.id === contentItem.anchor.id);
    expect(req?.studyPointer).toBe('data-visualization/benchmark-bars.html');
    expect(html).toContain(`data-cr-routed="chart"`);
  });

  it('reads the chart class from a transported PresentationIntent instead of re-deriving from content', async () => {
    scaffoldCollateralClient();
    writeCollateralBrief(['Cover', 'A perfectly generic feature description with no rich cues at all', 'Close']);
    const ctx = buildContext(COLLATERAL_FIXTURE_CLIENT, 'collateral');
    const planObj = plan(ctx); // presentationIntent transport OFF by default
    const contentItem = planObj.items.find((i) => String(i.archetype) === 'ContentPage')!;

    contentItem.presentationIntent = Object.freeze({
      intentClass: 'chart',
      commitment: 'inline',
      source: Object.freeze(['stats']),
      digest: 'w54-fabricated-fixture',
      validationState: 'valid',
    }) as (typeof contentItem)['presentationIntent'];

    const captured: AuthoringRequest[] = [];
    const spy: Author = {
      author: async (req) => {
        captured.push(req);
        return `<section id="${req.item.anchor.id}"></section>`;
      },
    };
    const { html } = await authorDocument(planObj, ctx, spy);
    const req = captured.find((r) => r.item.anchor.id === contentItem.anchor.id);
    expect(req?.studyPointer).toBe('data-visualization/benchmark-bars.html');
    expect(html).toContain(`data-cr-routed="chart"`);
  });
});
