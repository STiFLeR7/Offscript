import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContext } from '../src/generate/context.js';
import { buildAuthorContract } from '../src/generate/author-contract.js';
import { authorDocument, buildCollateralCoverStyle, buildCollateralLogoStyle } from '../src/generate/author.js';
import { plan } from '../src/generate/plan.js';
import { projectDir, projectReferencesDir, resolveBrandContract } from '../src/paths.js';
import type { AuthoringRequest } from '../src/generate/authoring-seam.js';

const CLIENT = '__named_project_identity__';
const refs = projectReferencesDir(CLIENT);
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));
function namedBrief() {
  mkdirSync(refs, { recursive: true });
  writeFileSync(join(refs, 'brief.md'), '---\nschemaVersion: 1\ntrack: collateral\nbrand: Acme\none-liner: A project-owned identity\ntone: conversational lowercase\n---\nProject content.');
  writeFileSync(join(refs, 'voice.md'), 'Use conversational lowercase. Acme speaks in the first person.');
}

describe('explicit project identity with fallback tokens', () => {
  it.each(['website', 'collateral'] as const)('%s uses the project author contract while reporting fallback CSS provenance accurately', (track) => {
    namedBrief();
    const context = buildContext(CLIENT, track);
    const contract = buildAuthorContract(context);
    expect(context.brandSource).toBe('default');
    expect(contract.includes('Use conversational lowercase. Acme speaks in the first person.')).toBe(true);
    expect(contract.includes('Fallback token CSS')).toBe(true);
    expect(contract.includes(join(resolveBrandContract(CLIENT, track), 'colors_and_type.css').replaceAll('\\', '/'))).toBe(true);
    expect(contract.includes(`Supplied CSS — projects/${CLIENT}/references/colors_and_type.css`)).toBe(false);
    expect(contract.includes('No hype')).toBe(false);
    expect(contract.includes('Example Brand design references')).toBe(false);
  });
  it('suppresses the example mark for a named brief without a project mark', () => {
    namedBrief();
    expect(buildCollateralLogoStyle(buildContext(CLIENT, 'collateral'), []) === '').toBe(true);
  });
  it('suppresses the example cover for a named brief without a project cover', () => {
    namedBrief();
    expect(buildCollateralCoverStyle(buildContext(CLIENT, 'collateral'), []) === '').toBe(true);
  });
  it('labels named brief headers without sample composition mandates', async () => {
    namedBrief();
    const context = buildContext(CLIENT, 'collateral');
    const requests: AuthoringRequest[] = [];
    const result = await authorDocument(plan(context), context, { async author(request) { requests.push(request); return '<div><span class="cr-logo-mark cr-logo-mark--white"></span></div>'; } });
    expect(result.html.includes('aria-label="Acme">Acme</span>')).toBe(true);
    expect(requests.every((request) => !request.exemplar && !request.composition && !request.item.composition)).toBe(true);
  });
});

describe('project collateral assets and kit instructions', () => {
  function kitContext() {
    namedBrief();
    writeFileSync(join(refs, 'colors_and_type.css'), ':root { --cr-ink: #123456; }');
    writeFileSync(join(refs, 'light.svg'), '<svg data-mark="acme-light"></svg>');
    writeFileSync(join(refs, 'dark.svg'), '<svg data-mark="acme-dark"></svg>');
    writeFileSync(join(refs, 'texture.svg'), '<svg data-project="acme-texture"></svg>');
    writeFileSync(join(refs, 'my-imagery.md'), '| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n| cover | engine-cover | cover.jpg | none | Acme cover |\n| detail | author | texture.svg | none | Acme detail |');
    writeFileSync(join(refs, 'brand-kit.json'), JSON.stringify({ schemaVersion: 1, subject: 'Acme', logo: { lightSurfaceMark: 'light.svg', darkSurfaceMark: 'dark.svg' }, imageryManifest: 'my-imagery.md', iconography: { convention: 'monoline-inline-svg' } }));
    return buildContext(CLIENT, 'collateral');
  }
  it('inlines supplied collateral image and CSS background assets from project references', async () => {
    const context = kitContext();
    const result = await authorDocument(plan(context), context, { async author() { return '<div style="background-image:url(texture.svg)"><img src="light.svg" alt="Acme"></div>'; } });
    expect(result.html.includes('src="data:image/svg+xml;utf8,')).toBe(true);
    expect(result.html.includes('url(texture.svg)')).toBe(false);
    expect(result.html.includes('src="light.svg"')).toBe(false);
  });
  it('provides declared logo variants, imagery rows, icon convention and the supported engine mark convention', () => {
    const contract = buildAuthorContract(kitContext());
    for (const instruction of ['light.svg', 'dark.svg', 'my-imagery.md', 'texture.svg', 'engine-cover', 'monoline-inline-svg', 'cr-logo-mark--white', 'cr-logo-mark--color']) expect(contract.includes(instruction)).toBe(true);
    expect(contract).toMatch(/relative to.*references/i);
  });
});
