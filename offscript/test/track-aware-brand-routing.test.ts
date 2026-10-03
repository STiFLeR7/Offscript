import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir, designPrinciplesDir, designProcessesDir, resolveBrandContract } from '../src/paths.js';
import { buildContext } from '../src/generate/context.js';

const CLIENT = '__project_brand_routing__';
const refs = projectReferencesDir(CLIENT);
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));
function scaffold() {
  mkdirSync(refs, { recursive: true });
  writeFileSync(join(refs, 'colors_and_type.css'), ':root { --cr-brand-blue: #ff00ff; }');
  writeFileSync(join(refs, 'brand-contract.json'), JSON.stringify({ schemaVersion: 1, subject: 'Orchid Studio', generatedAt: '2026-01-01T00:00:00Z', decidedBy: 'human', slots: { '--accent': { token: '--cr-brand-blue', confidence: 'human' } } }));
  writeFileSync(join(refs, 'brand-kit.json'), JSON.stringify({ schemaVersion: 1, subject: 'Orchid Studio', logo: { lightSurfaceMark: 'light.svg', darkSurfaceMark: 'dark.svg' } }));
}

describe('project branding authority across tracks', () => {
  it.each(['website', 'collateral', 'deck'] as const)('%s resolves supplied project references', (track) => {
    scaffold();
    expect(resolveBrandContract(CLIENT, track)).toBe(refs);
  });
  it.each(['website', 'collateral'] as const)('%s loads project tokens, contract and kit together', (track) => {
    scaffold();
    const context = buildContext(CLIENT, track);
    expect(context.brandSource).toBe('client');
    expect(context.tokens.customProps.get('--cr-brand-blue')).toBe('#ff00ff');
    expect(context.brandContract?.subject).toBe('Orchid Studio');
    expect(context.brandKit?.subject).toBe('Orchid Studio');
  });
  it.each(['website', 'collateral'] as const)('%s fails loudly for a malformed supplied kit', (track) => {
    scaffold();
    writeFileSync(join(refs, 'brand-kit.json'), '{"schemaVersion":1}');
    expect(() => buildContext(CLIENT, track)).toThrow(/subject|logo/);
  });
  it('a kit without project token CSS cannot silently inherit demonstration branding', () => {
    scaffold();
    rmSync(join(refs, 'colors_and_type.css'));
    rmSync(join(refs, 'brand-contract.json'));
    expect(resolveBrandContract(CLIENT, 'collateral')).toBe(refs);
    expect(() => buildContext(CLIENT, 'collateral')).toThrow(/colors_and_type.css/);
  });
  it('bare projects retain explicit reference defaults', () => {
    expect(resolveBrandContract(CLIENT, 'website')).toBe(designProcessesDir('website'));
    expect(resolveBrandContract(CLIENT, 'collateral')).toBe(designPrinciplesDir());
    expect(buildContext(CLIENT, 'collateral').brandSource).toBe('default');
  });
  it('deck authoring remains blocked even when the project supplies branding', () => {
    scaffold();
    expect(() => buildContext(CLIENT, 'deck')).toThrow(/deck track is blocked/);
  });
});
