/**
 * PKG — Repository Builder: scope-qualified identity (ES-1R §4 `id` grammar).
 *
 *   canonical::<local>                     → global canonical authority
 *   <brand|bundle>:<identity>::<local>     → scope-local
 *
 * Identity is location-independent (Phase 1 §4): the on-disk path never defines
 * it. Reference lawfulness encodes the single sanctioned cross-scope edge —
 * canonical fan-out (#3 / Locality): a reference is lawful iff its target is
 * canonical or lives in the very same scope.
 */
import type { NormalizedAsset, ScopeClass } from './model.js';

export interface ScopeKey {
  readonly cls: ScopeClass;
  /** null for canonical (global authority); the scope identity otherwise. */
  readonly identity: string | null;
}

export interface ParsedId {
  readonly scope: ScopeKey;
  readonly local: string;
  readonly raw: string;
}

const CANONICAL_RE = /^canonical::(.+)$/;
const SCOPED_RE = /^(brand|bundle):([^:]+)::(.+)$/;

/** Parse a scope-qualified id, or return null if malformed. */
export function tryParseId(raw: string): ParsedId | null {
  const canon = CANONICAL_RE.exec(raw);
  if (canon) {
    return { scope: { cls: 'canonical', identity: null }, local: canon[1], raw };
  }
  const scoped = SCOPED_RE.exec(raw);
  if (scoped) {
    return {
      scope: { cls: scoped[1] as ScopeClass, identity: scoped[2] },
      local: scoped[3],
      raw,
    };
  }
  return null;
}

export function scopeKeyOf(asset: NormalizedAsset): ScopeKey {
  return asset.scope.class === 'canonical'
    ? { cls: 'canonical', identity: null }
    : { cls: asset.scope.class, identity: asset.scope.identity };
}

export function scopeKeyEqual(a: ScopeKey, b: ScopeKey): boolean {
  return a.cls === b.cls && a.identity === b.identity;
}

/** A reference is lawful iff the target is canonical or in the source's scope. */
export function referenceLawful(source: ScopeKey, target: ScopeKey): boolean {
  return target.cls === 'canonical' || scopeKeyEqual(source, target);
}

/** Does the scope encoded in the id agree with the asset's `scope` section? */
export function idMatchesScopeSection(parsed: ParsedId, asset: NormalizedAsset): boolean {
  if (parsed.scope.cls !== asset.scope.class) return false;
  if (parsed.scope.cls === 'canonical') return true; // canonical sub-domain is free
  return parsed.scope.identity === asset.scope.identity;
}
