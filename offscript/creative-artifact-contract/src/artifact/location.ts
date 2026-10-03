/**
 * Portability check for CreativeArtifact.location. Judgment-heavy (several
 * distinct rejected shapes), so — matching how this repository's other
 * contracts put judgment-heavy checks (e.g. Creative Intent's approval
 * precondition) in code rather than in the JSON Schema — this lives here,
 * not as a single schema `pattern`.
 *
 * Accepted: a project-relative path (no drive letter, no UNC prefix, no
 * leading '/', no '..' traversal segment), or a content-addressed
 * `content://sha256:<hex>` URI.
 */
const DRIVE_LETTER = /^[A-Za-z]:[\\/]/;
const UNC_PREFIX = /^\\\\/;
const ABSOLUTE_POSIX = /^\//;
const TRAVERSAL_SEGMENT = /(^|[\\/])\.\.([\\/]|$)/;
const CONTENT_URI = /^content:\/\/sha256:[0-9a-f]{64}$/;

export function isPortableLocation(location: string): boolean {
  return describeLocationRejection(location) === null;
}

/** Returns null when `location` is acceptable, otherwise a human-readable reason. */
export function describeLocationRejection(location: string): string | null {
  if (typeof location !== 'string' || location.length === 0) {
    return 'location must be a non-empty string';
  }
  if (CONTENT_URI.test(location)) return null;
  if (DRIVE_LETTER.test(location)) {
    return `location "${location}" is an absolute Windows path (drive letter) — use a project-relative path or a content:// reference`;
  }
  if (UNC_PREFIX.test(location)) {
    return `location "${location}" is a UNC path — use a project-relative path or a content:// reference`;
  }
  if (ABSOLUTE_POSIX.test(location)) {
    return `location "${location}" is an absolute path — use a project-relative path or a content:// reference`;
  }
  if (TRAVERSAL_SEGMENT.test(location)) {
    return `location "${location}" contains a ".." path-traversal segment — not allowed`;
  }
  return null;
}
