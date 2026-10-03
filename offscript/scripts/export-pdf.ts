/**
 * export-pdf — turn a finished HTML artifact into a shareable, self-contained PDF
 * (and a self-contained HTML alongside it).
 *
 * Why: collateral/website artifacts link LOCAL assets (colors_and_type.css,
 * assets/, fonts/) by relative path. Shared on their own they break. This script
 * first SELF-CONTAINS the artifact (inlines CSS + fonts + images as data URIs via
 * the collateral intake), then prints it to A4 PDF with Playwright. The PDF — and
 * the emitted *.selfcontained.html — carry everything inline, so they survive being
 * emailed / dropped into a repo with no asset folder.
 *
 * This is an EXPORT utility, not a harden pass: it does not gate, score, or freeze.
 * Offscript still hardens, never generates — and this neither generates nor hardens, it
 * just packages a finished artifact for sharing.
 *
 * Usage (from the offscript engine root):
 *   npx tsx scripts/export-pdf.ts <input.html> [--base <dir>] [--out <file.pdf>]
 *                                 [--landscape] [--no-html]
 *
 *   --base <dir>   directory the artifact's relative hrefs resolve against
 *                  (where colors_and_type.css + assets/ live). Default: the input's
 *                  own folder. For the vendored Example Brand bundle, pass the repo root.
 *   --out <file>   PDF output path. Default: <input>.pdf
 *   --landscape    landscape A4 (decks). Default: portrait (collateral/one-pager).
 *   --no-html      do not also write the *.selfcontained.html sidecar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { chromium } from 'playwright';
import { intakeCollateral, isCollateral } from '../src/collateral/intake.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input || input.startsWith('--')) {
    console.error('usage: npx tsx scripts/export-pdf.ts <input.html> [--base <dir>] [--out <file.pdf>] [--landscape] [--no-html]');
    process.exit(2);
  }
  const inPath = resolve(process.cwd(), input);
  const baseDir = resolve(process.cwd(), arg('--base') ?? dirname(inPath));
  const outPdf = resolve(process.cwd(), arg('--out') ?? inPath.replace(/\.html?$/i, '') + '.pdf');
  const landscape = flag('--landscape');
  const writeHtml = !flag('--no-html');

  const raw = readFileSync(inPath, 'utf8');

  // 1. Self-contain. Collateral (.cr-doc) goes through intake; anything else is
  //    rendered as-is (a website artifact is expected to already be self-contained).
  let html = raw;
  if (isCollateral(raw)) {
    html = intakeCollateral(raw, baseDir).selfContained;
    console.log(`[export-pdf] self-contained collateral; assets resolved against ${baseDir}`);
  } else {
    console.log('[export-pdf] not a .cr-doc collateral — rendering the artifact as-is (assumed self-contained)');
  }

  if (writeHtml) {
    const sidecar = outPdf.replace(/\.pdf$/i, '') + '.selfcontained.html';
    writeFileSync(sidecar, html, 'utf8');
    console.log(`[export-pdf] wrote ${sidecar}`);
  }

  // 2. Print to A4 PDF. preferCSSPageSize honors the artifact's @page rules;
  //    zero margins + printBackground keep full-bleed covers intact.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
    await page.waitForTimeout(300); // let fonts/layout settle
    // Count real .cr-page units via exact class match (DOM querySelector won't
    // false-match cr-page-header/-foot the way the intake substring counter does).
    const units = await page.evaluate(() => document.querySelectorAll('.cr-page').length);
    await page.pdf({
      path: outPdf,
      format: 'A4',
      landscape,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    console.log(`[export-pdf] wrote ${outPdf}  (${landscape ? 'A4 landscape' : 'A4 portrait'}${units ? `, ${units} page(s)` : ''})`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
