import { describe, it, expect } from 'vitest';
import type { TierTwoProposal, ActuatorRecipe } from '../src/actuator-recipe.js';
import {
  parseTier2Policy,
  policyAutoAccepts,
  editFromProposal,
  acceptProposal,
} from '../scripts/harden-review.js';

const proposal = (over: Partial<TierTwoProposal> = {}): TierTwoProposal => ({
  findingId: 'layout-alignment:col-pad:1',
  pass: 'tier-2-advisory',
  proposedEdit: { find: 'padding:17px', replace: 'padding:var(--space-4)' },
  rationale: 'snap to the 8pt grid',
  confidence: 'high',
  status: 'pending',
  proposedAt: '2026-05-29T12:00:00.000Z',
  ...over,
});

describe('parseTier2Policy', () => {
  it('defaults to no auto-accept when there is no creative-direction', () => {
    expect(parseTier2Policy(undefined)).toEqual({ autoAccept: 'none' });
  });

  it('defaults to no auto-accept when there is no tier-2-policy block', () => {
    expect(parseTier2Policy('# Creative direction\n\nSome prose, no policy block.')).toEqual({
      autoAccept: 'none',
    });
  });

  it('reads auto-accept from a tier-2-policy fenced block', () => {
    const cd = ['## Policy', '', '```tier-2-policy', 'auto-accept: high', '```', ''].join('\n');
    expect(parseTier2Policy(cd)).toEqual({ autoAccept: 'high' });
  });

  it('reads auto-accept: none explicitly', () => {
    const cd = '```tier-2-policy\nauto-accept: none\n```';
    expect(parseTier2Policy(cd)).toEqual({ autoAccept: 'none' });
  });
});

describe('policyAutoAccepts', () => {
  it('never auto-accepts under the none policy', () => {
    const p = { autoAccept: 'none' as const };
    expect(policyAutoAccepts(p, 'high')).toBe(false);
    expect(policyAutoAccepts(p, 'low')).toBe(false);
  });

  it('auto-accepts at or above the threshold', () => {
    expect(policyAutoAccepts({ autoAccept: 'high' }, 'high')).toBe(true);
    expect(policyAutoAccepts({ autoAccept: 'high' }, 'medium')).toBe(false);
    expect(policyAutoAccepts({ autoAccept: 'medium' }, 'high')).toBe(true);
    expect(policyAutoAccepts({ autoAccept: 'medium' }, 'medium')).toBe(true);
    expect(policyAutoAccepts({ autoAccept: 'medium' }, 'low')).toBe(false);
    expect(policyAutoAccepts({ autoAccept: 'low' }, 'low')).toBe(true);
  });
});

describe('editFromProposal', () => {
  it('builds a recipe edit and counts occurrences in the html', () => {
    const html = '<div style="padding:17px"></div><span style="padding:17px"></span>';
    const edit = editFromProposal(proposal(), html);
    expect(edit).toEqual({
      pass: 'tier-2-advisory',
      findingIds: ['layout-alignment:col-pad:1'],
      find: 'padding:17px',
      replace: 'padding:var(--space-4)',
      expectedOccurrences: 2,
    });
  });
});

describe('acceptProposal', () => {
  it('applies the edit to the html and appends it to a fresh recipe', () => {
    const html = '<div style="padding:17px">x</div>';
    const res = acceptProposal(proposal(), html, null, '2026-05-29T13:00:00.000Z');
    expect(res.html).toBe('<div style="padding:var(--space-4)">x</div>');
    expect(res.applied).toBe(1);
    expect(res.recipe.edits).toHaveLength(1);
    expect(res.recipe.edits[0].find).toBe('padding:17px');
    expect(res.recipe.generatedAt).toBe('2026-05-29T13:00:00.000Z');
  });

  it('merges into an existing recipe, keeping prior edits', () => {
    const existing: ActuatorRecipe = {
      generatedAt: '2026-05-01T00:00:00.000Z',
      edits: [
        { pass: 'contrast', findingIds: ['c1'], find: 'color:#777', replace: 'color:var(--ink)', expectedOccurrences: 1 },
      ],
    };
    const html = '<div style="padding:17px">x</div>';
    const res = acceptProposal(proposal(), html, existing, '2026-05-29T13:00:00.000Z');
    expect(res.recipe.edits).toHaveLength(2);
    expect(res.recipe.edits.some((e) => e.pass === 'contrast')).toBe(true);
    expect(res.recipe.edits.some((e) => e.pass === 'tier-2-advisory')).toBe(true);
  });

  it('records the edit even when the find is absent (0 applied), so it replays if the source returns', () => {
    const html = '<div>nothing to match here</div>';
    const res = acceptProposal(proposal(), html, null, '2026-05-29T13:00:00.000Z');
    expect(res.applied).toBe(0);
    expect(res.html).toBe(html); // unchanged
    expect(res.recipe.edits[0].expectedOccurrences).toBe(0);
  });
});
