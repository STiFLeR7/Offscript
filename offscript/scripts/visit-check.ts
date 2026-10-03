/**
 * visit-check — load the live deliverable headlessly in Chromium and report
 * render health. NO screenshots: just visit + check. Loads at three viewports
 * (mobile / tablet / desktop) and reports, per viewport:
 *   - console errors, uncaught page errors, failed network requests
 *   - horizontal overflow (scrollWidth vs innerWidth)
 *   - broken images (<img> with naturalWidth === 0)
 *   - a basic content-presence sanity check (rendered text length, element count)
 *
 * Usage:  npx tsx scripts/visit-check.ts [path-to-index.html]
 */
import { chromium } from 'playwright';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const indexPath = resolve(arg ?? join(resolveWorkingDir(DEFAULT_CLIENT, 'website'), 'index.html'));

if (!existsSync(indexPath)) {
  console.log(`No deliverable at ${indexPath} — run 'npx tsx scripts/harden.ts' first.`);
  process.exit(0);
}

const url = 'file://' + indexPath.replace(/\\/g, '/');
const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const PAGE_PROBE = `(function () {
  var de = document.documentElement;
  var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
  var broken = imgs.filter(function (im) { return im.complete && im.naturalWidth === 0; });
  return {
    scrollWidth: de.scrollWidth,
    innerWidth: window.innerWidth,
    overflowPx: Math.max(0, de.scrollWidth - window.innerWidth),
    elementCount: document.getElementsByTagName('*').length,
    textLength: (document.body && document.body.innerText ? document.body.innerText.trim().length : 0),
    imgTotal: imgs.length,
    imgBroken: broken.length,
    brokenSrcs: broken.slice(0, 5).map(function (im) { return (im.currentSrc || im.src || '').slice(0, 80); }),
    title: document.title || '',
  };
})()`;

console.log(`Offscript visit-check (Playwright, no screenshots)`);
console.log(`  url: ${url}\n`);

const browser = await chromium.launch();
let anyProblem = false;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    failedRequests.push(`${req.url().slice(0, 80)} (${failure ? failure.errorText : 'unknown'})`);
  });

  let probe: Record<string, unknown> = {};
  let loadError = '';
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    // settle async work (fonts, lazy layout) without requiring networkidle on a file:// page
    await page.waitForTimeout(500);
    probe = (await page.evaluate(PAGE_PROBE)) as Record<string, unknown>;
  } catch (err) {
    loadError = (err as Error).message.split('\n')[0];
  }

  const overflow = Number(probe.overflowPx ?? 0);
  const imgBroken = Number(probe.imgBroken ?? 0);
  const problems =
    !!loadError ||
    consoleErrors.length > 0 ||
    pageErrors.length > 0 ||
    failedRequests.length > 0 ||
    overflow > 1 ||
    imgBroken > 0 ||
    Number(probe.textLength ?? 0) < 50;
  if (problems) anyProblem = true;

  console.log(`[${vp.name} ${vp.width}x${vp.height}] ${problems ? 'ISSUES' : 'OK'}`);
  if (loadError) console.log(`  load error: ${loadError}`);
  console.log(
    `  content: ${probe.elementCount ?? '?'} elements, ${probe.textLength ?? '?'} chars text, ` +
      `title="${probe.title ?? ''}"`,
  );
  console.log(
    `  horizontal overflow: ${overflow > 1 ? `${overflow}px (scrollWidth ${probe.scrollWidth} > viewport ${probe.innerWidth})` : 'none'}`,
  );
  console.log(`  images: ${probe.imgTotal ?? 0} total, ${imgBroken} broken${imgBroken ? ' → ' + JSON.stringify(probe.brokenSrcs) : ''}`);
  console.log(`  console errors: ${consoleErrors.length}${consoleErrors.length ? ' → ' + JSON.stringify(consoleErrors.slice(0, 3)) : ''}`);
  console.log(`  page errors: ${pageErrors.length}${pageErrors.length ? ' → ' + JSON.stringify(pageErrors.slice(0, 3)) : ''}`);
  console.log(`  failed requests: ${failedRequests.length}${failedRequests.length ? ' → ' + JSON.stringify(failedRequests.slice(0, 3)) : ''}`);
  console.log('');

  await ctx.close();
}

await browser.close();
console.log(anyProblem ? 'Verdict: issues found (see above).' : 'Verdict: clean — page renders without errors or overflow at all three viewports.');
process.exit(0);
