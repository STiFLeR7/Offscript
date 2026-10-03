/**
 * PKG — Repository Builder: the governed vocabulary (ES-1 §4 / Phase 4).
 *
 * Closed term-sets (kinds, scope classes, authorities, fallback classes, statuses,
 * relation kinds) live in `model.ts` as the permanent, code-level vocabulary.
 * This module holds the GOVERNED-EXTENSIBLE namespaces — concepts, capabilities,
 * obligations, owners, scope identities — plus the frozen guarantee reference set.
 * These are data, loaded by the source layer (or injected for tests); the Builder
 * never authors them.
 */
import { digest } from './digest.js';

export interface GovernedVocabulary {
  readonly concepts: ReadonlySet<string>;
  readonly capabilities: ReadonlySet<string>;
  readonly obligations: ReadonlySet<string>;
  readonly owners: ReadonlySet<string>;
  readonly scopeIdentities: ReadonlySet<string>;
  /** Frozen ADR/ES guarantee namespace (targets of realizes/verifies). */
  readonly guarantees: ReadonlySet<string>;
}

export interface VocabularyParts {
  readonly concepts?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly obligations?: readonly string[];
  readonly owners?: readonly string[];
  readonly scopeIdentities?: readonly string[];
  readonly guarantees?: readonly string[];
}

function nfcSet(xs: readonly string[] | undefined): ReadonlySet<string> {
  return new Set((xs ?? []).map((x) => x.normalize('NFC')));
}

export function makeVocabulary(parts: VocabularyParts): GovernedVocabulary {
  return {
    concepts: nfcSet(parts.concepts),
    capabilities: nfcSet(parts.capabilities),
    obligations: nfcSet(parts.obligations),
    owners: nfcSet(parts.owners),
    scopeIdentities: nfcSet(parts.scopeIdentities),
    guarantees: nfcSet(parts.guarantees),
  };
}

export const EMPTY_VOCABULARY: GovernedVocabulary = makeVocabulary({});

/** Stable digest over the governed vocabulary, for the build identity. */
export function vocabularyDigest(v: GovernedVocabulary): string {
  return digest({
    concepts: [...v.concepts].sort(),
    capabilities: [...v.capabilities].sort(),
    obligations: [...v.obligations].sort(),
    owners: [...v.owners].sort(),
    scope_identities: [...v.scopeIdentities].sort(),
    guarantees: [...v.guarantees].sort(),
  });
}
