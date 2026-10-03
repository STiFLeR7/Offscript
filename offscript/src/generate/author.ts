/**
 * Stage 3 — Generate: authorDocument(plan, context, author) → { html, warnings }
 *
 * Assembles a complete, self-contained HTML deliverable from a plan + context by
 * dispatching each plan item to the injected Author seam, then wrapping the
 * concatenated fragments with the real reference tokens CSS via assembleDocument().
 *
 * CIRCULAR-PROOF WARNING (bank in every read):
 *   The scripted author is a DOUBLE, not evidence. Hand-written var()-only fragments
 *   score systematic-ratio ≈ 1.0 BY CONSTRUCTION — that is a pipeline smoke-test.
 *   The non-circular ratio proof (Phase 4) MUST come from the in-session LLM-authored
 *   artifact, which can make off-brand choices the rails actually catch. Never
 *   interpret a passing scripted-path score as the headline proof.
 *
 * Self-containment:
 *   Two sources of relative refs, handled on ALL paths vs deferred:
 *
 *   1. BRAND-CSS FONTS (all paths) — the house colors_and_type.css carries relative
 *      @font-face refs (url("fonts/Inter_18pt-Regular.ttf")). These appear on EVERY
 *      path (scripted AND LLM) because they come from the brand CSS, not the author.
 *      We inline them here via rewriteCssUrls against the brand dir → data:font URIs,
 *      so the assembled document is genuinely self-contained (no font 404s). Base64
 *      of fixed TTFs is stable, so this stays deterministic.
 *
 *   2. AUTHORED IMAGERY (LLM path only) — the scripted author emits no relative refs,
 *      but the LLM-authored path WILL emit kit-relative brand imagery (mascots,
 *      illustrations, logos — Design.md §2.5). That deferral is still legitimate:
 *      see the clearly-commented inlineAssets PLUG-IN POINT below.
 *
 * Track-aware assembly (Phase 5):
 *   - website:    fragments concatenated → <div id="root"> (unchanged).
 *   - collateral: each fragment wrapped in <section class="cr-page">, all wrapped
 *     in <main class="cr-doc">, with a minimal A4-scoped inlineStyle.
 *
 *   The per-item fragment is GENERIC (same scripted <section id=…> shape) — the
 *   cr-doc/cr-page wrapping happens here in assembly, NOT in the Author seam.
 *   Keeping track knowledge out of AuthoringRequest is the lighter choice:
 *   the seam stays curated and minimal; the track-structural concern belongs to
 *   the assembly layer that owns the final document shape.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { resolveBrandContract, designPrinciplesDir, designProcessesDir, projectReferencesDir } from '../paths.js';
import { hasProjectBrandIdentity } from './context.js';
import { resolveLogoMark } from '../brand-kit.js';
import { assembleDocument } from '../flatten/document.js';
import { rewriteCssUrls, inlineAssetsFrom } from '../flatten/inline-assets.js';
import type { AuthoringPlan, DesignContext } from './types.js';
import type { Author, AuthoringRequest } from './authoring-seam.js';
import {
  buildAuthorContract,
  selectExemplar,
  assignComposition,
  routedStudyPointer,
  routedClassFor,
} from './author-contract.js';
import { deriveContentSignal } from './content-signal.js';
import type { PresentationIntentClass } from './presentation-intent.js';

/**
 * W53/W54 — map PresentationIntent's governed medium to the routed-class vocabulary
 * (`routedClassFor`'s `'' | 'diagram' | 'spatial' | 'chart'`). Provably equivalent to
 * `routedClassFor(deriveContentSignal(item))` for every possible signal: both rank
 * spatial over diagram/process/comparison over chart (stats) over everything else —
 * the SAME precedence PresentationIntent.classify() already holds (presentation-intent.ts).
 */
function routedClassFromIntent(
  intentClass: PresentationIntentClass,
): '' | 'diagram' | 'spatial' | 'chart' {
  return intentClass === 'diagram' || intentClass === 'spatial' || intentClass === 'chart'
    ? intentClass
    : '';
}
import { collateralGuidanceFor } from './collateral-constants.js';
import { loadImageryManifest, imageryRole, resolveBrandKitImageryRole } from './imagery-manifest.js';
import { buildCanonicalFooter, stripPageFoot, injectCanonicalFooter } from './footer.js';
import { parseFragment, serializeHtml, visitElements } from '../working-rep.js';
import type { Finding } from '../operator.js';
import { extractVisualFromLocation } from './creative-artifact-consumption.js';

// ── Collateral inlineStyle ────────────────────────────────────────────────────
// Minimal GEOMETRY-ONLY sizing for .cr-page.
//
// Deliberately no color/background declarations here — the house colors_and_type.css
// (always present in the <style> block) already defines .cr-doc and .cr-page with
// the correct brand-token values. Adding background/color here would either duplicate
// them or, worse, smuggle literal hex fallbacks (e.g. var(--cr-surface, #ffffff))
// into the document, violating the scripted path's var()-only invariant. The house
// CSS is the single source of truth for brand values.
//
// DESIGN NOTE — squarePageCorners rail (these are two SEPARATE concerns):
//   1. The `border-radius:0` below is a VISUAL default so generated cr-pages
//      render as square paper. It is in a <style> BLOCK.
//   2. The squarePageCorners rail is UNRELATED to that block: it inspects the
//      inline `style="..."` ATTRIBUTE on each .cr-page only (`el.properties.style`),
//      on every path. A `border-radius` in a <style> block never satisfies (or
//      triggers) it. The scripted author emits <section class="cr-page"> with NO
//      inline style attribute, so the rail's guard short-circuits — no finding.
//      (When the LLM path emits inline styles, it must keep them square; the
//      style-block rule here does not cover for it.)
//
// DESIGN NOTE — a4-bounds render rail:
//   A4 at 96 dpi ≈ 793.7px wide × 1122.5px tall. Setting width to 210mm and
//   min-height to 297mm makes each cr-page A4-dimensioned so overflow comparisons
//   are accurate when a4-bounds runs (gate ON — now folded into generate-validate's
//   collateral render tier, AP-2).
const COLLATERAL_INLINE_STYLE = `
/* Offscript generate — collateral A4 geometry (Phase 5 — geometry only, no brand values) */
.cr-page {
  width: 210mm;
  min-height: 297mm;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 0;
  page-break-after: always;
  position: relative; /* anchor for the absolutely-pinned running footer below */
}
/* 16mm Swiss frame on normal pages; full-bleed pages (the cover) get NO page padding
   (cr-page--bleed → padding:0 in the house CSS) so the navy reaches the page edge — the
   fragment holds its own inner margin. :not() keeps this from re-padding the bleed cover. */
.cr-page:not(.cr-page--bleed) { padding: 16mm; }
/* Uniform running footer — house furniture, ABSOLUTELY pinned into the page's bottom
   margin so it contributes ZERO height to the content flow. (A flow footer with
   margin-top:auto overflowed the page on content-dense pages: once content filled the
   box, auto-margin collapsed to 0 and the appended footer spilled past the page edge —
   and since the engine now owns the footer, authors no longer reserve space for it.)
   Absolute positioning gives an identical baseline on EVERY page AND lets authored
   content own the full 16mm frame without colliding with the foot. The 16mm insets match
   the page frame; bleed pages (the cover) zero the frame, so inset the foot directly. */
.cr-doc .cr-page-foot {
  position: absolute;
  left: 16mm;
  right: 16mm;
  bottom: 8mm;
  margin: 0 !important;
}
.cr-doc .cr-page--bleed .cr-page-foot { left: 14mm; right: 14mm; bottom: 8mm; }
`.trim();

/** Supplied project marks are authoritative; only bare projects use example marks. */
export function buildCollateralLogoStyle(context: DesignContext, warnings: string[]): string {
  const kitDir = resolveBrandContract(context.client, context.track);
  const logoDir = join(designPrinciplesDir(), 'assets', 'logo');
  const white = resolveLogoMark(context.brandKit, 'dark', kitDir) ??
    (!hasProjectBrandIdentity(context) ? join(logoDir, 'example-brand-white.svg') : undefined);
  const color = resolveLogoMark(context.brandKit, 'light', kitDir) ??
    (!hasProjectBrandIdentity(context) ? join(logoDir, 'example-brand-color.svg') : undefined);
  if (!white || !color || !existsSync(white) || !existsSync(color)) {
    warnings.push('collateral logo: project mark unavailable — headers use the project text label.');
    return '';
  }
  const whiteUri = `data:image/svg+xml;base64,${readFileSync(white).toString('base64')}`;
  const colorUri = `data:image/svg+xml;base64,${readFileSync(color).toString('base64')}`;
  return `
/* Project logo marks, embedded once for the page headers. */
.cr-logo-mark { display: block; height: 18px; width: 134px; background-repeat: no-repeat;
  background-position: left center; background-size: contain;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cr-logo-mark--white { background-image: url("${whiteUri}"); }
.cr-logo-mark--color { background-image: url("${colorUri}"); }
`.trim();
}

/** Project cover imagery never inherits reference assets when its cover is absent. */
export function buildCollateralCoverStyle(context: DesignContext, warnings: string[]): string {
  const kitDir = resolveBrandContract(context.client, context.track);
  const brandKitResolved = resolveBrandKitImageryRole(context.brandKit, 'cover', kitDir);
  const row = brandKitResolved?.row ?? (!hasProjectBrandIdentity(context)
    ? imageryRole(loadImageryManifest('collateral'), 'cover') : undefined);
  if (!row || row.mode !== 'engine-cover' || row.file.trim() === '') {
    warnings.push('collateral cover: no project engine-cover image — cover keeps its token background.');
    return '';
  }
  const abs = brandKitResolved ? brandKitResolved.absPath
    : join(designPrinciplesDir(), 'assets', 'imagery', row.file);
  if (!existsSync(abs)) {
    warnings.push(`collateral cover: photo not found at ${abs} — cover keeps its token background.`);
    return '';
  }
  const mime = extname(abs).toLowerCase() === '.png' ? 'image/png'
    : extname(abs).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${readFileSync(abs).toString('base64')}`;
  const scrim = row.scrim === 'none' ? ''
    : 'linear-gradient(180deg, color-mix(in srgb, var(--cr-ink) 62%, transparent), color-mix(in srgb, var(--cr-ink) 88%, transparent)), ';
  return `
/* Project cover imagery; interiors remain photo-free. */
.cr-page--dark.cr-page--bleed {
  background-image: ${scrim}url("${dataUri}");
  background-size: cover; background-position: center;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
`.trim();
}

/**
 * Author a complete HTML document from the plan + context using the given Author.
 *
 * For each plan item:
 *   1. Build a curated AuthoringRequest (guidance = the section's own §3.N block,
 *      resolved archetype → §3.N anchor → SECTION_INTELLIGENCE.md excerpt; '' for
 *      collateral archetypes, which have no website playbook entry).
 *   2. Dispatch to author.author(req) → HTML fragment.
 * Concatenate all fragments → rootMarkup.
 * Re-read the raw colors_and_type.css (carries @font-face + base styles that
 * TokenModel drops) and assemble the final document via assembleDocument().
 *
 * Deterministic: with the scripted author, two calls produce byte-identical HTML.
 *
 * @param plan    The AuthoringPlan from Stage 2.
 * @param context The DesignContext from Stage 1.
 * @param author  The Author implementation (scripted double or subagent).
 * @param findingsByItem  Optional per-item rail findings from a PRIOR validate
 *   pass, keyed by `item.anchor.id` (see mapFindingsToItems in reauthor-loop.ts).
 *   When present, each item's findings are attached to its AuthoringRequest as
 *   `priorFindings` so the (LLM) author can FIX them. Absent / no entry for an
 *   item ⇒ no priorFindings ⇒ the scripted author re-emits an identical fragment,
 *   preserving determinism and the loop's no-progress guard on the scripted path.
 * @returns       The assembled HTML string and any warnings from the self-contain step.
 */
export async function authorDocument(
  plan: AuthoringPlan,
  context: DesignContext,
  author: Author,
  findingsByItem?: Map<string, Finding[]>,
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];

  // ── 1. Dispatch each plan item to the author seam ────────────────────────────
  // Build the once-per-run shared house contract from the already-loaded governance.
  // Track-dispatched (collateral + website each get their own contract; deck → '').
  // The scripted author ignores it, so determinism on the scripted path is preserved.
  const houseContract = buildAuthorContract(context);

  // Per-archetype counter → each page gets a DISTINCT assigned composition rotated by
  // its index among same-archetype items (anti-monotony). Deterministic.
  const archetypeSeen = new Map<string, number>();

  const fragments: Array<{
    frag: string;
    archetype: string;
    routedClass: '' | 'diagram' | 'spatial' | 'chart';
  }> = [];
  for (const item of plan.items) {
    // Option 1/2: the routed intelligence CLASS + the specific exemplar pointer for this
    // section, derived from its deterministic content-signal (collateral only). The pointer
    // SURFACES a precise on-disk exemplar (routing, not transport); the class is STAMPED on
    // the page wrapper below so the application rail can verify the class was realized.
    // W53 — Presentation Intent CONSUMPTION: prefer the transported item.presentationIntent
    // (computed once at plan time from this exact bound content) over an independent
    // deriveContentSignal re-derivation / routedClassFor re-classification. Falls back to the
    // legacy direct derivation when transport is off (default) or absent on this item, so
    // behaviour is byte-identical either way — same underlying signal/classification, just
    // owned upstream instead of re-computed here.
    const contentSignal =
      context.track === 'collateral' ? (item.presentationIntent?.source ?? deriveContentSignal(item)) : [];
    const studyPointer = context.track === 'collateral' && !hasProjectBrandIdentity(context) ? routedStudyPointer(contentSignal) : '';
    const routedClass =
      context.track === 'collateral'
        ? item.presentationIntent
          ? routedClassFromIntent(item.presentationIntent.intentClass)
          : routedClassFor(contentSignal)
        : '';
    // Guidance: collateral pulls its per-archetype HOW Record; website pulls the per-section
    // recipe the composition router wrote at plan time (P2 A1 — replaces the dead
    // SECTION_INTELLIGENCE.md path, which now resolves to an empty map). Empty on the scripted
    // path (which ignores guidance), so determinism is preserved; only the LLM seam renders it.
    let guidance = '';
    if (context.track === 'collateral') {
      guidance = hasProjectBrandIdentity(context)
        ? 'Compose this page around its supplied content, with clear hierarchy and legible typography. Use project tokens and assets; choose surfaces and colours from the project brand.'
        : collateralGuidanceFor(String(item.archetype));
    } else {
      guidance = item.sectionGuidance ?? '';
    }

    // Per-item findings from a prior validate pass (violation-aware re-authoring).
    // Only non-empty for offending items on a re-author pass; undefined otherwise.
    const priorFindings = findingsByItem?.get(item.anchor.id);

    // Curated archetype-matched exemplar ("match the rhythm/density; do NOT clone").
    // Track-aware (collateral + website resolve their OWN fragment set); only threaded
    // when a house contract exists, and '' when no fragment is curated yet (degrades
    // cleanly) — so the scripted double stays untouched and website never reaches a
    // collateral fragment.
    const exemplar = houseContract && !hasProjectBrandIdentity(context) ? selectExemplar(item.archetype, context.track) : '';

    // Assigned composition: rotate a distinct layout per page by its index among
    // same-archetype items, so the deck does not read as one template repeated.
    // Track-aware: website returns '' (heterogeneous archetypes need no rotation).
    const archKey = String(item.archetype);
    const archIndex = archetypeSeen.get(archKey) ?? 0;
    archetypeSeen.set(archKey, archIndex + 1);
    // WS1: prefer the content-aware composition selected at plan time (item.composition).
    // On the collateral path assignCollateralCompositions sets item.composition for EVERY
    // page (Cover/Closing included, via their singleton candidate set), so the positional
    // assignComposition fallback below is effectively only reached for (a) website —
    // item.composition is never set there and assignComposition returns '' for
    // heterogeneous website archetypes, so website behaviour is unchanged — and (b) as a
    // defensive default if a collateral item ever lacks a composition. Determinism comes
    // from item.composition being deterministically selected; the fallback is itself
    // deterministic (index-based) so the scripted double stays byte-stable either way.
    const composition = houseContract && !hasProjectBrandIdentity(context)
      ? item.composition ?? assignComposition(item.archetype, archIndex, context.track)
      : '';

    // Sprint 5 — resolve a plan-time-assigned Creative Artifact reference (item.creativeArtifact)
    // into a ready `data:` URI, so the author never touches a filesystem path itself. Gated:
    // default-off (OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION unset), so a plan with no
    // item.creativeArtifact (every plan today, unless a caller opted into the Sprint 5 assignment
    // step) leaves fragments byte-identical to before this sprint.
    const creativeArtifactImage =
      process.env.OFFSCRIPT_CREATIVE_ARTIFACT_CONSUMPTION === '1' && item.creativeArtifact
        ? extractVisualFromLocation(item.creativeArtifact.location)
        : undefined;

    const req: AuthoringRequest = {
      item: hasProjectBrandIdentity(context) && context.track === 'collateral'
        ? (({ composition: _referenceComposition, ...projectItem }) => projectItem)(item)
        : item,
      guidance,
      oneLiner: context.brief.oneLiner,
      tone: context.brief.tone,
      ...(houseContract ? { houseContract } : {}),
      ...(exemplar ? { exemplar } : {}),
      ...(composition ? { composition } : {}),
      // Per-section brief copy (the WHAT), matched in plan.ts. Present only when the
      // brief body covered this section; the scripted author ignores it.
      ...(item.content ? { briefContent: item.content } : {}),
      ...(studyPointer ? { studyPointer } : {}),
      ...(priorFindings && priorFindings.length > 0 ? { priorFindings } : {}),
      ...(creativeArtifactImage ? { creativeArtifactImage } : {}),
    };

    const fragment = await author.author(req);
    fragments.push({ frag: fragment, archetype: String(item.archetype), routedClass });
  }

  // ── 2. Assemble rootMarkup (track-conditional; both self-contained) ───────────
  // assembleDocument (below) inlines tokensCss as a <style> and mounts rootMarkup in
  // <div id="root">, so BOTH tracks ship a single self-contained file.
  // - collateral: each fragment wrapped in <section class="cr-page"> inside
  //   <main class="cr-doc"> (authored from scratch; isCollateral(html) true via \bcr-doc\b,
  //   cr-page count === plan.items.length).
  // - website (author-from-governance): the authored section fragments concatenated in
  //   band order — each carries its OWN full-width band + anchor id per the author output
  //   contract. No cr-page wrapper, no v2 shell, no catalog Curation Table.
  let rootMarkup: string;
  let collateralLogoStyle = '';
  if (context.track === 'collateral') {
    // Issue 2 (Fix C): the running footer is engine-owned house furniture, not an author
    // choice. Build the ONE canonical footer once (deterministic from context + governance)
    // and, per page, strip any author/exemplar .cr-page-foot and append the canonical one
    // via the HAST working-rep — so every page's footer is byte-identical. COLLATERAL ONLY.
    const canonicalFooter = buildCanonicalFooter(context, warnings);
    collateralLogoStyle = buildCollateralLogoStyle(context, warnings);
    const projectLabel = context.brandKit?.subject ?? context.brandContract?.subject ?? context.brief.brand ??
      (!hasProjectBrandIdentity(context) ? 'Example Brand' : context.client);
    const crPages = fragments
      .map(({ frag, archetype, routedClass }) => {
        const tree = parseFragment(frag);
        visitElements(tree, (element) => {
          const classes = element.properties.className;
          if (!Array.isArray(classes) || !classes.includes('cr-logo-mark')) return;
          element.properties.ariaLabel = projectLabel;
          if (!collateralLogoStyle) {
            element.children = [{ type: 'text', value: projectLabel }];
            element.properties.className = [...classes, 'cr-logo-mark--text'];
          }
        });
        stripPageFoot(tree);
        injectCanonicalFooter(tree, canonicalFooter);
        const cleanFrag = serializeHtml(tree);

        // Option 2: stamp the routed intelligence CLASS on the page wrapper (engine-owned,
        // deterministic from the content-signal — the author cannot dodge it). The
        // routed-intelligence-application rail reads this to verify the class was realized.
        const routedAttr = routedClass ? ` data-cr-routed="${routedClass}"` : '';

        // The cover is a full-bleed dark page: cr-page--bleed zeroes page padding (the
        // fragment holds its own inner margin), cr-page--dark sets the navy ground.
        // Any OTHER page may opt into a full-bleed frame by marking its root
        // `data-cr-bleed` (e.g. a full-bleed bottom-aligned CTA) — the page padding
        // drops to 0 so an edge-to-edge element renders clean (and a4-bounds, which
        // measures against the page's ACTUAL padding, reads the page edge, not a
        // phantom 16mm box). Such a fragment must hold its own inner padding for any
        // non-bleeding content. The bleed opt-in is tested on cleanFrag (post-serialize).
        const cls =
          archetype === 'CoverPage'
            ? 'cr-page cr-page--bleed cr-page--dark'
            : /\bdata-cr-bleed\b/.test(cleanFrag)
              ? 'cr-page cr-page--bleed'
              : 'cr-page';
        return `<section class="${cls}"${routedAttr}>\n${cleanFrag}\n</section>`;
      })
      .join('\n');
    rootMarkup = `<main class="cr-doc">\n${crPages}\n</main>`;
  } else {
    rootMarkup = fragments.map((f) => f.frag).join('\n');
  }

  // ── 3. Re-read the raw tokensCss (full file — @font-face + base styles) ──────
  // Do NOT serialize context.tokens back to CSS — that drops @font-face and base
  // styles. Read the actual file so the <style> block is complete (collateral sheet).
  const brandDir = resolveBrandContract(context.client, context.track);
  const cssPath = join(brandDir, 'colors_and_type.css');
  if (!existsSync(cssPath)) {
    throw new Error(
      `authorDocument: colors_and_type.css not found at resolved brand dir.\n` +
        `  Expected: ${cssPath}\n` +
        `  This should have been caught by buildContext — something bypassed Stage 1.`,
    );
  }
  let tokensCss = readFileSync(cssPath, 'utf8');

  // Inline the brand CSS's relative @font-face url() refs (url("fonts/*.ttf") →
  // data:font/ttf;base64,…). These are relative to the BRAND dir (where the TTFs
  // live), not the eventual output's path, so resolve against brandDir. This makes
  // the document genuinely self-contained (no font 404s) on ALL paths — fonts come
  // from the brand CSS, not the author, so this is not deferrable to the LLM path.
  // Deterministic: base64 of fixed TTFs is stable across runs.
  tokensCss = rewriteCssUrls(tokensCss, brandDir, warnings);

  // ── 4. Assemble the self-contained document (track-conditional tail) ──────────
  // collateral: inlineStyle = A4 geometry + footer-pin + the Example Brand logo lockup
  //   (a4-bounds render rail reads this); zero JS (charter).
  // website: no inlineStyle; inline the house behaviour library (reveal / count-up /
  //   active-nav — the JS twin of colors_and_type.css) as the ONE trusted <script>
  //   assembleDocument emits after #root. Degrades cleanly (CSS hooks rest visible) if absent.
  let inlineStyle: string | undefined;
  let websiteScript: string | undefined;
  if (context.track === 'collateral') {
    inlineStyle = [
      COLLATERAL_INLINE_STYLE,
      collateralLogoStyle || '.cr-logo-mark--text { display: inline-block; width: auto; height: auto; color: inherit; background-image: none; font-weight: 600; }',
      buildCollateralCoverStyle(context, warnings),
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    const scriptPath = join(brandDir, 'behavior.js');
    if (existsSync(scriptPath)) {
      websiteScript = readFileSync(scriptPath, 'utf8');
    } else {
      warnings.push(
        `website behaviour: behavior.js not found at ${scriptPath} — ships without the ` +
          `reveal/count-up/active-nav library (CSS hooks degrade to their visible resting state).`,
      );
    }
  }

  const html = assembleDocument({
    rootMarkup,
    tokensCss,
    inlineStyle,
    script: websiteScript,
    title: context.brief.oneLiner,
    lang: 'en',
  });

  // ── Authored project imagery → data-URIs ──────────────────────────────
  // Supplied project identities resolve authored images and CSS backgrounds from
  // project references on either active track. Bare website demonstrations use
  // their reference imagery directory. Unresolved files warn without substitution.
  if (context.track === 'website' || hasProjectBrandIdentity(context)) {
    const imageryBase = hasProjectBrandIdentity(context) ? projectReferencesDir(context.client)
      : join(designProcessesDir('website'), 'assets', 'imagery');
    const { html: inlined, warnings: assetWarnings } = inlineAssetsFrom(html, {
      markupBaseDir: imageryBase,
      styleBaseDir: imageryBase,
    });
    warnings.push(...assetWarnings);
    return { html: inlined, warnings };
  }

  return { html, warnings };
}
