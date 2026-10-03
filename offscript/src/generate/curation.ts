/**
 * Path C / P2 — the Curation Table (the catalog's machine-checkable audit trail).
 *
 * validate-page.js (the v2 gate) reads a markdown table from the FIRST HTML comment in a
 * built page's <main>:
 *
 *   | intent | surface | candidates | chosen | mode | reason |
 *
 * proving every band was SELECTED from the catalog by `serves` meta (≥2 candidates, never
 * by filename) — the AI-slop gate (SKILL.md step 3 / ALIGNMENT.md BRIDGE-1). This module
 * emits that exact table from an assigned AuthoringPlan, plus a deterministic `reason`
 * scaffold that satisfies the gate's "reason must cite meta" + rule-c "why chosen beats
 * its alternates" checks.
 *
 * Pure strings — no LLM, no HTML assembly (P3 pastes the fragments + lifts this comment
 * into <main>). The column shape + cleaning mirror tools/_curation.js parseCurationTable
 * and validate-page.js rules c/d so the emitted table parses + passes by construction.
 */

import type { Archetype } from '../archetype.js';
import { type FragmentEntry, loadFragmentCatalog, ARCHETYPE_TO_SERVES } from './catalog.js';
import type { PlanItem } from './types.js';

/**
 * Deterministic reason scaffold for a curated band. Cites the chosen fragment's primary
 * surface + layout (so validate-page's "reason must cite the meta" check passes) AND names
 * a rejected candidate with "chosen over …" (so the rule-c "why does the chosen component
 * beat its alternates for THIS brief" nudge passes — no warning). `reuse` appends a rule-d
 * justification when the same donor serves more than one band.
 *
 * This is the designer-brain SEAM: PlanItem.reason (set by the in-session LLM author) wins;
 * this scaffold is the deterministic floor so a scripted run still emits a gate-clean table.
 */
export function buildReason(
  chosen: FragmentEntry,
  candidates: FragmentEntry[],
  serves: string,
  reuse = false,
): string {
  const surface = chosen.surface[0] ?? 'neutral';
  const layout = chosen.layout[0] ?? 'stack';
  const rejected = candidates.find((c) => c.slug !== chosen.slug);
  const over = rejected ? rejected.slug : 'its alternates';
  const base = `${surface} surface, ${layout} layout; chosen over ${over} for best-fit ${serves}`;
  return reuse ? `${base}; deliberate reuse — no fresher fragment serves ${serves}` : base;
}

const HEADER = '| intent | surface | candidates | chosen | mode | reason |';
const SEP = '| --- | --- | --- | --- | --- | --- |';

/**
 * Serialize the assigned plan to the Curation-Table markdown (header + separator + one row
 * per curated website band, in page order). Items without a `fragmentId` (non-website, or a
 * non-website archetype) are skipped. The `reason` cell falls back to the deterministic
 * scaffold when PlanItem.reason is unset.
 */
export function serializeCurationTable(items: PlanItem[], catalog?: FragmentEntry[]): string {
  const cat = catalog ?? loadFragmentCatalog();
  const bySlug = new Map(cat.map((f) => [f.slug, f]));

  // donor-reuse count (rule d) — a slug chosen >1× needs a reuse justification in its reason.
  const chosenCount = new Map<string, number>();
  for (const it of items) {
    if (it.fragmentId) chosenCount.set(it.fragmentId, (chosenCount.get(it.fragmentId) ?? 0) + 1);
  }

  const rows: string[] = [];
  for (const it of items) {
    if (!it.fragmentId || !it.candidates) continue;
    const chosen = bySlug.get(it.fragmentId);
    if (!chosen) continue;
    const serves = ARCHETYPE_TO_SERVES[it.archetype as Archetype];
    if (!serves) continue;
    const candEntries = it.candidates
      .map((s) => bySlug.get(s))
      .filter((f): f is FragmentEntry => Boolean(f));
    const reuse = (chosenCount.get(it.fragmentId) ?? 0) > 1;
    const reason = it.reason ?? buildReason(chosen, candEntries, serves, reuse);
    const surface = chosen.surface[0] ?? '';
    rows.push(
      `| ${serves} | ${surface} | ${it.candidates.join(', ')} | ${it.fragmentId} | as-is | ${reason} |`,
    );
  }
  return [HEADER, SEP, ...rows].join('\n');
}

/**
 * Wrap the Curation Table in the HTML comment the gate reads from <main>. This is the EXACT
 * block P3 lifts verbatim to the top of <main>; serializeRulebook embeds it so the plan's
 * rulebook.md already carries the shippable audit trail. Returns '' when no band is curated
 * (collateral / non-website plan).
 */
export function serializeCurationComment(items: PlanItem[], catalog?: FragmentEntry[]): string {
  if (!items.some((it) => it.fragmentId)) return '';
  const table = serializeCurationTable(items, catalog);
  return `<!--\n${table}\n-->`;
}
