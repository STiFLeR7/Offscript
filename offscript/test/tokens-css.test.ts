import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadTokensFromCss } from '../src/tokens.js';

describe('loadTokensFromCss', () => {
  it('collects :root --cr-* custom properties into customProps and valueToVar', () => {
    const css = `:root {
      --cr-bg: #ffffff;
      --cr-fg: #111111;
      --cr-accent: #149dff;
    }`;
    const m = loadTokensFromCss(css);
    expect(m.customProps.get('--cr-bg')).toBe('#ffffff');
    expect(m.customProps.get('--cr-fg')).toBe('#111111');
    expect(m.customProps.get('--cr-accent')).toBe('#149dff');
    expect(m.valueToVar.get('#149dff')).toBe('--cr-accent');
    expect(m.valueToVar.get('#111111')).toBe('--cr-fg');
  });

  it('returns an empty model for @font-face-only CSS (no custom props)', () => {
    const css = `@font-face {
      font-family: 'Inter';
      src: url('fonts/Inter.woff2') format('woff2');
    }`;
    const m = loadTokensFromCss(css);
    expect(m.customProps.size).toBe(0);
    expect(m.valueToVar.size).toBe(0);
  });

  it('first var wins when two vars share a value', () => {
    const css = `:root { --a: #abcdef; --b: #abcdef; }`;
    const m = loadTokensFromCss(css);
    expect(m.valueToVar.get('#abcdef')).toBe('--a');
  });

  it('normalizes values (case/whitespace) for reverse lookup', () => {
    const css = `:root { --a:   #FFFFFF  ; }`;
    const m = loadTokensFromCss(css);
    expect(m.customProps.get('--a')).toBe('#FFFFFF');
    expect(m.valueToVar.get('#ffffff')).toBe('--a');
  });

  it('collects custom props from :root and other selectors', () => {
    const css = `:root { --cr-bg: #ffffff; }
      .theme-dark { --cr-bg-dark: #000000; }`;
    const m = loadTokensFromCss(css);
    expect(m.customProps.get('--cr-bg')).toBe('#ffffff');
    expect(m.customProps.get('--cr-bg-dark')).toBe('#000000');
  });

  it('parses the real website-kit fixture into a non-empty model', () => {
    const path = fileURLToPath(new URL('../fixtures/website-kit/colors_and_type.css', import.meta.url));
    const css = readFileSync(path, 'utf8');
    const m = loadTokensFromCss(css);
    expect(m.customProps.size).toBeGreaterThan(0);
    expect(m.customProps.get('--cr-accent')).toBe('#3366ff');
  });
});
