import type { Operator } from '../operator.js';
import { langAttr } from './lang-attr.js';
import { tokenNormalize } from './token-normalize.js';
import { brandFidelityScan } from './brand-fidelity-scan.js';
import { landmarkSemantics } from './landmark-semantics.js';
import { contrast } from './contrast.js';
import { responsiveNeed } from './responsive-need.js';
import { responsiveNeedRendered } from './responsive-need-rendered.js';
import { radiusVocabulary } from './radius-vocabulary.js';
import { fontFidelity } from './font-fidelity.js';
import { layoutAlignment } from './layout-alignment.js';
import { stickyStack } from './sticky-stack.js';
import { innerScrollAxis } from './inner-scroll-axis.js';
import { responsiveBreakpoints } from './responsive-breakpoints.js';
import { interactivityAccordion } from './interactivity-accordion.js';
import { interactivityMasterDetail } from './interactivity-master-detail.js';
import { motionBudget } from './motion-budget.js';
import { accentSaturationBudget } from './accent-saturation-budget.js';
import { selfContained } from './self-contained.js';
import { reducedMotion } from './reduced-motion.js';
import { archetypeTag } from './archetype-tag.js';
import { sectionCountRhythm } from './section-count-rhythm.js';
import { narrativeArcPresence } from './narrative-arc-presence.js';
import { ctaChoreography } from './cta-choreography.js';
import { archetypeNeighbourCollisions } from './archetype-neighbour-collisions.js';
import { websiteStyleScope } from './website-style-scope.js';
import { websiteCompositionGrammar } from './website-composition-grammar.js';
import { websiteCompositionLimits } from './website-composition-limits.js';
import { websiteSurfaceRhythm } from './website-surface-rhythm.js';
import { renderOperators } from './render/index.js';
import { collateralRegistry } from './collateral/index.js';
import { deckRegistry } from './deck/index.js';
import type { Track } from '../paths.js';

export type OperatorRegistry = Map<string, Operator>;

/** The fixed library of operators available in v1 (spec guardrail #2: a fixed library, not a DSL). */
export function defaultRegistry(): OperatorRegistry {
  return new Map<string, Operator>([
    [langAttr.name, langAttr],
    [tokenNormalize.name, tokenNormalize],
    [brandFidelityScan.name, brandFidelityScan],
    [landmarkSemantics.name, landmarkSemantics],
    [contrast.name, contrast],
    [responsiveNeed.name, responsiveNeed],
    [responsiveNeedRendered.name, responsiveNeedRendered],

    [radiusVocabulary.name, radiusVocabulary],
    [fontFidelity.name, fontFidelity],
    [layoutAlignment.name, layoutAlignment],
    [stickyStack.name, stickyStack],
    [innerScrollAxis.name, innerScrollAxis],
    [responsiveBreakpoints.name, responsiveBreakpoints],
    [interactivityAccordion.name, interactivityAccordion],
    [interactivityMasterDetail.name, interactivityMasterDetail],
    [motionBudget.name, motionBudget],
    [accentSaturationBudget.name, accentSaturationBudget],

    // Packaging and accessibility are universal. Reference-brand taste operators
    // (never-indigo / no-elevation) remain explicit examples, outside default runs.
    [selfContained.name, selfContained],
    [reducedMotion.name, reducedMotion],

    // Phase-1 website "inspect" rails (audit §9-B). Website-track only — NOT in
    // collateralRegistry (track isolation). Escalating quality gates.
    [websiteStyleScope.name, websiteStyleScope],
    [websiteCompositionGrammar.name, websiteCompositionGrammar],
    [websiteCompositionLimits.name, websiteCompositionLimits],
    [websiteSurfaceRhythm.name, websiteSurfaceRhythm],

    // M2 Group B (archetype-aware). archetype-tag MUST precede the rails that
    // read ctx.archetypeModel — in the shared-ctx residual loop its tagging
    // side-effect must land first. Tier-0 taggers/audits, then Tier-1 rails.
    [archetypeTag.name, archetypeTag],
    [sectionCountRhythm.name, sectionCountRhythm],
    [narrativeArcPresence.name, narrativeArcPresence],
    [ctaChoreography.name, ctaChoreography],
    [archetypeNeighbourCollisions.name, archetypeNeighbourCollisions],

    // M2 Track A render-aware sub-registry — the single cross-track touchpoint.
    ...renderOperators.map((op) => [op.name, op] as const),
  ]);
}

/**
 * Select the operator registry for a track. One table the dispatcher and the
 * harden scripts route through, so track behaviour is never hard-coded per
 * call site. The exhaustive switch keeps `tsc` honest as tracks are added.
 */
export function registryForTrack(track: Track): OperatorRegistry {
  switch (track) {
    case 'website':
      return defaultRegistry();
    case 'collateral':
      return collateralRegistry();
    case 'deck':
      return deckRegistry();
  }
}
