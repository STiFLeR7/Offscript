import type { Track } from './paths.js';

/**
 * Resolve which deliverable track an invocation targets.
 *
 * Precedence: an explicit `--track <t>` flag wins → else a collateral marker
 * (`class="cr-doc"`) → else a deck-bundle marker → else `website` (default).
 *
 * Single resolver shared by the scripts and the /offscript dispatcher so track
 * detection never diverges between the two entry points.
 */
export function resolveTrack(args: string[], artifactSource = ''): Track {
  const i = args.indexOf('--track');
  if (i >= 0) {
    const t = args[i + 1];
    if (t === 'website' || t === 'collateral' || t === 'deck') return t;
  }
  if (/class=["'][^"']*\bcr-doc\b/.test(artifactSource)) return 'collateral';
  if (/data-deck|class=["'][^"']*\bslide-deck\b|--deck-frame/.test(artifactSource)) return 'deck';
  return 'website';
}
