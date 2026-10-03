/**
 * projects — enumerate Offscript projects and surface their harden scores.
 *
 * Backs `/offscript list` (all projects, table) and `/offscript status <client> [--track]`
 * (one project's score). Scans the v2 client-first layout:
 *
 *   projects/<client>/website/score.json              (website: co-located)
 *   projects/<client>/collateral/<artifact>/score.json (collateral: per-artifact)
 *   projects/<client>/deck/<artifact>/score.json        (deck: per-artifact, Phase C)
 *
 * Legacy track-first dirs (projects/website/<brand>) are ignored automatically:
 * the second path segment there is a brand, not a known track, so it matches no
 * track and yields no rows.
 *
 * Usage:
 *   npx tsx scripts/projects.ts                 # list every project (table)
 *   npx tsx scripts/projects.ts <client>        # status: that client's projects
 *   npx tsx scripts/projects.ts <client> --track website
 *   npx tsx scripts/projects.ts [...] --json    # machine-readable
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, type Track } from '../src/paths.js';
import { formatScoreReport, type RunScore } from '../src/score.js';

const TRACKS: readonly Track[] = ['website', 'collateral', 'deck'];

export interface ProjectRow {
  client: string;
  track: Track;
  /** null for a track-level score (website); the artifact subdir name otherwise. */
  artifact: string | null;
  scorePath: string;
  score: RunScore | null;
}

function subDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function readScore(path: string): RunScore | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RunScore;
  } catch {
    return null;
  }
}

/** Enumerate project rows, optionally filtered by client and/or track. */
export function collectProjectRows(opts: { client?: string; track?: Track } = {}): ProjectRow[] {
  const projectsDir = join(repoRoot, 'projects');
  const rows: ProjectRow[] = [];
  const clients = opts.client ? [opts.client] : subDirs(projectsDir);
  for (const client of clients) {
    for (const track of TRACKS) {
      if (opts.track && track !== opts.track) continue;
      const trackDir = join(projectsDir, client, track);
      if (!existsSync(trackDir)) continue;
      const direct = join(trackDir, 'score.json');
      if (existsSync(direct)) {
        rows.push({ client, track, artifact: null, scorePath: direct, score: readScore(direct) });
      }
      for (const sub of subDirs(trackDir)) {
        const sp = join(trackDir, sub, 'score.json');
        if (existsSync(sp)) {
          rows.push({ client, track, artifact: sub, scorePath: sp, score: readScore(sp) });
        }
      }
    }
  }
  return rows;
}

function pct(r: RunScore | null): string {
  return r ? `${(r.systematicRatio * 100).toFixed(1)}%` : '—';
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function formatTable(rows: ProjectRow[]): string {
  if (rows.length === 0) {
    return 'No projects with a score yet. Run `/offscript check <artifact>` to produce one.';
  }
  const cells = rows.map((r) => ({
    name: r.artifact ? `${r.client}/${r.track}/${r.artifact}` : `${r.client}/${r.track}`,
    track: r.track,
    ratio: pct(r.score),
    total: r.score ? String(r.score.buckets.total) : '—',
    tier2: r.score ? String(r.score.buckets.tier2) : '—',
    run: r.score?.generatedAt ?? '—',
  }));
  const nameW = Math.max(7, ...cells.map((c) => c.name.length));
  const out: string[] = [];
  out.push(`${pad('project', nameW)}  ratio    total  tier2  last run`);
  out.push(`${pad('-'.repeat(nameW), nameW)}  -------  -----  -----  --------`);
  for (const c of cells) {
    out.push(
      `${pad(c.name, nameW)}  ${pad(c.ratio, 7)}  ${pad(c.total, 5)}  ${pad(c.tier2, 5)}  ${c.run}`,
    );
  }
  return out.join('\n');
}

export interface ProjectsArgs {
  client?: string;
  track?: Track;
  json: boolean;
}

/**
 * Parse the projects.ts CLI argv (everything after the script name).
 *
 * The first non-flag token is the client. We must skip the value that follows
 * `--track` so it isn't mistaken for the client — but ONLY when `--track` is
 * actually present. When it's absent, `indexOf` returns -1, so `ti + 1 === 0`
 * would otherwise discard the client at index 0 and silently degrade
 * `status <client>` (no track) into a full `list`. Guard the skip on `ti >= 0`.
 */
export function parseProjectsArgs(args: string[]): ProjectsArgs {
  const json = args.includes('--json');
  const ti = args.indexOf('--track');
  const track = ti >= 0 ? (args[ti + 1] as Track) : undefined;
  const client = args.find((a, i) => !a.startsWith('--') && (ti < 0 || i !== ti + 1));
  return { client, track, json };
}

function main(): void {
  const { client, track, json } = parseProjectsArgs(process.argv.slice(2));

  const rows = collectProjectRows({ client, track });

  if (json) {
    console.log(
      JSON.stringify(
        rows.map((r) => ({
          client: r.client,
          track: r.track,
          artifact: r.artifact,
          scorePath: r.scorePath,
          systematicRatio: r.score?.systematicRatio ?? null,
          buckets: r.score?.buckets ?? null,
          generatedAt: r.score?.generatedAt ?? null,
        })),
        null,
        2,
      ),
    );
    return;
  }

  if (client) {
    // status mode — full per-rail report for each matching project.
    if (rows.length === 0) {
      console.log(`No scored projects for client "${client}"${track ? ` (track ${track})` : ''}.`);
      return;
    }
    for (const r of rows) {
      const label = r.artifact ? `${r.client}/${r.track}/${r.artifact}` : `${r.client}/${r.track}`;
      console.log(`\n=== ${label} ===`);
      console.log(r.score ? formatScoreReport(r.score) : `  (unreadable score.json at ${r.scorePath})`);
    }
    return;
  }

  // list mode — one-line-per-project table.
  console.log(formatTable(rows));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
