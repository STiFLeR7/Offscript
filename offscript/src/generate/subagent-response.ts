/**
 * C1 fail-loud gate (audit §9-C1). On the subagent path a missing <id>.response.html
 * must NOT silently fall back to the scripted stub (a heading-only <section> scores
 * clean over an empty section). Pure + injectable so it unit-tests without running the
 * generate CLI (scripts/generate.ts executes work at module top-level — keep this here).
 *
 * Two-phase shape: authorDocument calls the author SEQUENTIALLY per item, so the gate is
 * split — readSubagentResponse records each miss (returning null) so the authoring pass
 * still writes EVERY <id>.request.md, then assertResponsesComplete fails loud after the
 * full pass, listing all missing sections at once.
 */

/** Read a subagent's authored fragment if present; null if absent (caller records the miss). */
export function readSubagentResponse(
  id: string,
  exists: (id: string) => boolean,
  read: (id: string) => string,
): string | null {
  return exists(id) ? read(id) : null;
}

/**
 * C1 fail-loud gate (audit §9-C1). After the authoring pass has written EVERY
 * <id>.request.md, refuse to score if any <id>.response.html is still missing —
 * a heading-only stub would otherwise score clean over an empty section.
 */
export function assertResponsesComplete(missing: string[]): void {
  if (missing.length === 0) return;
  const files = missing.map((id) => `${id}.response.html`).join(', ');
  throw new Error(
    `[Stage 3] ${missing.length} section(s) missing a response: ${files}. ` +
      `All <id>.request.md files were written to dispatch/ — author each response and re-run ` +
      `(OFFSCRIPT_AUTHOR=subagent), or unset OFFSCRIPT_AUTHOR to use the scripted smoke double. ` +
      `Refusing to score stubbed sections.`,
  );
}
