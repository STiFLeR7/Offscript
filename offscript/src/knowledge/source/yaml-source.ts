/**
 * PKG — Repository Builder: the canonical YAML source adapter (ES-1 serialization).
 *
 * The ONLY YAML-aware code in the Builder. Parses an ES-1 document into a loose
 * band-shaped object and rejects prohibited constructs (anchors, aliases, multiple
 * documents, duplicate keys). Everything downstream consumes the normalized model,
 * not these bytes — removing/adding a source adapter touches only this folder.
 */
import { readFileSync } from 'node:fs';
import { parseAllDocuments, visit, type Document } from 'yaml';
import { KnowledgeError } from '../finding.js';

/** Parse + validate YAML text into a loose object (throws KnowledgeError loudly). */
export function parseYamlText(text: string, location: string): unknown {
  const docs = parseAllDocuments(text, { uniqueKeys: true });
  if (docs.length === 0) {
    throw new KnowledgeError(`${location}: empty document`);
  }
  if (docs.length > 1) {
    throw new KnowledgeError(`${location}: multiple YAML documents are prohibited`);
  }
  const doc = docs[0] as Document.Parsed;
  if (doc.errors.length > 0) {
    throw new KnowledgeError(`${location}: ${doc.errors[0].message}`);
  }
  assertNoProhibitedConstructs(doc, location);
  return doc.toJS();
}

function assertNoProhibitedConstructs(doc: Document.Parsed, location: string): void {
  let violation: string | null = null;
  visit(doc, {
    Alias() {
      violation = 'YAML aliases are prohibited';
      return visit.BREAK;
    },
    Node(_key, node) {
      const anchored = node as { anchor?: string };
      if (anchored.anchor) {
        violation = 'YAML anchors are prohibited';
        return visit.BREAK;
      }
      return undefined;
    },
  });
  if (violation) throw new KnowledgeError(`${location}: ${violation}`);
}

export function readYamlFile(file: string, location: string): unknown {
  return parseYamlText(readFileSync(file, 'utf8'), location);
}
