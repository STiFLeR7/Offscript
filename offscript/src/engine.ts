import { parseHtml, serializeHtml } from './working-rep.js';
import { parseRecipe } from './recipe.js';
import type { Deliverable } from './bundle.js';
import type { Finding } from './operator.js';
import type { OperatorRegistry } from './operators/index.js';
import type { TokenModel } from './tokens.js';

export interface RunEnv {
  /** the bundle's canonical brand-kit tokens, threaded into each operator context */
  tokens?: TokenModel;
}

export interface OperatorRun {
  operator: string;
  findings: Finding[];
  /** verify = re-detect: true when no auto-remediable findings remain after apply */
  verified: boolean;
}

export interface RunResult {
  type: string;
  name: string;
  outputHtml: string;
  runs: OperatorRun[];
}

/** The replay loop: parse → for each recipe entry (apply → verify) → serialize. */
export function runDeliverable(
  deliverable: Deliverable,
  registry: OperatorRegistry,
  env: RunEnv = {},
): RunResult {
  const tree = parseHtml(deliverable.sourceHtml);
  const recipe = parseRecipe(deliverable.rulebookMd);
  const runs: OperatorRun[] = [];

  for (const entry of recipe.operators) {
    const op = registry.get(entry.operator);
    if (!op) throw new Error(`Unknown operator in recipe: ${entry.operator}`);
    const ctx = { params: entry.params, tokens: env.tokens };
    const findings = op.apply(tree, ctx);
    const remaining = op.detect(tree, ctx).filter((f) => f.outcome === 'auto-remediated');
    runs.push({ operator: op.name, findings, verified: remaining.length === 0 });
  }

  return {
    type: deliverable.type,
    name: deliverable.name,
    outputHtml: serializeHtml(tree),
    runs,
  };
}
