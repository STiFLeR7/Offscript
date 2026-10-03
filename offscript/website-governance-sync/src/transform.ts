/**
 * The one load-bearing content transform (W1 §6/§7): rewrite the section-identifier
 * vocabulary the new design/website governance uses (`section-library/sections/<name>.html`,
 * `components.md`'s post-rename Variant ids) back into the vocabulary the engine's existing,
 * UNMODIFIED parsers already resolve (`component-<old-name>.html`). Both COMPOSITION.md's File
 * column and components.md's Variant appendix carry the same 10 renamed identities and must
 * agree, or knowledge/inheritance.ts's variant→family join breaks for exactly those 10 rows.
 */
import { oldNameFor, RENAMED_SECTIONS } from './rename-map.js';

const FILE_CELL_RE = /`\.\.\/\.\.\/\.\.\/section-library\/sections\/([a-z0-9-]+)\.html`/g;

/** Rewrite every `../../../section-library/sections/<name>.html` File cell to `component-<old>.html`. */
export function transformCompositionMd(md: string): string {
  return md.replace(FILE_CELL_RE, (_match, name: string) => `\`component-${oldNameFor(name)}.html\``);
}

const APPENDIX_HEADING_RE = /^##\s+Variant appendix/i;

function transformVariantRow(line: string): string {
  if (!line.trim().startsWith('|')) return line;
  const cells = line.split('|');
  if (cells.length < 4) return line; // not a 3+-cell table row
  const variantCell = cells[2];
  const trimmed = variantCell.trim();
  if (trimmed in RENAMED_SECTIONS) {
    cells[2] = variantCell.replace(trimmed, oldNameFor(trimmed));
  }
  return cells.join('|');
}

/**
 * Rewrite the Variant appendix's Variant column (only), post-heading, so a renamed section's
 * canonical id matches what COMPOSITION.md now resolves to after transformCompositionMd.
 * Prose before the appendix — even prose that happens to name a renamed id — is untouched.
 */
export function transformComponentsMd(md: string): string {
  const lines = md.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => APPENDIX_HEADING_RE.test(l));
  if (headingIdx === -1) return md;
  const before = lines.slice(0, headingIdx + 1);
  const after = lines.slice(headingIdx + 1).map(transformVariantRow);
  return [...before, ...after].join('\n');
}
