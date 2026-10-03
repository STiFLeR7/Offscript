/**
 * Deliverable Naming — the deployable HTML's own filename resolves from the Brief's `brand:`
 * field (falling back to the client id when absent), auto-versioned so a later regeneration in
 * the same outDir never silently overwrites a prior deliverable: <slug>.html, then
 * <slug>(2).html, <slug>(3).html, ... — the first name not already on disk.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDeliverableFilename } from '../../src/generate/deliverable-filename.js';

describe('resolveDeliverableFilename', () => {
  let outDir: string | undefined;
  afterEach(() => {
    if (outDir) rmSync(outDir, { recursive: true, force: true });
    outDir = undefined;
  });

  it('slugifies the brand name into <slug>.html when no file exists yet', () => {
    outDir = mkdtempSync(join(tmpdir(), 'offscript-deliverable-filename-'));
    expect(resolveDeliverableFilename(outDir, 'Better Bookkeeping Solutions Ltd', 'client-x')).toBe(
      'better-bookkeeping-solutions-ltd.html',
    );
  });

  it('falls back to the client id when the brief carries no brand name', () => {
    outDir = mkdtempSync(join(tmpdir(), 'offscript-deliverable-filename-'));
    expect(resolveDeliverableFilename(outDir, undefined, 'apa')).toBe('apa.html');
  });

  it('picks (2) when the base filename already exists in outDir', () => {
    outDir = mkdtempSync(join(tmpdir(), 'offscript-deliverable-filename-'));
    writeFileSync(join(outDir, 'better-bookkeeping-solutions-ltd.html'), '<html></html>', 'utf8');
    expect(resolveDeliverableFilename(outDir, 'Better Bookkeeping Solutions Ltd', 'client-x')).toBe(
      'better-bookkeeping-solutions-ltd(2).html',
    );
  });

  it('picks the first free (N) when several versions already exist', () => {
    outDir = mkdtempSync(join(tmpdir(), 'offscript-deliverable-filename-'));
    writeFileSync(join(outDir, 'acme.html'), '', 'utf8');
    writeFileSync(join(outDir, 'acme(2).html'), '', 'utf8');
    writeFileSync(join(outDir, 'acme(3).html'), '', 'utf8');
    expect(resolveDeliverableFilename(outDir, 'Acme', 'client-x')).toBe('acme(4).html');
  });

  it('never overwrites: the resolved name never matches a file already in outDir', () => {
    outDir = mkdtempSync(join(tmpdir(), 'offscript-deliverable-filename-'));
    writeFileSync(join(outDir, 'acme.html'), '', 'utf8');
    const name = resolveDeliverableFilename(outDir, 'Acme', 'client-x');
    expect(name).not.toBe('acme.html');
  });
});
