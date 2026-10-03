import type { Root, Element } from 'hast';
import { visitElements } from '../working-rep.js';
import { parseCss, rewriteInlineDecls } from '../css-rep.js';
import type { Operator, Finding, OperatorContext } from '../operator.js';

const DEFAULT_VIEWPORT_PX = 480;
/** The layout properties whose fixed px value can force horizontal overflow on mobile. */
const WIDTH_PROPS = new Set(['width', 'min-width']);
/** A pure pixel length: "<N>px" (integer or decimal), nothing else. */
const PX = /^(\d+(?:\.\d+)?)px$/;

function hasViewportMeta(tree: Root): boolean {
  let found = false;
  visitElements(tree, (el) => {
    if (
      el.tagName === 'meta' &&
      typeof el.properties?.name === 'string' &&
      el.properties.name.toLowerCase() === 'viewport'
    ) {
      found = true;
    }
  });
  return found;
}

function styleText(el: Element): string {
  const first = el.children[0];
  return first && first.type === 'text' ? first.value : '';
}

/** If `prop:value` is a fixed px width over the viewport, return its signal key, else undefined. */
function widthSignal(prop: string, value: string, viewportPx: number): string | undefined {
  const p = prop.trim().toLowerCase();
  if (!WIDTH_PROPS.has(p)) return undefined;
  const m = PX.exec(value.trim());
  if (!m) return undefined;
  return parseFloat(m[1]) > viewportPx ? `${p}:${value.trim()}` : undefined;
}


/** Collect the over-viewport fixed-width signals (deduped) from style blocks + inline styles. */
function widthSignals(tree: Root, viewportPx: number): Set<string> {
  const signals = new Set<string>();
  visitElements(tree, (el) => {
    // 1. <style> blocks
    if (el.tagName === 'style') {
      const css = styleText(el);
      if (css) {
        const root = parseCss(css);
        root.walkDecls((decl) => {
          const sig = widthSignal(decl.prop, decl.value, viewportPx);
          if (sig) signals.add(sig);
        });
      }
    }
    // 2. inline style="" attributes
    const style = el.properties?.style;
    if (typeof style === 'string' && style !== '') {
      rewriteInlineDecls(style, (prop, value) => {
        const sig = widthSignal(prop, value, viewportPx);
        if (sig) signals.add(sig);
        return undefined; // Never rewrite, just scan
      });
    }
  });
  return signals;
}

/** All responsive-risk signal keys for the tree (deduped, sorted, stable). */
function scanTree(tree: Root, viewportPx: number): string[] {
  const signals = widthSignals(tree, viewportPx);
  if (!hasViewportMeta(tree)) signals.add('viewport-meta');
  return [...signals].sort();
}

/**
 * Tier-2 judgment-pass detector/rail (bounded-LLM vision §4.2; superseded §8.4 #5):
 * best-effort STATIC responsive-risk flags (missing viewport meta + fixed px widths over
 * the mobile viewport). The fix — restructure layout / add breakpoints — is a design
 * decision the Claude actuator owns (§4.1), so this operator NEVER mutates; `detect` and
 * `apply` are the same read-only scan. Rendered-overflow measurement is a deferred
 * follow-up at the engine's WP1.A render seam (see plan scope note).
 */
export const responsiveNeed: Operator = {
  name: 'responsive-need',
  tier: 2,

  detect(tree: Root, ctx: OperatorContext): Finding[] {
    const viewportPx =
      typeof ctx.params.viewportPx === 'number' ? ctx.params.viewportPx : DEFAULT_VIEWPORT_PX;
    return scanTree(tree, viewportPx).map((signal) => ({
      id: `responsive-need:${signal}`,
      description:
        signal === 'viewport-meta'
          ? 'document is missing <meta name="viewport"> — it will not adapt to mobile widths'
          : `fixed ${signal} exceeds the assumed mobile viewport (${viewportPx}px) and risks horizontal overflow`,
      outcome: 'warning',
    }));
  },

  // Detector/rail: the fix is Claude's (vision §4.1). apply never mutates — pure re-scan.
  apply(tree: Root, ctx: OperatorContext): Finding[] {
    return this.detect(tree, ctx);
  },
};
