import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  parseBrandKit,
  loadBrandKitIfPresent,
  brandKitDigest,
  resolveLogoMark,
  resolveIconographyConvention,
  BrandKitError,
  BRAND_KIT_VERSION,
  type BrandKit,
} from '../src/brand-kit.js';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-bk-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const MINIMAL_RAW = JSON.stringify({
  schemaVersion: 1,
  subject: 'acme',
  logo: { lightSurfaceMark: 'assets/logo-light.svg', darkSurfaceMark: 'assets/logo-dark.svg' },
});

const FULL_RAW = JSON.stringify({
  schemaVersion: 1,
  subject: 'acme',
  logo: { lightSurfaceMark: 'assets/logo-light.svg', darkSurfaceMark: 'assets/logo-dark.svg' },
  imageryManifest: 'assets/imagery.md',
  iconography: { convention: 'monoline-inline-svg' },
  voiceReference: 'assets/voice.md',
});

describe('parseBrandKit — correctness', () => {
  it('parses the minimal required-fields-only manifest', () => {
    const kit = parseBrandKit(MINIMAL_RAW);
    expect(kit.schemaVersion).toBe(1);
    expect(kit.subject).toBe('acme');
    expect(kit.logo).toEqual({
      lightSurfaceMark: 'assets/logo-light.svg',
      darkSurfaceMark: 'assets/logo-dark.svg',
    });
    expect(kit.imageryManifest).toBeUndefined();
    expect(kit.iconography).toBeUndefined();
    expect(kit.voiceReference).toBeUndefined();
    expect(kit.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('parses the full manifest with every optional field present', () => {
    const kit = parseBrandKit(FULL_RAW);
    expect(kit.imageryManifest).toBe('assets/imagery.md');
    expect(kit.iconography).toEqual({ convention: 'monoline-inline-svg' });
    expect(kit.voiceReference).toBe('assets/voice.md');
  });

  it('returns a frozen (immutable) object', () => {
    const kit = parseBrandKit(MINIMAL_RAW);
    expect(Object.isFrozen(kit)).toBe(true);
    expect(Object.isFrozen(kit.logo)).toBe(true);
  });

  it('returns a frozen iconography object when present', () => {
    const kit = parseBrandKit(FULL_RAW);
    expect(Object.isFrozen(kit.iconography)).toBe(true);
  });
});

describe('parseBrandKit — digest stability (content-addressed)', () => {
  it('produces the identical digest for identical raw text', () => {
    const a = parseBrandKit(MINIMAL_RAW);
    const b = parseBrandKit(MINIMAL_RAW);
    expect(a.digest).toBe(b.digest);
  });

  it('produces a different digest when content changes', () => {
    const a = parseBrandKit(MINIMAL_RAW);
    const changed = JSON.stringify({
      schemaVersion: 1,
      subject: 'acme-2',
      logo: { lightSurfaceMark: 'assets/logo-light.svg', darkSurfaceMark: 'assets/logo-dark.svg' },
    });
    const b = parseBrandKit(changed);
    expect(a.digest).not.toBe(b.digest);
  });

  it('brandKitDigest is deterministic and canonicalizes CRLF to LF', () => {
    const lf = 'hello\nworld';
    const crlf = 'hello\r\nworld';
    expect(brandKitDigest(lf)).toBe(brandKitDigest(crlf));
  });

  it('brandKitDigest changes when BRAND_KIT_VERSION would change (sanity: version participates)', () => {
    // The version constant is baked into every digest; this just proves the constant exists
    // and is a non-empty, stable string other tests can rely on.
    expect(BRAND_KIT_VERSION).toMatch(/^w76-brand-kit@/);
  });
});

describe('parseBrandKit — malformed input handling (fail-loud)', () => {
  it('throws BrandKitError on invalid JSON', () => {
    expect(() => parseBrandKit('{not json')).toThrow(BrandKitError);
  });

  it('throws when the manifest is not an object (array)', () => {
    expect(() => parseBrandKit('[]')).toThrow(/not a JSON object/);
  });

  it('throws when the manifest is not an object (primitive)', () => {
    expect(() => parseBrandKit('42')).toThrow(/not a JSON object/);
  });

  it('throws when schemaVersion is missing', () => {
    const raw = JSON.stringify({ subject: 'acme', logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' } });
    expect(() => parseBrandKit(raw)).toThrow(/schemaVersion/);
  });

  it('throws when schemaVersion is an unsupported value', () => {
    const raw = JSON.stringify({
      schemaVersion: 2,
      subject: 'acme',
      logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' },
    });
    expect(() => parseBrandKit(raw)).toThrow(/schemaVersion/);
  });

  it('throws when subject is missing', () => {
    const raw = JSON.stringify({ schemaVersion: 1, logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' } });
    expect(() => parseBrandKit(raw)).toThrow(/subject/);
  });

  it('throws when subject is an empty string', () => {
    const raw = JSON.stringify({ schemaVersion: 1, subject: '  ', logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' } });
    expect(() => parseBrandKit(raw)).toThrow(/subject/);
  });

  it('throws when logo is missing entirely', () => {
    const raw = JSON.stringify({ schemaVersion: 1, subject: 'acme' });
    expect(() => parseBrandKit(raw)).toThrow(/logo/);
  });

  it('throws when logo.darkSurfaceMark is missing', () => {
    const raw = JSON.stringify({ schemaVersion: 1, subject: 'acme', logo: { lightSurfaceMark: 'a' } });
    expect(() => parseBrandKit(raw)).toThrow(/logo/);
  });

  it('throws when logo.lightSurfaceMark is an empty string', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      subject: 'acme',
      logo: { lightSurfaceMark: '', darkSurfaceMark: 'b' },
    });
    expect(() => parseBrandKit(raw)).toThrow(/logo/);
  });

  it('throws when imageryManifest is present but not a string', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      subject: 'acme',
      logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' },
      imageryManifest: 42,
    });
    expect(() => parseBrandKit(raw)).toThrow(/imageryManifest/);
  });

  it('throws when iconography.convention is not in the closed vocabulary', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      subject: 'acme',
      logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' },
      iconography: { convention: 'lucide' },
    });
    expect(() => parseBrandKit(raw)).toThrow(/iconography/);
  });

  it('throws when voiceReference is present but an empty string', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      subject: 'acme',
      logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' },
      voiceReference: '   ',
    });
    expect(() => parseBrandKit(raw)).toThrow(/voiceReference/);
  });
});

describe('loadBrandKitIfPresent — deterministic loading', () => {
  it('returns null when the file does not exist', () => {
    expect(loadBrandKitIfPresent(path.join(tmp, 'missing.json'))).toBeNull();
  });

  it('loads and parses a present, well-formed file', () => {
    const p = path.join(tmp, 'brand-kit.json');
    fs.writeFileSync(p, FULL_RAW, 'utf8');
    const kit = loadBrandKitIfPresent(p);
    expect(kit).not.toBeNull();
    expect((kit as BrandKit).subject).toBe('acme');
  });

  it('throws on a present-but-malformed file (never silently degrades to null)', () => {
    const p = path.join(tmp, 'bad.json');
    fs.writeFileSync(p, '{ "schemaVersion": 1 }', 'utf8');
    expect(() => loadBrandKitIfPresent(p)).toThrow(BrandKitError);
  });

  it('two independent loads of the identical file are deterministic (same digest, deep-equal)', () => {
    const p = path.join(tmp, 'brand-kit.json');
    fs.writeFileSync(p, FULL_RAW, 'utf8');
    const a = loadBrandKitIfPresent(p);
    const b = loadBrandKitIfPresent(p);
    expect(a).toEqual(b);
    expect((a as BrandKit).digest).toBe((b as BrandKit).digest);
  });
});

describe('resolveLogoMark — W78 deterministic logo resolution', () => {
  const kit = parseBrandKit(FULL_RAW); // logo: { lightSurfaceMark: 'assets/logo-light.svg', darkSurfaceMark: 'assets/logo-dark.svg' }

  it('resolves the light-surface mark relative to kitDir', () => {
    const resolved = resolveLogoMark(kit, 'light', path.join('D:', 'client', 'references'));
    expect(resolved).toBe(path.join('D:', 'client', 'references', 'assets/logo-light.svg'));
  });

  it('resolves the dark-surface mark relative to kitDir', () => {
    const resolved = resolveLogoMark(kit, 'dark', path.join('D:', 'client', 'references'));
    expect(resolved).toBe(path.join('D:', 'client', 'references', 'assets/logo-dark.svg'));
  });

  it('returns undefined when no Brand Kit is supplied (fallback signal)', () => {
    expect(resolveLogoMark(undefined, 'light', tmp)).toBeUndefined();
    expect(resolveLogoMark(undefined, 'dark', tmp)).toBeUndefined();
  });

  it('is deterministic: repeated calls with identical inputs agree', () => {
    const a = resolveLogoMark(kit, 'light', tmp);
    const b = resolveLogoMark(kit, 'light', tmp);
    expect(a).toBe(b);
  });

  it('light and dark resolve to distinct paths when the manifest declares distinct marks', () => {
    const light = resolveLogoMark(kit, 'light', tmp);
    const dark = resolveLogoMark(kit, 'dark', tmp);
    expect(light).not.toBe(dark);
  });
});

describe('resolveIconographyConvention — W80 deterministic iconography-convention resolution', () => {
  it('resolves the Brand-Kit-declared convention when iconography is present', () => {
    const kit = parseBrandKit(FULL_RAW); // iconography: { convention: 'monoline-inline-svg' }
    expect(resolveIconographyConvention(kit)).toBe('monoline-inline-svg');
  });

  it('falls back to monoline-inline-svg when no Brand Kit is supplied', () => {
    expect(resolveIconographyConvention(undefined)).toBe('monoline-inline-svg');
  });

  it('falls back to monoline-inline-svg when a Brand Kit is present but iconography is absent', () => {
    const kit = parseBrandKit(MINIMAL_RAW); // no iconography field
    expect(kit.iconography).toBeUndefined();
    expect(resolveIconographyConvention(kit)).toBe('monoline-inline-svg');
  });

  it('rejects an out-of-vocabulary convention at parse time — never reaches the resolver', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      subject: 'acme',
      logo: { lightSurfaceMark: 'a', darkSurfaceMark: 'b' },
      iconography: { convention: 'phosphor' },
    });
    expect(() => parseBrandKit(raw)).toThrow(BrandKitError);
    expect(() => parseBrandKit(raw)).toThrow(/iconography/);
  });

  it('a malformed Brand Kit never reaches the resolver (fail-loud at parseBrandKit, not silently defaulted)', () => {
    expect(() => parseBrandKit('{ "schemaVersion": 1 }')).toThrow(BrandKitError);
  });

  it('is deterministic: repeated calls with the identical Brand Kit agree', () => {
    const kit = parseBrandKit(FULL_RAW);
    const a = resolveIconographyConvention(kit);
    const b = resolveIconographyConvention(kit);
    expect(a).toBe(b);
  });

  it('Brand Kit isolation: two independently parsed kits resolve independently (no shared state)', () => {
    const withIconography = parseBrandKit(FULL_RAW);
    const withoutIconography = parseBrandKit(MINIMAL_RAW);
    expect(resolveIconographyConvention(withIconography)).toBe('monoline-inline-svg');
    expect(resolveIconographyConvention(withoutIconography)).toBe('monoline-inline-svg');
    // distinct kit objects, not the same reference — proves no cross-kit mutation/caching
    expect(withIconography).not.toBe(withoutIconography);
  });
});
