import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../src/cli-args.js';

const DEFAULTS = { sourceRoot: '/repo/design/website', targetRoot: '/repo/offscript/resources/design_processes/website' };

describe('parseCliArgs', () => {
  it('defaults to the real repo source/target with every flag off', () => {
    expect(parseCliArgs([], DEFAULTS)).toEqual({
      sourceRoot: DEFAULTS.sourceRoot,
      targetRoot: DEFAULTS.targetRoot,
      dryRun: false,
      validate: false,
      report: false,
    });
  });

  it('overrides source/target when passed explicitly', () => {
    const result = parseCliArgs(['--source', '/tmp/src', '--target', '/tmp/dst'], DEFAULTS);
    expect(result.sourceRoot).toBe('/tmp/src');
    expect(result.targetRoot).toBe('/tmp/dst');
  });

  it('recognizes --dry-run, --validate, --report independently', () => {
    expect(parseCliArgs(['--dry-run'], DEFAULTS).dryRun).toBe(true);
    expect(parseCliArgs(['--validate'], DEFAULTS).validate).toBe(true);
    expect(parseCliArgs(['--report'], DEFAULTS).report).toBe(true);
  });

  it('combines flags', () => {
    const result = parseCliArgs(['--dry-run', '--validate', '--report'], DEFAULTS);
    expect(result).toMatchObject({ dryRun: true, validate: true, report: true });
  });
});
