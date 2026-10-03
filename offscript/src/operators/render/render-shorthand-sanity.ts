import type { Root, Element } from 'hast';
import type { Operator, Finding, OperatorContext } from '../../operator.js';
import type { RenderContext } from '../../render-context.js';
import { safeProbe, type ProbeResult } from '../../render-probe.js';
import { visitElements } from '../../working-rep.js';

/**
 * Tier-1 render-aware rail — `render-shorthand-sanity` (M2 Track A Task 4).
 *
 * Catches the inline-style shorthand parser-failure class. The CR diagnostic
 * surfaced a 3.3 MB inline `style="..."` attribute where two ~1 MB
 * `background:` data-URI gradients sat side-by-side; the browser's
 * attribute-CSS parser silently bailed → `computedStyle.backgroundImage`
 * came back as `none` → bento tiles rendered transparent. Static scans
 * miss this — the source LOOKS valid; only the rendered computed style
 * reveals the failure.
 *
 * --- Detection ---------------------------------------------------------
 * For every element with an inline `style` carrying one of the watched
 * shorthand properties (`background`, `font`, `border`), check the
 * computed style: if the declared value MEANS something (carries a
 * `url(...)` / `linear-gradient(...)` / colour / family / width) but the
 * computed property reports the CSS initial value, the parser failed.
 *
 * v1 watches three shorthands — the ones whose silent-fail mode actually
 * costs the rendered page (a transparent tile, missing typeface, missing
 * border). Other shorthands are deferred to a follow-up rail.
 *
 * --- Auto-remediation --------------------------------------------------
 * For each failure: extract the offending declaration into a managed
 * `<style data-offscript-rail="render-shorthand-sanity">` block in `<head>`,
 * keyed by an injected class (`offscript-rsh-<n>`). The element loses the
 * failing declaration from its `style` attribute but keeps the class —
 * rendering the same intended CSS through a parser path that doesn't
 * stress the attribute buffer. Idempotent: a re-run that finds the class
 * already present + the inline decl already extracted produces no work.
 *
 * --- Contract surface (sync detect/apply return []) --------------------
 * The `Operator` interface is synchronous. Render-aware probing is
 * intrinsically async — Chromium must `getComputedStyle` per element.
 * Matching the `responsive-need-rendered` pattern, the sync `detect` /
 * `apply` return `[]` (no findings via the sync path) and the real work
 * lives on `detectShorthandFailuresAsync(rc, tree)` /
 * `applyShorthandRemediationsAsync(rc, tree)`. The engine's async-aware
 * verification rail (M2 Task 10 wiring) calls those directly.
 *
 * --- Determinism -------------------------------------------------------
 * Findings sort by structural path (root→leaf child-index sequence) then
 * by failed property. Idempotent: detect after apply returns `[]`.
 */

const WATCHED_SHORTHANDS = ['background', 'font', 'border'] as const;
type WatchedShorthand = (typeof WATCHED_SHORTHANDS)[number];

interface ShorthandFailure {
  /** Root→leaf child-index path identifying the element in the hast tree. */
  path: number[];
  /** Which shorthand property failed to parse. */
  property: WatchedShorthand;
  /** The declared (source) shorthand value, trimmed. */
  declaredValue: string;
  /** The computed value the browser reported (e.g., 'none', '0px', ''). */
  computedValue: string;
}

/** Identity used for the managed `<style>` block that holds extracted rules. */
const MANAGED_STYLE_RAIL_MARKER = 'render-shorthand-sanity';

/**
 * Per-shorthand probe heuristics:
 *  - `prop` / `initial` — which computed property to read and what its
 *    CSS-initial value is (failure = computed equals initial).
 *  - `meaningful` — does the SOURCE shorthand DECLARE a value that
 *    REQUIRES a non-initial computed result? `background: red` correctly
 *    yields `backgroundImage: none` and must NOT be flagged; `background:
 *    linear-gradient(...)` must, when it computes to `none`. Each shorthand
 *    has its own "this value implies non-initial" test.
 */
const SHORTHAND_HEURISTICS: Record<
  WatchedShorthand,
  { prop: string; initial: string; meaningful: (value: string) => boolean }
> = {
  background: {
    prop: 'backgroundImage',
    initial: 'none',
    meaningful: (v) =>
      /\b(?:url|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|image-set|-webkit-image-set)\s*\(/i.test(
        v,
      ),
  },
  font: {
    prop: 'fontFamily',
    initial: '',
    meaningful: (v) =>
      /,/.test(v) ||
      /\b(?:serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-(?:serif|sans-serif|monospace|rounded))\b/i.test(
        v,
      ),
  },
  border: {
    prop: 'borderTopStyle',
    initial: 'none',
    meaningful: (v) => /\b(?:solid|dashed|dotted|double|groove|ridge|inset|outset)\b/i.test(v),
  },
};

/** Sync Operator surface — see file header. The async workers do the work. */
export const renderShorthandSanity: Operator = {
  name: 'render-shorthand-sanity',
  tier: 1,

  detect(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },

  apply(_tree: Root, _ctx: OperatorContext): Finding[] {
    return [];
  },
};

/**
 * Async detection: probe each candidate element's computed style and return
 * one finding per parser failure. Sorted deterministically (path asc, then
 * property asc). Returns `[]` when `rc` is undefined.
 */
export async function detectShorthandFailuresAsync(
  rc: RenderContext | undefined,
  tree: Root,
): Promise<Finding[]> {
  const res = await probeFailures(rc, tree);
  if (!res.ok) return res.degrade;
  return res.value.map(failureToFinding);
}

/**
 * Async auto-remediation: extract each failed declaration into a managed
 * `<style>` block keyed by an injected class. Returns one finding per
 * extracted decl with `outcome: 'auto-remediated'`. Idempotent.
 */
export async function applyShorthandRemediationsAsync(
  rc: RenderContext | undefined,
  tree: Root,
): Promise<Finding[]> {
  const res = await probeFailures(rc, tree);
  if (!res.ok) return res.degrade;
  const failures = res.value;
  if (failures.length === 0) return [];

  const findings: Finding[] = [];
  let cursor = countExistingExtractions(tree);
  const styleBlock = ensureManagedStyleBlock(tree);
  const extractedRules: string[] = [];

  for (const f of failures) {
    const el = resolvePath(tree, f.path);
    if (!el) continue;
    const className = `offscript-rsh-${cursor++}`;
    if (!removeDeclarationFromStyle(el, f.property)) continue;
    addClass(el, className);
    extractedRules.push(`.${className} { ${f.property}: ${f.declaredValue}; }`);
    findings.push({ ...failureToFinding(f), outcome: 'auto-remediated' });
  }

  if (extractedRules.length > 0) {
    appendRulesToStyleBlock(styleBlock, extractedRules);
  }
  return findings;
}

/* ───────────────────────────── probe ───────────────────────────── */

async function probeFailures(
  rc: RenderContext | undefined,
  tree: Root,
): Promise<ProbeResult<ShorthandFailure[]>> {
  if (!rc) return { ok: true, value: [] };

  const candidates = collectCandidates(tree);
  if (candidates.length === 0) return { ok: true, value: [] };

  // Build a probe payload — for each candidate, the path + the declared
  // shorthands to test. Probe-side, walk the same path in the live DOM and
  // compare computed style to the CSS-initial for each shorthand's probe
  // property. Return only the failures.
  // Pre-filter candidates host-side: only decls whose declared value REQUIRES
  // a non-initial computed result are worth probing. This eliminates the false
  // positives where the source legitimately declares a colour-only background
  // (computed image is initial by design, not by parser failure).
  const probable = candidates
    .map((c) => ({
      path: c.path,
      decls: c.decls.filter((d) => SHORTHAND_HEURISTICS[d.property].meaningful(d.declaredValue)),
    }))
    .filter((c) => c.decls.length > 0);
  if (probable.length === 0) return { ok: true, value: [] };

  const payload = JSON.stringify(
    probable.map((c) => ({
      path: c.path,
      decls: c.decls.map((d) => ({
        property: d.property,
        declaredValue: d.declaredValue,
        probeProperty: SHORTHAND_HEURISTICS[d.property].prop,
        initial: SHORTHAND_HEURISTICS[d.property].initial,
      })),
    })),
  );

  const fnSource = `(function() {
    var payload = ${payload};
    var results = [];
    function navigate(path) {
      var node = document.documentElement;
      for (var i = 0; i < path.length; i++) {
        var children = node.children;
        if (!children || path[i] >= children.length) return null;
        node = children[path[i]];
      }
      return node;
    }
    for (var i = 0; i < payload.length; i++) {
      var entry = payload[i];
      var el = navigate(entry.path);
      if (!el) continue;
      var cs = getComputedStyle(el);
      for (var j = 0; j < entry.decls.length; j++) {
        var d = entry.decls[j];
        var actual = cs[d.probeProperty] == null ? '' : String(cs[d.probeProperty]);
        if (actual === d.initial) {
          results.push({
            path: entry.path,
            property: d.property,
            declaredValue: d.declaredValue,
            computedValue: actual,
          });
        }
      }
    }
    return results;
  })()`;

  const res = await safeProbe<ShorthandFailure[]>(rc, fnSource, renderShorthandSanity.name);
  if (!res.ok) return res;
  const failures = res.value;
  failures.sort((a, b) => {
    const pa = a.path.join('/');
    const pb = b.path.join('/');
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.property < b.property ? -1 : 1;
  });
  return { ok: true, value: failures };
}

/* ───────────────────────────── candidate walk ───────────────────────────── */

interface CandidateDecl {
  property: WatchedShorthand;
  declaredValue: string;
}

interface Candidate {
  path: number[];
  decls: CandidateDecl[];
}

/** Walk the tree once collecting elements with watched-shorthand inline styles. */
function collectCandidates(tree: Root): Candidate[] {
  const out: Candidate[] = [];
  walkWithPath(tree, [], (el, path) => {
    const styleAttr = el.properties?.style;
    if (typeof styleAttr !== 'string' || styleAttr === '') return;
    const decls = parseWatchedShorthands(styleAttr);
    if (decls.length === 0) return;
    out.push({ path, decls });
  });
  return out;
}

/**
 * Walk every element in the tree, yielding the root-relative child-index
 * path that mirrors the live DOM walk inside the probe (skips text /
 * comment nodes — `document.documentElement.children` mirrors
 * `children.filter(c => c.type === 'element')`).
 */
function walkWithPath(
  root: Root,
  basePath: number[],
  fn: (el: Element, path: number[]) => void,
): void {
  // The live-DOM probe navigates from document.documentElement. In hast,
  // documentElement corresponds to the <html> element — the first element
  // child of the Root. The path indexes from there.
  const html = root.children.find((c): c is Element => c.type === 'element');
  if (!html) return;
  fn(html, basePath);
  walkChildren(html, basePath, fn);
}

function walkChildren(
  parent: Element,
  parentPath: number[],
  fn: (el: Element, path: number[]) => void,
): void {
  let idx = 0;
  for (const child of parent.children) {
    if (child.type !== 'element') continue;
    const path = [...parentPath, idx];
    fn(child, path);
    walkChildren(child, path, fn);
    idx++;
  }
}

/** Navigate the same path the probe uses, returning the matching hast Element. */
function resolvePath(tree: Root, path: number[]): Element | undefined {
  const html = tree.children.find((c): c is Element => c.type === 'element');
  if (!html) return undefined;
  let node: Element = html;
  for (const childIdx of path) {
    const elementChildren = node.children.filter(
      (c): c is Element => c.type === 'element',
    );
    if (childIdx >= elementChildren.length) return undefined;
    node = elementChildren[childIdx];
  }
  return node;
}

/* ───────────────────────────── style attr parsing ───────────────────────────── */

/**
 * Parse `style="..."` into a list of (property, value) pairs for the
 * watched shorthands. Values keep parentheses-balanced so `url(...)` /
 * `linear-gradient(...)` are not split on inner semicolons/colons.
 */
function parseWatchedShorthands(styleAttr: string): CandidateDecl[] {
  const decls: CandidateDecl[] = [];
  const items = splitTopLevel(styleAttr, ';');
  for (const item of items) {
    const colonIdx = findTopLevelColon(item);
    if (colonIdx < 0) continue;
    const prop = item.slice(0, colonIdx).trim().toLowerCase();
    const value = item.slice(colonIdx + 1).trim();
    if (!value) continue;
    if (!isWatchedShorthand(prop)) continue;
    decls.push({ property: prop, declaredValue: value });
  }
  return decls;
}

function isWatchedShorthand(prop: string): prop is WatchedShorthand {
  return (WATCHED_SHORTHANDS as readonly string[]).includes(prop);
}

/**
 * Split a string on `sep`, respecting paren/bracket depth and quotes so
 * `linear-gradient(red, blue)` doesn't split on the inner comma, and
 * `url("a;b")` doesn't split on the inner semicolon.
 */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === inQuote && s[i - 1] !== '\\') inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === sep && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  if (start < s.length) out.push(s.slice(start));
  return out;
}

function findTopLevelColon(s: string): number {
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === inQuote && s[i - 1] !== '\\') inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}

/* ───────────────────────────── mutation helpers ───────────────────────────── */

/**
 * Remove the named shorthand declaration from the element's inline style.
 * Returns true if a declaration was found and removed; false otherwise
 * (idempotent — re-runs after extraction are no-ops).
 */
function removeDeclarationFromStyle(el: Element, property: WatchedShorthand): boolean {
  const style = el.properties?.style;
  if (typeof style !== 'string' || style === '') return false;
  const items = splitTopLevel(style, ';');
  const kept: string[] = [];
  let removed = false;
  for (const item of items) {
    const colonIdx = findTopLevelColon(item);
    if (colonIdx < 0) {
      if (item.trim() !== '') kept.push(item.trim());
      continue;
    }
    const prop = item.slice(0, colonIdx).trim().toLowerCase();
    if (prop === property && !removed) {
      removed = true;
      continue;
    }
    kept.push(item.trim());
  }
  if (!removed) return false;
  const rebuilt = kept.join('; ');
  if (rebuilt === '') {
    delete (el.properties as Record<string, unknown>).style;
  } else {
    (el.properties as Record<string, unknown>).style = rebuilt + ';';
  }
  return true;
}

function addClass(el: Element, className: string): void {
  const props = (el.properties ??= {});
  const existing = props.className;
  if (Array.isArray(existing)) {
    if (!existing.includes(className)) existing.push(className);
  } else if (typeof existing === 'string' && existing !== '') {
    const tokens = existing.split(/\s+/);
    if (!tokens.includes(className)) tokens.push(className);
    (props as Record<string, unknown>).className = tokens;
  } else {
    (props as Record<string, unknown>).className = [className];
  }
}

/**
 * Locate or create the managed `<style>` block in `<head>` that holds
 * extracted shorthand rules. Marked with `data-offscript-rail` so reruns
 * find it deterministically.
 */
function ensureManagedStyleBlock(tree: Root): Element {
  const html = tree.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'html',
  );
  if (!html) throw new Error('render-shorthand-sanity: no <html> element');
  let head = html.children.find(
    (c): c is Element => c.type === 'element' && c.tagName === 'head',
  );
  if (!head) {
    head = { type: 'element', tagName: 'head', properties: {}, children: [] };
    html.children.unshift(head);
  }
  const existing = head.children.find(
    (c): c is Element =>
      c.type === 'element' &&
      c.tagName === 'style' &&
      c.properties?.['dataOffscriptRail'] === MANAGED_STYLE_RAIL_MARKER,
  );
  if (existing) return existing;
  const block: Element = {
    type: 'element',
    tagName: 'style',
    properties: { dataOffscriptRail: MANAGED_STYLE_RAIL_MARKER },
    children: [{ type: 'text', value: '' }],
  };
  head.children.push(block);
  return block;
}

function appendRulesToStyleBlock(styleBlock: Element, rules: string[]): void {
  const first = styleBlock.children[0];
  const existing = first && first.type === 'text' ? first.value : '';
  const next = [existing.trim(), ...rules].filter((s) => s.length > 0).join('\n');
  styleBlock.children = [{ type: 'text', value: next }];
}

/** Count classes already injected — used to keep generated class names stable across re-runs. */
function countExistingExtractions(tree: Root): number {
  let n = 0;
  visitElements(tree, (el) => {
    const cls = el.properties?.className;
    const tokens = Array.isArray(cls)
      ? cls
      : typeof cls === 'string'
        ? cls.split(/\s+/)
        : [];
    for (const t of tokens) {
      if (typeof t === 'string' && /^offscript-rsh-\d+$/.test(t)) n++;
    }
  });
  return n;
}

/* ───────────────────────────── finding ───────────────────────────── */

function failureToFinding(f: ShorthandFailure): Finding {
  return {
    id: `render-shorthand-sanity:${f.path.join('/')}:${f.property}`,
    description:
      `inline-style shorthand \`${f.property}: ${truncate(f.declaredValue, 80)}\` failed to parse — ` +
      `computed ${SHORTHAND_HEURISTICS[f.property].prop} is \`${f.computedValue || '<initial>'}\`. ` +
      `Common cause: oversized attribute buffer (large data-URI). Extracting to a managed <style> rule.`,
    outcome: 'auto-remediated',
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
