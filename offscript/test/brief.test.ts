import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBrief, loadBrief, loadBriefIfPresent, stubBrief } from '../src/generate/brief.js';
import { projectDir, projectReferencesDir } from '../src/paths.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRaw = readFileSync(join(here, 'fixtures/generate/brief.md'), 'utf8');

describe('parseBrief — valid fixture', () => {
  it('parses the website fixture to expected Brief fields', () => {
    const brief = parseBrief(fixtureRaw);
    expect(brief.schemaVersion).toBe(1);
    expect(brief.track).toBe('website');
    expect(brief.oneLiner).toContain('Example Brand');
    expect(brief.audience).toContain('Design leads');
    expect(brief.goals).toHaveLength(3);
    expect(brief.mustInclude).toContain('hero');
    expect(brief.mustInclude).toContain('cta');
    expect(brief.tone).toContain('Confident');
    expect(brief.successCriteria).toHaveLength(3);
    expect(brief.parentUrl).toBeUndefined();
    expect(brief.body).toContain('governance rails');
  });
});

describe('parseBrief — robustness', () => {
  it('parses CRLF frontmatter identically to LF (CRLF bug-class guard)', () => {
    const lf = `---
schemaVersion: 1
track: website
one-liner: "Test"
goals:
  - a
  - b
---
the body
`;
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(parseBrief(crlf)).toEqual(parseBrief(lf));
  });

  it('coerces a scalar array field to a single-element array', () => {
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
goals: just one goal
---
body
`;
    expect(parseBrief(raw).goals).toEqual(['just one goal']);
  });

  it('captures parentUrl when present', () => {
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
parent_url: https://example-brand.com
---
body
`;
    expect(parseBrief(raw).parentUrl).toBe('https://example-brand.com');
  });
});

describe('parseBrief — validation errors', () => {
  it('throws when track field is missing', () => {
    const raw = `---
schemaVersion: 1
one-liner: "Test"
---
body
`;
    expect(() => parseBrief(raw)).toThrowError(/track/);
  });

  it('throws when one-liner field is missing', () => {
    const raw = `---
schemaVersion: 1
track: website
---
body
`;
    expect(() => parseBrief(raw)).toThrowError(/one-liner/);
  });

  it('throws when schemaVersion is missing', () => {
    const raw = `---
track: website
one-liner: "Test"
---
body
`;
    expect(() => parseBrief(raw)).toThrowError(/schemaVersion/);
  });

  it('throws a descriptive error for an unknown track value', () => {
    const raw = `---
schemaVersion: 1
track: brochure
one-liner: "Test"
---
body
`;
    expect(() => parseBrief(raw)).toThrowError(/brochure/);
  });

  it('throws on an unsupported schemaVersion (no silent coercion to 1)', () => {
    const raw = `---
schemaVersion: 2
track: website
one-liner: "Test"
---
body
`;
    expect(() => parseBrief(raw)).toThrowError(/schemaVersion/);
  });
});

describe('loadBrief — missing file', () => {
  it('throws an Error naming the missing brief.md path', () => {
    // A client name that has no project workspace → no references/brief.md.
    const client = '__no_such_client_for_test__';
    expect(() => loadBrief(client)).toThrowError(/brief\.md/);
    expect(() => loadBrief(client)).toThrowError(new RegExp(client));
  });
});

describe('loadBriefIfPresent — missing vs malformed', () => {
  // Throwaway client so we can lay down (or omit) a brief.md and tear it down.
  const CLIENT = '__brief_lenient_test__';

  afterEach(() => {
    rmSync(projectDir(CLIENT), { recursive: true, force: true });
  });

  it('returns null when brief.md is absent (legitimate skeleton state)', () => {
    // No directory at all → absent → null, not a throw.
    expect(loadBriefIfPresent(CLIENT)).toBeNull();
  });

  it('throws — does NOT silently stub — when brief.md is present but malformed', () => {
    const refsDir = projectReferencesDir(CLIENT);
    mkdirSync(refsDir, { recursive: true });
    // Present but invalid: unknown track value → parseBrief must throw.
    const bad = `---
schemaVersion: 1
track: brochure
one-liner: "Malformed"
---
body
`;
    writeFileSync(join(refsDir, 'brief.md'), bad, 'utf8');
    expect(() => loadBriefIfPresent(CLIENT)).toThrowError(/brochure/);
  });

  it('parses a present, valid brief.md', () => {
    const refsDir = projectReferencesDir(CLIENT);
    mkdirSync(refsDir, { recursive: true });
    const good = `---
schemaVersion: 1
track: website
one-liner: "Valid brief"
---
body
`;
    writeFileSync(join(refsDir, 'brief.md'), good, 'utf8');
    const brief = loadBriefIfPresent(CLIENT);
    expect(brief?.oneLiner).toBe('Valid brief');
    expect(brief?.track).toBe('website');
  });
});

describe('stubBrief', () => {
  it('produces a minimal valid Brief keyed to the given track', () => {
    const s = stubBrief('collateral');
    expect(s.schemaVersion).toBe(1);
    expect(s.track).toBe('collateral');
    expect(s.oneLiner).toContain('stub');
    expect(s.mustInclude).toEqual([]);
    expect(s.parentUrl).toBeUndefined();
  });
});

describe('parseBrief — schemaVersion compatibility policy', () => {
  it('rejects an unsupported version and names the supported set', () => {
    const raw = `---
schemaVersion: 2
track: website
one-liner: "Test"
---
body
`;
    // Still throws on 2 (only 1 is supported) AND the message names what IS supported.
    expect(() => parseBrief(raw)).toThrowError(/schemaVersion/);
    expect(() => parseBrief(raw)).toThrowError(/understands schemaVersion: 1/);
  });

  it('rejects a non-integer version rather than coercing it', () => {
    const raw = `---
schemaVersion: 1.5
track: website
one-liner: "Test"
---
body
`;
    expect(() => parseBrief(raw)).toThrowError(/unsupported schemaVersion/);
  });
});

describe('parseBrief — provenance passthrough (opaque, audit-only)', () => {
  it('coerces a provenance mapping to Record<string,string>, verbatim', () => {
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
provenance:
  sourceSystem: content-core
  packetId: uk-accounting-landing-page
  packetStatus: approved_external
  sourceHash: 42
---
body
`;
    expect(parseBrief(raw).provenance).toEqual({
      sourceSystem: 'content-core',
      packetId: 'uk-accounting-landing-page',
      packetStatus: 'approved_external',
      sourceHash: '42', // numbers coerced to strings — values are opaque
    });
  });

  it('is undefined when absent (nothing recorded → byte-identical manifest)', () => {
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
---
body
`;
    expect(parseBrief(raw).provenance).toBeUndefined();
  });

  it('ignores a non-mapping provenance value (array/scalar → undefined)', () => {
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
provenance:
  - not
  - a
  - map
---
body
`;
    expect(parseBrief(raw).provenance).toBeUndefined();
  });
});

describe('parseBrief — unknown-field drift diagnostic', () => {
  it('warns (does not throw) on an unrecognized frontmatter key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
must_include:
  - typo-key
---
body
`;
    // Must not throw — unknown keys stay forward-compatible.
    expect(() => parseBrief(raw)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('must_include'));
    warn.mockRestore();
  });

  it('does not warn on a fully-recognized brief', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = `---
schemaVersion: 1
track: website
one-liner: "Test"
brand: Acme
---
body
`;
    parseBrief(raw);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
