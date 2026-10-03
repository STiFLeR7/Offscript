/**
 * P02 — Platform Harness Foundation (RED-first). P03 adds a Consumption addendum below.
 *
 * Types → immutable Execution Context → Execution Contract → Transport objects. Stops at
 * Transport, exactly mirroring the W18 (semantic-body) / W20 (semantic-author-context) / W52
 * (presentation-intent) / W70 (website-visual-discovery) Foundation pattern: one immutable
 * model, nothing wired, zero consumers (true AT P02 — the "foundation isolation" test below
 * captured that snapshot). No engine behaviour changes — the module itself is unchanged by P03.
 *
 * P03 CONSUMPTION ADDENDUM: scripts/generate.ts now consumes this Foundation as the single
 * orchestration/exit-status path (see src/generate/validate-loop-driver.ts, the Validate +
 * Metrics + Report driver extracted from generate.ts's former inline runValidateLoop). The
 * "zero consumers" test below was replaced with a whitelist ("exactly EXPECTED_CONSUMERS") —
 * it is no longer testing isolation, it is testing that consumption is exactly what P03 wired,
 * nothing more. This module (platform-harness.ts) itself gained ONE addition for P03:
 * createHarnessStageSequencer — see its own describe block below for why.
 *
 * P08 ADDENDUM: src/doctor/review-package.ts now also imports PLATFORM_HARNESS_VERSION (a
 * real, non-type-only reuse of an already-existing constant — the Review Package's `metadata.
 * platformHarnessVersion` field, docs/internals/P08-DESIGNER-DOCTOR-REVIEW-PACKAGE.md §4) — the
 * SAME deliberate whitelist-growth pattern as P03's own addendum above, applied a second time.
 * platform-harness.ts itself is unchanged this sprint.
 *
 * P10 ADDENDUM: platform-harness.ts gains ONE new transport shape,
 * `HarnessProposalResult` — a TYPE-ONLY reuse of `ProposalPackage` (Designer
 * Author, P09), mirroring exactly how `HarnessReviewResult` reuses `Frozen`
 * and `HarnessValidateResult` reuses `RunScore`: "the harness carries data
 * the engine already produces; it invents none of its own." Per P02's own
 * Foundation discipline ("no stage implementation is provided or wired
 * here"), this is a DEFINED-BUT-UNCONSUMED shape — no stage runner, no
 * HARNESS_STAGES change, nothing wired — the exact pattern P02 itself used
 * for a full sprint before P03 wired anything. Because the import is
 * type-only, it does not add a new entry to EXPECTED_CONSUMERS below (that
 * whitelist tracks real, non-type-only imports of platform-harness.js INTO
 * other files — this is the reverse direction, platform-harness.ts importing
 * a TYPE from designer-author, tracked instead by
 * test/designer-author/consumption-isolation.test.ts's own whitelist).
 *
 * Grounded directly in scripts/generate.ts's real, traced exit paths (P02 investigation):
 *   - line ~104: no project directory → `console.log(...); process.exit(0)` ("skipped").
 *   - line ~686: Stage 1 buildContext() throws → caught, `process.exit(1)` ("context-failed").
 *   - line ~763: full pipeline completion → `process.exit(0)` UNCONDITIONALLY, even when the
 *     run's own RunHeadline status is 'failed' (LOUD-MARK: a FAILED headline is a statement
 *     about a completed run, not an action on it — run-headline.ts's own header comment).
 * The harness's exit-status model reuses this exactly rather than inventing new semantics.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PLATFORM_HARNESS_VERSION,
  HARNESS_STAGES,
  createHarnessExecutionContext,
  createHarnessStageSequencer,
  buildHarnessRunResult,
  exitCodeFor,
  type HarnessStageName,
  type HarnessInput,
  type HarnessExecutionContext,
  type HarnessStage,
  type HarnessRunResult,
  type HarnessProposalResult,
  type HarnessValidateResult,
} from '../src/platform-harness.js';
import { buildAuthorProposal, DESIGNER_AUTHOR_PRODUCER } from '../src/designer-author/proposal.js';
import { buildProposalPackage } from '../src/designer-author/proposal-package.js';
import { buildContext } from '../src/generate/context.js';
import { plan } from '../src/generate/plan.js';
import { authorDocument } from '../src/generate/author.js';
import { defaultScriptedAuthor } from '../src/generate/authoring-seam.js';
import { validate } from '../src/generate/validate.js';
import { readOverlay } from '../src/overlay.js';

describe('P02 — Platform Harness stage vocabulary (closed, fixed shape)', () => {
  it('HARNESS_STAGES is exactly the eight documented stages, in pipeline order', () => {
    expect(HARNESS_STAGES).toEqual([
      'input',
      'context',
      'generate',
      'validate',
      'review',
      'metrics',
      'report',
      'exit',
    ]);
  });

  it('HARNESS_STAGES is frozen — the vocabulary is closed, never a user-extensible DSL', () => {
    expect(Object.isFrozen(HARNESS_STAGES)).toBe(true);
  });

  it('PLATFORM_HARNESS_VERSION is a non-empty, stable identity string', () => {
    expect(typeof PLATFORM_HARNESS_VERSION).toBe('string');
    expect(PLATFORM_HARNESS_VERSION.length).toBeGreaterThan(0);
  });
});

describe('P02 — immutable Execution Context', () => {
  const input: HarnessInput = { client: 'example-brand', track: 'website', outDir: '/tmp/out' };

  it('createHarnessExecutionContext freezes the returned context and its input', () => {
    const ctx = createHarnessExecutionContext(input);
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.input)).toBe(true);
  });

  it('mutating a frozen context field has no effect (strict-mode immutability)', () => {
    const ctx = createHarnessExecutionContext(input);
    expect(() => {
      // @ts-expect-error — deliberately violating the readonly contract to prove runtime freeze
      ctx.input = { client: 'other', track: 'website', outDir: '/tmp/x' };
    }).toThrow();
  });

  it('stamps a valid ISO-8601 startedAt, mirroring score.ts\'s own generatedAt convention', () => {
    const ctx = createHarnessExecutionContext(input);
    expect(() => new Date(ctx.startedAt).toISOString()).not.toThrow();
    expect(new Date(ctx.startedAt).toISOString()).toBe(ctx.startedAt);
  });

  it('deterministic replay — two contexts built from the same input carry identical input data', () => {
    const a = createHarnessExecutionContext(input);
    const b = createHarnessExecutionContext(input);
    expect(a.input).toEqual(b.input);
    expect(a.input).toEqual(input);
  });

  it('does not mutate the caller\'s input object', () => {
    const original = { client: 'example-brand', track: 'website' as const, outDir: '/tmp/out' };
    const snapshot = { ...original };
    createHarnessExecutionContext(original);
    expect(original).toEqual(snapshot);
  });
});

describe('P02 — Execution Contract (HarnessStage<In, Out> is a usable, satisfiable contract)', () => {
  it('a trivial stage implementation type-checks and runs against the contract shape', async () => {
    const identityStage: HarnessStage<number, number> = async (_ctx, n) => n;
    const ctx = createHarnessExecutionContext({ client: 'example-brand', track: 'website', outDir: '/tmp/out' });
    await expect(identityStage(ctx, 42)).resolves.toBe(42);
  });

  it('a stage receives the SAME frozen context instance passed in — no cloning, no mutation seam', async () => {
    let seen: HarnessExecutionContext | undefined;
    const capture: HarnessStage<null, null> = async (ctx, input) => {
      seen = ctx;
      return input;
    };
    const ctx = createHarnessExecutionContext({ client: 'example-brand', track: 'collateral', outDir: '/tmp/out2' });
    await capture(ctx, null);
    expect(seen).toBe(ctx);
  });
});

describe('P02 — exit-status mapping (grounded verbatim in scripts/generate.ts\'s real exit paths)', () => {
  it('"skipped" (no project directory) maps to exit code 0 — generate.ts line ~104', () => {
    expect(exitCodeFor('skipped')).toBe(0);
  });

  it('"context-failed" (Stage 1 buildContext threw) maps to exit code 1 — generate.ts line ~686', () => {
    expect(exitCodeFor('context-failed')).toBe(1);
  });

  it('"completed" ALWAYS maps to exit code 0, regardless of the run\'s own headline status (LOUD-MARK) — generate.ts line ~763', () => {
    // generate.ts's final `process.exit(0)` is unconditional — a FAILED RunHeadline still exits 0.
    // The harness's exit-status model must not invent a stricter mapping than the engine's own.
    expect(exitCodeFor('completed')).toBe(0);
  });
});

describe('P02 — Transport integrity (HarnessRunResult composition)', () => {
  const input: HarnessInput = { client: 'example-brand', track: 'website', outDir: '/tmp/out' };
  const ctx = createHarnessExecutionContext(input);

  it('buildHarnessRunResult preserves every field passed in, unmutated', () => {
    const result = buildHarnessRunResult({
      context: ctx,
      outcome: 'completed',
      headlineStatus: 'success',
    });
    expect(result.context).toBe(ctx);
    expect(result.outcome).toBe('completed');
    expect(result.headlineStatus).toBe('success');
    expect(result.exitCode).toBe(0);
  });

  it('buildHarnessRunResult derives exitCode from outcome via the SAME exitCodeFor mapping — no second mapping table', () => {
    const skipped = buildHarnessRunResult({ context: ctx, outcome: 'skipped' });
    const failed = buildHarnessRunResult({ context: ctx, outcome: 'context-failed' });
    expect(skipped.exitCode).toBe(exitCodeFor('skipped'));
    expect(failed.exitCode).toBe(exitCodeFor('context-failed'));
  });

  it('omits headlineStatus when the outcome never reached a headline (skipped / context-failed)', () => {
    const result = buildHarnessRunResult({ context: ctx, outcome: 'skipped' });
    expect(result.headlineStatus).toBeUndefined();
  });

  it('the returned HarnessRunResult is frozen (immutable transport, matching the execution context)', () => {
    const result: HarnessRunResult = buildHarnessRunResult({ context: ctx, outcome: 'completed', headlineStatus: 'failed' });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('P10 — HarnessProposalResult (defined, unconsumed — mirrors HarnessReviewResult/Frozen exactly)', () => {
  it('a HarnessProposalResult can carry ProposalPackage objects verbatim, unmutated', () => {
    const proposal = buildAuthorProposal({
      kind: 'section',
      origin: { producer: DESIGNER_AUTHOR_PRODUCER, client: 'example-brand', track: 'website', authoredBy: 'designer:hill' },
      semanticFamily: 'family-hero',
      content: 'x',
    });
    const pkg = buildProposalPackage({ proposal });
    const result: HarnessProposalResult = { proposals: [pkg] };
    expect(result.proposals[0]).toBe(pkg);
    expect(result.proposals[0].proposal).toBe(proposal);
  });

  it('is a plain transport shape, not a class — no runtime export exists to construct one (type-only, like HarnessReviewResult)', () => {
    // If platform-harness.ts exported a builder function for HarnessProposalResult, that would
    // mean a stage implementation was wired — explicitly out of scope this sprint (STOP list).
    const src = readFileSync(fileURLToPath(new URL('../src/platform-harness.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/export function buildHarnessProposalResult/);
  });

  it('HARNESS_STAGES is unchanged by this addition — still the same eight stages, in the same order', () => {
    expect(HARNESS_STAGES).toEqual(['input', 'context', 'generate', 'validate', 'review', 'metrics', 'report', 'exit']);
  });
});

describe('P27 — HarnessValidateResult transport completeness (perRail)', () => {
  it('a real validate() perRail assigns into HarnessValidateResult without adaptation — the exact gap named since P04/P05, now closed', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p27-validate-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
      const validateResult = await validate(html, ctx, { outDir }, p);

      const transport: HarnessValidateResult = {
        score: validateResult.score,
        frozen: readOverlay(join(outDir, 'overlay')),
        perRail: validateResult.perRail,
      };

      // Carried verbatim — same array reference, zero recomputation, zero adaptation.
      expect(transport.perRail).toBe(validateResult.perRail);
      expect(transport.perRail.length).toBeGreaterThan(0);
      expect(transport.perRail[0].operator.name).toBe(validateResult.perRail[0].operator.name);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('the existing score/frozen fields are unchanged by the widening — same shapes P02 originally defined', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'offscript-p27-shape-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
      const validateResult = await validate(html, ctx, { outDir }, p);

      const transport: HarnessValidateResult = {
        score: validateResult.score,
        frozen: readOverlay(join(outDir, 'overlay')),
        perRail: validateResult.perRail,
      };

      expect(transport.score).toBe(validateResult.score);
      expect(transport.score.subject).toBeDefined();
      expect(Array.isArray(transport.frozen)).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('deterministic replay — two independent validate() calls over the same input carry identical perRail rail names', async () => {
    const outDirA = mkdtempSync(join(tmpdir(), 'offscript-p27-replay-a-'));
    const outDirB = mkdtempSync(join(tmpdir(), 'offscript-p27-replay-b-'));
    try {
      const ctx = buildContext('example-brand', 'collateral');
      const p = plan(ctx);
      const { html } = await authorDocument(p, ctx, defaultScriptedAuthor());
      const resultA = await validate(html, ctx, { outDir: outDirA }, p);
      const resultB = await validate(html, ctx, { outDir: outDirB }, p);

      const transportA: HarnessValidateResult = { score: resultA.score, frozen: [], perRail: resultA.perRail };
      const transportB: HarnessValidateResult = { score: resultB.score, frozen: [], perRail: resultB.perRail };

      expect(transportA.perRail.map((r) => r.operator.name)).toEqual(
        transportB.perRail.map((r) => r.operator.name),
      );
    } finally {
      rmSync(outDirA, { recursive: true, force: true });
      rmSync(outDirB, { recursive: true, force: true });
    }
  }, 30_000);

  it('backwards compatible — zero production file constructs a HarnessValidateResult today, so a required-field widening breaks no existing call site', () => {
    const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url));
    const SCRIPTS_ROOT = fileURLToPath(new URL('../scripts', import.meta.url));
    function collectTsFiles(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...collectTsFiles(full));
        else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
      }
      return out;
    }
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter(
      (f) => !f.replace(/\\/g, '/').endsWith('/src/platform-harness.ts'),
    );
    const constructors = candidates.filter((f) => /HarnessValidateResult/.test(readFileSync(f, 'utf8')));
    expect(constructors).toEqual([]);
  });

  it("PLATFORM_HARNESS_VERSION is unchanged — this is a pure transport widening, not a stage/vocabulary change; bumping it would leak into review-package.json's persisted metadata.platformHarnessVersion and break P08's byte-identical Review Package guarantee for zero functional gain, since HarnessValidateResult has zero production producers", () => {
    expect(PLATFORM_HARNESS_VERSION).toBe('p03-platform-harness@2');
  });

  it('HARNESS_STAGES is unchanged by this widening — still the same eight stages, in the same order', () => {
    expect(HARNESS_STAGES).toEqual(['input', 'context', 'generate', 'validate', 'review', 'metrics', 'report', 'exit']);
  });
});

describe('P03 — Harness stage sequencer (the one genuine gap Consumption required — a runner for the Foundation contract)', () => {
  it('records stages and exposes them, in order, via .order', () => {
    const seq = createHarnessStageSequencer();
    seq.record('input');
    seq.record('context');
    seq.record('generate');
    expect(seq.order).toEqual(['input', 'context', 'generate']);
  });

  it('starts with an empty, frozen .order', () => {
    const seq = createHarnessStageSequencer();
    expect(seq.order).toEqual([]);
    expect(Object.isFrozen(seq.order)).toBe(true);
  });

  it('allows skipping a stage (e.g. "review" — generate.ts has no human-review step today)', () => {
    const seq = createHarnessStageSequencer();
    seq.record('validate');
    seq.record('metrics'); // 'review' skipped — still valid, HARNESS_STAGES index only increases
    expect(seq.order).toEqual(['validate', 'metrics']);
  });

  it('throws on a regression (recording an earlier stage after a later one)', () => {
    const seq = createHarnessStageSequencer();
    seq.record('validate');
    expect(() => seq.record('context')).toThrow(/stage-order violation/i);
  });

  it('throws on recording the same stage twice in a row', () => {
    const seq = createHarnessStageSequencer();
    seq.record('generate');
    expect(() => seq.record('generate')).toThrow(/stage-order violation/i);
  });

  it('a full, real run records all eight stages in exact HARNESS_STAGES order', () => {
    const seq = createHarnessStageSequencer();
    for (const stage of HARNESS_STAGES) seq.record(stage);
    expect(seq.order).toEqual(HARNESS_STAGES);
  });
});

describe('P03 — Foundation consumption is exactly the expected surface (was "zero consumers" at P02; now a whitelist)', () => {
  const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
  const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url));
  const SCRIPTS_ROOT = fileURLToPath(new URL('../scripts', import.meta.url));

  // The ONLY files P03 wires to import platform-harness.js. Any OTHER importer is either an
  // undocumented expansion of the harness-consuming surface (update this list deliberately) or a
  // genuine regression (e.g. a second, competing orchestration path). Either way, a failure here
  // demands a conscious decision, not a silent pass — this is the falsification half of "harness
  // invocation": if scripts/generate.ts stopped importing the harness, this test would catch it.
  const EXPECTED_CONSUMERS = [
    'scripts/generate.ts',
    'src/generate/validate-loop-driver.ts',
    'src/doctor/review-package.ts',
  ];

  function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...collectTsFiles(full));
      } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  it('the harness importer set is exactly EXPECTED_CONSUMERS — no more, no fewer', () => {
    const candidates = [...collectTsFiles(SRC_ROOT), ...collectTsFiles(SCRIPTS_ROOT)].filter(
      (f) => !f.replace(/\\/g, '/').endsWith('/src/platform-harness.ts'),
    );
    const actualConsumers: string[] = [];
    for (const file of candidates) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"](?:\.\.\/)+(?:src\/)?platform-harness\.js['"]/.test(text)) {
        actualConsumers.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(actualConsumers.sort()).toEqual([...EXPECTED_CONSUMERS].sort());
  });

  it('scripts/generate.ts no longer contains a bare, harness-independent process.exit(0|1) literal', () => {
    const generateTs = readFileSync(
      fileURLToPath(new URL('../scripts/generate.ts', import.meta.url)),
      'utf8',
    );
    // Falsification test: every exit call must be derived from a HarnessRunResult's exitCode
    // (buildHarnessRunResult(...).exitCode), not a raw literal. If someone reverts to the old
    // ad hoc orchestration, this regex finds the reintroduced bare literal and fails loudly.
    const bareExitLiterals = generateTs.match(/process\.exit\(\s*[01]\s*\)/g) ?? [];
    expect(bareExitLiterals).toEqual([]);
    const harnessDerivedExits = generateTs.match(/process\.exit\([\s\S]*?\.exitCode\)/g) ?? [];
    // skipped · context-failed · completed · G1-S4 readiness-invalid fail-closed · G1-S4
    // readiness-not-admitted fail-closed. The last two are the native-entry guard: a present-but-invalid
    // or not-admitting persisted readiness fails closed via the SAME harness exit-status mapping
    // (context-failed), never a bare literal. (The former authorization-rejection exit was removed with
    // the Trust Model v2 publication gate — the engine no longer rejects a valid Brief on governance.)
    expect(harnessDerivedExits.length).toBe(5);
  });
});

// Type-only compile-time check: HarnessStageName must cover exactly HARNESS_STAGES' runtime
// values (kept in the test file, not production code, per "no new engine behaviour").
const _stageNameExhaustiveness: HarnessStageName[] = [...HARNESS_STAGES];
void _stageNameExhaustiveness;
