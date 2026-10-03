/**
 * PKG — Repository Builder: scope-qualified identity + reference lawfulness.
 */
import { describe, it, expect } from 'vitest';
import {
  tryParseId,
  referenceLawful,
  type ScopeKey,
} from '../../src/knowledge/identity.js';

describe('tryParseId — the scope-qualified id grammar', () => {
  it('parses a canonical id (global, identity=null)', () => {
    expect(tryParseId('canonical::button')).toEqual({
      scope: { cls: 'canonical', identity: null },
      local: 'button',
      raw: 'canonical::button',
    });
  });

  it('parses a brand id', () => {
    expect(tryParseId('brand:acme::cta-button')).toEqual({
      scope: { cls: 'brand', identity: 'acme' },
      local: 'cta-button',
      raw: 'brand:acme::cta-button',
    });
  });

  it('returns null on malformed ids', () => {
    expect(tryParseId('button')).toBeNull();
    expect(tryParseId('canonical:button')).toBeNull();
    expect(tryParseId('brand::x')).toBeNull();
  });
});

describe('referenceLawful — canonical fan-out is the only cross-scope edge', () => {
  const canonical: ScopeKey = { cls: 'canonical', identity: null };
  const acme: ScopeKey = { cls: 'brand', identity: 'acme' };
  const other: ScopeKey = { cls: 'brand', identity: 'other' };

  it('allows any scope to reference canonical', () => {
    expect(referenceLawful(acme, canonical)).toBe(true);
  });

  it('allows same-scope references', () => {
    expect(referenceLawful(acme, acme)).toBe(true);
  });

  it('forbids cross-scope references between brands', () => {
    expect(referenceLawful(acme, other)).toBe(false);
  });
});
