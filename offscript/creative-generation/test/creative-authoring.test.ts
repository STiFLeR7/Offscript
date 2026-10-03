import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildCreativeAuthoringPrompt,
  validateAuthoredCreative,
  parseCreativeAuthoringResponse,
  createScriptedCreativeAuthoringExecutor,
  createRealCreativeAuthoringExecutor,
  CREATIVE_AUTHORING_LLM_EXECUTOR,
  type CreativeAuthoringRequest,
  type CreativeAuthoringOutcome,
} from '../src/creative-authoring.js';

const COMPONENTS = ['workflow builder', 'execution status', 'automation timeline', 'success notification'];

const REQUEST: CreativeAuthoringRequest = {
  // These legacy typography examples deliberately choose the bundled reference brand.
  brand: { reference: 'example' },
  belief: 'AI agents run the operation end to end, with people still in control of what matters',
  feature: 'automation',
  mustInclude: ['the agent executing a multi-step workflow autonomously'],
  ratio: '16:9',
  components: COMPONENTS,
  camera: 'workflow',
  compositionBias: { density: 'moderate', breathing: 'standard' },
  roles: {
    hero: 'execution status',
    support: ['workflow builder'],
    signal: ['automation timeline'],
    subordinateContext: ['success notification'],
    unassigned: [],
  },
};

const REQUEST_WITH_ENV: CreativeAuthoringRequest = {
  ...REQUEST,
  environment: 'dawn-haze',
};

// Target Ratio / Canvas Geometry sprint — REQUEST's own ratio is '16:9', whose real pixel
// dimensions (producer.ts's dimensionsForRatio) are 640x360; this fixture pairs them so tests can
// assert the prompt/validator honor the ACTUAL target geometry, never an assumed default.
const REQUEST_WITH_GEOMETRY: CreativeAuthoringRequest = {
  ...REQUEST,
  canvasWidth: 640,
  canvasHeight: 360,
};

const REQUEST_3_4_WITH_GEOMETRY: CreativeAuthoringRequest = {
  ...REQUEST,
  ratio: '3:4',
  canvasWidth: 360,
  canvasHeight: 480,
};

function validHtml(opts?: { environmentSlot?: string; extra?: string; heroStyle?: string; geometry?: string }): string {
  const envSlot = opts?.environmentSlot ? ` data-environment-slot="${opts.environmentSlot}"` : '';
  const heroStyle = opts?.heroStyle ? ` style="${opts.heroStyle}"` : '';
  const geometryStyle = opts?.geometry ? `<style>#cr-artifact-visual{${opts.geometry}}</style>` : '';
  return (
    `<!doctype html><html><head><meta charset="utf-8">${geometryStyle}</head><body>` +
    `<div id="cr-artifact-visual">` +
    `<div${envSlot} class="cr-environment-slot"></div>` +
    `<div class="cr-composition"><div data-component="execution status" data-role="hero"${heroStyle}>hero</div>` +
    `<div data-component="workflow builder" data-role="support">support</div></div>` +
    `${opts?.extra ?? ''}` +
    `</div></body></html>`
  );
}

// ── buildCreativeAuthoringPrompt ──────────────────────────────────────────────────────────────
describe('buildCreativeAuthoringPrompt', () => {
  it('states the given decisions and separates them from the authoring instruction', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/DECISIONS/);
    expect(prompt).toMatch(/AUTHORING/);
    expect(prompt).toContain(REQUEST.belief);
    expect(prompt).toContain(REQUEST.feature);
    for (const c of COMPONENTS) expect(prompt).toContain(c);
    expect(prompt).toContain('workflow'); // camera
    expect(prompt).toContain('execution status'); // hero
  });

  it('never invites the author to pick a different environment, camera, feature, or invent components', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/do not (choose|select|change|invent)/i);
  });

  it('instructs the author to mark every rendered component with a data-component attribute — the validator\'s own convention', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/data-component="/);
  });

  it('instructs the author to mark every component\'s data-role, reusing the given role assignment verbatim', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/data-role="/);
    expect(prompt).toMatch(/\bhero\b/);
    expect(prompt).toMatch(/\bsupport\b/);
  });

  it('states the primary/supporting/context authoring rule and forbids two equally dominant systems', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/PRIMARY PROOF/i);
    expect(prompt).toMatch(/SUPPORTING PROOF/i);
    expect(prompt).toMatch(/two.*(equally|competing).*dominant|competing.*primary/i);
  });

  it('states the duplicate-workflow rule: prefer one coherent composition over overlapping repeated systems', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/duplicate/i);
    expect(prompt).toMatch(/one coherent/i);
  });

  it('states the opacity rule: never use low opacity as a substitute for hierarchy on meaningful content', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/opacity/i);
    expect(prompt).toMatch(/ghost|shadow|watermark/i);
  });

  it('states the overlap rule: overlap must communicate a clear spatial relationship', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/overlap/i);
  });

  it('states the real, single authoritative typeface — never inviting the author to invent one', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toContain('Instrument Sans');
    expect(prompt).toMatch(/never invent|do not invent/i);
  });

  it('states real weight steps (400/500/600/700), never an invented in-between value', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/400/);
    expect(prompt).toMatch(/700/);
  });

  it('states the real accent and text colors, never an invented color', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toContain('#FF7926');
    expect(prompt).toContain('#2A2A2A');
  });

  it('states the exactly-three-register discipline with a real, sourced hero/micro ratio', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/three.*register|register.*three/i);
    expect(prompt).toMatch(/half-step/i);
  });

  it('states live-capture furniture guidance drawn from real exemplar evidence', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).toMatch(/cursor|tooltip/i);
  });

  it('instructs a placeholder slot for the environment, never asking the author to embed image bytes', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST_WITH_ENV);
    expect(prompt).toContain('dawn-haze');
    expect(prompt).toMatch(/data-environment-slot/);
  });

  it('omits any environment instruction when no environment was selected upstream', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).not.toMatch(/data-environment-slot="/);
  });
});

// ── Target canvas geometry (Target Ratio / Canvas Geometry sprint) ───────────────────────────────
describe('buildCreativeAuthoringPrompt — target geometry', () => {
  it('states the real target canvas width/height for a 16:9 request', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST_WITH_GEOMETRY);
    expect(prompt).toContain('640');
    expect(prompt).toContain('360');
    expect(prompt).toContain('16:9');
  });

  it('states the real target canvas width/height for a 3:4 request — not a hardcoded 16:9 default', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST_3_4_WITH_GEOMETRY);
    expect(prompt).toContain('360');
    expect(prompt).toContain('480');
    expect(prompt).toContain('3:4');
  });

  it('instructs the author not to assume a default canvas (e.g. 1280px or 16:9) when a different ratio was given', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST_3_4_WITH_GEOMETRY);
    expect(prompt).toMatch(/do not assume a default/i);
    expect(prompt).toContain('1280');
  });

  it('omits target-geometry guidance entirely when no canvas dimensions are given', () => {
    const prompt = buildCreativeAuthoringPrompt(REQUEST);
    expect(prompt).not.toMatch(/target canvas geometry/i);
  });
});

// ── validateAuthoredCreative — structural validator (Phase 11) ───────────────────────────────
describe('validateAuthoredCreative', () => {
  it('accepts well-formed HTML using only authoritative components', () => {
    const result = validateAuthoredCreative(validHtml(), REQUEST);
    expect(result.valid).toBe(true);
  });

  it('rejects HTML with no cr-artifact-visual root', () => {
    const html = '<html><body><div>nothing here</div></body></html>';
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/root/);
  });

  it('rejects an invented component not in the authoritative list', () => {
    const html = validHtml({ extra: '<div data-component="a made-up widget"></div>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/unsupported_component/);
  });

  it('rejects HTML missing the hero component from the given role assignment', () => {
    const html =
      `<!doctype html><html><body><div id="cr-artifact-visual">` +
      `<div data-component="workflow builder"></div></div></body></html>`;
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/hero/);
  });

  it('rejects a <script> tag — creatives are static markup', () => {
    const html = validHtml({ extra: '<script>alert(1)</script>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/script/);
  });

  it('rejects an absolute Windows drive-letter path leaking into the markup', () => {
    const html = validHtml({ extra: '<div>D:\\some\\path</div>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/external_path/);
  });

  it('rejects any reference to the historical Repo B reference system', () => {
    const html = validHtml({ extra: '<div>Offscript-creatives-generation</div>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/external_repository/);
  });

  it('rejects an obviously empty/placeholder body', () => {
    const html = `<!doctype html><html><body><div id="cr-artifact-visual"></div></body></html>`;
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/empty/);
  });

  it('requires a rendered environment slot when the request declares an environment', () => {
    const result = validateAuthoredCreative(validHtml(), REQUEST_WITH_ENV);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/environment/);
  });

  it('accepts a rendered environment slot matching the declared slug', () => {
    const html = validHtml({ environmentSlot: 'dawn-haze' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_ENV);
    expect(result.valid).toBe(true);
  });

  it('rejects an environment slot for a DIFFERENT slug than the one selected upstream', () => {
    const html = validHtml({ environmentSlot: 'lake-mirror' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_ENV);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/environment/);
  });
});

// ── Target canvas geometry (Target Ratio / Canvas Geometry sprint) ───────────────────────────────
describe('validateAuthoredCreative — target geometry', () => {
  it('accepts a root that declares aspect-ratio matching the target 16:9 canvas', () => {
    const html = validHtml({ geometry: 'aspect-ratio:640/360' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_GEOMETRY);
    expect(result.valid).toBe(true);
  });

  it('accepts a root that declares explicit width/height pixels matching the target canvas', () => {
    const html = validHtml({ geometry: 'width:640px;height:360px' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_GEOMETRY);
    expect(result.valid).toBe(true);
  });

  it('accepts a root declaring the real target geometry for a non-16:9 (3:4) canvas', () => {
    const html = validHtml({ geometry: 'aspect-ratio:360/480' });
    const result = validateAuthoredCreative(html, REQUEST_3_4_WITH_GEOMETRY);
    expect(result.valid).toBe(true);
  });

  it('rejects a root that declares no aspect-ratio or explicit width/height at all when a target canvas was given', () => {
    const html = validHtml();
    const result = validateAuthoredCreative(html, REQUEST_WITH_GEOMETRY);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/missing_geometry/);
  });

  it('rejects a root whose declared aspect ratio does not match the real target ratio', () => {
    const html = validHtml({ geometry: 'aspect-ratio:1/1' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_GEOMETRY);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/geometry_mismatch/);
  });

  it('rejects two conflicting aspect-ratio declarations in the same document', () => {
    const html = validHtml({ geometry: 'aspect-ratio:640/360', extra: '<style>.x{aspect-ratio:4/3}</style>' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_GEOMETRY);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/conflicting_geometry/);
  });

  it('rejects an inner element hardcoding a fixed pixel width larger than the real target canvas (the ~1280px-on-a-640px-canvas regression)', () => {
    const html = validHtml({ geometry: 'aspect-ratio:640/360', extra: '<div style="width:1280px">too wide</div>' });
    const result = validateAuthoredCreative(html, REQUEST_WITH_GEOMETRY);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/oversized_fixed_dimension/);
  });

  it('rejects the environment slot itself hardcoding a fixed pixel width larger than the real target canvas', () => {
    const html =
      `<!doctype html><html><head><style>#cr-artifact-visual{aspect-ratio:640/360}</style></head><body>` +
      `<div id="cr-artifact-visual">` +
      `<div data-environment-slot="dawn-haze" style="width:1280px"></div>` +
      `<div data-component="execution status" data-role="hero">hero</div>` +
      `<div data-component="workflow builder" data-role="support">support</div>` +
      `</div></body></html>`;
    const result = validateAuthoredCreative(html, { ...REQUEST_WITH_GEOMETRY, environment: 'dawn-haze' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/oversized_fixed_dimension/);
  });

  it('does not require any geometry declaration at all when no canvas dimensions are given upstream', () => {
    const result = validateAuthoredCreative(validHtml(), REQUEST);
    expect(result.valid).toBe(true);
  });
});

// ── Composition hierarchy — primary/supporting role marking (Composition Quality sprint) ────────
describe('validateAuthoredCreative — composition hierarchy', () => {
  it('reproduces the real problematic pattern: a meaningful component rendered near-invisible reads as ghost UI', () => {
    // The real defect found in the first authored autopilot-approval-console creative: the
    // "automation timeline" component was rendered at 16% opacity with no card container, making
    // real data (1,284 runs, 0 escalated) read as a shadow/watermark rather than intentional
    // supporting evidence.
    const html = validHtml({
      extra: '<div data-component="automation timeline" data-role="signal" style="opacity:0.16">1,284 runs</div>',
    });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/ghost_ui/);
  });

  it('a primary (hero) UI group can be identified via data-role', () => {
    const result = validateAuthoredCreative(validHtml(), REQUEST);
    expect(result.valid).toBe(true);
  });

  it('a secondary (support) UI group can be identified via data-role, distinct from hero', () => {
    const html = validHtml({ extra: '<div data-component="automation timeline" data-role="signal">trend</div>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(true);
  });

  it('rejects an accidental duplicate-primary: two components both marked data-role="hero"', () => {
    const html = validHtml({ extra: '<div data-component="automation timeline" data-role="hero">also hero?</div>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/duplicate_primary/);
  });

  it('rejects a data-role that contradicts the given role assignment (workflow builder is "support", not "signal")', () => {
    const html =
      `<!doctype html><html><body><div id="cr-artifact-visual">` +
      `<div data-component="execution status" data-role="hero">hero</div>` +
      `<div data-component="workflow builder" data-role="signal">mislabeled</div>` +
      `</div></body></html>`;
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/role_mismatch/);
  });

  it('requires a data-role on every rendered component when a role assignment was given', () => {
    const html = validHtml({ extra: '<div data-component="automation timeline">unlabeled</div>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/missing_role_marker/);
  });

  it('rejects a meaningful component painted with a near-transparent rgba fill', () => {
    const html = validHtml({
      extra:
        '<div data-component="automation timeline" data-role="signal" style="background:rgba(22,24,28,0.16)">data</div>',
    });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/ghost_ui/);
  });

  it('accepts a legible supporting component (no opacity/alpha floor violation)', () => {
    const html = validHtml({
      extra: '<div data-component="automation timeline" data-role="signal" style="background:#eee">data</div>',
    });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(true);
  });

  it('does not require data-role at all when no role assignment was given upstream', () => {
    const { roles: _roles, ...requestNoRoles } = REQUEST;
    const html =
      `<!doctype html><html><body><div id="cr-artifact-visual">` +
      `<div data-component="workflow builder">x</div></div></body></html>`;
    const result = validateAuthoredCreative(html, requestNoRoles as CreativeAuthoringRequest);
    expect(result.valid).toBe(true);
  });
});

// ── parseCreativeAuthoringResponse ────────────────────────────────────────────────────────────
describe('parseCreativeAuthoringResponse', () => {
  it('accepts a fenced ```html response and strips the fence', () => {
    const raw = '```html\n' + validHtml() + '\n```';
    const outcome = parseCreativeAuthoringResponse(raw, REQUEST);
    expect(outcome.outcome).toBe('authored');
    if (outcome.outcome === 'authored') expect(outcome.html).toContain('id="cr-artifact-visual"');
  });

  it('accepts a raw unfenced HTML response', () => {
    const outcome = parseCreativeAuthoringResponse(validHtml(), REQUEST);
    expect(outcome.outcome).toBe('authored');
  });

  it('embeds the real environment asset in place of the declared slot, as a base64 data URI', () => {
    const html = validHtml({ environmentSlot: 'dawn-haze' });
    const outcome = parseCreativeAuthoringResponse(html, REQUEST_WITH_ENV);
    expect(outcome.outcome).toBe('authored');
    if (outcome.outcome === 'authored') {
      expect(outcome.html).toMatch(/data:image\/jpeg;base64,/);
      expect(outcome.html).toMatch(/background-image:url\(data:image\/jpeg;base64,/); // embedded as a real style, not left as a bare slot marker
    }
  });

  it('recognizes an explicit unavailable refusal', () => {
    const raw = JSON.stringify({ status: 'unavailable', reason: 'cannot honestly author this composition' });
    const outcome = parseCreativeAuthoringResponse(raw, REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toContain('cannot honestly author');
  });

  it('never falls back to a placeholder render — a structurally invalid response is unavailable, not repaired', () => {
    const outcome = parseCreativeAuthoringResponse('<div>not even a root id</div>', REQUEST);
    expect(outcome.outcome).toBe('unavailable');
  });
});

// ── Brand typography — mechanical embedding + structural validation (exemplar-fidelity sprint) ──
describe('parseCreativeAuthoringResponse — brand typography embedding', () => {
  it('mechanically embeds the real Instrument Sans @font-face, never left to the author', () => {
    const outcome = parseCreativeAuthoringResponse(validHtml(), REQUEST);
    expect(outcome.outcome).toBe('authored');
    if (outcome.outcome === 'authored') {
      expect(outcome.html).toMatch(/@font-face/);
      expect(outcome.html).toContain('Instrument Sans');
      expect(outcome.html).toMatch(/data:font\/ttf;base64,/);
    }
  });
});

describe('validateAuthoredCreative — brand typography discipline', () => {
  it('rejects a font-family declaration that omits the real authoritative typeface', () => {
    const html = validHtml({ extra: '<style>.x{font-family:"Inter",sans-serif}</style>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/font_family/);
  });

  it('accepts a font-family declaration that uses the real typeface plus a generic fallback', () => {
    const html = validHtml({ extra: '<style>.x{font-family:"Instrument Sans",sans-serif}</style>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(true);
  });

  it('rejects an invented in-between font-weight (the "mush" pattern)', () => {
    const html = validHtml({ extra: '<style>.x{font-weight:550}</style>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/weight/);
  });

  it('accepts real weight steps (400/500/600/700)', () => {
    const html = validHtml({ extra: '<style>.a{font-weight:400}.b{font-weight:700}</style>' });
    const result = validateAuthoredCreative(html, REQUEST);
    expect(result.valid).toBe(true);
  });
});

// ── createScriptedCreativeAuthoringExecutor ───────────────────────────────────────────────────
describe('createScriptedCreativeAuthoringExecutor', () => {
  it('always resolves with the given outcome, regardless of the request', async () => {
    const outcome: CreativeAuthoringOutcome = { outcome: 'authored', html: validHtml(), evidence: 'x' };
    const executor = createScriptedCreativeAuthoringExecutor(outcome);
    expect(await executor(REQUEST)).toBe(outcome);
    expect(await executor(REQUEST_WITH_ENV)).toBe(outcome);
  });
});

// ── createRealCreativeAuthoringExecutor ───────────────────────────────────────────────────────
describe('createRealCreativeAuthoringExecutor', () => {
  let dispatchDir: string | undefined;
  afterEach(() => {
    if (dispatchDir && existsSync(dispatchDir)) rmSync(dispatchDir, { recursive: true, force: true });
    dispatchDir = undefined;
  });

  it('returns authored on a valid dispatch response', async () => {
    const executor = createRealCreativeAuthoringExecutor({ dispatch: async () => validHtml() });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('authored');
  });

  it('becomes unavailable on a dispatch exception', async () => {
    const executor = createRealCreativeAuthoringExecutor({
      dispatch: async () => {
        throw new Error('boom');
      },
    });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/dispatch_error/);
  });

  it('becomes unavailable on a dispatch timeout', async () => {
    const executor = createRealCreativeAuthoringExecutor({
      dispatch: () => new Promise(() => {}),
      timeoutMs: 5,
    });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toBe('timeout');
  });

  it('writes a request + trace audit trail when dispatchDir is given', async () => {
    dispatchDir = mkdtempSync(join(tmpdir(), 'creative-authoring-'));
    const executor = createRealCreativeAuthoringExecutor({ dispatch: async () => validHtml(), dispatchDir });
    await executor(REQUEST);
    const files = readdirSync(dispatchDir);
    expect(files.some((f) => f.endsWith('.authoring-request.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('.authoring-trace.json'))).toBe(true);
    const traceFile = files.find((f) => f.endsWith('.authoring-trace.json'))!;
    const trace = JSON.parse(readFileSync(join(dispatchDir, traceFile), 'utf8'));
    expect(trace.executor).toBe(CREATIVE_AUTHORING_LLM_EXECUTOR);
    expect(trace.outcome).toBe('authored');
  });

  it('a structurally invalid authored response becomes unavailable, never a silent fallback', async () => {
    const executor = createRealCreativeAuthoringExecutor({ dispatch: async () => '<div>no root id</div>' });
    const outcome = await executor(REQUEST);
    expect(outcome.outcome).toBe('unavailable');
    if (outcome.outcome === 'unavailable') expect(outcome.reason).toMatch(/root/);
  });
});
