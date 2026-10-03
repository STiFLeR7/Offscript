import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CreativeArtifactValidator } from 'creative-artifact-contract/src/artifact/validate.js';
import { computeContentDigest } from 'creative-artifact-contract/src/artifact/digest.js';
import { isPortableLocation } from 'creative-artifact-contract/src/artifact/location.js';
import { componentsForFeature } from '../src/feature-mapping.js';
import { selectCamera, type Camera } from '../src/camera-selection.js';
import { getCompositionCameraBias } from '../src/composition-camera-bias.js';
import { resolveEnvironmentAsset } from '../src/environment-library.js';
import type { RoleAssignment } from '../src/role-assignment.js';
import {
  renderCreativeVisual,
  produceCreativeArtifact,
  approveArtifact,
  componentRenderKind,
  dimensionsForRatio,
  FEATURE_MAPPING_VERSION,
  CAMERA_SELECTION_VERSION,
  COMPOSITION_CAMERA_BIAS_VERSION,
  type CreativeIntentInput,
} from '../src/producer.js';

// Extracts the <svg ...>...</svg> the outer <img> wraps, decoding the base64 data: URI, so tests
// can assert on real rendered structure rather than only on debug data-* attributes (Phase 14).
function decodeSvg(html: string): string {
  const match = html.match(/<img[^>]*\bsrc="data:image\/svg\+xml;base64,([^"]+)"/);
  if (!match) throw new Error('no embedded svg image found in html');
  return Buffer.from(match[1], 'base64').toString('utf8');
}

const INTENT: CreativeIntentInput = {
  id: 'exception-triage-queue',
  digest: 'sha256:' + 'a'.repeat(64),
  belief: 'exceptions surface themselves before a human has to go looking',
  feature: 'ai-intelligence',
  ratio: '16:9',
  camera: 'workflow',
  mustInclude: ['the triage queue as the hero element'],
  contentProvenance: 'human',
  section: 'feature',
};

// ── dimensionsForRatio — the single authoritative ratio->pixel source (Target Ratio / Canvas
// Geometry sprint): the same table `renderCreativeVisual` has always used, now exported so the
// Creative Authoring Layer can reuse it rather than inventing a second ratio vocabulary. ──────────
describe('dimensionsForRatio', () => {
  it('resolves the real supported ratios to their real pixel dimensions', () => {
    expect(dimensionsForRatio('16:9')).toEqual([640, 360]);
    expect(dimensionsForRatio('4:3')).toEqual([480, 360]);
    expect(dimensionsForRatio('3:4')).toEqual([360, 480]);
    expect(dimensionsForRatio('1:1')).toEqual([480, 480]);
  });

  it('falls back to the same engineering default renderCreativeVisual has always used for an unrecognized ratio', () => {
    expect(dimensionsForRatio('21:9')).toEqual([480, 360]);
  });
});

describe('renderCreativeVisual', () => {
  it('is deterministic — same intent produces byte-identical output', () => {
    expect(renderCreativeVisual(INTENT)).toBe(renderCreativeVisual(INTENT));
  });

  it('produces different output for a different intent', () => {
    const other: CreativeIntentInput = { ...INTENT, id: 'other', feature: 'security', belief: 'a different belief' };
    expect(renderCreativeVisual(INTENT)).not.toBe(renderCreativeVisual(other));
  });

  it('embeds an extractable data: URI on an <img src>', () => {
    const html = renderCreativeVisual(INTENT);
    expect(html).toMatch(/<img[^>]*\bsrc="data:[^"]+"/);
  });

  it('is self-contained HTML — no external src/href reference', () => {
    const html = renderCreativeVisual(INTENT);
    expect(html).not.toMatch(/\bsrc="https?:/);
    expect(html).not.toMatch(/\bhref="https?:/);
  });

  it('Sprint 10A — reflects the Feature Mapping component list for the intent\'s feature', () => {
    const html = renderCreativeVisual(INTENT);
    const expected = componentsForFeature(INTENT.feature);
    expect(expected.length).toBeGreaterThan(0);
    for (const component of expected) {
      expect(html).toContain(component);
    }
  });

  it('Sprint 10A — reflects a different feature\'s different component list', () => {
    const other: CreativeIntentInput = { ...INTENT, feature: 'security' };
    const html = renderCreativeVisual(other);
    for (const component of componentsForFeature('security')) {
      expect(html).toContain(component);
    }
    // security's components must not be present when rendering the original ai-intelligence intent
    const originalHtml = renderCreativeVisual(INTENT);
    expect(originalHtml).not.toContain('audit logs');
  });

  it('Sprint 10B — exposes the Camera Selection decision trace transparently in the HTML', () => {
    const html = renderCreativeVisual(INTENT);
    const selection = selectCamera(INTENT);
    expect(html).toContain(`data-camera-declared="${selection.declared}"`);
    expect(html).toContain(`data-camera-section-bias="${selection.sectionBias.join(' | ')}"`);
    expect(html).toContain(`data-camera-bias-match="${selection.matchesSectionBias}"`);
  });

  it('Sprint 10B — a different section produces a different section-bias trace', () => {
    const other: CreativeIntentInput = { ...INTENT, section: 'cta' };
    const html = renderCreativeVisual(other);
    expect(html).toContain('data-camera-section-bias="macro"');
  });

  it('Sprint 10D — exposes the camera -> density/breathing starting-bias trace transparently in the HTML', () => {
    const html = renderCreativeVisual(INTENT);
    const bias = getCompositionCameraBias(INTENT.camera);
    expect(bias).toBeDefined();
    expect(html).toContain(`data-composition-camera-density-bias="${bias!.density}"`);
    expect(html).toContain(`data-composition-camera-breathing-bias="${bias!.breathing}"`);
  });

  it('Sprint 10D — a different camera produces a different starting-bias trace', () => {
    const other: CreativeIntentInput = { ...INTENT, camera: 'macro' };
    const html = renderCreativeVisual(other);
    expect(html).toContain('data-composition-camera-density-bias="minimal"');
    expect(html).toContain('data-composition-camera-breathing-bias="generous"');
  });

  it('Sprint 10D — the bias trace never alters the Camera Selection trace', () => {
    const html = renderCreativeVisual(INTENT);
    const selection = selectCamera(INTENT);
    expect(html).toContain(`data-camera-declared="${selection.declared}"`);
    expect(selection.declared).toBe('workflow');
  });
});

describe('produceCreativeArtifact', () => {
  it('copies intent.digest verbatim into artifact.intentDigest', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.intentDigest).toBe(INTENT.digest);
  });

  it('computes artifactDigest as the real sha256 content digest of the rendered html', () => {
    const { artifact, html } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.artifactDigest).toBe(computeContentDigest(html));
  });

  it('produces a portable, project-relative location', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(isPortableLocation(artifact.location)).toBe(true);
    expect(artifact.location).toBe('projects/unit-test-client/creative-assets/exception-triage-queue/visual.html');
  });

  it('defaults approval to pending — never fabricates approval for a freshly rendered visual', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.approval).toEqual({ status: 'pending', source: 'creative-generation' });
  });

  it('names creative-generation as the generation.sourceSystem', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.generation.sourceSystem).toBe('creative-generation');
  });

  it('Sprint 10A — stamps generation.methodologyVersion identifying the Feature Mapping port', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.generation.methodologyVersion).toBe(FEATURE_MAPPING_VERSION);
    expect(FEATURE_MAPPING_VERSION).toBe('feature-mapping-v1');
  });

  it('Sprint 10B — does NOT replace Feature Mapping\'s methodologyVersion', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.generation.methodologyVersion).toBe('feature-mapping-v1');
  });

  it('Sprint 10B — records Camera Selection\'s version in provenance, the single-string methodologyVersion field cannot honestly carry two independent methodology versions', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    // Narrowed to this sprint's own key (rather than exact-equality on the whole bag) since
    // Sprint 10D legitimately adds a second provenance key — see the Sprint 10D test below for
    // the current full shape.
    expect(artifact.provenance?.cameraSelectionMethodologyVersion).toBe(CAMERA_SELECTION_VERSION);
    expect(CAMERA_SELECTION_VERSION).toBe('camera-selection-v1');
  });

  it('Sprint 10B — produces a record that still passes the real CreativeArtifactValidator with provenance set', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    const result = new CreativeArtifactValidator().validate(artifact);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('Sprint 10D — does NOT replace Feature Mapping\'s methodologyVersion or Camera Selection\'s provenance key', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.generation.methodologyVersion).toBe('feature-mapping-v1');
    expect(artifact.provenance?.cameraSelectionMethodologyVersion).toBe(CAMERA_SELECTION_VERSION);
  });

  it('Sprint 10D — records the composition-camera-bias version in provenance, alongside Camera Selection\'s', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    expect(artifact.provenance).toEqual({
      cameraSelectionMethodologyVersion: CAMERA_SELECTION_VERSION,
      compositionCameraBiasMethodologyVersion: COMPOSITION_CAMERA_BIAS_VERSION,
    });
    expect(COMPOSITION_CAMERA_BIAS_VERSION).toBe('composition-camera-bias-v1');
  });

  it('Sprint 10D — produces a record that still passes the real CreativeArtifactValidator with the new provenance key', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    const result = new CreativeArtifactValidator().validate(artifact);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('produces a record that passes the real CreativeArtifactValidator', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    const result = new CreativeArtifactValidator().validate(artifact);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('produceCreativeArtifact — multiple artifacts per intent', () => {
  it('supports a distinct artifactId so two artifacts can share one intentDigest', () => {
    const first = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    const second = produceCreativeArtifact(INTENT, { client: 'unit-test-client', artifactId: `${INTENT.id}-alt` });
    expect(first.artifact.intentDigest).toBe(second.artifact.intentDigest);
    expect(first.artifact.id).not.toBe(second.artifact.id);
    expect(second.artifact.id).toBe('exception-triage-queue-alt');
  });
});

describe('approveArtifact', () => {
  it('returns a NEW record with approval flipped to approved', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    const approved = approveArtifact(artifact, 'design-review', 'reviewed 2026-08-12');
    expect(approved.approval).toEqual({
      status: 'approved',
      source: 'design-review',
      evidence: 'reviewed 2026-08-12',
    });
  });

  it('never mutates the input artifact', () => {
    const { artifact } = produceCreativeArtifact(INTENT, { client: 'unit-test-client' });
    approveArtifact(artifact, 'design-review');
    expect(artifact.approval.status).toBe('pending');
  });
});

// ─── Sprint 10AI — real renderer (replaces the deterministic-placeholder SVG rectangle) ───

const ENV_INTENT: CreativeIntentInput = {
  ...INTENT,
  environment: 'dawn-haze',
};

const ROLES: RoleAssignment = {
  hero: 'insight card',
  support: ['recommendation panel', 'suggested actions'],
  signal: ['confidence score'],
  subordinateContext: ['AI summary'],
  unassigned: [],
};

const ROLED_INTENT: CreativeIntentInput = {
  ...INTENT,
  roles: ROLES,
};

describe('renderCreativeVisual — real renderer (Sprint 10AI)', () => {
  it('1. real output is not the old placeholder rectangle — more than one shape is rendered', () => {
    const svg = decodeSvg(renderCreativeVisual(INTENT));
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    // old placeholder was exactly one <rect> (the background) plus text lines; the real renderer
    // draws a panel rect plus one shape per component plus per-kind glyph shapes.
    expect(rectCount).toBeGreaterThan(componentsForFeature(INTENT.feature).length);
  });

  it('2. environment image is present when intent.environment is set — a real <image> with real jpg bytes', () => {
    const svg = decodeSvg(renderCreativeVisual(ENV_INTENT));
    const match = svg.match(/<image[^>]*href="data:image\/jpeg;base64,([^"]+)"/);
    expect(match).not.toBeNull();
    const embedded = Buffer.from(match![1], 'base64');
    const real = readFileSync(resolveEnvironmentAsset('dawn-haze')!);
    expect(embedded.equals(real)).toBe(true);
  });

  it('2b. no environment image is embedded when intent.environment is absent', () => {
    const svg = decodeSvg(renderCreativeVisual(INTENT));
    expect(svg).not.toMatch(/<image/);
    expect(svg).toContain('data-environment-slug="none"');
  });

  it('3. every feature component appears as its own rendered element, not only as text', () => {
    const svg = decodeSvg(renderCreativeVisual(INTENT));
    for (const component of componentsForFeature(INTENT.feature)) {
      expect(svg).toContain(`data-component="${component}"`);
    }
  });

  it('4. roles affect layout hierarchy — hero renders larger than an unassigned/fallback component', () => {
    const svg = decodeSvg(renderCreativeVisual(ROLED_INTENT));
    const heroMatch = svg.match(/<g[^>]*data-component="insight card"[^>]*data-role="hero"[\s\S]*?<rect[^>]*? width="([\d.]+)"/);
    const signalMatch = svg.match(/<g[^>]*data-component="confidence score"[^>]*data-role="signal"[\s\S]*?<rect[^>]*? width="([\d.]+)"/);
    expect(heroMatch).not.toBeNull();
    expect(signalMatch).not.toBeNull();
    expect(Number(heroMatch![1])).toBeGreaterThan(Number(signalMatch![1]));
  });

  it('4b. a component without a role (no roles given at all) renders with the documented fallback treatment', () => {
    const svg = decodeSvg(renderCreativeVisual(INTENT));
    for (const component of componentsForFeature(INTENT.feature)) {
      expect(svg).toContain(`data-component="${component}" data-role="fallback"`);
    }
    expect(svg).toContain('data-role-source="fallback"');
  });

  it('5. camera affects framing — the composition panel size differs between establishing and macro', () => {
    const establishing: CreativeIntentInput = { ...INTENT, camera: 'establishing', section: undefined };
    const macro: CreativeIntentInput = { ...INTENT, camera: 'macro', section: undefined };
    const svgEstablishing = decodeSvg(renderCreativeVisual(establishing));
    const svgMacro = decodeSvg(renderCreativeVisual(macro));
    const wEstablishing = Number(svgEstablishing.match(/class="cr-composition-panel"[^>]*? width="([\d.]+)"/)![1]);
    const wMacro = Number(svgMacro.match(/class="cr-composition-panel"[^>]*? width="([\d.]+)"/)![1]);
    // establishing = high environment visibility = smaller panel; macro = minimum surface = larger panel.
    expect(wMacro).toBeGreaterThan(wEstablishing);
  });

  it('8. all five supported cameras render without error, each with a distinct panel size', () => {
    const cameras: Camera[] = ['establishing', 'product', 'workflow', 'component', 'macro'];
    const widths = cameras.map((camera) => {
      const svg = decodeSvg(renderCreativeVisual({ ...INTENT, camera, section: undefined }));
      return Number(svg.match(/class="cr-composition-panel"[^>]*? width="([\d.]+)"/)![1]);
    });
    expect(new Set(widths).size).toBe(cameras.length);
  });

  it('6. density affects layout — moderate–populated (product) packs components into more columns/rows than minimal (macro)', () => {
    const macro: CreativeIntentInput = { ...INTENT, camera: 'macro', section: undefined };
    const product: CreativeIntentInput = { ...INTENT, camera: 'product', section: undefined };
    const svgMacro = decodeSvg(renderCreativeVisual(macro));
    const svgProduct = decodeSvg(renderCreativeVisual(product));
    const macroWidths = [...svgMacro.matchAll(/class="cr-component"[\s\S]*?<rect[^>]*? width="([\d.]+)"/g)].map((m) => Number(m[1]));
    const productWidths = [...svgProduct.matchAll(/class="cr-component"[\s\S]*?<rect[^>]*? width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(macroWidths.length).toBeGreaterThan(0);
    expect(productWidths.length).toBeGreaterThan(0);
    expect(Math.max(...macroWidths)).not.toBe(Math.max(...productWidths));
  });

  it('7. breathing affects spacing — generous (establishing) leaves a larger gap between component blocks than standard (workflow)', () => {
    const establishing: CreativeIntentInput = { ...INTENT, camera: 'establishing', section: undefined };
    const workflowCam: CreativeIntentInput = { ...INTENT, camera: 'workflow', section: undefined };
    const svgEstablishing = decodeSvg(renderCreativeVisual(establishing));
    const svgWorkflow = decodeSvg(renderCreativeVisual(workflowCam));
    const gapEstablishing = Number(svgEstablishing.match(/data-breathing-gap="([\d.]+)"/)![1]);
    const gapWorkflow = Number(svgWorkflow.match(/data-breathing-gap="([\d.]+)"/)![1]);
    expect(gapEstablishing).toBeGreaterThan(gapWorkflow);
  });

  it('9. all five real Role Assignment buckets render distinctly (hero/support/signal/subordinateContext/unassigned)', () => {
    const full: RoleAssignment = {
      hero: 'workflow builder',
      support: ['execution status'],
      signal: ['automation timeline'],
      subordinateContext: ['success notification'],
      unassigned: [],
    };
    const svg = decodeSvg(renderCreativeVisual({ ...INTENT, feature: 'automation', roles: full }));
    for (const [component, role] of [
      ['workflow builder', 'hero'],
      ['execution status', 'support'],
      ['automation timeline', 'signal'],
      ['success notification', 'subordinateContext'],
    ] as const) {
      expect(svg).toContain(`data-component="${component}" data-role="${role}"`);
    }
  });

  it('9b. an honest unassigned component renders with a distinct, documented dashed treatment', () => {
    const withUnassigned: RoleAssignment = {
      hero: 'workflow builder',
      support: [],
      signal: [],
      subordinateContext: [],
      unassigned: ['execution status', 'automation timeline', 'success notification'],
    };
    const svg = decodeSvg(renderCreativeVisual({ ...INTENT, feature: 'automation', roles: withUnassigned }));
    const match = svg.match(/<g[^>]*data-component="execution status"[^>]*data-role="unassigned"[\s\S]*?<rect[^>]*stroke-dasharray="([^"]+)"/);
    expect(match).not.toBeNull();
  });

  it('10. environment slug resolves to the correct real asset for every governed value', () => {
    const svg = decodeSvg(renderCreativeVisual({ ...INTENT, environment: 'massif-clear' }));
    const match = svg.match(/<image[^>]*href="data:image\/jpeg;base64,([^"]+)"/);
    const embedded = Buffer.from(match![1], 'base64');
    const real = readFileSync(resolveEnvironmentAsset('massif-clear')!);
    expect(embedded.equals(real)).toBe(true);
    expect(svg).toContain('data-environment-slug="massif-clear"');
  });

  it('11. an invalid environment fails closed', () => {
    const bad = { ...INTENT, environment: 'not-a-real-slug' } as unknown as CreativeIntentInput;
    expect(() => renderCreativeVisual(bad)).toThrow(/environment/i);
  });

  it('12. an unsupported/invented component fails closed via componentRenderKind', () => {
    expect(() => componentRenderKind('a component nobody documented')).toThrow(/component/i);
  });

  it('12b. every real Feature Mapping component across all seven features has a documented render kind', () => {
    const features = ['automation', 'search', 'analytics', 'security', 'collaboration', 'ai-intelligence', 'configuration'];
    for (const feature of features) {
      for (const component of componentsForFeature(feature)) {
        expect(() => componentRenderKind(component)).not.toThrow();
      }
    }
  });

  it('13. artifactDigest remains deterministic — computed over the real rendered content', () => {
    const { artifact, html } = produceCreativeArtifact(ENV_INTENT, { client: 'unit-test-client' });
    expect(artifact.artifactDigest).toBe(computeContentDigest(html));
  });

  it('14. byte-identical inputs produce byte-identical output, including environment and roles', () => {
    expect(renderCreativeVisual(ENV_INTENT)).toBe(renderCreativeVisual(ENV_INTENT));
    expect(renderCreativeVisual(ROLED_INTENT)).toBe(renderCreativeVisual(ROLED_INTENT));
  });

  it('15. approval remains pending on the real-rendered artifact', () => {
    const { artifact } = produceCreativeArtifact(ENV_INTENT, { client: 'unit-test-client' });
    expect(artifact.approval).toEqual({ status: 'pending', source: 'creative-generation' });
  });

  it('16. provenance is preserved unchanged by the renderer replacement', () => {
    const { artifact } = produceCreativeArtifact(ENV_INTENT, { client: 'unit-test-client' });
    expect(artifact.provenance).toEqual({
      cameraSelectionMethodologyVersion: CAMERA_SELECTION_VERSION,
      compositionCameraBiasMethodologyVersion: COMPOSITION_CAMERA_BIAS_VERSION,
    });
    expect(artifact.generation.methodologyVersion).toBe(FEATURE_MAPPING_VERSION);
  });

  it('17/18. no external repository paths or absolute machine paths appear in the renderer source', () => {
    const src = readFileSync(new URL('../src/producer.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/Offscript-creatives-generation/i);
    expect(src).not.toMatch(/Backups-Stacks/i);
    expect(src).not.toMatch(/(?<![A-Za-z])[A-Z]:[\\/]/);
  });

  it('19. no Website Generation dependency in the renderer source', () => {
    const src = readFileSync(new URL('../src/producer.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/offscript\/src\/generate|from '\.\.\/\.\.\/src/);
  });

  it('20. no placeholder-only SVG remains — the rendered svg has real internal structure beyond one rect and text lines', () => {
    const svg = decodeSvg(renderCreativeVisual(ENV_INTENT));
    expect(svg).toContain('class="cr-composition-panel"');
    expect(svg).toContain('class="cr-component"');
    expect(svg).toMatch(/<image/);
  });

  it('produces a CreativeArtifactValidator-valid record when environment and roles are both set', () => {
    const { artifact } = produceCreativeArtifact({ ...ENV_INTENT, roles: ROLES }, { client: 'unit-test-client' });
    const result = new CreativeArtifactValidator().validate(artifact);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('produceCreativeArtifact — integrity (Phase 16)', () => {
  it('tampering with the rendered html invalidates the artifact digest, exactly as Sprint 7 designed', () => {
    const { artifact, html } = produceCreativeArtifact(ENV_INTENT, { client: 'unit-test-client' });
    const tampered = html.replace('<html>', '<html data-tampered="true">');
    expect(computeContentDigest(tampered)).not.toBe(artifact.artifactDigest);
  });
});
