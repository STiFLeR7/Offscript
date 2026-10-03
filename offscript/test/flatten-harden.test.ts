import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { hardenKitMechanical, MECHANICAL_OPERATORS } from '../src/flatten/harden.js';
import { defaultRegistry } from '../src/operators/index.js';
import { detectKitLayout } from '../src/intake.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { parseHtml, serializeHtml } from '../src/working-rep.js';
import type { OperatorContext } from '../src/operator.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'harden-kit');
const realCr = resolveWorkingDir(DEFAULT_CLIENT, 'website');

describe('hardenKitMechanical', () => {
  it('returns an unmutated reference and a hardened html that differs', () => {
    const { reference, html, applied } = hardenKitMechanical(fixture, defaultRegistry());

    // reference is the flattened design ground truth (a full document, body present)
    expect(reference).toMatch(/<!doctype html>/i);
    expect(reference).toContain('Example Brand audit');

    // hardening actually changed the document
    expect(html).not.toEqual(reference);

    // at least one mechanical operator produced findings
    const totalFindings = applied.reduce((n, r) => n + r.findings.length, 0);
    expect(totalFindings).toBeGreaterThan(0);

    // the hardened doc shows the rewrites; the reference does NOT
    expect(html).toContain('var(--cr-radius-'); // off-vocab radius snapped
    expect(html).toContain('var(--cr-accent)'); // color literal -> token
    expect(html).toContain('var(--cr-font-'); // brand-face literal -> token
    expect(reference).not.toContain('var(--cr-radius-');
    expect(reference).not.toContain('var(--cr-accent)');
    // reference still carries the raw literals
    expect(reference).toMatch(/#3366ff/i);
    expect(reference).toMatch(/7px/);
  });

  it('records one verified OperatorRun per mechanical operator present', () => {
    const { applied } = hardenKitMechanical(fixture, defaultRegistry());

    // every operator in the run is one of the five mechanical ops, in order
    expect(applied.map((r) => r.operator)).toEqual([...MECHANICAL_OPERATORS]);

    for (const run of applied) {
      expect(run.verified).toBe(true);
    }
  });

  it('is idempotent: re-applying the mechanical ops over the hardened html is a no-op', () => {
    const registry = defaultRegistry();
    const { html } = hardenKitMechanical(fixture, registry);

    // Re-run the mechanical operators' apply over the ALREADY-hardened html.
    const tokens = loadTokensFromCss(detectKitLayout(fixture).tokensCss);
    const ctx: OperatorContext = { params: {}, tokens };
    const tree = parseHtml(html);
    const secondPassFindings = MECHANICAL_OPERATORS.flatMap((name) => {
      const op = registry.get(name);
      return op ? op.apply(tree, ctx) : [];
    });
    const reHardened = serializeHtml(tree);

    // (a) the doc is byte-identical to the first hardened output (apply∘apply = apply)
    expect(reHardened).toEqual(html);
    // (b) the second pass produced zero auto-remediated findings (nothing left to fix)
    const autoRemediated = secondPassFindings.filter((f) => f.outcome === 'auto-remediated');
    expect(autoRemediated).toEqual([]);
  });

  // Guarded real-CR smoke test — only runs if the gitignored kit is present.
  // Old-layout kit only: post-pivot self-contained deliverable dirs carry no
  // standalone colors_and_type.css and are not flattenable kits, so skip them
  // instead of throwing "Invalid kit" (website pivot reconciliation).
  const maybe = existsSync(join(realCr, 'colors_and_type.css')) ? it : it.skip;
  maybe('hardens the real Example Brand kit', () => {
    const { reference, html } = hardenKitMechanical(realCr, defaultRegistry());
    expect(html.trimStart()).toMatch(/^<!doctype html>/i);
    expect(html).not.toEqual(reference);
  });
});
