import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RunResult } from './engine.js';

/** Write the refined single-file HTML to deliverables/<name>/output/index.html. Returns the path. */
export function packageOutput(bundleDir: string, result: RunResult): string {
  const outDir = join(bundleDir, 'deliverables', result.name, 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'index.html');
  writeFileSync(outPath, result.outputHtml, 'utf8');
  return outPath;
}
