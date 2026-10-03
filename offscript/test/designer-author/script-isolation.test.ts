/**
 * P32/P33/P34 — Designer Author Script: cross-script isolation falsification.
 *
 * Proves the two scripts stay structurally decoupled in BOTH directions, per P30 §4 /
 * P31 §7: scripts/designer-author.ts never imports from src/generate/* or
 * platform-harness.ts, and scripts/generate.ts never references designer-author at all.
 *
 * P33 UPDATE: the script now DOES generate proposals — but only by importing the single
 * sanctioned orchestrator (run-propose.ts), never by importing proposal-generator.ts /
 * proposal-package.ts / proposal.ts directly. The "generates no proposal" assertion from
 * P32 is replaced with "generates a proposal only through run-propose.ts" — the isolation
 * guarantee this sprint actually needs (orchestrate-only, never re-implement).
 *
 * P34 UPDATE: the script now DOES review proposals — but only by importing the single
 * sanctioned orchestrator (run-review.ts), never proposal-review.ts / proposal-io.ts directly,
 * and never any overlay-lifecycle module (proposal-overlay.ts / overlay-approval.ts /
 * overlay-materialization.ts / overlay-activation.ts remain entirely unimported).
 *
 * P35 UPDATE: the script now DOES translate overlay candidates — but only by importing the
 * single sanctioned orchestrator (run-overlay.ts), never proposal-overlay.ts /
 * proposal-overlay-package.ts / proposal-overlay-io.ts / overlay.ts directly, and never any
 * approval/materialization/activation module (overlay-approval.ts / overlay-materialization.ts /
 * overlay-activation.ts remain entirely unimported).
 *
 * P36 UPDATE: the script now DOES record overlay approvals — but only by importing the single
 * sanctioned orchestrator (run-approve.ts), never overlay-approval.ts /
 * overlay-approval-package.ts / overlay-approval-io.ts directly, and never any
 * materialization/activation module (overlay-materialization.ts / overlay-activation.ts remain
 * entirely unimported).
 *
 * P37 UPDATE: the script now DOES materialize overlays — but only by importing the single
 * sanctioned orchestrator (run-materialize.ts), never overlay-materialization.ts /
 * overlay-materialization-package.ts / overlay-materialization-io.ts directly, and never any
 * activation module (overlay-activation.ts remains entirely unimported). Still never imports
 * overlay.ts — no Frozen overlay write, no overlay/ mutation.
 *
 * P38 UPDATE: the script now DOES activate (and revoke) overlays — but only by importing the
 * single sanctioned orchestrator (run-activate.ts), never overlay-activation.ts /
 * overlay-activation-package.ts / overlay-activation-io.ts directly. Still never imports
 * overlay.ts — no Frozen overlay write, no overlay/ mutation, no runtime consumption.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('scripts/designer-author.ts isolation', () => {
  const source = readSource('../../scripts/designer-author.ts');

  it('never imports src/generate/* or platform-harness.ts', () => {
    expect(source).not.toMatch(/from ['"].*\/generate\//);
    expect(source).not.toMatch(/from ['"].*platform-harness/);
  });

  it('never writes directly — no fs write import; all writes delegate to run-propose.ts', () => {
    expect(source).not.toMatch(/writeFileSync|mkdirSync/);
  });

  it('generates a proposal ONLY through the sanctioned run-propose.ts orchestrator — never proposal-generator.ts/proposal-package.ts/proposal.ts directly, and never any overlay-lifecycle module', () => {
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).toMatch(/run-propose\.js/);
    expect(importLines).not.toMatch(/proposal-generator|proposal-package|proposal-overlay|overlay-approval|overlay-materialization|overlay-activation/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/src\/designer-author\/proposal\.js['"]/);
  });

  it('reviews a proposal ONLY through the sanctioned run-review.ts orchestrator — never proposal-review.ts/proposal-io.ts directly, and never any overlay-lifecycle module', () => {
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).toMatch(/run-review\.js/);
    expect(importLines).not.toMatch(/proposal-review\.js|proposal-io\.js/);
    expect(importLines).not.toMatch(/proposal-overlay|overlay-approval|overlay-materialization|overlay-activation/);
  });

  it('translates an overlay candidate ONLY through the sanctioned run-overlay.ts orchestrator — never proposal-overlay*.ts/overlay.ts directly, and never approval/materialization/activation', () => {
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).toMatch(/run-overlay\.js/);
    expect(importLines).not.toMatch(/proposal-overlay(-package|-io)?\.js/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/src\/overlay\.js['"]/);
    expect(importLines).not.toMatch(/overlay-approval|overlay-materialization|overlay-activation/);
  });

  it('records an overlay approval ONLY through the sanctioned run-approve.ts orchestrator — never overlay-approval*.ts directly, and never materialization/activation', () => {
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).toMatch(/run-approve\.js/);
    expect(importLines).not.toMatch(/overlay-approval(-package|-io)?\.js/);
    expect(importLines).not.toMatch(/overlay-materialization|overlay-activation/);
  });

  it('materializes an overlay ONLY through the sanctioned run-materialize.ts orchestrator — never overlay-materialization*.ts directly, never overlay.ts, and never activation', () => {
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).toMatch(/run-materialize\.js/);
    expect(importLines).not.toMatch(/overlay-materialization(-package|-io)?\.js/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/src\/overlay\.js['"]/);
    expect(importLines).not.toMatch(/overlay-activation/);
  });

  it('activates (and revokes) an overlay ONLY through the sanctioned run-activate.ts orchestrator — never overlay-activation*.ts directly, and never overlay.ts', () => {
    const importLines = source
      .split('\n')
      .filter((line) => /^import /.test(line.trim()))
      .join('\n');
    expect(importLines).toMatch(/run-activate\.js/);
    expect(importLines).not.toMatch(/overlay-activation(-package|-io)?\.js/);
    expect(importLines).not.toMatch(/from ['"]\.\.\/src\/overlay\.js['"]/);
  });

  it('dispatches no subagent — no request/response-file dispatch call', () => {
    expect(source).not.toMatch(/createSubagentAuthor|createSubagentActuator|\.request\.md|\.response\.html/);
  });
});

describe('scripts/generate.ts isolation from designer-author', () => {
  it('never references designer-author anywhere', () => {
    const source = readSource('../../scripts/generate.ts');
    expect(source).not.toMatch(/designer-author/);
  });
});
