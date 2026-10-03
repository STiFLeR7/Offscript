/**
 * Sprint W19 — Semantic Knowledge Consumption (the FIRST consumer of W18).
 *
 * Consumes the W17/W18 component semantic body to influence component SELECTION ONLY — and only as
 * the FINAL tie-breaker, AFTER the existing structural / governance / adjacency scoring. It may
 * raise/lower a candidate's confidence, effectively eliminate an impossible candidate (a dominating
 * penalty within the tie-break tier — never a hard removal that could empty a role or override a
 * superior structural match), and break ties. It NEVER invents candidates, changes ordering of the
 * higher-priority keys, changes section count, or touches copy / layout / authoring / reasoning.
 *
 * ONLY three sections may be consumed: **Choose when**, **Avoid when**, **Composition**. Purpose,
 * Character, Contract, and Judgement are deliberately untouched (future sprints).
 *
 * Matching is deterministic LEXICAL overlap (a bounded tokenizer + a closed negation/role
 * vocabulary) — NO LLM, NO embeddings, NO vectors, NO meaning inference beyond the fixed keyword
 * sets. Gated by the caller; when the consumer is absent every selector is byte-identical.
 */
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import type { ParsedSemanticBody, ComponentSemanticKnowledge } from '../knowledge/semantic-body.js';
import { parseSemanticBody, loadSemanticKnowledge, extractBody, bodyDigest } from '../knowledge/semantic-body.js';
import { readFileSync } from 'node:fs';
import type { Archetype } from '../archetype.js';
import type { BriefTextSource } from './website-selection-signal.js';

// ── tokenizer (shared for brief text + section prose) ─────────────────────────
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'with', 'its', 'this', 'that', 'when', 'where', 'are', 'was', 'has', 'have',
  'not', 'never', 'should', 'than', 'then', 'them', 'they', 'their', 'our', 'you', 'your', 'from',
  'into', 'onto', 'over', 'under', 'out', 'off', 'who', 'what', 'which', 'how', 'why', 'but', 'all',
  'any', 'one', 'two', 'few', 'more', 'most', 'less', 'least', 'about', 'before', 'after', 'beside',
  'section', 'sections', 'page', 'pages', 'component', 'reader', 'readers', 'audience', 'brief',
  'use', 'used', 'using', 'reach', 'choose', 'avoid', 'something', 'real', 'there', 'here', 'wrong',
  'right', 'whole', 'much', 'many', 'each', 'some',
]);

/** Lowercased alphanumeric tokens, length ≥ 3, minus stopwords. Pure + deterministic. */
export function termsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(raw);
  }
  return out;
}

/** Salient terms for a brief — the same fields W16 reads, tokenized. */
export function briefTermsOf(brief: BriefTextSource): Set<string> {
  const text = [
    brief.oneLiner ?? '',
    brief.audience ?? '',
    ...(brief.goals ?? []),
    ...(brief.mustInclude ?? []),
    brief.tone ?? '',
    brief.body ?? '',
  ].join('\n');
  return termsOf(text);
}

// ── role vocabulary for Composition neighbour matching (closed) ───────────────
const ROLE_TERMS: Partial<Record<Archetype, readonly string[]>> = {
  hero: ['hero', 'headline', 'promise'],
  'sub-hero': ['hero', 'headline'],
  'logo-bar': ['logo', 'logos', 'trust', 'marks'],
  'feature-grid': ['feature', 'features', 'capability'],
  'feature-spotlight': ['feature', 'spotlight', 'capability'],
  process: ['process', 'steps', 'workflow', 'how'],
  metrics: ['stats', 'metric', 'metrics', 'numbers', 'proof'],
  testimonial: ['testimonial', 'quote', 'voice'],
  'testimonial-wall': ['testimonial', 'testimonials', 'quotes'],
  'case-study': ['story', 'case', 'customer'],
  pricing: ['pricing', 'price', 'plans'],
  'plan-comparison': ['comparison', 'compare', 'versus'],
  faq: ['faq', 'question', 'questions'],
  'cta-banner': ['cta', 'call-to-action', 'close', 'ask', 'invitation', 'action'],
  footer: ['footer'],
  editorial: ['editorial', 'story', 'manifesto'],
  founder: ['team', 'founder', 'about'],
  integrations: ['integration', 'integrations'],
  contact: ['contact', 'form'],
  resources: ['resources', 'insights', 'news'],
};

/** The closed role-term set for an archetype (for Composition neighbour matching). */
export function roleTermsForArchetype(archetype: Archetype | string): Set<string> {
  const direct = ROLE_TERMS[archetype as Archetype];
  if (direct) return new Set(direct);
  // fallback: the archetype's own tokens (e.g. a future archetype name)
  return new Set(String(archetype).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
}

// ── the score ─────────────────────────────────────────────────────────────────
/** Context the semantic consumer scores against: brief character + (optional) preceding neighbour. */
export interface SemanticSelectionContext {
  /** Salient brief terms (see briefTermsOf). */
  readonly briefTerms: ReadonlySet<string>;
  /** Role terms of the immediately-preceding section, for Composition compatibility (optional). */
  readonly precedingRoleTerms?: ReadonlySet<string>;
}

/** The semantic verdict: a relative score (higher = better fit) and an exclusion flag (avoid-when). */
export interface SemanticVerdict {
  readonly score: number;
  readonly excluded: boolean;
}

const AVOID_EXCLUDE_THRESHOLD = 2; // ≥2 avoid-when terms overlapping the brief ⇒ effectively excluded
const W_CHOOSE = 2;
const W_COMPOSITION = 1;
const NEG_CUES: readonly string[] = [
  'rarely', 'never', 'should not', "shouldn't", 'not sit', 'avoid', 'competing', 'dilute',
  'not beside', 'flatten', 'false ending', 'overpower',
];

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function sectionMarkdown(k: ParsedSemanticBody, name: string): string {
  return k.sections.find((s) => s.name === name)?.markdown ?? '';
}

/**
 * Composition compatibility against the preceding neighbour: +1 when the neighbour's role is named
 * in a neutral/positive clause (composition-aware of it), −2 when named inside a negation clause
 * ("should not sit beside …"). 0 when no neighbour context or no mention. Bounded lexical rule.
 */
function compositionScore(markdown: string, precedingRoleTerms?: ReadonlySet<string>): number {
  if (!precedingRoleTerms || precedingRoleTerms.size === 0) return 0;
  let score = 0;
  for (const sentence of markdown.split(/(?<=[.!?])\s+|\n+/)) {
    const lower = sentence.toLowerCase();
    const mentions = [...precedingRoleTerms].some((t) => lower.includes(t));
    if (!mentions) continue;
    score += NEG_CUES.some((c) => lower.includes(c)) ? -2 : 1;
  }
  return score;
}

/**
 * Score a component's semantic knowledge against a selection context — Choose when / Avoid when /
 * Composition ONLY. Pure + deterministic.
 *  - Choose when: term overlap with the brief → positive confidence.
 *  - Avoid when:  term overlap with the brief → negative; ≥ threshold ⇒ excluded.
 *  - Composition: neighbour compatibility (see compositionScore).
 */
export function scoreSemanticKnowledge(
  k: ParsedSemanticBody,
  ctx: SemanticSelectionContext,
): SemanticVerdict {
  const chooseOverlap = overlap(termsOf(sectionMarkdown(k, 'Choose when')), ctx.briefTerms);
  const avoidOverlap = overlap(termsOf(sectionMarkdown(k, 'Avoid when')), ctx.briefTerms);
  const comp = compositionScore(sectionMarkdown(k, 'Composition'), ctx.precedingRoleTerms);
  const excluded = avoidOverlap >= AVOID_EXCLUDE_THRESHOLD;
  const score = W_CHOOSE * chooseOverlap + W_COMPOSITION * comp - avoidOverlap;
  return { score, excluded };
}

// ── body gate: a non-template body has no opinion; a malformed template fails loud ──
const HAS_H2 = /^##(?!#)\s+/m;

/**
 * Parse a body as a semantic-template body IF it presents as one. Returns null when the body has no
 * `##` sections at all (an un-migrated one-line descriptor — no semantic opinion). Throws (fail
 * loud) when the body HAS `##` sections but breaks the template (unknown / duplicate / missing).
 */
export function tryParseSemanticBody(body: string, location: string): ParsedSemanticBody | null {
  if (!HAS_H2.test(body)) return null;
  return parseSemanticBody(body, location);
}

// ── the consumer (slug → component.md → verdict), with a fail-loud digest guard ──
/** A built semantic-selection consumer over a component repository root. */
export interface SemanticSelectionConsumer {
  /** Score a candidate by slug; null when the component has no semantic body (no opinion). */
  scoreFor(slug: string, ctx: SemanticSelectionContext): SemanticVerdict | null;
}

/** The bundle the planner threads into both website selectors: the consumer + the brief's terms. */
export interface SemanticSelection {
  readonly consumer: SemanticSelectionConsumer;
  readonly briefTerms: ReadonlySet<string>;
}

interface CacheEntry {
  readonly digest: string;
  readonly knowledge: ComponentSemanticKnowledge | null;
}

/** Default repository root: offscript/repository (module-relative; overridable for tests). */
export function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL('../../repository', import.meta.url));
}

/**
 * Build the consumer over a repository root. Per-slug caching keyed on the body digest; a changed
 * body between reads (digest mismatch) fails loud rather than serving a stale verdict.
 */
export function createSemanticSelectionConsumer(root: string = defaultRepositoryRoot()): SemanticSelectionConsumer {
  const cache = new Map<string, CacheEntry>();

  const loadKnowledge = (slug: string): ComponentSemanticKnowledge | null => {
    const file = `${root}/canonical/${slug}/component.md`;
    if (!existsSync(file)) return null;
    const body = extractBody(readFileSync(file, 'utf8'), `canonical/${slug}/component.md`);
    const digest = bodyDigest(body);
    const cached = cache.get(slug);
    if (cached) {
      if (cached.digest !== digest) {
        throw new Error(`semantic-selection: digest mismatch for '${slug}' (body changed mid-run)`);
      }
      return cached.knowledge;
    }
    // not a template body ⇒ null (no opinion); a malformed template throws via loadSemanticKnowledge
    const knowledge = HAS_H2.test(body) ? loadSemanticKnowledge(file, root) : null;
    cache.set(slug, { digest, knowledge });
    return knowledge;
  };

  return {
    scoreFor(slug, ctx) {
      const k = loadKnowledge(slug);
      return k ? scoreSemanticKnowledge(k, ctx) : null;
    },
  };
}
