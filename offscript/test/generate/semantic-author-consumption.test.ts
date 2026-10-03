/**
 * Sprint W21 — Semantic Author Consumption (RED-first).
 *
 * W20 transported a component's authored Purpose / Character / Contract / Judgement into the subagent
 * author REQUEST (`## Component Knowledge`), verbatim — but nothing consumed it. W21 makes the
 * in-session subagent author the FIRST CONSUMER: when consumption is enabled, the request gains a
 * `## How to use Component Knowledge` DIRECTIVE telling the author to realize that knowledge into
 * copy (headline / subheading / proof / CTA / tone) as GUIDANCE — never copied, quoted, or echoed.
 *
 * Invariants asserted here:
 *   - the scripted author is UNAFFECTED (it never renders a request);
 *   - consumption is OPT-IN (`consumeComponentKnowledge`); default OFF ⇒ request byte-identical to W20;
 *   - the W20 TRANSPORT block (`## Component Knowledge`) is byte-identical whether consume is on or off;
 *   - the directive appears only when knowledge is actually present AND consumption is enabled;
 *   - the upstream provider still fails loud on malformed bodies / digest mismatch (nothing to consume).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createComponentKnowledgeProvider,
} from '../../src/generate/semantic-author-context.js';
import {
  createSubagentAuthor,
  defaultScriptedAuthor,
} from '../../src/generate/authoring-seam.js';
import { resolveGovernedActivation } from '../../src/generate/governed-activation.js';
import type { PlanItem } from '../../src/generate/types.js';

const DIRECTIVE_HEADING = '## How to use Component Knowledge';
const TRANSPORT_HEADING = '## Component Knowledge';

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
  return mkdtempSync(join(tmpdir(), 'w21-'));
}
function tmpDispatch(): string {
  return mkdtempSync(join(tmpdir(), 'w21-dispatch-'));
}

function item(ck?: PlanItem['componentKnowledge']): PlanItem {
  return {
    anchor: { id: 'hero', anchor: 'hero' },
    archetype: 'hero',
    tokenRoles: [],
    intent: 'the hero',
    ...(ck ? { componentKnowledge: ck } : {}),
  };
}

/** Render one request.md and read it back. */
async function renderRequest(
  ck: PlanItem['componentKnowledge'],
  consume: boolean,
): Promise<string> {
  const dispatchDir = tmpDispatch();
  try {
    const author = createSubagentAuthor({
      dispatchDir,
      dispatch: async () => '<section/>',
      consumeComponentKnowledge: consume,
    });
    await author.author({ item: item(ck), guidance: '', oneLiner: 'one', tone: 'confident' });
    return readFileSync(join(dispatchDir, 'hero.request.md'), 'utf8');
  } finally {
    rmSync(dispatchDir, { recursive: true, force: true });
  }
}

/** Slice the `## Component Knowledge` transport region (up to the next `## ` heading at line start). */
function transportRegion(md: string): string {
  const start = md.indexOf(`${TRANSPORT_HEADING}\n`);
  if (start === -1) return '';
  const rest = md.slice(start + TRANSPORT_HEADING.length);
  const next = rest.search(/\n## (?!#)/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('W21 — the scripted author is unaffected by consumption', () => {
  it('scriptedAuthor output is identical with and without componentKnowledge', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const scripted = defaultScriptedAuthor();
      const withK = await scripted.author({ item: item(ck), guidance: '', oneLiner: 'o', tone: 't' });
      const withoutK = await scripted.author({ item: item(undefined), guidance: '', oneLiner: 'o', tone: 't' });
      expect(withK).toBe(withoutK); // scripted author never reads the knowledge → byte-identical
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('W21 — the subagent author consumes the knowledge (opt-in)', () => {
  it('enabled + knowledge present ⇒ request carries the consume DIRECTIVE and the transport block', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const md = await renderRequest(ck, true);

      // The transport block (W20) is still present, verbatim.
      expect(md).toContain(TRANSPORT_HEADING);
      expect(md).toContain('### Purpose');
      expect(md).toContain('- minimal\n- decisive');

      // The consume directive (W21) is present and frames the knowledge as realize-not-reproduce guidance.
      expect(md).toContain(DIRECTIVE_HEADING);
      expect(md).toMatch(/guidance/i);
      expect(md).toMatch(/do NOT reproduce|never copy|never quote/i);
      // It names the realization surfaces the four sections drive.
      expect(md).toMatch(/headline/i);
      expect(md).toMatch(/proof/i);
      expect(md).toMatch(/CTA/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('disabled (default) + knowledge present ⇒ transport block but NO consume directive (= W20)', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const md = await renderRequest(ck, false);
      expect(md).toContain(TRANSPORT_HEADING);       // W20 transport unchanged
      expect(md).not.toContain(DIRECTIVE_HEADING);   // nothing consumes by default
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('knowledge omitted + consume enabled ⇒ neither block (nothing to consume)', async () => {
    const md = await renderRequest(undefined, true);
    expect(md).not.toContain(TRANSPORT_HEADING);
    expect(md).not.toContain(DIRECTIVE_HEADING);
  });
});

describe('W21 — transport is unchanged by consumption', () => {
  it('the `## Component Knowledge` region is byte-identical whether consume is off or on', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const off = transportRegion(await renderRequest(ck, false));
      const on = transportRegion(await renderRequest(ck, true));
      expect(off.length).toBeGreaterThan(0);
      expect(on).toBe(off); // consumption adds a sibling directive; it never edits the transported block
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('deterministic disabled mode: no knowledge + disabled ⇒ no W20/W21 markers at all', async () => {
    const md = await renderRequest(undefined, false);
    expect(md).not.toContain(TRANSPORT_HEADING);
    expect(md).not.toContain(DIRECTIVE_HEADING);
  });
});

describe('W21 — malformed / digest-mismatch knowledge never reaches consumption', () => {
  it('provider fails loud on a malformed (partial-template) body — nothing to consume', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'broken', '# broken\n\nlede\n\n## Purpose\n\nonly one section.\n');
      const p = createComponentKnowledgeProvider(root);
      expect(() => p.knowledgeFor('broken')).toThrow(/missing/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('provider fails loud on a digest mismatch (body changed mid-run)', () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'shift', fullBody());
      const p = createComponentKnowledgeProvider(root);
      expect(p.knowledgeFor('shift')).not.toBeNull();
      writeComponent(root, 'shift', fullBody().replace('Why it exists.', 'Mutated purpose.'));
      expect(() => p.knowledgeFor('shift')).toThrow(/digest mismatch/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── W67 — consumeComponentKnowledge governed default activation (reuses W60's ───────────────────
//    resolveGovernedActivation exactly — the boolean scripts/generate.ts now computes for
//    `OFFSCRIPT_SEMANTIC_AUTHOR_CONSUME` and feeds into createSubagentAuthor's existing option) ──────
describe('W67 — consumeComponentKnowledge governed activation', () => {
  it('governance enabled + env unset → resolveGovernedActivation resolves true → directive present', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const enabled = resolveGovernedActivation(undefined, true);
      expect(enabled).toBe(true);
      const md = await renderRequest(ck, enabled);
      expect(md).toContain(DIRECTIVE_HEADING);
      expect(md).toContain(TRANSPORT_HEADING);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('governance disabled + env unset → resolveGovernedActivation resolves false → byte-identical to W20 (no directive)', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const enabled = resolveGovernedActivation(undefined, false);
      expect(enabled).toBe(false);
      const md = await renderRequest(ck, enabled);
      expect(md).not.toContain(DIRECTIVE_HEADING);
      expect(md).toContain(TRANSPORT_HEADING);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('explicit "1" overrides ON even when governance is disabled', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const enabled = resolveGovernedActivation('1', false);
      expect(enabled).toBe(true);
      const md = await renderRequest(ck, enabled);
      expect(md).toContain(DIRECTIVE_HEADING);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('explicit "0" overrides OFF even when governance is enabled', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const enabled = resolveGovernedActivation('0', true);
      expect(enabled).toBe(false);
      const md = await renderRequest(ck, enabled);
      expect(md).not.toContain(DIRECTIVE_HEADING);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is deterministic — two renders under the governed default produce an identical directive block', async () => {
    const root = tmpRoot();
    try {
      writeComponent(root, 'hero-x', fullBody());
      const ck = createComponentKnowledgeProvider(root).knowledgeFor('hero-x')!;
      const enabled = resolveGovernedActivation(undefined, true);
      const a = await renderRequest(ck, enabled);
      const b = await renderRequest(ck, enabled);
      expect(a).toBe(b);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
