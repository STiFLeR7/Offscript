/**
 * Sprint 10B — Camera Selection. Consults CAMERA-SELECTION.md's section-aware starting
 * bias (HANDOFF-v2.md §B-9) — the one deterministic, table-driven sub-component of the
 * source's "closest camera that proves the claim" rule. What this deliberately does NOT
 * do: judge whether a camera actually proves a given belief — that is belief-semantic
 * judgment (Visual Proof Validation), out of scope for this sprint. See the document's
 * own "Limitations" section.
 */
import { loadCreativeReference } from './references.js';

export type Camera = 'establishing' | 'product' | 'workflow' | 'component' | 'macro';

const CAMERAS: readonly Camera[] = ['establishing', 'product', 'workflow', 'component', 'macro'];

function isCamera(value: string): value is Camera {
  return (CAMERAS as readonly string[]).includes(value);
}

const BIAS_ROW_RE = /^\|\s*`([a-z]+)`\s*\|[^|]*\|\s*([^|]+?)\s*\|\s*$/gm;

function parseBiasBySection(doc: string): Map<string, Camera[]> {
  const bySection = new Map<string, Camera[]>();
  for (const match of doc.matchAll(BIAS_ROW_RE)) {
    const section = match[1].trim();
    const cameras = match[2]
      .split(',')
      .map((cell) => cell.trim().replace(/`/g, ''))
      .filter(isCamera);
    if (cameras.length > 0) bySection.set(section, cameras);
  }
  return bySection;
}

function sectionBiasFor(section: string | undefined): Camera[] {
  if (!section) return [];
  const doc = loadCreativeReference('CAMERA-SELECTION.md');
  return parseBiasBySection(doc).get(section) ?? [];
}

export interface CameraSelection {
  /** intent.camera, when it is one of the five documented values; undefined otherwise. */
  declared: Camera | undefined;
  /** The section-aware starting bias (0, 1, or 2 documented cameras) for intent.section. */
  sectionBias: readonly Camera[];
  /** declared, honored as-is; falls back to the first bias camera only when declared is unusable. */
  selected: Camera | undefined;
  /** Whether declared appears in sectionBias; undefined when either side is unavailable (nothing to compare). */
  matchesSectionBias: boolean | undefined;
}

/**
 * Consults the ported Camera Selection methodology for one CreativeIntent. Never throws;
 * an unrecognized camera or section resolves to an empty/undefined result rather than a guess.
 */
export function selectCamera(intent: { camera: string; section?: string }): CameraSelection {
  const declared = isCamera(intent.camera) ? intent.camera : undefined;
  const sectionBias = Object.freeze(sectionBiasFor(intent.section));
  const selected = declared ?? sectionBias[0];
  const matchesSectionBias =
    declared === undefined || sectionBias.length === 0 ? undefined : sectionBias.includes(declared);
  return { declared, sectionBias, selected, matchesSectionBias };
}
