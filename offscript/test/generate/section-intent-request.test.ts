/**
 * Sprint W2 — Reasoning Transport: PlanItem.reasoning → the Author request markdown.
 *
 * This sprint ONLY transports reasoning that already exists; it never generates it. The
 * planner never populates reasoning, so the default request is byte-identical to pre-W2.
 * When reasoning is present it is validated (fail-loud) and rendered verbatim as a
 * `## Section Intent` block — never synthesized, inferred, rewritten, summarized, or collapsed.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSubagentAuthor } from '../../src/generate/authoring-seam.js';
import type { AuthoringRequest } from '../../src/generate/authoring-seam.js';
import type { PlanItem, SectionReasoning } from '../../src/generate/types.js';

const dirs: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'offscript-w2-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
});

function reqWith(reasoning?: SectionReasoning, over: Partial<PlanItem> = {}): AuthoringRequest {
  const item: PlanItem = {
    anchor: { id: 'hero', anchor: 'hero' },
    archetype: 'hero',
    tokenRoles: ['--cr-bg'],
    intent: 'frame the hidden cost',
    ...over,
    ...(reasoning ? { reasoning } : {}),
  };
  return { item, guidance: '', oneLiner: 'Test product', tone: 'confident' };
}

/** Render a request to disk via the real transport path and read it back. */
async function render(req: AuthoringRequest): Promise<string> {
  const dispatchDir = freshDir();
  const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '<x/>' });
  await a.author(req);
  return readFileSync(join(dispatchDir, `${req.item.anchor.id}.request.md`), 'utf8');
}

const FULL: SectionReasoning = {
  role: 'open the diagnostic tension',
  selectionRationale: 'hero over feature-grid',
  orderingRationale: 'first — downstream answers this',
  transition: 'hands to the mechanism reveal',
  relationships: 'sets up the proof band',
  communicationObjective: 'make the reader feel the cost',
};

describe('W2 transport — default (no reasoning) is byte-identical to pre-W2', () => {
  it('emits no Section Intent block and no reasoning text when reasoning is absent', async () => {
    const md = await render(reqWith());
    expect(md).not.toContain('## Section Intent');
    expect(md).not.toContain('Selection rationale');
    expect(md).not.toContain('Communication objective');
  });

  it('omitting reasoning vs reasoning:undefined produce identical requests', async () => {
    const a = await render(reqWith());
    const b = await render(reqWith(undefined));
    expect(a).toBe(b);
  });

  it('an empty reasoning object adds nothing (treated as absent)', async () => {
    const withEmpty = await render(reqWith({}));
    const without = await render(reqWith());
    expect(withEmpty).toBe(without);
  });
});

describe('W2 transport — populated reasoning renders correctly', () => {
  it('renders a ## Section Intent block with every present field (Title-case labels)', async () => {
    const md = await render(reqWith(FULL));
    expect(md).toContain('## Section Intent');
    expect(md).toContain('- **Role:** open the diagnostic tension');
    expect(md).toContain('- **Selection rationale:** hero over feature-grid');
    expect(md).toContain('- **Ordering rationale:** first — downstream answers this');
    expect(md).toContain('- **Transition:** hands to the mechanism reveal');
    expect(md).toContain('- **Relationships:** sets up the proof band');
    expect(md).toContain('- **Communication objective:** make the reader feel the cost');
  });

  it('omits absent fields (only present fields render)', async () => {
    const md = await render(reqWith({ role: 'open', communicationObjective: 'book a demo' }));
    expect(md).toContain('## Section Intent');
    expect(md).toContain('- **Role:** open');
    expect(md).toContain('- **Communication objective:** book a demo');
    expect(md).not.toContain('Selection rationale');
    expect(md).not.toContain('Transition');
    expect(md).not.toContain('Relationships');
    expect(md).not.toContain('Ordering rationale');
  });

  it('preserves the canonical field order (role … communication objective)', async () => {
    const md = await render(reqWith(FULL));
    const order = ['Role', 'Selection rationale', 'Ordering rationale', 'Transition', 'Relationships', 'Communication objective'];
    const positions = order.map((label) => md.indexOf(`**${label}:**`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it('renders deterministically — same request twice is identical', async () => {
    expect(await render(reqWith(FULL))).toBe(await render(reqWith(FULL)));
  });

  it('renders markdown-significant characters verbatim without breaking the block', async () => {
    const md = await render(reqWith({ role: 'use **bold**, `code`, [links](x) and _em_ verbatim' }));
    expect(md).toContain('- **Role:** use **bold**, `code`, [links](x) and _em_ verbatim');
    // exactly one Section Intent header, structure intact
    expect(md.match(/## Section Intent/g)?.length).toBe(1);
  });
});

describe('W2 transport — fail-loud validation (never repair, never invent)', () => {
  it('throws on a non-string reasoning field', async () => {
    await expect(render(reqWith({ role: 5 as unknown as string }))).rejects.toThrow(/reasoning/i);
  });

  it('throws on an empty-string reasoning field', async () => {
    await expect(render(reqWith({ transition: '   ' }))).rejects.toThrow(/reasoning/i);
  });
});

describe('W2 transport — no author-runtime / interface change', () => {
  it('the author still returns the dispatch output unchanged (reasoning present or absent)', async () => {
    const dispatchDir = freshDir();
    const a = createSubagentAuthor({ dispatchDir, dispatch: async () => '<fragment/>' });
    expect(await a.author(reqWith(FULL))).toBe('<fragment/>');
    expect(await a.author(reqWith())).toBe('<fragment/>');
  });
});
