/**
 * P49 — Capability discovery. Turns a project-type definition + what is already available into a
 * concrete acquisition picture: which artifacts are required/optional, which deliverables and
 * brief sources are supported, what is already present, and what is still MISSING. The missing
 * required set is precisely the interview's questions — so interviews are driven from capability
 * DEFINITIONS, never hardcoded flows. A Content-Core packet is treated as supplying every required
 * artifact, so no interview is needed when one is present.
 */
import { getProjectType } from './project-registry.js';
import type { Track } from '../paths.js';

export interface DiscoverInput {
  readonly projectType: string;
  /** Canonical-brief artifact keys already available (from the workspace or a prior source). */
  readonly available?: readonly string[];
  /** When present, a Content-Core packet supplies the whole brief ⇒ no interview. */
  readonly packetPath?: string;
}

export interface CapabilityReport {
  readonly projectType: string;
  readonly deliverables: Track[];
  readonly required: string[];
  readonly optional: string[];
  readonly briefSources: string[];
  /** Required artifacts already satisfied. */
  readonly present: string[];
  /** Required artifacts still needed — the interview's questions. */
  readonly missing: string[];
  /** The source the Creative Director will use given the current inputs. */
  readonly selectedSource: string;
  /** True when nothing more is needed to produce the Canonical Brief. */
  readonly ready: boolean;
}

/** Compute the capability picture for a project given available inputs. */
export function discoverCapabilities(input: DiscoverInput): CapabilityReport {
  const type = getProjectType(input.projectType); // fail-loud on unknown type
  const required = [...type.requiredArtifacts];
  const hasPacket = !!input.packetPath;
  const selectedSource = hasPacket ? 'content-core' : 'manual';

  // A packet supplies the whole brief; otherwise only explicitly-available artifacts count.
  const availableSet = new Set(hasPacket ? required : input.available ?? []);
  const present = required.filter((a) => availableSet.has(a));
  const missing = required.filter((a) => !availableSet.has(a));

  return {
    projectType: type.id,
    deliverables: [...type.deliverables],
    required,
    optional: [...type.optionalArtifacts],
    briefSources: [...type.briefSources],
    present,
    missing,
    selectedSource,
    ready: missing.length === 0,
  };
}
