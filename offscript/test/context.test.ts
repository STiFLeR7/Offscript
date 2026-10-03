/**
 * Stage 1 — Context-Understanding: buildContext tests.
 *
 * Coverage:
 *  (a) Website context over real Example Brand house refs is fully populated
 *      (tokens non-empty, sectionIntelligence parsed non-empty, correct brandSource).
 *  (b) Both resolveBrandContract branches:
 *      - client WITH its own references/colors_and_type.css → brandSource:'client'
 *      - bare client with no own css → brandSource:'default'
 *  (c) buildContext(client,'deck') throws the blocked-generation error.
 *  (d) Collateral context loads without sectionIntelligence, loads playbooks.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  projectDir,
  projectReferencesDir,
  designPrinciplesDir,
  resolveBrandContract,
} from '../src/paths.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { buildContext } from '../src/generate/context.js';
import { resolveIconographyConvention } from '../src/brand-kit.js';

// ── Fixture client — throwaway ───────────────────────────────────────────────
// Mirrors the pattern in test/projects.test.ts: create under projects/ during
// setup, tear down in afterEach so the repo is clean after every run.
const FIXTURE_CLIENT = '__ctx_test__';

afterEach(() => {
  rmSync(projectDir(FIXTURE_CLIENT), { recursive: true, force: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid CSS for the fixture brand dir. */
function minimalCss(): string {
  return `:root {
  --cr-brand-blue: #2563eb;
  --cr-bg: #ffffff;
  --cr-fg: #1a1a2e;
}`;
}

/** Scaffold a fixture client with its own colors_and_type.css. */
function scaffoldClientBrand(client: string): void {
  const refsDir = projectReferencesDir(client);
  mkdirSync(refsDir, { recursive: true });
  writeFileSync(join(refsDir, 'colors_and_type.css'), minimalCss(), 'utf8');
}

// ── (a) Website context over real Example Brand house refs ───────────────────────

describe('buildContext — website / reference defaults (example-brand)', () => {
  it('returns a fully populated DesignContext', () => {
    const ctx = buildContext('example-brand', 'website');

    // Shape checks
    expect(ctx.client).toBe('example-brand');
    expect(ctx.track).toBe('website');

    // Tokens: website track loads its OWN design-team sheet at
    // resources/design_processes/website/colors_and_type.css (per-track resolution),
    // NOT the collateral/default design_principles/ sheet.
    expect(ctx.tokens.customProps.size).toBeGreaterThan(0);

    // brandSource: example-brand has no own colors_and_type.css → 'default' fallback
    expect(ctx.brandSource).toBe('default');

    // brand-contract: house dir has no brand-contract.json → null
    // (loadBrandContract composition is covered by brand-contract.test.ts)
    expect(ctx.brandContract).toBeNull();

    // governance.sectionIntelligence: post-website-pivot (author-from-governance) there
    // is no SECTION_INTELLIGENCE.md playbook anymore → empty Map.
    expect(ctx.governance.sectionIntelligence.size).toBe(0);

    // governance.playbooks: loaded from the top-level *.md docs in
    // resources/design_processes/website/ (filename stems as keys).
    expect(ctx.governance.playbooks.size).toBeGreaterThan(0);
    // PURPOSE.md + PHILOSOPHY.md are known website governance docs in the new layout.
    expect(ctx.governance.playbooks.has('PURPOSE')).toBe(true);
    expect(ctx.governance.playbooks.has('PHILOSOPHY')).toBe(true);
    // SECTION_INTELLIGENCE is gone — must not appear as a playbook.
    expect(ctx.governance.playbooks.has('SECTION_INTELLIGENCE')).toBe(false);

    // Brief: example-brand may have a real (uncommitted) brief.md present, or fall back to
    // the stub when absent. Either way the brief must be populated — assert that robustly
    // rather than depending on a local artifact's presence. (The requested-track invariant
    // is covered by `ctx.track === 'website'` above; the brief's own `track` field reflects
    // whatever the on-disk brief.md declares, which is independent of the build track.)
    expect(ctx.brief.oneLiner.length).toBeGreaterThan(0);
  });

  it('sectionIntelligence anchors are §N.M keyed', () => {
    const ctx = buildContext('example-brand', 'website');
    const keys = Array.from(ctx.governance.sectionIntelligence.keys());
    // Every anchor must match §<digits>.<digits>
    expect(keys.every((k) => /^§\d+\.\d+$/.test(k))).toBe(true);
  });

  it('tokens from house CSS are non-empty custom properties', () => {
    const ctx = buildContext('example-brand', 'website');
    // Every key in customProps must start with '--'
    const keys = Array.from(ctx.tokens.customProps.keys());
    expect(keys.every((k) => k.startsWith('--'))).toBe(true);
    expect(keys.length).toBeGreaterThan(5);
  });

  // Per-track brand resolution — the discriminating Phase-1 proof + regression guard.
  // website and collateral resolve to DIFFERENT house sheets (the design-team website
  // sheet vs the locked collateral design_principles sheet). They diverge on mutually
  // exclusive token names, so assert each track loads its OWN vocabulary and NOT the
  // other's. If a future signature change silently re-shares one sheet, this fails.
  it('per-track resolution: website loads the website sheet (--cr-brand, NOT collateral tokens)', () => {
    const web = buildContext('example-brand', 'website').tokens.customProps;
    // website-only token present
    expect(web.has('--cr-brand')).toBe(true);
    // collateral-only tokens ABSENT from the website sheet
    expect(web.has('--cr-electric')).toBe(false);
    expect(web.has('--cr-tone-periwinkle-accent')).toBe(false);
  });

  it('per-track resolution: collateral still loads design_principles (--cr-electric, NOT website tokens)', () => {
    const col = buildContext('example-brand', 'collateral').tokens.customProps;
    // collateral reference tokens present (design_principles unchanged)
    expect(col.has('--cr-electric')).toBe(true);
    expect(col.has('--cr-tone-periwinkle-accent')).toBe(true);
    // website-only token ABSENT (collateral did not pick up the website sheet)
    expect(col.has('--cr-brand')).toBe(false);
  });
});

// ── (b-1) brandSource:'client' — fixture client has own colors_and_type.css ─

describe('buildContext — brandSource client branch', () => {
  it('sets brandSource to "client" when the client has its own colors_and_type.css', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');

    expect(ctx.brandSource).toBe('client');
    // Tokens come from the fixture CSS (3 custom props)
    expect(ctx.tokens.customProps.size).toBe(3);
    expect(ctx.tokens.customProps.get('--cr-brand-blue')).toBe('#2563eb');
    expect(ctx.tokens.customProps.get('--cr-bg')).toBe('#ffffff');
    expect(ctx.tokens.customProps.get('--cr-fg')).toBe('#1a1a2e');
  });

  it('parentUrl is undefined when brief has no parent_url', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.parentUrl).toBeUndefined();
  });

  it('parentUrl is populated when the brief declares parent_url', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    // Write a brief.md with parent_url set
    const briefMd = `---
schemaVersion: 1
track: website
one-liner: "Fixture sub-page"
parent_url: https://example.com
---
Body text.
`;
    writeFileSync(join(projectReferencesDir(FIXTURE_CLIENT), 'brief.md'), briefMd, 'utf8');

    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.parentUrl).toBe('https://example.com');
  });
});

// ── (b-2) brandSource:'default' — bare client with no own CSS ─────────────────

describe('buildContext — brandSource house branch', () => {
  it('sets brandSource to "default" for a bare client (no own colors_and_type.css)', () => {
    // Create the client dir but no colors_and_type.css
    mkdirSync(projectReferencesDir(FIXTURE_CLIENT), { recursive: true });
    const ctx = buildContext(FIXTURE_CLIENT, 'website');

    expect(ctx.brandSource).toBe('default');
    // Tokens must come from the house CSS (many properties)
    expect(ctx.tokens.customProps.size).toBeGreaterThan(5);
  });

  it('reference tokens are identical to loading the resolved house CSS directly', () => {
    mkdirSync(projectReferencesDir(FIXTURE_CLIENT), { recursive: true });
    const ctx = buildContext(FIXTURE_CLIENT, 'website');

    // Load the house CSS the same way buildContext does — from the PER-TRACK resolved
    // brand dir (website → its own design_processes/website sheet, not design_principles).
    // This asserts the no-transformation invariant (resolve → load == buildContext tokens)
    // regardless of which sheet the track resolves to.
    const resolvedDir = resolveBrandContract(FIXTURE_CLIENT, 'website');
    const houseCss = readFileSync(join(resolvedDir, 'colors_and_type.css'), 'utf8');
    const expected = loadTokensFromCss(houseCss);

    expect(ctx.tokens.customProps).toEqual(expected.customProps);
    // And confirm it really is the website sheet (not design_principles).
    expect(resolvedDir).not.toBe(designPrinciplesDir());
    expect(ctx.tokens.customProps.has('--cr-brand')).toBe(true);
  });
});

// ── (c) Deck guard ────────────────────────────────────────────────────────────

describe('buildContext — deck guard', () => {
  it('throws a clear blocked-generation error for track=deck', () => {
    expect(() => buildContext('example-brand', 'deck')).toThrowError(/deck track is blocked/);
  });

  it('deck error message mentions design_processes/deck not yet supplied', () => {
    expect(() => buildContext('example-brand', 'deck')).toThrowError(/design team/);
  });

  it('deck guard fires before any brief or brand I/O (works for non-existent client)', () => {
    // This client has no directory at all — deck guard must still throw (not ENOENT)
    expect(() => buildContext('__no_such_client__', 'deck')).toThrowError(/deck track is blocked/);
  });
});

// ── (d) Collateral context ────────────────────────────────────────────────────

describe('buildContext — collateral track', () => {
  it('returns a DesignContext with empty sectionIntelligence and non-empty playbooks', () => {
    // Use reference defaults (example-brand bare)
    const ctx = buildContext('example-brand', 'collateral');

    expect(ctx.track).toBe('collateral');
    expect(ctx.brandSource).toBe('default');

    // Collateral has no SECTION_INTELLIGENCE → empty Map
    expect(ctx.governance.sectionIntelligence.size).toBe(0);

    // Collateral governance now lives at the track root as PURPOSE.md + PHILOSOPHY.md
    // (the rulebooks / component-governance / exemplars are nested subdirs that
    // loadProcessDocs does not recurse into — they are on-disk references the author
    // contract points at, not context docs).
    expect(ctx.governance.playbooks.size).toBeGreaterThan(0);
    expect(
      ctx.governance.playbooks.has('PHILOSOPHY') ||
        ctx.governance.playbooks.has('PURPOSE'),
    ).toBe(true);
  });
});

// ── (e) W76 — Brand Kit transport (Foundation: Parser → Loader → Transport) ──

describe('buildContext — W76 Brand Kit transport', () => {
  it('brandKit is undefined when the client supplies no references/brand-kit.json (every real client today)', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.brandKit).toBeUndefined();
  });

  it('example-brand (real, no brand-kit.json) has brandKit undefined on both tracks', () => {
    expect(buildContext('example-brand', 'website').brandKit).toBeUndefined();
    expect(buildContext('example-brand', 'collateral').brandKit).toBeUndefined();
  });

  it('attaches a well-formed brandKit when references/brand-kit.json is present', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const manifest = {
      schemaVersion: 1,
      subject: FIXTURE_CLIENT,
      logo: { lightSurfaceMark: 'assets/logo-light.svg', darkSurfaceMark: 'assets/logo-dark.svg' },
    };
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify(manifest),
      'utf8',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.brandKit).toBeDefined();
    expect(ctx.brandKit?.subject).toBe(FIXTURE_CLIENT);
    expect(ctx.brandKit?.logo.lightSurfaceMark).toBe('assets/logo-light.svg');
  });

  it('propagates a fail-loud error when references/brand-kit.json is present but malformed', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify({ schemaVersion: 1 }),
      'utf8',
    );
    expect(() => buildContext(FIXTURE_CLIENT, 'website')).toThrow(/subject|logo/);
  });

  it('a present brandKit does not alter any other DesignContext field (transport-only isolation)', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const off = buildContext(FIXTURE_CLIENT, 'website');
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify({
        schemaVersion: 1,
        subject: FIXTURE_CLIENT,
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
      }),
      'utf8',
    );
    const on = buildContext(FIXTURE_CLIENT, 'website');
    const strip = (ctx: ReturnType<typeof buildContext>) => {
      const { brandKit, ...rest } = ctx;
      return rest;
    };
    expect(strip(on)).toEqual(strip(off));
    expect(off.brandKit).toBeUndefined();
    expect(on.brandKit).toBeDefined();
  });
});

// ── (f) W80 — Brand Kit iconography-convention resolution, end to end via buildContext ──

describe('buildContext → resolveIconographyConvention — W80', () => {
  it('example-brand (real, no brand-kit.json) resolves to the house convention on both tracks', () => {
    expect(resolveIconographyConvention(buildContext('example-brand', 'website').brandKit)).toBe(
      'monoline-inline-svg',
    );
    expect(resolveIconographyConvention(buildContext('example-brand', 'collateral').brandKit)).toBe(
      'monoline-inline-svg',
    );
  });

  it('resolves a client-declared convention transported end to end through buildContext', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify({
        schemaVersion: 1,
        subject: FIXTURE_CLIENT,
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
        iconography: { convention: 'monoline-inline-svg' },
      }),
      'utf8',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(resolveIconographyConvention(ctx.brandKit)).toBe('monoline-inline-svg');
  });

  it('a Brand Kit with no iconography field resolves to the same fallback as no Brand Kit at all', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    const noKit = resolveIconographyConvention(buildContext(FIXTURE_CLIENT, 'website').brandKit);
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify({
        schemaVersion: 1,
        subject: FIXTURE_CLIENT,
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
      }),
      'utf8',
    );
    const kitNoIconography = resolveIconographyConvention(buildContext(FIXTURE_CLIENT, 'website').brandKit);
    expect(kitNoIconography).toBe(noKit);
  });
});

// ── (g) W81 — Brand Kit voiceReference transport verification (no runtime consumer; see
// docs/internals/SPRINT-W81-BRAND-KIT-VOICE-REFERENCE-RESOLUTION.md). No resolver exists for this
// field — parseBrandKit-level presence/absence/malformed-input coverage already exists in
// test/brand-kit.test.ts; the one genuine gap this sprint's investigation found is that no test
// exercised `voiceReference` through the actual `buildContext` transport path specifically (every
// prior W76/W80 buildContext fixture omitted it) — closed here, narrowly, with no source change.

describe('buildContext — W81 Brand Kit voiceReference transport (no runtime consumer)', () => {
  it('a client-declared voiceReference transports end to end through buildContext', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify({
        schemaVersion: 1,
        subject: FIXTURE_CLIENT,
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
        voiceReference: 'voice.md',
      }),
      'utf8',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.brandKit?.voiceReference).toBe('voice.md');
  });

  it('voiceReference is undefined when absent from an otherwise well-formed Brand Kit', () => {
    scaffoldClientBrand(FIXTURE_CLIENT);
    writeFileSync(
      join(projectReferencesDir(FIXTURE_CLIENT), 'brand-kit.json'),
      JSON.stringify({
        schemaVersion: 1,
        subject: FIXTURE_CLIENT,
        logo: { lightSurfaceMark: 'a.svg', darkSurfaceMark: 'b.svg' },
      }),
      'utf8',
    );
    const ctx = buildContext(FIXTURE_CLIENT, 'website');
    expect(ctx.brandKit?.voiceReference).toBeUndefined();
  });

  it('example-brand (real, no brand-kit.json) has no voiceReference on either track', () => {
    expect(buildContext('example-brand', 'website').brandKit?.voiceReference).toBeUndefined();
    expect(buildContext('example-brand', 'collateral').brandKit?.voiceReference).toBeUndefined();
  });
});
