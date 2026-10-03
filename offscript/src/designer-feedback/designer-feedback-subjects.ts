/**
 * P18 — Designer Feedback subject helpers. The ONLY two places in the
 * designer-feedback domain that import a real domain type (`DoctorFinding` /
 * `AuthorProposal`, both TYPE-ONLY) — kept separate from designer-feedback.ts
 * so the core model + identity/validation logic stays coupled to nothing but
 * node:crypto (see that file's own isolation tests). Both helpers derive a
 * `FeedbackSubject` from a field the referenced artifact ALREADY carries
 * verbatim (`DoctorFinding.id`, `AuthorProposal.identity.id`) — no new fact,
 * no lookup, no I/O, no mutation of the artifact passed in.
 */
import type { DoctorFinding } from '../doctor/doctor-report.js';
import type { AuthorProposal } from '../designer-author/proposal.js';
import type { FeedbackSubject } from './designer-feedback.js';

/** Derive a FeedbackSubject referencing a DoctorFinding — id verbatim, nothing dereferenced. */
export function feedbackSubjectForFinding(finding: DoctorFinding): FeedbackSubject {
  return Object.freeze({ kind: 'doctor-finding', id: finding.id });
}

/** Derive a FeedbackSubject referencing an AuthorProposal — id verbatim, nothing dereferenced. */
export function feedbackSubjectForProposal(proposal: AuthorProposal): FeedbackSubject {
  return Object.freeze({ kind: 'proposal', id: proposal.identity.id });
}
