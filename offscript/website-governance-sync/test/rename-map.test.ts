import { describe, expect, it } from 'vitest';
import { oldNameFor, newNameFor, RENAMED_SECTIONS } from '../src/rename-map.js';

describe('RENAMED_SECTIONS', () => {
  it('has exactly the 10 sections renamed during the section-library migration', () => {
    expect(Object.keys(RENAMED_SECTIONS).sort()).toEqual(
      [
        'accordion-panel-right',
        'carousel-cards',
        'grid-five-column-equal',
        'grid-four-column-equal',
        'grid-four-column-equal-cards',
        'split-layout-asymmetric',
        'sticky-sidebar-left',
        'sticky-sidebar-left-full-bleed',
        'tabs-panel-below',
        'wide-card-internal-columns',
      ].sort(),
    );
  });
});

describe('oldNameFor', () => {
  it('maps a renamed new name back to its old (component-governance-frozen) name', () => {
    expect(oldNameFor('accordion-panel-right')).toBe('feature-accordion');
    expect(oldNameFor('sticky-sidebar-left-full-bleed')).toBe('how-it-works');
    expect(oldNameFor('wide-card-internal-columns')).toBe('testimonial-stack');
  });

  it('is the identity for a name that was never renamed', () => {
    expect(oldNameFor('hero-bento')).toBe('hero-bento');
    expect(oldNameFor('divider')).toBe('divider');
  });
});

describe('newNameFor', () => {
  it('is the exact inverse of oldNameFor for every renamed section', () => {
    for (const newName of Object.keys(RENAMED_SECTIONS)) {
      expect(newNameFor(oldNameFor(newName))).toBe(newName);
    }
  });

  it('is the identity for a name that was never renamed', () => {
    expect(newNameFor('hero-bento')).toBe('hero-bento');
  });
});
