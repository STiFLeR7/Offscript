/**
 * PKG — Repository Builder: TEMPORARY Markdown source adapter.
 *
 * Lets the repository be built/validated from Markdown today, while ES-1 YAML is
 * the canonical serialization. It reads the document's YAML frontmatter (the same
 * band-shaped object the YAML adapter yields) and ignores the prose body. Because
 * the Builder consumes only the normalized model, removing this adapter later is a
 * loader-layer-only change — nothing downstream depends on the source format.
 *
 * (A richer adapter that maps existing resources prose governance into packages
 * is later loader work; it does not change the model or any downstream stage.)
 */
import { readFileSync } from 'node:fs';
import { KnowledgeError } from '../finding.js';
import { parseYamlText } from './yaml-source.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n[\s\S]*)?$/;

export function parseMarkdownText(text: string, location: string): unknown {
  // Tolerate a UTF-8 BOM and leading blank lines before the frontmatter fence — both
  // are common in authored docs and neither changes the metadata.
  const normalized = text.replace(/^﻿/, '').replace(/^(?:[ \t]*\r?\n)+/, '');
  const m = FRONTMATTER.exec(normalized);
  if (!m) {
    throw new KnowledgeError(`${location}: markdown package requires a leading YAML frontmatter block`);
  }
  return parseYamlText(m[1], location);
}

export function readMarkdownFile(file: string, location: string): unknown {
  return parseMarkdownText(readFileSync(file, 'utf8'), location);
}
