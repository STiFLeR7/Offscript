import { describe, it, expect } from 'vitest';
import { parseHtml } from '../../src/working-rep.js';
import type { OperatorContext } from '../../src/operator.js';
import { noElevation } from '../../src/operators/no-elevation.js';

const doc = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const ctx: OperatorContext = { params: {} };

describe('no-elevation operator (Tier-0 website charter rail)', () => {
  it('is Tier 0', () => expect(noElevation.tier).toBe(0));

  it('flags box-shadow in a <style> block (warn-only)', () => {
    const tree = parseHtml(doc(`<style>.card{box-shadow:0 4px 12px rgba(0,0,0,.1);}</style>`));
    const f = noElevation.detect(tree, ctx);
    expect(f).toHaveLength(1);
    expect(f[0].outcome).toBe('warning');
  });

  it('flags box-shadow in an inline style', () => {
    const tree = parseHtml(doc(`<div style="box-shadow: 0 1px 2px #000">x</div>`));
    expect(noElevation.detect(tree, ctx)).toHaveLength(1);
  });

  it('flags backdrop-filter (frosted glass) and filter: blur()/drop-shadow()', () => {
    expect(noElevation.detect(parseHtml(doc(`<style>.p{backdrop-filter:blur(8px);}</style>`)), ctx)).toHaveLength(1);
    expect(noElevation.detect(parseHtml(doc(`<style>.p{filter:blur(4px);}</style>`)), ctx)).toHaveLength(1);
    expect(noElevation.detect(parseHtml(doc(`<style>.p{filter:drop-shadow(0 2px 4px #000);}</style>`)), ctx)).toHaveLength(1);
  });

  it('does NOT flag filter: grayscale() / brightness() (not elevation)', () => {
    expect(noElevation.detect(parseHtml(doc(`<style>.logo{filter:grayscale(1) brightness(.8);}</style>`)), ctx)).toHaveLength(0);
  });

  it('passes a flat document (hairline + surface, no shadow)', () => {
    const tree = parseHtml(doc(`<style>.card{border:1px solid var(--cr-line);background:var(--cr-bg-warm);}</style>`));
    expect(noElevation.detect(tree, ctx)).toHaveLength(0);
  });

  it('passes box-shadow:none', () => {
    expect(noElevation.detect(parseHtml(doc(`<style>.x{box-shadow:none;}</style>`)), ctx)).toHaveLength(0);
  });

  // ── Restrained-depth charter (v2 re-theme): sanctioned shadow/glass tokens allowed ──
  it('does NOT flag box-shadow that resolves to a sanctioned --cr-shadow-* token', () => {
    expect(noElevation.detect(parseHtml(doc(`<style>.card{box-shadow:var(--cr-shadow-lg);}</style>`)), ctx)).toHaveLength(0);
    expect(noElevation.detect(parseHtml(doc(`<style>.chip{box-shadow:var(--cr-shadow-sm);}</style>`)), ctx)).toHaveLength(0);
  });

  it('does NOT flag glass: backdrop-filter blur(var(--cr-glass-blur))', () => {
    expect(noElevation.detect(parseHtml(doc(`<style>.panel{backdrop-filter:blur(var(--cr-glass-blur));background:var(--cr-glass-bg);}</style>`)), ctx)).toHaveLength(0);
  });

  it('does NOT flag a sanctioned shadow token in an inline style', () => {
    expect(noElevation.detect(parseHtml(doc(`<div style="box-shadow:var(--cr-shadow-lg)">x</div>`)), ctx)).toHaveLength(0);
  });

  it('STILL flags ad-hoc raw shadow/glass (no sanctioned token)', () => {
    // raw box-shadow with literal values — off-system depth
    expect(noElevation.detect(parseHtml(doc(`<style>.card{box-shadow:0 4px 12px rgba(0,0,0,.1);}</style>`)), ctx)).toHaveLength(1);
    // backdrop-filter with a literal blur, not the glass token
    expect(noElevation.detect(parseHtml(doc(`<style>.p{backdrop-filter:blur(8px);}</style>`)), ctx)).toHaveLength(1);
    // filter:blur / drop-shadow remain glow/elevation regardless (not the sanctioned channels)
    expect(noElevation.detect(parseHtml(doc(`<style>.p{filter:drop-shadow(0 2px 4px #000);}</style>`)), ctx)).toHaveLength(1);
  });
});
