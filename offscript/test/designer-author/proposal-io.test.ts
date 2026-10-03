/**
 * P09 — Designer Author Foundation: proposal-io.ts persistence + the isolation
 * falsification suite. RED-first.
 *
 * The isolation tests are the sprint's core safety claim: an AuthorProposal
 * that names a REAL canonical component as its parent, and is packaged +
 * written to disk, must leave that real canonical file byte-for-byte
 * untouched. This is proven against the actual repository content, not a
 * fixture double — the same style of direct on-disk verification P08 used to
 * confirm review-package.json's recorded hashes matched the real files.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../../src/designer-author/proposal.js';
import { buildProposalPackage } from '../../src/designer-author/proposal-package.js';
import { readProposalPackage, writeProposalPackage } from '../../src/designer-author/proposal-io.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const REAL_CANONICAL_FILE = path.join(repoRoot, 'repository', 'canonical', 'hero-bento', 'component.md');

function sampleProposal(overrides: Partial<Parameters<typeof buildAuthorProposal>[0]> = {}) {
  return buildAuthorProposal({
    kind: 'section',
    origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
    semanticFamily: 'family-hero',
    content: '<section data-crf="proposed-hero">draft content</section>',
    ...overrides,
  });
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-author-proposal-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeProposalPackage / readProposalPackage', () => {
  it('round-trips a package through disk as deep-equal JSON', () => {
    const pkg = buildProposalPackage({ proposal: sampleProposal() });
    const filePath = path.join(tmpDir, 'proposal-package.json');
    writeProposalPackage(filePath, pkg);
    const readBack = readProposalPackage(filePath);
    expect(readBack).toEqual(pkg);
  });

  it('writes stable, sorted-key, 2-space JSON with a trailing newline', () => {
    const pkg = buildProposalPackage({ proposal: sampleProposal() });
    const filePath = path.join(tmpDir, 'proposal-package.json');
    writeProposalPackage(filePath, pkg);
    const raw = fs.readFileSync(filePath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toBe(JSON.stringify(JSON.parse(raw), null, 2) + '\n');
  });

  it('is idempotent: writing identical content twice does not change the file', () => {
    const pkg = buildProposalPackage({ proposal: sampleProposal() });
    const filePath = path.join(tmpDir, 'proposal-package.json');
    writeProposalPackage(filePath, pkg);
    const firstMtime = fs.statSync(filePath).mtimeMs;
    writeProposalPackage(filePath, pkg);
    const secondMtime = fs.statSync(filePath).mtimeMs;
    expect(secondMtime).toBe(firstMtime);
  });

  it('readProposalPackage returns undefined for a missing file', () => {
    expect(readProposalPackage(path.join(tmpDir, 'nope.json'))).toBeUndefined();
  });

  it('readProposalPackage returns undefined for malformed JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, '{ not valid json', 'utf8');
    expect(readProposalPackage(filePath)).toBeUndefined();
  });
});

describe('isolation falsification: packaging and writing a proposal cannot mutate canonical knowledge', () => {
  it('a real canonical component file is byte-identical before and after a colliding proposal is written', () => {
    expect(fs.existsSync(REAL_CANONICAL_FILE)).toBe(true);
    const before = readFileSync(REAL_CANONICAL_FILE, 'utf8');
    const beforeHash = createHash('sha256').update(before).digest('hex');

    // A proposal that deliberately names the real component as its parent and
    // proposes replacement content for it — the worst-case adversarial input.
    const proposal = sampleProposal({
      parentComponent: 'canonical::hero-bento',
      content: '<section data-crf="hero-bento">REPLACEMENT CONTENT — this must never reach the real file</section>',
    });
    const pkg = buildProposalPackage({ proposal });
    writeProposalPackage(path.join(tmpDir, 'proposal-package.json'), pkg);

    const after = readFileSync(REAL_CANONICAL_FILE, 'utf8');
    const afterHash = createHash('sha256').update(after).digest('hex');
    expect(after).toBe(before);
    expect(afterHash).toBe(beforeHash);
  });

  it('writing a proposal package creates exactly the one file requested — no other files or directories appear', () => {
    const before = fs.readdirSync(tmpDir);
    expect(before).toEqual([]);
    writeProposalPackage(path.join(tmpDir, 'proposal-package.json'), buildProposalPackage({ proposal: sampleProposal() }));
    const after = fs.readdirSync(tmpDir);
    expect(after).toEqual(['proposal-package.json']);
  });

  it('structural: proposal-io.ts imports nothing from catalog, repository helpers, or knowledge/', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const src = readFileSync(here + '../../src/designer-author/proposal-io.ts', 'utf8');
    const importLines = src.match(/^import .+$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/catalog/i);
      expect(line).not.toMatch(/repository/i);
      expect(line).not.toMatch(/knowledge\//);
    }
  });

  it('structural: no file under src/designer-author/ references a repository/canonical write path', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const dir = here + '../../src/designer-author/';
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.ts')) continue;
      const src = readFileSync(dir + name, 'utf8');
      expect(src).not.toMatch(/repository[\\/]canonical/);
    }
  });
});
