import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../src/paths.js';
import { buildContext } from '../src/generate/context.js';
import { authorDocument, buildCollateralLogoStyle } from '../src/generate/author.js';
import type { AuthoringRequest } from '../src/generate/authoring-seam.js';
import { plan } from '../src/generate/plan.js';

const CLIENT = '__project_collateral_logo__';
const refs = projectReferencesDir(CLIENT);
const LIGHT = '<svg data-mark="orchid-light"></svg>';
const DARK = '<svg data-mark="orchid-dark"></svg>';
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));
function scaffold(withKit = true) {
  mkdirSync(refs, { recursive: true });
  writeFileSync(join(refs, 'colors_and_type.css'), ':root { --cr-ink: #123456; }');
  if (withKit) {
    writeFileSync(join(refs, 'light.svg'), LIGHT);
    writeFileSync(join(refs, 'dark.svg'), DARK);
    writeFileSync(join(refs, 'brand-kit.json'), JSON.stringify({ schemaVersion: 1, subject: 'Orchid Studio', logo: { lightSurfaceMark: 'light.svg', darkSurfaceMark: 'dark.svg' } }));
  }
}
describe('collateral project logo authority', () => {
  it('embeds supplied project marks', () => {
    scaffold();
    const warnings: string[] = [];
    const css = buildCollateralLogoStyle(buildContext(CLIENT, 'collateral'), warnings);
    expect(css).toContain(Buffer.from(LIGHT).toString('base64'));
    expect(css).toContain(Buffer.from(DARK).toString('base64'));
    expect(warnings).toHaveLength(0);
  });
  it('missing project marks never embed the default mark', () => {
    scaffold();
    rmSync(join(refs, 'dark.svg'));
    const warnings: string[] = [];
    expect(buildCollateralLogoStyle(buildContext(CLIENT, 'collateral'), warnings)).toBe('');
    expect(warnings.join(' ')).toMatch(/text|label/);
  });
  it('project tokens without a kit never receive a default mark', () => {
    scaffold(false);
    expect(buildCollateralLogoStyle(buildContext(CLIENT, 'collateral'), [])).toBe('');
  });
  it('labels empty header spans with the project when a supplied mark is missing', async () => {
    scaffold();
    rmSync(join(refs, 'dark.svg'));
    const context = buildContext(CLIENT, 'collateral');
    const result = await authorDocument(plan(context), context, { async author() { return '<header class="cr-page-header"><span class="cr-logo-mark cr-logo-mark--white" aria-label="Example Brand"></span></header>'; } });
    expect(result.html).toContain('>Orchid Studio</span>');
    expect(result.html).toContain('aria-label="Orchid Studio"');
    expect(result.html).not.toContain('aria-label="Example Brand"');
  });
  it('uses the explicit brief brand as the text label when the project has no kit', async () => {
    scaffold(false);
    const context = buildContext(CLIENT, 'collateral');
    context.brief.brand = 'Orchid Studio';
    const result = await authorDocument(plan(context), context, { async author() { return '<header><span class="cr-logo-mark cr-logo-mark--white"></span></header>'; } });
    expect(result.html).toContain('aria-label="Orchid Studio">Orchid Studio</span>');
  });
  it('replays supplied logo output deterministically', () => {
    scaffold();
    const context = buildContext(CLIENT, 'collateral');
    expect(buildCollateralLogoStyle(context, [])).toBe(buildCollateralLogoStyle(context, []));
  });
});


describe('project collateral author request', () => {
  it('keeps reference exemplars and colour composition mandates out of supplied project requests', async () => {
    scaffold();
    const context = buildContext(CLIENT, 'collateral');
    const requests: AuthoringRequest[] = [];
    await authorDocument(plan(context), context, { async author(request) { requests.push(request); return '<div>Project page</div>'; } });
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.exemplar).toBeUndefined();
      expect(request.composition).toBeUndefined();
      expect(request.item.composition).toBeUndefined();
      expect(request.guidance).not.toMatch(/navy|periwinkle|brand watermark/i);
    }
  });
  it('inlines project website imagery from project references', async () => {
    scaffold();
    writeFileSync(join(refs, 'project-image.svg'), '<svg data-project="orchid"></svg>');
    const context = buildContext(CLIENT, 'website');
    const result = await authorDocument(plan(context), context, { async author() { return '<section><img src="project-image.svg" alt="Orchid illustration"></section>'; } });
    expect(result.html.includes('src="data:image/svg+xml;utf8,')).toBe(true);
    expect(result.html.includes('src="project-image.svg"')).toBe(false);
  });
});
