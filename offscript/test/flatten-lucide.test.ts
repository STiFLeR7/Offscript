import { describe, it, expect } from 'vitest';
import { substituteLucide } from '../src/flatten/lucide.js';

describe('substituteLucide', () => {
  it('replaces a known icon (check) with an inline svg and removes the placeholder', () => {
    const { html, warnings } = substituteLucide('<i data-lucide="check"></i>');
    expect(warnings).toEqual([]);
    expect(html).not.toContain('data-lucide');
    expect(html).toContain('<svg');
    // Lucide's check path
    expect(html).toContain('M20 6 9 17l-5-5');
  });

  it('substitutes arrow-right', () => {
    const { html, warnings } = substituteLucide('<i data-lucide="arrow-right"></i>');
    expect(warnings).toEqual([]);
    expect(html).toContain('<svg');
    expect(html).toContain('M5 12h14');
    expect(html).not.toContain('data-lucide');
  });

  it('preserves width/height/stroke-width from style on the emitted svg', () => {
    const { html, warnings } = substituteLucide(
      '<i data-lucide="check" style="width:28px;height:28px;stroke-width:2.5"></i>',
    );
    expect(warnings).toEqual([]);
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
    expect(html).toContain('stroke-width="2.5"');
  });

  it('preserves width/height/stroke-width from attributes on the emitted svg', () => {
    const { html, warnings } = substituteLucide(
      '<i data-lucide="check" width="32" height="32" stroke-width="3"></i>',
    );
    expect(warnings).toEqual([]);
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
    expect(html).toContain('stroke-width="3"');
  });

  it('uses default sizing when none is supplied', () => {
    const { html } = substituteLucide('<i data-lucide="check"></i>');
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
  });

  it('carries over a class from the placeholder onto the svg', () => {
    const { html } = substituteLucide('<i data-lucide="check" class="icon big"></i>');
    expect(html).toContain('icon');
    expect(html).toContain('big');
  });

  it('leaves an unknown icon intact and emits a warning', () => {
    const { html, warnings } = substituteLucide('<i data-lucide="frobnicate"></i>');
    expect(html).toContain('data-lucide="frobnicate"');
    expect(html).not.toContain('<svg');
    expect(warnings).toEqual(['unknown lucide icon: "frobnicate"']);
  });

  it('substitutes all icons in a fragment, warning only for unknowns', () => {
    const input =
      '<div><i data-lucide="check"></i><span><i data-lucide="arrow-right"></i></span><i data-lucide="frobnicate"></i></div>';
    const { html, warnings } = substituteLucide(input);
    expect(html).toContain('M20 6 9 17l-5-5'); // check
    expect(html).toContain('M5 12h14'); // arrow-right
    expect(html).toContain('data-lucide="frobnicate"'); // unknown stays
    expect(warnings).toEqual(['unknown lucide icon: "frobnicate"']);
  });

  it('returns html unchanged with empty warnings when no icons present', () => {
    const input = '<div><p>Hello</p></div>';
    const { html, warnings } = substituteLucide(input);
    expect(warnings).toEqual([]);
    expect(html).toContain('Hello');
    expect(html).not.toContain('<svg');
  });
});
