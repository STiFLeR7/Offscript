import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { gateKit } from '../src/flatten/index.js';
import { defaultRegistry } from '../src/operators/index.js';
import { resolveWorkingDir, DEFAULT_CLIENT } from '../src/paths.js';

const kitDir = resolveWorkingDir(DEFAULT_CLIENT, 'website');

// The real Claude Design kit is gitignored — present on dev machines, absent in
// clean checkouts. Guard so clean checkouts stay green (skipped, not failed).
const hasKit =
  existsSync(join(kitDir, 'colors_and_type.css')) &&
  existsSync(join(kitDir, 'ui_kits', 'website', 'index.html'));

describe('dry run over the real Example Brand kit (guarded)', () => {
  it.skipIf(!hasKit)(
    'flattens + gates the kit without any rail throwing',
    () => {
      // gateKit runs every rail's detect; if any rail threw, this would reject.
      const { html, warnings, findings } = gateKit(kitDir, defaultRegistry());

      // self-contained static document
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
      expect(html.trimStart().toLowerCase().startsWith('<!doctype html>')).toBe(true);

      // no runtime script tags survive the flatten (static output)
      expect(html).not.toContain('<script');
      // known lucide icons were substituted to inline <svg>, leaving no live
      // placeholder attribute. (The string `data-lucide` may still appear inside
      // the inlined harness CSS as a `[data-lucide]` selector — that's not a
      // placeholder, so match the attribute form specifically.)
      expect(/data-lucide=/.test(html)).toBe(false);

      // findings is a real array — do NOT hard-code a count (the kit may change)
      expect(Array.isArray(findings)).toBe(true);
      for (const f of findings) {
        expect(typeof f.id).toBe('string');
        expect(typeof f.description).toBe('string');
        expect(['auto-remediated', 'escalated', 'warning']).toContain(f.outcome);
      }

      expect(Array.isArray(warnings)).toBe(true);
    },
  );

  it.skipIf(hasKit)('is skipped in clean checkouts (kit is gitignored)', () => {
    // no-op: the kit is absent, nothing to assert
    expect(hasKit).toBe(false);
  });
});
