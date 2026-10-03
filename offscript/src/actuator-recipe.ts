/**
 * actuator-recipe/ — durable bounds-replay of judgment-actuator edits.
 *
 * The judgment actuator passes (contrast, brand-fidelity) edit the working
 * HTML via a dispatched Claude subagent. Those edits live ONLY in
 * `output/website/<brand>/index.html`. Any time `npm run harden --force`
 * regenerates that file from the mechanical baseline, the actuated state is
 * lost — and the only path back is dispatching the subagents again.
 *
 * This module captures each pass's edits as a deterministic find-and-replace
 * recipe persisted to disk. On harden, `scripts/harden.ts` replays the recipe
 * over the fresh mechanical baseline: if every `find` still matches, the
 * actuated state returns with no LLM. If a `find` no longer matches, a warning
 * is emitted flagging the pass + finding-ids that need re-actuation.
 *
 * Limit (documented, deliberate): `diffToRecipe` only catches VALUE-REPLACEMENT
 * diffs — substrings of `before` that are uniformly substituted for a different
 * substring in `after`. It does NOT catch structural diffs (inserted /
 * removed / reordered nodes). The judgment actuators we have today only do
 * value substitution (off-token colour → token var(), failing colour →
 * nearest on-brand colour), so this is the exact shape we need to capture.
 * Structural actuators, if they ever ship, will need a different recipe shape.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** A single replayable edit produced by one actuator pass. */
export interface RecipeEdit {
  /** Pass name that produced this edit (e.g. `contrast`, `brand-fidelity`). */
  pass: string;
  /** Finding ids the pass was addressing when it produced this edit. */
  findingIds: string[];
  /** Verbatim substring to find in the working HTML. */
  find: string;
  /** Verbatim substring to substitute in. */
  replace: string;
  /**
   * Occurrence count observed when the recipe was recorded. Replay warns if
   * the current document contains fewer matches (the source drifted).
   */
  expectedOccurrences: number;
}

/**
 * The full composed instruction handed to the actuator at decision time.
 * Snapshotted into the recipe so regen can detect a re-decide: if the freshly
 * composed instruction (with current creative-direction / playbook / brand
 * contract) byte-differs from the snapshot, the pass is flagged for re-decide
 * rather than blind replay.
 */
export interface PassSnapshot {
  pass: string;
  /** Set of finding ids the snapshot was composed against (sorted). */
  findingIds: string[];
  /** Byte-exact `composeInstruction(...)` output at decision time. */
  instructionSnapshot: string;
  /** ISO timestamp the snapshot was recorded. */
  decidedAt: string;
}

/**
 * A Tier-2 advisory proposal (M2 — Track B seam). Produced by the
 * `tier-2-advisory` pass for each escalated/frozen Tier-2 finding: the
 * subagent drafts a one-line CSS edit + rationale, but does NOT apply it.
 * `harden:review` is the interactive CLI that walks the human through each
 * proposal; accepted proposals get applied to `index.html` and appended to
 * the recipe's `edits[]` (via the existing `mergeRecipe` path); rejected
 * proposals stay as-is with `status: 'rejected'`.
 */
export interface TierTwoProposal {
  /** The finding id this proposal addresses (from the originating Tier-2 escalation). */
  findingId: string;
  /** The frozen overlay id (from overlay/<frozenId>.json), if the finding is already frozen. */
  frozenId?: string;
  /** Always 'tier-2-advisory' for v1; future advisory passes may add their own names. */
  pass: string;
  /**
   * The proposed edit, in actuator-recipe shape so accepted proposals slot
   * into `edits[]` without translation: a find/replace pair.
   */
  proposedEdit: { find: string; replace: string };
  /** Why this edit — referencing the playbook excerpt(s) that motivated it. */
  rationale: string;
  /** Subagent's self-assessed confidence in the proposal. */
  confidence: 'high' | 'medium' | 'low';
  /** Lifecycle: pending → accepted (applied) | rejected (kept frozen). */
  status: 'pending' | 'accepted' | 'rejected';
  /** ISO timestamp the proposal was drafted. */
  proposedAt: string;
  /** ISO timestamp the human decided; absent while pending. */
  decidedAt?: string;
}

/** Persisted recipe: edits + per-pass instruction snapshots + Tier-2 proposals. */
export interface ActuatorRecipe {
  generatedAt: string;
  edits: RecipeEdit[];
  /** Per-pass instruction snapshots; optional for backward compat. */
  snapshots?: PassSnapshot[];
  /**
   * Tier-2 advisory proposals (M2). Pending proposals are awaiting human
   * review; accepted ones have already been appended to `edits[]` and are
   * kept here only for audit; rejected ones explain the kept-frozen state.
   */
  proposals?: TierTwoProposal[];
}

/** Stable ordering: by (pass, find) — pure, deterministic. */
function sortEdits(edits: RecipeEdit[]): RecipeEdit[] {
  return [...edits].sort((a, b) => {
    if (a.pass !== b.pass) return a.pass < b.pass ? -1 : 1;
    if (a.find !== b.find) return a.find < b.find ? -1 : 1;
    return 0;
  });
}

/** Stable ordering: by (pass, findingIds-joined) — pure, deterministic. */
function sortSnapshots(snapshots: PassSnapshot[]): PassSnapshot[] {
  return [...snapshots].sort((a, b) => {
    if (a.pass !== b.pass) return a.pass < b.pass ? -1 : 1;
    const ka = a.findingIds.join(',');
    const kb = b.findingIds.join(',');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * Find an existing snapshot for a (pass, findingIds) key. Returns undefined
 * when the recipe has no snapshots section or no matching entry.
 */
export function findPassSnapshot(
  recipe: ActuatorRecipe | null,
  pass: string,
  findingIds: string[],
): PassSnapshot | undefined {
  if (!recipe?.snapshots) return undefined;
  const key = [...findingIds].sort().join(',');
  return recipe.snapshots.find(
    (s) => s.pass === pass && [...s.findingIds].sort().join(',') === key,
  );
}

/**
 * Merge a new snapshot into the recipe: same (pass, findingIds) ⇒ replace
 * (later wins); else append. Output sorted.
 */
export function mergePassSnapshot(
  existing: ActuatorRecipe | null,
  snapshot: PassSnapshot,
): PassSnapshot[] {
  const prior = existing?.snapshots ?? [];
  const key = [...snapshot.findingIds].sort().join(',');
  const filtered = prior.filter(
    (s) => !(s.pass === snapshot.pass && [...s.findingIds].sort().join(',') === key),
  );
  filtered.push({ ...snapshot, findingIds: [...snapshot.findingIds].sort() });
  return sortSnapshots(filtered);
}

/** Count occurrences of `needle` in `haystack` (non-overlapping). */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count += 1;
    i += needle.length;
  }
  return count;
}

/**
 * Extract candidate value substitutions from a before/after HTML pair.
 *
 * Strategy (v1, value-replacement only): scan both documents for inline-style
 * value fragments — `color:#fff`, `background:#0a0a0a`, `color:var(--x)`,
 * `background:var(--y)`, `background-color:...`, `border-color:...`, `fill:...`,
 * `stroke:...`. For each old fragment that appears in `before` but NOT in
 * `after`, AND has a corresponding new fragment that appears in `after` but
 * NOT in `before` with the SAME property, record an `(old → new)` pair if
 * exactly ONE such pair exists per old fragment (i.e. it's an unambiguous
 * substitution).
 *
 * This deliberately captures only the kind of edit our judgment actuators make.
 * Anything richer (structural rewrites, attribute additions) falls outside the
 * recipe — those edits will be lost on replay and need re-actuation. That's
 * the documented v1 limit.
 */
function extractValueSubstitutions(before: string, after: string): Array<{ find: string; replace: string }> {
  // Property: hex-or-var value; allow optional whitespace after the colon.
  // Captures the full fragment (property included) so replacement is unambiguous
  // — `#fff` alone would be too ambiguous; `color:#fff` is anchored.
  const fragmentRe = /(?:color|background|background-color|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color|fill|stroke|outline-color)\s*:\s*(?:#[0-9a-fA-F]{3,8}|var\(--[a-zA-Z0-9-_]+\)|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/g;

  const beforeFragments = new Set(before.match(fragmentRe) ?? []);
  const afterFragments = new Set(after.match(fragmentRe) ?? []);

  // Property name from a fragment: substring before ':'.
  const propOf = (frag: string): string => frag.slice(0, frag.indexOf(':')).trim();

  // Disappeared = in before, not in after. Appeared = in after, not in before.
  const disappeared = [...beforeFragments].filter((f) => !afterFragments.has(f));
  const appeared = [...afterFragments].filter((f) => !beforeFragments.has(f));

  // Group appeared by property — to match each disappeared fragment we need
  // the new-value candidates with the same property.
  const appearedByProp = new Map<string, string[]>();
  for (const f of appeared) {
    const p = propOf(f);
    const list = appearedByProp.get(p) ?? [];
    list.push(f);
    appearedByProp.set(p, list);
  }

  const pairs: Array<{ find: string; replace: string }> = [];
  for (const oldFrag of disappeared) {
    const candidates = appearedByProp.get(propOf(oldFrag)) ?? [];
    if (candidates.length !== 1) continue; // ambiguous — drop
    pairs.push({ find: oldFrag, replace: candidates[0] });
  }

  // Stable order: by find.
  pairs.sort((a, b) => (a.find < b.find ? -1 : a.find > b.find ? 1 : 0));
  return pairs;
}

/**
 * Diff a single actuator pass's before/after HTML into the minimum list of
 * value-substitution edits. See module doc for the documented v1 limit (only
 * value replacements; no structural diffs).
 */
export function diffToRecipe(opts: {
  before: string;
  after: string;
  pass: string;
  findingIds: string[];
}): RecipeEdit[] {
  if (opts.before === opts.after) return [];
  const pairs = extractValueSubstitutions(opts.before, opts.after);
  const edits: RecipeEdit[] = [];
  for (const { find, replace } of pairs) {
    const expectedOccurrences = countOccurrences(opts.before, find);
    if (expectedOccurrences === 0) continue;
    edits.push({
      pass: opts.pass,
      findingIds: [...opts.findingIds].sort(),
      find,
      replace,
      expectedOccurrences,
    });
  }
  return sortEdits(edits);
}

/**
 * Apply an actuator recipe to a fresh HTML string. Each edit's `find` is
 * substituted with its `replace` (all occurrences). If the observed
 * occurrence count is below `expectedOccurrences`, a warning is emitted.
 *
 * Idempotent: once `find` has been replaced everywhere, a second apply finds
 * zero matches and is a no-op (the warning fires because 0 < expected — that's
 * the correct signal that the source drifted).
 *
 * To make double-apply on the SAME fresh input truly a no-op we apply edits
 * via split/join rather than recursive replace, so a `replace` that contains
 * `find` as a substring doesn't double-apply.
 */
export function applyRecipe(html: string, recipe: ActuatorRecipe): { html: string; warnings: string[] } {
  let current = html;
  const warnings: string[] = [];
  for (const edit of recipe.edits) {
    const observed = countOccurrences(current, edit.find);
    if (observed < edit.expectedOccurrences) {
      warnings.push(
        `pass=${edit.pass} findings=[${edit.findingIds.join(',')}] expected ${edit.expectedOccurrences} occurrence(s) of ${JSON.stringify(edit.find)}, found ${observed}`,
      );
    }
    if (observed === 0) continue;
    // split/join: replaces all occurrences in one pass with no re-scan over
    // newly-inserted `replace` text — so even if `replace` contains `find`
    // it does not double-apply.
    current = current.split(edit.find).join(edit.replace);
  }
  return { html: current, warnings };
}

/** Stable-key JSON: recursively sorted object keys, 2-space indent, trailing newline. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer(value), 2) + '\n';
}

function sortedReplacer(root: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const k of Object.keys(v as Record<string, unknown>)) {
      keys.add(k);
      walk((v as Record<string, unknown>)[k]);
    }
  };
  walk(root);
  return Array.from(keys).sort();
}

function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Write a recipe as stable JSON. Idempotent: if the existing file's content
 * is byte-identical, the file is left untouched. Edits are sorted by
 * (pass, find) on write.
 */
export function writeRecipe(filePath: string, recipe: ActuatorRecipe): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized: ActuatorRecipe = {
    generatedAt: recipe.generatedAt,
    edits: sortEdits(recipe.edits),
  };
  if (recipe.snapshots && recipe.snapshots.length > 0) {
    const norm = recipe.snapshots.map((s) => ({ ...s, findingIds: [...s.findingIds].sort() }));
    normalized.snapshots = sortSnapshots(norm);
  }
  writeIfChanged(filePath, stableStringify(normalized));
}

/**
 * Read a recipe from disk. Returns `null` if the file does not exist; throws
 * on a malformed file (parse error, or missing `edits` array).
 */
export function readRecipe(filePath: string): ActuatorRecipe | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`actuator-recipe: malformed JSON at ${filePath}: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`actuator-recipe: expected an object at ${filePath}`);
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.edits)) {
    throw new Error(`actuator-recipe: missing 'edits' array at ${filePath}`);
  }
  const generatedAt = typeof obj.generatedAt === 'string' ? obj.generatedAt : '';
  const edits: RecipeEdit[] = [];
  for (const e of obj.edits as unknown[]) {
    if (e === null || typeof e !== 'object') {
      throw new Error(`actuator-recipe: malformed edit entry at ${filePath}`);
    }
    const er = e as Record<string, unknown>;
    if (
      typeof er.pass !== 'string' ||
      !Array.isArray(er.findingIds) ||
      typeof er.find !== 'string' ||
      typeof er.replace !== 'string' ||
      typeof er.expectedOccurrences !== 'number'
    ) {
      throw new Error(`actuator-recipe: malformed edit entry at ${filePath}`);
    }
    edits.push({
      pass: er.pass,
      findingIds: (er.findingIds as unknown[]).map(String),
      find: er.find,
      replace: er.replace,
      expectedOccurrences: er.expectedOccurrences,
    });
  }
  let snapshots: PassSnapshot[] | undefined;
  if (Array.isArray(obj.snapshots)) {
    snapshots = [];
    for (const s of obj.snapshots as unknown[]) {
      if (s === null || typeof s !== 'object') {
        throw new Error(`actuator-recipe: malformed snapshot entry at ${filePath}`);
      }
      const sr = s as Record<string, unknown>;
      if (
        typeof sr.pass !== 'string' ||
        !Array.isArray(sr.findingIds) ||
        typeof sr.instructionSnapshot !== 'string' ||
        typeof sr.decidedAt !== 'string'
      ) {
        throw new Error(`actuator-recipe: malformed snapshot entry at ${filePath}`);
      }
      snapshots.push({
        pass: sr.pass,
        findingIds: (sr.findingIds as unknown[]).map(String),
        instructionSnapshot: sr.instructionSnapshot,
        decidedAt: sr.decidedAt,
      });
    }
  }
  return snapshots ? { generatedAt, edits, snapshots } : { generatedAt, edits };
}

/**
 * Merge `incoming` edits into `existing` recipe. Per-spec rule:
 *  - if an existing edit matches the same `pass` AND same `findingIds`
 *    (set-equal), REPLACE it (later wins).
 *  - otherwise append.
 * Output is sorted by (pass, find).
 */
export function mergeRecipe(
  existing: ActuatorRecipe | null,
  incoming: RecipeEdit[],
  generatedAt: string,
  incomingSnapshot?: PassSnapshot,
): ActuatorRecipe {
  const out: RecipeEdit[] = existing ? [...existing.edits] : [];
  // Build a set of (pass, sortedFindingIds) keys that the incoming batch
  // touches; drop ALL existing entries belonging to the same (pass, findingIds)
  // GROUP — re-recording a pass replaces its prior recipe (later wins on the
  // pass+findings cell, not per-edit).
  const incomingKeys = new Set<string>();
  for (const inc of incoming) {
    incomingKeys.add(`${inc.pass}::${[...inc.findingIds].sort().join(',')}`);
  }
  const filtered = out.filter((e) => {
    const key = `${e.pass}::${[...e.findingIds].sort().join(',')}`;
    return !incomingKeys.has(key);
  });
  filtered.push(...incoming);
  const merged: ActuatorRecipe = { generatedAt, edits: sortEdits(filtered) };
  if (incomingSnapshot) {
    merged.snapshots = mergePassSnapshot(existing, incomingSnapshot);
  } else if (existing?.snapshots && existing.snapshots.length > 0) {
    merged.snapshots = sortSnapshots(existing.snapshots);
  }
  return merged;
}
