/**
 * Stage 1 — Context-Understanding: buildContext(client, track) → DesignContext
 *
 * Pure read/resolve step. No authoring, no rails mutation.
 * Composes loaders from paths.ts, tokens.ts, brand-contract.ts, and playbook.ts
 * into one normalized DesignContext for the downstream Plan stage.
 *
 * Deck guard: throws immediately for track === 'deck' because
 * resources/design_processes/deck/ is not yet supplied by the design team.
 * Geometry rails exist for deck; authoring governance does not — never fabricate it.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

import {
  type Track,
  resolveBrandContract,
  projectReferencesDir,
  designProcessesDir,
  intentBriefPath,
} from '../paths.js';
import { loadBriefIfPresent, stubBrief } from './brief.js';
import { loadIntentBriefIfPresent } from './intent-brief.js';
import { loadTokensFromCss } from '../tokens.js';
import { loadBrandContract } from '../brand-contract.js';
import { loadBrandKitIfPresent } from '../brand-kit.js';
import { loadPlaybook } from '../playbook.js';
import type { DesignContext } from './types.js';

/**
 * Load every top-level `*.md` design-process doc for a track into a Map keyed
 * by filename stem. Entries are sorted before reading so the Map order is
 * deterministic regardless of filesystem readdir order (mirrors playbook.ts).
 * `exclude` drops named stems (e.g. SECTION_INTELLIGENCE, loaded separately).
 * Throws an actionable named-path error if the process dir is absent.
 */
function loadProcessDocs(track: Track, opts: { exclude?: string[] } = {}): Map<string, string> {
  const processDir = designProcessesDir(track);
  if (!existsSync(processDir)) {
    throw new Error(
      `Offscript generate: design-process dir not found for track "${track}".\n` +
        `  Expected: ${processDir}\n` +
        `  Governance docs are load-bearing — the engine cannot generate without them.`,
    );
  }
  const exclude = new Set(opts.exclude ?? []);
  const out = new Map<string, string>();
  const entries = readdirSync(processDir)
    .filter((e) => extname(e) === '.md')
    .sort();
  for (const entry of entries) {
    const stem = basename(entry, '.md');
    if (exclude.has(stem)) continue;
    out.set(stem, readFileSync(join(processDir, entry), 'utf8'));
  }
  return out;
}

/**
 * Build the normalized DesignContext for a given client + track.
 *
 * Throws with a clear error for:
 *   - track === 'deck' (authoring governance not yet available)
 *   - tokens CSS is missing from the resolved brand dir (engine non-functional)
 *
 * A missing brief is NOT a fatal error — falls back to a stub Brief so the
 * script can run end-to-end before a real brief.md is dropped in.
 */
export function buildContext(client: string, track: Track): DesignContext {
  // ── Deck guard (first — before any I/O) ─────────────────────────────────────
  if (track === 'deck') {
    throw new Error(
      `Offscript generate: deck track is blocked.\n` +
        `resources/design_processes/deck/ has not yet been supplied by the design team.\n` +
        `Geometry rails exist for deck; authoring governance does not.\n` +
        `Supply the deck design-process docs before enabling deck generation.`,
    );
  }

  // ── Brief: missing → stub; present-but-malformed → PROPAGATES (loud) ─────────
  const brief = loadBriefIfPresent(client) ?? stubBrief(track);

  // ── W3-S1: replay the persisted Intent Brief if present (additive; absent → ──
  // undefined; present-but-malformed → PROPAGATES, same discipline as the brief).
  // DATA carry only — nothing here reads it (consumption is W3-S4).
  const intentBrief = loadIntentBriefIfPresent(intentBriefPath(client, track));

  // Project branding wins across tracks; bare projects use reference defaults.
  const brandDir = resolveBrandContract(client, track);
  const ownDir = projectReferencesDir(client);

  // Load tokens from CSS (required — throws if absent)
  const cssPath = join(brandDir, 'colors_and_type.css');
  if (!existsSync(cssPath)) {
    throw new Error(
      `Offscript generate: colors_and_type.css not found in resolved brand dir.\n` +
        `  Expected: ${cssPath}\n` +
        `  The generate engine requires token CSS to be present in either ` +
        `projects/${client}/references/ or resources/design_principles/.`,
    );
  }
  const css = readFileSync(cssPath, 'utf8');
  const tokens = loadTokensFromCss(css);

  // Load brand-contract if present (optional — null if absent)
  const contractPath = join(brandDir, 'brand-contract.json');
  const brandContract = loadBrandContract(contractPath);

  // Determine brand source
  const brandSource: 'client' | 'default' = brandDir === ownDir ? 'client' : 'default';

  // Keep kit assets, tokens and contract under the same project authority.
  const brandKit = loadBrandKitIfPresent(join(brandDir, 'brand-kit.json')) ?? undefined;

  // ── WS4: optional source-doc body (deterministic per-page grounding) ─────────
  let sourceContent: string | undefined;
  if (brief.sourceDoc) {
    const srcPath = join(ownDir, brief.sourceDoc);
    sourceContent = existsSync(srcPath) ? readFileSync(srcPath, 'utf8') : undefined;
    // Non-fatal when absent: the collateral plan still generates from must-include +
    // brief body, and buildCollateralPlan warns when a declared source-doc is missing.
  }

  // ── Governance loading ───────────────────────────────────────────────────────
  let sectionIntelligence: ReturnType<typeof loadPlaybook>;
  let playbooks: Map<string, string>;

  if (track === 'website') {
    // Author-from-governance (post-pivot): no SECTION_INTELLIGENCE playbook. Governance
    // reaches the author via buildWebsiteAuthorContract's on-disk pointers (rulebooks /
    // component-governance), exactly as collateral routes through buildCollateralAuthorContract.
    sectionIntelligence = new Map();
    playbooks = loadProcessDocs('website');
  } else {
    // collateral: no section-intelligence doc; the *.md docs carry governance.
    sectionIntelligence = new Map();
    playbooks = loadProcessDocs('collateral');
  }

  return {
    client,
    track,
    brief,
    tokens,
    brandContract,
    brandSource,
    governance: {
      sectionIntelligence,
      playbooks,
    },
    parentUrl: brief.parentUrl,
    sourceContent,
    intentBrief,
    brandKit,
  };
}


/** Identity authority is independent of token CSS provenance. */
export function hasProjectBrandIdentity(context: DesignContext): boolean {
  return context.brandSource === 'client' || Boolean(
    context.brief.brand?.trim() || context.brandKit?.subject?.trim() || context.brandContract?.subject?.trim(),
  );
}
