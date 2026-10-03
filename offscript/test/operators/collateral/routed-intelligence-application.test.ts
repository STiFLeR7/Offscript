import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../../src/working-rep.js';
import { routedIntelligenceApplication } from '../../../src/operators/collateral/routed-intelligence-application.js';

const EMPTY_CTX = { params: {} } as const;

function findings(html: string) {
  const tree = parseHtml(html);
  return routedIntelligenceApplication.detect(tree, EMPTY_CTX as never);
}

const page = (routed: string, inner: string, id = 'sec-1') =>
  `<main class="cr-doc"><section class="cr-page" data-cr-routed="${routed}"><div id="${id}">${inner}</div></section></main>`;

describe('routed-intelligence-application rail (Option 2 — class application, not component)', () => {
  it('diagram routed + inline SVG with ≥2 primitives → applied → no finding', () => {
    const svg = '<svg><path d="M0 0"/><line x1="0"/></svg>';
    expect(findings(page('diagram', `<h2>x</h2>${svg}`))).toHaveLength(0);
  });

  it('diagram routed + .cr-graphic wrapper (different realization) → applied → no finding', () => {
    expect(findings(page('diagram', '<div class="cr-graphic"><svg></svg></div>'))).toHaveLength(0);
  });

  it('diagram routed + text-only page → not applied → one warning', () => {
    const f = findings(page('diagram', '<h2>title</h2><p>just prose, no visual</p>'));
    expect(f).toHaveLength(1);
    expect(f[0].outcome).toBe('warning');
    expect(f[0].id).toBe('routed-intelligence-application:diagram:sec-1');
  });

  it('spatial routed needs a richer SVG: 2 primitives is NOT enough → warning', () => {
    const svg = '<svg><path d="M0"/><rect/></svg>';
    expect(findings(page('spatial', svg))).toHaveLength(1);
  });

  it('spatial routed + SVG with ≥3 primitives → applied → no finding', () => {
    const svg = '<svg><path d="M0"/><rect/><circle/></svg>';
    expect(findings(page('spatial', svg))).toHaveLength(0);
  });

  it('spatial routed + .cr-graphic → applied → no finding', () => {
    expect(findings(page('spatial', '<div class="cr-graphic"></div>'))).toHaveLength(0);
  });

  it('no data-cr-routed stamp → rail makes no demand → no finding', () => {
    expect(
      findings('<main class="cr-doc"><section class="cr-page"><div id="x"><p>text</p></div></section></main>'),
    ).toHaveLength(0);
  });

  it('a lone icon (1 primitive) does NOT count as a diagram realization → warning', () => {
    expect(findings(page('diagram', '<svg><path d="M0 0 L1 1"/></svg>'))).toHaveLength(1);
  });

  it('attributes the finding to the inner page id', () => {
    const f = findings(page('diagram', '<p>none</p>', 'implementation-pipeline'));
    expect(f[0].id).toContain('implementation-pipeline');
  });

  // ── W54 — Data Visualization parity: 'chart' is now a routable class, verified
  // the same way diagram/spatial already are.
  it('chart routed + a doc-scoped .viz-* class (the house data-viz convention) → applied → no finding', () => {
    expect(
      findings(page('chart', '<div class="viz-bars"><div class="viz-bar" style="--h:40%"></div></div>')),
    ).toHaveLength(0);
  });

  it('chart routed + .cr-graphic wrapper (alternate realization) → applied → no finding', () => {
    expect(findings(page('chart', '<div class="cr-graphic"><svg></svg></div>'))).toHaveLength(0);
  });

  it('chart routed + an SVG-based chart (e.g. a donut ring) with ≥1 primitive → applied → no finding', () => {
    expect(findings(page('chart', '<svg><circle r="10"/></svg>'))).toHaveLength(0);
  });

  it('chart routed + text-only page → not applied → one warning', () => {
    const f = findings(page('chart', '<h2>title</h2><p>just prose, no visual</p>'));
    expect(f).toHaveLength(1);
    expect(f[0].outcome).toBe('warning');
    expect(f[0].id).toBe('routed-intelligence-application:chart:sec-1');
  });
});
