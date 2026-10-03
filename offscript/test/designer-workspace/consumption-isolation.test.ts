/**
 * P19 — Designer Workspace Consumption: the isolation half of the sprint.
 *
 * "Workspace exists. Workspace organizes references. Workspace affects
 * nothing." Unlike P10/P18 (which each grew a sanctioned consumer —
 * doctor/review-package.ts), NOTHING in the runtime is wired to consume
 * `designer-workspace/` this sprint: EXPECTED_DESIGNER_WORKSPACE_CONSUMERS
 * is deliberately EMPTY. Workspace itself is the top of the aggregation
 * chain (it references ReviewPackage/ProposalPackage/ProposalReviewReport/
 * FeedbackPackage) — nothing downstream reads it back.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));
const SCRIPTS_ROOT = fileURLToPath(new URL('../../scripts', import.meta.url));

const EXPECTED_DESIGNER_WORKSPACE_CONSUMERS: string[] = [
  // P20: type-only DesignerWorkspace/WorkspaceReviewProgress reference so a Session can
  // index its referenced Workspace by {kind, id, sha256} and copy its progress as a
  // checkpoint, without duplicating its content — see designer-review-session.ts's own
  // isolation test proving every import is type-only.
  'src/designer-review-session/designer-review-session.ts',
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('P19 — repo-wide designer-workspace importer whitelist', () => {
  it('NO file outside src/designer-workspace/ imports from it — Workspace has zero production consumers this sprint', () => {
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter((f) => {
      const rel = relative(REPO_ROOT, f).replace(/\\/g, '/');
      return !rel.startsWith('src/designer-workspace/');
    });
    const actualConsumers: string[] = [];
    for (const file of candidates) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"](?:\.\.?\/)*designer-workspace\//.test(text)) {
        actualConsumers.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(actualConsumers.sort()).toEqual([...EXPECTED_DESIGNER_WORKSPACE_CONSUMERS].sort());
  });

  it('doctor/review-package.ts does not import from designer-workspace (Workspace references it, never the reverse)', () => {
    const text = readFileSync(join(SRC_ROOT, 'doctor', 'review-package.ts'), 'utf8');
    expect(text).not.toMatch(/designer-workspace/);
  });

  it('the planner (generate/plan.ts) imports nothing from designer-workspace', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'plan.ts'), 'utf8');
    expect(text).not.toMatch(/designer-workspace/);
  });

  it('none of the selector modules import from designer-workspace', () => {
    const selectorFiles = [
      'generate/catalog.ts',
      'generate/website-composition.ts',
      'generate/selection-policy.ts',
      'generate/semantic-selection.ts',
      'generate/family-selection.ts',
      'generate/website-selection-signal.ts',
    ];
    for (const rel of selectorFiles) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text, `${rel} must not import designer-workspace`).not.toMatch(/designer-workspace/);
    }
  });

  it('the catalog gate does not import from designer-workspace', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'catalog-gate.ts'), 'utf8');
    expect(text).not.toMatch(/designer-workspace/);
  });

  it('generation and validation modules do not import from designer-workspace', () => {
    for (const rel of ['generate/author.ts', 'generate/authoring-seam.ts', 'generate/validate.ts', 'generate/reauthor-loop.ts']) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text, `${rel} must not import designer-workspace`).not.toMatch(/designer-workspace/);
    }
  });

  it('overlay.ts does not import from designer-workspace', () => {
    const text = readFileSync(join(SRC_ROOT, 'overlay.ts'), 'utf8');
    expect(text).not.toMatch(/designer-workspace/);
  });

  it('the production driver (validate-loop-driver.ts) is untouched — no designer-workspace import', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'validate-loop-driver.ts'), 'utf8');
    expect(text).not.toMatch(/designer-workspace/);
  });

  it('designer-author/ and designer-feedback/ do not import from designer-workspace (dependency flows one way: Workspace -> them, never back)', () => {
    for (const subdir of ['designer-author', 'designer-feedback']) {
      const files = collectTsFiles(join(SRC_ROOT, subdir));
      for (const f of files) {
        const text = readFileSync(f, 'utf8');
        expect(text, `${relative(REPO_ROOT, f)} must not import designer-workspace`).not.toMatch(/designer-workspace/);
      }
    }
  });
});
