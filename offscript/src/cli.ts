import { loadBundle } from './bundle.js';
import { runDeliverable } from './engine.js';
import { packageOutput } from './package.js';
import { defaultRegistry } from './operators/index.js';
import { loadTokens } from './tokens.js';

export function main(argv: string[]): void {
  const dir = argv[2];
  if (!dir) {
    console.error('usage: offscript <bundle-dir>');
    process.exit(1);
  }
  const bundle = loadBundle(dir);
  const registry = defaultRegistry();
  const tokens = loadTokens(bundle.tokensJson);
  for (const deliverable of bundle.deliverables) {
    const result = runDeliverable(deliverable, registry, { tokens });
    const outPath = packageOutput(bundle.dir, result);
    const auto = result.runs
      .flatMap((r) => r.findings)
      .filter((f) => f.outcome === 'auto-remediated').length;
    console.log(`${result.name}: ${result.runs.length} step(s), ${auto} auto-fix(es) -> ${outPath}`);
  }
}

main(process.argv);
