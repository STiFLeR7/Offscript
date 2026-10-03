import { parse } from 'yaml';
import type { Root, Element } from 'hast';
import { visitElements } from './working-rep.js';

/** A declared semantic section — the Tier-1 anchor backbone (spec §4.1). */
export interface SectionAnchor {
  /** the declared section id (human-authored, stable), e.g. "hero", "primary-nav" */
  id: string;
  /** the HTML element id that locates this section's root — the declared anchor (never nth-child) */
  anchor: string;
  /** the ARIA landmark role this section must carry, if it is a landmark (e.g. "navigation", "main") */
  landmark?: string;
}

/** The sections map: the declared "where" (spec §4.1), authored once and persisted. */
export interface SectionsModel {
  sections: SectionAnchor[];
  /** section id -> anchor, for direct lookup */
  byId: Map<string, SectionAnchor>;
}

/** Parse a sections.md YAML block into the canonical SectionsModel. */
export function loadSections(yamlText: string): SectionsModel {
  const data = parse(yamlText) as { sections?: unknown } | null;
  const raw = data && Array.isArray(data.sections) ? data.sections : [];
  const sections: SectionAnchor[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      if (typeof e.id === 'string' && typeof e.anchor === 'string') {
        sections.push({
          id: e.id,
          anchor: e.anchor,
          landmark: typeof e.landmark === 'string' ? e.landmark : undefined,
        });
      }
    }
  }
  const byId = new Map(sections.map((s) => [s.id, s] as const));
  return { sections, byId };
}

/** Tier-1 anchor resolution: locate a declared section's root element by its declared HTML id. */
export function resolveAnchor(tree: Root, section: SectionAnchor): Element | undefined {
  let found: Element | undefined;
  visitElements(tree, (el) => {
    if (!found && el.properties?.id === section.anchor) found = el;
  });
  return found;
}
