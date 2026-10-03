import { describe, it, expect } from 'vitest';
import { accentSaturationBudget } from '../../src/operators/accent-saturation-budget.js';
import { defaultRegistry } from '../../src/operators/index.js';
import { parseHtml } from '../../src/working-rep.js';
import type { BrandContract, OperatorContext } from '../../src/operator.js';
import { loadTokens } from '../../src/tokens.js';
import { deriveBrandPosture } from '../../src/posture.js';

const CONTRACT: BrandContract = {
  schemaVersion: 1,
  subject: 'example-brand',
  generatedAt: '2026-05-28T00:00:00.000Z',
  decidedBy: 'human',
  slots: {
    '--accent': { token: '--cr-brand-blue', confidence: 'human' },
  },
};

const TOKENS = loadTokens('{ "cr": { "brand": { "blue": "#149dff" } } }');

function ctx(overrides: Partial<OperatorContext> = {}): OperatorContext {
  return { params: {}, brandContract: CONTRACT, tokens: TOKENS, ...overrides };
}

describe('accent-saturation-budget — registry + shape', () => {
  it('is registered in defaultRegistry', () => {
    expect(defaultRegistry().get('accent-saturation-budget')).toBeDefined();
  });

  it('is a tier-0 detector', () => {
    expect(accentSaturationBudget.tier).toBe(0);
  });
});

describe('accent-saturation-budget — brand-contract handling', () => {
  it('warns ONCE and returns when no brand contract is supplied', () => {
    const tree = parseHtml('<html><body><a style="color:var(--cr-brand-blue)">x</a></body></html>');
    const findings = accentSaturationBudget.detect(tree, ctx({ brandContract: undefined }));
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('warning');
    expect(findings[0].id).toBe('accent-saturation-budget:no-accent-slot');
  });

  it('warns ONCE and returns when `--accent` slot is unmapped (null)', () => {
    const tree = parseHtml('<html><body><a style="color:var(--cr-brand-blue)">x</a></body></html>');
    const contract: BrandContract = { ...CONTRACT, slots: { '--accent': null } };
    const findings = accentSaturationBudget.detect(tree, ctx({ brandContract: contract }));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('accent-saturation-budget:no-accent-slot');
  });
});

describe('accent-saturation-budget — counting & threshold', () => {
  it('returns no findings when accent saturation is within budget (≤ 10%)', () => {
    // 1 accent inking, 19 plain inkings → 5% — well under budget.
    const inkings = Array.from(
      { length: 19 },
      (_, i) => `<a style="color:#000">${i}</a>`,
    ).join('');
    const html = `<html><body>${inkings}<a style="color:var(--cr-brand-blue)">A</a></body></html>`;
    const findings = accentSaturationBudget.detect(parseHtml(html), ctx());
    expect(findings).toEqual([]);
  });

  it('warns when accent saturation exceeds the 10% default budget', () => {
    // 5 accent inkings, 5 plain → 50% — way over budget.
    const accents = Array.from(
      { length: 5 },
      () => '<a style="color:var(--cr-brand-blue)">x</a>',
    ).join('');
    const plain = Array.from(
      { length: 5 },
      () => '<a style="color:#000">x</a>',
    ).join('');
    const findings = accentSaturationBudget.detect(parseHtml(`<html><body>${accents}${plain}</body></html>`), ctx());
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('escalated');
    expect(findings[0].description).toMatch(/5\/10/);
    expect(findings[0].description).toMatch(/50\.0%/);
  });

  it('also matches the accent by its literal hex value (not only by var(...))', () => {
    // 3 hex-literal accent uses + 7 plain → 30% over budget.
    const html =
      '<html><body>' +
      Array.from({ length: 3 }, () => '<a style="color:#149dff">x</a>').join('') +
      Array.from({ length: 7 }, () => '<a style="color:#000">x</a>').join('') +
      '</body></html>';
    const findings = accentSaturationBudget.detect(parseHtml(html), ctx());
    expect(findings).toHaveLength(1);
    expect(findings[0].description).toMatch(/3\/10/);
  });

  it('counts <style>-block declarations alongside inline styles', () => {
    const html = `<html><head><style>
      .a { color: var(--cr-brand-blue); }
      .b { color: var(--cr-brand-blue); }
      .c { color: #000; }
      .d { background: #fff; }
      .e { color: #333; }
      .f { color: #444; }
      .g { color: #555; }
      .h { color: #666; }
      .i { color: #777; }
      .j { color: #888; }
    </style></head><body></body></html>`;
    const findings = accentSaturationBudget.detect(parseHtml(html), ctx());
    // 2 accent / 10 total = 20% — over budget.
    expect(findings).toHaveLength(1);
    expect(findings[0].description).toMatch(/2\/10/);
  });

  it('ignores documents below the MIN_TOTAL_TO_REPORT floor (tiny fixtures)', () => {
    // 1 accent inking, 0 plain — 100% but only 1 total → below the floor.
    const html = '<html><body><a style="color:var(--cr-brand-blue)">x</a></body></html>';
    const findings = accentSaturationBudget.detect(parseHtml(html), ctx());
    expect(findings).toEqual([]);
  });

  it('ignores custom-property *definitions* (those are not inkings)', () => {
    // The :root --accent definition itself MUST NOT count toward inkings.
    const html =
      '<html><head><style>:root { --accent: var(--cr-brand-blue); }</style></head>' +
      '<body>' +
      Array.from({ length: 12 }, () => '<a style="color:#000">x</a>').join('') +
      '</body></html>';
    const findings = accentSaturationBudget.detect(parseHtml(html), ctx());
    expect(findings).toEqual([]);
  });

  it('apply == detect (idempotent, no mutation)', () => {
    const html =
      '<html><body>' +
      Array.from({ length: 5 }, () => '<a style="color:var(--cr-brand-blue)">x</a>').join('') +
      Array.from({ length: 5 }, () => '<a style="color:#000">x</a>').join('') +
      '</body></html>';
    const tree = parseHtml(html);
    const a = accentSaturationBudget.detect(tree, ctx());
    const b = accentSaturationBudget.apply(tree, ctx());
    expect(a).toEqual(b);
  });
});

describe('accent-saturation-budget — params.budget override', () => {
  it('honours a custom budget supplied via ctx.params.budget', () => {
    // 2 accent / 10 total = 20%. Default 10% → warns. With budget 0.5 → clears.
    const html =
      '<html><body>' +
      Array.from({ length: 2 }, () => '<a style="color:var(--cr-brand-blue)">x</a>').join('') +
      Array.from({ length: 8 }, () => '<a style="color:#000">x</a>').join('') +
      '</body></html>';
    const tree = parseHtml(html);
    expect(accentSaturationBudget.detect(tree, ctx())).toHaveLength(1);
    expect(
      accentSaturationBudget.detect(tree, ctx({ params: { budget: 0.5 } })),
    ).toEqual([]);
  });
});

describe('accent-saturation-budget — posture-aware budget', () => {
  // 3 accent inkings of 20 total = 15%. Accent inkings MUST use the mapped
  // token var(--cr-brand-blue) (CONTRACT maps --accent → --cr-brand-blue).
  function treeWithAccentRatio() {
    const cells: string[] = [];
    for (let i = 0; i < 17; i++) cells.push(`<span style="color:#111111">x</span>`);
    for (let i = 0; i < 3; i++) cells.push(`<span style="color:var(--cr-brand-blue)">x</span>`);
    return parseHtml(`<html><body><main>${cells.join('')}</main></body></html>`);
  }

  it('FLAGS 15% accent usage under a restrained (single-accent) posture (budget 0.10)', () => {
    const tree = treeWithAccentRatio();
    const restrained = deriveBrandPosture({ tokens: TOKENS, brandContract: CONTRACT });
    expect(restrained.accentUsageBudget).toBeCloseTo(0.1, 5); // sanity: single accent
    const findings = accentSaturationBudget.detect(tree, ctx({ posture: restrained }));
    expect(findings.some((f) => f.id.startsWith('accent-saturation-budget:over'))).toBe(true);
  });

  it('does NOT flag the same 15% usage under a loud (multi-accent) posture (budget 0.18)', () => {
    const tree = treeWithAccentRatio();
    const loud = deriveBrandPosture({ tokens: TOKENS, brandContract: CONTRACT });
    loud.accentUsageBudget = 0.18; // simulate a loud multi-accent brand
    const findings = accentSaturationBudget.detect(tree, ctx({ posture: loud }));
    expect(findings.some((f) => f.id.startsWith('accent-saturation-budget:over'))).toBe(false);
  });

  it('still uses DEFAULT_BUDGET (0.10) when no posture and no param present', () => {
    const tree = treeWithAccentRatio();
    const findings = accentSaturationBudget.detect(tree, ctx());
    expect(findings.some((f) => f.id.startsWith('accent-saturation-budget:over'))).toBe(true);
  });
});
