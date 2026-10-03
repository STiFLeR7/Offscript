/**
 * Stage contracts for the Offscript generate pipeline.
 *
 * These interfaces are the data shapes passed between the four stages of the
 * native resources/-grounded generate engine:
 *
 *   Stage 1  Context-Understanding     → produces DesignContext
 *   Stage 2  Adaptive-Design-Intelligence → produces AuthoringPlan
 *   Stage 3  Generate                  → consumes both; writes index.html
 *   Stage 4  CR-validate               → consumes both; writes score.json
 */

import type { Track } from '../paths.js';
import type { Brief } from './brief.js';
import type { TokenModel } from '../tokens.js';
import type { BrandContract } from '../brand-contract.js';
import type { Playbook } from '../playbook.js';
import type { Archetype } from '../archetype.js';
import type { SectionAnchor } from '../sections.js';
import type { BindingResult } from './source-binding.js';
import type { SourceAccounting } from './source-accounting.js';
import type { IntentBrief } from './intent-brief.js';
import type { ComponentKnowledgeContext } from './semantic-author-context.js';
import type { PresentationIntent } from './presentation-intent.js';
import type { WebsiteVisualDiscovery } from './website-visual-discovery.js';
import type { BrandKit } from '../brand-kit.js';
import type { ContentCapacity } from './content-capacity.js';

/** Output of Stage 1 (Context-Understanding). */
export interface DesignContext {
  /** The client identifier (e.g. 'example-brand'). */
  client: string;
  /** The deliverable track. */
  track: Track;
  /** The loaded (or stub) brief for this client + track. */
  brief: Brief;
  /** CSS custom-property token model from the resolved brand dir. */
  tokens: TokenModel;
  /**
   * Brand-contract JSON from the resolved brand dir, or null when absent.
   * Null means the Plan stage must derive slot mappings rather than read them.
   */
  brandContract: BrandContract | null;
  /**
   * 'client' when the brand came from projects/<client>/references/,
   * 'default' when the fallback Example Brand reference defaults was used.
   */
  brandSource: 'client' | 'default';
  governance: {
    /**
     * Parsed SECTION_INTELLIGENCE.md for the website track; empty Map for
     * collateral (collateral has no section-intelligence doc yet).
     */
    sectionIntelligence: Playbook;
    /**
     * The remaining design-process docs for the resolved track.
     * Keyed by filename stem (e.g. 'archetype-matrix', 'color-expansion').
     * Does NOT include SECTION_INTELLIGENCE.md (already in sectionIntelligence).
     */
    playbooks: Map<string, string>;
  };
  /** Parent URL when the brief declares one — gates Rule-0 inheritance in later stages. */
  parentUrl?: string;
  /** Loaded body of brief.sourceDoc when declared (WS4 source grounding); else absent. */
  sourceContent?: string;
  /**
   * W3-S1 — the persisted Intent Brief replayed from
   * projects/<client>/<track>/intent-brief.md when present; undefined when absent
   * (a legitimate skeleton state). DATA carry only — W3-S1 attaches it but no
   * consumer reads it yet (planner/author consumption is W3-S4; readiness is W3-S2).
   * See src/generate/intent-brief.ts.
   */
  intentBrief?: IntentBrief;
  /**
   * Sprint W76 — the OPTIONAL Brand Kit manifest (W75's minimal contract: logo asset references, an
   * imagery-manifest override pointer, an icon-convention declaration, a voice-reference pointer).
   * Undefined when the client supplies no `references/brand-kit.json` — true for every real client
   * today, so `buildContext`'s output stays byte-identical. Pure TRANSPORT — nothing reads this field
   * in this sprint; no planner, selector, author, or renderer consumes it. See src/brand-kit.ts.
   */
  brandKit?: BrandKit;
}

/**
 * Sprint W1 (WORLD-B-EVOLUTION-ARCHITECTURE.md §5) — the reasoning channel: the WHY a
 * section exists, carried alongside the WHAT. OPTIONAL + immutable transport capacity ONLY.
 *
 * Absent ⇒ today's behaviour, byte-identical. The planner NEVER populates this in W1; a
 * future reasoning producer (W2+) is the sole writer; the Author does not yet read it. Each
 * field is reasoning text — never synthesized, inferred, or defaulted. See
 * src/generate/section-reasoning.ts for the pure validation / immutability / serialization
 * helpers. The six fields are the architecture §5 responsibilities, by responsibility:
 */
export interface SectionReasoning {
  /** why this section exists in the page's argument — the role it discharges. */
  readonly role?: string;
  /** why this realization / archetype, over the alternatives considered. */
  readonly selectionRationale?: string;
  /** why this section sits at this position in the order. */
  readonly orderingRationale?: string;
  /** how this section receives from the prior section and hands to the next. */
  readonly transition?: string;
  /** which sibling sections this supports / contrasts / depends on, and how. */
  readonly relationships?: string;
  /** the single communication objective + focal priority of this section. */
  readonly communicationObjective?: string;
}

/**
 * A single planned section/page/slide in the deliverable.
 *
 * `anchor` → feeds sections.md (the "where").
 * `archetype` → from the track vocabulary; Archetype for website (closed enum),
 *   string for collateral (CoverPage/ContentPage/etc. from collateral-formats.json)
 *   and future tracks. The union keeps the type meaningful for website while not
 *   collapsing collateral archetypes (which are outside the 18-member Archetype set).
 * `tokenRoles` → minimal list of CSS custom-property names from ctx.tokens that
 *   this item conventionally uses; Phase 3 reads these to skin the section.
 * `intent` → the brief goal / must-include entry this item satisfies.
 * `content` → the verbatim brief-body copy matched to this section (Option A
 *   heading-match; see attachBriefContent in plan.ts). Optional: absent on
 *   floor-padding items, content-less briefs, and any section the body did not
 *   cover. Stage 3 forwards it to the author as AuthoringRequest.briefContent so
 *   the author TYPESETS the brief's substance instead of inventing it.
 */
export interface PlanItem {
  anchor: SectionAnchor;
  archetype: Archetype | string;
  tokenRoles: string[];
  intent: string;
  content?: string;
  /**
   * Path C (website): the catalog fragment slug curated for this section — chosen by
   * `serves` meta + rotation (see generate/catalog.ts). Stage 3 pastes this fragment and
   * edits its copy in place. Absent on non-website tracks (collateral authors from scratch).
   */
  fragmentId?: string;
  /**
   * Path C (website): the ≥2 candidate slugs considered for this section (the audit trail
   * the Curation Table records — P2). Filtered by `serves`, never by filename.
   */
  candidates?: string[];
  /**
   * Path C (website): the Curation Table "reason" cell — why `fragmentId` was chosen over
   * its alternates for THIS brief. The designer-brain SEAM: when the in-session LLM author
   * sets it, it wins; otherwise the emitter fills a deterministic scaffold (buildReason in
   * generate/curation.ts) that still cites the meta + names a rejected candidate.
   */
  reason?: string;
  /**
   * The content-aware lead composition selected for THIS section/page.
   * - Collateral (WS1): assignCollateralCompositions, per content signal + anti-monotony.
   * - Website (P2 A2): assignWebsiteCompositions — the chosen COMPOSITION.md variant's
   *   steering string (name + layout primitive + surface + Direction). Stage 3 forwards it
   *   as the seam's `## Assigned composition` block.
   * Absent on any item the router left unrouted.
   */
  composition?: string;
  /**
   * Website (P2 A2): the bare chosen variant slug, e.g. `feature-trio`. Stamped into the
   * section markup as `data-cr-component` (minimalFragment + the author contract) so the
   * website-composition-limits rail can measure the artifact. Absent on non-website tracks.
   */
  componentVariant?: string;
  /**
   * Website (P2 A2): the chosen variant's surface role (`base|rest|contrast|figure`).
   * Stamped as `data-cr-surface` for the rail's avoidAdjacentSurface check. Absent off website.
   */
  surfaceRole?: string;
  /**
   * Website (P2 A1): the per-section `## Section intelligence` excerpt — the component
   * family's Job/Rules + the chosen variant's Blocks + a {limits} note, built at plan time
   * from on-disk governance. Stage 3 forwards it as AuthoringRequest.guidance. Absent off
   * website and on any unrouted section.
   */
  sectionGuidance?: string;
  /**
   * Collateral (WS5): marks the SINGLE flagship visual page of a deck — the one
   * relationship/spatial page allowed to make a rich diagram/illustration the
   * dominant element (relaxed ≤150mm fit budget instead of the ≤40mm inline cap).
   * At most one per plan; set by plan.ts after compositions are assigned. The seam
   * surfaces it ("Flagship: yes") + the rich exemplar pointer into the page request.
   * Absent/false on every other page and on website.
   */
  flagshipVisual?: boolean;
  /**
   * Sprint W83 — the track-neutral governance reference identity: a section identity computed
   * the SAME way regardless of which track (website/collateral) is generating, so a governance
   * pack's id-referencing categories (progression's encounterSequence, mechanism's
   * requiredMechanisms) resolve to ONE canonical id rather than each track's own anchor.id
   * (which diverge for the same brief content — see SPRINT-W82/W83). For a must-include-derived
   * item this is the shared intent-only slug (`governanceReferenceIdFor` in plan.ts); for a
   * track-specific structural default (e.g. website's floor-padding) it equals that item's own
   * anchor.id, since no other track produces an equivalent. Always attached by both track
   * builders; consumers fall back to `anchor.id` when absent (hand-built plan fixtures in
   * tests). Pure identity transport — nothing outside the two id-referencing consumers reads it.
   * See SPRINT-W83-TRACK-NEUTRAL-GOVERNANCE-REFERENCES.md.
   */
  governanceReferenceId?: string;
  /**
   * Sprint W1 — the OPTIONAL, immutable reasoning channel (the WHY). Absent on every item
   * today: the planner never sets it, so the default plan + serialization are byte-identical.
   * A future reasoning producer (W2+) is the sole writer; the Author does not yet read it.
   * See SectionReasoning + src/generate/section-reasoning.ts.
   */
  reasoning?: SectionReasoning;
  /**
   * Sprint W20 — the OPTIONAL semantic author context (the component's authored Purpose / Character
   * / Contract / Judgement, verbatim). Absent by default: attached only when semantic author context
   * is enabled, so the default plan + serialization are byte-identical. Pure TRANSPORT — the Author
   * MAY read it; nothing interprets it. See src/generate/semantic-author-context.ts.
   */
  componentKnowledge?: ComponentKnowledgeContext;
  /**
   * Sprint W52 — the OPTIONAL Presentation Intent object (the governed visual-communication medium
   * + commitment level a section's BOUND content structure implies, per the W51 architecture).
   * Absent by default: attached only when presentation-intent transport is enabled, so the default
   * plan + serialization stay byte-identical. Pure TRANSPORT — nothing reads it in this sprint; no
   * planner, author, renderer, or validator consumes it. Collateral only (see plan.ts); always
   * absent on website. See src/generate/presentation-intent.ts.
   */
  presentationIntent?: PresentationIntent;
  /**
   * Sprint W70 — the OPTIONAL Website Visual Discovery object (a disagreement flag between the
   * archetype already assigned at plan Stage 1 and the section's BOUND content's own structural
   * shape — process/comparison/stats — per the W68 architecture). Absent by default: attached
   * only when website visual discovery transport is enabled, so the default plan + serialization
   * stay byte-identical. Pure TRANSPORT — nothing reads it in this sprint; no selector, author, or
   * validator consumes it. Website only (see plan.ts); always absent on collateral. See
   * src/generate/website-visual-discovery.ts.
   */
  visualDiscovery?: WebsiteVisualDiscovery;
  /**
   * P24 — the OPTIONAL Content Capacity object (the P23-designed per-slot shape + bounds
   * declaration a component MAY author in its `## Content Capacity` W17 body section). Absent by
   * default: attached only when content-capacity transport is enabled, so the default plan +
   * serialization stay byte-identical. Pure TRANSPORT — nothing reads it in this sprint; no
   * planner, author, renderer, or validator consumes it. Website only (see plan.ts), keyed on the
   * SELECTED component (fragmentId, falling back to componentVariant) — the same key
   * `componentKnowledge` uses. Always absent on collateral. Also absent even when enabled against
   * today's real repository, since no component has yet authored the section (corpus authoring is
   * deferred; see docs/internals/P23-CONTENT-CONTRACT-V2-ARCHITECTURE.md §6). See
   * src/generate/content-capacity.ts.
   */
  contentCapacity?: ContentCapacity;
  /**
   * Sprint 5 — the OPTIONAL Creative Artifact reference (an external, pre-rendered marketing
   * creative this section MAY incorporate, selected by `creative-artifact-consumption.ts` from
   * a client's artifact inventory). Absent by default: attached only when
   * `OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION=1` AND at least one inventory artifact clears the
   * selection floor for this item, so the default plan + serialization stay byte-identical.
   * Pure TRANSPORT of identity/location — never the artifact's own bytes (mirrors
   * `creative-artifact-contract`'s own "carry a reference, never the payload" rule). The
   * artifact's contract fields (id/intentDigest/artifactDigest/location) are copied verbatim,
   * never mutated — this is a REFERENCE the plan item carries, not a new artifact record.
   * See src/generate/creative-artifact-consumption.ts.
   */
  creativeArtifact?: PlanItemCreativeArtifactRef;
}

/**
 * The immutable subset of a CreativeArtifact's identity a PlanItem may carry as a reference.
 * Deliberately NOT the full CreativeArtifact shape (approval/generation/validation stay in the
 * artifact's own record, not duplicated here) — see creative-artifact-consumption.ts.
 */
export interface PlanItemCreativeArtifactRef {
  readonly id: string;
  readonly intentDigest: string;
  readonly artifactDigest: string;
  readonly location: string;
}

/** Output of Stage 2 (Adaptive-Design-Intelligence). */
export interface AuthoringPlan {
  track: Track;
  items: PlanItem[];
  /**
   * Non-fatal planning warnings (e.g. brief.mustInclude exceeded the §2.3 section
   * ceiling, so tail entries were dropped). Surfaced via the plan rather than
   * console so callers can react/report. Empty on the happy path.
   */
  warnings: string[];
  /**
   * W2-S2 — the explicit source-unit → consumer binding for this plan: every
   * extracted unit's disposition (bound | unmatched | unused) + per-consumer
   * grounding. DATA only — no signals, no failures (those are W2-S3/S4, owner
   * `source-fidelity`). Present whenever the planner ran the binding; consumed by
   * the later fidelity-accounting stage. See src/generate/source-binding.ts.
   */
  binding?: BindingResult;
  /**
   * W2-S3 — the complete source-fidelity accounting for this plan: every extracted
   * unit's disposition + every consumer's grounding state (brief | source-doc | none),
   * with pre-derived rollups (lost units / unbound segments / void consumers). DATA
   * only — no signals, no failures (those are W2-S4, owner `source-fidelity`). Present
   * whenever the planner ran the binding; read by the later fidelity-signal stage
   * without re-traversing planner state. See src/generate/source-accounting.ts.
   */
  accounting?: SourceAccounting;
  /**
   * GAP-1 hardening — the consumer ids that are engine-default floor-padding (website
   * `WEBSITE_DEFAULT_SECTIONS`), NOT brief-derived. Planner-declared DATA (the planner
   * created the padding); the fidelity classifier reads it to downgrade these from a
   * G4 Failure to a Warning ("delivered-but-degraded", per W2-FIDELITY-FAILURE-OWNERSHIP.md).
   * Empty on collateral (no floor-padding; its empty-brief defaults are handled by the
   * briefSupplied=false path). No signal is emitted here — DATA only.
   */
  enginePaddingConsumerIds?: string[];
}
