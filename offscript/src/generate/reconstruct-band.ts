/**
 * WS3a (EA-018 / EA-019) — fragment EXTRACTION (the dormant first half of the WS3
 * reconstruction transform).
 *
 * Given a planner-selected `fragmentId` (slug), read its READ-ONLY section exemplar from the
 * surviving charter corpus (`resources/design_processes/website/exemplars/sections/
 * component-<slug>.html`) and lift the two raw parts WS3b later scopes + wraps:
 *
 *   - the band-root element  — the single `<section>` (EA-018 Phase 1 common case), else the
 *     first anchorable top-level `<body>` element (EA-018 Phase 3: the root is an anchorable
 *     element — `injectAnchor`'s ANCHOR_TAGS; the corpus carries `<section>`/`<footer>`/`<div>`
 *     roots), with the preview-only `data-screen-label` attr dropped;
 *   - the per-component `<head>` `<style>` — lifted as RAW, UNSCOPED CSS (token `var()` refs
 *     intact); '' when the exemplar carries none.
 *
 * NORMALIZATION (EA-018): document chrome (`<!DOCTYPE>`/`<html>`/`<head>`/`<body>`) and the
 * `colors_and_type.css` link are excluded by construction (only the band root + head styles
 * are returned). PRESERVATION (I1): DOM, semantic tags, order, classes, inline styles, SVG,
 * behaviour hooks, and token `var()` refs are kept verbatim. FAIL-LOUD: F1 (no exemplar file)
 * and F2 (no extractable band root).
 *
 * SCOPE (EA-011 split): WS3a is EXTRACTION ONLY. It does NOT scope selectors under
 * `[data-crf]`, wrap the content in a `<div data-crf="<slug>">`, stamp the marker, or touch
 * `catalog.ts` `loadFragmentHtml` — those are WS3b. This module is DORMANT: it has no live
 * caller (the live website path is author-from-governance), so the shipped deliverable is
 * unchanged. Deterministic (hast round-trip). Website-only; never reached by collateral.
 */

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Root, Element } from 'hast';
import type { AtRule } from 'postcss';
import { parseHtml, serializeHtml, findElement, visitElements } from '../working-rep.js';
import { parseCss, serializeCss } from '../css-rep.js';
import { designProcessesDir } from '../paths.js';

/** Anchorable band-root tags (mirrors website-assembly.ts injectAnchor's ANCHOR_TAGS). */
const ANCHOR_TAGS = new Set([
  'section',
  'header',
  'footer',
  'nav',
  'article',
  'aside',
  'main',
  'div',
]);

/**
 * The WS3a output: the raw extracted parts. NOT yet scoped / wrapped in `<div data-crf>` /
 * marker-stamped — that is WS3b's `(ExtractedBand, slug) → scoped band string` step.
 */
export interface ExtractedBand {
  /** The band-root anchorable element, serialized verbatim, with preview-only attrs dropped. */
  section: string;
  /** The per-component `<head>` `<style>` CSS, raw and unscoped; '' when the exemplar has none. */
  style: string;
}

/** Absolute path to a section exemplar in the surviving charter corpus. */
export function exemplarSectionPath(slug: string): string {
  return join(designProcessesDir('website'), 'exemplars', 'sections', `component-${slug}.html`);
}

/**
 * The band root: prefer a `<section>` anywhere in the document (EA-018 Phase 1), else the
 * first top-level `<body>` element that is anchorable (EA-018 Phase 3). Returns undefined
 * when no anchorable root exists (→ F2).
 */
function bandRoot(tree: Root): Element | undefined {
  const section = findElement(tree, 'section');
  if (section) return section;
  const body = findElement(tree, 'body');
  const scope = body ?? tree;
  for (const child of scope.children) {
    if (child.type === 'element' && ANCHOR_TAGS.has(child.tagName)) return child;
  }
  return undefined;
}

/** Concatenate the raw CSS of every `<style>` block in `<head>` (preserves multi-block exemplars). */
function headStyleCss(tree: Root): string {
  const head = findElement(tree, 'head');
  if (!head) return '';
  const parts: string[] = [];
  visitElements(head, (el) => {
    if (el.tagName === 'style') {
      for (const child of el.children) {
        if (child.type === 'text') parts.push(child.value);
      }
    }
  });
  return parts.join('\n').trim();
}

/** Serialize a single hast element back to an HTML string (via the working-rep serializer). */
function serializeElement(el: Element): string {
  const root: Root = { type: 'root', children: [el] };
  return serializeHtml(root);
}

/**
 * Pure extraction (EA-018): lift the band root + the per-component `<head>` styles from a
 * section exemplar document, dropping chrome / token-sheet link / preview-only attrs.
 * Throws F2 when the document carries no extractable band root.
 */
export function extractBand(exemplarHtml: string): ExtractedBand {
  const tree = parseHtml(exemplarHtml);
  const root = bandRoot(tree);
  if (!root) {
    throw new Error(
      'extractBand: exemplar has no extractable <section>/anchorable band root (WS3 F2) — ' +
        'the document is malformed or is not a section exemplar.',
    );
  }
  // Drop preview-only attrs (EA-018 normalization). hast camel-cases data-screen-label.
  if (root.properties) delete root.properties.dataScreenLabel;
  return { section: serializeElement(root), style: headStyleCss(tree) };
}

/**
 * Read the exemplar for a planner-selected `fragmentId` from the surviving corpus and extract
 * its raw band parts. Throws F1 (fail loud, mirroring the `loadFragmentHtml` posture) when the
 * slug has no exemplar file. `exemplarPath` overrides the resolved path (tests). DORMANT — no
 * live caller; WS3b/WS9b wire it into the `loadFragmentHtml` contract.
 */
export function extractBandForSlug(slug: string, exemplarPath?: string): ExtractedBand {
  const p = exemplarPath ?? exemplarSectionPath(slug);
  let html: string;
  try {
    html = readFileSync(p, 'utf8');
  } catch {
    throw new Error(
      `extractBandForSlug: no exemplar for slug "${slug}" at ${p} (WS3 F1) — ` +
        'is the slug a real catalog component, and is the charter corpus present?',
    );
  }
  return extractBand(html);
}

// ── WS3b — RECONSTRUCTION (scoping + wrapper + marker) ───────────────────────────
// Consumes the frozen WS3a ExtractedBand and emits the EA-018 output band:
// `<div data-crf="<slug>"><style>{scoped}</style>{section}</div>`. The ONLY rewrite is
// descendant-scoping the band style under the root (EA-018 Phase 4); token `var()` refs and
// the section DOM are preserved verbatim. Still DORMANT (reached only via loadFragmentHtml,
// which has no live caller). WS6 anchoring (id/data-archetype) and assembly are out of scope.

const RE_DATA_CRF = /^\s*<div\s+data-crf=/i;

function isKeyframesAtRule(name: string): boolean {
  return /^(-[a-z]+-)?keyframes$/i.test(name);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Descendant-scope ONE selector under the data-crf root (EA-018 Phase 5). A bare
 * `:root`/`html`/`body` (alone or leading) maps to the root itself; everything else is
 * prefixed `[data-crf="slug"] <selector>`. Idempotent (I5): an already-scoped selector is
 * left untouched.
 */
function scopeSelector(selector: string, rootSel: string): string {
  const s = selector.trim();
  if (!s || s.startsWith(rootSel)) return s; // already scoped — no double-prefix (I5)
  if (/^(:root|html|body)$/i.test(s)) return rootSel; // global → the root itself
  const lead = s.match(/^(:root|html|body)\b\s*/i);
  if (lead) {
    const rest = s.slice(lead[0].length).trim();
    return rest ? `${rootSel} ${rest}` : rootSel;
  }
  return `${rootSel} ${s}`;
}

/**
 * Scope every band-style selector under `[data-crf="<slug>"]` (EA-018 Phase 5 / I3): rule
 * selectors (incl. inside `@media`/`@supports`) are descendant-scoped; `@keyframes` step
 * selectors are NEVER prefixed; `@keyframes` NAMES are namespaced per-slug and the matching
 * `animation`/`animation-name` references rewritten (collision-freedom, I3). Token `var()`
 * refs are untouched (I6). Tolerant of a malformed block (F7 → empty AST → ''). Idempotent (I5).
 */
export function scopeBandCss(css: string, slug: string): string {
  if (!css.trim()) return '';
  const root = parseCss(css);
  const rootSel = `[data-crf="${slug}"]`;

  // 1) Namespace @keyframes names (idempotent: skip an already-namespaced name).
  const suffix = `__crf-${slug}`;
  const renamed = new Map<string, string>();
  root.walkAtRules((at: AtRule) => {
    if (!isKeyframesAtRule(at.name)) return;
    const name = at.params.trim();
    if (!name || name.endsWith(suffix)) return;
    const ns = `${name}${suffix}`;
    renamed.set(name, ns);
    at.params = ns;
  });

  // 2) Scope rule selectors, skipping keyframe step selectors (0%, from, to).
  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule' && isKeyframesAtRule((parent as AtRule).name)) return;
    rule.selectors = rule.selectors.map((sel) => scopeSelector(sel, rootSel));
  });

  // 3) Rewrite animation references to the namespaced keyframes (I3 collision-freedom).
  if (renamed.size > 0) {
    root.walkDecls((decl) => {
      if (!/^(-[a-z]+-)?animation(-name)?$/i.test(decl.prop)) return;
      let value = decl.value;
      for (const [oldName, newName] of renamed) {
        value = value.replace(new RegExp(`\\b${escapeRe(oldName)}\\b`, 'g'), newName);
      }
      decl.value = value;
    });
  }

  return serializeCss(root);
}

/**
 * WS3b — reconstruct the scoped `data-crf` band from a WS3a ExtractedBand: wrap the section
 * content + the scoped `<style>` in a single `<div data-crf="<slug>">` root. The root carries
 * ONLY the `data-crf` marker (exactly one — I7); `id`/`data-archetype` are WS6's to add.
 * Deterministic (I4). Idempotent (I5): a section that is already a `data-crf` band is returned
 * verbatim. An empty style yields no `<style>` tag (the 6 style-less exemplars).
 */
export function reconstructBand(extracted: ExtractedBand, slug: string): string {
  if (RE_DATA_CRF.test(extracted.section)) return extracted.section.trim(); // already a band (I5)
  const scoped = scopeBandCss(extracted.style, slug);
  const styleTag = scoped ? `<style>${scoped}</style>` : '';
  return `<div data-crf="${slug}">${styleTag}${extracted.section}</div>`;
}

/**
 * WS3b — the whole reconstruction transform: slug → scoped, marked band string (the EA-018
 * `loadFragmentHtml` contract). Fail-loud F1/F2 via WS3a. `exemplarPath` overrides the path
 * (tests). DORMANT — wired into `catalog.ts` `loadFragmentHtml`, which has no live caller.
 */
export function reconstructBandForSlug(slug: string, exemplarPath?: string): string {
  return reconstructBand(extractBandForSlug(slug, exemplarPath), slug);
}
