import type { Operator } from '../../operator.js';
import type { OperatorRegistry } from '../index.js';
import { tokenNormalize } from '../token-normalize.js';
import { brandFidelityScan } from '../brand-fidelity-scan.js';
import { contrast } from '../contrast.js';
import { landmarkSemantics } from '../landmark-semantics.js';
import { fontFidelity } from '../font-fidelity.js';
import { langAttr } from '../lang-attr.js';
import { noScript } from './no-script.js';
import { routedIntelligenceApplication } from './routed-intelligence-application.js';
import { squarePageCorners, columnCount } from './page-geometry.js';
import { a4Bounds } from './render/a4-bounds.js';
import { textOverlap } from './render/text-overlap.js';
import { pageFill } from './render/page-fill.js';

/** The fixed collateral rail set (a curated subset of the website ops + collateral rails). */
export function collateralRegistry(): OperatorRegistry {
  const ops: Operator[] = [
    langAttr, tokenNormalize, fontFidelity, brandFidelityScan, contrast, landmarkSemantics,
    // Reference-brand palette/voice/motif rules are available explicitly, never
    // applied to supplied project branding by the generate or harden defaults.
    noScript,
    routedIntelligenceApplication, squarePageCorners, columnCount,
    a4Bounds, textOverlap, pageFill,
  ];
  return new Map(ops.map((o) => [o.name, o]));
}
