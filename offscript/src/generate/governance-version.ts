/**
 * governance-version.ts — Fix D: record which house-offscript version produced a run.
 *
 * Parses the bracketed version marker from the resolved track's governance
 * `colors_and_type.css` header — the SAME file the author reads
 * (`resolveBrandContract(...) + colors_and_type.css`, src/generate/author.ts:286-287)
 * — and exposes it for stamping into a per-run manifest.json and the score.
 *
 * FAIL-SOFT throughout: a missing dir / missing file / unreadable file / no marker
 * all degrade to `UNVERSIONED` plus a human-readable warning string. This is the
 * deliberate inversion of the fail-LOUD loaders (composition-md.ts,
 * website-numerics.ts): a routing/limits catalog breaking must halt the build, but
 * an observability label going missing must NEVER abort a generate run.
 *
 * Pure OBSERVABILITY: nothing here touches generated markup or the score ratio.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBrandContract, type Track } from '../paths.js';

const COLORS_AND_TYPE = 'colors_and_type.css';

/** The literal returned when no recognizable marker is present. */
export const UNVERSIONED = 'unversioned';

/** How many leading lines of the CSS to scan for the header marker. */
const HEADER_SCAN_LINES = 8;

/** Capture the bracketed token, e.g. "v2 RE-THEME — PROPOSED, gate-1 draft". */
const MARKER_RE = /\[([^\]]+)\]/;

/**
 * Parse the bracketed version marker from a governance colors_and_type.css body.
 * Pure (no I/O). Never throws — an unrecognizable header returns UNVERSIONED.
 *
 * Only the first `HEADER_SCAN_LINES` lines are considered, so a stray `[...]` deep
 * in a selector or font-feature value never registers as a version.
 */
export function parseGovernanceVersion(css: string): string {
  const lines = css.split(/\r?\n/).slice(0, HEADER_SCAN_LINES);
  for (const line of lines) {
    const m = MARKER_RE.exec(line);
    if (m) {
      const token = m[1].trim().replace(/\s+/g, ' ');
      return token.length === 0 ? UNVERSIONED : token;
    }
  }
  return UNVERSIONED;
}

/**
 * Resolve the brand dir for client+track, read its colors_and_type.css, and parse
 * the marker. FAIL-SOFT: a missing dir / missing file / unreadable file / no marker
 * all return `{ version: UNVERSIONED, warning?: string }` — never throws.
 *
 * Reads the SAME file the author reads (`resolveBrandContract(...) + colors_and_type.css`,
 * src/generate/author.ts:286-287), so the recorded version is exactly the governance
 * the run authored against — no second source of truth to drift.
 *
 * `cssPath` is returned for the manifest's provenance trail (which exact file was read).
 */
export function loadGovernanceVersion(
  client: string,
  track: Track,
): { version: string; cssPath: string; warning?: string } {
  const dir = resolveBrandContract(client, track);
  const cssPath = join(dir, COLORS_AND_TYPE);

  if (!existsSync(cssPath)) {
    return {
      version: UNVERSIONED,
      cssPath,
      warning: `governance-version: colors_and_type.css not found at ${cssPath} — recording "unversioned".`,
    };
  }

  let css: string;
  try {
    css = readFileSync(cssPath, 'utf8');
  } catch (err) {
    const first = (err as Error).message.split('\n')[0];
    return {
      version: UNVERSIONED,
      cssPath,
      warning: `governance-version: could not read ${cssPath} (${first}) — recording "unversioned".`,
    };
  }

  const version = parseGovernanceVersion(css);
  if (version === UNVERSIONED) {
    return {
      version: UNVERSIONED,
      cssPath,
      warning: `governance-version: no [marker] in ${cssPath} header — recording "unversioned".`,
    };
  }
  return { version, cssPath };
}

/**
 * Per-run provenance record written beside score.json. `governanceCssPath` is
 * repo-relative (the caller relativizes via `relative(repoRoot, cssPath)`) so the
 * manifest is portable across machines and the source/portable mirror.
 */
export interface RunManifest {
  client: string;
  track: Track;
  generatedAt: string;
  governanceVersion: string;
  governanceCssPath: string;
  warnings: string[];
  /**
   * Opaque upstream provenance, verbatim from the brief's `provenance` block (e.g.
   * which governed content packet + approval status an external adapter built this
   * brief from). Recorded for audit only; the engine never interprets it. Absent
   * when the brief carried none — the manifest is then byte-identical to before
   * this field existed (stableStringify omits undefined). See src/generate/brief.ts.
   */
  provenance?: Record<string, string>;
}

/** Stable-key JSON: recursively sorted keys, 2-space indent, trailing newline. */
function stableStringify(value: unknown): string {
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
  walk(value);
  return JSON.stringify(value, Array.from(keys).sort(), 2) + '\n';
}

/**
 * Write a RunManifest as stable JSON (sorted keys, 2-space indent, trailing
 * newline — same discipline as src/score.ts writeScore). A dumb writer: the
 * caller supplies an already-repo-relative `governanceCssPath`. Idempotent: an
 * identical existing file is left untouched (mtime not bumped).
 */
export function writeManifest(outDir: string, manifest: RunManifest): void {
  mkdirSync(outDir, { recursive: true });
  const filePath = join(outDir, 'manifest.json');
  const content = stableStringify(manifest);
  if (existsSync(filePath) && readFileSync(filePath, 'utf8') === content) return;
  writeFileSync(filePath, content, 'utf8');
}
