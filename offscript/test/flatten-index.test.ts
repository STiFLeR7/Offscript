import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { flattenKit, gateKit, extractHarnessHead } from '../src/flatten/index.js';
import { defaultRegistry } from '../src/operators/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'render-kit');

/** Write a minimal on-disk website kit (one component + harness + token css) and return its dir. */
function writeKit(componentSrc: string, tokensCss = ':root { --cr-x: 1px; }'): string {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-flatten-idx-'));
  const kitDir = join(dir, 'ui_kits', 'website');
  mkdirSync(kitDir, { recursive: true });
  writeFileSync(join(kitDir, 'Comp.jsx'), componentSrc, 'utf8');
  writeFileSync(
    join(kitDir, 'index.html'),
    `<!doctype html><html><head><title>Kit</title></head><body><div id="root"></div>
<script type="text/babel" src="Comp.jsx"></script>
<script type="text/babel">function App(){ return <Comp/>; } ReactDOM.createRoot(document.getElementById("root")).render(<App/>);</script>
</body></html>`,
    'utf8',
  );
  writeFileSync(join(dir, 'colors_and_type.css'), tokensCss, 'utf8');
  return dir;
}

describe('extractHarnessHead', () => {
  it('returns the <title> text and the inline <style> contents', () => {
    const harness = `<!doctype html>
<html><head>
<title>My Page</title>
<style>:root { --x: 1px; } body { margin: 0; }</style>
<script type="text/babel">const App = () => null;</script>
</head><body></body></html>`;
    const { title, inlineStyle } = extractHarnessHead(harness);
    expect(title).toBe('My Page');
    expect(inlineStyle).toBe(':root { --x: 1px; } body { margin: 0; }');
  });

  it('returns undefined/undefined when there is neither a title nor an inline style', () => {
    const harness = `<!doctype html><html><head>
<link rel="stylesheet" href="x.css">
<script src="react.js"></script>
</head><body></body></html>`;
    const { title, inlineStyle } = extractHarnessHead(harness);
    expect(title).toBeUndefined();
    expect(inlineStyle).toBeUndefined();
  });

  it('does NOT pick up <script type="text/babel"> content as inline style', () => {
    const harness = `<!doctype html><html><head>
<title>T</title>
<script type="text/babel">
const App = () => { const css = "body { color: red }"; return null; };
</script>
</head><body></body></html>`;
    const { title, inlineStyle } = extractHarnessHead(harness);
    expect(title).toBe('T');
    expect(inlineStyle).toBeUndefined();
  });

  it('uses the FIRST of multiple inline <style> blocks and warns', () => {
    const harness = `<!doctype html><html><head>
<title>T</title>
<style>body { margin: 0; }</style>
<style>body { padding: 0; }</style>
</head><body></body></html>`;
    const { inlineStyle, warnings } = extractHarnessHead(harness);
    expect(inlineStyle).toBe('body { margin: 0; }');
    expect(warnings).toContain('multiple inline <style> blocks in harness; using the first');
  });

  it('decodes character entities in the <title> (RCDATA)', () => {
    const { title } = extractHarnessHead('<html><head><title>A &amp; B</title></head></html>');
    expect(title).toBe('A & B');
  });
});

describe('flattenKit', () => {
  it('produces a self-contained static document from the render-kit fixture', () => {
    const { html, warnings } = flattenKit(fixture);

    // self-contained <!doctype html> document
    expect(html.trimStart().toLowerCase().startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');

    // tokens CSS is inlined (a --cr-* token from colors_and_type.css inside a <style>)
    expect(html).toContain('--cr-font-body');

    // rendered body content present
    expect(html).toContain('Autonomous Profit Engines');
    expect(html).toContain('FAQ');
    expect(html).toContain('© 2025 Example, All Rights Reserved');

    // the harness <title> was carried over
    expect(html).toContain('<title>Render Fixture</title>');

    // known lucide icon substituted — no data-lucide placeholder for it, an <svg> instead
    expect(html).not.toContain('data-lucide');
    expect(html).toContain('<svg');

    // static: no runtime <script> tags and no external <link> tags survive
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');

    expect(Array.isArray(warnings)).toBe(true);
  });

  it('propagates an unknown-lucide-icon warning through flattenKit.warnings', () => {
    const dir = writeKit(
      `const Comp = () => <div><i data-lucide="totally-not-an-icon"></i></div>;\nwindow.Comp = Comp;`,
    );
    const { html, warnings } = flattenKit(dir);
    expect(warnings.some((w) => w.includes('totally-not-an-icon'))).toBe(true);
    // the unknown placeholder is left intact (substitution skipped it)
    expect(html).toContain('data-lucide="totally-not-an-icon"');
  });
});

describe('gateKit', () => {
  it('runs every rail over the flattened fixture without throwing and returns the expected shape', () => {
    const result = gateKit(fixture, defaultRegistry());

    expect(typeof result.html).toBe('string');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.findings)).toBe(true);

    // responsive-need fires on the static document: the assembled doc DOES carry a
    // viewport meta (assembleDocument adds one), but the fixture's fixed pixel widths
    // are sub-viewport, so we don't assert a specific finding — only that all rails ran.
    for (const f of result.findings) {
      expect(typeof f.id).toBe('string');
      expect(['auto-remediated', 'escalated', 'warning']).toContain(f.outcome);
    }
  });

  it('fires the Tier-0 token rails: a real TokenModel from colors_and_type.css is threaded into the gate', () => {
    // colors_and_type.css declares a brand colour token (#2563eb). The component's
    // inline styles use that exact hex (case (a) — should normalize to var(--token))
    // and an off-token hex #ff00aa (case (b) — should be flagged by brand-fidelity-scan).
    const dir = writeKit(
      `const Comp = () => <div style={{ color: "#2563eb", borderColor: "#ff00aa" }}>Tokens</div>;\nwindow.Comp = Comp;`,
      ':root { --cr-color-accent: #2563eb; }',
    );

    const { findings } = gateKit(dir, defaultRegistry());

    // (a) the on-token literal #2563eb matches a brand token → the literal-rewrite finding
    // fires specifically (not just the always-present token-normalize:embed finding).
    expect(findings.some((f) => f.id === 'token-normalize:literals')).toBe(true);
    // (b) the off-token #ff00aa is not traceable to a token → brand-fidelity-scan fires
    expect(findings.some((f) => f.id === 'brand-fidelity-scan:#ff00aa')).toBe(true);
  });
});
