import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CreativeIntentExporter } from '../src/export/exporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_LOG = join(__dirname, 'fixtures', 'sample-log.md');

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'creative-intent-export-'));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('CreativeIntentExporter', () => {
  it('exports only the eligible approved (v5+, approved=yes) creatives', async () => {
    const exporter = new CreativeIntentExporter();
    const summary = await exporter.export({ logPath: FIXTURE_LOG, outDir });

    expect(summary.exportedCount).toBe(2);
    expect(summary.skippedCount).toBe(2); // pre-v5-approved (ineligible), v5-unapproved-draft (not approved)
    expect(summary.failedCount).toBe(0);

    const files = readdirSync(outDir);
    expect(files.sort()).toEqual([
      'v5-approved-one.creative-intent.json',
      'v5-approved-two.creative-intent.json',
    ]);
  });

  it('never writes an artifact for a rejected or draft creative', async () => {
    const exporter = new CreativeIntentExporter();
    await exporter.export({ logPath: FIXTURE_LOG, outDir });
    expect(existsSync(join(outDir, 'v5-unapproved-draft.creative-intent.json'))).toBe(false);
  });

  it('never writes an artifact for a pre-contract (pre-v5) creative even though approved=yes', async () => {
    const exporter = new CreativeIntentExporter();
    await exporter.export({ logPath: FIXTURE_LOG, outDir });
    expect(existsSync(join(outDir, 'pre-v5-approved.creative-intent.json'))).toBe(false);
  });

  it('writes a schema-shaped, digest-correct instance for an eligible creative', async () => {
    const exporter = new CreativeIntentExporter();
    await exporter.export({ logPath: FIXTURE_LOG, outDir });

    const written = JSON.parse(
      readFileSync(join(outDir, 'v5-approved-two.creative-intent.json'), 'utf8')
    );
    expect(written.id).toBe('v5-approved-two');
    expect(written.contractVersion).toBe(1);
    expect(written.feature).toBe('analytics');
    expect(written.camera).toBe('component');
    expect(written.ratio).toBe('3:4');
    expect(written['content-provenance']).toBe('human');
    expect(written['must-include']).toEqual(['the score as the hero number']);
    expect(written.section).toBe('benefit');
    expect(written.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('produces byte-identical output on a repeated export of the same source', async () => {
    const exporter = new CreativeIntentExporter();
    await exporter.export({ logPath: FIXTURE_LOG, outDir });
    const first = readFileSync(join(outDir, 'v5-approved-one.creative-intent.json'), 'utf8');

    const outDir2 = mkdtempSync(join(tmpdir(), 'creative-intent-export-'));
    try {
      await exporter.export({ logPath: FIXTURE_LOG, outDir: outDir2 });
      const second = readFileSync(join(outDir2, 'v5-approved-one.creative-intent.json'), 'utf8');
      expect(second).toBe(first);
    } finally {
      rmSync(outDir2, { recursive: true, force: true });
    }
  });

  it('reports a diagnostic per source line, including skip reasons', async () => {
    const exporter = new CreativeIntentExporter();
    const summary = await exporter.export({ logPath: FIXTURE_LOG, outDir });

    const draft = summary.diagnostics.find((d) => d.slug === 'v5-unapproved-draft');
    expect(draft?.status).toBe('skipped');
    expect(draft?.reason).toMatch(/approved/i);

    const preV5 = summary.diagnostics.find((d) => d.slug === 'pre-v5-approved');
    expect(preV5?.status).toBe('skipped');
    expect(preV5?.reason).toMatch(/camera/);
  });
});
