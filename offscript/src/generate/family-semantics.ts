/**
 * Sprint W23 — Component Family Semantic Intelligence (loader only).
 *
 * Makes the authored COMPONENT FAMILY knowledge (the abstract role layer — Hero, FAQ, Footer, …)
 * machine-readable as a typed, immutable, deterministically-cached model — WITHOUT any consumer.
 * This is the family analogue of the W18 per-component body loader (`semantic-body.ts`), and mirrors
 * its architecture exactly: one parser, one immutable model, one loader, one validator, one digest,
 * one cache.
 *
 * Boundary (load-bearing):
 *  - Family knowledge is authored in `src/generate/family-knowledge/<family>.md` — World B data, NOT
 *    the `repository/` corpus. `knowledge:build` scans only the `canonical/`/`scopes/` partitions
 *    (`src/knowledge/source/scan.ts`), so World A and all materialization digests are untouched.
 *  - Nothing in World A or World B imports this module; it is referenced only by its test.
 *    Materialization, planning, selection, ordering, authoring, and HTML are therefore unchanged.
 *  - The parser PRESERVES authored wording / per-section markdown verbatim; the one tolerated
 *    transform is line-ending canonicalization (CRLF→LF) so the digest is platform-independent.
 *  - Grounded, never invented: family bodies derive strictly from `components.md`, the W17 component
 *    bodies, and `COMPONENT_SYSTEM.md` (see `docs/internals/COMPONENT-FAMILY-SEMANTIC-MODEL.md`).
 *
 * No reasoning. No interpretation. No embeddings. No vectors. No LLM.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, sep, join } from 'node:path';

/** Bump when the parsing/representation contract changes; participates in the cache identity. */
export const FAMILY_PARSER_VERSION = 'w23-family-semantics@1';

/**
 * The 16 GROUNDED family dimensions, in canonical (enforced) order. Derived strictly from authored
 * governance. The three brief-listed domain dimensions (Primary Audience / Suitable / Unsuitable
 * Business Types) are deliberately OMITTED — no authored source + the rebrand test forbids them at
 * the family layer (a governance gap, not an engineering one; see the model doc §5).
 */
export const REQUIRED_FAMILY_SECTIONS = [
  'Purpose',
  'Mission',
  'Information Density',
  'Reading Behaviour',
  'Interaction Style',
  'Decision Style',
  'Strengths',
  'Weaknesses',
  'Avoid When',
  'Typical Inputs',
  'Typical Outputs',
  'Sibling Differences',
  'Escalation Rules',
  'Family Character',
  'Conversion Style',
  'Expected Visitor State',
] as const;

export type FamilySectionName = (typeof REQUIRED_FAMILY_SECTIONS)[number];
const REQUIRED_SET: ReadonlySet<string> = new Set(REQUIRED_FAMILY_SECTIONS);
const CANONICAL_INDEX: ReadonlyMap<string, number> = new Map(
  REQUIRED_FAMILY_SECTIONS.map((name, i) => [name, i] as const),
);

/**
 * The closed registry of the 17 real component families (the `family-*` packages /
 * `components.md` role catalogue). A document declaring any other family is an `unknown family`.
 */
export const KNOWN_FAMILIES = [
  'family-atoms-transitions',
  'family-call-to-action',
  'family-comparison',
  'family-contact-lead-form',
  'family-faq',
  'family-feature-value-prop',
  'family-footer',
  'family-hero',
  'family-integrations',
  'family-navigation',
  'family-pricing',
  'family-process-how-it-works',
  'family-resources-insights-news',
  'family-social-proof-logos',
  'family-stats-outcomes',
  'family-team-about',
  'family-testimonials-case-studies',
] as const;

export type FamilyName = (typeof KNOWN_FAMILIES)[number];
const KNOWN_SET: ReadonlySet<string> = new Set(KNOWN_FAMILIES);

/** Fail-loud error for every validation breach (unknown / duplicate / missing / empty / ordering / …). */
export class FamilySemanticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FamilySemanticsError';
  }
}

/** One authored `##` section, verbatim. */
export interface FamilySection {
  /** The `##` heading text, exactly as authored (a member of REQUIRED_FAMILY_SECTIONS). */
  readonly name: FamilySectionName;
  /** The section's markdown content, verbatim (outer blank lines stripped; interior bytes intact). */
  readonly markdown: string;
  /** 0-based authored order within the body (== canonical index, since ordering is enforced). */
  readonly order: number;
}

/** The pure parse result — depends ONLY on the body content + parser version (the cache identity). */
export interface ParsedFamilyBody {
  /** H1 title text, verbatim ('' if none). */
  readonly title: string;
  /** Prose between the H1 and the first `##`, verbatim ('' if none). */
  readonly lede: string;
  /** Sections in authored (== canonical) order. */
  readonly sections: readonly FamilySection[];
  /** sha256 over (FAMILY_PARSER_VERSION + ' ' + canonicalized body). */
  readonly digest: string;
  /** Always 'valid' — an invalid body throws (fail loud) and never yields an object. */
  readonly validationState: 'valid';
}

/** A parsed family body bound to its declared family + source file. */
export interface ComponentFamilyKnowledge extends ParsedFamilyBody {
  /** The declared family (a member of KNOWN_FAMILIES). */
  readonly family: FamilyName;
  /** Root-relative path of the source `<family>.md`. */
  readonly sourceFile: string;
}

// ── frontmatter extraction (mirrors W18; additionally lifts the declared `family:` key) ──
const FRONTMATTER_WITH_BODY = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/;
const FAMILY_KEY = /^family:[ \t]*(\S+)[ \t]*$/m;

/**
 * Extract the declared family + the prose body following the YAML frontmatter, canonicalizing line
 * endings to LF. Fails loud when no frontmatter fence is present (parity with W18) or no `family:`
 * key is declared, so a malformed document can never be silently read.
 */
export function extractFamilyDocument(markdownText: string, location: string): { family: string; body: string } {
  const normalized = markdownText.replace(/^﻿/, '').replace(/^(?:[ \t]*\r?\n)+/, '');
  const m = FRONTMATTER_WITH_BODY.exec(normalized);
  if (!m) {
    throw new FamilySemanticsError(`${location}: family document requires a leading YAML frontmatter block`);
  }
  const fm = FAMILY_KEY.exec(m[1] ?? '');
  if (!fm) {
    throw new FamilySemanticsError(`${location}: family document frontmatter must declare a 'family:' key`);
  }
  return { family: fm[1], body: (m[2] ?? '').replace(/\r\n/g, '\n') };
}

function canonicalize(body: string): string {
  return body.replace(/\r\n/g, '\n');
}

/** Content digest: sha256 over the parser version and the canonicalized body only. Deterministic. */
export function bodyDigest(body: string): string {
  return createHash('sha256').update(FAMILY_PARSER_VERSION).update(' ').update(canonicalize(body)).digest('hex');
}

const H1 = /^#(?!#)\s+(.*\S)\s*$/;
const H2 = /^##(?!#)\s+(.*\S)\s*$/;

/** Strip leading and trailing blank lines from a block; leave interior content byte-for-byte. */
function trimBlankEdges(lines: string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end).join('\n');
}

/**
 * Parse a family body string into the typed, frozen model. Pure + deterministic. Fails loud on:
 * empty body, no `##` sections, unknown section, duplicate section, empty section, missing required
 * section (incl. Purpose / Mission), and invalid ordering (sections must appear in canonical order).
 * Preserves per-section markdown verbatim.
 */
export function parseFamilyBody(body: string, location = '<body>'): ParsedFamilyBody {
  const canonical = canonicalize(body);
  if (canonical.trim() === '') {
    throw new FamilySemanticsError(`${location}: empty body — expected the W23 family template`);
  }
  const lines = canonical.split('\n');

  // ── preamble (title + lede) — everything before the first `##`; not validated ──
  let title = '';
  const preamble: string[] = [];
  let i = 0;
  let inFence = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && H2.test(line)) break;
    const h1 = !inFence ? H1.exec(line) : null;
    if (h1 && title === '') title = h1[1];
    else preamble.push(line);
  }
  const lede = trimBlankEdges(preamble);

  // ── sections ──
  const sections: FamilySection[] = [];
  const seen = new Set<string>();
  let lastIndex = -1;
  inFence = false;
  while (i < lines.length) {
    const heading = H2.exec(lines[i]); // loop invariant: i is at a `##` heading on entry
    const name = heading![1];
    const contentLines: string[] = [];
    i++;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*```/.test(line)) inFence = !inFence;
      if (!inFence && H2.test(line)) break;
      contentLines.push(line);
    }
    if (!REQUIRED_SET.has(name)) {
      throw new FamilySemanticsError(
        `${location}: unknown section '${name}' — only the W23 family dimensions are permitted ` +
          `(${REQUIRED_FAMILY_SECTIONS.join(', ')})`,
      );
    }
    if (seen.has(name)) {
      throw new FamilySemanticsError(`${location}: duplicate section '${name}'`);
    }
    const markdown = trimBlankEdges(contentLines);
    if (markdown === '') {
      throw new FamilySemanticsError(`${location}: empty section '${name}' — every dimension must be authored`);
    }
    const idx = CANONICAL_INDEX.get(name)!;
    if (idx <= lastIndex) {
      throw new FamilySemanticsError(
        `${location}: invalid ordering — section '${name}' is out of canonical order ` +
          `(expected the order: ${REQUIRED_FAMILY_SECTIONS.join(', ')})`,
      );
    }
    lastIndex = idx;
    seen.add(name);
    sections.push(Object.freeze({ name: name as FamilySectionName, markdown, order: sections.length }));
  }

  if (sections.length === 0) {
    throw new FamilySemanticsError(`${location}: no '##' sections found — expected the W23 family template`);
  }
  const missing = REQUIRED_FAMILY_SECTIONS.filter((s) => !seen.has(s));
  if (missing.length > 0) {
    throw new FamilySemanticsError(`${location}: missing required dimension(s): ${missing.join(', ')}`);
  }

  return Object.freeze({
    title,
    lede,
    sections: Object.freeze(sections),
    digest: bodyDigest(canonical),
    validationState: 'valid' as const,
  });
}

// ── deterministic cache (identity = body content + parser version, via bodyDigest) ──
const CACHE = new Map<string, ParsedFamilyBody>();

/** Clear the parse cache (test isolation / explicit reset). */
export function clearFamilyCache(): void {
  CACHE.clear();
}

/**
 * Parse with caching. Cache key is the content digest (body + parser version) ONLY — never a
 * timestamp or filesystem metadata. Replaying the same body returns the identical frozen object.
 */
export function parseFamilyBodyCached(body: string, location = '<body>'): ParsedFamilyBody {
  const key = bodyDigest(body);
  const hit = CACHE.get(key);
  if (hit) return hit;
  const parsed = parseFamilyBody(body, location);
  CACHE.set(key, parsed);
  return parsed;
}

/**
 * Read a `<family>.md`, extract its declared family + body, validate the family is known, parse
 * (cached), and bind the family + source path. Fails loud on a frontmatter-less document, a missing
 * `family:` key, or an unknown family. The returned object is frozen.
 */
export function loadFamilyKnowledge(file: string, root: string): ComponentFamilyKnowledge {
  const location = relative(root, file).split(sep).join('/');
  const { family, body } = extractFamilyDocument(readFileSync(file, 'utf8'), location);
  if (!KNOWN_SET.has(family)) {
    throw new FamilySemanticsError(
      `${location}: unknown family '${family}' — must be one of the 17 known families`,
    );
  }
  const parsed = parseFamilyBodyCached(body, location);
  return Object.freeze({ ...parsed, sections: parsed.sections, family: family as FamilyName, sourceFile: location });
}

/** Default family-knowledge root: `src/generate/family-knowledge` (module-relative; overridable). */
export function defaultFamilyKnowledgeRoot(): string {
  return fileURLToPath(new URL('./family-knowledge', import.meta.url));
}

/** A built provider over a family-knowledge root. */
export interface FamilyKnowledgeProvider {
  /** The knowledge for a family; null when no `<family>.md` exists (no opinion). */
  knowledgeFor(family: string): ComponentFamilyKnowledge | null;
  /** Load every `<family>.md` in the root, keyed by declared family. Fails loud on a duplicate family. */
  loadAll(): Map<FamilyName, ComponentFamilyKnowledge>;
}

/**
 * Build the provider. `knowledgeFor` has a per-family cache keyed on the body digest; a changed body
 * between reads (digest mismatch) fails loud rather than returning a stale object. `loadAll` scans
 * the root for `*.md` and fails loud if two documents declare the same family.
 */
export function createFamilyKnowledgeProvider(
  root: string = defaultFamilyKnowledgeRoot(),
): FamilyKnowledgeProvider {
  const cache = new Map<string, { digest: string; ctx: ComponentFamilyKnowledge | null }>();
  const fileFor = (family: string) => join(root, `${family}.md`);
  return {
    knowledgeFor(family) {
      const file = fileFor(family);
      let text: string;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        return null; // no document for this family → no opinion
      }
      const location = relative(root, file).split(sep).join('/');
      const { body } = extractFamilyDocument(text, location);
      const digest = bodyDigest(body);
      const hit = cache.get(family);
      if (hit) {
        if (hit.digest !== digest) {
          throw new FamilySemanticsError(`family-semantics: digest mismatch for '${family}' (body changed mid-run)`);
        }
        return hit.ctx;
      }
      const ctx = loadFamilyKnowledge(file, root);
      cache.set(family, { digest, ctx });
      return ctx;
    },
    loadAll() {
      const out = new Map<FamilyName, ComponentFamilyKnowledge>();
      const files = readdirSync(root).filter((f) => f.endsWith('.md')).sort();
      for (const f of files) {
        const k = loadFamilyKnowledge(join(root, f), root);
        if (out.has(k.family)) {
          throw new FamilySemanticsError(`family-semantics: duplicate family '${k.family}' (declared by more than one document)`);
        }
        out.set(k.family, k);
      }
      return out;
    },
  };
}
