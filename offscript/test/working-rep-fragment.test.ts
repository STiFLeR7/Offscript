import { describe, it, expect } from 'vitest';
import { parseFragment, serializeHtml, findElement } from '../src/working-rep.js';

describe('parseFragment', () => {
  it('parses a bare fragment without wrapping it in html/body', () => {
    const tree = parseFragment('<div id="x"><footer class="cr-page-foot"><span>a</span></footer></div>');
    expect(findElement(tree, 'html')).toBeUndefined();
    expect(findElement(tree, 'div')?.properties?.id).toBe('x');
  });
  it('round-trips a fragment', () => {
    const frag = '<div id="x"><p>hi</p></div>';
    expect(serializeHtml(parseFragment(frag))).toBe(frag);
  });
});
