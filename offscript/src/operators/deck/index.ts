import type { Operator } from '../../operator.js';
import type { OperatorRegistry } from '../index.js';
import { tokenNormalize } from '../token-normalize.js';
import { brandFidelityScan } from '../brand-fidelity-scan.js';
import { contrast } from '../contrast.js';
import { landmarkSemantics } from '../landmark-semantics.js';
import { fontFidelity } from '../font-fidelity.js';
import { langAttr } from '../lang-attr.js';
// Deck-specific rails.
import { slideCount } from './slide-count.js';
import { slideNoOverflow } from './render/slide-bounds.js';
import { bodyTextFloor } from './render/body-text-floor.js';
import { deckTextOverlap } from './render/text-overlap.js';

/**
 * The fixed deck rail set: the 6 invariant-hygiene website ops plus the deck geometric rails keyed to the
 * 1920×1080 slide box. `slide-count` is static (runs always); the three render
 * rails return `[]` synchronously and are driven by `harden-deck.ts`'s async
 * detectors behind `OFFSCRIPT_PLAYWRIGHT=1`. Excludes collateral's page-geometry
 * rails (squarePageCorners / columnCount) — those are A4-page specific.
 */
export function deckRegistry(): OperatorRegistry {
  const ops: Operator[] = [
    langAttr, tokenNormalize, fontFidelity, brandFidelityScan, contrast, landmarkSemantics,
    slideCount, slideNoOverflow, bodyTextFloor, deckTextOverlap,
  ];
  return new Map(ops.map((o) => [o.name, o]));
}
