import type { OperatorContext } from './operator.js';
import type { TokenModel } from './tokens.js';
import type { BrandContract } from './operator.js';
import { deriveBrandPosture } from './posture.js';

export interface BuildContextInput {
  tokens: TokenModel;
  brandContract?: BrandContract;
  creativeDirection?: string;
  /** extra fields to merge (params, sections, renderContext, archetypeModel). */
  extra?: Partial<OperatorContext>;
}

/**
 * Assemble the OperatorContext for a harden run, deriving the BrandPosture
 * from the kit so variant operators are brand-driven. Single source of truth
 * for context assembly across the CLI scripts.
 */
export function buildOperatorContext(input: BuildContextInput): OperatorContext {
  const posture = deriveBrandPosture({
    tokens: input.tokens,
    brandContract: input.brandContract,
    creativeDirection: input.creativeDirection,
  });
  return {
    params: {},
    tokens: input.tokens,
    brandContract: input.brandContract,
    posture,
    ...input.extra,
  };
}
