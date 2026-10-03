import { describe, it, expect } from 'vitest';
import { parseLogLine, unquote, parseArray } from '../src/log/parser.js';

describe('parseLogLine', () => {
  it('parses date, slug, and every field= token from a real v6 log line', () => {
    const line =
      '2026-08-06 · autopilot-approval-console · archetype=source-flow · camera=workflow · ' +
      'canvas=1200x675 · ratio=16:9 · env=dawn-haze · material=B-cream-editorial · ' +
      'surface=atmosphere(as-configured)+pop-scrim+cream-editorial-dominant-card · ' +
      'focal=approval-throughput-numeral(96px hero) · density=med · ' +
      'primitives=[hero-numeral-96px, workflow-tile-row, execution-status-chip, mono-timestamp+live-dot, cursor+tooltip] · ' +
      'must-include=[] · content-provenance=augmented · approved=yes · feature=automation · accent=sky · ' +
      'belief="invoice and expense approvals run without a human touching them"';

    const rec = parseLogLine(line);

    expect(rec.date).toBe('2026-08-06');
    expect(rec.slug).toBe('autopilot-approval-console');
    expect(rec.raw.get('camera')).toBe('workflow');
    expect(rec.raw.get('ratio')).toBe('16:9');
    expect(rec.raw.get('content-provenance')).toBe('augmented');
    expect(rec.raw.get('approved')).toBe('yes');
    expect(rec.raw.get('feature')).toBe('automation');
    expect(rec.raw.get('must-include')).toBe('[]');
    expect(rec.raw.get('belief')).toBe(
      '"invoice and expense approvals run without a human touching them"'
    );
    // surface= contains no top-level " · " so it must not have been split mid-value
    expect(rec.raw.get('surface')).toBe(
      'atmosphere(as-configured)+pop-scrim+cream-editorial-dominant-card'
    );
  });

  it('does not split a " · " delimiter that appears inside a quoted field value', () => {
    const line =
      '2026-08-06 · some-slug · archetype=hero-callout · camera=macro · canvas=900x900 · ratio=1:1 · ' +
      'env=lake-mirror · material=A-floating-glass · surface=x · focal=y · density=low · primitives=[] · ' +
      'must-include=[] · content-provenance=human · approved=yes · feature=search · accent=sky · ' +
      'belief="fast · reliable · trusted search"';

    const rec = parseLogLine(line);
    expect(rec.raw.get('belief')).toBe('"fast · reliable · trusted search"');
  });

  it('optional fields are absent from the map when the line omits them', () => {
    const line =
      '2026-07-02 · docxter-document-intelligence · archetype=constellation · canvas=680x620 · ' +
      'surface=light-field · focal=document-card · density=medium · ' +
      'primitives=[dashed-polygon-backdrop, pill-badge, progress-bar, mono-label] · approved=yes · ' +
      'note="the quality-bar creative" · feature=ai-intelligence · accent=sky · ' +
      'belief="documents are read and structured without manual review"';

    const rec = parseLogLine(line);
    expect(rec.raw.has('camera')).toBe(false);
    expect(rec.raw.has('ratio')).toBe(false);
    expect(rec.raw.has('must-include')).toBe(false);
    expect(rec.raw.has('content-provenance')).toBe(false);
    expect(rec.raw.get('approved')).toBe('yes');
  });
});

describe('unquote', () => {
  it('strips one layer of surrounding double quotes', () => {
    expect(unquote('"hello world"')).toBe('hello world');
  });

  it('throws on a value that is not quoted', () => {
    expect(() => unquote('bare')).toThrow();
  });
});

describe('parseArray', () => {
  it('parses an empty bracket as an empty array', () => {
    expect(parseArray('[]')).toEqual([]);
  });

  it('parses a bracket of quoted strings into a string array, preserving order', () => {
    expect(parseArray('["the percentage as the hero number"]')).toEqual([
      'the percentage as the hero number',
    ]);
  });

  it('parses multiple quoted items separated by commas', () => {
    expect(
      parseArray('["team member photos or initials", "the 214 ticket count as the hero number"]')
    ).toEqual(['team member photos or initials', 'the 214 ticket count as the hero number']);
  });
});
