/**
 * WS4 — deterministic source-doc grounding.
 *
 * A collateral brief may declare `source-doc:` (a path under references/). Its body
 * carries the real per-page substance. This matcher splits that doc into heading-
 * delimited chunks and fills each plan item's `content` from the best-matching chunk —
 * but ONLY when the brief body did not already provide content (brief body always wins).
 * Pure function of its string inputs: no LLM, no I/O, no clock — deterministic and
 * trivially cacheable (the determinism guardrail).
 *
 * Matching mirrors attachBriefContent: slug-equality, then UNIQUE substring either
 * direction. Ambiguous (>1 candidate) → no match (never a positional guess). Unmatched
 * source chunks are advisory-only (a source doc is usually a superset of the deck).
 */
import type { PlanItem } from './types.js';

function toSlug(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section'
  );
}

interface SourceChunk { slug: string; content: string; }

// NOTE: splitSourceChunks + the heading-slug stripping below intentionally MIRROR
// plan.ts's splitBodyChunks + headingMatchSlug so a heading slugs IDENTICALLY in both
// matchers (same regex `#{1,3}`, same enumerator/circled-numeral/bullet strip set).
// The duplication is deliberate-for-now: extracting a shared chunk-match.ts (without
// disturbing attachBriefContent / the website matcher) is a tracked follow-up.
function splitSourceChunks(body: string): SourceChunk[] {
  const headingRe = /^#{1,3}\s+(.+?)\s*$/;
  const chunks: SourceChunk[] = [];
  let cur: { heading: string; lines: string[] } | null = null;
  const finalize = (c: { heading: string; lines: string[] }): SourceChunk => ({
    slug: toSlug(
      c.heading
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^[①-⑳]\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .trim(),
    ),
    content: c.lines.join('\n').trim(),
  });
  for (const line of body.split(/\r?\n/)) {
    const m = headingRe.exec(line);
    if (m) {
      if (cur) chunks.push(finalize(cur));
      cur = { heading: m[1], lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) chunks.push(finalize(cur));
  return chunks;
}

export function attachSourceContent(items: PlanItem[], sourceBody: string, warnings: string[]): void {
  const chunks = splitSourceChunks(sourceBody);
  if (chunks.length === 0) return;
  const consumed = new Set<number>();

  for (const item of items) {
    if (item.content) continue; // brief body already covered this page — it wins
    const intentSlug = toSlug(item.intent);

    let idx = chunks.findIndex((c, i) => !consumed.has(i) && c.slug === intentSlug);
    if (idx === -1) {
      const cands: number[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (consumed.has(i)) continue;
        const cs = chunks[i].slug;
        if (cs && (intentSlug.includes(cs) || cs.includes(intentSlug))) cands.push(i);
      }
      if (cands.length === 1) idx = cands[0];
    }
    if (idx !== -1) {
      consumed.add(idx);
      item.content = chunks[idx].content;
    }
  }

  const unmatched = chunks.filter((_, i) => !consumed.has(i)).length;
  if (unmatched > 0) {
    warnings.push(
      `Offscript source-doc: ${unmatched} of ${chunks.length} source sections matched no page ` +
        `(a source doc is usually a superset of the deck — informational, not an error).`,
    );
  }
}
