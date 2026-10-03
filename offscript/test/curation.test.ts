/**
 * Path C / P2 — the Curation Table emitter + reason scaffold.
 *
 * Covers AP2.2 (serializeCurationTable / Comment), AP2.4 (buildReason), and the
 * non-circular proof: the emitted table + chosen fragments PASS the REAL v2 gate
 * (catalog/tools/validate-page.js) — the same gate the design team rejected the old
 * author-from-scratch output against.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import {
  buildReason,
  serializeCurationTable,
  serializeCurationComment,
} from '../src/generate/curation.js';
import { loadFragmentCatalog, type FragmentEntry } from '../src/generate/catalog.js';
import type { PlanItem } from '../src/generate/types.js';
import { catalogToolsDir, catalogShellPath } from '../src/paths.js';

// RETIRED: Path-C catalog is dormant and absent on disk — guard the module-scope load so the skipped suite still imports.
let CATALOG: FragmentEntry[] = [];
try {
  CATALOG = loadFragmentCatalog();
} catch {
  /* dormant catalog: suite is skipped */
}
const bySlug = new Map(CATALOG.map((f) => [f.slug, f]));

/** A minimal curated website PlanItem for a given chosen slug + candidate set. */
function curatedItem(archetype: string, chosen: string, candidates: string[]): PlanItem {
  return {
    anchor: { id: chosen, anchor: chosen },
    archetype,
    tokenRoles: [],
    intent: archetype,
    fragmentId: chosen,
    candidates,
  };
}

// RETIRED: website pivoted to author-from-governance; the Path-C catalog is dormant (see docs/internals/OFFSCRIPT-WEBSITE-STACK-INGESTION-PLAN.md P3).
describe.skip('curation — buildReason (AP2.4)', () => {
  const chosen = bySlug.get('hero-actions') as FragmentEntry;
  const candidates = CATALOG.filter((f) => f.cat === 'section' && f.serves.includes('hero')).slice(0, 3);

  it('cites the chosen fragment surface + layout meta', () => {
    const r = buildReason(chosen, candidates, 'hero').toLowerCase();
    expect(r).toContain('surface');
    expect(r).toContain('layout');
  });

  it('names a rejected candidate with "chosen over …" (dodges the rule-c warning)', () => {
    const rejected = candidates.find((c) => c.slug !== chosen.slug)!;
    const r = buildReason(chosen, candidates, 'hero');
    expect(r).toContain('over');
    expect(r).toContain(rejected.slug);
  });

  it('appends a rule-d reuse justification when reuse=true', () => {
    const r = buildReason(chosen, candidates, 'hero', true).toLowerCase();
    expect(r).toContain('reuse');
    expect(r).toContain('deliberate');
  });

  it('never contains a pipe (would break the markdown table columns)', () => {
    expect(buildReason(chosen, candidates, 'hero', true)).not.toContain('|');
  });
});

describe.skip('curation — serializeCurationTable (AP2.2)', () => {
  const items = [
    curatedItem('hero', 'hero-actions', ['hero-actions', 'hero-bento']),
    curatedItem('footer', 'footer-dark', ['footer-dark', 'footer-cta']),
  ];

  it('emits the exact header + separator the _curation.js parser expects', () => {
    const lines = serializeCurationTable(items, CATALOG).split('\n');
    expect(lines[0]).toBe('| intent | surface | candidates | chosen | mode | reason |');
    expect(lines[1]).toBe('| --- | --- | --- | --- | --- | --- |');
  });

  it('one data row per curated item, with chosen ∈ candidates and mode as-is', () => {
    const rows = serializeCurationTable(items, CATALOG).split('\n').slice(2);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const cells = row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [, , candidates, chosen, mode] = cells;
      expect(mode).toBe('as-is');
      expect(candidates.split(',').map((c) => c.trim())).toContain(chosen);
    }
  });

  it('skips items without a fragmentId (collateral / non-website)', () => {
    const mixed: PlanItem[] = [
      ...items,
      { anchor: { id: 'cover', anchor: 'cover' }, archetype: 'CoverPage', tokenRoles: [], intent: 'cover' },
    ];
    const rows = serializeCurationTable(mixed, CATALOG).split('\n').slice(2);
    expect(rows).toHaveLength(2); // CoverPage row not emitted
  });

  it('PlanItem.reason (the designer-brain seam) overrides the scaffold', () => {
    const withReason: PlanItem = { ...items[0], reason: 'bespoke surface rationale for this brief' };
    const table = serializeCurationTable([withReason], CATALOG);
    expect(table).toContain('bespoke surface rationale for this brief');
  });
});

describe.skip('curation — serializeCurationComment', () => {
  it('wraps the table in a single HTML comment (the block P3 lifts into <main>)', () => {
    const items = [curatedItem('hero', 'hero-actions', ['hero-actions', 'hero-bento'])];
    const comment = serializeCurationComment(items, CATALOG);
    expect(comment.startsWith('<!--')).toBe(true);
    expect(comment.endsWith('-->')).toBe(true);
    expect(comment).toContain('| intent | surface |');
  });

  it('returns empty string when no band is curated', () => {
    const collateralish: PlanItem[] = [
      { anchor: { id: 'cover', anchor: 'cover' }, archetype: 'CoverPage', tokenRoles: [], intent: 'cover' },
    ];
    expect(serializeCurationComment(collateralish, CATALOG)).toBe('');
  });
});

// ── The non-circular proof: emitted table PASSES the real v2 gate ─────────────

/** Assemble a synthetic built page = the catalog _shell.html with the Curation Table
 *  comment + one empty `data-crf` wrapper per chosen fragment pasted into <main>.
 *  (validate-page checks the table + that each chosen slug has a wrapper present; it
 *  never fetches fragment bodies, so empty wrappers exercise the curation gate exactly.) */
function assembleSyntheticPage(items: PlanItem[]): string {
  const comment = serializeCurationComment(items);
  const wrappers = items
    .filter((i) => i.fragmentId)
    .map((i) => `<div data-crf="${i.fragmentId}"></div>`)
    .join('\n');
  const shell = readFileSync(catalogShellPath(), 'utf8');
  return shell.replace(
    '<!-- ▼ paste fragments here, in band order ▼ -->',
    `${comment}\n${wrappers}`,
  );
}

/** Run the real catalog/tools/validate-page.js on an HTML string → exit code + output. */
function runValidatePage(html: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vp-'));
  try {
    const page = join(dir, 'page.html');
    writeFileSync(page, html, 'utf8');
    const validate = join(catalogToolsDir(), 'validate-page.js');
    try {
      const out = execFileSync('node', [validate, page], { encoding: 'utf8' });
      return { code: 0, out };
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skip('curation — emitted table PASSES the real v2 gate (validate-page.js)', () => {
  it('the real example-brand plan assembles a page that validate-page accepts (exit 0)', () => {
    const p = plan(buildContext('example-brand', 'website'));
    const { code, out } = runValidatePage(assembleSyntheticPage(p.items));
    expect(code, out).toBe(0);
  });

  it('--warn-as-error: the example-brand table is warning-clean too (no soft rule-c/meta nags)', () => {
    const p = plan(buildContext('example-brand', 'website'));
    const comment = serializeCurationComment(p.items);
    const wrappers = p.items
      .filter((i) => i.fragmentId)
      .map((i) => `<div data-crf="${i.fragmentId}"></div>`)
      .join('\n');
    const shell = readFileSync(catalogShellPath(), 'utf8');
    const html = shell.replace('<!-- ▼ paste fragments here, in band order ▼ -->', `${comment}\n${wrappers}`);
    const dir = mkdtempSync(join(tmpdir(), 'vp-'));
    try {
      const page = join(dir, 'page.html');
      writeFileSync(page, html, 'utf8');
      const validate = join(catalogToolsDir(), 'validate-page.js');
      let code = 0;
      let out = '';
      try {
        out = execFileSync('node', [validate, page, '--warn-as-error'], { encoding: 'utf8' });
      } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        code = err.status ?? 1;
        out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      }
      expect(code, out).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
