/**
 * R2 — Review Analysis: a pure, deterministic, structural summarizer over a `ReviewSession` (R1).
 * No I/O, no persistence, no AI, no intent inference, no text classification — only counting and
 * sorting fields `ReviewNote` already carries. Never persisted (STOP/PERSISTENCE: "derived, never
 * persisted, always reproducible") — `analyzeReviewSession` is a pure function of its input.
 *
 * Ownership (`docs/review/R2-REVIEW-ANALYSIS.md` §2 for the full grounding):
 *   1. Current Review lifecycle (R1, unchanged): a note starts `OPEN`, transitions to `RESOLVED`
 *      or `DISMISSED`; a session is a flat, append-only list of notes. This module reads that
 *      shape, never mutates it, never calls `ReviewStore`/`ReviewManager` — it takes an
 *      already-loaded `ReviewSession` as a plain argument, the same "observe, don't drive" pattern
 *      F11's `PreviewHealth` used against a `PreviewSession` (F10).
 *   2. Review ownership stays with R1 — persistence, mutation, and identity are entirely R1's; R2
 *      owns nothing but the ANALYSIS of what R1 already persisted.
 *   3. Persistence boundary: this module never imports `node:fs` and never writes anything.
 *      `ReviewAnalysis` is recomputed from scratch on every call — there is no cache, no store, no
 *      partial/incremental analysis state.
 *   4. Stable identifiers available for grouping: `ReviewNote.severity`/`.state`/`.category`
 *      (optional) and `ReviewTarget.targetType`/`.targetId`/`.pageId` — all already-persisted R1
 *      fields, reused verbatim. "The page a note belongs to" is resolved as: the note's own
 *      `targetId` when `targetType === 'page'` (a page note IS its page), otherwise its
 *      `pageId` (every non-page target carries one) — documented explicitly since R1's own type
 *      does not spell this resolution rule out.
 */
import type { ReviewNote, ReviewSession, ReviewSeverity, ReviewState, ReviewTargetType } from './review-session.js';
import { versionedStructuralDigest } from '../canonical-digest.js';

// -- canonicalization + digest -- shared with every sibling program via canonical-digest.ts --

const REVIEW_ANALYSIS_VERSION_TAG = 'r2-review-analysis@1';

function digestOf(value: unknown): string {
  return versionedStructuralDigest(value, REVIEW_ANALYSIS_VERSION_TAG);
}

// ── the model ────────────────────────────────────────────────────────────────────────────────

export interface ReviewStateSummary {
  readonly open: number;
  readonly resolved: number;
  readonly dismissed: number;
}

export interface ReviewSeveritySummary {
  readonly blocker: number;
  readonly major: number;
  readonly minor: number;
  readonly nit: number;
}

export interface ReviewCategorySummary {
  readonly byCategory: Readonly<Record<string, number>>;
  readonly uncategorized: number;
}

export interface ReviewTargetSummary {
  readonly byType: Readonly<Record<ReviewTargetType, number>>;
  readonly byPage: Readonly<Record<string, number>>;
  readonly bySection: Readonly<Record<string, number>>;
  readonly byComponent: Readonly<Record<string, number>>;
  readonly bySlot: Readonly<Record<string, number>>;
}

export interface ReviewStatistics {
  readonly totalNotes: number;
  readonly state: ReviewStateSummary;
  readonly severity: ReviewSeveritySummary;
  readonly category: ReviewCategorySummary;
  readonly target: ReviewTargetSummary;
}

export interface ReviewAnalysis {
  readonly sessionId: string;
  readonly client: string;
  readonly track: ReviewSession['track'];
  readonly statistics: ReviewStatistics;
  /** Every note, sorted ascending by `timestamp`, ties broken by `id` — deterministic regardless
   *  of the input session's own array order. */
  readonly timeline: readonly ReviewNote[];
  readonly firstReviewedAt: string | undefined;
  readonly latestReviewedAt: string | undefined;
  /** Content digest of everything above — proves "repeated analysis is byte-identical" is real,
   *  not just claimed. Never persisted; recomputed on every call. */
  readonly digest: string;
}

export interface ReviewAnalysisBuilder {
  analyze(session: ReviewSession): ReviewAnalysis;
}

// ── pure helpers ─────────────────────────────────────────────────────────────────────────────

function sortedRecord(rec: Record<string, number>): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(rec).sort()) out[k] = rec[k];
  return Object.freeze(out);
}

function increment(rec: Record<string, number>, key: string): void {
  rec[key] = (rec[key] ?? 0) + 1;
}

function resolvePageKey(target: ReviewNote['target']): string | undefined {
  return target.targetType === 'page' ? target.targetId : target.pageId;
}

// ── the builder ──────────────────────────────────────────────────────────────────────────────

export function createReviewAnalysisBuilder(): ReviewAnalysisBuilder {
  return {
    analyze(session) {
      const notes = session.notes;

      const state: { open: number; resolved: number; dismissed: number } = { open: 0, resolved: 0, dismissed: 0 };
      const severity: Record<ReviewSeverity, number> = { blocker: 0, major: 0, minor: 0, nit: 0 };
      const byCategory: Record<string, number> = {};
      let uncategorized = 0;
      const byType: Record<ReviewTargetType, number> = { page: 0, section: 0, component: 0, slot: 0 };
      const byPage: Record<string, number> = {};
      const bySection: Record<string, number> = {};
      const byComponent: Record<string, number> = {};
      const bySlot: Record<string, number> = {};

      const stateKeyOf: Record<ReviewState, keyof typeof state> = { OPEN: 'open', RESOLVED: 'resolved', DISMISSED: 'dismissed' };

      for (const note of notes) {
        state[stateKeyOf[note.state]]++;
        severity[note.severity]++;

        if (note.category !== undefined) {
          increment(byCategory, note.category);
        } else {
          uncategorized++;
        }

        byType[note.target.targetType]++;
        const pageKey = resolvePageKey(note.target);
        if (pageKey !== undefined) increment(byPage, pageKey);
        if (note.target.targetType === 'section') increment(bySection, note.target.targetId);
        if (note.target.targetType === 'component') increment(byComponent, note.target.targetId);
        if (note.target.targetType === 'slot') increment(bySlot, note.target.targetId);
      }

      const timeline = [...notes].sort((a, b) => {
        const byTimestamp = a.timestamp.localeCompare(b.timestamp);
        return byTimestamp !== 0 ? byTimestamp : a.id.localeCompare(b.id);
      });

      const statistics: ReviewStatistics = Object.freeze({
        totalNotes: notes.length,
        state: Object.freeze({ ...state }),
        severity: Object.freeze({ ...severity }),
        category: Object.freeze({ byCategory: sortedRecord(byCategory), uncategorized }),
        target: Object.freeze({
          byType: Object.freeze({ ...byType }),
          byPage: sortedRecord(byPage),
          bySection: sortedRecord(bySection),
          byComponent: sortedRecord(byComponent),
          bySlot: sortedRecord(bySlot),
        }),
      });

      const core = {
        sessionId: session.id,
        client: session.client,
        track: session.track,
        statistics,
        timeline: Object.freeze(timeline),
        firstReviewedAt: timeline.length > 0 ? timeline[0].timestamp : undefined,
        latestReviewedAt: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : undefined,
      };

      return Object.freeze({ ...core, digest: digestOf(core) });
    },
  };
}

/** The one-call entry point — mirrors every prior program's `default-builder` composition idiom
 *  (F5's `generateProject`, F9's `loadPreviewWorkspace`). */
export function analyzeReviewSession(session: ReviewSession, builder: ReviewAnalysisBuilder = createReviewAnalysisBuilder()): ReviewAnalysis {
  return builder.analyze(session);
}
