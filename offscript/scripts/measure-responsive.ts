/**
 * Offscript WP1.E.2 item 6 — rendered responsive measurement CLI.
 *
 * Reads an HTML file, opens it in headless Chromium at three viewports
 * (360 / 768 / 1440) via `measureOverflowsAsync`, and reports the
 * overflowing elements. Reporting only — never a gate; exits 0 always.
 *
 * Usage:
 *   tsx scripts/measure-responsive.ts <html-path> [--json]
 *
 * Env-gated: requires `OFFSCRIPT_PLAYWRIGHT=1`. If the gate is off, or the
 * Chromium binary is missing, prints a friendly skip notice and exits 0.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  measureOverflowsAsync,
  isRenderedGateEnabled,
} from '../src/operators/responsive-need-rendered.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const htmlArg = args.find((a) => !a.startsWith('--'));

if (!htmlArg) {
  console.error('Usage: tsx scripts/measure-responsive.ts <html-path> [--json]');
  process.exit(2);
}

const htmlPath = resolve(htmlArg);
if (!existsSync(htmlPath)) {
  console.error(`No such file: ${htmlPath}`);
  process.exit(2);
}

if (!isRenderedGateEnabled()) {
  console.log(
    `Skipped — set OFFSCRIPT_PLAYWRIGHT=1 and run 'npx playwright install chromium' to enable.`,
  );
  process.exit(0);
}

const html = readFileSync(htmlPath, 'utf8');

let findings;
try {
  findings = await measureOverflowsAsync(html);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(
    `Skipped — Playwright could not launch Chromium (${msg.split('\n')[0]}). ` +
      `Run 'npx playwright install chromium' to enable.`,
  );
  process.exit(0);
}

const VIEWPORTS = [360, 768, 1440] as const;

if (json) {
  const out = {
    viewports: VIEWPORTS.map((width) => {
      const overflows: Array<{ selector: string; overflowPx: number }> = [];
      for (const f of findings) {
        const parts = f.id.split(':');
        // id = responsive-need:rendered:overflow:<viewport>:<selector...>
        const vp = Number(parts[3]);
        if (vp !== width) continue;
        const selector = parts.slice(4).join(':');
        // Parse "(overflow by N px)" out of the description for the JSON shape.
        const m = f.description.match(/overflows? by (-?\d+) px/);
        const overflowPx = m ? Number(m[1]) : 0;
        overflows.push({ selector, overflowPx });
      }
      return { width, height: 800, overflows };
    }),
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// Human-readable table.
console.log(`Rendered responsive measurement: ${htmlPath}\n`);
for (const width of VIEWPORTS) {
  const at = findings.filter((f) => f.id.split(':')[3] === String(width));
  if (at.length === 0) {
    console.log(`  ${width}px: clear (no overflow)`);
    continue;
  }
  console.log(`  ${width}px: ${at.length} overflow finding(s)`);
  for (const f of at) {
    console.log(`      - ${f.description}`);
  }
}
process.exit(0);
