import { describe, it, expect } from 'vitest';
import { signatureOf, detectFidelityDrift } from '../src/fidelity-comparator.js';
import { parseHtml } from '../src/working-rep.js';
import { loadTokensFromCss } from '../src/tokens.js';
import type { OperatorContext } from '../src/operator.js';

const TOKENS_CSS = `:root { --brand-blue: #2563eb; --fg: #1a1a1a; --bg: #ffffff; }`;
const ctx: OperatorContext = { params: {}, tokens: loadTokensFromCss(TOKENS_CSS) };

const REFERENCE = `<body>
  <header><nav>n</nav></header>
  <main>
    <section data-archetype="hero"><h1>Title</h1><p style="color:var(--brand-blue)">x</p></section>
    <section data-archetype="features"><h2>Feat</h2></section>
  </main>
  <footer>f</footer>
</body>`;

describe('signatureOf', () => {
  it('extracts landmarks, section count, heading outline, archetype tags', () => {
    const sig = signatureOf(parseHtml(REFERENCE), ctx);
    expect(sig.landmarkRoles).toEqual(['footer', 'header', 'main', 'nav']);
    expect(sig.sectionCount).toBe(2);
    expect(sig.headingOutline).toEqual(['h1', 'h2']);
    expect(sig.archetypeTags).toEqual(['features', 'hero']);
    expect(sig.offTokenColors).toEqual([]);
  });
});

describe('detectFidelityDrift', () => {
  it('reports no drift for a byte-different but structurally-identical candidate', () => {
    const candidate = REFERENCE.replace('Title', 'A Much Better Title');
    const findings = detectFidelityDrift(parseHtml(REFERENCE), parseHtml(candidate), ctx);
    expect(findings).toEqual([]);
  });

  it('flags a removed landmark', () => {
    const candidate = REFERENCE.replace('<footer>f</footer>', '');
    const findings = detectFidelityDrift(parseHtml(REFERENCE), parseHtml(candidate), ctx);
    expect(findings.some((f) => f.id.includes('landmark') && f.id.includes('footer'))).toBe(true);
  });

  it('flags a decreased section count', () => {
    const candidate = REFERENCE.replace('<section data-archetype="features"><h2>Feat</h2></section>', '');
    const findings = detectFidelityDrift(parseHtml(REFERENCE), parseHtml(candidate), ctx);
    expect(findings.some((f) => f.id.includes('section-count'))).toBe(true);
  });

  it('flags a removed archetype tag', () => {
    const candidate = REFERENCE.replace('data-archetype="features"', '');
    const findings = detectFidelityDrift(parseHtml(REFERENCE), parseHtml(candidate), ctx);
    expect(findings.some((f) => f.id.includes('archetype') && f.id.includes('features'))).toBe(true);
  });

  it('flags a new off-token colour (traceability regression)', () => {
    const candidate = REFERENCE.replace('color:var(--brand-blue)', 'color:#ff0000');
    const findings = detectFidelityDrift(parseHtml(REFERENCE), parseHtml(candidate), ctx);
    expect(findings.some((f) => f.id.includes('off-token') && f.id.includes('#ff0000'))).toBe(true);
  });

  it('does NOT flag a removed off-token colour (improving traceability is allowed)', () => {
    const dirtyRef = REFERENCE.replace('color:var(--brand-blue)', 'color:#ff0000');
    const cleaned = REFERENCE; // candidate is more traceable than the (dirty) ref
    const findings = detectFidelityDrift(parseHtml(dirtyRef), parseHtml(cleaned), ctx);
    expect(findings.some((f) => f.id.includes('off-token'))).toBe(false);
  });

  it('all drift findings carry the escalated outcome', () => {
    const candidate = REFERENCE.replace('<footer>f</footer>', '');
    const findings = detectFidelityDrift(parseHtml(REFERENCE), parseHtml(candidate), ctx);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.outcome === 'escalated')).toBe(true);
  });
});
