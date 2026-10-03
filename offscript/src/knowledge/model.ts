/**
 * PKG — Repository Builder: the NORMALIZED METADATA MODEL (ES-1R §4, four bands).
 *
 * This is the serialization-INDEPENDENT representation. Source adapters (YAML,
 * Markdown) produce a loose object; `parseAsset` validates its shape and emits a
 * normalized, canonical model (NFC strings, sorted+deduped sets, defaulted empty
 * sections). Everything downstream — validation, extraction, graphs, manifest —
 * consumes only this model and never the source bytes.
 *
 * `extra="forbid"` is realized here as explicit unknown-key rejection, which is
 * how the frozen four-band region set is enforced: a top-level `spec` (or any
 * unknown key) is a schema finding (ES-1R F1 — no fifth region).
 */
import type { Finding } from './finding.js';

export const KINDS = [
  'component',
  'prompt',
  'workflow',
  'pattern',
  'template',
  'documentation',
  'asset',
] as const;
export type Kind = (typeof KINDS)[number];

export const SCOPE_CLASSES = ['canonical', 'brand', 'bundle'] as const;
export type ScopeClass = (typeof SCOPE_CLASSES)[number];

export const AUTHORITIES = ['canonical-global', 'adapted-local'] as const;
export type Authority = (typeof AUTHORITIES)[number];

export const FALLBACK_CLASSES = ['composition', 'hybrid', 'exemplar'] as const;
export type FallbackClass = (typeof FALLBACK_CLASSES)[number];

export const STATUSES = ['active', 'deprecated', 'superseded'] as const;
export type Status = (typeof STATUSES)[number];

export const SUPPORTED_SCHEMA_VERSIONS = ['1.0'] as const;

export interface NormalizedAsset {
  readonly schemaVersion: string;
  readonly kind: Kind;
  readonly identity: { readonly id: string; readonly title: string };
  readonly ownership: { readonly owner: string };
  readonly scope: { readonly class: ScopeClass; readonly identity: string };
  readonly governance: {
    readonly authority: Authority;
    readonly lineage?: { readonly derivesFrom: string };
    readonly constraints: readonly string[];
  };
  readonly dependencies: {
    readonly prerequisite: readonly string[];
    readonly realizes: readonly string[];
    readonly verifies: readonly string[];
  };
  readonly semantics: {
    readonly produces: readonly string[];
    readonly consumes: readonly string[];
    readonly derivesFrom: readonly string[];
    readonly specializes: readonly string[];
  };
  readonly capabilities: {
    readonly communicates: readonly string[];
    readonly satisfies: readonly string[];
  };
  readonly composition: {
    readonly excludes: readonly string[];
    readonly requiresCompanion: readonly string[];
    readonly fallbackClass?: FallbackClass;
  };
  readonly evolution?: {
    readonly status: Status;
    readonly supersedes: readonly string[];
    readonly supersededBy?: string;
  };
  readonly validation: { readonly expects: readonly string[]; readonly tests: readonly string[] };
  /** Source location for findings only — excluded from canonical form / digest. */
  readonly location: string;
}

const TOP_KEYS = [
  'schema_version',
  'kind',
  'identity',
  'ownership',
  'scope',
  'governance',
  'dependencies',
  'semantics',
  'capabilities',
  'composition',
  'evolution',
  'validation',
];

const STAGE = 'schema';

function f(findings: Finding[], code: string, loc: string, message: string): void {
  findings.push({ stage: STAGE, code, location: loc, message });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rejectUnknown(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  loc: string,
  findings: Finding[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      f(findings, 'SCHEMA_UNKNOWN_KEY', `${loc}.${key}`, `unknown key (frozen region set)`);
    }
  }
}

function reqString(
  obj: Record<string, unknown>,
  key: string,
  loc: string,
  findings: Finding[],
): string | undefined {
  const v = obj[key];
  if (v === undefined) {
    f(findings, 'SCHEMA_MISSING', `${loc}.${key}`, 'required');
    return undefined;
  }
  if (typeof v !== 'string') {
    f(findings, 'SCHEMA_TYPE', `${loc}.${key}`, 'expected string');
    return undefined;
  }
  return v.normalize('NFC');
}

function reqEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  loc: string,
  findings: Finding[],
): T | undefined {
  const v = reqString(obj, key, loc, findings);
  if (v === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(v)) {
    f(findings, 'SCHEMA_ENUM', `${loc}.${key}`, `must be one of: ${allowed.join(', ')}`);
    return undefined;
  }
  return v as T;
}

function optStringArray(
  obj: Record<string, unknown>,
  key: string,
  loc: string,
  findings: Finding[],
): string[] {
  const v = obj[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    f(findings, 'SCHEMA_TYPE', `${loc}.${key}`, 'expected string[]');
    return [];
  }
  return normList(v as string[]);
}

/** NFC-normalize, dedupe, and sort — metadata lists are sets in canonical form. */
function normList(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.normalize('NFC')))].sort();
}

function reqRecord(
  obj: Record<string, unknown>,
  key: string,
  loc: string,
  findings: Finding[],
): Record<string, unknown> | undefined {
  const v = obj[key];
  if (v === undefined) {
    f(findings, 'SCHEMA_MISSING', `${loc}.${key}`, 'required');
    return undefined;
  }
  if (!isRecord(v)) {
    f(findings, 'SCHEMA_TYPE', `${loc}.${key}`, 'expected object');
    return undefined;
  }
  return v;
}

function optRecord(
  obj: Record<string, unknown>,
  key: string,
  loc: string,
  findings: Finding[],
): Record<string, unknown> | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!isRecord(v)) {
    f(findings, 'SCHEMA_TYPE', `${loc}.${key}`, 'expected object');
    return undefined;
  }
  return v;
}

export interface ParseResult {
  readonly asset?: NormalizedAsset;
  readonly findings: readonly Finding[];
}

/**
 * Validate a loose source object and, if well-formed, return the normalized model.
 * Any schema finding suppresses the asset (it cannot be trusted downstream).
 */
export function parseAsset(loose: unknown, location: string): ParseResult {
  const findings: Finding[] = [];
  if (!isRecord(loose)) {
    f(findings, 'SCHEMA_NOT_OBJECT', location, 'document must be a mapping');
    return { findings };
  }
  rejectUnknown(loose, TOP_KEYS, location, findings);

  const schemaVersion = reqEnum(loose, 'schema_version', SUPPORTED_SCHEMA_VERSIONS, location, findings);
  const kind = reqEnum(loose, 'kind', KINDS, location, findings);

  const idRec = reqRecord(loose, 'identity', location, findings);
  let identity: NormalizedAsset['identity'] | undefined;
  if (idRec) {
    rejectUnknown(idRec, ['id', 'title'], `${location}.identity`, findings);
    const id = reqString(idRec, 'id', `${location}.identity`, findings);
    const title = reqString(idRec, 'title', `${location}.identity`, findings);
    if (id !== undefined && title !== undefined) identity = { id, title };
  }

  const ownRec = reqRecord(loose, 'ownership', location, findings);
  let ownership: NormalizedAsset['ownership'] | undefined;
  if (ownRec) {
    rejectUnknown(ownRec, ['owner'], `${location}.ownership`, findings);
    const owner = reqString(ownRec, 'owner', `${location}.ownership`, findings);
    if (owner !== undefined) ownership = { owner };
  }

  const scopeRec = reqRecord(loose, 'scope', location, findings);
  let scope: NormalizedAsset['scope'] | undefined;
  if (scopeRec) {
    rejectUnknown(scopeRec, ['class', 'identity'], `${location}.scope`, findings);
    const cls = reqEnum(scopeRec, 'class', SCOPE_CLASSES, `${location}.scope`, findings);
    const sid = reqString(scopeRec, 'identity', `${location}.scope`, findings);
    if (cls !== undefined && sid !== undefined) scope = { class: cls, identity: sid };
  }

  const govRec = reqRecord(loose, 'governance', location, findings);
  let governance: NormalizedAsset['governance'] | undefined;
  if (govRec) {
    rejectUnknown(govRec, ['authority', 'lineage', 'constraints'], `${location}.governance`, findings);
    const authority = reqEnum(govRec, 'authority', AUTHORITIES, `${location}.governance`, findings);
    const constraints = optStringArray(govRec, 'constraints', `${location}.governance`, findings);
    let lineage: { derivesFrom: string } | undefined;
    const linRec = optRecord(govRec, 'lineage', `${location}.governance`, findings);
    if (linRec) {
      rejectUnknown(linRec, ['derives_from'], `${location}.governance.lineage`, findings);
      const df = reqString(linRec, 'derives_from', `${location}.governance.lineage`, findings);
      if (df !== undefined) lineage = { derivesFrom: df };
    }
    if (authority !== undefined) {
      governance = lineage ? { authority, lineage, constraints } : { authority, constraints };
    }
  }

  // Band B (optional sections; defaulted to empty)
  let dependencies = { prerequisite: [] as string[], realizes: [] as string[], verifies: [] as string[] };
  const depRec = optRecord(loose, 'dependencies', location, findings);
  if (depRec) {
    rejectUnknown(depRec, ['prerequisite', 'realizes', 'verifies'], `${location}.dependencies`, findings);
    dependencies = {
      prerequisite: optStringArray(depRec, 'prerequisite', `${location}.dependencies`, findings),
      realizes: optStringArray(depRec, 'realizes', `${location}.dependencies`, findings),
      verifies: optStringArray(depRec, 'verifies', `${location}.dependencies`, findings),
    };
  }

  let semantics = {
    produces: [] as string[],
    consumes: [] as string[],
    derivesFrom: [] as string[],
    specializes: [] as string[],
  };
  const semRec = optRecord(loose, 'semantics', location, findings);
  if (semRec) {
    rejectUnknown(
      semRec,
      ['produces', 'consumes', 'derives_from', 'specializes'],
      `${location}.semantics`,
      findings,
    );
    semantics = {
      produces: optStringArray(semRec, 'produces', `${location}.semantics`, findings),
      consumes: optStringArray(semRec, 'consumes', `${location}.semantics`, findings),
      derivesFrom: optStringArray(semRec, 'derives_from', `${location}.semantics`, findings),
      specializes: optStringArray(semRec, 'specializes', `${location}.semantics`, findings),
    };
  }

  let capabilities = { communicates: [] as string[], satisfies: [] as string[] };
  const capRec = optRecord(loose, 'capabilities', location, findings);
  if (capRec) {
    rejectUnknown(capRec, ['communicates', 'satisfies'], `${location}.capabilities`, findings);
    capabilities = {
      communicates: optStringArray(capRec, 'communicates', `${location}.capabilities`, findings),
      satisfies: optStringArray(capRec, 'satisfies', `${location}.capabilities`, findings),
    };
  }

  let composition: NormalizedAsset['composition'] = { excludes: [], requiresCompanion: [] };
  const compRec = optRecord(loose, 'composition', location, findings);
  if (compRec) {
    rejectUnknown(
      compRec,
      ['excludes', 'requires_companion', 'fallback_class'],
      `${location}.composition`,
      findings,
    );
    const fallbackClass = compRec['fallback_class'] === undefined
      ? undefined
      : reqEnum(compRec, 'fallback_class', FALLBACK_CLASSES, `${location}.composition`, findings);
    composition = {
      excludes: optStringArray(compRec, 'excludes', `${location}.composition`, findings),
      requiresCompanion: optStringArray(compRec, 'requires_companion', `${location}.composition`, findings),
      ...(fallbackClass ? { fallbackClass } : {}),
    };
  }

  let evolution: NormalizedAsset['evolution'];
  const evoRec = optRecord(loose, 'evolution', location, findings);
  if (evoRec) {
    rejectUnknown(evoRec, ['status', 'supersedes', 'superseded_by'], `${location}.evolution`, findings);
    const status = reqEnum(evoRec, 'status', STATUSES, `${location}.evolution`, findings);
    const supersedes = optStringArray(evoRec, 'supersedes', `${location}.evolution`, findings);
    const supersededByRaw = evoRec['superseded_by'];
    let supersededBy: string | undefined;
    if (supersededByRaw !== undefined) {
      if (typeof supersededByRaw !== 'string') {
        f(findings, 'SCHEMA_TYPE', `${location}.evolution.superseded_by`, 'expected string');
      } else {
        supersededBy = supersededByRaw.normalize('NFC');
      }
    }
    if (status !== undefined) {
      evolution = supersededBy ? { status, supersedes, supersededBy } : { status, supersedes };
    }
  }

  let validation = { expects: [] as string[], tests: [] as string[] };
  const valRec = optRecord(loose, 'validation', location, findings);
  if (valRec) {
    rejectUnknown(valRec, ['expects', 'tests'], `${location}.validation`, findings);
    validation = {
      expects: optStringArray(valRec, 'expects', `${location}.validation`, findings),
      tests: optStringArray(valRec, 'tests', `${location}.validation`, findings),
    };
  }

  if (
    findings.length > 0 ||
    schemaVersion === undefined ||
    kind === undefined ||
    !identity ||
    !ownership ||
    !scope ||
    !governance
  ) {
    return { findings };
  }

  const asset: NormalizedAsset = {
    schemaVersion,
    kind,
    identity,
    ownership,
    scope,
    governance,
    dependencies,
    semantics,
    capabilities,
    composition,
    ...(evolution ? { evolution } : {}),
    validation,
    location,
  };
  return { asset, findings };
}

/**
 * Canonical projection for digesting (M3): STRUCTURALLY DERIVED from the
 * NormalizedAsset, not a hand-maintained parallel mapping. The transform is purely
 * mechanical — convert each model key (camelCase) to its serialized snake_case form,
 * drop `location` (findings-only, never identity-bearing), and drop empty
 * arrays/objects (absence is meaning). Because every field flows through this single
 * transform, a new band field cannot be silently excluded from the content digest:
 * adding it to NormalizedAsset includes it in the canonical form by construction.
 */
export function assetCanonical(a: NormalizedAsset): Record<string, unknown> {
  const { location: _omit, ...rest } = a;
  return canonProject(rest) as Record<string, unknown>;
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}

function isEmptyProjection(v: unknown): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (v && typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

/** Recursively rename object keys to snake_case and drop empty arrays/objects. */
function canonProject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonProject);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const projected = canonProject(v);
      if (isEmptyProjection(projected)) continue;
      out[toSnake(k)] = projected;
    }
    return out;
  }
  return value;
}
