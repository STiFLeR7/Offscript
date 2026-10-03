import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import { loadSections } from '../../src/sections.js';
import { landmarkSemantics } from '../../src/operators/landmark-semantics.js';
import { defaultRegistry } from '../../src/operators/index.js';

const sections = loadSections(`
sections:
  - id: primary-nav
    anchor: site-nav
    landmark: navigation
  - id: hero
    anchor: hero
    landmark: main
`);
const ctx = { params: {}, sections };

// site-nav is a plain <div> (needs a role); hero is a native <main> (already satisfied).
const doc = '<!doctype html><html><body><div id="site-nav">n</div><main id="hero">h</main></body></html>';

const elById = (tree: ReturnType<typeof parseHtml>, id: string) => {
  let hit: import('hast').Element | undefined;
  const walk = (node: import('hast').Element) => {
    if (node.properties?.id === id) hit = node;
    for (const c of node.children) if (c.type === 'element') walk(c);
  };
  for (const c of tree.children) if (c.type === 'element') walk(c);
  return hit;
};

describe('landmark-semantics operator', () => {
  it('detects a declared region missing its landmark role as auto-remediated', () => {
    const findings = landmarkSemantics.detect(parseHtml(doc), ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('landmark-semantics:primary-nav');
    expect(findings[0].outcome).toBe('auto-remediated');
  });

  it('applies the ARIA landmark role to the anchored element on apply', () => {
    const tree = parseHtml(doc);
    landmarkSemantics.apply(tree, ctx);
    expect(elById(tree, 'site-nav')?.properties?.role).toBe('navigation');
  });

  it('does not flag a region already satisfied by its native element (<main>)', () => {
    const findings = landmarkSemantics.detect(parseHtml(doc), ctx);
    expect(findings.map((f) => f.id)).not.toContain('landmark-semantics:hero');
  });

  it('does not flag a region that already carries an explicit role', () => {
    const withRole =
      '<!doctype html><html><body><div id="site-nav" role="navigation">n</div><main id="hero">h</main></body></html>';
    const findings = landmarkSemantics.detect(parseHtml(withRole), ctx);
    expect(findings.map((f) => f.id)).not.toContain('landmark-semantics:primary-nav');
  });

  it('escalates a declared region whose anchor no longer resolves (structural drift)', () => {
    const missing = '<!doctype html><html><body><main id="hero">h</main></body></html>';
    const findings = landmarkSemantics.detect(parseHtml(missing), ctx);
    const nav = findings.find((f) => f.id === 'landmark-semantics:primary-nav');
    expect(nav?.outcome).toBe('escalated');
  });

  it('returns no findings when no sections model is provided', () => {
    expect(landmarkSemantics.detect(parseHtml(doc), { params: {} })).toHaveLength(0);
  });

  it('is idempotent and verifies clean after apply (verify = re-detect)', () => {
    const tree = parseHtml(doc);
    landmarkSemantics.apply(tree, ctx);
    const after = serializeHtml(tree);
    const second = landmarkSemantics.apply(tree, ctx); // second apply must be a no-op
    expect(second).toHaveLength(0);
    expect(serializeHtml(tree)).toBe(after);
    expect(landmarkSemantics.detect(tree, ctx)).toHaveLength(0); // verify = re-detect
  });

  it('registers in the default registry under its name', () => {
    expect(defaultRegistry().get('landmark-semantics')).toBe(landmarkSemantics);
  });
});
