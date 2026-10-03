/**
 * Exemplar-fidelity sprint — resolves the bundled generic reference typography and
 * color tokens from `resources/design_processes/website/colors_and_type.css`, the same sanctioned exception
 * `environment-library.ts` already established: a filesystem path reference into the website
 * track's own brand pack, computed relative to `engineRoot` — never an import of Website Generation
 * code, never a dependency on `offscript/src/`, never a copy of the file's content into this package.
 *
 * This module performs NO selection or decision. The Creative Authoring layer's own prior gap
 * (found by comparing real authored output against real Repo B exemplars) was not "wrong taste" —
 * it was that the authoring prompt gave the author ZERO real typography/color context, so the LLM
 * invented a generic font stack and an arbitrary accent color from nothing. This module exists only
 * to give the prompt the REAL values that already exist, mirroring `resolveEnvironmentAsset`'s own
 * "resolve the real asset, never author/select it" discipline.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { engineRoot } from './references.js';

/** Caller-supplied project guidance, or an explicit choice to study the bundled demo brand. */
export type AuthoringBrand =
  | { readonly css?: string; readonly voice?: string; readonly embeddedCss?: string }
  | { readonly reference: 'example' };

/** Filesystem-only project seam; this standalone package never imports engine loaders. */
export function loadProjectAuthoringBrand(client: string): AuthoringBrand | undefined {
  const refs = join(engineRoot, 'projects', client, 'references');
  const cssPath = join(refs, 'colors_and_type.css');
  const kitPath = join(refs, 'brand-kit.json');
  let voiceReference: string | undefined;
  if (existsSync(kitPath)) {
    const kit = JSON.parse(readFileSync(kitPath, 'utf8')) as { voiceReference?: unknown };
    if (kit.voiceReference !== undefined) {
      if (typeof kit.voiceReference !== 'string' || !kit.voiceReference.trim()) {
        throw new Error('brand-kit voiceReference must be a non-empty path');
      }
      voiceReference = kit.voiceReference;
    }
  }
  const voicePath = voiceReference ? resolve(refs, voiceReference) : join(refs, 'voice.md');
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : undefined;
  // A declared voice pointer is required to resolve; a missing optional voice.md is fine.
  const voice = voiceReference || existsSync(voicePath) ? readFileSync(voicePath, 'utf8') : undefined;
  return css !== undefined || voice !== undefined
    ? { css, voice, ...(css !== undefined ? { embeddedCss: embedProjectCssAssets(css, refs) } : {}) }
    : undefined;
}

const ASSET_MIME: Record<string, string> = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};

/** Inline local CSS assets only; URLs, data URIs and fragment references retain their meaning. */
function embedProjectCssAssets(css: string, refs: string): string {
  const insideReferences = (assetPath: string, root: string): boolean => {
    const rel = relative(root, assetPath);
    return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
  };
  return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, (whole, doubleQuoted, singleQuoted, bare) => {
    const ref = String(doubleQuoted ?? singleQuoted ?? bare).trim();
    if (!ref || ref.startsWith('#') || ref.startsWith('//') || /^[a-z][a-z\d+.-]+:/i.test(ref)) return whole;
    const assetPath = resolve(refs, decodeURIComponent(ref.split(/[?#]/)[0]));
    if (!insideReferences(assetPath, refs)) throw new Error(`brand CSS asset must stay within project references: ${ref}`);
    if (!existsSync(assetPath)) throw new Error(`brand CSS asset not found: ${ref}`);
    // Real paths also reject a symlink/junction pointing beyond the supplied references.
    if (!insideReferences(realpathSync(assetPath), realpathSync(refs))) {
      throw new Error(`brand CSS asset must stay within project references: ${ref}`);
    }
    const mime = ASSET_MIME[extname(assetPath).toLowerCase()] ?? 'application/octet-stream';
    const fragment = ref.includes('#') ? ref.slice(ref.indexOf('#')) : '';
    return `url("data:${mime};base64,${readFileSync(assetPath).toString('base64')}${fragment}")`;
  });
}

export interface BrandTypography {
  /** Example Brand's one real, governed typeface — "ONE typeface for the whole experience" per the
   * brand pack's own header comment. Never a second family, never a Repo B font. */
  readonly fontFamily: string;
  /** The real, self-hosted variable font file on disk. */
  readonly fontFilePath: string;
  /** The real weight range the font file actually carries — snaps to real steps (400/500/600/700),
   * never an invented in-between value. */
  readonly fontWeightRange: readonly [number, number];
  readonly accentHex: string;
  readonly textPrimaryHex: string;
  readonly textSecondaryHex: string;
  readonly textMutedHex: string;
  /** The real brand scale's largest heading size and its supporting/micro size — cited as evidence
   * for the "hero register clearly dominant over micro register" discipline, never a literal
   * pixel value the author must copy verbatim onto a much smaller creative canvas. */
  readonly headingPx: number;
  readonly supportingPx: number;
}

function brandPackDir(): string {
  return resolve(engineRoot, 'resources', 'design_processes', 'website');
}

/** The real CSS file's path — exported so tests/callers can assert against the real file, not a
 * duplicated path string. */
export function brandTypographyCssPath(): string {
  return resolve(brandPackDir(), 'colors_and_type.css');
}

function fontFilePath(): string {
  return resolve(brandPackDir(), 'fonts', 'InstrumentSans[wdth,wght].ttf');
}

function extractHexToken(css: string, name: string): string | undefined {
  return css.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6,8})'))?.[1];
}

function extractPxToken(css: string, name: string): number | undefined {
  const value = css.match(new RegExp('--' + name + ':\\s*(\\d+)px'))?.[1];
  return value ? Number(value) : undefined;
}

/**
 * Explicit reference/demo lookup of Example Brand typography/color tokens. Project authoring
 * never calls this unless its request chooses `brand: { reference: 'example' }`. Returns
 * undefined (fail-safe, never throws) when the source file or any required token is missing —
 * mirroring `resolveEnvironmentAsset`'s own fail-safe convention — so a caller can gracefully omit
 * this guidance rather than author from a partially-invented value.
 */
export function resolveBrandTypography(): BrandTypography | undefined {
  const cssPath = brandTypographyCssPath();
  if (!existsSync(cssPath)) return undefined;
  const css = readFileSync(cssPath, 'utf8');

  const accentHex = extractHexToken(css, 'cr-orange-500');
  const textPrimaryHex = extractHexToken(css, 'cr-text-primary');
  const textSecondaryHex = extractHexToken(css, 'cr-text-secondary');
  const textMutedHex = extractHexToken(css, 'cr-text-muted');
  const headingPx = extractPxToken(css, 'cr-text-h1');
  const supportingPx = extractPxToken(css, 'cr-text-supporting');
  const fontPath = fontFilePath();

  if (!accentHex || !textPrimaryHex || !textSecondaryHex || !textMutedHex) return undefined;
  if (headingPx === undefined || supportingPx === undefined) return undefined;
  if (!existsSync(fontPath)) return undefined;

  return {
    fontFamily: 'Instrument Sans',
    fontFilePath: fontPath,
    fontWeightRange: [400, 700],
    accentHex,
    textPrimaryHex,
    textSecondaryHex,
    textMutedHex,
    headingPx,
    supportingPx,
  };
}
