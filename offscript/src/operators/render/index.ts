/**
 * Render-aware operator sub-registry (M2 — Track A Task 3).
 *
 * Track A's render rails (render-shorthand-sanity, render-overflow-bounds,
 * render-visibility-floor, kit-vs-live) export here. Track B's
 * `src/operators/index.ts` imports this array and spreads it into
 * `defaultRegistry()` — that's the single touchpoint where the two tracks
 * compose.
 *
 * Rails added as they ship (Tasks 4–8). The empty-at-handoff invariant lets
 * Track B's registry edit land non-collisionally regardless of which render
 * rails are still in flight on Track A.
 */
import type { Operator } from '../../operator.js';
import { renderShorthandSanity } from './render-shorthand-sanity.js';
import { renderOverflowBounds } from './render-overflow-bounds.js';
import { renderVisibilityFloor } from './render-visibility-floor.js';
import { kitVsLive } from './kit-vs-live.js';
import { websiteFillFocal } from './website-fill-focal.js';

/**
 * Ordered list of render-aware operators. Document order matches
 * `defaultRegistry()` convention: tier-0 globals first, tier-1 semantic
 * categories next, tier-2 escalation last.
 *
 * Track A appends entries as render rails ship; Track B never edits this file.
 */
export const renderOperators: ReadonlyArray<Operator> = [
  kitVsLive, // Task 8 — tier 0 (warn-only, off unless live HTML supplied)
  renderShorthandSanity, // Task 4 — tier 1
  renderOverflowBounds, // Task 5 — tier 1
  renderVisibilityFloor, // Task 6 — tier 1 (warn-only)
  websiteFillFocal, // §9-B4 — tier 1 (escalating; website-only; gated OFFSCRIPT_PLAYWRIGHT=1)
];
