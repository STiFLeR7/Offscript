import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { layoutAlignment } from '../../src/operators/layout-alignment.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: {} };

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;

const bareCol = (label: string) =>
  `<div><h3>${label}</h3><p>row 1</p><p>row 2</p></div>`;

const cardCol = (label: string) =>
  `<div style="background:#eef;border-radius:12px;padding:16px"><h3>${label}</h3><p>row 1</p><p>row 2</p></div>`;

describe('layout-alignment operator (Tier-2 escalation-only)', () => {
  it('is registered in defaultRegistry()', () => {
    expect(defaultRegistry().get('layout-alignment')).toBe(layoutAlignment);
  });

  it('flags one card-wrapper sibling among bare-content peers in a grid parent', () => {
    const grid = `<section style="display:grid;grid-template-columns:repeat(5,1fr)">${bareCol(
      'Factors',
    )}${bareCol('Platform')}${bareCol('Traditional')}${bareCol('Add Headcount')}${cardCol(
      'APA',
    )}</section>`;
    const findings = layoutAlignment.detect(parseHtml(doc(grid)), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe('escalated');
    expect(findings[0].id).toMatch(/^layout-alignment:misaligned:.*:4$/);
    expect(findings[0].description).toContain('card-wrapper vs bare content peers');
  });

  it('treats background:transparent as bare — CR comparison-table case (APA tinted column is the diverger)', () => {
    // Mirrors the real CR defect: 4 platform columns share
    // `background:transparent;padding:...;border-radius:...` (visually bare,
    // but the regex would mis-read them as card-wrappers without this filter)
    // + 1 APA column with a real tinted background. The diverger MUST be the
    // tinted sibling, not one of the transparent peers.
    const factors = `<div><h3>Factors</h3><p>row 1</p><p>row 2</p></div>`;
    const transparentCol = (label: string) =>
      `<div style="background:transparent;padding:0;border-radius:8px"><h3>${label}</h3><p>row 1</p><p>row 2</p></div>`;
    const tintedCol = (label: string) =>
      `<div style="background:#edfaff;padding:16px;border-radius:8px"><h3>${label}</h3><p>row 1</p><p>row 2</p></div>`;
    const grid =
      `<section style="display:grid;grid-template-columns:1.1fr repeat(4,1fr)">` +
      factors +
      transparentCol('Platform') +
      transparentCol('Traditional') +
      transparentCol('Add Headcount') +
      tintedCol('APA') +
      `</section>`;
    const findings = layoutAlignment.detect(parseHtml(doc(grid)), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/:4$/);
    expect(findings[0].description).toContain('card-wrapper vs bare content peers');
    expect(findings[0].outcome).toBe('escalated');
  });

  it('also treats rgba(...,0) backgrounds as bare', () => {
    const rgbaCol = (label: string) =>
      `<div style="background:rgba(0,0,0,0);padding:8px;border-radius:8px"><h3>${label}</h3></div>`;
    const tintedCol = (label: string) =>
      `<div style="background:#eef;padding:8px;border-radius:8px"><h3>${label}</h3></div>`;
    const grid =
      `<section style="display:grid">` +
      rgbaCol('a') +
      rgbaCol('b') +
      rgbaCol('c') +
      tintedCol('d') +
      `</section>`;
    const findings = layoutAlignment.detect(parseHtml(doc(grid)), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/:3$/);
  });

  it('also fires for inline display:flex parents (not just grid)', () => {
    const flex = `<div style="display:flex;gap:8px">${bareCol('a')}${bareCol('b')}${bareCol(
      'c',
    )}${cardCol('d')}</div>`;
    const findings = layoutAlignment.detect(parseHtml(doc(flex)), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toMatch(/:3$/);
  });

  it('returns no findings when all siblings share the same shape', () => {
    const grid = `<section style="display:grid">${bareCol('a')}${bareCol('b')}${bareCol(
      'c',
    )}${bareCol('d')}</section>`;
    expect(layoutAlignment.detect(parseHtml(doc(grid)), ctx)).toHaveLength(0);
  });

  it('returns no findings when all siblings are card-wrappers (uniform)', () => {
    const grid = `<section style="display:grid">${cardCol('a')}${cardCol('b')}${cardCol(
      'c',
    )}${cardCol('d')}</section>`;
    expect(layoutAlignment.detect(parseHtml(doc(grid)), ctx)).toHaveLength(0);
  });

  it('does not flag a single-child parent (not a misalignment candidate)', () => {
    const grid = `<section style="display:grid">${cardCol('only')}</section>`;
    expect(layoutAlignment.detect(parseHtml(doc(grid)), ctx)).toHaveLength(0);
  });

  it('does not flag a 2-child parent (below the ≥3 threshold)', () => {
    const grid = `<section style="display:grid">${bareCol('a')}${cardCol('b')}</section>`;
    expect(layoutAlignment.detect(parseHtml(doc(grid)), ctx)).toHaveLength(0);
  });

  it('ignores non-grid/flex parents (no display set, or block/inline)', () => {
    const block = `<section style="padding:8px">${bareCol('a')}${bareCol('b')}${bareCol(
      'c',
    )}${cardCol('d')}</section>`;
    expect(layoutAlignment.detect(parseHtml(doc(block)), ctx)).toHaveLength(0);
  });

  it('detect is idempotent — same input twice yields the same findings', () => {
    const grid = `<section style="display:grid">${bareCol('a')}${bareCol('b')}${bareCol(
      'c',
    )}${cardCol('d')}</section>`;
    const tree = parseHtml(doc(grid));
    const a = layoutAlignment.detect(tree, ctx);
    const b = layoutAlignment.detect(tree, ctx);
    expect(b.map((f) => f.id)).toEqual(a.map((f) => f.id));
  });

  it('apply is a no-op (Tier-2 escalation-only) — DOM unchanged, findings re-emitted', () => {
    const grid = `<section style="display:grid">${bareCol('a')}${bareCol('b')}${bareCol(
      'c',
    )}${cardCol('d')}</section>`;
    const tree = parseHtml(doc(grid));
    const before = serializeHtml(tree);
    const f1 = layoutAlignment.apply(tree, ctx);
    const afterOnce = serializeHtml(tree);
    const f2 = layoutAlignment.apply(tree, ctx);
    const afterTwice = serializeHtml(tree);
    expect(afterOnce).toBe(before);
    expect(afterTwice).toBe(before);
    expect(f1.map((f) => f.id)).toEqual(f2.map((f) => f.id));
    expect(f1).toHaveLength(1);
  });

  it('does not flag when there are multiple divergers (no single "odd one out")', () => {
    // 3 cards + 2 bare — majority=3, divergers=2. We REQUIRE exactly one
    // divergent sibling (majority >= siblings.length - 1) so this returns 0.
    // Multiple divergers means the design is genuinely heterogeneous, not a
    // single-misaligned-sibling anomaly.
    const grid = `<section style="display:grid">${cardCol('a')}${cardCol('b')}${cardCol(
      'c',
    )}${bareCol('d')}${bareCol('e')}</section>`;
    expect(layoutAlignment.detect(parseHtml(doc(grid)), ctx)).toHaveLength(0);
  });

  it('findings are emitted in sorted id order across multiple grids', () => {
    // Two separate grids, each with one divergent sibling. Findings should
    // come out sorted by id.
    const grid1 = `<section style="display:grid">${bareCol('a')}${bareCol('b')}${bareCol(
      'c',
    )}${cardCol('d')}</section>`;
    const grid2 = `<section style="display:grid">${cardCol('e')}${cardCol('f')}${cardCol(
      'g',
    )}${bareCol('h')}</section>`;
    const findings = layoutAlignment.detect(parseHtml(doc(grid1 + grid2)), ctx);
    expect(findings).toHaveLength(2);
    const ids = findings.map((f) => f.id);
    expect(ids).toEqual([...ids].sort());
  });
});
