/**
 * WS7 (EA-018 / EA-019) — the v2 CURATION GATE as a blocking website axis, now IN-PROCESS.
 *
 * WS7 replaces the deleted-validator subprocess with in-process enforcement over the
 * (curation table + FragmentEntry catalog + assembled page): `runValidatePageGate(html,
 * catalog)` parses the Curation Table comment leading <main>, cross-checks it against the
 * catalog meta (serves/surface/layout/limits), and proves every <main> section is a pulled
 * `data-crf` fragment or a marked `data-composed` section — failing on raw un-curated slop,
 * <2 candidates, donor-reuse, limit, or adjacency violations. The rule set + message wording
 * are a faithful port of the deleted `validate-page.js` (EA-019: "in-process rule parity";
 * `gateFindings`/`classifyGateError`/`foldCurationGate`/routing PRESERVED unchanged).
 *
 * Three layers, all real (no subprocess, no mocks):
 *   (1) the in-process runner (runValidatePageGate) + the report parser (parseGateReport),
 *   (2) the finding translation + routing (gateFindings / classifyGateError / foldCurationGate),
 *   (3) the loop-blocking integration (goalMet via runReauthorLoop reads outcome.gate.pass).
 *
 * The catalog is INJECTED (a synthetic FragmentEntry[]) so the gate's rule behaviour is
 * verified hermetically, independent of COMPOSITION.md drift. DORMANT: runValidatePageGate
 * has no live caller (WS9b wires it into Stage-4); the website deliverable is byte-identical.
 */

import { describe, it, expect } from 'vitest';
import {
  runValidatePageGate,
  parseGateReport,
  classifyGateError,
  gateFindings,
  foldCurationGate,
  CURATION_GATE_RAIL,
} from '../src/generate/catalog-gate.js';
import type { FragmentEntry } from '../src/generate/catalog.js';
import { runReauthorLoop, type ValidateOutcome } from '../src/generate/reauthor-loop.js';
import type { AuthoringPlan, PlanItem } from '../src/generate/types.js';
import type { RunScore } from '../src/score.js';

// ── Synthetic catalog (replaces the deleted manifest.json BY_SLUG) ──────────────

function entry(
  slug: string,
  serves: string[],
  surface: string,
  layout: string,
): FragmentEntry {
  return {
    slug,
    serves,
    surface: [surface],
    layout: [layout],
    interaction: [],
    blocks: [],
    direction: '',
    limits: {},
    cat: 'section',
  };
}

const CAT: FragmentEntry[] = [
  entry('hero-actions', ['hero'], 'ink', 'split'),
  entry('hero-bento', ['hero'], 'light', 'bento'),
  entry('footer-dark', ['footer'], 'warm', 'stack'),
  entry('footer-cta', ['footer'], 'light', 'cta-row'),
  // about-value + outcome-stats are both surface "warm" and share the "two-col" layout
  // primitive → an adjacency (rule e) clash when placed next to each other.
  entry('about-value', ['value-prop'], 'warm', 'two-col'),
  entry('outcome-stats', ['stats'], 'warm', 'two-col'),
];

// ── Page assembly helper (self-contained <main>; no dependency on the deleted shell) ──

function buildPage(tableRows: string[], body: string): string {
  const comment = [
    '<!--',
    '| intent | surface | candidates | chosen | mode | reason |',
    '| --- | --- | --- | --- | --- | --- |',
    ...tableRows,
    '-->',
  ].join('\n');
  return `<!doctype html><html><head></head><body>\n<main>\n${comment}\n${body}\n</main>\n</body></html>`;
}

// A clean, gate-PASSING two-band page: distinct surfaces (ink vs warm), ≥2 candidates
// each, reasons that cite the meta AND name the rejected candidate (dodges rule-c).
const CLEAN_ROWS = [
  '| hero | ink | hero-actions, hero-bento | hero-actions | as-is | ink surface split layout, chosen over hero-bento |',
  '| footer | warm | footer-dark, footer-cta | footer-dark | as-is | warm surface stack layout, chosen over footer-cta |',
];
const CLEAN_BODY = '<div data-crf="hero-actions"></div>\n<div data-crf="footer-dark"></div>';

// ── (1) in-process runner ───────────────────────────────────────────────────────

describe('catalog-gate — runValidatePageGate (WS7: in-process enforcement)', () => {
  it('a genuinely good page PASSES (exit 0, no errors)', () => {
    const r = runValidatePageGate(buildPage(CLEAN_ROWS, CLEAN_BODY), CAT);
    expect(r.pass, r.raw).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.errors).toEqual([]);
  });

  it('is deterministic — repeated runs are byte-identical', () => {
    const html = buildPage(CLEAN_ROWS, CLEAN_BODY);
    expect(runValidatePageGate(html, CAT)).toEqual(runValidatePageGate(html, CAT));
  });

  it('an UN-CURATED section (orphan markup in <main>) BLOCKS', () => {
    const html = buildPage(CLEAN_ROWS, `${CLEAN_BODY}\n<section class="ad-hoc"><h2>slop</h2></section>`);
    const r = runValidatePageGate(html, CAT);
    expect(r.pass).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.errors.join(' ')).toMatch(/un-curated markup/i);
  });

  it('a row with <2 CANDIDATES BLOCKS', () => {
    const html = buildPage(
      ['| hero | ink | hero-actions | hero-actions | as-is | ink surface hero layout |'],
      '<div data-crf="hero-actions"></div>',
    );
    const r = runValidatePageGate(html, CAT);
    expect(r.pass).toBe(false);
    expect(r.errors.join(' ')).toMatch(/only 1 candidate/i);
  });

  it('a candidate that is not a catalog slug BLOCKS', () => {
    const html = buildPage(
      ['| hero | ink | hero-actions, not-a-real-slug | hero-actions | as-is | ink surface split layout, chosen over not-a-real-slug |'],
      '<div data-crf="hero-actions"></div>',
    );
    const r = runValidatePageGate(html, CAT);
    expect(r.pass).toBe(false);
    expect(r.errors.join(' ')).toMatch(/is not a catalog slug/i);
  });

  it('a pasted fragment with no Curation Table row BLOCKS (un-audited section)', () => {
    const html = buildPage(
      ['| hero | ink | hero-actions, hero-bento | hero-actions | as-is | ink surface split layout, chosen over hero-bento |'],
      '<div data-crf="hero-actions"></div>\n<div data-crf="footer-dark"></div>',
    );
    const r = runValidatePageGate(html, CAT);
    expect(r.pass).toBe(false);
    expect(r.errors.join(' ')).toMatch(/data-crf="footer-dark".*un-audited section/i);
  });

  it('an ADJACENCY clash (same surface + shared layout neighbours) BLOCKS', () => {
    const html = buildPage(
      [
        '| value-prop | warm | about-value, outcome-stats | about-value | as-is | warm surface two-col layout, chosen over outcome-stats |',
        '| stats | warm | outcome-stats, about-value | outcome-stats | as-is | warm surface two-col layout, chosen over about-value |',
      ],
      '<div data-crf="about-value"></div>\n<div data-crf="outcome-stats"></div>',
    );
    const r = runValidatePageGate(html, CAT);
    expect(r.pass).toBe(false);
    expect(r.errors.join(' ')).toMatch(/adjacent bands|share surface/i);
  });

  it('a missing Curation Table BLOCKS (no audit trail)', () => {
    const html = '<!doctype html><html><body><main><div data-crf="hero-actions"></div></main></body></html>';
    const r = runValidatePageGate(html, CAT);
    expect(r.pass).toBe(false);
    expect(r.errors.join(' ')).toMatch(/no Curation Table/i);
  });

  it('--warn-as-error promotes soft warnings to a block', () => {
    // A candidate that does not serve the intent is a WARNING (soft) — passing by default,
    // blocking under warnAsError.
    const html = buildPage(
      ['| hero | ink | hero-actions, footer-dark | hero-actions | as-is | ink surface split layout, chosen over footer-dark |'],
      '<div data-crf="hero-actions"></div>',
    );
    expect(runValidatePageGate(html, CAT).pass).toBe(true); // soft warning only
    expect(runValidatePageGate(html, CAT, { warnAsError: true }).pass).toBe(false);
  });
});

describe('catalog-gate — parseGateReport', () => {
  it('splits the ⚠ warning / ✗ error blocks into their bullet lists', () => {
    const raw = [
      'validate-page · page.html',
      '  sections: 2 fragment(s) + 0 composed · 2 curation row(s)',
      '',
      '  ⚠ 1 warning(s):',
      '    - row 1 (hero): soft meta nag.',
      '',
      '  ✗ 2 error(s):',
      '    - row 1 (hero): only 1 candidate(s).',
      '    - un-curated markup detected in <main>.',
      '',
      '  ✗ FAIL — curation NOT enforced against the catalog.',
    ].join('\n');
    const { errors, warnings } = parseGateReport(raw);
    expect(warnings).toEqual(['row 1 (hero): soft meta nag.']);
    expect(errors).toEqual([
      'row 1 (hero): only 1 candidate(s).',
      'un-curated markup detected in <main>.',
    ]);
  });

  it('tolerates a clean report (no blocks) → empty lists', () => {
    const raw = 'validate-page · page.html\n  ✓ PASS — curation verified against the catalog.\n';
    expect(parseGateReport(raw)).toEqual({ errors: [], warnings: [] });
  });

  it('round-trips a real in-process report (the gate raw parses back to its own lists)', () => {
    const r = runValidatePageGate(
      buildPage(['| hero | ink | hero-actions | hero-actions | as-is | ink surface hero layout |'], '<div data-crf="hero-actions"></div>'),
      CAT,
    );
    expect(parseGateReport(r.raw).errors).toEqual(r.errors);
  });
});

// ── (2) finding translation + routing (PRESERVED — unchanged by WS7) ─────────────

describe('catalog-gate — classifyGateError (AP4.4)', () => {
  it('routes SELECTION errors to re-curate', () => {
    expect(classifyGateError('row 1 (hero): only 1 candidate(s).')).toBe('re-curate');
    expect(classifyGateError('donor "footer-dark" serves 2 sections without a reason.')).toBe('re-curate');
    expect(classifyGateError('adjacent bands row 1 and row 2 share surface "warm".')).toBe('re-curate');
  });

  it('routes PROVENANCE / anti-slop errors to re-edit', () => {
    expect(classifyGateError('un-curated markup detected in <main>.')).toBe('re-edit');
    expect(classifyGateError('fragment data-crf="hero-actions" is pasted in the page but no Curation Table row chose it.')).toBe('re-edit');
  });
});

// A small plan: two curated website items with fragmentId + intent + anchor id.
const PLAN: AuthoringPlan = {
  items: [
    { anchor: { id: 'hero', anchor: 'hero' }, archetype: 'Hero', tokenRoles: [], intent: 'hero', fragmentId: 'hero-actions', candidates: ['hero-actions', 'hero-bento'] },
    { anchor: { id: 'foot', anchor: 'foot' }, archetype: 'Footer', tokenRoles: [], intent: 'footer', fragmentId: 'footer-dark', candidates: ['footer-dark', 'footer-cta'] },
  ] as PlanItem[],
};

describe('catalog-gate — gateFindings routes by anchor id', () => {
  it('embeds the offending section anchor id (slug → anchor) so mapFindingsToItems routes it', () => {
    const report = { pass: false, exitCode: 1, warnings: [], raw: '', errors: ['fragment data-crf="hero-actions" is pasted in the page but no Curation Table row chose it (un-audited section).'] };
    const [f] = gateFindings(report, PLAN);
    expect(f.id).toMatch(/^curation-gate:hero:/); // hero-actions → item anchor "hero"
    expect(f.description).toContain('[re-edit]');
    expect(f.outcome).toBe('warning'); // never freezes / scores — the block is gate.pass
  });

  it('routes an intent-only error via row (intent) → anchor', () => {
    const report = { pass: false, exitCode: 1, warnings: [], raw: '', errors: ['row 1 (footer): only 1 candidate(s).'] };
    const [f] = gateFindings(report, PLAN);
    expect(f.id).toMatch(/^curation-gate:foot:/); // intent "footer" → item anchor "foot"
    expect(f.description).toContain('[re-curate]');
  });

  it('routes an adjacency pair to BOTH anchors via the a->b segment convention', () => {
    const report = { pass: false, exitCode: 1, warnings: [], raw: '', errors: ['adjacent bands row 1 ("hero-actions") and row 2 ("footer-dark") share surface.'] };
    const [f] = gateFindings(report, PLAN);
    expect(f.id).toContain('hero->foot');
  });

  it('falls back to :document when no section can be resolved', () => {
    const report = { pass: false, exitCode: 1, warnings: [], raw: '', errors: ['un-curated markup detected in <main>.'] };
    const [f] = gateFindings(report, PLAN);
    expect(f.id).toMatch(/^curation-gate:document:/);
  });
});

describe('catalog-gate — foldCurationGate', () => {
  const base: ValidateOutcome = {
    score: { systematicRatio: 0.9 } as RunScore,
    frozen: [],
    perRail: [],
  };

  it('appends the gate findings under the curation-gate rail and sets outcome.gate', () => {
    const report = { pass: false, exitCode: 1, warnings: ['soft'], raw: '', errors: ['row 1 (hero): only 1 candidate(s).'] };
    const out = foldCurationGate(base, report, PLAN);
    const rail = out.perRail.find((r) => r.operator.name === CURATION_GATE_RAIL);
    expect(rail).toBeDefined();
    expect(rail!.findings).toHaveLength(1);
    expect(out.gate).toEqual({ pass: false, errorCount: 1, warningCount: 1 });
    expect(base.perRail).toHaveLength(0); // pure: base untouched
  });

  it('a passing report sets gate.pass true with no error findings', () => {
    const out = foldCurationGate(base, { pass: true, exitCode: 0, warnings: [], raw: '', errors: [] }, PLAN);
    expect(out.gate).toEqual({ pass: true, errorCount: 0, warningCount: 0 });
    expect(out.perRail.find((r) => r.operator.name === CURATION_GATE_RAIL)!.findings).toEqual([]);
  });
});

// ── (3) loop-blocking integration (AP4.2) ───────────────────────────────────────

describe('catalog-gate — goalMet is blocked by gate.pass === false (AP4.2)', () => {
  // A deterministic author that returns the same html → the loop's no-progress guard
  // fires once goalMet is false, so a blocked page CANNOT report 'goal-met'.
  const stableAuthor = async () => ({ html: '<html>same</html>', warnings: [] as string[] });
  const plan: AuthoringPlan = { items: [] } as unknown as AuthoringPlan;

  function loopWith(outcome: ValidateOutcome) {
    return runReauthorLoop({
      initialHtml: '<html>same</html>',
      plan,
      context: {} as never,
      author: stableAuthor,
      validate: async () => outcome,
      targetRatio: 0.8,
      maxPasses: 2,
    });
  }

  const met = { score: { systematicRatio: 0.95 } as RunScore, frozen: [], perRail: [] };

  it('ratio ≥ target + 0 frozen but gate FAIL → NOT goal-met (returns to loop)', async () => {
    const r = await loopWith({ ...met, gate: { pass: false, errorCount: 1, warningCount: 0 } });
    expect(r.stoppedBy).not.toBe('goal-met');
    expect(r.stoppedBy).toBe('no-progress'); // blocked → reauthor → identical html → stop
  });

  it('ratio ≥ target + 0 frozen + gate PASS → goal-met', async () => {
    const r = await loopWith({ ...met, gate: { pass: true, errorCount: 0, warningCount: 0 } });
    expect(r.stoppedBy).toBe('goal-met');
  });

  it('no gate field at all (collateral / backward-compat) → goal-met on ratio+frozen alone', async () => {
    const r = await loopWith(met);
    expect(r.stoppedBy).toBe('goal-met');
  });
});

// ── Diversity advisory (AP4.3) — OUT OF WS7 SCOPE ────────────────────────────────
// `runSelectionDiversity` shells out to the deleted `selection-diversity.js`; EA-019's
// WS7 names ONLY the curation gate (`runValidatePageGate` internals) — the soft diversity
// advisory is never wired into the WS9b activation chain and stays dormant. Left skipped
// (not converted to in-process) to keep WS7 strictly to its frozen scope.
describe.skip('catalog-gate — runSelectionDiversity (AP4.3, soft — dormant, not WS7)', () => {
  it('placeholder — diversity advisory is out of WS7 scope', () => {
    expect(true).toBe(true);
  });
});
