/**
 * Reference-loading boundary for the future Creative Generation capability.
 *
 * Mirrors offscript/src/cross-track-governance.ts's try/strict loader pattern and
 * offscript/src/paths.ts's import.meta.url-relative root resolution — reimplemented
 * locally rather than imported, matching this repo's standalone-package
 * convention (see creative-intent-brief-adapter/src/validator/digest.ts's
 * documented precedent: standalone packages duplicate small shared logic
 * rather than reach into offscript/src/, avoiding a reverse dependency).
 *
 * Reads ONLY resources/design_processes/creative/ — never the external,
 * historical/experimental Creative Generation source repo (not a runtime
 * dependency of this package), and never anything under offscript/src/.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
/** This package's own root (creative-generation/). */
export const packageRoot = resolve(here, '..');
/** The engine root this package is a sibling of (offscript/). Never offscript/src/ — only its path. */
export const engineRoot = resolve(packageRoot, '..');
/** The one directory this package is allowed to read creative governance from. */
export const creativeReferencesDir = (): string =>
  join(engineRoot, 'resources', 'design_processes', 'creative');

/** Read a creative governance reference file whole, or undefined when absent. */
export function tryLoadCreativeReference(name: string): string | undefined {
  const p = join(creativeReferencesDir(), name);
  return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
}

/** Strict variant — throws a clear, specific error when the reference is missing. */
export function loadCreativeReference(name: string): string {
  const content = tryLoadCreativeReference(name);
  if (content === undefined) {
    throw new Error(
      `creative-generation: no reference named "${name}" at ${join(creativeReferencesDir(), name)}. ` +
        `Creative governance has not been synced into resources/design_processes/creative/ yet ` +
        `(see resources/design_processes/creative/_PENDING.md).`,
    );
  }
  return content;
}

/** Whether creative governance has been synced into the runtime-readable mirror at all. */
export function creativeReferencesAvailable(): boolean {
  return existsSync(creativeReferencesDir());
}
