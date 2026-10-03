import type { Finding } from '../../../operator.js';
import type { RenderRuntime } from '../../../render-runtime.js';
/**
 * Detect collateral pages that will not print to exactly one A4 sheet. Takes
 * the RenderRuntime directly (not a RenderContext) because it needs the
 * print-media probe (loadHtmlForPrint). Returns one escalated finding per
 * over-tall page.
 */
export async function detectPageWrapAsync(rt: RenderRuntime | undefined, html: string): Promise<Finding[]> {
  if (!rt) return [];
  const probe = await rt.loadHtmlForPrint(html);
  return probe.pages
    .filter((p) => p.overflows)
    .map((p) => ({
      id: `page-wrap:p${p.index}`,
      description: `.cr-page ${p.index} content is ${p.heightPx}px, past its A4 sheet (usable ${probe.contentHeightPx}px); it clips or wraps to a second printed sheet (declared page count broken).`,
      outcome: 'escalated' as const,
    }));
}
