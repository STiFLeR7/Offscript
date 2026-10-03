/**
 * Sprint W20 — Semantic Author Context (transport only).
 *
 * Surfaces a component's authored semantic knowledge to the website Author REQUEST, verbatim, so the
 * Author MAY read it. Nothing interprets it — not the runtime, not the planner, not the loader. This
 * sprint is pure TRANSPORT: Component → W18 loader → Plan (PlanItem.componentKnowledge) → author
 * request (`## Component Knowledge` block).
 *
 * ONLY four sections are surfaced: **Purpose**, **Character**, **Contract**, **Judgement**.
 * Choose-when / Avoid-when / Composition are deliberately NOT surfaced here — they belong to the
 * W19 selection consumer. No summarization, interpretation, rewriting, inference, embedding, or
 * vectorization: the section markdown travels exactly as authored.
 */
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import type { SemanticSection, ComponentSemanticKnowledge } from '../knowledge/semantic-body.js';
import { extractBody, bodyDigest, loadSemanticKnowledge } from '../knowledge/semantic-body.js';

/** The four sections surfaced to the Author (W20 scope). Order = canonical surfaced order. */
export const SURFACED_AUTHOR_SECTIONS = ['Purpose', 'Character', 'Contract', 'Judgement'] as const;
const SURFACED_SET: ReadonlySet<string> = new Set(SURFACED_AUTHOR_SECTIONS);

/**
 * The carrier the planner attaches to a PlanItem and the author request renders. Holds the surfaced
 * sections (authored order, verbatim) plus the source body digest (transport integrity). Immutable.
 */
export interface ComponentKnowledgeContext {
  readonly sourceFile: string;
  /** The W18 body digest — proves the transported sections came from a specific, unchanged body. */
  readonly digest: string;
  /** Purpose / Character / Contract / Judgement, in authored order, verbatim. */
  readonly sections: readonly SemanticSection[];
}

/**
 * Filter a full W18 ComponentSemanticKnowledge down to the four surfaced sections (authored order
 * preserved), carrying the digest + source. Pure; never rewrites a section.
 */
export function extractComponentKnowledge(k: ComponentSemanticKnowledge): ComponentKnowledgeContext {
  const sections = k.sections.filter((s) => SURFACED_SET.has(s.name));
  return Object.freeze({
    sourceFile: k.sourceFile,
    digest: k.digest,
    sections: Object.freeze(sections),
  });
}

const HAS_H2 = /^##(?!#)\s+/m;

/** A built provider over a component repository root. */
export interface ComponentKnowledgeProvider {
  /** The surfaced knowledge for a component slug; null when it has no semantic body (no transport). */
  knowledgeFor(slug: string): ComponentKnowledgeContext | null;
}

/** Default repository root: offscript/repository (module-relative; overridable for tests). */
export function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL('../../repository', import.meta.url));
}

/**
 * Build the provider. Per-slug cache keyed on the body digest; a changed body between reads (digest
 * mismatch) fails loud rather than transporting a stale block. A body with no `##` sections is "not
 * a semantic body" → null (no transport); a body that HAS `##` sections but breaks the template
 * fails loud via the W18 loader (unknown / duplicate / missing section).
 */
export function createComponentKnowledgeProvider(
  root: string = defaultRepositoryRoot(),
): ComponentKnowledgeProvider {
  const cache = new Map<string, { digest: string; ctx: ComponentKnowledgeContext | null }>();
  return {
    knowledgeFor(slug) {
      const file = `${root}/canonical/${slug}/component.md`;
      if (!existsSync(file)) return null;
      const body = extractBody(readFileSync(file, 'utf8'), `canonical/${slug}/component.md`);
      const digest = bodyDigest(body);
      const hit = cache.get(slug);
      if (hit) {
        if (hit.digest !== digest) {
          throw new Error(`semantic-author-context: digest mismatch for '${slug}' (body changed mid-run)`);
        }
        return hit.ctx;
      }
      const ctx = HAS_H2.test(body) ? extractComponentKnowledge(loadSemanticKnowledge(file, root)) : null;
      cache.set(slug, { digest, ctx });
      return ctx;
    },
  };
}
