#!/usr/bin/env node
/**
 * build --log-path <Output/_LOG.md> --out <dir>
 * Thin CLI wrapper over CreativeIntentExporter. No governance, no adapter,
 * no Offscript/Brief/Rendering-IR conversion — export only (CG8 STOP list).
 */
import { CreativeIntentExporter } from './export/exporter.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const logPath = arg('log-path');
  const outDir = arg('out');
  if (!logPath || !outDir) {
    console.error('usage: creative-intent-exporter build --log-path <Output/_LOG.md> --out <dir>');
    process.exit(2);
  }

  const exporter = new CreativeIntentExporter();
  const summary = await exporter.export({ logPath, outDir });

  for (const d of summary.diagnostics) {
    const line = `[${d.status}] ${d.slug}${d.reason ? ` — ${d.reason}` : ''}`;
    if (d.status === 'failed') console.error(line);
    else console.log(line);
  }
  console.log(
    `\n${summary.exportedCount} exported, ${summary.skippedCount} skipped, ${summary.failedCount} failed`
  );
  process.exit(summary.failedCount > 0 ? 1 : 0);
}

main();
