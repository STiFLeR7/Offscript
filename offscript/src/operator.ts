import type { Root } from 'hast';
import type { TokenModel } from './tokens.js';
import type { SectionsModel } from './sections.js';
import type { RenderContext } from './render-context.js';
import type { ArchetypeModel } from './archetype.js';
import type { BrandPosture } from './posture.js';

/** Anchor stratum: 0 = global, 1 = semantic category, 2 = single element (frozen, never in the core). */
export type Tier = 0 | 1 | 2;

export interface Finding {
  /** stable id for this finding within a run (operator name + site descriptor) */
  id: string;
  /** human-readable description of what was found */
  description: string;
  /**
   * The disposition of this finding:
   * - 'auto-remediated' — the operator systematically fixed it (counts toward the systematic ratio)
   * - 'escalated' — handed to a frozen bespoke region (counts toward the frozen denominator)
   * - 'warning' — a warn-only QA note (a brand-fidelity oracle); counts toward neither
   */
  outcome: 'auto-remediated' | 'escalated' | 'warning';
}

/**
 * Brand Contract — the bridge between a brand kit's actual tokens
 * (`--cr-brand-blue`, `--cr-bg`, …) and SECTION_INTELLIGENCE.md's abstract
 * slot vocabulary (`--accent`, `--surface-0`, …). Rails target slots; the
 * aliasing layer (src/brand-contract.ts) resolves slots to active tokens.
 * See docs/superpowers/plans/2026-05-28-offscript-brand-contract-aliasing.md.
 */
export interface SlotMapping {
  token: string;
  confidence: 'human' | 'auto' | 'hybrid';
}

export interface BrandContract {
  schemaVersion: 1;
  subject: string;
  generatedAt: string;
  decidedBy: 'human' | 'auto' | 'hybrid';
  /** keys are slot names from SECTION_INTELLIGENCE.md §1.1 (e.g., '--accent') */
  slots: Record<string, SlotMapping | null>;
  /** free-form note per null slot, explaining why it isn't mapped */
  unmappedReason?: Record<string, string>;
}

export interface OperatorContext {
  /** params from the recipe entry */
  params: Record<string, unknown>;
  /** the bundle's canonical brand-kit tokens (present for token-aware operators) */
  tokens?: TokenModel;
  /** the declared sections map (present for sections-anchored Tier-1 operators) */
  sections?: SectionsModel;
  /**
   * The Brand Contract — slot → kit-token aliases (loaded at intake from
   * `projects/<brand>/brand-contract.json`). Operators reference slots via
   * `resolveSlot(ctx.brandContract, '--accent')` and tolerate `undefined` /
   * null-slot returns gracefully (warn, not crash).
   */
  brandContract?: BrandContract;
  /**
   * The shared render runtime (M2 Track A). Render-aware rails read this to
   * probe the headlessly-rendered document — computed styles, bounds, etc.
   * Undefined when no render runtime is active (CI fallback, env-gated runs).
   * Render rails MUST tolerate undefined gracefully (no-op + single warning).
   * See src/render-context.ts.
   */
  renderContext?: RenderContext;
  /**
   * The per-page archetype model (M2 Track B). Populated by
   * `src/operators/archetype-tag.ts`; consumed by the Group B rails
   * (cta-choreography, section-count-rhythm, narrative-arc-presence,
   * archetype-neighbour-collisions). Undefined when archetype-tag hasn't
   * been run. Group B rails MUST tolerate undefined gracefully.
   * See src/archetype.ts.
   */
  archetypeModel?: ArchetypeModel;
  /**
   * The per-bundle BrandPosture (M3): the brand-VARIANT bounds (saturation
   * ceiling, accent-usage budget, density, motion) derived from the brand-kit
   * + creative-direction. Variant operators read this instead of baked
   * constants; invariant-hygiene operators ignore it. Undefined ⇒ operators
   * fall back to their built-in defaults. See src/posture.ts.
   */
  posture?: BrandPosture;
}

/**
 * The single operator shape (spec §8.1): a systematic detector.
 * `detect` finds issues without mutating; `apply` performs the systematic fix and
 * returns the resolved findings. verify() is the engine re-running `detect`.
 */
export interface Operator {
  name: string;
  tier: Tier;
  detect(tree: Root, ctx: OperatorContext): Finding[];
  apply(tree: Root, ctx: OperatorContext): Finding[];
}
