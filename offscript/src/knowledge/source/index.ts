/**
 * PKG — Repository Builder: the loader (ES-2 stage 3) — the ONLY serialization-aware
 * layer. It discovers packages, dispatches to a source adapter by format, and emits
 * the normalized model + parse findings + governed vocabulary. Source-format choice
 * never escapes this folder. A `deps` override enables disk-free, growth-safe tests.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from '../finding.js';
import { KnowledgeError } from '../finding.js';
import { parseAsset, type NormalizedAsset } from '../model.js';
import { EMPTY_VOCABULARY, makeVocabulary, type GovernedVocabulary } from '../vocabulary.js';
import { discoverPackages, type PackageHandle } from './scan.js';
import { parseYamlText, readYamlFile } from './yaml-source.js';
import { readMarkdownFile } from './markdown-source.js';

export interface LoadedRepository {
  readonly assets: readonly NormalizedAsset[];
  readonly parseFindings: readonly Finding[];
  readonly vocabulary: GovernedVocabulary;
}

export interface LoaderDeps {
  discover?(root: string): PackageHandle[];
  readDoc?(handle: PackageHandle): unknown;
  loadVocabulary?(root: string): GovernedVocabulary;
}

function defaultRead(handle: PackageHandle): unknown {
  return handle.format === 'markdown'
    ? readMarkdownFile(handle.file, handle.location)
    : readYamlFile(handle.file, handle.location);
}

function defaultLoadVocabulary(root: string): GovernedVocabulary {
  const file = join(root, 'vocabulary.yaml');
  if (!existsSync(file)) return EMPTY_VOCABULARY;
  const raw = parseYamlText(readFileSync(file, 'utf8'), 'vocabulary.yaml');
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new KnowledgeError('vocabulary.yaml: expected a mapping');
  }
  const r = raw as Record<string, unknown>;
  const arr = (key: string): string[] => {
    const v = r[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
      throw new KnowledgeError(`vocabulary.yaml: ${key} must be string[]`);
    }
    return v as string[];
  };
  return makeVocabulary({
    concepts: arr('concepts'),
    capabilities: arr('capabilities'),
    obligations: arr('obligations'),
    owners: arr('owners'),
    scopeIdentities: arr('scope_identities'),
    guarantees: arr('guarantees'),
  });
}

export function loadRepository(root: string, deps: LoaderDeps = {}): LoadedRepository {
  const discover = deps.discover ?? discoverPackages;
  const readDoc = deps.readDoc ?? defaultRead;
  const loadVocabulary = deps.loadVocabulary ?? defaultLoadVocabulary;

  const assets: NormalizedAsset[] = [];
  const parseFindings: Finding[] = [];
  for (const handle of discover(root)) {
    let loose: unknown;
    try {
      loose = readDoc(handle);
    } catch (e) {
      parseFindings.push({
        stage: 'load',
        code: 'LOAD_ERROR',
        location: handle.location,
        message: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    const { asset, findings } = parseAsset(loose, handle.location);
    parseFindings.push(...findings);
    if (asset) assets.push(asset);
  }
  return { assets, parseFindings, vocabulary: loadVocabulary(root) };
}

export type { PackageHandle } from './scan.js';
