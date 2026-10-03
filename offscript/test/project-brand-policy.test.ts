import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { buildAuthorContract } from '../src/generate/author-contract.js';
import { validate } from '../src/generate/validate.js';
import { projectDir, projectReferencesDir, type Track } from '../src/paths.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { parseBrandKit } from '../src/brand-kit.js';
import { registryForTrack } from '../src/operators/index.js';
import { buildOperatorContext } from '../src/operator-context.js';
import { parseHtml } from '../src/working-rep.js';
import type { DesignContext } from '../src/generate/types.js';

const roots: string[] = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

const CSS = ':root { --client-indigo: #150580; --client-orange: #f07830; --client-cream: #f4eddf; --client-ink: #111111; --client-paper: #ffffff; --client-depth: 0 4px 12px rgba(0,0,0,.2); }\n.client-card { box-shadow: var(--client-depth); }';
const VOICE = 'Write in lowercase. Friendly first-person singular. Welcome emoji, exclamation marks, em dashes & ampersands.';
const CLIENT_HTML = `<!doctype html><html lang="en"><head><style>${CSS}</style></head><body><main>
<section id="client" class="cr-page" style="background:var(--client-paper);color:var(--client-ink)">
<h1>hello — we make tools & toys! 🚀</h1>
<aside style="background:#f4eddf;border-left:4px solid #f07830;box-shadow:var(--client-depth)">a warm welcome</aside>
<span class="cr-stat-value" style="color:var(--client-orange)">12</span>
<div style="background:#150580;color:var(--client-paper)">client indigo</div>
</section></main></body></html>`;
const REFERENCE_RULES = /^(retired-token|flat-no-shadow|no-emoji|no-mdash|no-ampersand|no-callout-box|metrics-in-dark|never-indigo|no-elevation|website-composition-grammar:glyph):/;

function clientContext(track: 'website' | 'collateral', voiceReference = true): DesignContext {
  const client = `brand-policy-${process.pid}-${Math.random().toString(36).slice(2)}`;
  roots.push(projectDir(client));
  const refs = projectReferencesDir(client);
  mkdirSync(join(refs, 'voice'), { recursive: true });
  writeFileSync(join(refs, 'colors_and_type.css'), CSS);
  writeFileSync(join(refs, voiceReference ? 'voice/tone.md' : 'voice.md'), VOICE);
  const context = buildContext('example-brand', track);
  return {
    ...context, client, brandSource: 'client', tokens: loadTokensFromCss(CSS), brandContract: null,
    brief: { ...context.brief, brand: 'Tools & Toys', tone: 'Playful & warm!', oneLiner: 'Make useful things — together!', mustInclude: ['Our work'] },
    brandKit: parseBrandKit(JSON.stringify({ schemaVersion: 1, subject: client, logo: { lightSurfaceMark: 'logo.svg', darkSurfaceMark: 'logo-white.svg' }, ...(voiceReference ? { voiceReference: 'voice/tone.md' } : {}) })),
  };
}

describe('supplied project branding is the authoring authority', () => {
  it.each(['website', 'collateral'] as const)('carries the %s project CSS and voice without bundled identity restrictions', (track) => {
    const context = clientContext(track);
    const contract = buildAuthorContract(context);
    expect(contract).toContain(CSS);
    expect(contract).toContain(VOICE);
    expect(contract).toContain('voice/tone.md');
    expect(contract).toContain(context.brief.tone);
    expect(contract).toContain(context.brief.oneLiner);
    expect(contract).not.toMatch(/NEVER indigo|No em-dash|No hype|No emoji|headlines: Title Case|\*\*Title Case\*\*|NEVER navy\/dark|Lucide only|BANNED callout|Example Brand-governed/i);
    expect(contract).toMatch(/contrast/i);
    expect(contract).toMatch(/Never fabricate/i);
    expect(contract).toMatch(track === 'collateral' ? /A4|overflow|page box/i : /responsive/i);
  });

  it('uses project voice.md when no manifest voice pointer was supplied', () => {
    expect(buildAuthorContract(clientContext('website', false))).toContain(VOICE);
  });
});

describe('shared generate and harden registries respect client choices', () => {
  it.each(['website', 'collateral', 'deck'] as Track[])('%s default rails allow the supplied palette, punctuation and depth', (track) => {
    const context = buildOperatorContext({ tokens: loadTokensFromCss(CSS) });
    const tree = parseHtml(CLIENT_HTML);
    const registry = registryForTrack(track);
    const findings = [...registry.values()].flatMap((op) => op.detect(tree, context));
    expect(findings.filter((finding) => REFERENCE_RULES.test(finding.id))).toEqual([]);
    for (const name of ['lang-attr', 'brand-fidelity-scan', 'font-fidelity', 'contrast', 'landmark-semantics', 'token-normalize']) expect(registry.has(name)).toBe(true);
    expect(registry.get('brand-fidelity-scan')!.detect(tree, context)).toEqual([]);
    const invalid = parseHtml('<html><body><p style="color:#abcdef;background:#ffffff">unreadable and off-token</p></body></html>');
    expect(registry.get('brand-fidelity-scan')!.detect(invalid, context).length).toBeGreaterThan(0);
    expect(registry.get('contrast')!.detect(invalid, context).length).toBeGreaterThan(0);
    expect(registry.get('lang-attr')!.detect(invalid, context).length).toBeGreaterThan(0);
  });

  it.each(['website', 'collateral'] as const)('generation validation does not feed %s reference policy violations back to the author', async (track) => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-brand-policy-'));
    roots.push(outDir);
    const result = await validate(CLIENT_HTML, clientContext(track), { outDir });
    expect(result.perRail.flatMap((rail) => rail.findings).filter((finding) => REFERENCE_RULES.test(finding.id))).toEqual([]);
  });
});
