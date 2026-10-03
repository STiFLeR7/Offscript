import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseHtml, serializeHtml } from '../../src/working-rep.js';
import {
  responsiveNeedRendered,
  measureOverflowsAsync,
  isRenderedGateEnabled,
  formatRenderedFinding,
} from '../../src/operators/responsive-need-rendered.js';
import { defaultRegistry } from '../../src/operators/index.js';

const ctx = { params: {} };

const FIXTURE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; padding: 0; }
  .fluid { width: 100%; background: #eef; }
  .fixed { width: 1600px; background: #fee; }
</style></head><body>
<div class="fluid">fluid block</div>
<div class="fixed">fixed wide block</div>
</body></html>`;

describe('responsive-need-rendered operator — gate OFF (default CI path)', () => {
  const originalEnv = process.env.OFFSCRIPT_PLAYWRIGHT;

  beforeEach(() => {
    delete process.env.OFFSCRIPT_PLAYWRIGHT;
    // silence the one-shot console.warn during tests
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.OFFSCRIPT_PLAYWRIGHT;
    else process.env.OFFSCRIPT_PLAYWRIGHT = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns [] from detect when OFFSCRIPT_PLAYWRIGHT is not set (no Chromium launched)', () => {
    const tree = parseHtml(FIXTURE);
    expect(responsiveNeedRendered.detect(tree, ctx)).toEqual([]);
  });

  it('measureOverflowsAsync returns [] when the env gate is off', async () => {
    expect(isRenderedGateEnabled()).toBe(false);
    await expect(measureOverflowsAsync(FIXTURE)).resolves.toEqual([]);
  });

  it('never mutates the tree (apply is a no-op detector/rail)', () => {
    const tree = parseHtml(FIXTURE);
    const before = serializeHtml(tree);
    const findings = responsiveNeedRendered.apply(tree, ctx);
    expect(serializeHtml(tree)).toBe(before);
    expect(findings).toEqual([]);
  });

  it('registers in the default registry under its name (alongside static responsive-need)', () => {
    const reg = defaultRegistry();
    expect(reg.get('responsive-need-rendered')).toBe(responsiveNeedRendered);
    // The static one is still registered too — they coexist.
    expect(reg.get('responsive-need')).toBeDefined();
  });

  it('formatRenderedFinding builds a deterministic warning finding (no Playwright required)', () => {
    const f = formatRenderedFinding(360, 'div.fixed', 1240);
    expect(f).toEqual({
      id: 'responsive-need:rendered:overflow:360:div.fixed',
      description: "'div.fixed' element overflows by 1240 px at 360px viewport",
      outcome: 'warning',
    });
    // Same inputs → same output (pure function; harden-tail no-op fallback path).
    expect(formatRenderedFinding(360, 'div.fixed', 1240)).toEqual(f);
  });
});

// Rendered tests only run when the operator can really launch Chromium.
// Local dev/op gesture: `npx playwright install chromium && OFFSCRIPT_PLAYWRIGHT=1 npm test`.
const renderedReady = process.env.OFFSCRIPT_PLAYWRIGHT === '1';

describe.runIf(renderedReady)(
  'responsive-need-rendered operator — gate ON (requires OFFSCRIPT_PLAYWRIGHT=1 + Chromium)',
  () => {
    it('flags the 1600px fixed-width div at 360px viewport; fluid div is not flagged', async () => {
      const findings = await measureOverflowsAsync(FIXTURE);
      // Expect at least one finding at viewport 360 referencing the .fixed selector.
      const at360 = findings.filter((f) =>
        f.id.startsWith('responsive-need:rendered:overflow:360:'),
      );
      expect(at360.length).toBeGreaterThan(0);
      expect(at360.some((f) => f.id.includes('div.fixed'))).toBe(true);
      // The fluid div should NOT be flagged at any viewport.
      expect(findings.every((f) => !f.id.includes('div.fluid'))).toBe(true);
      // Outcome is warning across the board.
      expect(findings.every((f) => f.outcome === 'warning')).toBe(true);
    }, 30_000);

    it('is idempotent: a second measurement returns the same findings in the same order', async () => {
      const a = await measureOverflowsAsync(FIXTURE);
      const b = await measureOverflowsAsync(FIXTURE);
      expect(b.map((f) => f.id)).toEqual(a.map((f) => f.id));
      // Sorting invariant: viewport ascending, then selector ascending.
      const viewports = a.map((f) => Number(f.id.split(':')[3]));
      const sorted = [...viewports].sort((x, y) => x - y);
      expect(viewports).toEqual(sorted);
    }, 30_000);
  },
);
