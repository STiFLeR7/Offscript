// _measure.js — shared in-page measurement script for the review stages.
//
// Loaded by .claude/lib/render-deliverable.py (S8C — collateral) and by
// .claude/lib/screenshot-build.py (S8 — landing page). One source of truth so
// both pipelines see the same geometry / colors / overflow / overlap data.
//
// `selector` argument:
//   - a CSS selector string (".page" / ".slide") → measures per matching unit;
//     the returned shape is `{unit_selector, unit_count, colors_used, units:[…]}`.
//   - null / "" → "measure the whole page as one unit" (landing-page use). The
//     synthetic unit is the documentElement; `horizontal_overflow` is reported.
//
// Text inside any element matching GRAPHIC_SEL is treated as "graphic content"
// (chart axis labels / legends / data callouts; SVG <text>; device-screenshot
// mockup internals; explicitly opted-out wrappers marked with `.cr-graphic` or
// `[data-graphic]`). Graphic content is recorded per element (`inside_graphic`)
// and excluded from `min_font_px` / `below_min_text` — the min-text floor is a
// body-text rule, not a graphic-content rule. To opt a wrapper out from the
// build, give it `class="cr-graphic"` or `data-graphic` (preferred), or use
// one of the native shortcuts in the selector list.
//
// ── Pixel-precision additions (additive — all original fields preserved) ──
// per-element extras: role · z_index · natural_w / natural_h · clipped
// per-unit extras:
//   - overlaps_element_on_text : non-text element painted over a text bbox
//   - overlaps_line_on_text    : hairline (1–3 px) crossing a text element
//   - overflowing_any          : non-text element past the unit edge
//   - broken                   : 0×0 image / SVG, failed URL, clipped text
//   - spacing_samples          : observed top-pad / bottom-reserve / inter-gaps
//   - z_inversions             : visual-front element has lower role tier than back
// per-page extra (when selector is null):
//   - horizontal_overflow      : scroll_w / client_w / overflow_px
//
// TOLERANCE block at the top is the single tuning surface. Existing thresholds
// (overflow ±2 px, overlap > 4 px², font 999 sentinel) stay; new thresholds
// added alongside so the review skill can reference the same source.

(selector) => {
  const TOLERANCE = {
    overflowPx: 2,           // sub-pixel slop on overflow checks
    overlapAreaPx2: 12,      // grazing-touch threshold for new overlap classes
    overlapAreaPx2Text: 4,   // original text-on-text threshold (unchanged)
    lineThicknessPx: 3,      // 1–3 px counts as "rule / hairline"
    lineSpanFrac: 0.80,      // a line spans ≥ 80% of its axis
    spacingMacroPx: 2,       // ±2 px on macro-grid (8 pt) spacing
    spacingMicroPx: 1,       // ±1 px on micro-grid (4 pt) spacing
    imgZeroPx: 1,            // <img>/<svg> with bbox.w*h ≤ 1 px² = broken
  };
  const GRAPHIC_SEL = '.cr-graphic, [data-graphic], .chart, .chart-card, .data-viz, .viz, .device, .device-frame, .device-mockup, .mockup, [data-mockup], svg, figure[role="img"]';

  // ── basic geometry helpers (existing behaviour preserved verbatim) ──
  const round = (n) => Math.round(n * 100) / 100;
  const rect  = (el) => { const r = el.getBoundingClientRect(); return {x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height), right: round(r.right), bottom: round(r.bottom)}; };
  const hasOwnText = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
  const isGraphic  = (el) => el.closest(GRAPHIC_SEL) !== null;
  const intersect = (a, b) => {
    const ix = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    if (ix <= 1 || iy <= 1) return 0;
    return round(Math.min(ix * iy, Math.min(a.w * a.h, b.w * b.h)));
  };
  const contains = (a, b) => a.x <= b.x && a.y <= b.y && a.right >= b.right && a.bottom >= b.bottom;
  const isHidden = (el, cs) => cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0;

  // ── role classification (additive) — used by z-index discipline + overlap labels ──
  // Tiers: decoration (0) < graphic (1) < content (2) < chrome (3).
  // Heuristic: combines tag, class-name hints, computed pointer-events, and the
  // shape of the element. Conservative — when in doubt, "content".
  const classifyRole = (el, cs, geom, hasText) => {
    const cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
    const tag = el.tagName.toLowerCase();
    const ptr = cs.pointerEvents;
    const op  = parseFloat(cs.opacity);
    // 1. chrome — site/page navigation, fixed top bars, persistent footers
    if (tag === 'header' || tag === 'nav' || tag === 'footer') return 'chrome';
    if (/\b(navbar|topbar|header-bar|sticky|fixed-bar|pheader|page-header|page-footer)\b/.test(cls)) return 'chrome';
    // 2. line — narrow + axis-spanning (hairline / divider)
    if (geom.w > 0 && geom.h > 0) {
      const thin = Math.min(geom.w, geom.h) <= TOLERANCE.lineThicknessPx;
      if (thin) return 'line';
    }
    // 3. graphic — inside the graphic selector, or an image/svg tag
    if (isGraphic(el)) return 'graphic';
    if (tag === 'img' || tag === 'picture' || tag === 'video') return 'image';
    if (tag === 'svg') return 'graphic';
    // 4. decoration —
    //   (a) non-interactive low-opacity elements (faded watermarks, ghost numerals,
    //       background type) — even when they carry text, they're decorative
    //   (b) explicit class hints + pointer-events:none + no own text
    if (ptr === 'none' && (op < 0.25 || /\b(watermark|backdrop|stripe|flourish|grain|ovals?|arc|arcs|decoration|deco|ornament|chevron|trapezoid|banner-bg|bg-|atmosphere|ghost|chapter-num)\b/.test(cls))) return 'decoration';
    if (!hasText && ptr === 'none') return 'decoration';
    if (/\b(watermark|backdrop|stripe|flourish|grain|ovals?|arc|arcs|decoration|deco|ornament|chevron|trapezoid|banner-bg|bg-|atmosphere|ghost|chapter-num)\b/.test(cls) && !hasText) return 'decoration';
    // 5. content — everything else with own text, or non-tiny boxes
    if (hasText) return 'text';
    return 'box';
  };
  const roleTier = (role) => ({decoration: 0, line: 0, graphic: 1, image: 1, box: 1, text: 2, content: 2, chrome: 3}[role] ?? 1);

  // ── compute effective z-index (climbs stacking contexts to find a non-auto value) ──
  const effectiveZ = (el) => {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const z = getComputedStyle(cur).zIndex;
      if (z && z !== 'auto') { const n = parseInt(z, 10); if (!Number.isNaN(n)) return n; }
      cur = cur.parentElement;
    }
    return 0;
  };

  // ── colours used across the whole document (existing behaviour, unchanged) ──
  const colorsUsed = new Set();
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderLeftColor].forEach(c => {
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') colorsUsed.add(c);
    });
  });

  // ── per-page horizontal overflow (new — used when selector is null/empty) ──
  const horizontal_overflow = {
    scroll_w:    document.documentElement.scrollWidth,
    client_w:    document.documentElement.clientWidth,
    overflow_px: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  };

  // ── unit set: matching elements, or the whole documentElement as a synthetic unit ──
  const useWholePage = !selector || selector === '*' || selector === ':root';
  const unitEls = useWholePage ? [document.documentElement] : [...document.querySelectorAll(selector)];

  const units = unitEls.map((unit, idx) => {
    const ur = rect(unit);
    const ucs = getComputedStyle(unit);
    const clips = ucs.overflow === 'hidden' || ucs.overflowX === 'hidden' || ucs.overflowY === 'hidden';

    // ── enumerate every visible descendant once, with full classification ──
    const all = [...unit.querySelectorAll('*')].map(el => {
      const r = rect(el);
      const ecs = getComputedStyle(el);
      if (r.w <= 0 || isHidden(el, ecs)) return null;  // skip invisible/zero-size
      const text = hasOwnText(el) ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
      const role = classifyRole(el, ecs, r, !!text);
      const tag = el.tagName.toLowerCase();
      const item = {
        tag,
        font_px: parseFloat(ecs.fontSize) || null,
        color: ecs.color,
        inside_graphic: isGraphic(el),
        role,
        z_index: effectiveZ(el),
        rel: {x: round(r.x - ur.x), y: round(r.y - ur.y), w: r.w, h: r.h, right: round(r.right - ur.x), bottom: round(r.bottom - ur.y)},
        abs: r,
        text,
        el,
      };
      // image / svg brokenness
      if (tag === 'img') {
        item.natural_w = el.naturalWidth || 0;
        item.natural_h = el.naturalHeight || 0;
        item.src = el.currentSrc || el.src || '';
      } else if (tag === 'svg') {
        item.svg_bbox_w = r.w; item.svg_bbox_h = r.h;
      }
      // clipped text: text content actually being cut off by a NESTED
      // overflow:hidden ancestor (not by the unit itself — the unit's
      // overflow:hidden is the backstop reported via `overflowing` /
      // `overflowing_any`, not as "clipped text"). Threshold ≥ 4 px so the
      // 1-2 px scrollHeight noise from line-height ascenders doesn't fire.
      if (text && (el.scrollHeight - el.clientHeight) >= 4) {
        let p = el.parentElement;
        while (p && p !== unit) {  // stop AT the unit, don't walk into the unit itself
          const pcs = getComputedStyle(p);
          if (pcs.overflow === 'hidden' || pcs.overflowY === 'hidden') { item.clipped = true; break; }
          p = p.parentElement;
        }
      }
      return item;
    }).filter(x => x);

    // ── text-bearing items used by overlap / overflow / min-text rows.
    //    `role === 'decoration'` excluded — a faded watermark or ghost numeral
    //    behind the content is intentional, not "text" for review purposes.
    //    (Pre-Step-2 the original code didn't have role classification, so this
    //    filter is purely additive; it removes false positives like the giant
    //    cover watermark on a TitleSlide getting flagged as overlapping the headline.)
    const texts = all.filter(t => t.text && t.rel.w > 0 && t.role !== 'decoration');
    const bodyTexts = texts.filter(t => !t.inside_graphic);

    // ── ORIGINAL: text-only overflow past the unit (preserved verbatim) ──
    const TOL = 1.5;
    const overflow_right  = round(Math.max(0, ...texts.map(t => t.abs.right  - ur.right)));
    const overflow_bottom = round(Math.max(0, ...texts.map(t => t.abs.bottom - ur.bottom)));
    const overflowing = texts.filter(t => t.abs.right - ur.right > TOL || t.abs.bottom - ur.bottom > TOL)
                             .map(t => ({tag: t.tag, text: t.text, inside_graphic: t.inside_graphic, over_right: round(Math.max(0, t.abs.right - ur.right)), over_bottom: round(Math.max(0, t.abs.bottom - ur.bottom))}));

    // ── ORIGINAL: text-on-text overlaps. Original logic preserved; the only
    //    change is a DOM-ancestor skip alongside the bbox-contains skip — the
    //    bbox check misses inline children whose box pokes slightly outside the
    //    parent's content box (line-height padding), causing false positives
    //    like `<h1>... <span class="grad">5%</span> ...</h1>` reading as h1↔span overlap.
    const overlaps = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j];
        if (a.inside_graphic && b.inside_graphic) continue;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;       // DOM-based skip
        const area = intersect(a.rel, b.rel);
        if (area > TOLERANCE.overlapAreaPx2Text && !contains(a.rel, b.rel) && !contains(b.rel, a.rel)) {
          overlaps.push({a: {tag: a.tag, text: a.text}, b: {tag: b.tag, text: b.text}, area});
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // NEW — pixel-precision additions
    // ──────────────────────────────────────────────────────────────────────

    // (a) element-on-text overlap: a non-text element painted over a text bbox.
    //     Skip pairs where ANY of the two ancestors-the-other, and both-graphic pairs.
    const overlaps_element_on_text = [];
    for (const t of texts) {
      if (t.inside_graphic) continue;
      for (const e of all) {
        if (e === t || e.text) continue;                      // need non-text partner
        if (e.role === 'line') continue;                       // lines handled separately
        if (e.inside_graphic) continue;
        if (e.el.contains(t.el) || t.el.contains(e.el)) continue;
        const area = intersect(t.rel, e.rel);
        if (area > TOLERANCE.overlapAreaPx2) {
          overlaps_element_on_text.push({
            text:   {tag: t.tag, text: t.text, role: t.role, z_index: t.z_index},
            element:{tag: e.tag, role: e.role, z_index: e.z_index, rel: e.rel},
            area,
          });
        }
      }
    }

    // (b) line-on-text overlap: a hairline (≤ lineThicknessPx, spans ≥ lineSpanFrac
    //     of its parent's axis) whose bbox center-line crosses a text element bbox.
    const overlaps_line_on_text = [];
    const lines = all.filter(e => e.role === 'line');
    for (const ln of lines) {
      const horizontal = ln.rel.w >= ln.rel.h;
      const parentRect = ln.el.parentElement ? rect(ln.el.parentElement) : ur;
      const parentAxis = horizontal ? Math.max(1, parentRect.w) : Math.max(1, parentRect.h);
      const spanFrac = horizontal ? ln.rel.w / parentAxis : ln.rel.h / parentAxis;
      if (spanFrac < TOLERANCE.lineSpanFrac) continue;
      for (const t of texts) {
        if (t.inside_graphic) continue;
        if (ln.el.contains(t.el) || t.el.contains(ln.el)) continue;
        const area = intersect(t.rel, ln.rel);
        if (area > TOLERANCE.overlapAreaPx2 / 2) {  // lines are thin; halve threshold
          overlaps_line_on_text.push({
            line: {tag: ln.tag, role: ln.role, axis: horizontal ? 'h' : 'v', span_frac: round(spanFrac), rel: ln.rel},
            text: {tag: t.tag, text: t.text},
            area,
          });
        }
      }
    }

    // (c) any-element overflow past the unit bounds (non-text — text already handled)
    const overflowing_any = all
      .filter(e => !e.text)                                         // text already covered
      .filter(e => !e.inside_graphic)                                // chart/mockup internals exempt
      .filter(e => e.role !== 'decoration')                          // decorative bleed is intentional
      .filter(e => e.abs.right - ur.right > TOLERANCE.overflowPx || e.abs.bottom - ur.bottom > TOLERANCE.overflowPx)
      .map(e => ({tag: e.tag, role: e.role, over_right: round(Math.max(0, e.abs.right - ur.right)), over_bottom: round(Math.max(0, e.abs.bottom - ur.bottom))}));

    // (d) broken components: zero-pixel img, zero-bbox svg, clipped text
    const broken = [];
    for (const e of all) {
      if (e.tag === 'img' && e.natural_w === 0) {
        broken.push({kind: 'zero_image', tag: 'img', src: e.src, rel: e.rel});
      } else if (e.tag === 'img' && (e.rel.w * e.rel.h) <= TOLERANCE.imgZeroPx) {
        broken.push({kind: 'zero_displayed_image', tag: 'img', src: e.src, rel: e.rel});
      } else if (e.tag === 'svg' && (e.rel.w * e.rel.h) <= TOLERANCE.imgZeroPx) {
        broken.push({kind: 'zero_svg', tag: 'svg', rel: e.rel});
      }
      if (e.clipped) {
        broken.push({kind: 'clipped_text', tag: e.tag, text: e.text, rel: e.rel});
      }
    }

    // (e) spacing samples: distance from unit top to first child top; from unit
    //     bottom to last child bottom; inter-section gaps among direct children.
    //     Review skill compares against <format>.metrics (collateral) or the
    //     Design.md macro/micro grid (page).
    const spacing_samples = (() => {
      const kids = [...unit.children].filter(c => {
        const cs = getComputedStyle(c); return !isHidden(c, cs);
      }).map(c => ({tag: c.tagName.toLowerCase(), r: rect(c)}));
      if (!kids.length) return {top_pad: null, bottom_reserve: null, section_gaps: []};
      const top_pad = round(kids[0].r.y - ur.y);
      const bottom_reserve = round(ur.bottom - kids[kids.length - 1].r.bottom);
      const section_gaps = [];
      for (let i = 1; i < kids.length; i++) {
        section_gaps.push({between: [kids[i - 1].tag, kids[i].tag], px: round(kids[i].r.y - kids[i - 1].r.bottom)});
      }
      return {top_pad, bottom_reserve, section_gaps};
    })();

    // (f) z-index inversions: for every overlap pair recorded above, sample the
    //     painted-front element at the overlap center; flag if its role tier is
    //     LOWER than the back element's (decoration painted over content, etc.).
    const z_inversions = [];
    const probeInversion = (a, b) => {
      const ax = (Math.max(a.abs.x, b.abs.x) + Math.min(a.abs.right, b.abs.right)) / 2;
      const ay = (Math.max(a.abs.y, b.abs.y) + Math.min(a.abs.bottom, b.abs.bottom)) / 2;
      const front = document.elementFromPoint(ax, ay);
      if (!front) return null;
      // resolve front to whichever of a / b (or their ancestors) it actually is
      const isAOrAncestor = (target, el) => target === el || target.contains(el) || el.contains(target);
      let frontSide = null;
      if (isAOrAncestor(front, a.el)) frontSide = 'a';
      else if (isAOrAncestor(front, b.el)) frontSide = 'b';
      if (!frontSide) return null;
      const back = (frontSide === 'a') ? b : a;
      const frt  = (frontSide === 'a') ? a : b;
      if (roleTier(frt.role) < roleTier(back.role)) {
        return {
          front: {tag: frt.tag, role: frt.role, z_index: frt.z_index, text: frt.text || null},
          back:  {tag: back.tag, role: back.role, z_index: back.z_index, text: back.text || null},
        };
      }
      return null;
    };
    // Walk every text↔non-text pair whose role tiers DIFFER; probe the painted
    // front via document.elementFromPoint. If the front element is the lower-
    // tier one, that's an inversion (decoration painted over text, etc.).
    for (const t of texts) {
      if (t.inside_graphic) continue;
      for (const e of all) {
        if (e === t || e.inside_graphic) continue;
        if (e.el.contains(t.el) || t.el.contains(e.el)) continue;
        if (roleTier(t.role) === roleTier(e.role)) continue;
        const area = intersect(t.rel, e.rel);
        if (area <= TOLERANCE.overlapAreaPx2) continue;
        const inv = probeInversion(t, e);
        if (inv) z_inversions.push(inv);
      }
    }

    // ── return shape — ORIGINAL fields first (unchanged), then additions ──
    return {
      index: idx, box: ur, clips,
      overflow_right, overflow_bottom, overflowing, overlaps,
      min_font_px:           bodyTexts.length ? round(Math.min(...bodyTexts.map(t => t.font_px || 999))) : null,
      min_font_px_all_text:  texts.length     ? round(Math.min(...texts.map(t => t.font_px || 999)))     : null,
      text_elements: texts.length,
      text_elements_body: bodyTexts.length,
      text_elements_graphic: texts.length - bodyTexts.length,
      // NEW additive fields (pixel-precision)
      overlaps_element_on_text,
      overlaps_line_on_text,
      overflowing_any,
      broken,
      spacing_samples,
      z_inversions,
    };
  });

  return {
    unit_selector: selector,
    unit_count: units.length,
    colors_used: [...colorsUsed].sort(),
    units,
    // page-level extra — populated whether selector matched or not
    horizontal_overflow,
    tolerance: TOLERANCE,
  };
}
