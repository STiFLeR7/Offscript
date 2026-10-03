/**
 * G1-S3 — Project Readiness Store: persistence of the evaluated ProjectReadiness as a durable project
 * artifact.
 *
 * G1-S2 established that the generation CLI cannot construct a GenerationContract because it has no
 * ProjectReadiness — that readiness is evaluated upstream (P51 strategy → P53 workflow → P54 evaluate)
 * and then discarded (`evaluateReadinessFor` builds a ProjectReadiness in-memory and returns only the
 * assessment). This module makes the ProjectReadiness a durable artifact at
 * `projects/<client>/readiness.json`, so generation can CONSUME persisted readiness rather than
 * reconstruct it.
 *
 * Readiness is an EVALUATED artifact, not runtime state: it is a FROZEN snapshot of the inputs it was
 * evaluated over (workflow + strategy + a context snapshot at a version), written once and never
 * appended. This is deliberately distinct from P52's LIVING context log (`context.json`, append-only,
 * reconstruct-on-read): the snapshot must not drift when the living context advances, so it embeds the
 * context version it saw and reloads byte-identically regardless. It reuses P52's persistence discipline
 * — a `Stored*` wrapper with a `schemaVersion`, deterministic serialization, a fixed path under
 * `projectDir` — and never leaks into generation itself (Project-Platform state only).
 *
 * Serialization is deterministic (canonically sorted keys), so the artifact is stable, diffable, and
 * replayable. ProjectReadiness is a composite of three sub-artifacts (P52 context / P53 workflow / P51
 * strategy), all pure JSON — a recursive canonical sort avoids re-implementing each sub-module's own key
 * order while guaranteeing the same-input-same-bytes property.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { projectDir } from '../paths.js';
import { join } from 'node:path';
import type { ProjectReadiness } from './readiness.js';

/** Path to a project's persisted, frozen readiness artifact — a sibling of P52's context.json. */
export function projectReadinessPath(client: string): string {
  return join(projectDir(client), 'readiness.json');
}

interface StoredReadiness {
  readonly schemaVersion: 1;
  readonly readiness: ProjectReadiness;
}

/** Recursively sort object keys (arrays keep their order, undefined dropped) for a stable serialization. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonicalize(v);
    }
    return out;
  }
  return value;
}

/** Deterministic serialization (canonical key order, 2-space indent, trailing newline). */
export function serializeProjectReadiness(readiness: ProjectReadiness): string {
  const stored: StoredReadiness = { schemaVersion: 1, readiness };
  return JSON.stringify(canonicalize(stored), null, 2) + '\n';
}

export function deserializeProjectReadiness(text: string): ProjectReadiness {
  const obj = JSON.parse(text) as StoredReadiness;
  if (obj.schemaVersion !== 1) throw new Error(`project readiness: unsupported schemaVersion ${String(obj.schemaVersion)}.`);
  return obj.readiness;
}

/** Persist the evaluated ProjectReadiness ONCE as a durable artifact (overwrites on re-evaluation). */
export function writeProjectReadiness(client: string, readiness: ProjectReadiness): void {
  writeFileSync(projectReadinessPath(client), serializeProjectReadiness(readiness), 'utf8');
}

/** Reload the persisted ProjectReadiness; null when absent (never evaluated / persisted). */
export function readProjectReadiness(client: string): ProjectReadiness | null {
  const p = projectReadinessPath(client);
  if (!existsSync(p)) return null;
  return deserializeProjectReadiness(readFileSync(p, 'utf8'));
}
