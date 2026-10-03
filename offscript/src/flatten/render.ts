import { transform } from '@babel/core';
import presetReact from '@babel/preset-react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { WebsiteKit } from '../intake.js';

/**
 * Build-time flatten: server-render a Claude Design website kit's React
 * harness to the static body markup it produces at INITIAL state, with no
 * browser. The kit's components are plain global `const Name = ...` JSX files
 * sharing one scope; the harness's inline `text/babel` script defines `App`
 * composing them and ends with a `ReactDOM.createRoot(...).render(<App/>)`
 * call that we strip (it touches `document`).
 *
 * Mechanism: transpile every component source + the harness App script with
 * Babel's classic-runtime react preset (emits `React.createElement`), then
 * evaluate them all in ONE function body with `React` and a minimal `window`
 * shim injected — so each `const Name` is visible to `App`, and the trailing
 * `window.Name = Name;` lines the real components carry don't throw. The body
 * returns `App`, which we render with `renderToStaticMarkup`.
 *
 * Effects (`useEffect`) do not fire under `renderToStaticMarkup`, so the
 * harness's `window.lucide.createIcons()` effect is a non-issue. Interaction
 * state (e.g. a `BookingModal` gated by `open` defaulting to false) renders at
 * its initial value, so interactions never leak into the static output. The
 * returned markup may still contain `<i data-lucide="...">` placeholders —
 * lucide substitution is a separate later task.
 *
 * Caveat: the injected `window` is a minimal `{}` shim, not a DOM. Effects are
 * not the only browser-touch risk — a component that reads `window.matchMedia`,
 * `document`, or `localStorage` at module-evaluation or render time (i.e. NOT
 * inside a `useEffect`) would throw here. Canonical Claude Design kits confine
 * such access to effects, so this is moot today.
 */
export function renderKitToBodyMarkup(kit: WebsiteKit): string {
  // Each segment is transpiled independently — naming its real source so a JSX
  // syntax error points at the actual culprit file — then concatenated into one
  // shared scope. Component `const`s become visible to the App script.
  const transpiledComponents = kit.componentFiles.map((path) =>
    transpileJsx(readFileSync(path, 'utf8'), path),
  );

  const appScript = extractHarnessAppScript(kit.harnessHtml);
  const strippedApp = assertNoMountCall(stripRenderCall(appScript));
  const transpiledApp = transpileJsx(strippedApp, '<harness inline App script>');

  const body = [
    ...transpiledComponents,
    transpiledApp,
    'return App;',
  ].join('\n;\n');

  let App: unknown;
  try {
    // `window` shim absorbs the components' `window.Name = Name;` lines (and
    // any benign module-level `window.x` writes) without a real DOM.
    const factory = new Function('React', 'window', body) as (
      react: typeof React,
      window: Record<string, unknown>,
    ) => unknown;
    App = factory(React, {});
  } catch (err) {
    throw new Error(
      `flatten: failed to evaluate the shared kit scope (a component in ` +
        `[${kit.componentFiles.join(', ')}] or the harness App script): ` +
        `${(err as Error).message}`,
    );
  }

  if (typeof App !== 'function') {
    throw new Error(
      "flatten: the harness inline script did not define a callable 'App' " +
        `component (got ${App === undefined ? 'undefined' : typeof App})`,
    );
  }

  return renderToStaticMarkup(React.createElement(App as React.ComponentType));
}

/**
 * Transpile a JSX source to JS using the classic runtime (emits
 * React.createElement). `filename` names the real source so a Babel syntax
 * error identifies the culprit file/component.
 */
function transpileJsx(source: string, filename: string): string {
  let result;
  try {
    result = transform(source, {
      presets: [[presetReact as object, { runtime: 'classic' }]],
      babelrc: false,
      configFile: false,
      sourceType: 'script',
      filename,
    });
  } catch (err) {
    throw new Error(`flatten: failed to transpile ${filename}: ${(err as Error).message}`);
  }
  if (!result || result.code == null) {
    throw new Error(`flatten: Babel produced no output for ${filename}`);
  }
  return result.code;
}

/**
 * Pull the harness's last inline `<script type="text/babel">…</script>` block —
 * the one that defines `App` (the earlier `src="…"` script tags are external
 * component refs with no body). Throws if none is found.
 */
export function extractHarnessAppScript(harnessHtml: string): string {
  const re = /<script\b[^>]*type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = re.exec(harnessHtml)) !== null) {
    const inner = match[1];
    // Skip self-closing external refs (`src=…` script tags have empty bodies).
    if (inner.trim().length > 0) {
      last = inner;
    }
  }
  if (last == null) {
    throw new Error('flatten: no inline <script type="text/babel"> App block found in harness');
  }
  return last;
}

/**
 * Remove the `ReactDOM.createRoot(...).render(<App/>)` mounting call (it touches
 * `document`). We only need `App` defined; mounting is the browser's job.
 */
export function stripRenderCall(script: string): string {
  // Match `ReactDOM.createRoot(...).render(...);` possibly spanning lines.
  return script.replace(
    /ReactDOM\s*\.\s*createRoot\s*\([\s\S]*?\)\s*\.\s*render\s*\([\s\S]*?\)\s*;?/g,
    '',
  );
}

/**
 * Detect a React mount/render call that survived {@link stripRenderCall}. Such
 * a call would reference `ReactDOM`/`document`, which are absent in the shared
 * eval scope, and would otherwise surface cryptically as "ReactDOM is not
 * defined". We only support the canonical chained form Claude Design emits; any
 * other mount shape fails here with an actionable message rather than at eval.
 */
export function assertNoMountCall(strippedScript: string): string {
  if (/ReactDOM\b|\.\s*render\s*\(|\.\s*createRoot\s*\(|\bhydrateRoot\s*\(/.test(strippedScript)) {
    throw new Error(
      'flatten: an unstripped React mount call remains in the harness inline ' +
        'script; expected the canonical chained ' +
        'ReactDOM.createRoot(...).render(<App/>) form',
    );
  }
  return strippedScript;
}
