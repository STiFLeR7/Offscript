/**
 * Deliverable Naming — the deployable HTML no longer writes to a fixed `index.html`; it writes to
 * the brand's own slug (Brief Contract's optional `brand:` field, brief.ts:47 — falling back to
 * the client id when the brief carries none), auto-versioned so a regeneration in the same
 * `outDir` never silently overwrites a prior deliverable: `<slug>.html`, then `<slug>(2).html`,
 * `<slug>(3).html`, ... — the first name not already on disk.
 *
 * Resolved ONCE per run (`scripts/generate.ts`, before the first write) and threaded through
 * `ValidateLoopDriverOptions.deliverableFilename` so the initial pre-validate write and the final
 * WS8-flattened write target the SAME file — never independently re-derived (which could pick two
 * different filenames within a single run, since the first write makes the base name exist).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function toSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'site'
  );
}

/**
 * Resolves the deployable's own filename for this run: `<slug>.html`, or `<slug>(N).html` for the
 * first `N` >= 2 not already present in `outDir`. `brand` is the Brief's own optional `brand:`
 * field; `client` is the fallback when no brand name was given.
 */
export function resolveDeliverableFilename(outDir: string, brand: string | undefined, client: string): string {
  const slug = toSlug(brand ?? client);
  const base = `${slug}.html`;
  if (!existsSync(join(outDir, base))) return base;
  let n = 2;
  while (existsSync(join(outDir, `${slug}(${n}).html`))) n++;
  return `${slug}(${n}).html`;
}
