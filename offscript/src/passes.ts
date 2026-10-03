import type { PassSpec } from './actuation.js';
import type { Finding } from './operator.js';
import { contrast } from './operators/contrast.js';
import { brandFidelityScan } from './operators/brand-fidelity-scan.js';
import { composeInstruction, type ComposeContext, type ComposePaths } from './instruction.js';

/**
 * Declarative pass metadata. The dispatch wiring (harden.ts) composes the
 * runtime instruction via `composeInstruction(pass, ctx, paths)` with real
 * findings / paths / brand contract at gate-loop time.
 *
 * `instruction` is also baked at module load using placeholder context so
 * downstream callers that still read `pass.instruction` directly (and the
 * existing test suite) keep seeing the rail-finding bounds verbatim. Once
 * dispatch fully migrates to composeInstruction, the baked instruction
 * becomes a fallback for legacy callers.
 */
interface PassMetadata {
  name: string;
  briefHint: string;
  playbookAnchors: string[];
  railBounds: string[];
  rails: PassSpec['rails'];
}

const PLACEHOLDER_PATHS: ComposePaths = {
  reference: '<reference.html>',
  index: '<index.html>',
  tokens: '<tokens.css>',
};

const PLACEHOLDER_FINDINGS: Finding[] = [];

function bake(meta: PassMetadata): PassSpec {
  const ctx: ComposeContext = {
    brand: '<brand>',
    artifactType: '<artifact>',
    findings: PLACEHOLDER_FINDINGS,
    railBounds: meta.railBounds,
  };
  const proto: PassSpec = {
    name: meta.name,
    rails: meta.rails,
    instruction: '', // populated below
    playbookAnchors: meta.playbookAnchors,
  };
  const composed = composeInstruction({ ...proto }, ctx, PLACEHOLDER_PATHS);
  const briefHint = meta.briefHint ? `\n\n${meta.briefHint}` : '';
  proto.instruction = composed + briefHint;
  return proto;
}

/** Judgment pass: resolve every WCAG-AA contrast failure, gated by the `contrast` rail. */
export const contrastPass: PassSpec = bake({
  name: 'contrast',
  briefHint:
    'For each reported colour pair that fails WCAG-AA contrast, pick the nearest on-brand colour (or surface) that clears the ratio without shifting the look.',
  playbookAnchors: ['§4.1', '§4.7', '§6.1'],
  railBounds: ['color-expansion', 'theme-orchestration'],
  rails: [contrast],
});

/** Judgment pass: rewrite off-token colours to brand tokens, gated by the `brand-fidelity-scan` rail. */
export const brandFidelityPass: PassSpec = bake({
  name: 'brand-fidelity',
  briefHint:
    'For each off-token colour, replace it with the closest brand token var() so every colour is traceable to the brand kit.',
  playbookAnchors: ['§1.1', '§4.6', '§6.6'],
  railBounds: ['theme-orchestration', 'anti-slop-checklist'],
  rails: [brandFidelityScan],
});

/** The judgment passes in run order: contrast first, then brand-fidelity (vision §4.1). */
export const judgmentPasses: PassSpec[] = [contrastPass, brandFidelityPass];
