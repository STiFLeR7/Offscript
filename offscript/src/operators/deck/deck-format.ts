/**
 * Deck format constants — the 16:9 pitch-deck geometry the deck rails check
 * against.
 *
 * Source of truth: `.claude/lib/pitch-deck-formats.json` (`formats.pitch-deck`).
 * Copied here rather than read at runtime so the engine stays self-contained in
 * the portable export, where `.claude/lib/` is absent. Keep in sync with that
 * file if the canvas / floor / count range ever change.
 */

/** The fixed slide canvas (size_px). */
export const DECK_SLIDE = { width: 1920, height: 1080 } as const;

/** Minimum rendered body-text size (px) at the 1920-wide canvas (min_text_px). */
export const DECK_MIN_TEXT_PX = 20;

/** Sane slide-count range (units.min / units.max). */
export const DECK_SLIDE_MIN = 8;
export const DECK_SLIDE_MAX = 15;

/** The slide container selector. */
export const SLIDE_SELECTOR = '.slide';

/**
 * Graphic-content regions whose text is exempt from the body-text floor —
 * chart axes/legends/callouts, device-mockup internals, SVG <text>, and
 * anything explicitly flagged. Mirrors pitch-deck-formats.json min_text_px_note.
 */
export const GRAPHIC_EXEMPT_SELECTOR =
  'svg,.chart,.chart-card,.data-viz,.device,.device-frame,.mockup,.cr-graphic,[data-graphic]';
