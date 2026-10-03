/**
 * Sprint 10D — Camera -> Density/Breathing Starting Bias. Consults
 * COMPOSITION-CAMERA-BIAS.md's five-row table (HANDOFF-v2.md: "Camera sets the starting
 * density/breathing, then intent may adjust one step") — the one deterministic,
 * table-driven slice of Composition Intelligence identified as PORT-NOW by the
 * Composition Intelligence Readiness assessment (§9, §11, §12).
 *
 * This is a STARTING BIAS only. It deliberately does NOT decide a final density or
 * breathing-room value — that "one step" adjustment is belief-semantic judgment, out of
 * scope. See the document's own "Deferred" section.
 */
import { loadCreativeReference } from './references.js';

export type Camera = 'establishing' | 'product' | 'workflow' | 'component' | 'macro';

const CAMERAS: readonly Camera[] = ['establishing', 'product', 'workflow', 'component', 'macro'];

function isCamera(value: string): value is Camera {
  return (CAMERAS as readonly string[]).includes(value);
}

const BIAS_ROW_RE = /^\|\s*`([a-z]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/gm;

export interface CompositionCameraBias {
  /** The starting density band (or a documented compound range, e.g. "minimal–moderate"). */
  density: string;
  /** The starting breathing-room band. */
  breathing: string;
}

function parseBiasByCamera(doc: string): Map<Camera, CompositionCameraBias> {
  const byCamera = new Map<Camera, CompositionCameraBias>();
  for (const match of doc.matchAll(BIAS_ROW_RE)) {
    const camera = match[1].trim();
    if (!isCamera(camera)) continue;
    byCamera.set(camera, { density: match[2].trim(), breathing: match[3].trim() });
  }
  return byCamera;
}

/**
 * Returns the documented starting density/breathing bias for `camera`, or undefined for an
 * unrecognized value. Never throws, never invents a value for a camera the document doesn't
 * document.
 */
export function getCompositionCameraBias(camera: string): CompositionCameraBias | undefined {
  if (!isCamera(camera)) return undefined;
  const doc = loadCreativeReference('COMPOSITION-CAMERA-BIAS.md');
  const bias = parseBiasByCamera(doc).get(camera);
  return bias ? Object.freeze({ ...bias }) : undefined;
}
