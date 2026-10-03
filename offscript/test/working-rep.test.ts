import { describe, it, expect } from 'vitest';
import { parseHtml, serializeHtml, findElement, visitElements } from '../src/working-rep.js';

describe('working-rep', () => {
  it('parses a document and finds the html element', () => {
    const tree = parseHtml('<!doctype html><html><head></head><body></body></html>');
    const html = findElement(tree, 'html');
    expect(html?.tagName).toBe('html');
  });

  it('round-trips html content through parse and serialize', () => {
    const input = '<!doctype html><html><head></head><body><p>hi</p></body></html>';
    const out = serializeHtml(parseHtml(input));
    expect(out).toContain('<p>hi</p>');
  });

  it('returns undefined for an element that is not present', () => {
    const tree = parseHtml('<!doctype html><html><head></head><body></body></html>');
    expect(findElement(tree, 'nav')).toBeUndefined();
  });

  it('visits every element depth-first', () => {
    const tree = parseHtml('<!doctype html><html><head><style></style></head><body><p></p></body></html>');
    const tags: string[] = [];
    visitElements(tree, (el) => tags.push(el.tagName));
    expect(tags).toEqual(['html', 'head', 'style', 'body', 'p']);
  });
});
