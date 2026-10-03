/**
 * debug-screenshot — render the live index.html headlessly and dump per-tile
 * computed styles so we can see why the bento tiles are appearing invisible.
 */
import { chromium } from 'playwright';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const workingDir = resolveWorkingDir(DEFAULT_CLIENT, 'website');
const indexPath = resolve(join(workingDir, 'index.html'));
const outDir = resolve(join(workingDir, 'debug'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('file://' + indexPath.replace(/\\/g, '/'));
await page.waitForLoadState('networkidle');

// Full-page screenshot
await page.screenshot({ path: join(outDir, 'full.png'), fullPage: true });
// Hero-only screenshot
await page.screenshot({ path: join(outDir, 'viewport.png') });

// Probe the ProofGrid bento tiles
const probe = await page.evaluate(`
  (function() {
    function findByText(txt) {
      var all = Array.from(document.querySelectorAll('div'));
      return all.find(function(d) { return d.textContent && d.textContent.trim() === txt; });
    }
    function tileFor(label) {
      var labelEl = findByText(label);
      return labelEl && labelEl.closest('div[style*="border-radius"]');
    }
    function probeOne(txt) {
      var el = tileFor(txt);
      if (!el) return { txt: txt, missing: true };
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      return {
        txt: txt,
        backgroundColor: cs.backgroundColor,
        backgroundImagePrefix: cs.backgroundImage.slice(0, 200),
        backgroundBlendMode: cs.backgroundBlendMode,
        width: r.width,
        height: r.height,
        x: r.x,
        y: r.y,
        visible: r.width > 0 && r.height > 0,
        color: cs.color,
      };
    }
    return [
      probeOne('Cost Removal'),
      probeOne('Payback'),
      probeOne('Automated'),
      probeOne('Return on Investment'),
    ];
  })()
`);
console.log(JSON.stringify(probe, null, 2));

await browser.close();
console.log(`\nScreenshots: ${outDir}`);
