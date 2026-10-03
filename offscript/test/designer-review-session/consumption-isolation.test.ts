/**
 * P20 — Designer Review Session Consumption: the isolation half of the
 * sprint. "Session exists. Session references. Session affects nothing."
 * Like Workspace (P19), NOTHING in the runtime is wired to consume
 * `designer-review-session/` this sprint: EXPECTED_DESIGNER_REVIEW_SESSION_CONSUMERS
 * is deliberately EMPTY.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));
const SCRIPTS_ROOT = fileURLToPath(new URL('../../scripts', import.meta.url));

const EXPECTED_DESIGNER_REVIEW_SESSION_CONSUMERS: string[] = [];

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

describe('P20 — repo-wide designer-review-session importer whitelist', () => {
  it('NO file outside src/designer-review-session/ imports from it — Session has zero production consumers this sprint', () => {
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter((f) => {
      const rel = relative(REPO_ROOT, f).replace(/\\/g, '/');
      return !rel.startsWith('src/designer-review-session/');
    });
    const actualConsumers: string[] = [];
    for (const file of candidates) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"](?:\.\.?\/)*designer-review-session\//.test(text)) {
        actualConsumers.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(actualConsumers.sort()).toEqual([...EXPECTED_DESIGNER_REVIEW_SESSION_CONSUMERS].sort());
  });

  it('designer-workspace.ts does not import from designer-review-session (Session references Workspace, never the reverse)', () => {
    const text = readFileSync(join(SRC_ROOT, 'designer-workspace', 'designer-workspace.ts'), 'utf8');
    expect(text).not.toMatch(/designer-review-session/);
  });

  it('doctor/review-package.ts does not import from designer-review-session', () => {
    const text = readFileSync(join(SRC_ROOT, 'doctor', 'review-package.ts'), 'utf8');
    expect(text).not.toMatch(/designer-review-session/);
  });

  it('the planner (generate/plan.ts) imports nothing from designer-review-session', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'plan.ts'), 'utf8');
    expect(text).not.toMatch(/designer-review-session/);
  });

  it('none of the selector modules import from designer-review-session', () => {
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
      expect(text, `${rel} must not import designer-review-session`).not.toMatch(/designer-review-session/);
    }
  });

  it('the catalog gate does not import from designer-review-session', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'catalog-gate.ts'), 'utf8');
    expect(text).not.toMatch(/designer-review-session/);
  });

  it('generation and validation modules do not import from designer-review-session', () => {
    for (const rel of ['generate/author.ts', 'generate/authoring-seam.ts', 'generate/validate.ts', 'generate/reauthor-loop.ts']) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text, `${rel} must not import designer-review-session`).not.toMatch(/designer-review-session/);
    }
  });

  it('overlay.ts does not import from designer-review-session', () => {
    const text = readFileSync(join(SRC_ROOT, 'overlay.ts'), 'utf8');
    expect(text).not.toMatch(/designer-review-session/);
  });

  it('the production driver (validate-loop-driver.ts) is untouched — no designer-review-session import', () => {
    const text = readFileSync(join(SRC_ROOT, 'generate', 'validate-loop-driver.ts'), 'utf8');
    expect(text).not.toMatch(/designer-review-session/);
  });

  it('designer-author/ and designer-feedback/ do not import from designer-review-session (dependency flows one way: Session -> them, never back)', () => {
    for (const subdir of ['designer-author', 'designer-feedback']) {
      const files = collectTsFiles(join(SRC_ROOT, subdir));
      for (const f of files) {
        const text = readFileSync(f, 'utf8');
        expect(text, `${relative(REPO_ROOT, f)} must not import designer-review-session`).not.toMatch(/designer-review-session/);
      }
    }
  });
});
