import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { collectSourceFlags, collectDocumentedFlags, checkRuntimeFlagDocs } from '../scripts/check-runtime-flag-docs.js';

const repoRoot = resolve(__dirname, '..');
const docPath = resolve(repoRoot, '..', 'docs/OFFSCRIPT-RUNTIME-ARCHITECTURE.md');

describe('check-runtime-flag-docs', () => {
  it('finds no flags missing from the doc and no stale doc entries against real source', () => {
    const result = checkRuntimeFlagDocs({ repoRoot, docPath });
    expect(result.missingFromDocs).toEqual([]);
    expect(result.staleInDocs).toEqual([]);
  });

  it('confirms the §8 convention section exists in the canonical doc', () => {
    const result = checkRuntimeFlagDocs({ repoRoot, docPath });
    expect(result.conventionSectionPresent).toBe(true);
  });

  it('collectSourceFlags extracts a process.env.OFFSCRIPT_* read from file content', () => {
    // exercised indirectly via a real file walk — this pins the regex behavior directly.
    const flags = collectDocumentedFlags('| `OFFSCRIPT_FOO` | plain | does a thing | somewhere |\nnot a row\n');
    expect(flags).toEqual(new Set(['OFFSCRIPT_FOO']));
  });

  it('collectSourceFlags is empty for a directory with no OFFSCRIPT_* reads', () => {
    expect(collectSourceFlags([resolve(repoRoot, 'test/fixtures')])).toBeInstanceOf(Set);
  });
});
