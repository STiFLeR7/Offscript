/**
 * The 10 section identities renamed during the section-library correctness pass
 * (design/website/section-library/MIGRATION.md). Every other of the 79 sections is a pure
 * `component-` prefix drop (identity name otherwise) and needs no entry here.
 *
 * Keyed by the NEW name (section-library/sections/<name>.html); value is the OLD name the
 * engine's live parsers (composition-md.ts slugFromFile, inheritance.ts's Variant appendix)
 * already resolve as `component-<old-name>.html` / a bare variant id. The sync pipeline
 * translates new → old on the way into resources so those parsers need no code change.
 */
export const RENAMED_SECTIONS: Readonly<Record<string, string>> = Object.freeze({
  'grid-five-column-equal': 'backed-by',
  'carousel-cards': 'case-carousel',
  'accordion-panel-right': 'feature-accordion',
  'sticky-sidebar-left-full-bleed': 'how-it-works',
  'grid-four-column-equal-cards': 'stat-cards',
  'sticky-sidebar-left': 'sticky-cards',
  'tabs-panel-below': 'tabbed-showcase',
  'wide-card-internal-columns': 'testimonial-stack',
  'grid-four-column-equal': 'value-prop',
  'split-layout-asymmetric': 'value-stats',
});

const OLD_TO_NEW: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(RENAMED_SECTIONS).map(([newName, oldName]) => [oldName, newName])),
);

/** New name → the old name the engine's resources parsers resolve. Identity if never renamed. */
export function oldNameFor(newName: string): string {
  return RENAMED_SECTIONS[newName] ?? newName;
}

/** Old name → the new section-library name. Identity if never renamed. Exact inverse of oldNameFor. */
export function newNameFor(oldName: string): string {
  return OLD_TO_NEW[oldName] ?? oldName;
}
