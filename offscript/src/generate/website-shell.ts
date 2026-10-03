/**
 * WS4 (EA-018 / EA-019) — the production WEBSITE page shell.
 *
 * The constitution-by-selection website is BUILT FROM a chrome shell (the v2 `_shell.html`
 * role) into which WS6 (`assembleWebsitePage`) pastes the reconstructed `data-crf` bands in
 * band order. The vendored `_shell.html` was a deleted derivative; WS4 re-emits an equivalent
 * shell from the SURVIVING website governance assets at `design_processes/website/`:
 *
 *   - links `../colors_and_type.css` — the surviving brand sheet, which ALREADY carries every
 *     `@font-face` (Urbanist + Inter → `./fonts/`), so the shell needs no own `@font-face`
 *     block (the recovered shell duplicated them only because the v2 sheet lacked them). WS6
 *     rewrites `../` → working-dir `./`; WS8 flatten inlines the sheet + fonts.
 *   - loads Lucide in <head> (fragment scripts call `lucide.createIcons()` as soon as they run).
 *   - a minimal reset binding the surviving brand tokens (`--cr-bg` / `--cr-fg` /
 *     `--cr-font-body`, all present in the sheet).
 *   - `<main>` carrying the exact `PASTE_MARKER` WS6 replaces, plus the
 *     `lucide.createIcons()` call before `</body>`.
 *
 * The `<title>` is a placeholder WS6 substitutes; the house behaviour library (`behavior.js`)
 * is NOT in the shell — WS6 inlines it via `assembleWebsitePage(opts.behaviourScript)`.
 *
 * Pure string — no LLM, no disk read (the linked sheet/fonts are resolved later by flatten
 * against the brand dir). Deterministic. Consumed by `assembleWebsitePage(opts.shell)` at WS9b.
 */

/** The exact paste marker WS6 (`assembleWebsitePage`) replaces with the curation comment + bands. */
export const WEBSITE_PASTE_MARKER = '<!-- ▼ paste fragments here, in band order ▼ -->';

/**
 * Emit the production website shell string. `title` is a placeholder the shell carries in
 * `<title>` (WS6 substitutes the real brief one-liner, and site-metadata substitutes the SEO
 * title on the shipped deployable); kept as a parameter so a caller may pre-seed it, but
 * assembly overrides it regardless. The default is a NEUTRAL placeholder — never a house
 * brand name — so a title never silently defaults to Example Brand on a client deliverable.
 */
export function websiteShell(title = 'Untitled'): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<link rel="stylesheet" href="../colors_and_type.css">',
    '<!-- Lucide loads in <head> — fragment scripts call lucide.createIcons() as soon as they run. -->',
    '<script src="https://unpkg.com/lucide@1.17.0/dist/umd/lucide.min.js" integrity="sha384-bdZtphetAEBgkGZvhZXOFDWc55tHGLqaSo1f4qZtgvEiolEBqlJ9u6FTk+CoLfj0" crossorigin="anonymous"></script>',
    '<style>',
    '  * { box-sizing: border-box; }',
    '  html { -webkit-text-size-adjust: 100%; }',
    '  body { margin: 0; background: var(--cr-bg); font-family: var(--cr-font-body); color: var(--cr-fg); }',
    '  [data-lucide] { display: inline-block; stroke-width: 1.8; color: currentColor; }',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    WEBSITE_PASTE_MARKER,
    '</main>',
    '<script>if (window.lucide) lucide.createIcons();</script>',
    '</body>',
    '</html>',
  ].join('\n');
}
