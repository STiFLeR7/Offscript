/**
 * Shared brief/brand fixture helpers for plan() and generate-engine tests.
 *
 * Both test/plan.test.ts and test/generate/brief-plan-matching.test.ts scaffold a
 * throwaway fixture client (its own colors_and_type.css + brief.md) and tear it down
 * afterEach. The helpers were duplicated near-identically in both files; this module
 * is the single source of truth.
 *
 * `makeBriefFixture(client)` returns helpers BOUND to one fixture-client id, so each
 * test file keeps its own `FIXTURE_CLIENT` and its call sites stay positional and
 * byte-identical (no `client` threaded through every call). Behaviour is preserved
 * exactly: same CSS, same frontmatter, same default body.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectReferencesDir } from '../../src/paths.js';

/** Minimal valid CSS for a fixture brand dir. */
export function minimalCss(): string {
  return `:root {
  --cr-bg: #ffffff;
  --cr-fg: #1a1a2e;
  --cr-accent: #2563eb;
  --cr-font-display: "Inter", sans-serif;
}`;
}

/** Fixture helpers bound to a single fixture-client id. */
export interface BriefFixture {
  /** Scaffold the fixture client's references dir + colors_and_type.css. */
  scaffoldClient(client?: string): void;
  /** Write a brief.md (frontmatter + body) for the bound fixture client. */
  writeBrief(
    mustInclude: string[],
    track?: 'website' | 'collateral',
    body?: string,
  ): void;
  /** Write a brief.md with an explicit free-form body (body required). */
  writeBriefWithBody(
    mustInclude: string[],
    body: string,
    track?: 'website' | 'collateral',
  ): void;
}

/**
 * Build the brief/brand fixture helpers bound to one fixture-client id.
 * The returned helpers mirror the private copies the two test files used.
 */
export function makeBriefFixture(fixtureClient: string): BriefFixture {
  /** Scaffold a fixture client with its own colors_and_type.css. */
  function scaffoldClient(client: string = fixtureClient): void {
    const refsDir = projectReferencesDir(client);
    mkdirSync(refsDir, { recursive: true });
    writeFileSync(join(refsDir, 'colors_and_type.css'), minimalCss(), 'utf8');
  }

  /** Write a brief.md with given must-include entries to the bound fixture client. */
  function writeBrief(
    mustInclude: string[],
    track: 'website' | 'collateral' = 'website',
    body = 'Brief body.',
  ): void {
    const lines = [
      '---',
      'schemaVersion: 1',
      `track: ${track}`,
      'one-liner: "Test deliverable"',
      'audience: "Developers"',
      'goals:',
      '  - Drive signups',
      'must-include:',
      ...mustInclude.map((m) => `  - "${m}"`),
      '---',
      body,
    ];
    writeFileSync(
      join(projectReferencesDir(fixtureClient), 'brief.md'),
      lines.join('\n'),
      'utf8',
    );
  }

  /** Write a brief.md with given must-include entries AND a free-form body. */
  function writeBriefWithBody(
    mustInclude: string[],
    body: string,
    track: 'website' | 'collateral' = 'website',
  ): void {
    writeBrief(mustInclude, track, body);
  }

  return { scaffoldClient, writeBrief, writeBriefWithBody };
}
