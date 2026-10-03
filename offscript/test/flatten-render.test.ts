import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { detectKitLayout, type WebsiteKit } from '../src/intake.js';
import {
  renderKitToBodyMarkup,
  extractHarnessAppScript,
  stripRenderCall,
  assertNoMountCall,
} from '../src/flatten/render.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'render-kit');

/** Build a minimal in-memory WebsiteKit from inline component + harness sources. */
function makeKit(components: Record<string, string>, harnessInlineApp: string): WebsiteKit {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-flatten-'));
  const kitDir = join(dir, 'ui_kits', 'website');
  mkdirSync(kitDir, { recursive: true });
  const componentFiles: string[] = [];
  for (const [name, src] of Object.entries(components)) {
    const p = join(kitDir, name);
    writeFileSync(p, src, 'utf8');
    componentFiles.push(p);
  }
  const harnessHtml = `<!doctype html><html><body><div id="root"></div>
<script type="text/babel">${harnessInlineApp}</script></body></html>`;
  return { dir, harnessHtml, tokensCss: '', componentFiles, assetsDir: null, fontsDir: null };
}

describe('renderKitToBodyMarkup', () => {
  it('renders a simple component (Hero) with heading + text and inline styles', () => {
    const html = renderKitToBodyMarkup(detectKitLayout(fixture));
    expect(html).toContain('Autonomous Profit Engines');
    expect(html).toContain('We deploy AI agents that handle the operational work.');
    // inline style objects are serialized to a style attribute
    expect(html).toMatch(/<h1[^>]*style="[^"]*font-size:54px/);
    // lucide placeholders are preserved (substitution is a later task)
    expect(html).toContain('data-lucide="arrow-right"');
  });

  it('renders a useState component (FAQ) at its INITIAL state (active = 0)', () => {
    const html = renderKitToBodyMarkup(detectKitLayout(fixture));
    expect(html).toContain('Showing answer for: First question');
    // first item is active at initial state, second is not
    expect(html).toContain('data-active="yes">First question');
    expect(html).toContain('data-active="no">Second question');
  });

  it('renders an open-gated modal to EMPTY at initial state (interactions do not leak)', () => {
    const html = renderKitToBodyMarkup(detectKitLayout(fixture));
    expect(html).not.toContain('modal-back');
    expect(html).not.toContain('Book your audit');
  });

  it('composes App: renders all sibling components in document order', () => {
    const html = renderKitToBodyMarkup(detectKitLayout(fixture));
    const heroIdx = html.indexOf('01 Hero');
    const faqIdx = html.indexOf('06 FAQ');
    const footerIdx = html.indexOf('08 Footer');
    expect(heroIdx).toBeGreaterThanOrEqual(0);
    expect(faqIdx).toBeGreaterThan(heroIdx);
    expect(footerIdx).toBeGreaterThan(faqIdx);
    // the App wrapper is present, the createRoot mount call's effects did not run
    expect(html).toContain('data-app="root"');
  });

  it('renders the real example-brand kit when present (integration smoke)', () => {
    const real = resolveWorkingDir(DEFAULT_CLIENT, 'website');
    let kit;
    try {
      kit = detectKitLayout(real);
    } catch {
      return; // gitignored example absent — skip
    }
    const html = renderKitToBodyMarkup(kit);
    expect(html).toContain('Turn Manual Ops Into Autonomous Profit Engines');
    expect(html).not.toContain('modal-back'); // bookOpen starts false
  });
});

describe('extractHarnessAppScript', () => {
  it('returns the last inline text/babel block, skipping src-only refs', () => {
    const harness = [
      '<script type="text/babel" src="Hero.jsx"></script>',
      '<script type="text/babel">function App(){ return null; }</script>',
    ].join('\n');
    const script = extractHarnessAppScript(harness);
    expect(script).toContain('function App()');
    expect(script).not.toContain('Hero.jsx');
  });

  it('throws when no inline babel App block exists', () => {
    expect(() => extractHarnessAppScript('<script src="a.jsx"></script>')).toThrow(/no inline/);
  });
});

describe('stripRenderCall', () => {
  it('removes a ReactDOM.createRoot(...).render(...) call', () => {
    const out = stripRenderCall(
      'const App = () => null;\nReactDOM.createRoot(document.getElementById("root")).render(<App />);',
    );
    expect(out).toContain('const App = () => null;');
    expect(out).not.toContain('createRoot');
    expect(out).not.toContain('render(');
  });
});

describe('assertNoMountCall', () => {
  it('passes through a fully-stripped script', () => {
    expect(assertNoMountCall('const App = () => null;')).toContain('const App');
  });

  it('throws a targeted error on a leftover mount call', () => {
    expect(() => assertNoMountCall('ReactDOM.render(<App/>, el);')).toThrow(
      /unstripped React mount call/,
    );
  });
});

describe('renderKitToBodyMarkup — failure paths', () => {
  it('(a) names the culprit file on a component JSX syntax error', () => {
    const kit = makeKit(
      { 'Broken.jsx': 'const Broken = () => <div>oops</span>;\nwindow.Broken = Broken;' },
      'function App(){ return <Broken/>; }',
    );
    expect(() => renderKitToBodyMarkup(kit)).toThrow(/Broken\.jsx/);
  });

  it('(b) throws a clear error when App is undefined / non-callable after eval', () => {
    const kit = makeKit({ 'Hero.jsx': 'const Hero = () => null;\nwindow.Hero = Hero;' }, 'const App = 42;');
    expect(() => renderKitToBodyMarkup(kit)).toThrow(/did not define a callable 'App'/);
  });

  it('(c) throws the targeted guard error on an un-strippable mount call', () => {
    // bare ReactDOM.render — not the chained form stripRenderCall handles
    const kit = makeKit(
      { 'Hero.jsx': 'const Hero = () => null;\nwindow.Hero = Hero;' },
      'function App(){ return <Hero/>; }\nReactDOM.render(<App/>, document.body);',
    );
    expect(() => renderKitToBodyMarkup(kit)).toThrow(/unstripped React mount call/);
  });
});
