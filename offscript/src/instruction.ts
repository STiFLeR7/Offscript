import type { PassSpec } from './actuation.js';
import type { Finding, BrandContract } from './operator.js';
import type { TokenModel } from './tokens.js';
import { tryLoadReference } from './references.js';
import { resolvePlaybookAnchors, loadPlaybook, playbookAvailable, type Playbook } from './playbook.js';

/**
 * Compose the deterministic instruction handed to a subagent actuator on
 * every judgment pass.
 *
 * Pure function — same inputs ⇒ byte-exact same output. Sections are joined
 * in a fixed order with `=====` delimiters; optional sections are omitted
 * (never left blank) so a reviewer can tell at a glance what's present.
 *
 * Spec: docs/superpowers/plans/2026-05-28-offscript-actuator-instruction-composition.md
 */

export interface ComposeContext {
  /** brand subject — e.g., 'example-brand'. Substituted into the standing brief. */
  brand: string;
  /** artifact type — e.g., 'website'. Substituted into the standing brief. */
  artifactType: string;
  /** verbatim contents of `<kitDir>/creative-direction.md` if present (from intake). */
  creativeDirection?: string;
  /** the brand contract (slot → kit-token aliases); rendered as a table. */
  brandContract?: BrandContract;
  /**
   * The kit tokens — used to resolve a slot's `var(--token)` to a literal value
   * for the brand-contract table's right column (e.g. `→ #149dff`).
   */
  tokens?: TokenModel;
  /**
   * Names of `references/<name>.md` files to embed as rail-finding bounds.
   * Existing passes pass `['color-expansion','theme-orchestration']` etc.
   */
  railBounds?: string[];
  /** rail violations this dispatch is asked to clear. */
  findings: Finding[];
  /** injectable playbook for tests; defaults to the canonical cached parse. */
  playbook?: Playbook;
}

export interface ComposePaths {
  /** path to the immutable reference render the subagent treats as ground truth. */
  reference: string;
  /** path to the index.html the subagent will edit. */
  index: string;
  /** path to the brand token CSS. */
  tokens: string;
}

const STANDING_BRIEF = (brand: string, artifactType: string, passName: string): string =>
  [
    `You are the Offscript ${passName} actuator for the ${brand} ${artifactType}. You are`,
    'being dispatched by the gate-loop orchestrator (vision §4.1 — "subagent per',
    'pass"). Your job is to edit ONE HTML file to clear ONE rail\'s findings while',
    'staying visually faithful to an immutable reference. You are NOT redesigning,',
    'NOT restructuring, NOT cleaning up. Better, not different.',
    '',
    'The brief — non-negotiable:',
    '- Edit only the indicated index.html.',
    '- Treat reference.html as the immutable design ground truth.',
    '- Fix only the listed findings. No "while I\'m here" cleanups.',
    '- Every replacement value MUST be a brand token (a var() from the Brand',
    '  Contract / kit tokens). Read the token map first.',
    '- The creative direction and the playbook excerpts are your BOUNDS, not your',
    '  goals. They cannot loosen the rail. They CAN choose between rail-clearing',
    '  options.',
    '- Surface ambiguity by flagging — never invent.',
  ].join('\n');

function renderBrandContractBlock(c: BrandContract | undefined, tokens: TokenModel | undefined): string {
  if (!c) return '(no Brand Contract on file for this kit — slot-aware rails will warn.)';
  const slotKeys = Object.keys(c.slots).sort();
  const rows: string[] = ['Slot              Active token'];
  for (const slot of slotKeys) {
    const mapping = c.slots[slot];
    if (mapping === null) {
      rows.push(`${slot.padEnd(18)}UNMAPPED — derive at page level if needed`);
      continue;
    }
    const value = tokens?.customProps.get(mapping.token);
    const right = value ? `var(${mapping.token}) → ${value}` : `var(${mapping.token})`;
    rows.push(`${slot.padEnd(18)}${right}`);
  }
  return rows.join('\n');
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function composeInstruction(
  pass: PassSpec,
  ctx: ComposeContext,
  paths: ComposePaths,
): string {
  const sections: string[] = [];

  sections.push(STANDING_BRIEF(ctx.brand, ctx.artifactType, pass.name));

  if (ctx.creativeDirection !== undefined) {
    sections.push(`===== creative-direction.md =====\n${ctx.creativeDirection.replace(/\s+$/, '')}`);
  }

  sections.push(
    `===== brand contract (active slot map) =====\n${renderBrandContractBlock(ctx.brandContract, ctx.tokens)}`,
  );

  const anchors = pass.playbookAnchors ?? [];
  let excerpts: string;
  if (anchors.length === 0) {
    excerpts = '(none)';
  } else {
    // An injected playbook (tests) wins; otherwise read the canonical file only
    // when it's on disk. Post-website-pivot the section-intelligence playbook is
    // absent from the author-from-governance layout, so degrade to a note naming
    // the requested anchors rather than throwing ENOENT (harden-path #46). A
    // present-but-incomplete playbook still throws loudly via resolvePlaybookAnchors.
    const playbook = ctx.playbook ?? (playbookAvailable() ? loadPlaybook() : undefined);
    excerpts = playbook
      ? resolvePlaybookAnchors(anchors, playbook)
      : `(playbook unavailable — section-intelligence governance not on disk for this track; anchors requested: ${anchors.join(', ')})`;
  }
  sections.push(`===== playbook excerpts =====\n${excerpts}`);

  if (ctx.railBounds && ctx.railBounds.length > 0) {
    // Degrade per-doc: a guardrail .md removed in the website pivot (e.g.
    // color-expansion / theme-orchestration / anti-slop-checklist) is named as
    // absent instead of crashing the harden path at module-load bake time.
    const bounds = ctx.railBounds
      .map((name) => {
        const doc = tryLoadReference(name);
        return `--- ${name}.md ---\n${doc ?? `(rail-finding bounds doc "${name}.md" not on disk for this track)`}`;
      })
      .join('\n');
    sections.push(`===== rail-finding bounds =====\n${bounds}`);
  }

  sections.push(
    [
      '===== reference and tokens =====',
      `reference.html: ${paths.reference}`,
      `index.html:     ${paths.index}`,
      `tokens.css:     ${paths.tokens}`,
    ].join('\n'),
  );

  const sortedFindings = sortFindings(ctx.findings);
  sections.push(
    [
      '===== this pass =====',
      `pass:   ${pass.name}`,
      `rails:  ${pass.rails.map((r) => r.name).join(', ')}`,
      'findings (rail violations to resolve):',
      JSON.stringify(sortedFindings, null, 2),
    ].join('\n'),
  );

  return sections.join('\n\n');
}
