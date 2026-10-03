import { describe, it, expect } from 'vitest';
import { isPortableLocation, describeLocationRejection } from '../src/artifact/location.js';

describe('isPortableLocation — accepted shapes', () => {
  it('accepts a project-relative path', () => {
    expect(isPortableLocation('projects/example-brand-apa/creative-assets/run-1/hero.html')).toBe(true);
  });

  it('accepts a bare relative filename', () => {
    expect(isPortableLocation('hero.html')).toBe(true);
  });

  it('accepts a content-addressed content:// URI', () => {
    expect(
      isPortableLocation('content://sha256:' + 'a'.repeat(64))
    ).toBe(true);
  });
});

describe('isPortableLocation — rejected shapes (no machine-specific paths)', () => {
  it('rejects a Windows absolute path with a drive letter', () => {
    expect(isPortableLocation('D:/Offscript-creatives-generation/Output/hero.html')).toBe(false);
  });

  it('rejects a Windows absolute path with backslashes', () => {
    expect(isPortableLocation('D:\\Offscript-creatives-generation\\Output\\hero.html')).toBe(false);
  });

  it('rejects a UNC path', () => {
    expect(isPortableLocation('\\\\server\\share\\hero.html')).toBe(false);
  });

  it('rejects an absolute POSIX path', () => {
    expect(isPortableLocation('/var/data/hero.html')).toBe(false);
  });

  it('rejects a path containing a ".." traversal segment', () => {
    expect(isPortableLocation('projects/example-brand-apa/../../etc/passwd')).toBe(false);
  });

  it('rejects a ".." traversal segment expressed with backslashes', () => {
    expect(isPortableLocation('projects\\..\\..\\secrets')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isPortableLocation('')).toBe(false);
  });
});

describe('describeLocationRejection', () => {
  it('returns null for an accepted location', () => {
    expect(describeLocationRejection('projects/acme/creative-assets/r1/a.html')).toBeNull();
  });

  it('returns a human-readable reason for a rejected absolute path', () => {
    const reason = describeLocationRejection('D:/Offscript-creatives-generation/Output/hero.html');
    expect(reason).toBeTruthy();
    expect(reason).toMatch(/absolute|drive/i);
  });

  it('returns a human-readable reason for a traversal segment', () => {
    const reason = describeLocationRejection('a/../b');
    expect(reason).toMatch(/traversal|\.\./i);
  });
});
