import type { Root } from 'hast';
import type { Operator, Finding, OperatorContext } from './operator.js';

/**
 * A rail = a detector used as an acceptance gate. Any Operator's detect half qualifies
 * (vision §4.2: the deterministic detectors hold the actuator inside the bounds).
 */
export type Rail = Pick<Operator, 'name' | 'detect'>;

/**
 * Run every rail's detector over the tree; the union of findings is the current set of
 * bound violations. Empty = in bounds (the gate is clear).
 */
export function runGate(tree: Root, ctx: OperatorContext, rails: Rail[]): Finding[] {
  return rails.flatMap((rail) => rail.detect(tree, ctx));
}
