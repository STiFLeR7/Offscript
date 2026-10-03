import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { engineRoot } from '../src/references.js';
import { createScriptedRevisionExecutor } from '../src/visual-proof-revision.js';
import {
  runCli,
  runCreativeGenerationCore,
  resultToExitCode,
  loadCreativeIntentInput,
  parseArgs,
  scriptedPassingJudgmentExecutor,
  type CliIO,
} from '../src/cli.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliSourcePath = resolve(here, '..', 'src', 'cli.ts');
const cliSource = readFileSync(cliSourcePath, 'utf8');

const CLIENT = '__cli-unit-test__';

const WIRE_INTENT = {
  id: 'cli-test-intent',
  contractVersion: 1,
  digest: 'sha256:' + 'a'.repeat(64),
  belief: 'a CLI-produced artifact round-trips through the real pipeline',
  feature: 'automation',
  ratio: '4:3',
  camera: 'product',
  'must-include': ['CLI proof'],
  'content-provenance': 'human',
};

const fixturesToClean: string[] = [];
function writeWireFixture(overrides: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'cg-cli-fixture-'));
  fixturesToClean.push(dir);
  const path = join(dir, 'fixture.creative-intent.json');
  writeFileSync(path, JSON.stringify({ ...WIRE_INTENT, ...overrides }, null, 2));
  return path;
}

/** Captures CLI output without relying on console spying (avoids depending on how a given
 * vitest/reporter setup wires the global console). Not a mock of production behavior — `runCli`'s
 * default `io` is real console; this is a plain injected sink, the same dependency-injection shape
 * the rest of this package already uses for its executor seams. */
interface CapturingIO extends CliIO {
  logCalls: string[];
  errorCalls: string[];
}
function makeCapturingIO(): CapturingIO {
  const logCalls: string[] = [];
  const errorCalls: string[] = [];
  return {
    logCalls,
    errorCalls,
    log: (line: string) => logCalls.push(line),
    error: (line: string) => errorCalls.push(line),
  };
}

afterEach(() => {
  while (fixturesToClean.length) rmSync(fixturesToClean.pop()!, { recursive: true, force: true });
  rmSync(join(engineRoot, 'projects', CLIENT), { recursive: true, force: true });
});

describe('cli - help', () => {
  it('--help prints usage and exits 0', async () => {
    const io = makeCapturingIO();
    const code = await runCli(['--help'], io);
    expect(code).toBe(0);
    const printed = io.logCalls.join('\n');
    expect(printed).toMatch(/usage/i);
    expect(printed).toContain('--creative-intent');
    expect(printed).toContain('--client');
  });
});

describe('cli - missing required input', () => {
  it('generate with no flags exits 2 and names the missing flags', async () => {
    const io = makeCapturingIO();
    const code = await runCli(['generate'], io);
    expect(code).toBe(2);
    const printed = io.errorCalls.join('\n');
    expect(printed).toContain('--creative-intent');
    expect(printed).toContain('--client');
  });
});

describe('cli - invalid input', () => {
  it('a creative-intent path that does not exist exits 2 with a clear message', async () => {
    const io = makeCapturingIO();
    const code = await runCli(
      ['generate', '--creative-intent', join(tmpdir(), 'does-not-exist.creative-intent.json'), '--client', CLIENT],
      io,
    );
    expect(code).toBe(2);
    expect(io.errorCalls.join('\n')).toMatch(/does-not-exist\.creative-intent\.json/);
  });

  it('malformed JSON in the creative-intent file exits 2 with a clear message', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-cli-fixture-'));
    fixturesToClean.push(dir);
    const path = join(dir, 'bad.creative-intent.json');
    writeFileSync(path, '{ not valid json');
    const io = makeCapturingIO();
    const code = await runCli(['generate', '--creative-intent', path, '--client', CLIENT], io);
    expect(code).toBe(2);
    expect(io.errorCalls.join('\n')).toMatch(/json/i);
  });

  it('loadCreativeIntentInput maps the wire (kebab-case) shape to CreativeIntentInput', () => {
    const path = writeWireFixture();
    const intent = loadCreativeIntentInput(path);
    expect(intent.id).toBe('cli-test-intent');
    expect(intent.mustInclude).toEqual(['CLI proof']);
    expect(intent.contentProvenance).toBe('human');
  });
});

describe('cli - valid input (real orchestration path reached)', () => {
  it('a well-formed real CreativeIntent produces a real artifact and exits 0', async () => {
    const path = writeWireFixture();
    const io = makeCapturingIO();
    const code = await runCli(['generate', '--creative-intent', path, '--client', CLIENT], io);
    expect(code).toBe(0);

    const artifactPath = join(engineRoot, 'projects', CLIENT, 'creative-assets', 'cli-test-intent', 'artifact.json');
    expect(existsSync(artifactPath)).toBe(true);
  });
});

describe('cli - artifact created + approval pending (via the core function, real production executors)', () => {
  it('a passing scripted judgment produces a real, digest-verified artifact with approval.status pending', async () => {
    const intent = loadCreativeIntentInput(writeWireFixture({ id: 'core-pass-test' }));
    const result = await runCreativeGenerationCore({
      intent,
      client: CLIENT,
      judgmentExecutor: scriptedPassingJudgmentExecutor({ q1: true, q2: true, q3: true, q4: true, q5: true, q6: true }),
      revisionExecutor: createScriptedRevisionExecutor({
        outcome: 'unavailable',
        reason: 'never called - scripted judgment always passes',
      }),
      createdAt: '2026-08-20T00:00:00.000Z',
    });

    expect(result.result.status).toBe('PASSED');
    expect(result.artifactDir).toBeDefined();

    const artifact = JSON.parse(readFileSync(join(result.artifactDir!, 'artifact.json'), 'utf8'));
    expect(artifact.approval.status).toBe('pending');
    expect(artifact.artifactDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('cli - failure propagates non-zero', () => {
  it('resultToExitCode maps PASSED to 0 and every other real terminal status to 1', () => {
    const common = {
      attempts: [],
      finalRequest: { belief: 'x', feature: 'automation', mustInclude: [] },
      finalJudgment: { outcome: 'unavailable' as const, reason: 'x' },
    };
    expect(
      resultToExitCode({ ...common, status: 'PASSED', artifact: {} as any, html: '', componentsFullyReflectedInRender: true }),
    ).toBe(0);
    for (const status of [
      'FAILED_RETRY_EXHAUSTED',
      'UNAVAILABLE_JUDGMENT',
      'UNAVAILABLE_REVISION',
      'UNAVAILABLE_AUTHORING',
      'NO_PROGRESS',
    ] as const) {
      expect(resultToExitCode({ ...common, status })).toBe(1);
    }
  });

  it('a real failing pipeline run (real orchestration, deterministic scripted failure) reports a non-PASSED status and writes no artifact', async () => {
    const intent = loadCreativeIntentInput(writeWireFixture({ id: 'core-fail-test' }));
    const result = await runCreativeGenerationCore({
      intent,
      client: CLIENT,
      judgmentExecutor: scriptedPassingJudgmentExecutor({ q1: false, q2: false, q3: false, q4: false, q5: false, q6: false }),
      revisionExecutor: createScriptedRevisionExecutor({
        outcome: 'unavailable',
        reason: 'test: forcing a real UNAVAILABLE_REVISION terminal status',
      }),
      createdAt: '2026-08-20T00:00:00.000Z',
    });

    expect(result.result.status).toBe('UNAVAILABLE_REVISION');
    expect(result.artifactDir).toBeUndefined();
    expect(resultToExitCode(result.result)).toBe(1);
  });
});

describe('cli - no duplicate orchestration implementation', () => {
  it('cli.ts imports the real runRethinkLoop and never defines its own retry loop', () => {
    expect(cliSource).toMatch(/from ['"]\.\/visual-proof-rethink-loop\.js['"]/);
    expect(cliSource).toMatch(/runRethinkLoop/);
    expect(cliSource).not.toMatch(/while\s*\(\s*true\s*\)/);
  });

  it('cli.ts imports writeCreativeArtifact rather than re-implementing artifact persistence', () => {
    expect(cliSource).toMatch(/from ['"]\.\/write-artifact\.js['"]/);
  });
});

describe('cli - no experiment-script dependency', () => {
  it('cli.ts never imports from a throwaway _sprint*.ts experiment script', () => {
    expect(cliSource).not.toMatch(/from ['"].*_sprint\d/i);
    expect(cliSource).not.toMatch(/from ['"].*scripts\/_/);
  });
});

describe('parseArgs', () => {
  it('parses --creative-intent, --client, --dispatch-dir, and --max-attempts', () => {
    const parsed = parseArgs([
      'generate',
      '--creative-intent',
      '/a/b.json',
      '--client',
      'acme',
      '--dispatch-dir',
      '/tmp/d',
      '--max-attempts',
      '3',
    ]);
    expect(parsed).toMatchObject({ creativeIntentPath: '/a/b.json', client: 'acme', dispatchDir: '/tmp/d', maxAttempts: 3 });
  });

  it('recognizes --help/-h regardless of other flags', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
    expect(parseArgs(['generate']).help).toBe(false);
  });
});

describe('cli - dispatch mode writes a real prompt and reports pending', () => {
  it('with --dispatch-dir set and no response file yet, the run reports pending (exit 3) and writes a real judgment prompt file', async () => {
    const intentPath = writeWireFixture({ id: 'core-dispatch-test' });
    const dispatchDir = mkdtempSync(join(tmpdir(), 'cg-cli-dispatch-'));
    fixturesToClean.push(dispatchDir);

    const io = makeCapturingIO();
    const code = await runCli(
      ['generate', '--creative-intent', intentPath, '--client', CLIENT, '--dispatch-dir', dispatchDir],
      io,
    );

    expect(code).toBe(3);
    const written = readdirSync(dispatchDir);
    expect(written.some((f) => f.includes('judge') && f.endsWith('.prompt.md'))).toBe(true);
  });
});
