import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { designProcessesDir } from './paths.js';

/** The web-page rail-set guardrail docs live under the governance layer at
 *  resources/design_processes/website/ (the cross-track reference defaults lives
 *  under resources/design_principles/). */
export const referencesDir = designProcessesDir('website');

/** Read a guardrail markdown file (`references/<name>.md`) as the actuator's embedded bounds. */
export function loadReference(name: string): string {
  return readFileSync(join(referencesDir, `${name}.md`), 'utf8');
}

/**
 * Graceful variant of {@link loadReference}: returns the doc, or `undefined`
 * when it isn't on disk. The instruction composer's rail-finding-bounds section
 * uses this so the harden path degrades (names the absent doc) instead of
 * crashing when a guardrail doc — e.g. the website-pivot-removed
 * `color-expansion.md` / `theme-orchestration.md` / `anti-slop-checklist.md` —
 * is not present for the active track.
 */
export function tryLoadReference(name: string): string | undefined {
  const p = join(referencesDir, `${name}.md`);
  return existsSync(p) ? readFileSync(p, 'utf8') : undefined;
}
