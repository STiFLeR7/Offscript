import { describe, it, expect } from 'vitest';
import { actuatePassGoverned, runGovernance } from '../src/actuation-governed.js';
import { scriptedActuator } from '../src/actuators/scripted.js';
import { parseHtml } from '../src/working-rep.js';
import { loadTokensFromCss } from '../src/tokens.js';
import { deriveBrandContract } from '../src/brand-contract.js';
import { deriveBrandPosture } from '../src/posture.js';
import type { OperatorContext, Finding } from '../src/operator.js';
import type { PassSpec } from '../src/actuation.js';
import type { Rail } from '../src/gate.js';

const MUTED_CSS = `:root { --brand-slate: #6b7280; --fg: #1a1a1a; --bg: #ffffff; }`;
function mutedCtx(): OperatorContext {
  const tokens = loadTokensFromCss(MUTED_CSS);
  const brandContract = deriveBrandContract(MUTED_CSS, { subject: 'muted' });
  const posture = deriveBrandPosture({ tokens, brandContract });
  return { params: {}, tokens, brandContract, posture };
}

const REFERENCE = `<body><main><section data-archetype="hero"><h1>T</h1></section></main></body>`;

// A rail that fails while the doc contains the marker FIX-ME, passes once gone.
const markerRail: Rail = {
  name: 'marker',
  detect(tree): Finding[] {
    // crude: re-serialize via text scan — use a data attr marker instead.
    const found: Finding[] = [];
    const walk = (node: any): void => {
      if (node.type === 'element' && node.properties?.dataFixme !== undefined) {
        found.push({ id: 'marker:present', description: 'marker present', outcome: 'escalated' });
      }
      (node.children ?? []).forEach(walk);
    };
    walk(tree);
    return found;
  },
};

function pass(rails: Rail[]): PassSpec {
  return { name: 'test', instruction: 'fix it', rails };
}

describe('runGovernance', () => {
  it('returns clean for a faithful, non-sloppy candidate', () => {
    const ctx = mutedCtx();
    const tree = parseHtml(REFERENCE);
    const ref = parseHtml(REFERENCE);
    const result = runGovernance(tree, ref, ctx);
    expect(result.slop).toEqual([]);
    expect(result.fidelity).toEqual([]);
  });

  it('detects slop introduced by the candidate', () => {
    const ctx = mutedCtx();
    const ref = parseHtml(REFERENCE);
    const sloppy = parseHtml(`<body><main><section data-archetype="hero"><h1 style="color:#2563eb">T</h1></section></main></body>`);
    const result = runGovernance(sloppy, ref, ctx);
    expect(result.slop.length).toBeGreaterThan(0);
  });
});

describe('actuatePassGoverned', () => {
  it('converges with zero loops when already clean', async () => {
    const ctx = mutedCtx();
    const out = await actuatePassGoverned({
      html: REFERENCE,
      reference: REFERENCE,
      ctx,
      pass: pass([]),
      actuator: scriptedActuator('SHOULD-NOT-BE-CALLED'),
    });
    expect(out.log.status).toBe('passed');
    expect(out.governance.loops).toBe(0);
    expect(out.governance.inBounds).toBe(true);
  });

  it('loops until the rail clears, then passes', async () => {
    const ctx = mutedCtx();
    const dirty = `<body><main><section data-archetype="hero" data-fixme><h1>T</h1></section></main></body>`;
    const fixed = REFERENCE;
    const out = await actuatePassGoverned({
      html: dirty,
      reference: REFERENCE,
      ctx,
      pass: pass([markerRail]),
      actuator: scriptedActuator(fixed),
    });
    expect(out.log.status).toBe('passed');
    expect(out.governance.loops).toBe(1);
    expect(out.html).toContain('<h1>T</h1>');
  });

  it('escalates when the actuator introduces slop it cannot clear', async () => {
    const ctx = mutedCtx();
    // Actuator "fixes" the marker but paints an off-token saturated colour.
    const sloppyFix = `<body><main><section data-archetype="hero"><h1 style="color:#2563eb">T</h1></section></main></body>`;
    const out = await actuatePassGoverned({
      html: `<body><main><section data-archetype="hero" data-fixme><h1>T</h1></section></main></body>`,
      reference: REFERENCE,
      ctx,
      pass: pass([markerRail]),
      actuator: scriptedActuator(sloppyFix),
      maxLoops: 2,
    });
    expect(out.log.status).toBe('escalated');
    expect(out.governance.slopIntroduced).toBeGreaterThan(0);
    expect(out.governance.inBounds).toBe(false);
  });

  it('escalates on structural drift (a removed landmark)', async () => {
    const ctx = mutedCtx();
    const drifted = `<main><section data-archetype="hero"><h1>T</h1></section></main>`; // body landmark fine, but drop main? keep main; drop section
    const dropSection = `<body><main></main></body>`;
    const out = await actuatePassGoverned({
      html: `<body><main><section data-archetype="hero" data-fixme><h1>T</h1></section></main></body>`,
      reference: REFERENCE,
      ctx,
      pass: pass([markerRail]),
      actuator: scriptedActuator(dropSection),
      maxLoops: 2,
    });
    expect(out.log.status).toBe('escalated');
    expect(out.governance.drift).toBeGreaterThan(0);
  });
});
