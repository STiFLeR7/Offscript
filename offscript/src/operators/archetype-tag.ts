import type { Root, Element, ElementContent } from 'hast';
import type { Operator, Finding, OperatorContext } from '../operator.js';
import type { Archetype, ArchetypeAssignment, ArchetypeModel } from '../archetype.js';
import { resolveAnchor } from '../sections.js';

/**
 * Tier-0 tagger: archetype-tag (M2 Group B, unblocks Tasks 3–6).
 *
 * Builds the per-page `ArchetypeModel` (section id → archetype) and assigns it
 * to `ctx.archetypeModel` as a side-effect. This is the documented seam
 * (src/archetype.ts, src/operator.ts `archetypeModel?`): the model is carried
 * on the shared `OperatorContext` so the Group B rails — cta-choreography,
 * section-count-rhythm, narrative-arc-presence, archetype-neighbour-collisions
 * — read it via `ctx.archetypeModel`. Registry order (operators/index.ts) puts
 * archetype-tag before those rails so the side-effect is in place when they run.
 *
 * Resolution precedence (declared-wins-inference, per the M2 handoff Task 2):
 *   1. 'override'  → `ctx.params.override[id]` (a creative-direction.md policy)
 *   2. 'declared'  → `ctx.params.declared[id]` (a sections.md frontmatter
 *                    archetype, threaded into the recipe entry's params — the
 *                    declarative config layer, per spec invariant #2)
 *   3. 'inferred'  → structural heuristic over the section's subtree
 *                    (SECTION_INTELLIGENCE.md Part 3 cues): h1+image → hero,
 *                    ≥3 q&a → faq, quote+attribution → testimonial, etc.
 *
 * Override and declared values are validated against the CLOSED archetype enum
 * (src/archetype.ts) — an out-of-enum value is ignored (with a warning) and the
 * section falls through to inference. The tagger NEVER emits an archetype
 * outside the closed set; that is the closed-enum guarantee (spec invariant #2:
 * "operators are a fixed library, not a DSL"). Adding an archetype is a
 * coordinated planning change (enum + this heuristic + SECTION_INTELLIGENCE.md),
 * not a config field.
 *
 * Outcomes are 'warning' only (a tagger detects nothing to auto-remediate or
 * freeze): unresolved declared anchors, ignored out-of-enum declarations, and
 * genuinely unclassifiable sections each surface one warning. Tagging success
 * is silent. The tree is never mutated — only `ctx.archetypeModel` is set.
 *
 * Spec: M2 charter (docs/internals/M2-PARALLEL-HANDOFF.md §4 Task 2);
 *       SECTION_INTELLIGENCE.md Part 3 (Section Catalog).
 */

/** The closed archetype set, materialised for runtime validation of declared/override input. */
export const ALL_ARCHETYPES: readonly Archetype[] = [
  'hero',
  'sub-hero',
  'logo-bar',
  'feature-grid',
  'feature-spotlight',
  'process',
  'metrics',
  'testimonial',
  'testimonial-wall',
  'case-study',
  'pricing',
  'plan-comparison',
  'faq',
  'cta-banner',
  'footer',
  'editorial',
  'founder',
  'integrations',
  'contact',
  'resources',
];

const ARCHETYPE_SET: ReadonlySet<string> = new Set(ALL_ARCHETYPES);

/** Type guard: is this string a member of the closed archetype enum? */
export function isArchetype(value: unknown): value is Archetype {
  return typeof value === 'string' && ARCHETYPE_SET.has(value);
}

export const archetypeTag: Operator = {
  name: 'archetype-tag',
  tier: 0,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    return tagArchetypes(tree, ctx);
  },

  apply(tree: Root, ctx: OperatorContext): Finding[] {
    // Tagging is a pure side-effect on ctx; apply == detect (idempotent).
    return tagArchetypes(tree, ctx);
  },
};

/**
 * Build the archetype model, assign it to `ctx.archetypeModel`, return warnings.
 * Pure with respect to the tree; idempotent (re-running rebuilds an equal map).
 */
function tagArchetypes(tree: Root, ctx: OperatorContext): Finding[] {
  const findings: Finding[] = [];
  const model: ArchetypeModel = new Map();

  const declared = asArchetypeMap(ctx.params.declared);
  const override = asArchetypeMap(ctx.params.override);

  const sections = collectSections(tree, ctx, findings);
  if (sections.length === 0) {
    findings.push({
      id: 'archetype-tag:no-sections',
      description:
        'no sections to tag — neither a sections map (ctx.sections) nor any ' +
        'semantic <header>/<section>/<footer> elements were found; archetype ' +
        'model is empty (Group B rails will no-op)',
      outcome: 'warning',
    });
    ctx.archetypeModel = model;
    return findings;
  }

  const last = sections.length - 1;
  for (let i = 0; i < sections.length; i++) {
    const { id, el } = sections[i];

    // 1. override (creative-direction policy) — highest precedence.
    const ov = readDeclared(override, id, 'override', findings);
    if (ov) {
      model.set(id, { archetype: ov, decidedBy: 'override', confidence: 1 });
      continue;
    }

    // 2. declared (sections.md frontmatter, via params) — wins over inference.
    const dec = readDeclared(declared, id, 'declared', findings);
    if (dec) {
      model.set(id, { archetype: dec, decidedBy: 'declared', confidence: 1 });
      continue;
    }

    // 3. inferred (structural heuristic).
    const inferred = inferArchetype(el, { isFirst: i === 0, isLast: i === last });
    if (inferred) {
      model.set(id, {
        archetype: inferred.archetype,
        decidedBy: 'inferred',
        confidence: inferred.confidence,
      });
      continue;
    }

    findings.push({
      id: `archetype-tag:unclassified:${id}`,
      description: `could not assign an archetype to section "${id}" (no declared/override value and no confident structural match); left out of the archetype model`,
      outcome: 'warning',
    });
  }

  ctx.archetypeModel = model;
  return findings;
}

/** Coerce a params value into a section-id → string map, tolerating junk. */
function asArchetypeMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Read a declared/override archetype for a section id, validating against the
 * closed enum. An out-of-enum value is ignored (warned) so the caller falls
 * through to the next precedence tier — the closed-enum guarantee in action.
 */
function readDeclared(
  map: Record<string, string>,
  id: string,
  kind: 'declared' | 'override',
  findings: Finding[],
): Archetype | null {
  const raw = map[id];
  if (raw === undefined) return null;
  if (isArchetype(raw)) return raw;
  findings.push({
    id: `archetype-tag:invalid-${kind}:${id}`,
    description: `${kind} archetype "${raw}" for section "${id}" is not in the closed archetype set — ignored; falling through to inference`,
    outcome: 'warning',
  });
  return null;
}

/** A page section, keyed by a stable id, paired with its root element. */
export interface PageSection {
  id: string;
  el: Element;
}

/**
 * Enumerate the page's sections, keyed by stable id and in page order. Shared
 * by archetype-tag and the Group B rails so they all see the SAME sections in
 * the SAME order the ArchetypeModel was keyed (ArchetypeModel is a Map; its
 * insertion order is this order).
 *  - With a sections map (ctx.sections): use it verbatim — resolve each declared
 *    anchor element (unresolved anchors skipped silently here; archetype-tag
 *    warns about them). Keys match SectionsModel so rails join cleanly.
 *  - Without one (standalone / tests): walk for top-level <header>/<section>/
 *    <footer> elements. Key is the element id if present, else `section-<n>`.
 */
export function enumerateSections(tree: Root, ctx: OperatorContext): PageSection[] {
  if (ctx.sections && ctx.sections.sections.length > 0) {
    const out: PageSection[] = [];
    for (const section of ctx.sections.sections) {
      const el = resolveAnchor(tree, section);
      if (el) out.push({ id: section.id, el });
    }
    return out;
  }
  return collectSectionEls(tree).map((el, index) => ({
    id: sectionKey(el, index),
    el,
  }));
}

/** enumerateSections + the unresolved-anchor warnings archetype-tag surfaces. */
function collectSections(
  tree: Root,
  ctx: OperatorContext,
  findings: Finding[],
): PageSection[] {
  const sections = enumerateSections(tree, ctx);
  if (ctx.sections && ctx.sections.sections.length > 0) {
    const resolved = new Set(sections.map((s) => s.id));
    for (const section of ctx.sections.sections) {
      if (!resolved.has(section.id)) {
        findings.push({
          id: `archetype-tag:unresolved-anchor:${section.id}`,
          description: `declared section "${section.id}" anchor #${section.anchor} not found in the document — skipped`,
          outcome: 'warning',
        });
      }
    }
  }
  return sections;
}

const SECTION_TAGS: ReadonlySet<string> = new Set(['header', 'section', 'footer']);

/**
 * Collect top-level section-level elements. A section-level element is recorded
 * and NOT descended into (nested sections fold into their parent); container
 * elements (div, main, article wrappers) are descended through to find the
 * sections they wrap.
 */
function collectSectionEls(tree: Root): Element[] {
  const body = findFirst(tree, 'body');
  const root: Root | Element = body ?? tree;
  const out: Element[] = [];
  const walk = (node: Root | Element): void => {
    for (const child of node.children as ElementContent[]) {
      if (child.type !== 'element') continue;
      if (SECTION_TAGS.has(child.tagName)) {
        out.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return out;
}

/** Stable key for a section element: its id if present, else a positional fallback. */
function sectionKey(el: Element, index: number): string {
  const id = el.properties?.id;
  if (typeof id === 'string' && id) return id;
  return `section-${index}`;
}

// ───────────────────────── structural inference ─────────────────────────

interface Signals {
  cls: string;
  tag: string;
  hasH1: boolean;
  headingCount: number;
  imgCount: number;
  blockquoteCount: number;
  qaCount: number;
  tableCount: number;
  hasCheckCross: boolean;
  ctaCount: number;
  linkCount: number;
  statCount: number;
  gridItemCount: number;
  attributionPresent: boolean;
  textLen: number;
}

interface Inferred {
  archetype: Archetype;
  confidence: number;
}

/**
 * Infer a section's archetype from its subtree. Keyword cues on the section
 * element's own class/id come first (high confidence); structural cues are the
 * fallback (lower confidence). Returns null when nothing matches confidently.
 */
function inferArchetype(el: Element, pos: { isFirst: boolean; isLast: boolean }): Inferred | null {
  const s = analyze(el);

  if (s.tag === 'footer') return { archetype: 'footer', confidence: 1 };

  const byKeyword = matchKeyword(s);
  if (byKeyword) return byKeyword;

  // Structural fallbacks (SECTION_INTELLIGENCE.md Part 3 cues).
  if (pos.isFirst && s.hasH1 && s.imgCount >= 1) return { archetype: 'hero', confidence: 0.8 };
  if (pos.isFirst && s.hasH1) return { archetype: 'hero', confidence: 0.65 };
  if (s.qaCount >= 3) return { archetype: 'faq', confidence: 0.8 };
  if (s.blockquoteCount >= 3) return { archetype: 'testimonial-wall', confidence: 0.7 };
  if (s.blockquoteCount >= 1 && s.attributionPresent)
    return { archetype: 'testimonial', confidence: 0.75 };
  if (s.tableCount >= 1 && s.hasCheckCross)
    return { archetype: 'plan-comparison', confidence: 0.7 };
  if (s.statCount >= 3) return { archetype: 'metrics', confidence: 0.6 };
  if (s.imgCount >= 3 && s.headingCount <= 1) return { archetype: 'logo-bar', confidence: 0.6 };
  if (pos.isLast && s.linkCount >= 6) return { archetype: 'footer', confidence: 0.6 };
  if (s.gridItemCount >= 3 && s.headingCount >= 3)
    return { archetype: 'feature-grid', confidence: 0.55 };
  if (s.ctaCount >= 1 && s.headingCount <= 1 && s.textLen < 240)
    return { archetype: 'cta-banner', confidence: 0.55 };

  return null;
}

/** Ordered class/id keyword cues. Order matters: more specific patterns first. */
const KEYWORD_CUES: Array<{ re: RegExp; archetype: Archetype; confidence: number }> = [
  { re: /comparison|compare/, archetype: 'plan-comparison', confidence: 0.85 },
  // customer-story / success-story → case-study (must precede the editorial cue,
  // which matches the bare word "story").
  { re: /case[-_\s]?stud|customer[-_\s]?stor|success[-_\s]?stor/, archetype: 'case-study', confidence: 0.85 },
  { re: /integration/, archetype: 'integrations', confidence: 0.85 },
  { re: /founder/, archetype: 'founder', confidence: 0.85 },
  { re: /sub[-_\s]?hero/, archetype: 'sub-hero', confidence: 0.85 },
  { re: /spotlight/, archetype: 'feature-spotlight', confidence: 0.85 },
  { re: /faq|frequently[-_\s]?asked/, archetype: 'faq', confidence: 0.85 },
  { re: /pricing|\bprice|\bplans?\b/, archetype: 'pricing', confidence: 0.85 },
  { re: /how[-_\s]?it[-_\s]?works|process|\bsteps?\b/, archetype: 'process', confidence: 0.8 },
  { re: /metrics?|\bstats?\b/, archetype: 'metrics', confidence: 0.8 },
  // resources / insights / news (the nurture library) — before the editorial cue.
  { re: /resources?|insights?|\bnews\b/, archetype: 'resources', confidence: 0.8 },
  { re: /editorial|story|manifesto/, archetype: 'editorial', confidence: 0.75 },
  { re: /logo|trusted|\bclients?\b|\bbrands?\b/, archetype: 'logo-bar', confidence: 0.8 },
  // contact / get-in-touch — before the cta cue (a contact block is its own section).
  { re: /contact|get[-_\s]?in[-_\s]?touch/, archetype: 'contact', confidence: 0.8 },
  { re: /cta|call[-_\s]?to[-_\s]?action/, archetype: 'cta-banner', confidence: 0.8 },
  { re: /\bhero\b|masthead/, archetype: 'hero', confidence: 0.8 },
  { re: /feature|\bgrid\b|capabilit/, archetype: 'feature-grid', confidence: 0.75 },
  { re: /footer/, archetype: 'footer', confidence: 0.9 },
];

function matchKeyword(s: Signals): Inferred | null {
  if (!s.cls) return null;
  // Testimonial first (before the generic cue loop), so a class like
  // "testimonial-grid" tags as a testimonial, not a feature-grid. The single
  // vs wall split uses the quote count.
  if (/testimonial|\breviews?\b/.test(s.cls)) {
    return s.blockquoteCount >= 3
      ? { archetype: 'testimonial-wall', confidence: 0.85 }
      : { archetype: 'testimonial', confidence: 0.85 };
  }
  for (const cue of KEYWORD_CUES) {
    if (cue.re.test(s.cls)) return { archetype: cue.archetype, confidence: cue.confidence };
  }
  return null;
}

/** Walk a section subtree once, gathering the structural signals inference needs. */
function analyze(el: Element): Signals {
  const cls = classAndId(el);
  let headingCount = 0;
  let hasH1 = false;
  let imgCount = 0;
  let blockquoteCount = 0;
  let qaCount = 0;
  let tableCount = 0;
  let ctaCount = 0;
  let linkCount = 0;
  let statCount = 0;
  let gridItemCount = 0;
  let attributionPresent = false;
  let checkCross = false;

  visit(el, (node, isRoot) => {
    if (isRoot) return; // the section element itself isn't its own content
    const tag = node.tagName;
    if (/^h[1-6]$/.test(tag)) {
      headingCount++;
      if (tag === 'h1') hasH1 = true;
    }
    if (tag === 'img' || tag === 'svg' || tag === 'picture' || tag === 'video') imgCount++;
    if (tag === 'blockquote') blockquoteCount++;
    if (tag === 'table') tableCount++;
    if (tag === 'a') linkCount++;
    // One q&a per <summary> (the accordion-item marker); counting <details>
    // too would double every native disclosure.
    if (tag === 'summary') qaCount++;
    if (tag === 'cite' || tag === 'figcaption') attributionPresent = true;

    const nodeCls = classAndId(node);
    if (/btn|button|cta/.test(nodeCls) || tag === 'button') ctaCount++;
    if (/faq[-_]?item|accordion[-_]?item|qa[-_]?pair/.test(nodeCls)) qaCount++;
    if (/\bstat\b|\bmetric\b|\bnumber\b|\bcounter\b/.test(nodeCls)) statCount++;
    if (/card|tile|feature[-_]?item|grid[-_]?item|\bcol[-_]/.test(nodeCls)) gridItemCount++;
    if (/author|attribution|\bcite\b|\brole\b/.test(nodeCls)) attributionPresent = true;
  });

  const text = textOf(el);
  if (/[✓✔✕✗×]/.test(text)) checkCross = true;

  return {
    cls,
    tag: el.tagName,
    hasH1,
    headingCount,
    imgCount,
    blockquoteCount,
    qaCount,
    tableCount,
    hasCheckCross: checkCross,
    ctaCount,
    linkCount,
    statCount,
    gridItemCount,
    attributionPresent,
    textLen: text.trim().length,
  };
}

/** Lowercased "id + classes" string for keyword matching. */
function classAndId(el: Element): string {
  const parts: string[] = [];
  const id = el.properties?.id;
  if (typeof id === 'string') parts.push(id);
  const cls = el.properties?.className;
  if (Array.isArray(cls)) {
    for (const c of cls) if (typeof c === 'string') parts.push(c);
  } else if (typeof cls === 'string') {
    parts.push(cls);
  }
  return parts.join(' ').toLowerCase();
}

/** Concatenate all text content under an element. */
function textOf(el: Element): string {
  let out = '';
  visit(el, (node) => {
    for (const child of node.children as ElementContent[]) {
      if (child.type === 'text') out += child.value;
    }
  });
  return out;
}

/** Depth-first element visitor; fn receives `isRoot` true for the start element. */
function visit(el: Element, fn: (node: Element, isRoot: boolean) => void): void {
  const walk = (node: Element, isRoot: boolean): void => {
    fn(node, isRoot);
    for (const child of node.children as ElementContent[]) {
      if (child.type === 'element') walk(child, false);
    }
  };
  walk(el, true);
}

/** Find the first element with the given tag name anywhere in the tree. */
function findFirst(tree: Root, tagName: string): Element | undefined {
  let found: Element | undefined;
  const walk = (node: Root | Element): void => {
    for (const child of node.children as ElementContent[]) {
      if (found) return;
      if (child.type !== 'element') continue;
      if (child.tagName === tagName) {
        found = child;
        return;
      }
      walk(child);
    }
  };
  walk(tree);
  return found;
}
