import { describe, expect, it } from 'vitest';
import { composeInstruction, type ComposeContext, type ComposePaths } from '../src/instruction.js';
import type { PassSpec } from '../src/actuation.js';
import type { BrandContract, Finding } from '../src/operator.js';
import { parsePlaybook } from '../src/playbook.js';
import type { Rail } from '../src/gate.js';

const fakeRail = (name: string): Rail =>
  ({ name, evaluate: () => [] }) as unknown as Rail;

const PASS: PassSpec = {
  name: 'contrast',
  instruction: '(legacy, not used by composeInstruction)',
  rails: [fakeRail('contrast')],
  playbookAnchors: ['§4.1', '§6.1'],
};

const SAMPLE_PLAYBOOK = parsePlaybook(
  [
    '### 4.1 Visual emphasis and hierarchy',
    '',
    'Body of 4.1.',
    '',
    '### 6.1 WCAG 2.2 AA contract',
    '',
    'Body of 6.1.',
    '',
  ].join('\n'),
);

const FINDINGS: Finding[] = [
  { id: 'contrast:zebra', description: 'low contrast B', outcome: 'escalated' },
  { id: 'contrast:apple', description: 'low contrast A', outcome: 'escalated' },
];

const PATHS: ComposePaths = {
  reference: '/abs/reference.html',
  index: '/abs/index.html',
  tokens: '/abs/colors_and_type.css',
};

const BRAND_CONTRACT: BrandContract = {
  schemaVersion: 1,
  subject: 'example-brand',
  generatedAt: '2026-05-28T10:00:00.000Z',
  decidedBy: 'human',
  slots: {
    '--accent': { token: '--cr-brand-blue', confidence: 'human' },
    '--surface-0': { token: '--cr-bg', confidence: 'auto' },
    '--shadow-3': null,
  },
};

function baseCtx(overrides: Partial<ComposeContext> = {}): ComposeContext {
  return {
    brand: 'example-brand',
    artifactType: 'website',
    findings: FINDINGS,
    playbook: SAMPLE_PLAYBOOK,
    ...overrides,
  };
}

describe('composeInstruction', () => {
  it('emits all required sections in fixed order with ===== delimiters', () => {
    const out = composeInstruction(PASS, baseCtx({ brandContract: BRAND_CONTRACT }), PATHS);
    const sections = out.split('=====').map((s) => s.trim());
    // first chunk is the standing brief; delimited sections follow in fixed order.
    expect(out).toContain('===== brand contract (active slot map) =====');
    expect(out).toContain('===== playbook excerpts =====');
    expect(out).toContain('===== reference and tokens =====');
    expect(out).toContain('===== this pass =====');
    // brand contract precedes playbook precedes reference precedes this pass.
    const at = (s: string) => out.indexOf(`===== ${s} =====`);
    expect(at('brand contract (active slot map)')).toBeLessThan(at('playbook excerpts'));
    expect(at('playbook excerpts')).toBeLessThan(at('reference and tokens'));
    expect(at('reference and tokens')).toBeLessThan(at('this pass'));
    expect(sections.length).toBeGreaterThan(4);
  });

  it('omits the creative-direction section when none is supplied', () => {
    const out = composeInstruction(PASS, baseCtx(), PATHS);
    expect(out).not.toContain('creative-direction.md');
  });

  it('embeds creative-direction.md verbatim when present', () => {
    const cd = '# CR direction\n\nMinimal, low-saturation.';
    const out = composeInstruction(PASS, baseCtx({ creativeDirection: cd }), PATHS);
    expect(out).toContain('===== creative-direction.md =====');
    expect(out).toContain(cd);
  });

  it('resolves playbookAnchors to sorted verbatim excerpts', () => {
    const out = composeInstruction(PASS, baseCtx(), PATHS);
    const idx41 = out.indexOf('### 4.1');
    const idx61 = out.indexOf('### 6.1');
    expect(idx41).toBeGreaterThan(0);
    expect(idx61).toBeGreaterThan(idx41);
  });

  it('renders the brand-contract table with slot → var(...) rows', () => {
    const out = composeInstruction(PASS, baseCtx({ brandContract: BRAND_CONTRACT }), PATHS);
    expect(out).toMatch(/--accent\s+var\(--cr-brand-blue\)/);
    expect(out).toContain('--shadow-3');
    expect(out).toContain('UNMAPPED');
  });

  it('renders a clear placeholder when no brand contract is present', () => {
    const out = composeInstruction(PASS, baseCtx(), PATHS);
    expect(out).toContain('(no Brand Contract on file');
  });

  it('sorts findings deterministically by id', () => {
    const out = composeInstruction(PASS, baseCtx(), PATHS);
    const block = out.slice(out.indexOf('findings (rail'));
    expect(block.indexOf('contrast:apple')).toBeLessThan(block.indexOf('contrast:zebra'));
  });

  it('is a pure function (byte-exact stable across calls)', () => {
    const a = composeInstruction(PASS, baseCtx(), PATHS);
    const b = composeInstruction(PASS, baseCtx(), PATHS);
    expect(a).toBe(b);
  });

  it('throws RangeError on an unknown playbook anchor (planning bug fails loud)', () => {
    const badPass: PassSpec = { ...PASS, playbookAnchors: ['§9.9'] };
    expect(() => composeInstruction(badPass, baseCtx(), PATHS)).toThrow(RangeError);
  });

  it('omits the rail-finding bounds section when railBounds is empty', () => {
    const out = composeInstruction(PASS, baseCtx(), PATHS);
    expect(out).not.toContain('===== rail-finding bounds =====');
  });

  it('embeds rail-finding bounds verbatim when the doc is on disk', () => {
    // PURPOSE.md ships in the post-pivot website governance layout (see references.test.ts).
    const out = composeInstruction(PASS, baseCtx({ railBounds: ['PURPOSE'] }), PATHS);
    expect(out).toContain('===== rail-finding bounds =====');
    expect(out).toContain('--- PURPOSE.md ---');
    expect(out).toContain('# Purpose');
  });

  it('degrades a removed rail-bounds doc to a named-absent note (post-pivot, #46)', () => {
    // color-expansion.md was removed in the website pivot — degrade, do not crash.
    const out = composeInstruction(PASS, baseCtx({ railBounds: ['color-expansion'] }), PATHS);
    expect(out).toContain('===== rail-finding bounds =====');
    expect(out).toContain('--- color-expansion.md ---');
    expect(out).toContain('not on disk for this track');
  });

  it('degrades playbook excerpts to a named-anchors note when no playbook is on disk (post-pivot, #46)', () => {
    // Force the on-disk branch by removing the injected playbook; the canonical
    // SECTION_INTELLIGENCE.md is absent, so the section names the requested anchors.
    const ctx = baseCtx();
    delete (ctx as Partial<ComposeContext>).playbook;
    const out = composeInstruction(PASS, ctx, PATHS);
    expect(out).toContain('===== playbook excerpts =====');
    expect(out).toContain('playbook unavailable');
    expect(out).toContain('§4.1');
    expect(out).toContain('§6.1');
  });
});
