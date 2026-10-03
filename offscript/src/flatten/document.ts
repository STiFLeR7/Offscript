/**
 * Flatten — assemble the self-contained static document.
 *
 * After server-render produces body markup and Lucide substitution materializes
 * icons, this wraps everything into one self-contained `<!doctype html>` document:
 * tokens CSS and the harness's inline style are inlined as real `<style>` blocks
 * (no `<link>`), the markup is mounted in `<div id="root">`, and all CDN runtime
 * `<script>` tags are intentionally gone.
 *
 * "Static" means no CDN/external runtime — NOT necessarily zero JS. The harden
 * path emits no script at all (a hardened artifact is static). The website
 * generate path passes one trusted, inlined `script` (the house behaviour
 * library — colors_and_type.css's JS twin) emitted AFTER `<div id="root">`,
 * before `</body>`, so the on-load IIFE finds the mounted markup. Collateral
 * passes none (zero-JS charter). No `script` ⇒ no `<script>` tag at all.
 *
 * `rootMarkup`, `tokensCss`, `inlineStyle`, and `script` are trusted,
 * already-rendered fragments/CSS/JS and are emitted verbatim (never escaped —
 * escaping would corrupt them; callers must ensure `script` carries no literal
 * `</script>`). `lang`/`title` are plain text values and ARE escaped (a `title`
 * containing `<`, `&`, or a literal `</title>` would otherwise break the head).
 */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

export function assembleDocument(parts: {
  rootMarkup: string;
  tokensCss: string;
  inlineStyle?: string;
  script?: string;
  lang?: string;
  title?: string;
}): string {
  const lang = escapeAttr(parts.lang ?? 'en');

  const head: string[] = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
  ];
  if (parts.title !== undefined) {
    head.push(`<title>${escapeText(parts.title)}</title>`);
  }
  head.push(`<style>${parts.tokensCss}</style>`);
  if (parts.inlineStyle !== undefined) {
    head.push(`<style>${parts.inlineStyle}</style>`);
  }

  // The behaviour <script> is emitted AFTER #root (before </body>) so the
  // on-load IIFE finds the mounted markup. Omitted entirely when no script is
  // passed (harden path / collateral stay script-free).
  const body =
    `<div id="root">${parts.rootMarkup}</div>` +
    (parts.script !== undefined ? `\n<script>${parts.script}</script>` : '');

  return (
    `<!doctype html>\n` +
    `<html lang="${lang}">\n` +
    `<head>\n${head.join('\n')}\n</head>\n` +
    `<body>\n${body}\n</body>\n` +
    `</html>\n`
  );
}
