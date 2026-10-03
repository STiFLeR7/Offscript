/**
 * Sprint W20 — Semantic Author Context (RED-first).
 *
 * Transport-only: the website Author REQUEST gains a `## Component Knowledge` block carrying the
 * component's Purpose / Character / Contract / Judgement sections VERBATIM (from W18). Nothing
 * consumes it. Choose-when / Avoid-when / Composition are NOT surfaced (they belong to W19).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSemanticBody } from '../../src/knowledge/semantic-body.js';
import {
  SURFACED_AUTHOR_SECTIONS,
  extractComponentKnowledge,
  createComponentKnowledgeProvider,
} from '../../src/generate/semantic-author-context.js';
import { createSubagentAuthor } from '../../src/generate/authoring-seam.js';
import type { PlanItem } from '../../src/generate/types.js';

function fullBody(): string {
  return [
    '# demo',
    '',
    'lede.',
    '',
    '## Purpose',
    'Why it exists.',
    '',
    '## Choose when',
    'when X.',
    '',
    '## Avoid when',
    'when Y.',
    '',
    '## Character',
    '- minimal',
    '- decisive',
    '',
    '## Composition',
    'follows hero.',
    '',
    '## Contract',
    'assumes Z.',
    '',
    '## Judgement',
    'fails when W.',
    '',
  ].join('\n');
}

function writeComponent(root: string, slug: string, body: string): void {
  const dir = join(root, 'canonical', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'component.md'), `---\nkind: component\n---\n\n${body}`, 'utf8');
}

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), 'w20-'));
}

describe('W20 — extractComponentKnowledge surfaces only the four', () => {
  it('keeps Purpose/Character/Contract/Judgement (authored order); drops Choose/Avoid/Composition', () => {
    const k = parseSemanticBody(fullBody(), 'demo');
    const ck = extractComponentKnowledge({ ...k, sourceFile: 'demo' });
    expect(ck.sections.map((s) => s.name)).toEqual([...SURFACED_AUTHOR_SECTIONS]);
    expect(ck.sections.map((s) => s.name)).toEqual(['Purpose', 'Character', 'Contract', 'Judgement']);
  });

  it('preserves section markdown verbatim (no summarize / rewrite)', () => {
    const k = parseSemanticBody(fullBody(), 'demo');
    const ck = extractComponentKnowledge({ ...k, sourceFile: 'demo' });
    expect(ck.sections.find((s) => s.name === 'Character')!.markdown).toBe('- minimal\n- decisive');
    expect(ck.digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W20 — provider over a repository root', () => {
  it('loads a valid component, returns null for a non-template body, fails loud on malformed', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'alpha', fullBody());
      writeComponent(root, 'plain', '# plain\n\nA one-line descriptor.\n'); // no ## sections
      writeComponent(root, 'broken', '# broken\n\nlede\n\n## Purpose\n\nonly one section.\n'); // partial template
      const p = createComponentKnowledgeProvider(root);

      expect(p.knowledgeFor('alpha')!.sections.map((s) => s.name)).toEqual([...SURFACED_AUTHOR_SECTIONS]);
      expect(p.knowledgeFor('plain')).toBeNull();         // missing body → no opinion
      expect(p.knowledgeFor('absent')).toBeNull();        // no such component
      expect(() => p.knowledgeFor('broken')).toThrow(/missing/i); // invalid body → fail loud
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('multiple components are transported independently', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'a', fullBody().replace('Why it exists.', 'Purpose of A.'));
      writeComponent(root, 'b', fullBody().replace('Why it exists.', 'Purpose of B.'));
      const p = createComponentKnowledgeProvider(root);
      expect(p.knowledgeFor('a')!.sections[0].markdown).toBe('Purpose of A.');
      expect(p.knowledgeFor('b')!.sections[0].markdown).toBe('Purpose of B.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('digest replay: same slug returns the identical cached object; digest stable', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'a', fullBody());
      const p = createComponentKnowledgeProvider(root);
      const first = p.knowledgeFor('a');
      const second = p.knowledgeFor('a');
      expect(first).toBe(second);          // cache replay
      expect(first!.digest).toBe(second!.digest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('W20 — author request transport (## Component Knowledge)', () => {
  function item(ck?: PlanItem['componentKnowledge']): PlanItem {
    return {
      anchor: { id: 'hero', anchor: 'hero' },
      archetype: 'hero',
      tokenRoles: [],
      intent: 'the hero',
      ...(ck ? { componentKnowledge: ck } : {}),
    };
  }

  it('renders the block verbatim when componentKnowledge is present', async () => {
    const root = tmpRoot();
    const dispatchDir = mkdtempSync(join(tmpdir(), 'w20-dispatch-'));
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<section/>' });
      await author.author({ item: item(ck), guidance: '', oneLiner: 'one', tone: 'confident' });
      const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
      expect(md).toContain('## Component Knowledge');
      expect(md).toContain('### Purpose');
      expect(md).toContain('### Character');
      expect(md).toContain('### Contract');
      expect(md).toContain('### Judgement');
      expect(md).toContain('- minimal\n- decisive');     // verbatim markdown
      expect(md).not.toContain('### Choose when');        // NOT surfaced
      expect(md).not.toContain('### Composition');        // NOT surfaced
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(dispatchDir, { recursive: true, force: true });
    }
  });

  it('disabled mode: no componentKnowledge ⇒ no block in the request', async () => {
    const dispatchDir = mkdtempSync(join(tmpdir(), 'w20-dispatch-'));
    try {
      const author = createSubagentAuthor({ dispatchDir, dispatch: async () => '<section/>' });
      await author.author({ item: item(undefined), guidance: '', oneLiner: 'one', tone: 'confident' });
      const md = readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
      expect(md).not.toContain('## Component Knowledge');
    } finally {
      rmSync(dispatchDir, { recursive: true, force: true });
    }
  });
});
