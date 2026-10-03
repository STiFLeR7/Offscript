/**
 * PKG — Repository Builder: discovery completeness is a precondition (C1).
 *
 * Behavior, not implementation: an absent partition root is a valid (empty) repo;
 * any other filesystem fault during discovery must fail loudly so authored content
 * can never silently disappear.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverPackages } from '../../src/knowledge/source/scan.js';
import { KnowledgeError } from '../../src/knowledge/finding.js';

const temps: string[] = [];
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

function freshRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'kb-scan-'));
  temps.push(root);
  return root;
}

describe('discoverPackages — completeness precondition (C1)', () => {
  it('treats an absent partition root as an empty repository (no error)', () => {
    expect(discoverPackages(freshRoot())).toEqual([]);
  });

  it('fails loudly when a partition path is unreadable (exists but not a directory)', () => {
    const root = freshRoot();
    // A file where the `canonical/` partition directory is expected → ENOTDIR, not ENOENT.
    writeFileSync(join(root, 'canonical'), 'not a directory', 'utf8');
    expect(() => discoverPackages(root)).toThrow(KnowledgeError);
  });

  it('still discovers a well-formed package when partitions are present', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'canonical', 'button'), { recursive: true });
    writeFileSync(join(root, 'canonical', 'button', 'component.yaml'), 'kind: component\n', 'utf8');
    const handles = discoverPackages(root);
    expect(handles).toHaveLength(1);
    expect(handles[0].location).toBe('canonical/button/component.yaml');
  });
});
