/**
 * Mechanical harden (WP1.C, Phase 1) — deterministic, NO LLM.
 *
 * The payoff of the flatten front-stage: take the flattened design ground truth
 * and replay the five MECHANICAL operators' `apply` over it, in order, to emit a
 * hardened, self-contained HTML doc. The flatten output is returned UNMUTATED as
 * the immutable `reference` (the design ground truth); the hardened doc is `html`.
 *
 * Only the deterministic-`apply` operators run here:
 *   token-normalize → font-fidelity → radius-vocabulary → lang-attr → landmark-semantics
 * The judgment-only rails (contrast / responsive-need / brand-fidelity-scan) are
 * detect-only / warn-only — they are Phase 2 (the actuator) and are NOT applied.
 */
import { flattenFromKit } from './index.js';
import { detectKitLayout } from '../intake.js';
import { loadTokensFromCss } from '../tokens.js';
import { parseHtml, serializeHtml } from '../working-rep.js';
import type { OperatorContext } from '../operator.js';
import type { OperatorRegistry } from '../operators/index.js';
import type { OperatorRun } from '../engine.js';

/**
 * The mechanical operators, in apply order (deterministic auto-remediation).
 *
 * The order is safe-by-construction — the chain is order-insensitive and
 * idempotent (apply∘apply = apply): radius-vocabulary and font-fidelity emit
 * `var(...)` references, which token-normalize never touches (it only rewrites
 * raw literals present in `tokens.valueToVar`), and in-vocab radius LITERALS are
 * left for token-normalize by design (radius-vocabulary only snaps off-vocab px).
 * So no operator can undo or re-trigger another's work regardless of sequence.
 */
export const MECHANICAL_OPERATORS = [
  'token-normalize',
  'font-fidelity',
  'radius-vocabulary',
  'responsive-breakpoints',
  'interactivity-accordion',
  'interactivity-master-detail',
  'lang-attr',
  'landmark-semantics',
] as const;

export interface HardenResult {
  /** the flatten output — the design ground truth, UNMUTATED */
  reference: string;
  /** the hardened doc after the mechanical operators' apply */
  html: string;
  /** one OperatorRun per mechanical operator that was present in the registry */
  applied: OperatorRun[];
}

/**
 * Flatten the kit, then replay the mechanical operators' `apply` over the parsed
 * flatten output in order. Returns the immutable `reference`, the hardened `html`,
 * and an `OperatorRun` per operator (`verified` = re-detect finds no auto-remediable
 * residue, matching the engine's verify semantics).
 */
export function hardenKitMechanical(dir: string, registry: OperatorRegistry): HardenResult {
  // Detect the kit ONCE (mirrors gateKit): its render feeds the flatten and its
  // colors_and_type.css builds the TokenModel threaded into the operator context.
  const kit = detectKitLayout(dir);
  // reference = the flatten output (UNMUTATED design ground truth).
  const reference = flattenFromKit(kit).html;

  const tokens = loadTokensFromCss(kit.tokensCss);
  const ctx: OperatorContext = { params: {}, tokens };

  // The hardened doc starts as a fresh parse of the reference, then is mutated.
  const tree = parseHtml(reference);
  const applied: OperatorRun[] = [];

  for (const name of MECHANICAL_OPERATORS) {
    const op = registry.get(name);
    if (!op) continue; // skip cleanly if a name is absent from the registry
    const findings = op.apply(tree, ctx);
    // verify = re-detect: no auto-remediable residue remains after apply.
    const residue = op.detect(tree, ctx).filter((f) => f.outcome === 'auto-remediated');
    applied.push({ operator: op.name, findings, verified: residue.length === 0 });
  }

  const html = serializeHtml(tree);
  return { reference, html, applied };
}
