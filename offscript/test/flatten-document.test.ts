import { describe, it, expect } from 'vitest';
import { assembleDocument } from '../src/flatten/document.js';

describe('assembleDocument', () => {
  it('produces a well-formed document', () => {
    const html = assembleDocument({ rootMarkup: '<p>hi</p>', tokensCss: ':root{}' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('inlines tokensCss verbatim inside a <style>, never a <link>', () => {
    const tokensCss = ':root{--cr-accent:#149DFF;}';
    const html = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss });
    expect(html).toContain('--cr-accent:#149DFF');
    expect(html).not.toContain('<link');
    // token must appear within a style block
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    expect(html).toMatch(/<style>[\s\S]*--cr-accent:#149DFF[\s\S]*<\/style>/);
  });

  it('inlines inlineStyle after tokensCss when provided', () => {
    const html = assembleDocument({
      rootMarkup: '<p>x</p>',
      tokensCss: '/*TOKENS*/',
      inlineStyle: '/*HARNESS*/',
    });
    expect(html).toContain('/*TOKENS*/');
    expect(html).toContain('/*HARNESS*/');
    expect(html.indexOf('/*TOKENS*/')).toBeLessThan(html.indexOf('/*HARNESS*/'));
  });

  it('emits no stray empty style block when inlineStyle omitted', () => {
    const html = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss: '/*T*/' });
    expect(html).not.toContain('<style></style>');
    // exactly one style block (the tokens one)
    expect((html.match(/<style>/g) ?? []).length).toBe(1);
  });

  it('emits two style blocks when inlineStyle provided', () => {
    const html = assembleDocument({
      rootMarkup: '<p>x</p>',
      tokensCss: '/*T*/',
      inlineStyle: '/*H*/',
    });
    expect((html.match(/<style>/g) ?? []).length).toBe(2);
  });

  it('wraps rootMarkup verbatim inside <div id="root"> in the body', () => {
    const rootMarkup = '<section class="hero"><h1>Hi & welcome</h1></section>';
    const html = assembleDocument({ rootMarkup, tokensCss: ':root{}' });
    expect(html).toContain(`<div id="root">${rootMarkup}</div>`);
    // verbatim: ampersand not escaped
    expect(html).toContain('Hi & welcome');
  });

  it('emits no <script> and no <link> tags when no script is passed', () => {
    const html = assembleDocument({
      rootMarkup: '<p>x</p>',
      tokensCss: ':root{}',
      inlineStyle: '/*h*/',
    });
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
  });

  it('embeds the behaviour script verbatim AFTER #root, before </body>', () => {
    const script = '(function(){window.__crBehaviour=true;})();';
    const html = assembleDocument({
      rootMarkup: '<section class="hero">hi</section>',
      tokensCss: ':root{}',
      script,
    });
    expect(html).toContain(`<script>${script}</script>`);
    // exactly one script block, and it lands after the #root div, before </body>
    expect((html.match(/<script>/g) ?? []).length).toBe(1);
    expect(html.indexOf('<div id="root">')).toBeLessThan(html.indexOf('<script>'));
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</body>'));
    // the script stays in <body>, never the <head>
    expect(html.indexOf('</head>')).toBeLessThan(html.indexOf('<script>'));
  });

  it('omits the <script> tag entirely when script is undefined', () => {
    const html = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss: ':root{}' });
    expect(html).not.toContain('<script');
  });

  it('honors lang override', () => {
    const html = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss: ':root{}', lang: 'fr' });
    expect(html).toContain('<html lang="fr">');
  });

  it('renders title when provided, absent when not', () => {
    const withTitle = assembleDocument({
      rootMarkup: '<p>x</p>',
      tokensCss: ':root{}',
      title: 'My Page',
    });
    expect(withTitle).toContain('<title>My Page</title>');

    const without = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss: ':root{}' });
    expect(without).not.toContain('<title>');
  });

  it('escapes a title containing <, </title>, and &', () => {
    const html = assembleDocument({
      rootMarkup: '<p>x</p>',
      tokensCss: ':root{}',
      title: 'A < B & </title> end',
    });
    expect(html).toContain('<title>A &lt; B &amp; &lt;/title&gt; end</title>');
    expect(html).not.toContain('</title> end');
    expect((html.match(/<title>/g) ?? []).length).toBe(1);
    expect((html.match(/<\/title>/g) ?? []).length).toBe(1);
  });

  it('passes through multi-line tokensCss verbatim (real newlines)', () => {
    const tokensCss = ':root{\n  --cr-accent: #149DFF;\n}\n.btn {\n  color: var(--cr-accent);\n}';
    const html = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss });
    expect(html).toContain(tokensCss);
    expect(html).toContain('\n  --cr-accent: #149DFF;\n');
  });

  it('includes charset and viewport meta', () => {
    const html = assembleDocument({ rootMarkup: '<p>x</p>', tokensCss: ':root{}' });
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    );
  });
});
