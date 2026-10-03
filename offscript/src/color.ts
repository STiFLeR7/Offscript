/** An opaque sRGB colour, channels 0..255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse a hex colour (#rgb, #rgba, #rrggbb, #rrggbbaa) to 0..255 RGB.
 * Alpha (in the 4- and 8-digit forms) is parsed-over but ignored. Returns undefined
 * if the string is not a hex colour of a supported length.
 */
export function parseHex(hex: string): Rgb | undefined {
  const m = /^#([0-9a-fA-F]+)$/.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1];
  if (h.length === 3 || h.length === 4) {
    // expand shorthand: #abc -> aabbcc, #abcd -> aabbccdd
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 && h.length !== 8) return undefined;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Linearise one 0..255 sRGB channel (WCAG 2.x). */
function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an sRGB colour (0..1). */
export function relativeLuminance(c: Rgb): number {
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

/** WCAG contrast ratio between two colours (1..21), order-independent. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * HSL saturation (0..1) of an sRGB colour. Mirrors the formula posture.ts uses
 * internally; exported here so the anti-slop governance rail and posture
 * derivation share one definition.
 */
export function hslSaturation(c: Rgb): number {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const l = (max + min) / 2;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/** HSL saturation (0..1) of a hex colour; 0 if unparseable. */
export function saturationOfHex(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? hslSaturation(rgb) : 0;
}
