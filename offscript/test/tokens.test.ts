import { describe, it, expect } from 'vitest';
import { loadTokens, renderTokenCss } from '../src/tokens.js';

describe('tokens', () => {
  it('flattens nested tokens.json into custom properties', () => {
    const m = loadTokens('{ "color": { "accent": "#2563EB", "bg": "#ffffff" } }');
    expect(m.customProps.get('--color-accent')).toBe('#2563EB');
    expect(m.customProps.get('--color-bg')).toBe('#ffffff');
  });

  it('builds a normalized (lowercased) reverse map from value to var name', () => {
    const m = loadTokens('{ "color": { "accent": "#2563EB" } }');
    expect(m.valueToVar.get('#2563eb')).toBe('--color-accent');
  });

  it('renders a deterministic :root token block', () => {
    const m = loadTokens('{ "color": { "accent": "#2563eb", "bg": "#ffffff" } }');
    expect(renderTokenCss(m)).toBe(':root { --color-accent: #2563eb; --color-bg: #ffffff }');
  });
});
