/**
 * Path C / P4 — the v2 CURATION GATE as a blocking CR-validate axis for website.
 *
 * The design team's `catalog/tools/validate-page.js` is the machine-enforceable
 * statement of PURPOSE.md's rule: every band must be SELECTED (by meta, not name) or
 * explicitly COMPOSED — never raw un-curated AI-slop. It parses the Curation Table
 * (the P2 comment leading <main>) and cross-checks it against fragments/manifest.json,
 * then proves every <main> section is a pulled `data-crf` fragment or a marked
 * `data-composed` section. This module wires that subprocess into Offscript's Stage 4:
 *
 *   - `runValidatePageGate(html, catalog?)` — WS7 (EA-018/EA-019): IN-PROCESS curation
 *     enforcement. The deleted `validate-page.js`/`_curation.js` subprocess is replaced by a
 *     faithful in-process port of the same rule set + message wording, run over the assembled
 *     page's Curation Table + the `FragmentEntry[]` catalog (the surviving metadata source,
 *     sourced from COMPOSITION.md via the WS1 adapter — the manifest `BY_SLUG` it once read is
 *     gone). Returns the SAME `CurationGateReport` (pass/exitCode/errors/warnings/raw) the
 *     subprocess produced, so `parseGateReport`/`gateFindings`/`classifyGateError`/
 *     `foldCurationGate` are unchanged. Deterministic; no `page.evaluate`/playwright (runs in
 *     default CI). `catalog` defaults to `loadFragmentCatalog()`; tests inject a synthetic one.
 *
 *   - `gateFindings(report, plan)` — translate each gate ERROR into a Offscript `Finding`
 *     whose id embeds the offending section's anchor id (`curation-gate:<anchorId>`, or
 *     `curation-gate:<a>-><b>` for an adjacency pair), so the existing
 *     `mapFindingsToItems` (reauthor-loop.ts) routes it to the right item — the AP4.4
 *     failure-routing path, reusing the loop machinery rather than reinventing it. The
 *     gate translates slug↔anchor through the plan (item.fragmentId / item.intent).
 *
 *   - `classifyGateError(msg)` — SELECTION errors (<2 candidates, not-a-slug, donor
 *     reuse, limit breach, adjacency clash, invalid mode) route to RE-CURATE (P1/P2);
 *     PROVENANCE / anti-slop errors (un-curated markup, un-audited fragment, missing
 *     compose marker) route to RE-EDIT (P3). Surfaced in the finding description.
 *
 *   - `foldCurationGate(base, report, plan)` — append the gate findings to `perRail`
 *     (a synthetic rail entry, purely for routing — it runs AFTER scoreFindingsByRail,
 *     so it does NOT move the systematic-ratio) and set `outcome.gate`. The BLOCK lives
 *     on `outcome.gate.pass`, which `goalMet` reads — a page is not "done" until the
 *     gate exits 0 (AP4.2). The gate findings carry `outcome: 'warning'` so they never
 *     accidentally freeze or score; the blocking is the explicit `gate.pass` flag, not
 *     the finding disposition.
 *
 *   - `runSelectionDiversity(html)` — the soft cross-build rotation advisory
 *     (`selection-diversity.js`, always exit 0). NEVER blocks; surfaced as a report only
 *     (AP4.3). The hard rules stay in validate-page.js.
 *
 * SCRIPTED-PATH NOTE (carry forward): the deterministic pasteVerbatim author pastes the
 * real curated example-brand bands, which PASS the gate (proven in curation.test.ts). So the
 * gate does NOT change the scripted-path stop reason — that path stops by the no-progress
 * guard at ratio ~0.57 < target, exactly as before. The gate can only BLOCK a would-be
 * goal-met (an LLM-authored page that drifted off-curation); it never turns not-met into met.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogToolsDir } from '../paths.js';
import type { Finding } from '../operator.js';
import type { AuthoringPlan } from './types.js';
import type { ValidateOutcome, PerRailEntry } from './reauthor-loop.js';
import { type FragmentEntry, loadFragmentCatalog } from './catalog.js';

/** Where a gate error routes for remediation (AP4.4). */
export type GateRoute = 're-curate' | 're-edit';

/** The raw subprocess outcome of one `validate-page.js` run. */
export interface CurationGateReport {
  /** true iff validate-page.js exited 0 (curation verified). */
  pass: boolean;
  /** 0 = PASS, 1 = FAIL (violations), 2 = usage / unreadable input. */
  exitCode: number;
  /** parsed `✗ error(s)` lines — these block the page. */
  errors: string[];
  /** parsed `⚠ warning(s)` lines — soft (rule-c / meta nags); do not block. */
  warnings: string[];
  /** full stdout+stderr (for surfacing the verbatim report in logs / tests). */
  raw: string;
}

/** The synthetic rail name the gate findings are attributed to in perRail. */
export const CURATION_GATE_RAIL = 'curation-gate';

/**
 * WS7 — enforce CURATION on an assembled page IN-PROCESS (no subprocess, no temp file).
 *
 * A faithful port of the deleted `validate-page.js` rule set over the same Curation Table
 * (the first HTML comment in <main>) cross-checked against the catalog meta, plus the
 * `data-crf`/`data-composed` accounting that blocks raw un-curated slop. The catalog is the
 * surviving `FragmentEntry[]` (COMPOSITION.md via the WS1 adapter) — it replaces the deleted
 * `fragments/manifest.json` `BY_SLUG`. `catalog` defaults to `loadFragmentCatalog()`. The
 * returned `CurationGateReport` is byte-for-byte the shape the subprocess produced, so all
 * downstream translation/routing/folding is unchanged.
 *
 * Exit semantics mirror the tool: 0 = PASS, 1 = FAIL (errors, or warnings under
 * `warnAsError`). The old exit-2 (usage / unreadable file) cannot occur in-process — the
 * page is an in-memory string; a missing `<main>`/table is a normal blocking error, not a
 * usage failure.
 */
export function runValidatePageGate(
  html: string,
  catalog?: FragmentEntry[],
  opts: { warnAsError?: boolean } = {},
): CurationGateReport {
  const cat = catalog ?? loadFragmentCatalog();
  const result = enforceCuration(html, cat);
  const hardWarnings = opts.warnAsError ? result.warnings.length : 0;
  const fail = result.errors.length > 0 || hardWarnings > 0;
  return {
    pass: !fail,
    exitCode: fail ? 1 : 0,
    errors: result.errors,
    warnings: result.warnings,
    raw: renderGateReport(result, fail),
  };
}

// ── In-process curation rule engine (faithful port of validate-page.js + _curation.js) ──

/** One parsed Curation-Table row (mirrors `_curation.js` parseCurationTable output). */
interface CurationRow {
  n: number;
  intent: string;
  surface: string;
  candidates: string[];
  chosen: string;
  mode: string;
  reason: string;
}

/** The enforcement outcome — message lists + the section counts for the report header. */
interface EnforceResult {
  errors: string[];
  warnings: string[];
  nFrag: number;
  nComp: number;
  nRows: number;
}

/** Mode aliases the table tolerates (port of `_curation.js` VALID_MODES). */
const VALID_MODES: Record<string, string> = {
  'as-is': 'as-is', asis: 'as-is', 'as is': 'as-is',
  'cross-pick': 'cross-pick', 'cross pick': 'cross-pick', crosspick: 'cross-pick', cross: 'cross-pick',
  compose: 'compose', composed: 'compose',
};

/** lower-case, split on comma / whitespace / slash → clean token list (serves/layout/surface meta). */
function tokens(s: string): string[] {
  return (s || '').toLowerCase().split(/[,\s/]+/).map((t) => t.trim()).filter(Boolean);
}

/** Tokenize already-array catalog meta the same way `tokens()` treats a comma-string. */
function metaTokens(arr: string[] | undefined): string[] {
  return (arr ?? []).flatMap((x) => tokens(x));
}

/**
 * Parse the Curation Table from a built page (port of `_curation.js` parseCurationTable).
 * Returns `{ main, rows, errors }`; stops at the first failing stage (no <main> → no table →
 * no data rows → missing column → zero rows), matching the original early-return behaviour.
 */
function parseCurationTable(html: string): { main: string | null; rows: CurationRow[]; errors: string[] } {
  const errors: string[] = [];
  const out: { main: string | null; rows: CurationRow[]; errors: string[] } = { main: null, rows: [], errors };

  const mainM = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!mainM) {
    errors.push('no <main> … </main> found — pages must be built on fragments/_shell.html');
    return out;
  }
  const main = mainM[1];
  out.main = main;

  const comments = [...main.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
  let tableComment: string | null = null;
  for (const c of comments) {
    const low = c.toLowerCase();
    if (low.includes('intent') && low.includes('chosen') && low.includes('mode') && c.includes('|')) {
      tableComment = c;
      break;
    }
  }
  if (!tableComment) {
    errors.push(
      'no Curation Table found at the top of <main> (an HTML comment with a | intent | … | chosen | mode | reason | table). ' +
        'A built page MUST ship its curation audit trail — this is the AI-slop gate (SKILL.md step 3).',
    );
    return out;
  }

  const rawRows = tableComment.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (rawRows.length < 2) {
    errors.push('Curation Table has no data rows.');
    return out;
  }
  const cells = (l: string): string[] => l.replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
  const header = cells(rawRows[0]).map((h) => h.toLowerCase());
  const col = (name: string): number => header.findIndex((h) => h.includes(name));
  const ci = {
    intent: col('intent'),
    surface: col('surface'),
    candidates: col('candidate'),
    chosen: col('chosen'),
    mode: col('mode'),
    reason: col('reason'),
  };
  for (const k of ['intent', 'candidates', 'chosen', 'mode', 'reason'] as const) {
    if (ci[k] < 0) errors.push(`Curation Table is missing the "${k}" column (header: ${header.join(' | ')}).`);
  }
  if (errors.length) return out;

  const rows: CurationRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const c = cells(rawRows[i]);
    if (/^[-:\s]+$/.test(c.join(''))) continue; // separator row
    if (c.length < header.length) continue;
    const clean = (s: string): string => (s || '').replace(/[`*]/g, '').trim();
    rows.push({
      n: rows.length + 1,
      intent: clean(c[ci.intent]).toLowerCase(),
      surface: clean(c[ci.surface]).toLowerCase(),
      candidates: clean(c[ci.candidates]).split(',').map((x) => x.replace(/[`*]/g, '').trim()).filter(Boolean),
      chosen: clean(c[ci.chosen]).toLowerCase(),
      mode: VALID_MODES[clean(c[ci.mode]).toLowerCase()] || clean(c[ci.mode]).toLowerCase(),
      reason: clean(c[ci.reason]),
    });
  }
  if (!rows.length) {
    errors.push('Curation Table parsed to zero rows.');
    return out;
  }
  out.rows = rows;
  return out;
}

/**
 * Remove every `<tag …ATTR…> … </tag>` block (depth-aware over the SAME tag name).
 * Port of validate-page.js `stripWrappers` — used to detect un-curated residue (8d).
 */
function stripWrappers(s: string, attr: string): string {
  let out = s;
  const open = new RegExp(`<([a-z]+)\\b[^>]*\\b${attr}\\s*=`, 'i');
  let guard = 0;
  while (guard++ < 500) {
    const m = out.match(open);
    if (!m) break;
    const tag = m[1];
    const start = m.index ?? 0;
    const tagOpen = new RegExp(`<${tag}\\b`, 'ig');
    const tagClose = new RegExp(`</${tag}>`, 'ig');
    let depth = 0;
    let end = -1;
    const region = out;
    let pos = start;
    while (pos < region.length) {
      tagOpen.lastIndex = pos;
      tagClose.lastIndex = pos;
      const o = tagOpen.exec(region);
      const c = tagClose.exec(region);
      if (!c) break;
      if (o && o.index < c.index) {
        depth++;
        pos = o.index + 1;
      } else {
        depth--;
        pos = c.index + c[0].length;
        if (depth === 0) {
          end = pos;
          break;
        }
      }
    }
    if (end === -1) {
      out = out.slice(0, start) + out.slice(start + 1); // unbalanced — drop one char to avoid loop
      continue;
    }
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

/**
 * The in-process rule engine. Each rule's message wording is preserved verbatim from
 * `validate-page.js` so the downstream `classifyGateError`/`resolveAnchors` parsing is
 * unchanged. `catalog` replaces the manifest `BY_SLUG`.
 */
function enforceCuration(html: string, catalog: FragmentEntry[]): EnforceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const E = (m: string): void => void errors.push(m);
  const W = (m: string): void => void warnings.push(m);

  const BY_SLUG = new Map<string, FragmentEntry>();
  for (const f of catalog) BY_SLUG.set(f.slug, f);
  const firstSurface = (slug: string): string | null => {
    const f = BY_SLUG.get(slug);
    return f ? metaTokens(f.surface)[0] ?? null : null;
  };
  const layoutPrims = (slug: string): string[] => {
    const f = BY_SLUG.get(slug);
    return f ? metaTokens(f.layout) : [];
  };
  const servesOf = (slug: string): string[] => metaTokens(BY_SLUG.get(slug)?.serves);

  // 1+2. <main> + Curation Table (shared parser). Early-return on structural errors.
  const parsed = parseCurationTable(html);
  if (parsed.errors.length) {
    parsed.errors.forEach(E);
    return { errors, warnings, nFrag: 0, nComp: 0, nRows: 0 };
  }
  const main = parsed.main ?? '';
  const rows = parsed.rows;

  // 3. section markers present in the page
  const crfPresent = [...main.matchAll(/data-crf="([^"]+)"/g)].map((m) => m[1]);
  const composedPresent = [...main.matchAll(/data-composed="([^"]+)"/g)].map((m) => m[1]);
  const crfSet = new Set(crfPresent);

  // 4. per-row checks
  const chosenCount: Record<string, number> = {};
  rows.forEach((r) => {
    const where = `row ${r.n} (${r.intent || '?'})`;

    if (!['as-is', 'cross-pick', 'compose'].includes(r.mode))
      E(`${where}: mode "${r.mode}" is invalid — must be as-is | cross-pick | compose.`);

    if (r.candidates.length < 2)
      E(
        `${where}: only ${r.candidates.length} candidate(s) — the catalog must be consulted for ≥2 (filter by serves, never by filename).`,
      );
    r.candidates.forEach((cand) => {
      if (!BY_SLUG.has(cand)) E(`${where}: candidate "${cand}" is not a catalog slug.`);
      else if (r.intent && !servesOf(cand).includes(r.intent))
        W(
          `${where}: candidate "${cand}" does not list "${r.intent}" in its serves (${(BY_SLUG.get(cand)?.serves ?? []).join(', ')}) — picked by label, not meta?`,
        );
    });

    const reasonLow = r.reason.toLowerCase();
    if (r.mode === 'compose') {
      if (!/no fragment serves|nothing (whole )?fits|variety|fresh variety/.test(reasonLow))
        E(
          `${where}: compose mode requires the reason to state "no fragment serves this intent" (or a variety justification). Got: "${r.reason}".`,
        );
    } else if (
      !/surface|layout|direction|serves|n-up|bento|grid|stack|accordion|tabs|carousel|marquee|ink|warm|light|gradient/.test(
        reasonLow,
      )
    ) {
      W(`${where}: reason does not visibly cite the meta (surface / layout / direction). Got: "${r.reason}".`);
    } else if (
      // SKILL.md rule (c) nudge (soft): cites generic meta but never says why the chosen
      // component beats its alternates FOR THIS BRIEF — the anti-default-collapse signal.
      !/because|beats|over\b|vs\b|fits this|chosen for|than |rather than|whereas|this brief|this page|not a |best for|when /.test(
        reasonLow,
      ) &&
      !r.candidates.some((cand) => cand.toLowerCase() !== r.chosen && reasonLow.includes(cand.toLowerCase()))
    ) {
      W(
        `${where}: reason cites generic meta but doesn't say why "${r.chosen}" beats its alternates for THIS brief — name the rejected candidate or the brief-specific fit (SKILL.md rule c).`,
      );
    }

    if (r.mode !== 'compose') {
      if (!BY_SLUG.has(r.chosen)) E(`${where}: chosen "${r.chosen}" is not a catalog slug (mode ${r.mode}).`);
      else {
        if (!r.candidates.map((x) => x.toLowerCase()).includes(r.chosen))
          W(`${where}: chosen "${r.chosen}" was not among the listed candidates.`);
        chosenCount[r.chosen] = (chosenCount[r.chosen] || 0) + 1;
      }
    } else if (r.chosen !== 'compose') {
      W(`${where}: compose rows should set chosen = "compose" (got "${r.chosen}").`);
    }
  });

  // 5. donor-reuse rule (rule d)
  Object.entries(chosenCount).forEach(([slug, n]) => {
    if (n > 1) {
      const reuseJustified = rows.some(
        (r) => r.chosen === slug && /reuse|again|same donor|deliberate|justif/.test(r.reason.toLowerCase()),
      );
      if (!reuseJustified)
        E(`donor "${slug}" serves ${n} sections without a reason justifying the reuse (curation rule d).`);
    }
  });

  // 6. structured `limits` (machine-enforced direction; prose heuristic as fallback)
  Object.keys(chosenCount).forEach((slug) => {
    const f = BY_SLUG.get(slug);
    if (!f) return;
    const lim = f.limits || {};
    const dir = (f.direction || '').toLowerCase();
    const proseOne =
      /one .* per page|one per page|use once|once,? max|avoid using twice|avoid .*twice|never .*twice|one orbit per page|one pricing band per page/.test(
        dir,
      );
    const maxPer = typeof lim.maxPerPage === 'number' ? lim.maxPerPage : proseOne ? 1 : null;
    if (maxPer != null && chosenCount[slug] > maxPer)
      E(
        `"${slug}" is used ${chosenCount[slug]}× but its limit is maxPerPage:${maxPer}` +
          `${typeof lim.maxPerPage === 'number' ? '' : ' (from prose)'} ("${f.direction}").`,
      );
    if (typeof lim.minBands === 'number' && rows.length < lim.minBands)
      E(
        `"${slug}" requires a long page (minBands:${lim.minBands}) but this page has only ${rows.length} section(s) — "${f.direction}".`,
      );
  });

  // 7. adjacency: consecutive bands differ in surface OR layout primitive
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const sa = a.surface || firstSurface(a.chosen);
    const sb = b.surface || firstSurface(b.chosen);
    const la = a.mode === 'compose' ? [] : layoutPrims(a.chosen);
    const lb = b.mode === 'compose' ? [] : layoutPrims(b.chosen);
    const sameSurface = sa && sb && sa === sb;
    const sharesLayout = la.length > 0 && lb.length > 0 && la.some((x) => lb.includes(x));
    if (sameSurface && (sharesLayout || !la.length || !lb.length))
      E(
        `adjacent bands row ${a.n} (${a.chosen || a.intent}) and row ${b.n} (${b.chosen || b.intent}) share surface "${sa}"` +
          (sharesLayout
            ? ` and a layout primitive — they must differ in surface OR layout (rule e).`
            : ` and no distinguishing layout — give adjacent bands different surfaces or layouts (rule e).`),
      );
    if (sa === 'ink' && sb === 'ink') {
      const dirA = BY_SLUG.get(a.chosen)?.direction ?? '';
      const dirB = BY_SLUG.get(b.chosen)?.direction ?? '';
      if (/adjacent ink|two adjacent ink/i.test(`${dirA} ${dirB}`))
        E(`rows ${a.n}/${b.n} are two adjacent ink bands, which their direction warns against.`);
    }
    for (const [self, nbr, ss, ns] of [
      [a, b, sa, sb],
      [b, a, sb, sa],
    ] as [CurationRow, CurationRow, string | null, string | null][]) {
      const lim = BY_SLUG.get(self.chosen)?.limits || {};
      if (lim.avoidAdjacent) {
        const nbrServes =
          nbr.mode === 'compose' ? tokens(nbr.intent) : servesOf(nbr.chosen).concat(tokens(nbr.intent));
        if (nbrServes.includes(lim.avoidAdjacent))
          E(
            `row ${self.n} ("${self.chosen}") must not sit next to a "${lim.avoidAdjacent}" band, but row ${nbr.n} (${nbr.chosen || nbr.intent}) serves it (avoidAdjacent).`,
          );
      }
      if (lim.avoidAdjacentSurface && ns && ns === lim.avoidAdjacentSurface && ss === lim.avoidAdjacentSurface)
        E(
          `row ${self.n} ("${self.chosen}") must not sit next to another "${lim.avoidAdjacentSurface}" surface, but row ${nbr.n} (${nbr.chosen || nbr.intent}) is also ${ns} (avoidAdjacentSurface).`,
        );
    }
  }

  // 8. every section accounted for; no raw un-curated markup
  // 8a. fragment present but no as-is/cross-pick row chose it
  const chosenSlugs = new Set(rows.filter((r) => r.mode !== 'compose').map((r) => r.chosen));
  crfPresent.forEach((slug) => {
    if (!chosenSlugs.has(slug))
      E(`fragment data-crf="${slug}" is pasted in the page but no Curation Table row chose it (un-audited section).`);
  });
  // 8b. as-is/cross-pick row chose a slug that is not actually pasted
  rows
    .filter((r) => r.mode !== 'compose' && BY_SLUG.has(r.chosen))
    .forEach((r) => {
      if (!crfSet.has(r.chosen))
        W(`row ${r.n} chose "${r.chosen}" (${r.mode}) but no data-crf="${r.chosen}" wrapper is present — was the fragment pasted?`);
    });
  // 8c. compose rows must each have a data-composed marker
  const composeRows = rows.filter((r) => r.mode === 'compose').length;
  if (composeRows > composedPresent.length)
    E(
      `${composeRows} compose row(s) but only ${composedPresent.length} <div data-composed="…"> section(s) — composed sections must carry the data-composed marker (COMPOSE.md).`,
    );
  // 8d. raw markup outside any fragment / composed wrapper = un-curated slop
  let residue = main.replace(/<!--[\s\S]*?-->/g, '');
  residue = stripWrappers(residue, 'data-crf');
  residue = stripWrappers(residue, 'data-composed');
  residue = residue.replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const orphan = residue.match(/<section\b|<div\b[^>]*\bclass\s*=/i);
  if (orphan)
    E(
      `un-curated markup detected in <main> outside any data-crf / data-composed wrapper (near "${residue
        .slice(Math.max(0, residue.indexOf(orphan[0])), residue.indexOf(orphan[0]) + 40)
        .replace(/\s+/g, ' ')
        .trim()}…"). ` +
        `Every section must be a pulled fragment or a marked composed section — generic hand-authored bands are the AI-slop this gate blocks.`,
    );

  return { errors, warnings, nFrag: crfPresent.length, nComp: composedPresent.length, nRows: rows.length };
}

/**
 * Render the verbatim `validate-page.js` report into `CurationGateReport.raw` (for logs +
 * `parseGateReport` round-trip). Format-identical to the subprocess stdout so existing
 * report-parsing expectations are unchanged.
 */
function renderGateReport(result: EnforceResult, fail: boolean): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('validate-page · in-process');
  lines.push(`  sections: ${result.nFrag} fragment(s) + ${result.nComp} composed · ${result.nRows} curation row(s)`);
  if (result.warnings.length) {
    lines.push('');
    lines.push(`  ⚠ ${result.warnings.length} warning(s):`);
    result.warnings.forEach((w) => lines.push(`    - ${w}`));
  }
  if (result.errors.length) {
    lines.push('');
    lines.push(`  ✗ ${result.errors.length} error(s):`);
    result.errors.forEach((e) => lines.push(`    - ${e}`));
  }
  lines.push('');
  lines.push(`  ${fail ? '✗ FAIL' : '✓ PASS'} — curation ${fail ? 'NOT enforced' : 'verified'} against the catalog.`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Parse validate-page.js stdout into error + warning lists. The report prints:
 *
 *   ⚠ N warning(s):
 *     - <warning>
 *   ✗ N error(s):
 *     - <error>
 *   ✗ FAIL — curation NOT enforced …
 *
 * We track the current block (warn / error) and collect the `    - …` bullet lines,
 * stopping a block at the PASS/FAIL summary line. Tolerant of either block being absent.
 */
export function parseGateReport(raw: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let mode: 'errors' | 'warnings' | null = null;
  for (const line of raw.split('\n')) {
    if (/^\s*⚠\s+\d+\s+warning/.test(line)) {
      mode = 'warnings';
      continue;
    }
    if (/^\s*✗\s+\d+\s+error/.test(line)) {
      mode = 'errors';
      continue;
    }
    // The PASS/FAIL summary closes any open block.
    if (/^\s*(✓ PASS|✗ FAIL)\b/.test(line)) {
      mode = null;
      continue;
    }
    const bullet = line.match(/^\s+-\s+(.*\S)\s*$/);
    if (bullet && mode) {
      (mode === 'errors' ? errors : warnings).push(bullet[1]);
    }
  }
  return { errors, warnings };
}

/**
 * Classify a gate error into its remediation route (AP4.4).
 *
 * SELECTION errors are about WHICH fragment was chosen / how the table was filled — fix
 * by re-curating (P1 candidate selection / P2 table). PROVENANCE errors are about raw
 * un-curated markup or missing markers — fix by re-editing the pasted band (P3).
 */
export function classifyGateError(msg: string): GateRoute {
  const m = msg.toLowerCase();
  // Provenance / anti-slop → re-edit (the markup is wrong, not the pick).
  if (
    /un-curated markup|un-audited section|data-composed|is pasted in the page but no curation table row|no data-crf=/.test(
      m,
    )
  ) {
    return 're-edit';
  }
  // Everything else (candidate count, not-a-slug, donor reuse, limit, adjacency, mode)
  // is a SELECTION problem → re-curate.
  return 're-curate';
}

/**
 * Translate gate ERRORS into routable Offscript findings.
 *
 * The id embeds the offending section's anchor id so reauthor-loop's `mapFindingsToItems`
 * routes the finding to that item (`curation-gate:<anchorId>`); an adjacency error that
 * names two rows routes to BOTH via the `<a>-><b>` segment convention `mapFindingsToItems`
 * already understands. When no section can be resolved (e.g. document-wide un-curated
 * markup), the id is `curation-gate:document` (document-global — counts toward the gate
 * block but maps to no single item, like the other document-global findings).
 *
 * Findings carry `outcome: 'warning'` — they do NOT freeze and do NOT score; the BLOCK is
 * the separate `gate.pass` flag (see foldCurationGate / goalMet). The route is prefixed
 * into the description so a re-author / operator sees where to fix it.
 */
export function gateFindings(report: CurationGateReport, plan: AuthoringPlan): Finding[] {
  const slugToAnchor = new Map<string, string>();
  const intentToAnchor = new Map<string, string>();
  for (const item of plan.items) {
    if (item.fragmentId) slugToAnchor.set(item.fragmentId, item.anchor.id);
    if (item.intent && !intentToAnchor.has(item.intent)) intentToAnchor.set(item.intent, item.anchor.id);
  }

  return report.errors.map((msg, i) => {
    const anchors = resolveAnchors(msg, slugToAnchor, intentToAnchor);
    const site = anchors.length ? anchors.join('->') : 'document';
    const route = classifyGateError(msg);
    return {
      id: `${CURATION_GATE_RAIL}:${site}:${i}`,
      description: `[${route}] curation gate: ${msg}`,
      outcome: 'warning' as const,
    };
  });
}

/**
 * Extract the Offscript anchor ids an error refers to. Looks for `data-crf="slug"`, bare
 * quoted catalog slugs, and `row N (intent)` references, mapping each known slug/intent
 * to its anchor id via the plan. De-duplicated, order-preserving. May be empty
 * (document-global error).
 */
function resolveAnchors(
  msg: string,
  slugToAnchor: Map<string, string>,
  intentToAnchor: Map<string, string>,
): string[] {
  const found: string[] = [];
  const add = (anchor: string | undefined): void => {
    if (anchor && !found.includes(anchor)) found.push(anchor);
  };
  // data-crf="slug" and any bare "quoted" token that is a known slug.
  for (const m of msg.matchAll(/data-crf="([^"]+)"/g)) add(slugToAnchor.get(m[1]));
  for (const m of msg.matchAll(/"([^"]+)"/g)) add(slugToAnchor.get(m[1]));
  // row N (intent) — the intent is in parens; map by intent when it's a known one.
  for (const m of msg.matchAll(/row\s+\d+\s+\(([^)]+)\)/g)) add(intentToAnchor.get(m[1].trim()));
  return found;
}

/**
 * Fold a gate report into a base ValidateOutcome: append the gate findings to perRail
 * (synthetic rail, for routing only) and attach `gate`. Returns a NEW outcome (does not
 * mutate the base). The systematic-ratio in `score` is untouched — the gate is a binary
 * curation axis, not a ratio input; the block is `gate.pass`, read by goalMet.
 */
export function foldCurationGate(
  base: ValidateOutcome,
  report: CurationGateReport,
  plan: AuthoringPlan,
): ValidateOutcome {
  const findings = gateFindings(report, plan);
  const gateRail: PerRailEntry = {
    operator: { name: CURATION_GATE_RAIL, tier: 1, detect: () => [], apply: () => [] },
    findings,
  };
  return {
    ...base,
    perRail: [...base.perRail, gateRail],
    gate: {
      pass: report.pass,
      errorCount: report.errors.length,
      warningCount: report.warnings.length,
    },
  };
}

/** The soft cross-build rotation advisory (AP4.3) — parsed nudges + the verbatim report. */
export interface DiversityAdvisory {
  /** the `⚠ N diversity nudge(s)` lines, if any (soft — never blocks). */
  nudges: string[];
  /** full stdout (the rotation REPORT to surface in logs / write to disk). */
  raw: string;
}

/**
 * Run `selection-diversity.js <page>` (CHECK mode) over an HTML string. This is SOFT by
 * design — it always exits 0 and never fails a page; it only reports which component
 * filled each intent slot across recent pages so equally-fitting picks can rotate. It
 * compares against the pages in `catalog/pages/` (gitignored — usually empty on a fresh
 * checkout, in which case it simply reports "no built pages", which is fine).
 */
export function runSelectionDiversity(html: string): DiversityAdvisory {
  const dir = mkdtempSync(join(tmpdir(), 'offscript-diversity-'));
  try {
    const page = join(dir, 'page.html');
    writeFileSync(page, html, 'utf8');
    const tool = join(catalogToolsDir(), 'selection-diversity.js');
    let raw = '';
    try {
      raw = execFileSync('node', [tool, page], { encoding: 'utf8' });
    } catch (e) {
      // selection-diversity exits 0 always; if node itself fails, degrade to no advisory.
      const err = e as { stdout?: string; stderr?: string };
      raw = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
    const nudges: string[] = [];
    let inNudges = false;
    for (const line of raw.split('\n')) {
      if (/diversity nudge\(s\)/.test(line)) {
        inNudges = true;
        continue;
      }
      const bullet = line.match(/^\s+-\s+(.*\S)\s*$/);
      if (bullet && inNudges) nudges.push(bullet[1]);
    }
    return { nudges, raw };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
