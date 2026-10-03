/**
 * PKG — Repository Builder: model-level validation (ES-1R §7 + ES-2 stages 6-9).
 *
 * Operates ONLY on the normalized model (serialization-independent). Produces
 * deterministic, sorted findings; the Builder aggregates and aborts before
 * publication. Covers: vocabulary membership, identity grammar + id↔scope,
 * the document-local consistency class (F2: scope↔governance, identity↔evolution,
 * lineage↔scope, composition self-reference), and the cross-asset checks
 * (duplicate id, single producer, reference resolution + cross-scope lawfulness,
 * lineage-target-canonical, guarantee resolution).
 */
import type { Finding } from './finding.js';
import type { NormalizedAsset } from './model.js';
import { idMatchesScopeSection, referenceLawful, scopeKeyOf, tryParseId } from './identity.js';
import type { GovernedVocabulary } from './vocabulary.js';

export function validateRepository(
  assets: readonly NormalizedAsset[],
  vocab: GovernedVocabulary,
): Finding[] {
  const findings: Finding[] = [];
  const idMap = new Map<string, NormalizedAsset>();
  const producers = new Map<string, string[]>();

  for (const a of assets) {
    const prior = idMap.get(a.identity.id);
    if (prior) {
      findings.push({
        stage: 'identity',
        code: 'DUP_ID',
        location: a.location,
        message: `duplicate id '${a.identity.id}' (also at ${prior.location})`,
      });
    } else {
      idMap.set(a.identity.id, a);
    }
    for (const concept of a.semantics.produces) {
      let list = producers.get(concept);
      if (!list) {
        list = [];
        producers.set(concept, list);
      }
      list.push(a.identity.id);
    }
  }

  // Single producer (#1 semantic): a concept may be produced by at most one asset.
  for (const [concept, owners] of producers) {
    if (owners.length > 1) {
      findings.push({
        stage: 'semantic',
        code: 'DUP_PRODUCER',
        location: concept,
        message: `concept produced by ${owners.length} assets: ${[...owners].sort().join(', ')}`,
      });
    }
  }

  for (const a of assets) {
    validateVocabulary(a, vocab, findings);
    validateIdentity(a, findings);
    validateConsistency(a, findings);
    validateReferences(a, idMap, vocab, findings);
  }

  findings.sort(
    (x, y) =>
      x.stage.localeCompare(y.stage) ||
      x.code.localeCompare(y.code) ||
      x.location.localeCompare(y.location) ||
      x.message.localeCompare(y.message),
  );
  return findings;
}

function inSet(
  term: string,
  set: ReadonlySet<string>,
  a: NormalizedAsset,
  field: string,
  findings: Finding[],
): void {
  if (!set.has(term)) {
    findings.push({
      stage: 'vocabulary',
      code: 'VOCAB_UNKNOWN',
      location: `${a.location}.${field}`,
      message: `'${term}' is not in the governed vocabulary`,
    });
  }
}

function validateVocabulary(
  a: NormalizedAsset,
  v: GovernedVocabulary,
  findings: Finding[],
): void {
  inSet(a.ownership.owner, v.owners, a, 'ownership.owner', findings);
  inSet(a.scope.identity, v.scopeIdentities, a, 'scope.identity', findings);
  for (const c of a.semantics.produces) inSet(c, v.concepts, a, 'semantics.produces', findings);
  for (const c of a.semantics.consumes) inSet(c, v.concepts, a, 'semantics.consumes', findings);
  for (const c of a.semantics.derivesFrom) inSet(c, v.concepts, a, 'semantics.derives_from', findings);
  for (const c of a.semantics.specializes) inSet(c, v.concepts, a, 'semantics.specializes', findings);
  for (const c of a.capabilities.communicates) inSet(c, v.capabilities, a, 'capabilities.communicates', findings);
  for (const o of a.capabilities.satisfies) inSet(o, v.obligations, a, 'capabilities.satisfies', findings);
}

function validateIdentity(a: NormalizedAsset, findings: Finding[]): void {
  const parsed = tryParseId(a.identity.id);
  if (!parsed) {
    findings.push({
      stage: 'identity',
      code: 'ID_MALFORMED',
      location: a.location,
      message: `malformed id '${a.identity.id}'`,
    });
    return;
  }
  if (!idMatchesScopeSection(parsed, a)) {
    findings.push({
      stage: 'identity',
      code: 'ID_SCOPE_MISMATCH',
      location: a.location,
      message: `id '${a.identity.id}' disagrees with scope ${a.scope.class}:${a.scope.identity}`,
    });
  }
}

function validateConsistency(a: NormalizedAsset, findings: Finding[]): void {
  const isCanonical = a.scope.class === 'canonical';

  // scope ↔ governance
  if (a.governance.authority === 'canonical-global' && !isCanonical) {
    push(findings, 'consistency', 'SCOPE_GOVERNANCE', a.location, 'canonical-global authority on a non-canonical scope');
  }
  if (a.governance.authority === 'adapted-local' && isCanonical) {
    push(findings, 'consistency', 'SCOPE_GOVERNANCE', a.location, 'adapted-local authority on a canonical scope');
  }

  // lineage ↔ scope
  if (a.governance.authority === 'adapted-local' && !a.governance.lineage) {
    push(findings, 'consistency', 'LINEAGE_REQUIRED', a.location, 'adapted-local authority requires governance.lineage');
  }
  if (isCanonical && a.governance.lineage) {
    push(findings, 'consistency', 'LINEAGE_FORBIDDEN', a.location, 'canonical scope must not carry lineage');
  }

  // identity ↔ evolution
  if (a.evolution) {
    const { status, supersededBy } = a.evolution;
    if (status === 'superseded' && (!supersededBy || supersededBy === a.identity.id)) {
      push(findings, 'consistency', 'EVOLUTION_SUPERSEDED_BY', a.location, "status 'superseded' requires a valid, non-self superseded_by");
    }
    if (status === 'active' && supersededBy) {
      push(findings, 'consistency', 'EVOLUTION_ACTIVE', a.location, "status 'active' must not carry superseded_by");
    }
  }

  // composition self-reference (audit clarification: invalid-reference subsumes self)
  for (const t of a.composition.excludes) {
    if (t === a.identity.id) push(findings, 'consistency', 'COMPOSITION_SELF', a.location, 'excludes itself');
  }
  for (const t of a.composition.requiresCompanion) {
    if (t === a.identity.id) push(findings, 'consistency', 'COMPOSITION_SELF', a.location, 'requires itself as companion');
  }
}

function validateReferences(
  a: NormalizedAsset,
  idMap: ReadonlyMap<string, NormalizedAsset>,
  vocab: GovernedVocabulary,
  findings: Finding[],
): void {
  const src = scopeKeyOf(a);

  const resolveLawful = (
    targets: readonly string[],
    field: string,
    stage: string,
  ): void => {
    for (const t of targets) {
      const target = idMap.get(t);
      if (!target) {
        push(findings, stage, 'REF_UNRESOLVED', `${a.location}.${field}`, `'${t}' does not resolve`);
        continue;
      }
      if (!referenceLawful(src, scopeKeyOf(target))) {
        push(findings, stage, 'CROSS_SCOPE', `${a.location}.${field}`, `unlawful cross-scope reference to '${t}'`);
      }
    }
  };

  resolveLawful(a.dependencies.prerequisite, 'dependencies.prerequisite', 'dependency');
  resolveLawful(a.composition.excludes, 'composition.excludes', 'reference');
  resolveLawful(a.composition.requiresCompanion, 'composition.requires_companion', 'reference');

  // guarantee references resolve into the frozen guarantee namespace
  for (const g of a.dependencies.realizes) {
    if (!vocab.guarantees.has(g)) {
      push(findings, 'dependency', 'GUARANTEE_UNRESOLVED', `${a.location}.dependencies.realizes`, `'${g}' is not a known guarantee`);
    }
  }
  for (const g of a.dependencies.verifies) {
    if (!vocab.guarantees.has(g)) {
      push(findings, 'dependency', 'GUARANTEE_UNRESOLVED', `${a.location}.dependencies.verifies`, `'${g}' is not a known guarantee`);
    }
  }

  // lineage target must resolve and be canonical-scoped
  if (a.governance.lineage) {
    const t = a.governance.lineage.derivesFrom;
    const target = idMap.get(t);
    if (!target) {
      push(findings, 'reference', 'REF_UNRESOLVED', `${a.location}.governance.lineage`, `'${t}' does not resolve`);
    } else if (target.scope.class !== 'canonical') {
      push(findings, 'reference', 'LINEAGE_NOT_CANONICAL', `${a.location}.governance.lineage`, `lineage target '${t}' is not canonical`);
    }
  }

  // evolution references resolve
  if (a.evolution) {
    for (const t of a.evolution.supersedes) {
      if (!idMap.has(t)) {
        push(findings, 'reference', 'REF_UNRESOLVED', `${a.location}.evolution.supersedes`, `'${t}' does not resolve`);
      }
    }
    if (a.evolution.supersededBy && !idMap.has(a.evolution.supersededBy)) {
      push(findings, 'reference', 'REF_UNRESOLVED', `${a.location}.evolution.superseded_by`, `'${a.evolution.supersededBy}' does not resolve`);
    }
  }
}

function push(
  findings: Finding[],
  stage: string,
  code: string,
  location: string,
  message: string,
): void {
  findings.push({ stage, code, location, message });
}
