/**
 * Sprint W25 — Semantic Corpus Auditor (observability only).
 *
 * A READ-ONLY tool that measures the completeness of the W17 per-component semantic bodies across
 * `repository/canonical/<component>/component.md`. It answers "how migrated is the corpus, and which
 * bodies are shallow / partial / weak / placeholder / copied?" — so progress can be tracked without a
 * manual audit. It produces a single immutable, deterministically-digested report.
 *
 * Hard boundary — it MEASURES, it never MUTATES:
 *  - No generation, no rewrite, no consumer. Nothing in World A or World B imports this module; it is
 *    referenced only by its test. Materialization, planning, selection, ordering, authoring, and HTML
 *    are therefore unchanged. Reading the corpus files changes nothing.
 *  - It reuses the W18 loader's body extraction + digest + the W17 `REQUIRED_SECTIONS` (read-only) so
 *    the auditor and the runtime loader agree on what a body IS.
 *  - No LLM, embeddings, vectors, or meaning inference — only deterministic structural measurement.
 *
 * VALIDATION SEMANTICS (the one reconciliation — documented, not silent).
 *   The brief asks the auditor to "measure corpus completeness" across ~90 incomplete bodies AND to
 *   "fail loudly for missing required section / unknown section / invalid ordering". Taken as a crash,
 *   those conflict — aborting on the first incomplete body makes corpus measurement impossible. The
 *   reconciliation mirrors W19's `tryParseSemanticBody` pattern:
 *     • PER-COMPONENT template breaches (missing / unknown / duplicate / empty / ordering) are
 *       DETECTED and RECORDED LOUDLY as the component's `validation` status + `breaches` list — they
 *       are the measurement, not a crash. A body with NO `##` sections is an un-migrated descriptor
 *       (`validation: 'no-semantic-body'`), not a breach.
 *     • The STRICT fail-loud validator `assertBodyValid()` THROWS on every such breach (for callers
 *       that want hard validation, and exercised by the tests).
 *     • The AUDITOR ITSELF fails loud (throws `CorpusAuditError`) only on INTEGRITY breaches that
 *       would corrupt the measurement: a duplicate component slug ("duplicate body"), a
 *       non-deterministic replay ("digest mismatch"), a package with no frontmatter, and a report
 *       that is not frozen ("mutable report").
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { REQUIRED_SECTIONS, extractBody, bodyDigest, type SectionName } from '../knowledge/semantic-body.js';
import { parseFamilyModel } from '../knowledge/inheritance.js';

/** Bump when the audit representation/metrics change; participates in the report digest. */
export const AUDIT_VERSION = 'w25-semantic-corpus-audit@1';

const REQUIRED_SET: ReadonlySet<string> = new Set(REQUIRED_SECTIONS);
const CANONICAL_INDEX: ReadonlyMap<string, number> = new Map(REQUIRED_SECTIONS.map((s, i) => [s, i]));

/** Placeholder-text cues (deterministic, closed). Word-boundary anchored to avoid prose false-fires. */
const PLACEHOLDER_RE = /\b(todo|tbd|fixme|xxx|lorem ipsum|placeholder|coming soon|fill in|to be written)\b/i;

/** Fail-loud error for the strict validator + the auditor's own integrity breaches. */
export class CorpusAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorpusAuditError';
  }
}

/** Weakness thresholds — configurable; a body below either is flagged `weak`. */
export interface AuditThresholds {
  /** Minimum total words across all `##` sections for a body not to be "weak". */
  readonly minBodyWords: number;
  /** Minimum words in any present, non-empty required section for a body not to be "weak". */
  readonly minSectionWords: number;
}

/** Defaults: a migrated body should carry real rationale in every dimension. */
export const DEFAULT_AUDIT_THRESHOLDS: AuditThresholds = Object.freeze({ minBodyWords: 60, minSectionWords: 6 });

/** Per-component validation outcome (recorded, not thrown — see VALIDATION SEMANTICS). */
export type ComponentValidation = 'valid' | 'invalid' | 'no-semantic-body';

/** The measured audit of one component's semantic body. Frozen. */
export interface ComponentAudit {
  readonly slug: string;
  readonly sourceFile: string;
  readonly family: string;
  /** True iff the body presents as a template body (has ≥1 `##` section). */
  readonly hasBody: boolean;
  readonly validation: ComponentValidation;
  /** Loud, recorded breaches (missing / unknown / duplicate / empty / ordering). Empty when valid. */
  readonly breaches: readonly string[];
  /** % of the 7 required dimensions present AND non-empty. */
  readonly coveragePct: number;
  readonly presentSections: readonly string[];
  readonly missingSections: readonly string[];
  readonly duplicateSections: readonly string[];
  readonly unknownSections: readonly string[];
  readonly emptySections: readonly string[];
  /** True iff the present required sections appear in canonical order. */
  readonly orderingOk: boolean;
  /** Word count per scanned `##` section (first occurrence), keyed by heading. */
  readonly sectionWordCounts: Readonly<Record<string, number>>;
  /** Total words across all `##` section contents. */
  readonly totalWords: number;
  readonly placeholder: boolean;
  readonly weak: boolean;
  /** W18 body digest (parser version + canonical body). */
  readonly digest: string;
}

/** Coverage rolled up by family. Frozen. */
export interface FamilyCoverage {
  readonly family: string;
  readonly total: number;
  readonly migrated: number;
  readonly coveragePct: number;
}

/** One cluster of components sharing a byte-identical body digest. Frozen. */
export interface CopiedCluster {
  readonly digest: string;
  readonly slugs: readonly string[];
}

/** One missing-dimension tally across the corpus. */
export interface MissingDimension {
  readonly section: string;
  readonly count: number;
}

/** The immutable corpus audit report. Deep-frozen; carries a deterministic digest. */
export interface CorpusAudit {
  readonly auditVersion: string;
  readonly thresholds: AuditThresholds;
  readonly totalComponents: number;
  readonly semanticBodies: number;
  readonly missingBodies: number;
  readonly weakBodies: number;
  readonly fullyCovered: number;
  /** Mean per-component coverage % across all components. */
  readonly coveragePct: number;
  /** Mean total words across components that HAVE a semantic body. */
  readonly avgBodyWords: number;
  readonly topMissingDimensions: readonly MissingDimension[];
  readonly copiedClusters: readonly CopiedCluster[];
  readonly familyCoverage: readonly FamilyCoverage[];
  readonly components: readonly ComponentAudit[];
  readonly digest: string;
}

// ── word + section utilities ──────────────────────────────────────────────────
function wordCount(text: string): number {
  const t = text.trim();
  if (t === '') return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

const H2 = /^##(?!#)\s+(.*\S)\s*$/;

/** Tolerant, fence-aware scan of every `##` section (incl. unknown/duplicate), in authored order. */
function scanSections(body: string): Array<{ name: string; content: string }> {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out: Array<{ name: string; content: string }> = [];
  let i = 0;
  let inFence = false;
  // skip preamble
  for (; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence;
    if (!inFence && H2.test(lines[i])) break;
  }
  while (i < lines.length) {
    const m = H2.exec(lines[i]);
    const name = m![1];
    const content: string[] = [];
    i++;
    for (; i < lines.length; i++) {
      if (/^\s*```/.test(lines[i])) inFence = !inFence;
      if (!inFence && H2.test(lines[i])) break;
      content.push(lines[i]);
    }
    out.push({ name, content: content.join('\n').trim() });
  }
  return out;
}

// ── per-component audit (pure; records breaches, never aborts the scan) ──────────
/** Options for a single body audit. */
export interface AuditBodyOptions {
  readonly family?: string;
  readonly sourceFile?: string;
  readonly thresholds?: AuditThresholds;
}

/** Measure one component's semantic body. Pure + deterministic; the result is frozen. */
export function auditBody(slug: string, body: string, opts: AuditBodyOptions = {}): ComponentAudit {
  const thresholds = opts.thresholds ?? DEFAULT_AUDIT_THRESHOLDS;
  const family = opts.family ?? '(unmapped)';
  const sourceFile = opts.sourceFile ?? `canonical/${slug}/component.md`;
  const canonical = body.replace(/\r\n/g, '\n');
  const digest = bodyDigest(canonical);
  const placeholder = PLACEHOLDER_RE.test(canonical);

  const scanned = scanSections(canonical);
  const sectionWordCounts: Record<string, number> = {};
  for (const s of scanned) if (!(s.name in sectionWordCounts)) sectionWordCounts[s.name] = wordCount(s.content);
  const totalWords = scanned.reduce((n, s) => n + wordCount(s.content), 0);

  if (scanned.length === 0) {
    // un-migrated descriptor — a missing body, not a breach
    return freezeComponent({
      slug, sourceFile, family,
      hasBody: false,
      validation: 'no-semantic-body',
      breaches: [],
      coveragePct: 0,
      presentSections: [],
      missingSections: [...REQUIRED_SECTIONS],
      duplicateSections: [],
      unknownSections: [],
      emptySections: [],
      orderingOk: true,
      sectionWordCounts,
      totalWords,
      placeholder,
      weak: false,
      digest,
    });
  }

  const names = scanned.map((s) => s.name);
  const firstContent = new Map<string, string>();
  for (const s of scanned) if (!firstContent.has(s.name)) firstContent.set(s.name, s.content);

  const seenCount = new Map<string, number>();
  for (const n of names) seenCount.set(n, (seenCount.get(n) ?? 0) + 1);

  const duplicateSections = [...seenCount].filter(([, c]) => c > 1).map(([n]) => n);
  const unknownSections = [...new Set(names)].filter((n) => !REQUIRED_SET.has(n));
  const presentRequired = REQUIRED_SECTIONS.filter((s) => firstContent.has(s));
  const missingSections = REQUIRED_SECTIONS.filter((s) => !firstContent.has(s));
  const emptySections = presentRequired.filter((s) => (firstContent.get(s) ?? '') === '');
  const coveredSections = presentRequired.filter((s) => (firstContent.get(s) ?? '') !== '');
  const coveragePct = Math.round((coveredSections.length / REQUIRED_SECTIONS.length) * 100);

  // ordering over the present required sections (by first occurrence in authored order)
  const presentRequiredInAuthoredOrder = names.filter((n) => REQUIRED_SET.has(n));
  const firstSeen: string[] = [];
  const seenForOrder = new Set<string>();
  for (const n of presentRequiredInAuthoredOrder) if (!seenForOrder.has(n)) { seenForOrder.add(n); firstSeen.push(n); }
  let orderingOk = true;
  for (let k = 1; k < firstSeen.length; k++) {
    if (CANONICAL_INDEX.get(firstSeen[k])! <= CANONICAL_INDEX.get(firstSeen[k - 1])!) { orderingOk = false; break; }
  }

  const breaches: string[] = [];
  if (missingSections.length > 0) breaches.push(`missing required section(s): ${missingSections.join(', ')}`);
  if (unknownSections.length > 0) breaches.push(`unknown section(s): ${unknownSections.join(', ')}`);
  if (duplicateSections.length > 0) breaches.push(`duplicate section(s): ${duplicateSections.join(', ')}`);
  if (emptySections.length > 0) breaches.push(`empty section(s): ${emptySections.join(', ')}`);
  if (!orderingOk) breaches.push('invalid section ordering (sections out of canonical order)');

  const weak =
    totalWords < thresholds.minBodyWords ||
    coveredSections.some((s) => (sectionWordCounts[s] ?? 0) < thresholds.minSectionWords);

  return freezeComponent({
    slug, sourceFile, family,
    hasBody: true,
    validation: breaches.length === 0 ? 'valid' : 'invalid',
    breaches,
    coveragePct,
    presentSections: presentRequired,
    missingSections,
    duplicateSections,
    unknownSections,
    emptySections,
    orderingOk,
    sectionWordCounts,
    totalWords,
    placeholder,
    weak,
    digest,
  });
}

/** Strict fail-loud validator: throws CorpusAuditError unless the body is a valid 7-section W17 body. */
export function assertBodyValid(body: string, location = '<body>'): void {
  const a = auditBody(location, body);
  if (a.validation === 'valid') return;
  if (a.validation === 'no-semantic-body') {
    throw new CorpusAuditError(`${location}: no '##' sections — missing required section(s): ${REQUIRED_SECTIONS.join(', ')}`);
  }
  throw new CorpusAuditError(`${location}: ${a.breaches.join('; ')}`);
}

// ── discovery (read-only over the canonical corpus) ─────────────────────────────
/** Default repository root: `offscript/repository` (module-relative; overridable for tests). */
export function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL('../../repository', import.meta.url));
}

/** One discovered component body (slug + raw body + source path). */
export interface DiscoveredComponent {
  readonly slug: string;
  readonly body: string;
  readonly sourceFile?: string;
  readonly family?: string;
}

/**
 * Discover every `canonical/<slug>/component.md`, extracting its body (fail-loud on a package with no
 * frontmatter). Read-only. Deterministic order (sorted by slug).
 */
export function discoverComponentBodies(root: string = defaultRepositoryRoot()): DiscoveredComponent[] {
  const canonical = join(root, 'canonical');
  if (!existsSync(canonical)) {
    throw new CorpusAuditError(`semantic-corpus-audit: canonical corpus not found at ${canonical}`);
  }
  const slugs = readdirSync(canonical, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const out: DiscoveredComponent[] = [];
  for (const slug of slugs) {
    const file = join(canonical, slug, 'component.md');
    if (!existsSync(file)) continue;
    const body = extractBody(readFileSync(file, 'utf8'), `canonical/${slug}/component.md`);
    out.push({ slug, body, sourceFile: `canonical/${slug}/component.md` });
  }
  return out;
}

// ── corpus audit ────────────────────────────────────────────────────────────────
/** Options for a corpus audit. Inject `components` to bypass the filesystem (tests). */
export interface AuditCorpusOptions {
  readonly root?: string;
  readonly thresholds?: AuditThresholds;
  readonly components?: readonly DiscoveredComponent[];
}

let FAMILY_MODEL: ReadonlyMap<string, string> | undefined;
function familyForSlug(slug: string, provided?: string): string {
  if (provided !== undefined) return provided;
  if (slug.startsWith('family-')) return '(abstract family)';
  if (FAMILY_MODEL === undefined) {
    try {
      FAMILY_MODEL = parseFamilyModel('website').variantToFamily;
    } catch {
      FAMILY_MODEL = new Map();
    }
  }
  return FAMILY_MODEL.get(slug) ?? '(unmapped)';
}

/** Audit the whole corpus and produce the immutable report. */
export function auditCorpus(opts: AuditCorpusOptions = {}): CorpusAudit {
  const thresholds = opts.thresholds ?? DEFAULT_AUDIT_THRESHOLDS;
  const discovered = opts.components ?? discoverComponentBodies(opts.root);

  // integrity: no duplicate slug
  const seen = new Set<string>();
  for (const c of discovered) {
    if (seen.has(c.slug)) throw new CorpusAuditError(`semantic-corpus-audit: duplicate body for slug "${c.slug}"`);
    seen.add(c.slug);
  }

  const components = discovered
    .map((c) => auditBody(c.slug, c.body, { thresholds, sourceFile: c.sourceFile, family: familyForSlug(c.slug, c.family) }))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const total = components.length;
  const withBody = components.filter((c) => c.hasBody);
  const semanticBodies = withBody.length;
  const missingBodies = total - semanticBodies;
  const weakBodies = components.filter((c) => c.weak).length;
  const fullyCovered = components.filter((c) => c.validation === 'valid').length;
  const coveragePct = total === 0 ? 0 : Math.round(components.reduce((n, c) => n + c.coveragePct, 0) / total);
  const avgBodyWords = semanticBodies === 0 ? 0 : Math.round(withBody.reduce((n, c) => n + c.totalWords, 0) / semanticBodies);

  // top missing dimensions: required sections not covered (missing OR empty), ranked desc
  const topMissingDimensions: MissingDimension[] = REQUIRED_SECTIONS.map((section) => ({
    section,
    count: components.filter((c) => c.missingSections.includes(section) || c.emptySections.includes(section as SectionName)).length,
  }))
    .sort((a, b) => b.count - a.count || CANONICAL_INDEX.get(a.section)! - CANONICAL_INDEX.get(b.section)!)
    .map((d) => Object.freeze(d));

  // copied clusters: identical body digest shared by ≥2 components
  const byDigest = new Map<string, string[]>();
  for (const c of components) {
    if (!byDigest.has(c.digest)) byDigest.set(c.digest, []);
    byDigest.get(c.digest)!.push(c.slug);
  }
  const copiedClusters: CopiedCluster[] = [...byDigest.entries()]
    .filter(([, slugs]) => slugs.length >= 2)
    .map(([digest, slugs]) => Object.freeze({ digest, slugs: Object.freeze([...slugs].sort()) }))
    .sort((a, b) => b.slugs.length - a.slugs.length || (a.digest < b.digest ? -1 : 1));

  // family coverage
  const byFamily = new Map<string, ComponentAudit[]>();
  for (const c of components) {
    if (!byFamily.has(c.family)) byFamily.set(c.family, []);
    byFamily.get(c.family)!.push(c);
  }
  const familyCoverage: FamilyCoverage[] = [...byFamily.entries()]
    .map(([family, cs]) => Object.freeze({
      family,
      total: cs.length,
      migrated: cs.filter((c) => c.hasBody).length,
      coveragePct: Math.round(cs.reduce((n, c) => n + c.coveragePct, 0) / cs.length),
    }))
    .sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));

  const digest = computeReportDigest(thresholds, components);

  const report: CorpusAudit = {
    auditVersion: AUDIT_VERSION,
    thresholds: Object.freeze({ ...thresholds }),
    totalComponents: total,
    semanticBodies,
    missingBodies,
    weakBodies,
    fullyCovered,
    coveragePct,
    avgBodyWords,
    topMissingDimensions: Object.freeze(topMissingDimensions),
    copiedClusters: Object.freeze(copiedClusters),
    familyCoverage: Object.freeze(familyCoverage),
    components: Object.freeze(components),
    digest,
  };
  const frozen = Object.freeze(report);
  if (!Object.isFrozen(frozen)) throw new CorpusAuditError('semantic-corpus-audit: report is not immutable');
  return frozen;
}

/** Deterministic report digest over the audit version, thresholds, and per-component summaries. */
function computeReportDigest(thresholds: AuditThresholds, components: readonly ComponentAudit[]): string {
  const stable = {
    v: AUDIT_VERSION,
    t: thresholds,
    c: [...components]
      .sort((a, b) => (a.slug < b.slug ? -1 : 1))
      .map((c) => ({ s: c.slug, d: c.digest, v: c.validation, cov: c.coveragePct, b: c.hasBody, w: c.weak })),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

/**
 * Deterministic-replay proof + digest-mismatch fail-loud: audit twice and confirm the report digest
 * is identical. Throws CorpusAuditError on a mismatch (non-determinism).
 */
export function verifyCorpusAuditReplay(opts: AuditCorpusOptions = {}): CorpusAudit {
  const a = auditCorpus(opts);
  const b = auditCorpus(opts);
  if (a.digest !== b.digest) {
    throw new CorpusAuditError(`semantic-corpus-audit: digest mismatch on replay (${a.digest} ≠ ${b.digest})`);
  }
  return a;
}

// ── freeze helper ────────────────────────────────────────────────────────────────
function freezeComponent(c: ComponentAudit): ComponentAudit {
  Object.freeze(c.breaches);
  Object.freeze(c.presentSections);
  Object.freeze(c.missingSections);
  Object.freeze(c.duplicateSections);
  Object.freeze(c.unknownSections);
  Object.freeze(c.emptySections);
  Object.freeze(c.sectionWordCounts);
  return Object.freeze(c);
}
