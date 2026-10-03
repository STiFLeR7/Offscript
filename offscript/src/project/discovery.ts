/**
 * P50 — Context Discovery: the provider abstraction, registry, and runner.
 *
 * A DiscoveryProvider inspects ONE context source (a workspace artifact, a brand kit, a prior
 * output, …) and emits attributable Evidence. Providers register into an extensible registry, so
 * adding a source is a new provider — never an orchestration edit (the extensibility contract).
 * The runner sweeps providers and ISOLATES failures: a broken provider can't blind the rest.
 *
 * Discovery reads only local artifacts and is therefore SYNCHRONOUS and deterministic — which keeps
 * the Creative Director's `plan()` synchronous (the async work is the brief SOURCE, downstream).
 */
import type { Track } from '../paths.js';
import type { ProjectType } from './project-registry.js';
import type { Evidence } from './evidence.js';

/** What a provider is given to inspect a project's context. */
export interface DiscoveryContext {
  readonly client: string;
  readonly projectType: ProjectType;
  readonly track: Track;
  /** Present when a Content-Core packet was supplied. */
  readonly packetPath?: string;
  /** Injected ISO observation timestamp stamped onto emitted evidence (deterministic). */
  readonly now: string;
}

export interface DiscoveryProvider {
  readonly id: string;
  readonly label: string;
  /** Inspect one source and emit evidence (sync; local reads only). */
  discover(ctx: DiscoveryContext): Evidence[];
}

let registry: DiscoveryProvider[] = [];

/** Register a discovery provider (extensibility — a new source needs no orchestration change). */
export function registerDiscoveryProvider(p: DiscoveryProvider): void {
  if (registry.some((r) => r.id === p.id)) throw new Error(`discovery provider "${p.id}" is already registered.`);
  registry.push(p);
}

export function listDiscoveryProviders(): DiscoveryProvider[] {
  return [...registry];
}

/** Test-only / re-init hook: clear the registry. */
export function _resetDiscoveryProviders(): void {
  registry = [];
}

/**
 * Run providers (the registry by default) and collect all evidence, in provider order. A provider
 * that throws is isolated and skipped — discovery must degrade, never fail the whole sweep.
 */
export function discoverContext(ctx: DiscoveryContext, providers: readonly DiscoveryProvider[] = registry): Evidence[] {
  const out: Evidence[] = [];
  for (const p of providers) {
    try {
      out.push(...p.discover(ctx));
    } catch (err) {
      console.warn(`[discovery] provider "${p.id}" failed and was skipped: ${(err as Error).message}`);
    }
  }
  return out;
}
