/**
 * Stage 3 — Generate: website shell-rooted assembly (Path C / P3 AP3.1).
 *
 * The website deliverable is BUILT FROM the vendored v2 page shell (_shell.html), not
 * authored from scratch and not wrapped self-contained via flatten/document.ts. The real
 * curated `data-crf` fragments are pasted whole into the shell's <main> in band order,
 * led by the P2 Curation Table comment. The shell already carries the <head> the fragments
 * need (Urbanist+Inter @font-face, the token sheet <link>, Lucide). Output is MULTI-FILE:
 * it links `./colors_and_type.css` + `./fonts/` (rewritten from the shell's repo-relative
 * `../` refs) which the generate orchestrator copies beside the page — small HTML, no 2.3 MB
 * font inline. P5 flattens + subsets fonts into one self-contained file.
 *
 * validate (Stage 4, sync rails) reads tokens from context.tokens (the parsed brand sheet),
 * not from this page's <style>, so a linked-CSS page validates on the default/CI path.
 *
 * Anchor reconciliation: Offscript scopes rails + sections.md by a per-section anchor id, while
 * v2 wants `data-crf` bands directly in <main>. We inject the Offscript id + data-archetype onto
 * each fragment's OWN `data-crf` root element — one wrapper that satisfies both (no extra
 * <section> that v2's orphan rule would reject).
 */

/** Escape plain text for the <title> (the only text we substitute into the shell head). */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PASTE_MARKER = '<!-- ▼ paste fragments here, in band order ▼ -->';
const ANCHOR_TAGS = 'div|section|header|footer|nav|article|aside|main';

/** Escape a slug for use inside a RegExp (slugs are kebab-case, but be safe). */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inject the Offscript anchor `id` + `data-archetype` onto a fragment's root `data-crf` ELEMENT
 * (e.g. `<div data-crf="hero-actions">` → `<div data-crf="hero-actions" id="hero"
 * data-archetype="hero">`). Targets the element form only — never the `[data-crf="…"]`
 * selectors inside the scoped `<style>`. Idempotent: skips a wrapper that already carries an
 * id. If the fragment has no `data-crf` element (e.g. a minimalFragment fallback that already
 * has its own id), it is returned unchanged.
 */
export function injectAnchor(fragment: string, slug: string, id: string, archetype: string): string {
  const re = new RegExp(`<(?:${ANCHOR_TAGS})\\b[^>]*\\sdata-crf="${escapeRe(slug)}"`, 'i');
  const m = re.exec(fragment);
  if (!m) return fragment;
  const open = m[0];
  // Idempotence: inspect the WHOLE opening tag (to the next '>'), since an existing `id`
  // may sit AFTER `data-crf` — outside the matched prefix `m[0]`. Never double-stamp.
  const tagEnd = fragment.indexOf('>', m.index);
  const openTag = tagEnd === -1 ? open : fragment.slice(m.index, tagEnd);
  if (/\sid\s*=/.test(openTag)) return fragment; // already anchored — idempotent
  return (
    fragment.slice(0, m.index) +
    `${open} id="${id}" data-archetype="${archetype}"` +
    fragment.slice(m.index + open.length)
  );
}

export interface WebsiteBand {
  /** The (possibly copy-edited) fragment HTML to paste. */
  html: string;
  /** The catalog slug (= PlanItem.fragmentId) — locates the data-crf root for anchoring. */
  slug: string;
  /** The Offscript section anchor id to stamp onto the band (rail/section-map scope). */
  id: string;
  /** The section archetype to stamp as data-archetype (archetype-tag rails). */
  archetype: string;
}

/**
 * Assemble a shell-rooted website page: the v2 shell with the Curation Table comment + the
 * anchored fragments pasted into <main>, the token sheet + fonts rewritten to working-dir
 * (`./`) links, and the house behaviour library inlined before </body>.
 */
export function assembleWebsitePage(opts: {
  bands: WebsiteBand[];
  /** The P2 Curation Table HTML comment (serializeCurationComment); '' is tolerated. */
  curationComment: string;
  /** The house behaviour library (reveal / count-up / active-nav) — inlined when present. */
  behaviourScript?: string;
  /** The <title> (brief one-liner). */
  title?: string;
  /**
   * The chrome shell to root the page in — a SUPPLIED INPUT (WS6/EA-019). WS4 emits it in
   * production (head/fonts/token-link/PASTE_MARKER/behaviour slot); tests pass one directly.
   * The deleted `catalogShellPath` default is intentionally gone — the shell is never read
   * from the retired catalog dir.
   */
  shell: string;
}): string {
  const shell = opts.shell;

  // Repo-relative refs (`../colors_and_type.css`, `../fonts/`) → working-dir refs (`./`),
  // since the orchestrator copies both beside index.html (not one level up).
  let page = shell
    .replace(/\.\.\/colors_and_type\.css/g, 'colors_and_type.css')
    .replace(/\.\.\/fonts\//g, 'fonts/');

  if (opts.title) {
    page = page.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(opts.title)}</title>`);
  }

  const bands = opts.bands
    .map((b) => injectAnchor(b.html, b.slug, b.id, b.archetype))
    .join('\n');
  const mainBody = opts.curationComment ? `${opts.curationComment}\n${bands}` : bands;
  page = page.replace(PASTE_MARKER, mainBody);

  if (opts.behaviourScript && opts.behaviourScript.trim()) {
    page = page.replace('</body>', `<script>${opts.behaviourScript}</script>\n</body>`);
  }

  return page;
}
