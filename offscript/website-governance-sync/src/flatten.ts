/**
 * Structural flattening (W1 §7 step 1): design/website's brand-pack/ + governance/website/
 * split → the single flat resources/design_processes/website/ shape the engine's
 * paths.ts already resolves. Encoded as an explicit, ordered rule table (W2's "single
 * explicit configuration" requirement) rather than a generic recursive mirror, so every
 * inclusion/exclusion/rename is a reviewable, testable line — not an inferred default.
 *
 * `section-library/sections/**` is deliberately NOT a rule here — it needs a filename
 * transform (the rename map), not just relocation, so it has its own planner below and is
 * excluded from these rules by the catch-all `section-library/` → null rule.
 */
import { oldNameFor } from './rename-map.js';

export type FlattenRuleKind = 'file' | 'dir' | 'dir-shallow';

export interface FlattenRule {
  readonly kind: FlattenRuleKind;
  /** Exact path ('file') or a directory prefix ending in '/' ('dir' / 'dir-shallow'). */
  readonly from: string;
  /** Exact target path ('file'), a target prefix ending in '/' ('dir'/'dir-shallow'), or null to exclude. */
  readonly to: string | null;
}

export const FLATTEN_RULES: readonly FlattenRule[] = [
  // ── brand-pack/ root files → flat root ──────────────────────────────────────────
  { kind: 'file', from: 'brand-pack/ASSETS.md', to: 'ASSETS.md' },
  { kind: 'file', from: 'brand-pack/colors_and_type.css', to: 'colors_and_type.css' },
  { kind: 'file', from: 'brand-pack/voice.md', to: 'voice.md' },
  { kind: 'file', from: 'brand-pack/theme.css', to: 'theme.css' },
  { kind: 'file', from: 'brand-pack/tokens.json', to: 'tokens.json' },
  { kind: 'file', from: 'brand-pack/variables.css', to: 'variables.css' },

  // ── brand-pack/exemplars/ — specific files/dirs BEFORE the sections exclusion ────
  { kind: 'file', from: 'brand-pack/exemplars/README.md', to: 'exemplars/README.md' },
  { kind: 'file', from: 'brand-pack/exemplars/_frozen-v2-tokens.css', to: 'exemplars/_frozen-v2-tokens.css' },
  { kind: 'dir', from: 'brand-pack/exemplars/pages/', to: 'exemplars/pages/' },
  // Frozen v2 archive — explicitly NOT the canonical section source (section-library is).
  { kind: 'dir', from: 'brand-pack/exemplars/sections/', to: null },

  // ── brand-pack/assets/ + fonts/ + elements/ — verbatim mirror ────────────────────
  { kind: 'dir', from: 'brand-pack/assets/', to: 'assets/' },
  { kind: 'dir', from: 'brand-pack/fonts/', to: 'fonts/' },
  { kind: 'dir', from: 'brand-pack/elements/', to: 'elements/' },

  // ── governance/website/exemplars/ — the SEPARATE "inspiration" study-reference tree ──
  { kind: 'file', from: 'governance/website/exemplars/README.md', to: 'exemplars/inspiration-README.md' },
  { kind: 'dir', from: 'governance/website/exemplars/inspiration/', to: 'exemplars/inspiration/' },

  // ── governance/website/ subdirectories — verbatim mirror, one exclusion ─────────
  // verify-library.py is a design/website-only authoring tool (path-relative to section-library
  // two levels up) — non-functional if copied into the flat resources tree. Excluded.
  // MUST be listed before the component-governance/ dir rule below (first match wins).
  { kind: 'file', from: 'governance/website/component-governance/verify-library.py', to: null },
  { kind: 'dir', from: 'governance/website/component-governance/', to: 'component-governance/' },
  { kind: 'dir', from: 'governance/website/foundation/', to: 'foundation/' },
  { kind: 'dir', from: 'governance/website/rulebooks/', to: 'rulebooks/' },

  // ── governance/website/*.md — direct children only → flat root (fallback) ──────
  { kind: 'dir-shallow', from: 'governance/website/', to: '' },

  // ── governance/ root — DECISION-REGISTER only; collateral/deck are other tracks ──
  { kind: 'file', from: 'governance/DECISION-REGISTER.md', to: 'DECISION-REGISTER.md' },
  { kind: 'dir', from: 'governance/collateral/', to: null },
  { kind: 'dir', from: 'governance/deck/', to: null },

  // ── design/website-only authoring/QA tooling and internal audit trail — never shipped ──
  { kind: 'dir', from: 'output/', to: null },
  { kind: 'dir', from: 'section-library/', to: null }, // catch-all; sections/ handled separately

  // ── design/website's own process docs (about the handover, not engine governance) ──
  { kind: 'file', from: 'DEV-HANDOFF.md', to: null },
  { kind: 'file', from: 'MANIFEST.md', to: null },
  { kind: 'file', from: 'README.md', to: null },

  // ── junk ──────────────────────────────────────────────────────────────────────
  { kind: 'file', from: '.DS_Store', to: null },
];

function applyRule(rule: FlattenRule, relPath: string): string | null | undefined {
  if (rule.kind === 'file') {
    return relPath === rule.from ? rule.to : undefined;
  }
  if (!relPath.startsWith(rule.from)) return undefined;
  const rest = relPath.slice(rule.from.length);
  if (rule.kind === 'dir-shallow' && rest.includes('/')) return undefined; // not a direct child
  if (rule.to === null) return null;
  return rule.to + rest;
}

/**
 * Map every design/website-relative source path to its resources-relative target, per
 * FLATTEN_RULES (first match wins — list specific rules before general ones). `null` means
 * "excluded by design"; an absent map entry means "no rule matched" (reported by the caller,
 * never silently dropped).
 */
export function planFlatten(sourceRelPaths: readonly string[]): Map<string, string | null> {
  const plan = new Map<string, string | null>();
  for (const relPath of sourceRelPaths) {
    for (const rule of FLATTEN_RULES) {
      const result = applyRule(rule, relPath);
      if (result !== undefined) {
        plan.set(relPath, result);
        break;
      }
    }
  }
  return plan;
}

const SECTION_LIBRARY_SECTIONS_PREFIX = 'section-library/sections/';

/**
 * The dedicated section-library planner (W1 §7 step 2): every `section-library/sections/
 * <name>.html` maps to `exemplars/sections/component-<old-name>.html`, using the rename map's
 * new→old translation so the engine's existing `component-<slug>.html` convention resolves.
 */
export function planSectionLibrarySections(sourceRelPaths: readonly string[]): Map<string, string> {
  const plan = new Map<string, string>();
  for (const relPath of sourceRelPaths) {
    if (!relPath.startsWith(SECTION_LIBRARY_SECTIONS_PREFIX)) continue;
    const rest = relPath.slice(SECTION_LIBRARY_SECTIONS_PREFIX.length);
    const m = rest.match(/^([a-z0-9-]+)\.html$/);
    if (!m) continue;
    plan.set(relPath, `exemplars/sections/component-${oldNameFor(m[1])}.html`);
  }
  return plan;
}
