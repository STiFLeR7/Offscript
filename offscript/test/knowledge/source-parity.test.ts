/**
 * PKG — Repository Builder: serialization-independence.
 *
 * The YAML adapter and the (temporary) Markdown adapter must produce the IDENTICAL
 * normalized model from equivalent input — proving nothing downstream depends on the
 * source serialization, and that removing the Markdown adapter is loader-only.
 */
import { describe, it, expect } from 'vitest';
import { parseYamlText } from '../../src/knowledge/source/yaml-source.js';
import { parseMarkdownText } from '../../src/knowledge/source/markdown-source.js';
import { parseAsset, assetCanonical } from '../../src/knowledge/model.js';
import { digest } from '../../src/knowledge/digest.js';

const YAML_DOC = `schema_version: "1.0"
kind: component
identity:
  id: "canonical::button"
  title: "Button"
ownership:
  owner: "offscript-authority"
scope:
  class: canonical
  identity: "offscript"
governance:
  authority: canonical-global
semantics:
  produces:
    - "concept:interactive-affordance"
`;

const MARKDOWN_DOC = `---
${YAML_DOC}---

# Button

Prose body that the adapter ignores entirely.
`;

describe('YAML ≡ Markdown — identical normalized model', () => {
  it('parses to byte-identical canonical assets', () => {
    const fromYaml = parseAsset(parseYamlText(YAML_DOC, 'y'), 'loc');
    const fromMd = parseAsset(parseMarkdownText(MARKDOWN_DOC, 'm'), 'loc');
    expect(fromYaml.findings).toEqual([]);
    expect(fromMd.findings).toEqual([]);
    expect(digest(assetCanonical(fromMd.asset!))).toBe(digest(assetCanonical(fromYaml.asset!)));
  });

  it('rejects a markdown package with no frontmatter (fail-loud)', () => {
    expect(() => parseMarkdownText('# just prose\n', 'm')).toThrow();
  });

  it('tolerates a UTF-8 BOM and leading blank lines before the frontmatter', () => {
    const withBom = '﻿\n\n' + MARKDOWN_DOC;
    const fromBom = parseAsset(parseMarkdownText(withBom, 'm'), 'loc');
    const fromPlain = parseAsset(parseMarkdownText(MARKDOWN_DOC, 'm'), 'loc');
    expect(fromBom.findings).toEqual([]);
    expect(digest(assetCanonical(fromBom.asset!))).toBe(digest(assetCanonical(fromPlain.asset!)));
  });
});

describe('YAML adapter — prohibited constructs', () => {
  it('rejects anchors/aliases', () => {
    expect(() => parseYamlText('a: &x 1\nb: *x\n', 'y')).toThrow();
  });

  it('rejects multiple documents', () => {
    expect(() => parseYamlText('a: 1\n---\nb: 2\n', 'y')).toThrow();
  });

  it('rejects duplicate keys', () => {
    expect(() => parseYamlText('a: 1\na: 2\n', 'y')).toThrow();
  });
});
