/**
 * PKG — Repository Builder: fail-loud findings.
 *
 * Validation-class failures are accumulated (per stage) and raised together as a
 * KnowledgeValidationError, so no partial publication ever occurs while still
 * surfacing every problem deterministically. Structural failures (cycle,
 * publication) throw their own errors at their stage.
 */

export interface Finding {
  readonly stage: string;
  readonly code: string;
  readonly location: string;
  readonly message: string;
}

export class KnowledgeError extends Error {}

/** Aggregate of one or more validation findings; halts before publication. */
export class KnowledgeValidationError extends KnowledgeError {
  readonly findings: readonly Finding[];
  constructor(findings: readonly Finding[]) {
    const sorted = [...findings].sort(compareFinding);
    const body = sorted.map(renderFinding).join('\n');
    super(`${sorted.length} validation finding(s); build aborted:\n${body}`);
    this.name = 'KnowledgeValidationError';
    this.findings = sorted;
  }
}

export class GraphCycleError extends KnowledgeError {
  constructor(public readonly cycle: readonly string[]) {
    super(`dependency cycle: ${cycle.join(' -> ')}`);
    this.name = 'GraphCycleError';
  }
}

export class PublicationError extends KnowledgeError {}

export function renderFinding(f: Finding): string {
  return `[${f.stage}:${f.code}] ${f.location}: ${f.message}`;
}

export function compareFinding(a: Finding, b: Finding): number {
  return (
    a.stage.localeCompare(b.stage) ||
    a.code.localeCompare(b.code) ||
    a.location.localeCompare(b.location) ||
    a.message.localeCompare(b.message)
  );
}
