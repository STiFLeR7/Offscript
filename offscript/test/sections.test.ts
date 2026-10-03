import { describe, it, expect } from 'vitest';
import { parseHtml } from '../src/working-rep.js';
import { loadSections, resolveAnchor } from '../src/sections.js';

const yaml = `
sections:
  - id: primary-nav
    anchor: site-nav
    landmark: navigation
  - id: hero
    anchor: hero
    landmark: main
  - id: about
    anchor: about
`;

describe('sections model', () => {
  it('parses declared sections into the model and indexes them by id', () => {
    const model = loadSections(yaml);
    expect(model.sections).toHaveLength(3);
    expect(model.byId.get('primary-nav')).toEqual({
      id: 'primary-nav',
      anchor: 'site-nav',
      landmark: 'navigation',
    });
  });

  it('carries a section with no declared landmark (landmark is undefined)', () => {
    const model = loadSections(yaml);
    expect(model.byId.get('about')?.landmark).toBeUndefined();
  });

  it('returns an empty model for empty or sections-less yaml', () => {
    expect(loadSections('').sections).toHaveLength(0);
    expect(loadSections('title: x').sections).toHaveLength(0);
  });

  it('resolves a declared anchor to its element by HTML id (never nth-child)', () => {
    const model = loadSections(yaml);
    const tree = parseHtml(
      '<!doctype html><html><body><div id="site-nav">n</div><main id="hero">h</main></body></html>',
    );
    const el = resolveAnchor(tree, model.byId.get('primary-nav')!);
    expect(el?.tagName).toBe('div');
    expect(el?.properties?.id).toBe('site-nav');
  });

  it('returns undefined when the declared anchor is absent from the tree', () => {
    const model = loadSections(yaml);
    const tree = parseHtml('<!doctype html><html><body></body></html>');
    expect(resolveAnchor(tree, model.byId.get('primary-nav')!)).toBeUndefined();
  });
});
