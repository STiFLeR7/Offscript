import { describe, it, expect } from 'vitest';
import { parseHex, relativeLuminance, contrastRatio } from '../src/color.js';

describe('parseHex', () => {
  it('parses #rrggbb', () => {
    expect(parseHex('#2563eb')).toEqual({ r: 0x25, g: 0x63, b: 0xeb });
  });

  it('expands #rgb shorthand', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses the rgb part of #rgba / #rrggbbaa, ignoring alpha', () => {
    expect(parseHex('#ff000080')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#f008')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns undefined for an unparseable value', () => {
    expect(parseHex('red')).toBeUndefined();
    expect(parseHex('#12')).toBeUndefined();
    expect(parseHex('rgb(0,0,0)')).toBeUndefined();
  });
});

describe('contrastRatio', () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };

  it('is 21:1 for black on white', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
  });

  it('is 1:1 for identical colours', () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(contrastRatio(white, black), 5);
  });

  it('rates pure red on white below the AA normal threshold (4.5)', () => {
    expect(contrastRatio({ r: 255, g: 0, b: 0 }, white)).toBeLessThan(4.5);
  });

  it('rates white relative luminance as 1 and black as 0', () => {
    expect(relativeLuminance(white)).toBeCloseTo(1, 5);
    expect(relativeLuminance(black)).toBeCloseTo(0, 5);
  });
});
