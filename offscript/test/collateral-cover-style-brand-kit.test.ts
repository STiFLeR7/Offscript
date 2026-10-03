import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir, projectReferencesDir } from '../src/paths.js';
import { buildContext } from '../src/generate/context.js';
import { buildCollateralCoverStyle } from '../src/generate/author.js';

const CLIENT = '__project_collateral_cover__';
const refs = projectReferencesDir(CLIENT);
const PHOTO = Buffer.from('orchid-project-photo');
afterEach(() => rmSync(projectDir(CLIENT), { recursive: true, force: true }));
function scaffold(scrim = 'none', role = 'cover') {
  mkdirSync(refs, { recursive: true });
  writeFileSync(join(refs, 'colors_and_type.css'), ':root { --cr-ink: #123456; }');
  writeFileSync(join(refs, 'cover.jpg'), PHOTO);
  writeFileSync(join(refs, 'imagery.md'), `| role | mode | file | scrim | notes |\n|---|---|---|---|---|\n| ${role} | engine-cover | cover.jpg | ${scrim} | project photo |`);
  writeFileSync(join(refs, 'brand-kit.json'), JSON.stringify({ schemaVersion: 1, subject: 'Orchid Studio', logo: { lightSurfaceMark: 'light.svg', darkSurfaceMark: 'dark.svg' }, imageryManifest: 'imagery.md' }));
}
describe('collateral project cover authority', () => {
  it('embeds only the supplied project photo and respects no scrim', () => {
    scaffold();
    const warnings: string[] = [];
    const css = buildCollateralCoverStyle(buildContext(CLIENT, 'collateral'), warnings);
    expect(css).toContain(PHOTO.toString('base64'));
    expect(css).not.toContain('linear-gradient');
    expect(warnings).toHaveLength(0);
  });
  it('uses project ink tokens for a declared scrim', () => {
    scaffold('navy');
    const css = buildCollateralCoverStyle(buildContext(CLIENT, 'collateral'), []);
    expect(css).toContain('var(--cr-ink)');
    expect(css).not.toContain('rgba(2,11,27');
  });
  it.each(['absent-kit', 'missing-manifest', 'missing-cover-row', 'missing-photo'] as const)('%s leaves a supplied brand cover free of demonstration imagery', (mode) => {
    scaffold('none', mode === 'missing-cover-row' ? 'hero' : 'cover');
    if (mode === 'absent-kit') rmSync(join(refs, 'brand-kit.json'));
    if (mode === 'missing-manifest') rmSync(join(refs, 'imagery.md'));
    if (mode === 'missing-photo') rmSync(join(refs, 'cover.jpg'));
    expect(buildCollateralCoverStyle(buildContext(CLIENT, 'collateral'), [])).toBe('');
  });
});
