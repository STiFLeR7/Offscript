#!/usr/bin/env tsx
/**
 * Ad-hoc live-HTML fetcher (M2 Track A Task 9).
 *
 * Wraps `fetchLiveHtml` for designer / debug use outside the harden
 * flow. Pulls a URL through the Scrapling stealth fetcher, writes the
 * rendered HTML to disk.
 *
 *   tsx scripts/fetch-live.ts <url> <out-path>
 *
 * Examples:
 *   tsx scripts/fetch-live.ts https://example-brand.com /tmp/cr-live.html
 *   tsx scripts/fetch-live.ts https://example.com   ./projects/cr/live.html
 *
 * On success: writes the file and prints "wrote N bytes to <out-path>".
 * On failure: writes nothing, prints the underlying error to stderr,
 * exits non-zero. Designed to be the bytes-source for an ad-hoc
 * `compareLiveVsKit(...)` invocation, or for stashing a known-good
 * reference HTML into `<kitDir>/.kit-vs-live.json` (Task 10 wiring).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fetchLiveHtml } from '../src/live-comparator.js';

async function main(): Promise<void> {
  const [url, out] = process.argv.slice(2);
  if (!url || !out) {
    process.stderr.write(
      'usage: tsx scripts/fetch-live.ts <url> <out-path>\n' +
        '  url      — http(s) URL of the live reference page\n' +
        '  out-path — file path to write the fetched HTML to\n',
    );
    process.exit(2);
  }

  const absOut = resolve(out);
  try {
    const html = await fetchLiveHtml(url);
    mkdirSync(dirname(absOut), { recursive: true });
    writeFileSync(absOut, html, 'utf8');
    const bytes = Buffer.byteLength(html, 'utf8');
    process.stdout.write(`wrote ${bytes} bytes to ${absOut}\n`);
  } catch (err) {
    process.stderr.write(`fetch-live: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

void main();
