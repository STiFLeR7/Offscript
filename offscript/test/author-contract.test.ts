/**
 * Stage 3 — author-contract.ts + seam-wiring tests.
 *
 * The bug this fixes: buildContext loaded the collateral governance into
 * context.governance.playbooks, but author.ts dropped it — the dispatched author
 * got no voice / composition / cheat-sheet / exemplar / fit budget. These tests
 * pin the wiring that stops dropping it.
 *
 * Coverage:
 *  (a) buildAuthorContract — collateral AND website each carry their load-bearing
 *      authoring markers + interpolate the brief; deck → ''.
 *  (b) selectExemplar — maps each collateral archetype to a non-empty fragment;
 *      website is track-isolated (resolves the website set, '' when uncurated).
 *  (c) authorDocument + createSubagentAuthor — writes _AUTHOR_CONTRACT.md ONCE,
 *      and each request.md points at it + embeds the archetype exemplar.
 *  (d) Regression — the scripted collateral path stays byte-identical (the new
 *      fields are ignored by the scripted author → determinism preserved).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { parseBrief } from '../src/generate/brief.js';
import type { DesignContext } from '../src/generate/types.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import {
  createSubagentAuthor,
  defaultScriptedAuthor,
} from '../src/generate/authoring-seam.js';
import {
  buildAuthorContract,
  selectExemplar,
  assignComposition,
  compositionCandidatesFor,
  richExemplarPointer,
} from '../src/generate/author-contract.js';

// ── (a) buildAuthorContract ────────────────────────────────────────────────────

describe('buildAuthorContract', () => {
  it('carries the website charter markers for the website track', () => {
    const ctx = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(ctx);
    expect(contract.length).toBeGreaterThan(0);
    // Voice, design charter, the website rails, the website type ramp + layout.
    expect(contract).toMatch(/Title Case/);
    expect(contract).toMatch(/numbers as proof/i);
    expect(contract).toMatch(/one primary focal point/i);
    // v2 re-theme (A1): the depth charter is now "restrained depth" (sanctioned shadow/glass
    // tokens only), not an absolute no-shadow ban — the marker moved with the charter.
    expect(contract).toMatch(/Restrained depth/i);
    expect(contract).toMatch(/NEVER indigo/i);
    expect(contract).toMatch(/Lucide only/i);
    expect(contract).toMatch(/cr-h-hero/);
    // Layout geometry is derived from the sheet token (not a hardcoded literal).
    expect(contract).toContain(ctx.tokens.customProps.get('--cr-content-max') ?? '1440px');
    expect(contract).toMatch(/var\(--token\)/i);
    // Phase-5 Motion tightening: reveals are transform-only, resting opacity stays 1
    // (the fix for the opacity:0-blank-render finding). This is prose-only, so guard it
    // here — else a Motion-section edit could silently drop the rule with no test failing.
    expect(contract).toMatch(/transform-only/i);
    expect(contract).toMatch(/STAYS 1/);
    // Track isolation: it must NOT carry the collateral A4 vocabulary.
    expect(contract).not.toMatch(/A4 fit/i);
    expect(contract).not.toMatch(/cr-list-row/);
    expect(contract).not.toMatch(/tone-periwinkle/);
  });

  // IMP-2 activation: the IMP-1 composition-reasoning companion is a sibling of the
  // runtime-parsed COMPOSITION.md, so the subagent does not auto-discover it. The website
  // contract must point the author at it (study the WHY) ALONGSIDE — never instead of —
  // the parsed catalog (COMPOSITION.md). This is the only newly-integrated reasoning file
  // not already reachable via a whole-file pointer (PHILOSOPHY/visual-language already are).
  it('surfaces the composition-reasoning companion alongside the parsed catalog (IMP-2)', () => {
    const ctx = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(ctx);
    expect(contract).toMatch(/COMPOSITION-REASONING\.md/);
    // The parsed catalog stays the source of truth — the companion extends, never replaces.
    expect(contract).toMatch(/COMPOSITION\.md/);
  });

  it('interpolates the brief one-liner into the website contract', () => {
    const ctx = buildContext('example-brand', 'website');
    expect(buildAuthorContract(ctx)).toContain(ctx.brief.oneLiner);
  });

  // Clean-resolution invariants: the contract must DERIVE typeface + colours from the
  // sheet (the single source of truth), never hardcode them — so a re-theme can't desync
  // the contract from the embedded colors_and_type.css again (see the v2 re-theme audit).
  it('derives the display + body typeface from the sheet tokens (not hardcoded)', () => {
    const ctx = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(ctx);
    const primaryFamily = (v: string | undefined): string => {
      const raw = v ?? '';
      return (raw.match(/"([^"]+)"/)?.[1] ?? raw.split(',')[0] ?? '').trim();
    };
    const display = primaryFamily(ctx.tokens.customProps.get('--cr-font-display'));
    const body = primaryFamily(ctx.tokens.customProps.get('--cr-font-body'));
    expect(display).not.toBe('');
    expect(body).not.toBe('');
    // The contract states the real families resolved from the tokens (Urbanist + Inter today).
    expect(contract).toContain(display);
    expect(contract).toContain(body);
  });

  it('references colours via tokens only — NO hardcoded hex in the website contract', () => {
    const ctx = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(ctx);
    // Token names are the stable contract; literal hex desyncs on a re-theme.
    expect(contract).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
    expect(contract).not.toMatch(/#[0-9A-Fa-f]{3}\b/);
  });

  it('does NOT restate literal type-ramp px sizes (defers to the embedded sheet)', () => {
    const ctx = buildContext('example-brand', 'website');
    const contract = buildAuthorContract(ctx);
    // The author applies .cr-h-* classes (sizes baked into the sheet) — the contract
    // must not duplicate the px scale, which is exactly what desynced in the re-theme.
    expect(contract).not.toMatch(/\.cr-h-hero`?\s*\(\d{2,3}\)/);
    expect(contract).not.toMatch(/\.cr-num-display`?\s*\(\d{2,3}\)/);
  });

  it('carries the load-bearing authoring markers for collateral', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const contract = buildAuthorContract(ctx);
    expect(contract.length).toBeGreaterThan(0);
    // Density fix, voice, composition discipline, cheat-sheet, data-viz, fit budget, rails.
    expect(contract).toMatch(/COMPLETE, never sparse/i);
    expect(contract).toMatch(/second-person/i);
    expect(contract).toMatch(/One component per row/i);
    expect(contract).toMatch(/cr-stat-ledger/);
    expect(contract).toMatch(/benchmark bars/i);
    expect(contract).toMatch(/A4 fit/i);
    expect(contract).toMatch(/var\(--token\)/i);
    expect(contract).toMatch(/No em-dash/i);
    // WS5 D2 — the flagship visual page relaxes the inline-diagram cap (bounded, a4-bounds still FAILS).
    expect(contract).toMatch(/Flagship visual page/i);
    expect(contract).toMatch(/~150mm/);
  });

  it('carries the vertical-frame / no-void rules (the spacing fix)', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const contract = buildAuthorContract(ctx);
    expect(contract).toMatch(/no mid-page voids/i);
    expect(contract).toMatch(/margin-top:auto/);
    expect(contract).toMatch(/Assigned composition/i);
  });

  it('interpolates the brief one-liner and tone into the contract', () => {
    const ctx = buildContext('example-brand', 'collateral');
    const contract = buildAuthorContract(ctx);
    expect(contract).toContain(ctx.brief.oneLiner);
  });

  // ── RC-1: the website contract is CLIENT-NEUTRAL ───────────────────────────────
  // The creative voice/examples must derive from the brief, not be hardcoded to
  // Example Brand. The house QUALITY system (hard constraints, type ramp, components,
  // surfaces) stays constant. See OFFSCRIPT-V2-CLIENT-NEUTRAL-CREATIVE-STEERING.md.
  const HELIX_BRIEF = [
    '---',
    'schemaVersion: 1',
    'track: website',
    'brand: Helix',
    'one-liner: "Helix is the brain and memory for AI software teams."',
    'audience: "Engineering leaders running autonomous coding agents"',
    'tone: "Confident, technical, practitioner-to-practitioner — refusal is the feature"',
    'must-include:',
    '  - hero',
    '---',
    'body',
  ].join('\n');

  const ctxFromBrief = (raw: string, client: string): DesignContext => {
    const brief = parseBrief(raw);
    return { client, track: brief.track, brief, parentUrl: brief.parentUrl } as unknown as DesignContext;
  };

  it('RC-1: website contract derives voice from the brief — no hardcoded Example Brand', () => {
    const ctx = ctxFromBrief(HELIX_BRIEF, 'helix');
    const contract = buildAuthorContract(ctx);
    // Client-specific header + the brief's own tone drive the voice.
    expect(contract).toMatch(/Helix website/);
    expect(contract).toContain(ctx.brief.tone);
    // The Example Brand-specific voice/examples are GONE.
    expect(contract).not.toMatch(/Turn Manual Ops/);
    expect(contract).not.toMatch(/cost removal/i);
    expect(contract).not.toMatch(/Book a Demo/);
    expect(contract).not.toMatch(/how Example Brand writes/);
    expect(contract).not.toMatch(/\(Example Brand\)/);
    // Named projects retain generic checks while choosing their own voice and palette.
    expect(contract).toMatch(/responsive layout/);
    expect(contract).toMatch(/readable contrast/i);
    expect(contract).toMatch(/Never fabricate/);
    expect(contract).not.toMatch(/NEVER indigo/i);
  });

  it('RC-1: product name falls back to the titleized client when no brand field', () => {
    const noBrand = HELIX_BRIEF.replace('brand: Helix\n', '');
    const ctx = ctxFromBrief(noBrand, 'acme-corp');
    expect(buildAuthorContract(ctx)).toMatch(/Acme-corp website/);
  });

  // ── P4 / RC-1: the COLLATERAL contract is client-neutral in header + voice ─────
  // Mirror of the website RC-1: the product name + voice derive from the brief, the
  // Example Brand-specific example copy is gone, and the house QUALITY sections (density,
  // fit budget, frame, furniture, cheat-sheet, rails) stay byte-identical regardless
  // of brand. (The engine-embedded Example Brand logo lockup is a separate furniture
  // coupling, out of RC-1 scope — see the spec's residuals.)
  const HELIX_COLLATERAL_BRIEF = [
    '---',
    'schemaVersion: 1',
    'track: collateral',
    'brand: Helix',
    'one-liner: "Helix is the brain and memory for AI software teams."',
    'audience: "Engineering leaders running autonomous coding agents"',
    'tone: "Confident, technical, practitioner-to-practitioner — refusal is the feature"',
    'must-include:',
    '  - overview',
    '---',
    'body',
  ].join('\n');

  it('RC-1: collateral contract derives header + voice from the brief', () => {
    const ctx = ctxFromBrief(HELIX_COLLATERAL_BRIEF, 'helix');
    const contract = buildAuthorContract(ctx);
    // Client-specific header + the brief's own tone drive the voice.
    expect(contract).toMatch(/Helix A4 collateral/);
    expect(contract).toContain(ctx.brief.tone);
    // The Example Brand-specific voice/example copy is GONE.
    expect(contract).not.toMatch(/deliverable for Example Brand/);
    expect(contract).not.toMatch(/changing your software/);
    expect(contract).not.toMatch(/plural\*\*\s*for Example Brand/);
    expect(contract).toMatch(/A4 page/);
    expect(contract).toMatch(/Overflow, overlap/);
    expect(contract).toMatch(/Never fabricate/);
    expect(contract).not.toMatch(/No em-dash/i);
    // Fix C: the engine owns the running footer — the author is told to stop writing it.
    expect(contract).toMatch(/engine injects/i);
    expect(contract).toMatch(/Do NOT author a `?\.cr-page-foot`?/i);
  });

  it('RC-1: collateral product name falls back to the titleized client', () => {
    const noBrand = HELIX_COLLATERAL_BRIEF.replace('brand: Helix\n', '');
    const ctx = ctxFromBrief(noBrand, 'acme-corp');
    expect(buildAuthorContract(ctx)).toMatch(/Acme-corp A4 collateral/);
  });

  it('RC-1: collateral quality sections are brand-independent (byte-identical regression)', () => {
    const helix = buildAuthorContract(ctxFromBrief(HELIX_COLLATERAL_BRIEF, 'helix'));
    const acme = buildAuthorContract(
      ctxFromBrief(HELIX_COLLATERAL_BRIEF.replace('brand: Helix', 'brand: Acme'), 'acme'),
    );
    // Everything from the first house-quality section onward is brand-independent,
    // so it must be byte-identical across two different brands. If any brand value
    // leaked into the quality sections, these slices would differ.
    //
    // P26 — narrowed to start AFTER "## Brand furniture": that section's wordmark line is
    // now CORRECTLY brand-dependent (see the dedicated test below); everything from
    // "## Component cheat-sheet" onward remains genuinely brand-independent shared governance.
    const tail = (c: string) => c.slice(c.indexOf('## Geometry and output'));
    expect(tail(helix).length).toBeGreaterThan(500);
    expect(tail(helix)).toBe(tail(acme));
  });

  // P26 — Brand Neutrality Phase A: the "Brand furniture" wordmark instruction was found
  // hardcoded to the literal string "Example Brand" (the exact residual named, but left unfixed,
  // by RC-1's own commit log — see OFFSCRIPT-V2-CLIENT-NEUTRAL-CREATIVE-STEERING.md residual 3),
  // even though buildCollateralAuthorContract already resolves `productName` and uses it
  // everywhere else in this same function. Since W78 already made the RENDERED logo asset
  // itself Brand-Kit-aware, a hardcoded aria-label="Example Brand" was a genuine, evidenced
  // accessibility defect for any non-Example Brand client: the screen-reader label would name the
  // wrong brand for whatever logo asset actually renders.
  it('named project instructions use the project label when no marks were supplied', () => {
    const helix = buildAuthorContract(ctxFromBrief(HELIX_COLLATERAL_BRIEF, 'helix'));
    const assets = helix.slice(helix.indexOf('## Project assets and iconography'));
    expect(helix).toContain('Helix A4 collateral');
    expect(assets).toContain('project text label');
    expect(assets).toContain('cr-logo-mark--white');
    expect(assets).toContain('cr-logo-mark--color');
    expect(assets).not.toContain('Example Brand');
    expect(assets).toContain('running footer');
  });

  it('an explicitly named Example Brand brief uses project instructions rather than implicit sample marks', () => {
    const ctx = buildContext('example-brand', 'collateral');
    ctx.brief = { ...ctx.brief, brand: 'Example Brand' };
    const contract = buildAuthorContract(ctx);
    expect(contract).toContain('Example Brand A4 collateral');
    expect(contract).toContain('No project kit was supplied');
    expect(contract).toContain('Use the project text label');
  });

});

// ── (b) selectExemplar ─────────────────────────────────────────────────────────

describe('selectExemplar', () => {
  it('returns a non-empty fragment for each collateral archetype', () => {
    for (const arch of ['CoverPage', 'ContentPage', 'StatsPage', 'ClosingPage']) {
      const frag = selectExemplar(arch);
      expect(frag.length, `${arch} fragment`).toBeGreaterThan(0);
      expect(frag, `${arch} is a fragment, not a full doc`).not.toMatch(/<!doctype/i);
    }
  });

  it('maps each archetype to its distinct fragment (root id signature)', () => {
    expect(selectExemplar('CoverPage')).toContain('id="cover"');
    expect(selectExemplar('ContentPage')).toContain('id="content"');
    expect(selectExemplar('StatsPage')).toContain('id="stats"');
    expect(selectExemplar('ClosingPage')).toContain('id="closing"');
  });

  it('falls back to the content fragment for an unknown archetype', () => {
    expect(selectExemplar('SomethingElse')).toContain('id="content"');
  });

  it('the stats exemplar teaches a doc-scoped .viz-* chart idiom', () => {
    expect(selectExemplar('StatsPage')).toMatch(/viz-benchmark/);
  });

  // Track isolation (§0): a website archetype must NEVER resolve a collateral
  // fragment. Whether or not a website fragment is curated yet, the website call
  // must not return collateral content (the collateral 'content.html' default).
  it('website is track-isolated — never returns a collateral fragment', () => {
    for (const arch of ['hero', 'feature-grid', 'metrics', 'cta-banner', 'footer']) {
      const frag = selectExemplar(arch, 'website');
      // Either uncurated ('') or a genuine website fragment — never collateral's.
      expect(frag, `${arch} not collateral content`).not.toContain('id="content"');
      expect(frag, `${arch} not collateral list-row`).not.toMatch(/cr-list-row/);
    }
  });

  it('website returns "" for an unmapped archetype', () => {
    expect(selectExemplar('SomethingElse', 'website')).toBe('');
  });
});

// ── assignComposition (anti-monotony) ──────────────────────────────────────────

describe('assignComposition', () => {
  it('gives Cover and Closing their fixed treatments', () => {
    expect(assignComposition('CoverPage', 0)).toMatch(/COVER/);
    expect(assignComposition('ClosingPage', 0)).toMatch(/CLOSE/);
  });

  it('rotates DISTINCT content compositions by index (no two adjacent the same)', () => {
    const a = assignComposition('ContentPage', 0);
    const b = assignComposition('ContentPage', 1);
    const c = assignComposition('ContentPage', 2);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('content index 0 is NOT the only layout (the monotony fix) — index 1 differs from a list', () => {
    // The previous failure was every page defaulting to a numbered list. Index 1 must be
    // a different idiom (feature grid), not another list.
    expect(assignComposition('ContentPage', 1)).toMatch(/ICON-FEATURE GRID/);
  });

  it('rotation wraps deterministically', () => {
    // 10 content compositions now (WS5 added RELATIONSHIP DIAGRAM + SPATIAL SYSTEM).
    expect(assignComposition('ContentPage', 0)).toBe(assignComposition('ContentPage', 10));
  });

  it('rotates stats compositions too', () => {
    expect(assignComposition('StatsPage', 0)).not.toBe(assignComposition('StatsPage', 1));
  });

  it('assigns NO composition for website (heterogeneous archetypes)', () => {
    expect(assignComposition('hero', 0, 'website')).toBe('');
    expect(assignComposition('feature-grid', 1, 'website')).toBe('');
  });
});

describe('compositionCandidatesFor', () => {
  it('maps comparison signal to the two-column comparison composition (and NARROWS, not fallback)', () => {
    const cands = compositionCandidatesFor('ContentPage', ['comparison']);
    expect(cands.some((c) => /TWO-COLUMN COMPARISON/.test(c))).toBe(true);
    // Proves keying actually narrows — a single-shape match must be smaller than the full set,
    // otherwise the test would also pass under the no-match fallback.
    expect(cands.length).toBeLessThan(
      compositionCandidatesFor('ContentPage', ['generic']).length,
    );
  });
  it('maps quote signal to the pull-quote composition', () => {
    const cands = compositionCandidatesFor('ContentPage', ['quote']);
    expect(cands.some((c) => /PULL-QUOTE/.test(c))).toBe(true);
  });
  it('returns BOTH compositions for a multi-shape signal, in canonical order', () => {
    const cands = compositionCandidatesFor('ContentPage', ['comparison', 'quote']);
    expect(cands.some((c) => /TWO-COLUMN COMPARISON/.test(c))).toBe(true);
    expect(cands.some((c) => /PULL-QUOTE/.test(c))).toBe(true);
    // canonical order: comparison (index 2) precedes pull-quote (index 7)
    const iCmp = cands.findIndex((c) => /TWO-COLUMN COMPARISON/.test(c));
    const iQuote = cands.findIndex((c) => /PULL-QUOTE/.test(c));
    expect(iCmp).toBeLessThan(iQuote);
  });
  it('falls back to the full ContentPage set on a generic signal AND on an empty signal', () => {
    expect(compositionCandidatesFor('ContentPage', ['generic'])).toHaveLength(10);
    expect(compositionCandidatesFor('ContentPage', [])).toHaveLength(10);
  });
  // WS5 B1 — rich relationship/spatial compositions.
  it('routes a diagram signal to the rich RELATIONSHIP DIAGRAM composition (alongside the inline one)', () => {
    const cands = compositionCandidatesFor('ContentPage', ['diagram']);
    expect(cands.some((c) => /RELATIONSHIP DIAGRAM/.test(c))).toBe(true);
    expect(cands.some((c) => /INLINE-SVG DIAGRAM/.test(c))).toBe(true);
  });
  it('routes a spatial signal to the SPATIAL SYSTEM composition', () => {
    const cands = compositionCandidatesFor('ContentPage', ['spatial']);
    expect(cands.some((c) => /SPATIAL SYSTEM/.test(c))).toBe(true);
  });
  it('keeps the composition↔shape arrays length-aligned (guard does not throw on import)', () => {
    expect(() => compositionCandidatesFor('ContentPage', ['generic'])).not.toThrow();
  });
  it('keys StatsPage to the stats compositions', () => {
    const cands = compositionCandidatesFor('StatsPage', ['stats']);
    expect(cands.every((c) => /STAT|METRICS|BENCHMARK/.test(c))).toBe(true);
  });
  it('narrows StatsPage to the benchmark chart on a comparison signal', () => {
    // 'comparison' keys ONLY index 3 (BENCHMARK CHART) among the stats compositions —
    // proves the StatsPage keying genuinely discriminates (not a fallback to all 4).
    const cands = compositionCandidatesFor('StatsPage', ['comparison']);
    expect(cands.some((c) => /BENCHMARK CHART/.test(c))).toBe(true);
    expect(cands.length).toBeLessThan(4);
  });
  it('returns the single fixed treatment for Cover/Closing', () => {
    expect(compositionCandidatesFor('CoverPage', ['generic'])).toHaveLength(1);
    expect(compositionCandidatesFor('ClosingPage', ['generic'])).toHaveLength(1);
  });
});

// WS5 B2 — rich-family exemplar pointer.
describe('richExemplarPointer', () => {
  it('points a relationship diagram at a diagrams/ exemplar path', () => {
    const p = richExemplarPointer('RELATIONSHIP DIAGRAM — …', ['diagram'], 'collateral');
    expect(p).toMatch(/diagrams[\\/]+/);
  });
  it('picks the comparison exemplar when the signal includes comparison', () => {
    expect(richExemplarPointer('RELATIONSHIP DIAGRAM — …', ['diagram', 'comparison'], 'collateral')).toBe('diagrams/comparison.html');
  });
  it('points a spatial system at the spatial/ layer-stack exemplar', () => {
    expect(richExemplarPointer('SPATIAL SYSTEM — …', ['spatial'], 'collateral')).toBe('spatial/layer-stack.html');
  });
  it('returns empty for a non-rich composition', () => {
    expect(richExemplarPointer('NUMBERED EDITORIAL LIST — …', ['list'], 'collateral')).toBe('');
  });
  it('returns empty for the website track (isolation)', () => {
    expect(richExemplarPointer('RELATIONSHIP DIAGRAM — …', ['diagram'], 'website')).toBe('');
  });
});

// ── temp dirs ──────────────────────────────────────────────────────────────────

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-contract-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

// ── (c) authorDocument + createSubagentAuthor wiring ───────────────────────────

describe('collateral wiring — shared contract written once, requests point at it', () => {
  it('writes _AUTHOR_CONTRACT.md exactly once and references it from every request.md', async () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const dispatchDir = freshDir();
    // dispatch returns '' → falls through to assembly; we only care about the files written.
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });

    await authorDocument(p, ctx, author);

    // The shared contract exists exactly once.
    expect(existsSync(join(dispatchDir, '_AUTHOR_CONTRACT.md'))).toBe(true);
    const contractCopies = readdirSync(dispatchDir).filter((f) => f === '_AUTHOR_CONTRACT.md');
    expect(contractCopies).toHaveLength(1);

    // Every per-section request.md points at the shared contract and embeds an exemplar.
    const requests = readdirSync(dispatchDir).filter((f) => f.endsWith('.request.md'));
    expect(requests.length).toBe(p.items.length);
    for (const r of requests) {
      const body = readFileSync(join(dispatchDir, r), 'utf8');
      expect(body, `${r} points at contract`).toContain('_AUTHOR_CONTRACT.md');
      expect(body, `${r} has House contract block`).toMatch(/House contract . READ FIRST/);
      expect(body, `${r} embeds an exemplar`).toMatch(/Reference exemplar/);
      expect(body, `${r} carries an assigned composition`).toMatch(/Assigned composition/);
    }
  });

  it('assigns DISTINCT compositions across same-archetype pages (anti-monotony)', async () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await authorDocument(p, ctx, author);
    const comps = readdirSync(dispatchDir)
      .filter((f) => f.endsWith('.request.md'))
      .map((r) => readFileSync(join(dispatchDir, r), 'utf8'))
      .map((b) => (b.match(/## Assigned composition[^\n]*\n\n([^\n]+)/) || [])[1])
      .filter(Boolean);
    // The default stub plan has >1 ContentPage; their assigned compositions must not all match.
    expect(new Set(comps).size).toBeGreaterThan(1);
  });

  it('the written contract matches buildAuthorContract output', async () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await authorDocument(p, ctx, author);
    const written = readFileSync(join(dispatchDir, '_AUTHOR_CONTRACT.md'), 'utf8');
    expect(written).toBe(buildAuthorContract(ctx));
  });

  it('writes the website _AUTHOR_CONTRACT.md and points every request.md at it', async () => {
    const ctx = buildContext('example-brand', 'website');
    const p = plan(ctx);
    const dispatchDir = freshDir();
    const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '' });
    await authorDocument(p, ctx, author);

    // The website contract is now emitted (the intelligence the /offscript subagent path reads).
    expect(existsSync(join(dispatchDir, '_AUTHOR_CONTRACT.md'))).toBe(true);
    const written = readFileSync(join(dispatchDir, '_AUTHOR_CONTRACT.md'), 'utf8');
    expect(written).toBe(buildAuthorContract(ctx));
    // Client-neutral header: the product name is brief.brand || titleized client.
    expect(written).toMatch(/example-brand website/i);

    // Every request.md points at it; website now carries an A2-routed composition block
    // (P2 A2: the composition router sets item.composition per section, so the seam emits
    // `## Assigned composition` for website — the steering string the subagent authors to).
    const requests = readdirSync(dispatchDir).filter((f) => f.endsWith('.request.md'));
    expect(requests.length).toBe(p.items.length);
    for (const r of requests) {
      const body = readFileSync(join(dispatchDir, r), 'utf8');
      expect(body, `${r} points at contract`).toContain('_AUTHOR_CONTRACT.md');
      expect(body, `${r} has assigned composition`).toMatch(/## Assigned composition/);
    }
  });
});

// ── (d) Regression — scripted determinism preserved ────────────────────────────

describe('scripted collateral path — determinism preserved despite new fields', () => {
  it('two scripted collateral runs produce byte-identical HTML', async () => {
    const ctx = buildContext('example-brand', 'collateral');
    const p = plan(ctx);
    const a = await authorDocument(p, ctx, defaultScriptedAuthor());
    const b = await authorDocument(p, ctx, defaultScriptedAuthor());
    expect(a.html).toBe(b.html);
  });
});
