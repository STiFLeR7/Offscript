import { describe, it, expect } from 'vitest';
import { parseLogLine } from '../src/log/parser.js';
import { buildCreativeIntentPayload } from '../src/intent/build.js';

const V5_LINE =
  '2026-08-06 · autopilot-approval-console · archetype=source-flow · camera=workflow · ' +
  'canvas=1200x675 · ratio=16:9 · env=dawn-haze · material=B-cream-editorial · ' +
  'surface=x · focal=y · density=med · primitives=[a, b] · ' +
  'must-include=[] · content-provenance=augmented · approved=yes · feature=automation · accent=sky · ' +
  'belief="invoice and expense approvals run without a human touching them"';

const V5_LINE_WITH_SECTION_AND_MUSTINCLUDE =
  '2026-08-05 · memory-v5-validation-augmented · archetype=x · camera=establishing · canvas=1200x675 · ' +
  'ratio=16:9 · env=cliffside-muted · surface=x · focal=y · density=low-med · primitives=[a] · ' +
  'must-include=["the percentage as the hero number"] · content-provenance=augmented · approved=yes · ' +
  'feature=automation · accent=sky · belief="Automation cut manual review time 63.4% this quarter." · ' +
  'section=feature';

const PRE_V5_LINE =
  '2026-07-02 · docxter-document-intelligence · archetype=constellation · canvas=680x620 · ' +
  'surface=light-field · focal=document-card · density=medium · primitives=[a] · approved=yes · ' +
  'feature=ai-intelligence · accent=sky · belief="documents are read and structured without manual review"';

const UNAPPROVED_LINE =
  '2026-08-06 · some-draft · archetype=x · camera=macro · canvas=900x900 · ratio=1:1 · env=lake-mirror · ' +
  'material=A-floating-glass · surface=x · focal=y · density=low · primitives=[] · must-include=[] · ' +
  'content-provenance=human · approved=no · feature=search · accent=sky · belief="a draft belief"';

describe('buildCreativeIntentPayload', () => {
  it('builds a full payload from an eligible v5+ approved line', () => {
    const result = buildCreativeIntentPayload(parseLogLine(V5_LINE));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.payload).toEqual({
      id: 'autopilot-approval-console',
      belief: 'invoice and expense approvals run without a human touching them',
      feature: 'automation',
      ratio: '16:9',
      camera: 'workflow',
      mustInclude: [],
      contentProvenance: 'augmented',
    });
  });

  it('carries a non-empty must-include and optional section through', () => {
    const result = buildCreativeIntentPayload(parseLogLine(V5_LINE_WITH_SECTION_AND_MUSTINCLUDE));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.payload.mustInclude).toEqual(['the percentage as the hero number']);
    expect(result.payload.section).toBe('feature');
  });

  it('rejects (ineligible, not thrown) a pre-v5 line missing camera/ratio/must-include/content-provenance', () => {
    const result = buildCreativeIntentPayload(parseLogLine(PRE_V5_LINE));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not-ok');
    expect(result.reason).toMatch(/camera/);
  });

  it('rejects an approved=no (draft/rejected) line outright', () => {
    const result = buildCreativeIntentPayload(parseLogLine(UNAPPROVED_LINE));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not-ok');
    expect(result.reason).toMatch(/approved/i);
  });

  it('never invents a value for a field the source line does not carry', () => {
    // must-include absent entirely (not even "[]") on a line otherwise eligible
    // is still ineligible — the payload must never default an absent required field.
    const line =
      '2026-08-06 · missing-must-include · camera=macro · ratio=1:1 · content-provenance=human · ' +
      'approved=yes · feature=search · belief="x"';
    const result = buildCreativeIntentPayload(parseLogLine(line));
    expect(result.ok).toBe(false);
  });
});
