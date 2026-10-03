import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadBrandContract,
  writeBrandContract,
  deriveBrandContract,
  resolveSlot,
  SLOT_VOCABULARY,
  type BrandContract,
} from '../src/brand-contract.js';

// The real Example Brand kit is a gitignored client input — present in a working
// checkout, absent in a clean/portable export. Read it lazily and guard the
// CR-kit suite below so the package's test run stays green without the input.
const CR_KIT_PATH = path.join(
  __dirname,
  '..',
  'projects',
  'website',
  'example-brand',
  'colors_and_type.css',
);
const hasCrKit = fs.existsSync(CR_KIT_PATH);
const CR_KIT_CSS = hasCrKit ? fs.readFileSync(CR_KIT_PATH, 'utf8') : '';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offscript-bc-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function fixedNow(): Date {
  return new Date('2026-05-28T10:00:00.000Z');
}

describe('writeBrandContract / loadBrandContract', () => {
  const contract: BrandContract = {
    schemaVersion: 1,
    subject: 'acme',
    generatedAt: '2026-05-28T10:00:00.000Z',
    decidedBy: 'auto',
    slots: {
      '--accent': { token: '--acme-blue', confidence: 'auto' },
      '--surface-0': { token: '--acme-bg', confidence: 'human' },
      '--shadow-3': null,
    },
    unmappedReason: {
      '--shadow-3': 'no overlay shadow defined',
    },
  };

  it('round-trips a BrandContract through disk', () => {
    const p = path.join(tmp, 'brand-contract.json');
    writeBrandContract(p, contract);
    const loaded = loadBrandContract(p);
    expect(loaded).toEqual(contract);
  });

  it('returns null when the file does not exist', () => {
    expect(loadBrandContract(path.join(tmp, 'missing.json'))).toBeNull();
  });

  it('throws on malformed shape', () => {
    const p = path.join(tmp, 'bad.json');
    fs.writeFileSync(p, JSON.stringify({ schemaVersion: 1, slots: {} }), 'utf8');
    expect(() => loadBrandContract(p)).toThrow(/not a valid BrandContract/);
  });

  it('produces deterministic, sorted output regardless of input key order', () => {
    const shuffled: BrandContract = {
      ...contract,
      slots: {
        '--surface-0': contract.slots['--surface-0'],
        '--shadow-3': contract.slots['--shadow-3'],
        '--accent': contract.slots['--accent'],
      },
    };
    const p = path.join(tmp, 'sorted.json');
    writeBrandContract(p, shuffled);
    const raw = fs.readFileSync(p, 'utf8');
    const accentIdx = raw.indexOf('"--accent"');
    const shadowIdx = raw.indexOf('"--shadow-3"');
    const surfaceIdx = raw.indexOf('"--surface-0"');
    expect(accentIdx).toBeGreaterThan(-1);
    expect(accentIdx).toBeLessThan(shadowIdx);
    expect(shadowIdx).toBeLessThan(surfaceIdx);
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('is idempotent: identical content does not bump mtime', () => {
    const p = path.join(tmp, 'idempotent.json');
    writeBrandContract(p, contract);
    const mtime1 = fs.statSync(p).mtimeMs;
    // Force a small delay so mtime would change if the file were rewritten.
    const future = mtime1 - 10_000;
    fs.utimesSync(p, future / 1000, future / 1000);
    const beforeSecond = fs.statSync(p).mtimeMs;
    writeBrandContract(p, contract);
    const mtime2 = fs.statSync(p).mtimeMs;
    expect(mtime2).toBe(beforeSecond);
  });

  it('is idempotent across generatedAt-only differences (CLI re-runs)', () => {
    const p = path.join(tmp, 'generatedAt-only.json');
    writeBrandContract(p, contract);
    const beforeContent = fs.readFileSync(p, 'utf8');
    // Stamp into the past so a real overwrite would unmistakably change mtime.
    const past = (Date.now() - 10_000) / 1000;
    fs.utimesSync(p, past, past);
    const before = fs.statSync(p).mtimeMs;
    writeBrandContract(p, { ...contract, generatedAt: '2099-01-01T00:00:00.000Z' });
    const after = fs.statSync(p).mtimeMs;
    expect(after).toBe(before);
    expect(fs.readFileSync(p, 'utf8')).toBe(beforeContent);
  });

  it('overwrites when content changes', () => {
    const p = path.join(tmp, 'changes.json');
    writeBrandContract(p, contract);
    const changed: BrandContract = {
      ...contract,
      slots: { ...contract.slots, '--accent': { token: '--acme-red', confidence: 'human' } },
    };
    writeBrandContract(p, changed);
    expect(loadBrandContract(p)).toEqual(changed);
  });
});

describe('resolveSlot', () => {
  const contract: BrandContract = {
    schemaVersion: 1,
    subject: 'cr',
    generatedAt: '2026-05-28T00:00:00.000Z',
    decidedBy: 'auto',
    slots: {
      '--accent': { token: '--cr-brand-blue', confidence: 'auto' },
      '--surface-3': null,
    },
  };

  it('returns null when the contract is undefined', () => {
    expect(resolveSlot(undefined, '--accent')).toBeNull();
  });

  it('returns null when the slot is not declared', () => {
    expect(resolveSlot(contract, '--type-base')).toBeNull();
  });

  it('returns null when the slot is explicitly null', () => {
    expect(resolveSlot(contract, '--surface-3')).toBeNull();
  });

  it('returns the mapping for a declared slot', () => {
    expect(resolveSlot(contract, '--accent')).toEqual({
      token: '--cr-brand-blue',
      confidence: 'auto',
    });
  });

  it('attaches the kit-side value when tokens are provided', () => {
    const tokens = new Map<string, string>([['--cr-brand-blue', '#149DFF']]);
    expect(resolveSlot(contract, '--accent', tokens)).toEqual({
      token: '--cr-brand-blue',
      value: '#149DFF',
      confidence: 'auto',
    });
  });

  it('omits value when the token is absent from the map', () => {
    const tokens = new Map<string, string>();
    expect(resolveSlot(contract, '--accent', tokens)).toEqual({
      token: '--cr-brand-blue',
      confidence: 'auto',
    });
  });
});

describe.skipIf(!hasCrKit)('deriveBrandContract — CR kit', () => {
  const derived = deriveBrandContract(CR_KIT_CSS, { subject: 'example-brand', now: fixedNow });

  it('returns a complete, schema-correct contract', () => {
    expect(derived.schemaVersion).toBe(1);
    expect(derived.subject).toBe('example-brand');
    expect(derived.decidedBy).toBe('auto');
    expect(derived.generatedAt).toBe('2026-05-28T10:00:00.000Z');
    for (const slot of SLOT_VOCABULARY) {
      expect(derived.slots).toHaveProperty(slot);
    }
  });

  it('picks --cr-brand-blue as --accent', () => {
    expect(derived.slots['--accent']).toEqual({
      token: '--cr-brand-blue',
      confidence: 'auto',
    });
  });

  it('picks a second saturated brand color as --accent-2', () => {
    expect(derived.slots['--accent-2']?.token).toBe('--cr-brand-indigo');
  });

  it('picks --cr-brand-blue-100 as --accent-soft (close-hue tint)', () => {
    expect(derived.slots['--accent-soft']?.token).toBe('--cr-brand-blue-100');
  });

  it('picks --cr-bg as --surface-0 (white)', () => {
    expect(derived.slots['--surface-0']?.token).toBe('--cr-bg');
  });

  it('picks two off-white tokens as --surface-1 / --surface-2', () => {
    const s1 = derived.slots['--surface-1']?.token;
    const s2 = derived.slots['--surface-2']?.token;
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1).not.toBe(s2);
    expect([s1, s2]).toContain('--cr-bg-warm');
  });

  it('leaves --surface-3 unmapped with a reason', () => {
    expect(derived.slots['--surface-3']).toBeNull();
    expect(derived.unmappedReason?.['--surface-3']).toBeDefined();
  });

  it('picks a dark, neutral fg token as --ink-1', () => {
    expect(derived.slots['--ink-1']?.token).toBe('--cr-fg');
  });

  it('picks the three smallest distinct radius values as --radius-sm / -md / -lg', () => {
    expect(derived.slots['--radius-sm']?.token).toBe('--cr-radius-xs');
    expect(derived.slots['--radius-md']?.token).toBe('--cr-radius-sm');
    expect(derived.slots['--radius-lg']?.token).toBe('--cr-radius-md');
  });

  it('picks shadow tokens in source order', () => {
    expect(derived.slots['--shadow-1']?.token).toBe('--cr-shadow-card');
    expect(derived.slots['--shadow-2']?.token).toBe('--cr-shadow-card-sm');
    expect(derived.slots['--shadow-3']).toBeNull();
  });

  it('picks --cr-font-display and --cr-font-body as font slots', () => {
    expect(derived.slots['--font-display']?.token).toBe('--cr-font-display');
    expect(derived.slots['--font-text']?.token).toBe('--cr-font-body');
  });

  it('leaves motion slots null with a uniform reason', () => {
    for (const slot of ['--motion-fast', '--motion-med', '--motion-slow', '--motion-ease']) {
      expect(derived.slots[slot]).toBeNull();
      expect(derived.unmappedReason?.[slot]).toMatch(/motion/);
    }
  });

  it('round-trips through disk', () => {
    const p = path.join(tmp, 'cr-brand-contract.json');
    writeBrandContract(p, derived);
    const reloaded = loadBrandContract(p);
    expect(reloaded).toEqual(derived);
  });
});

describe('deriveBrandContract — degenerate kits', () => {
  it('returns an all-null contract for an empty kit', () => {
    const derived = deriveBrandContract(':root {}', { subject: 'empty', now: fixedNow });
    for (const slot of SLOT_VOCABULARY) {
      expect(derived.slots[slot]).toBeNull();
    }
    expect(derived.decidedBy).toBe('auto');
  });

  it('defaults subject to "auto" when omitted', () => {
    const derived = deriveBrandContract(':root {}');
    expect(derived.subject).toBe('auto');
  });
});
