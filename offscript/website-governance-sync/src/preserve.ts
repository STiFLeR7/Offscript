/**
 * The preserve-list (W1 §5.3 / §7 step 3): live, engine-load-bearing artifacts under
 * resources/design_processes/website/ with NO design/website source at all — `behavior.js`
 * (author.ts, fail-loud), `exemplars/fragments/*.html` (author-contract.ts's selectExemplar,
 * soft-degrading), `imagery.md` (imagery-manifest.ts, fail-loud). The sync must never write to
 * or delete these; they are copy-through only.
 *
 * Anything else already in the target that this sync's flatten plan doesn't (re)write is an
 * UNACCOUNTED file, not a preserve-list entry — it is carried forward untouched too, but
 * surfaced as a warning (see sync.ts), because an unnamed exception is exactly how a real
 * orphan (e.g. hero-bg-night.jpg, discovered during W2's own grounding) would otherwise go
 * unnoticed forever. The preserve-list is deliberately the SMALL, NAMED, asserted-safe subset;
 * "unaccounted" is the dynamic, self-auditing catch-all.
 */

const PRESERVE_EXACT: ReadonlySet<string> = new Set(['behavior.js', 'imagery.md']);
const PRESERVE_DIR_PREFIXES: readonly string[] = ['exemplars/fragments/'];

export const PRESERVE_LIST = Object.freeze({ exact: [...PRESERVE_EXACT], dirPrefixes: [...PRESERVE_DIR_PREFIXES] });

/** Is this target-relative path on the preserve-list? */
export function isPreserved(targetRelPath: string): boolean {
  if (PRESERVE_EXACT.has(targetRelPath)) return true;
  return PRESERVE_DIR_PREFIXES.some((prefix) => targetRelPath.startsWith(prefix));
}

export interface ClassifyResult {
  /** Existing target files this sync (re)writes — a normal, expected overwrite. */
  readonly overwritten: string[];
  /** Existing target files on the preserve-list — copied through unchanged, no warning. */
  readonly preserved: string[];
  /** Existing target files neither written nor preserve-listed — carried forward, WARNED. */
  readonly unaccounted: string[];
}

/**
 * Classify every existing target-relative file into exactly one bucket. Fails loud if the
 * write-plan and the preserve-list ever overlap — that would mean the sync is about to
 * overwrite a file explicitly asserted as engine-owned-and-untouchable, a contradiction that
 * must stop the run rather than silently pick a winner.
 */
export function classifyExistingTargetFiles(
  existingTargetRelPaths: readonly string[],
  writtenRelPaths: ReadonlySet<string>,
): ClassifyResult {
  const overwritten: string[] = [];
  const preserved: string[] = [];
  const unaccounted: string[] = [];

  for (const path of existingTargetRelPaths) {
    const written = writtenRelPaths.has(path);
    const preserve = isPreserved(path);
    if (written && preserve) {
      throw new Error(
        `classifyExistingTargetFiles: "${path}" is both about to be written AND on the preserve-list — ` +
          `a preserve-list entry must never also be a flatten target.`,
      );
    }
    if (written) overwritten.push(path);
    else if (preserve) preserved.push(path);
    else unaccounted.push(path);
  }

  return { overwritten, preserved, unaccounted };
}
