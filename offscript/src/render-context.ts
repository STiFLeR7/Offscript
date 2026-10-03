/**
 * Render-aware oracle support (M2 — Track A seam).
 *
 * `RenderContext` is the type contract every render-rail operator reads from
 * `OperatorContext.renderContext`. It carries the live Playwright page handle
 * (one shared session per harden run, owned by `src/render-runtime.ts`) plus
 * a couple of small helpers so individual render rails don't each re-implement
 * the same selector → bounds / computed-style plumbing.
 *
 * This module declares the SHAPE only — no implementation, no Playwright
 * import. `src/render-runtime.ts` (Track A) ships the impl. Track B operators
 * never construct a RenderContext; they only consume one via `ctx.renderContext`
 * and tolerate `undefined` (no render runtime → render rail is a no-op).
 *
 * Spec: M2 charter (see docs/internals/M2-PARALLEL-HANDOFF.md).
 */

/** Rendered geometry for an element, in CSS pixels at the active viewport. */
export interface RenderedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  /** clientWidth / clientHeight — useful for "did this overflow its parent?" math. */
  clientWidth: number;
  clientHeight: number;
}

/** Subset of CSSStyleDeclaration the render rails actually read. */
export interface RenderedStyle {
  backgroundColor: string;
  backgroundImage: string;
  backgroundBlendMode: string;
  color: string;
  opacity: string;
  /** display: "none" / "block" / "flex" / … — null when element is detached. */
  display: string;
}

/**
 * The shared render context handed to render rails. One per harden run; one
 * Chromium launch; same viewport across all render rails.
 */
export interface RenderContext {
  /** The viewport the active render session uses; render rails reference this for ratio math. */
  viewport: { width: number; height: number };
  /** Measure rendered bounds for the first element matching the selector. Null if no match. */
  measureBounds(selector: string): Promise<RenderedBounds | null>;
  /** Read a subset of computed styles for the first element matching the selector. Null if no match. */
  computedStyle(selector: string): Promise<RenderedStyle | null>;
  /**
   * Run an arbitrary serialisable probe in the page (returns whatever the
   * function returns). The bounds/style helpers are 80 % of use; this is the
   * escape hatch for rails that need richer probes (e.g. text-fits-in-box).
   */
  probe<T>(fn: string): Promise<T>;
}
