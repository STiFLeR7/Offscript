/**
 * Sprint 10A — the runtime side of the Feature Mapping port. Reads the seven-row
 * intent→components table from FEATURE-MAPPING.md through the existing reference-loading
 * boundary (references.ts) — the document is the sole source of truth for the component
 * lists; this file contains no independent copy of them, only a parser plus the row-label
 * lookup needed to connect the document's prose headings to CreativeIntent's `feature` enum.
 *
 * `Feature` is duplicated locally rather than imported from creative-intent-exporter,
 * mirroring this repo's established standalone-package precedent (see producer.ts's own
 * header comment, and creative-intent-brief-adapter/src/mapper/types.ts).
 */
import { loadCreativeReference } from './references.js';

export type Feature =
  | 'automation'
  | 'search'
  | 'analytics'
  | 'security'
  | 'collaboration'
  | 'ai-intelligence'
  | 'configuration';

/** The document's own row-label prose, per feature — structural glue for parsing, not methodology content. */
const ROW_LABEL: Record<Feature, string> = {
  automation: 'Automation',
  search: 'Search / retrieval',
  analytics: 'Analytics',
  security: 'Security',
  collaboration: 'Collaboration',
  'ai-intelligence': 'AI intelligence',
  configuration: 'Configuration',
};

const TABLE_ROW_RE = /^\|\s*`[^`]+`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;

function parseComponentsByLabel(doc: string): Map<string, string[]> {
  const byLabel = new Map<string, string[]>();
  for (const match of doc.matchAll(TABLE_ROW_RE)) {
    const label = match[1].trim();
    const components = match[2]
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean);
    byLabel.set(label, components);
  }
  return byLabel;
}

/**
 * Resolves a CreativeIntent `feature` value to its documented component list, read fresh from
 * FEATURE-MAPPING.md on every call. Returns an empty, frozen array for an unrecognized feature
 * (fail-safe — never throws on bad input) or when the reference has never been synced (the
 * infra-error case is `loadCreativeReference`'s own concern, not this function's).
 */
export function componentsForFeature(feature: string): readonly string[] {
  const label = ROW_LABEL[feature as Feature];
  if (!label) return Object.freeze([]);
  const doc = loadCreativeReference('FEATURE-MAPPING.md');
  const byLabel = parseComponentsByLabel(doc);
  const components = byLabel.get(label);
  return components ? Object.freeze([...components]) : Object.freeze([]);
}
