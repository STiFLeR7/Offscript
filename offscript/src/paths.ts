import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Central path module for the Offscript v2 governance-layered layout.
 *
 * Single source of truth for every on-disk location the engine touches, so the
 * v2 restructure (track-first → client-first; references/ → resources/;
 * output/ merged into projects/<client>/<track>/) lives in one file instead of
 * being hardcoded across ~14 call sites.
 *
 *   resources/   GOVERNANCE ("HOW")  — house design system + generic quality rules
 *   projects/<c>/    PROJECTS  ("WHAT")  — per-client brand context + per-deliverable work
 *
 * repoRoot is resolved relative to this module (import.meta.url), so it is
 * portable: it works both in-repo (offscript/) and from a portable export where the
 * engine root == the export root — no 'offscript' string literal anywhere.
 */

const here = dirname(fileURLToPath(import.meta.url));
/** Engine root (= offscript/). */
export const repoRoot = resolve(here, '..');

/** The three deliverable tracks. */
export type Track = 'website' | 'collateral' | 'deck';

// ─────────────── GOVERNANCE ("HOW") — read by rails at runtime ───────────────
export const resourcesDir = (): string => join(repoRoot, 'resources');
/** Cross-track Example Brand reference defaults: colors_and_type.css, fonts/, logos, imagery, preview/. */
export const designPrinciplesDir = (): string => join(resourcesDir(), 'design_principles');
/** Anti-slop / ratio expectations / geometric hard rules (reserved). */
export const qualityStandardsDir = (): string => join(resourcesDir(), 'quality_standards');
/** Per-track design-process docs: resources/design_processes/<track>/
 *  (website = the 16 playbooks; collateral = brochure kit; deck = Phase C, design-team-supplied). */
export const designProcessesDir = (track: Track): string =>
  join(resourcesDir(), 'design_processes', track);
/** Review & validation rules (reserved). */
export const governanceDir = (): string => join(resourcesDir(), 'governance');

// ─────────── WEBSITE v2 FRAGMENT CATALOG (Path C — curate, don't generate) ───────────
// Lean-vendored machine layer of the design team's Website-offscript-v2: the 79
// `data-crf` fragments + manifest + shell + v2 token sheet + fonts + the runtime JS tools.
// The vendored tools resolve ROOT = <tool>/.. and read ROOT/fragments/manifest.json, so this
// dir mirrors the v2 root exactly. See resources/design_processes/website/catalog/README.md.
/** The vendored v2 catalog root: design_processes/website/catalog/. */
export const websiteCatalogDir = (): string => join(designProcessesDir('website'), 'catalog');
/** The 79-fragment selection index (serves/surface/layout/limits). */
export const catalogManifestPath = (): string =>
  join(websiteCatalogDir(), 'fragments', 'manifest.json');
/** The v2 page shell (fonts + token link + Lucide + the <main> paste zone). */
export const catalogShellPath = (): string => join(websiteCatalogDir(), 'fragments', '_shell.html');
/**
 * WS8 (EA-019) — the website token sheet flatten inlines + the orchestrator stages beside the
 * page. REPOINTED from the deleted vendored catalog sheet to the SURVIVING website brand sheet
 * at `design_processes/website/colors_and_type.css` (the same sheet resolveBrandContract
 * resolves for the website track). Signature stable; target changed.
 */
export const catalogCssPath = (): string => join(designProcessesDir('website'), 'colors_and_type.css');
/**
 * WS8 (EA-019) — the website fonts dir flatten subsets/inlines + the orchestrator stages as
 * `./fonts/`. REPOINTED from the deleted vendored catalog fonts to the SURVIVING website fonts
 * at `design_processes/website/fonts/`. Signature stable; target changed.
 */
export const catalogFontsDir = (): string => join(designProcessesDir('website'), 'fonts');
/** The vendored runtime tools: validate-page.js / selection-diversity.js / _curation.js. */
export const catalogToolsDir = (): string => join(websiteCatalogDir(), 'tools');
/**
 * WS8 (EA-019) — source of the website image asset library for copy-on-use / flatten inlining.
 * REPOINTED from the external, non-vendored `Website-offscript-v2/assets` (absent on a
 * fresh checkout) to the SURVIVING in-repo website asset root `design_processes/website/assets/`
 * (imagery/ + logo/). Still env-overridable via `V2_ASSET_SOURCE` (signature stable).
 */
export const v2AssetSource = (): string =>
  process.env.V2_ASSET_SOURCE ?? join(designProcessesDir('website'), 'assets');

// ──────────────────────────── PROJECTS ("WHAT") ─────────────────────────────
export const projectDir = (client: string): string => join(repoRoot, 'projects', client);
/** Per-client brand CONTEXT (input): projects/<client>/references/. */
export const projectReferencesDir = (client: string): string =>
  join(projectDir(client), 'references');
/**
 * Working dir for one deliverable: projects/<client>/<track>/.
 * Kit input AND hardened artifacts (reference.html / index.html / score.json /
 * overlay/) co-locate here — there is no separate output/ tree in v2.
 */
export const trackDir = (client: string, track: Track): string =>
  join(projectDir(client), track);

/**
 * Per-deliverable Intent Brief artifact (W3-S1): projects/<client>/<track>/intent-brief.md.
 * Co-locates with score.json / manifest.json in the uncommitted project workspace —
 * NEVER in resources/ (shared governance). Same per-track isolation as trackDir.
 */
export const intentBriefPath = (client: string, track: Track): string =>
  join(trackDir(client, track), 'intent-brief.md');

/**
 * Cross-track form-terms lexicon (W3-S2 Intent Readiness Floor): the authority-class
 * length-unit list. Lives in quality_standards/ (cross-track shared governance), per
 * W3-S2-CONTRACT-RECONCILIATION.md U-FORM-NARROW ("the lexicon lives in governance").
 */
export const formTermsPath = (): string => join(qualityStandardsDir(), 'form-terms.md');

/**
 * Locate an existing deliverable working dir (kit input + hardened output
 * co-locate here). Prefers the v2 client-first path; falls back to the legacy
 * v1 track-first kit dir (projects/<track>/<client>) so a gitignored kit that
 * predates the move still resolves until it is manually relocated. When neither
 * exists, returns the v2 path — callers then skip-clean because it holds no kit.
 *
 * Migrate a dev machine with, e.g.:
 *   mv offscript/projects/website/example-brand offscript/projects/example-brand/website
 */
export function resolveWorkingDir(client: string, track: Track): string {
  const current = trackDir(client, track);
  if (existsSync(current)) return current;
  const legacy = join(repoRoot, 'projects', track, client);
  if (existsSync(legacy)) return legacy;
  return current;
}

/**
 * Resolve supplied project branding for every track. A project that supplies any
 * brand authority file owns its whole brand directory; incomplete inputs fail
 * at their loader instead of silently mixing in demonstration branding.
 * Bare projects use the fictional reference defaults for their track.
 */
export function resolveBrandContract(client: string, track?: Track): string {
  const own = projectReferencesDir(client);
  if (['colors_and_type.css', 'brand-contract.json', 'brand-kit.json'].some((file) =>
    existsSync(join(own, file)),
  )) return own;
  if (track === 'website') {
    const websiteBrand = designProcessesDir('website');
    if (existsSync(join(websiteBrand, 'colors_and_type.css'))) return websiteBrand;
  }
  return designPrinciplesDir();
}

/** Fictional reference client used by demonstrations. */
export const DEFAULT_CLIENT = 'example-brand';
