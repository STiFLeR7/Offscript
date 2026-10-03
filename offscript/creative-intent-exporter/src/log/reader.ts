/**
 * Reads Output/_LOG.md and returns only the actual dated log-line rows —
 * never the header prose (title, format note, v4/v5/v6 history paragraphs).
 * Read-only: this module never writes to _LOG.md.
 */
import { readFileSync } from 'node:fs';

const LOG_LINE_PATTERN = /^\d{4}-\d{2}-\d{2} · /;

export function readLogLines(logPath: string): string[] {
  const text = readFileSync(logPath, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => LOG_LINE_PATTERN.test(line));
}
