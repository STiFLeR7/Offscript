/**
 * Parses one Output/_LOG.md line (Repo B — Creatives Generation) into its
 * date, slug, and field= tokens. Read-only: this module never writes back
 * to _LOG.md and never interprets a field's meaning — that is the
 * CreativeIntentBuilder's job.
 */

export interface ParsedLogLine {
  date: string;
  slug: string;
  /** field name -> raw value text (quotes/brackets NOT stripped) */
  raw: Map<string, string>;
}

const FIELD_DELIMITER = ' · ';

/**
 * Splits a log line on " · " but never inside a double-quoted span or a
 * [...] bracket — both can legitimately contain the delimiter character
 * inside prose (e.g. belief="fast · reliable · trusted search").
 */
function splitTopLevel(text: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === '[') {
      depth++;
      continue;
    }
    if (ch === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && text.startsWith(FIELD_DELIMITER, i)) {
      segments.push(text.slice(start, i));
      i += FIELD_DELIMITER.length - 1;
      start = i + 1;
    }
  }
  segments.push(text.slice(start));
  return segments;
}

export function parseLogLine(line: string): ParsedLogLine {
  const segments = splitTopLevel(line.trim());
  if (segments.length < 2) {
    throw new Error(`_LOG.md line has no date/slug segments: ${line}`);
  }

  const date = segments[0].trim();
  const slug = segments[1].trim();
  const raw = new Map<string, string>();

  for (const segment of segments.slice(2)) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue; // not a field= token (shouldn't happen post-slug, defensive only)
    const key = segment.slice(0, eq).trim();
    const value = segment.slice(eq + 1).trim();
    raw.set(key, value);
  }

  return { date, slug, raw };
}

/** Strips exactly one layer of surrounding double quotes. Throws if the value isn't quoted. */
export function unquote(value: string): string {
  if (value.length < 2 || value[0] !== '"' || value[value.length - 1] !== '"') {
    throw new Error(`Expected a double-quoted value, got: ${value}`);
  }
  return value.slice(1, -1);
}

/**
 * Parses a raw "[...]" field into an ordered string array. Items are
 * expected to be double-quoted (must-include's own format); order is
 * preserved as-authored, never sorted or deduped.
 */
export function parseArray(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed[0] !== '[' || trimmed[trimmed.length - 1] !== ']') {
    throw new Error(`Expected a bracketed array, got: ${value}`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (inner === '') return [];

  const items: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of inner) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      items.push(unquote(current.trim()));
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim() !== '') items.push(unquote(current.trim()));
  return items;
}
