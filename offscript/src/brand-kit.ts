/**
 * Sprint W76 — Brand Kit Foundation (Parser → Loader → Transport; STOPS at Transport).
 *
 * The W75-approved minimal Brand Kit contract (SPRINT-W75-BRAND-KIT-INPUT-CONTRACT-ARCHITECTURE.md
 * §2/§3): exactly the four confirmed engine-side gaps — logo asset references, an imagery-manifest
 * override pointer, an icon-convention declaration, and a voice-reference pointer. Color / typography
 * / spacing / motion are DELIBERATELY ABSENT from this model — `BrandContract` + `colors_and_type.css`
 * + `resolveBrandContract` (brand-contract.ts / paths.ts) already provide a real, wired, tested
 * mechanism for that layer; this module reuses it unchanged rather than duplicating it (W75 §2.1).
 *
 * Sprint W77 (Brand Kit Consumption) independently confirmed this from the consumption side: the
 * sole runtime bridge for colors/typography/spacing/motion is `DesignContext.tokens`/`.brandContract`
 * → `OperatorContext` (`generate/validate.ts`, `generate/reauthor-loop.ts`) — never this module's
 * `BrandKit`. See docs/internals/SPRINT-W77-BRAND-KIT-CONSUMPTION.md.
 *
 * Mirrors `brand-contract.ts`'s own load discipline exactly: `loadBrandKitIfPresent` returns null
 * when the file is absent, and throws (via `parseBrandKit`) on any malformed shape — never silently
 * degrades a typo into "no kit". Mirrors the W18/W20/W52/W70 shape for the parts that DO apply here
 * (immutable, content-addressed via `brandKitDigest`, fail-loud) — but unlike those PlanItem-scoped
 * classifiers, a Brand Kit is a per-client, per-run SINGLETON exactly like `tokens`/`brandContract`
 * (W75 §6 phase 3 explicitly names `DesignContext` as the attachment site, not `PlanItem`), so there
 * is no provider/cache layer here: it is loaded exactly once per `buildContext` call, the same way
 * `loadBrandContract` already is.
 *
 * `imageryManifest` is a PATH POINTER to a client-owned table in the exact same `role | mode | file |
 * scrim | notes` shape `imagery-manifest.ts` already parses — this module does not re-implement that
 * parser; a future consumption phase resolves the pointer through the existing `parseImageryManifest`
 * unchanged (W75 §2.1 "reuses, unchanged" principle).
 *
 * `iconography.convention` is a closed enumeration; v1 declares exactly one legal value (the engine's
 * own existing hardcoded convention), so the field can be validated now while a future value remains
 * a pure additive vocabulary change later (W75 §5).
 *
 * Client-vs-house resolution PRECEDENCE (mirroring `resolveBrandContract`'s client-wins model) is
 * explicitly OUT OF SCOPE for this Foundation sprint — there is no house-level Brand Kit file to fall
 * back to today, and building an unfalsifiable fallback branch with no consumer would be speculative
 * infrastructure, not the confirmed W75 gap. This module resolves and loads a manifest already found
 * at a caller-supplied path; the caller (context.ts) supplies the client's own path only. Full
 * precedence extension is the Loader-consumption follow-on named in W75 §6 phase 2/4.
 *
 * NOTHING consumes this module's output in this sprint. It is referenced only by its own tests and by
 * the one `DesignContext.brandKit` transport field (generate/types.ts) + the one context.ts wiring
 * site — exactly mirroring W52/W70's transport-only footprint.
 *
 * No AI. No inference. No defaults beyond today's existing runtime defaults.
 */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** Bump when the manifest shape changes; participates in digest identity. */
export const BRAND_KIT_VERSION = 'w76-brand-kit@1';

/** Fail-loud error for parse/shape violations. Never thrown for a merely-absent file. */
export class BrandKitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrandKitError';
  }
}

/**
 * The closed icon-convention vocabulary (W75 §3/§5). v1 ships exactly one legal value — the engine's
 * own existing hardcoded convention (`author-contract.ts`'s monoline inline-SVG instruction) — so the
 * field validates today while remaining a pure additive-vocabulary seam for a future value.
 */
export type IconographyConvention = 'monoline-inline-svg';

const LEGAL_ICON_CONVENTIONS: ReadonlySet<string> = new Set<IconographyConvention>([
  'monoline-inline-svg',
]);

/** The two logo variants the engine already hardcodes (light-surface / dark-surface mark), as paths. */
export interface BrandKitLogo {
  readonly lightSurfaceMark: string;
  readonly darkSurfaceMark: string;
}

export interface BrandKitIconography {
  readonly convention: IconographyConvention;
}

/**
 * The immutable Brand Kit manifest — the W75-approved contract, exactly. Deep-frozen. Every optional
 * field's absence reproduces today's exact hardcoded engine behaviour (W75 §5) — no consumer reads
 * these fields yet, so this guarantee is asserted by the model, not yet exercised end-to-end.
 */
export interface BrandKit {
  readonly schemaVersion: 1;
  readonly subject: string;
  readonly logo: BrandKitLogo;
  /** Path to a client-owned imagery table in imagery.md's existing role|mode|file|scrim|notes shape. */
  readonly imageryManifest?: string;
  readonly iconography?: BrandKitIconography;
  /** Path to a client-owned voice/tone document, analogous to the house voice.md. */
  readonly voiceReference?: string;
  /** sha256 over (BRAND_KIT_VERSION + canonicalized raw manifest text) — the load-time content digest. */
  readonly digest: string;
}

function canonicalize(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** sha256 over the version + raw manifest text (canonicalized line endings). Deterministic, content-addressed. */
export function brandKitDigest(raw: string): string {
  return createHash('sha256').update(BRAND_KIT_VERSION).update(' ').update(canonicalize(raw)).digest('hex');
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function isBrandKitLogo(v: unknown): v is BrandKitLogo {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return isNonEmptyString(o.lightSurfaceMark) && isNonEmptyString(o.darkSurfaceMark);
}

function isBrandKitIconography(v: unknown): v is BrandKitIconography {
  if (v === null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.convention === 'string' && LEGAL_ICON_CONVENTIONS.has(o.convention);
}

/**
 * Parse raw brand-kit.json TEXT into an immutable, frozen BrandKit. Fail-loud: throws BrandKitError
 * on any deviation from the W75-approved contract (§3) — malformed JSON, wrong/missing
 * schemaVersion, empty subject, missing/malformed logo, or an optional field present with the wrong
 * shape. No inference: an optional field's ABSENCE is accepted (undefined on the result); its
 * PRESENCE must be well-formed or this throws — there is no silent coercion.
 */
export function parseBrandKit(raw: string): BrandKit {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BrandKitError('parseBrandKit: not valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BrandKitError('parseBrandKit: manifest is not a JSON object');
  }
  const o = parsed as Record<string, unknown>;

  if (o.schemaVersion !== 1) {
    throw new BrandKitError(
      `parseBrandKit: unsupported schemaVersion (expected 1, got ${JSON.stringify(o.schemaVersion)})`,
    );
  }
  if (!isNonEmptyString(o.subject)) {
    throw new BrandKitError('parseBrandKit: subject must be a non-empty string');
  }
  if (!isBrandKitLogo(o.logo)) {
    throw new BrandKitError(
      'parseBrandKit: logo.lightSurfaceMark and logo.darkSurfaceMark are required non-empty strings',
    );
  }
  if (o.imageryManifest !== undefined && !isNonEmptyString(o.imageryManifest)) {
    throw new BrandKitError('parseBrandKit: imageryManifest, when present, must be a non-empty string path');
  }
  if (o.iconography !== undefined && !isBrandKitIconography(o.iconography)) {
    throw new BrandKitError(
      `parseBrandKit: iconography.convention, when present, must be one of: ${[...LEGAL_ICON_CONVENTIONS].join(', ')}`,
    );
  }
  if (o.voiceReference !== undefined && !isNonEmptyString(o.voiceReference)) {
    throw new BrandKitError('parseBrandKit: voiceReference, when present, must be a non-empty string path');
  }

  const logo: BrandKitLogo = Object.freeze({
    lightSurfaceMark: o.logo.lightSurfaceMark,
    darkSurfaceMark: o.logo.darkSurfaceMark,
  });

  const result: {
    schemaVersion: 1;
    subject: string;
    logo: BrandKitLogo;
    imageryManifest?: string;
    iconography?: BrandKitIconography;
    voiceReference?: string;
    digest: string;
  } = {
    schemaVersion: 1,
    subject: o.subject as string,
    logo,
    digest: brandKitDigest(raw),
  };
  if (o.imageryManifest !== undefined) result.imageryManifest = o.imageryManifest;
  if (o.iconography !== undefined) {
    result.iconography = Object.freeze({ convention: o.iconography.convention });
  }
  if (o.voiceReference !== undefined) result.voiceReference = o.voiceReference;

  return Object.freeze(result);
}

/**
 * Load a brand-kit.json from disk at an exact path. Mirrors `loadBrandContract`'s discipline
 * precisely: returns null when the file does not exist; throws (via `parseBrandKit`) on malformed
 * content. Loaded exactly once per call — no caching layer, matching how `tokens`/`brandContract`
 * are loaded exactly once per `buildContext` call (a per-client-per-run singleton, not a per-item
 * repeated lookup).
 */
export function loadBrandKitIfPresent(filePath: string): BrandKit | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseBrandKit(raw);
}

/**
 * Sprint W78 — the first Brand Kit CONSUMPTION beyond transport: a deterministic logo-mark
 * resolver. `'light'` = the mark used ON a light/white surface (the house's existing "colour"
 * variant); `'dark'` = the mark used ON a dark/navy surface (the house's existing "white" variant)
 * — the exact two-variant pairing `buildCollateralLogoStyle` (generate/author.ts) already embeds.
 */
export type LogoSurface = 'light' | 'dark';

/**
 * Resolve the absolute path to a Brand Kit's logo mark for a surface context, when a Brand Kit is
 * present. Returns undefined when no Brand Kit is supplied — callers fall back to today's existing
 * hardcoded house asset, unchanged. `logo.lightSurfaceMark`/`logo.darkSurfaceMark` are paths
 * relative to the manifest's OWN directory (W75 §3), so `kitDir` — the directory the brand-kit.json
 * was loaded from — is required to resolve them to an absolute path.
 *
 * Pure and deterministic: no I/O, no existence check. The caller (mirroring
 * `buildCollateralLogoStyle`'s own `existsSync` + warn-and-fallback discipline) decides what happens
 * when the resolved path doesn't exist on disk — this function only computes the candidate path.
 */
export function resolveLogoMark(
  brandKit: BrandKit | undefined,
  surface: LogoSurface,
  kitDir: string,
): string | undefined {
  if (!brandKit) return undefined;
  const rel = surface === 'light' ? brandKit.logo.lightSurfaceMark : brandKit.logo.darkSurfaceMark;
  return join(kitDir, rel);
}

/**
 * Sprint W80 — deterministic iconography-convention resolution. Unlike `resolveLogoMark`
 * (W78) and `resolveBrandKitImageryRole` (W79), this resolver needs no `kitDir` / file I/O:
 * `iconography.convention` is a closed-enum VALUE, not a path pointer, and `parseBrandKit`
 * already guarantees (fail-loud, at load time) that a present `iconography.convention` is one
 * of `LEGAL_ICON_CONVENTIONS` — there is no malformed-value case left for this function to
 * reject; it only resolves presence vs. absence.
 *
 * Returns the Brand Kit's declared convention when present; falls back to
 * `'monoline-inline-svg'` — today's implicit, hardcoded engine convention — when the Brand Kit
 * or its `iconography` field is absent, so an absent Brand Kit reproduces today's behaviour
 * exactly (W75 §5's "byte-identical absence" guarantee, same discipline as `resolveLogoMark`).
 *
 * Because v1's closed vocabulary (`LEGAL_ICON_CONVENTIONS` above) currently has EXACTLY ONE
 * legal value, this function can never observably resolve to anything other than
 * `'monoline-inline-svg'` today
 * — a real, evidenced difference from `resolveLogoMark`/`resolveBrandKitImageryRole`, whose
 * fields are free-form paths a client can already set to any distinct value. See
 * SPRINT-W80-BRAND-KIT-ICONOGRAPHY-RESOLUTION.md §1 for why no runtime call site currently
 * consumes this resolved value (every location the "convention" manifests as behaviour today
 * is either author-prompt text or a rail that cannot reach `BrandKit` at all).
 */
export function resolveIconographyConvention(brandKit: BrandKit | undefined): IconographyConvention {
  return brandKit?.iconography?.convention ?? 'monoline-inline-svg';
}
