/**
 * Flatten — the front-stage orchestrator + the bounded-LLM gate (detect) wiring.
 *
 * `flattenKit` composes the four front-stage pieces (intake → render → lucide →
 * document) into one self-contained static `<!doctype html>` document. `gateKit`
 * then parses that document and runs every rail's `detect` over it — the
 * detect-only acceptance gate of the bounded-LLM path (vision §4.2). Neither
 * function applies/remediates: this is detection wiring, not the apply/recipe
 * `runDeliverable` engine path.
 */
import type { Element } from 'hast';
import { detectKitLayout } from '../intake.js';
import type { WebsiteKit } from '../intake.js';
import { renderKitToBodyMarkup } from './render.js';
import { substituteLucide } from './lucide.js';
import { assembleDocument } from './document.js';
import { inlineAssets } from './inline-assets.js';
import { parseHtml, visitElements } from '../working-rep.js';
import { runGate } from '../gate.js';
import { loadTokensFromCss } from '../tokens.js';
import type { Finding, OperatorContext } from '../operator.js';
import type { OperatorRegistry } from '../operators/index.js';

/** Text content of a hast element (concatenated direct text children). */
function textOf(el: Element): string {
  return el.children
    .filter((c): c is { type: 'text'; value: string } => c.type === 'text')
    .map((c) => c.value)
    .join('');
}

/**
 * Pull the harness's page `<title>` text and its single inline `<style>` block
 * contents from the head. `<script>` blocks (including `type="text/babel"`) are
 * never treated as style — only real `<style>` elements are considered. The
 * canonical Claude Design harness carries exactly one inline `<style>` (if any);
 * if more are present we use the FIRST and emit a warning. Both `title` and
 * `inlineStyle` are optional: a harness with neither returns them undefined.
 */
export function extractHarnessHead(
  harnessHtml: string,
): { title?: string; inlineStyle?: string; warnings: string[] } {
  const tree = parseHtml(harnessHtml);

  let title: string | undefined;
  let inlineStyle: string | undefined;
  let styleCount = 0;
  const warnings: string[] = [];

  visitElements(tree, (el) => {
    if (el.tagName === 'title' && title === undefined) {
      const t = textOf(el).trim();
      if (t !== '') title = t;
    } else if (el.tagName === 'style') {
      const css = textOf(el);
      if (css.trim() !== '') {
        styleCount += 1;
        if (inlineStyle === undefined) inlineStyle = css; // first-wins
      }
    }
  });

  if (styleCount > 1) {
    warnings.push('multiple inline <style> blocks in harness; using the first');
  }

  return { title, inlineStyle, warnings };
}

/**
 * Run the full front-stage on an already-detected website kit:
 *   server-render → lucide substitution → self-contained document.
 * Returns the assembled HTML plus any lucide substitution / head warnings.
 *
 * This is the shared helper so callers that already hold a `kit`
 * (e.g. `gateKit` and `hardenKitMechanical`, which also need the kit's
 * `tokensCss`) don't re-run `detectKitLayout` a second time.
 */
export function flattenFromKit(kit: WebsiteKit): { html: string; warnings: string[] } {
  const body = renderKitToBodyMarkup(kit);
  const { html: iconHtml, warnings: lucideWarnings } = substituteLucide(body);
  const { title, inlineStyle, warnings: headWarnings } = extractHarnessHead(kit.harnessHtml);

  const assembled = assembleDocument({
    rootMarkup: iconHtml,
    tokensCss: kit.tokensCss,
    inlineStyle,
    title,
    lang: 'en',
  });

  const { html, warnings: inlineWarnings } = inlineAssets(assembled, kit);

  return { html, warnings: [...lucideWarnings, ...headWarnings, ...inlineWarnings] };
}

/**
 * Run the full front-stage on a Claude Design website kit directory:
 *   intake → server-render → lucide substitution → self-contained document.
 * Returns the assembled HTML plus any lucide substitution warnings.
 */
export function flattenKit(dir: string): { html: string; warnings: string[] } {
  return flattenFromKit(detectKitLayout(dir));
}

/**
 * The bounded-LLM detect path (vision §4.2): flatten the kit, parse the result,
 * and run every rail's detector over it. Returns the flattened HTML, the flatten
 * warnings, and the union of findings. This is detect-only — it never applies or
 * remediates (that is the gate-LOOP/actuator's job, deferred).
 *
 * The kit is detected ONCE: its rendered output feeds the flatten, and its
 * `colors_and_type.css` builds the `TokenModel` threaded into the gate context.
 * With real tokens present, the Tier-0 token rails (`token-normalize`,
 * `brand-fidelity-scan`) fire on the flattened output instead of short-circuiting.
 */
export function gateKit(
  dir: string,
  registry: OperatorRegistry,
): { html: string; warnings: string[]; findings: Finding[] } {
  const kit = detectKitLayout(dir);
  const { html, warnings } = flattenFromKit(kit);
  const tokens = loadTokensFromCss(kit.tokensCss);
  const tree = parseHtml(html);
  const ctx: OperatorContext = { params: {}, tokens };
  const findings = runGate(tree, ctx, [...registry.values()]);
  return { html, warnings, findings };
}
