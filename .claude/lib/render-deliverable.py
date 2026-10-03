#!/usr/bin/env python3
"""
render-deliverable.py — Playwright runner for the collateral branch (S8C review + S9C handoff).

Loads a built collateral HTML file, then:
  1. measures every unit (a `.page` for a brochure, a `.slide` for a deck): the unit's box, every
     text element's box + computed font-size + colour, and whether anything overflows the unit box
     or overlaps another text element  →  <out>/measurements.json   (the input S8C / collateral-review
     measures its checks against)
  2. renders the deliverable:
       brochure → <out>/<name>.pdf            (A4 portrait, one page per `.page`)
       deck     → <out>/<name>.pdf            (A4 landscape, one page per `.slide`)
                  + <out>/slides/<NN>.png     (per-slide PNGs)
     where <name> is the HTML file's stem.

  --no-pdf: do NOT write the .pdf file. The print render still runs *in memory*
     so the print-paginated page count (used by the review's "page count ==
     declared count" check — pitch-deck / collateral hard rule 3) is still
     reported; only the file write is skipped. This is the mode the S8P/S8C
     review stages use — the PDF deliverable is never auto-created; it is
     rendered on request at the S9P/S9C handoff (with the flag omitted).

  --no-png: do NOT write the per-slide PNGs (deck mode). The review only reads
     measurements.json, so PNGs are wasted work there — and they're regenerated
     every QA iteration. S8P review passes --no-png; the PNGs are produced once
     at the S9P handoff (flag omitted). No effect in brochure mode (no PNGs).

Mirrors the shape of .claude/lib/screenshot-build.py. Python Playwright:
  pip install playwright  &&  playwright install chromium   (the `npx playwright install chromium`
  step in CLAUDE.md installs the browser binary used by either flavour).

Usage:
  python3 .claude/lib/render-deliverable.py --mode brochure|deck --html <path> --out <dir>
                                            [--selector .page|.slide] [--min-text-px 9] [--no-pdf]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# default per-mode settings.
#   brochure → A4 one-pager / sell sheet (.page sized in mm)
#   deck     → 16:9 pitch-deck slides (.slide sized at 1920x1080)
# the viewport is a touch larger than the unit so a centred/shadowed on-screen stack fits
# without a horizontal scrollbar; PDF/PNG capture handles off-viewport content either way.
MODE_DEFAULTS = {
    "brochure": {"selector": ".page",  "viewport": {"width": 900,  "height": 1200}, "min_text_px": 9,  "pdf": {"format": "A4", "landscape": False, "print_background": True}, "unit": "page"},
    "deck":     {"selector": ".slide", "viewport": {"width": 1936, "height": 1096}, "min_text_px": 20, "pdf": {"format": "A4", "landscape": True,  "print_background": True}, "unit": "slide", "png": True},
}

# a deck's slide-nav JS typically hides all but the active slide (display:none, or a
# .hidden / :not(.active) CSS rule) once it runs; Playwright runs that JS, so before
# measuring / screenshotting a deck we force every unit visible.
_SHOW_ALL_UNITS_JS = r"""
(selector) => {
  for (const el of document.querySelectorAll(selector)) {
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.classList.add('active');
    el.classList.remove('hidden', 'inactive', 'is-hidden');
    el.removeAttribute('hidden');
  }
}
"""

# ── the in-page measurement script ──────────────────────────────────────────
# Body lives in `.claude/lib/_measure.js` — shared by this script (S8C) and
# `screenshot-build.py` (S8) so both review stages see identical geometry.
# See that file's header for the per-element / per-unit / per-page schema.
#
# Why the strip: Playwright's Python `page.evaluate(expr, arg)` auto-detects
# whether `expr` is a function (`^\s*(...) =>` or `function ...`); leading `//`
# comments fail that regex and the `arg` gets silently dropped. We keep the doc
# header in the .js file for whoever opens it, and strip it before passing.
def _load_measure_js() -> str:
    raw = Path(__file__).with_name("_measure.js").read_text(encoding="utf-8")
    lines = raw.split("\n")
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and not stripped.startswith("//"):
            return "\n".join(lines[i:])
    return raw  # all-comment file, shouldn't happen
_MEASURE_JS = _load_measure_js()


def _count_pdf_pages(pdf_bytes: bytes) -> int | None:
    """Crude PDF page count: count `/Type /Page` (not `/Pages`). Good enough as a sanity cross-check."""
    try:
        n = len(re.findall(rb"/Type\s*/Page\b", pdf_bytes))
        return n if n > 0 else None
    except Exception:
        return None


def render(mode: str, html: Path, out: Path, selector: str | None, min_text_px: int | None, write_pdf: bool = True, write_png: bool = True) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[playwright] not installed — pip install playwright && playwright install chromium", file=sys.stderr)
        return 1

    if mode not in MODE_DEFAULTS:
        print(f"[render-deliverable] unknown --mode '{mode}' (expected: {', '.join(MODE_DEFAULTS)})", file=sys.stderr)
        return 2
    cfg = MODE_DEFAULTS[mode]
    sel = selector or cfg["selector"]
    floor = min_text_px if min_text_px is not None else cfg["min_text_px"]
    html = html.resolve()
    if not html.is_file():
        print(f"[render-deliverable] no such HTML file: {html}", file=sys.stderr)
        return 2
    out.mkdir(parents=True, exist_ok=True)
    name = html.stem

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=cfg["viewport"])
        try:
            page.goto(html.as_uri(), wait_until="networkidle", timeout=30_000)
        except Exception as e:
            print(f"[render-deliverable] failed to load {html}: {e}", file=sys.stderr)
            browser.close()
            return 1
        page.wait_for_timeout(300)  # let fonts settle

        # for a deck: undo any "show only the active slide" nav JS so every unit is
        # in flow for measurement, PDF pagination, and per-slide screenshots
        if mode == "deck":
            try:
                page.evaluate(_SHOW_ALL_UNITS_JS, sel)
                page.wait_for_timeout(80)
            except Exception as e:
                print(f"[render-deliverable] could not force-show all units: {e}", file=sys.stderr)

        # 1. measure
        try:
            meas = page.evaluate(_MEASURE_JS, sel)
        except Exception as e:
            print(f"[render-deliverable] measurement failed: {e}", file=sys.stderr)
            meas = {"unit_selector": sel, "unit_count": 0, "colors_used": [], "units": []}

        # 2. print render (always run — it yields the print-paginated page count
        #    the review measures). The .pdf file is only WRITTEN when write_pdf;
        #    with --no-pdf the bytes are counted in memory and discarded so no
        #    PDF is auto-created (it's produced on request at the S9 handoff).
        pdf_path = out / f"{name}.pdf"
        pdf_written = False
        try:
            pdf_bytes = page.pdf(format=cfg["pdf"]["format"], landscape=cfg["pdf"]["landscape"],
                                 print_background=cfg["pdf"]["print_background"], margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
            pdf_pages = _count_pdf_pages(pdf_bytes)
            if write_pdf:
                pdf_path.write_bytes(pdf_bytes)
                pdf_written = True
                print(f"[render-deliverable] wrote {pdf_path}  ({pdf_pages} pages)")
            else:
                print(f"[render-deliverable] page count = {pdf_pages} (in-memory; --no-pdf, no file written)")
        except Exception as e:
            print(f"[render-deliverable] print render failed: {e}", file=sys.stderr)
            pdf_pages = None

        # 2b. per-slide PNGs for a deck
        png_paths = []
        if cfg.get("png") and write_png:
            slides_dir = out / "slides"
            slides_dir.mkdir(parents=True, exist_ok=True)
            for i, el in enumerate(page.query_selector_all(sel)):
                el.scroll_into_view_if_needed()
                page.wait_for_timeout(80)
                pth = slides_dir / f"{i + 1:02d}.png"
                el.screenshot(path=str(pth))
                png_paths.append(str(pth.relative_to(out)))
            print(f"[render-deliverable] wrote {len(png_paths)} slide PNGs to {slides_dir}")

        browser.close()

    # 3. assemble + write measurements.json
    report = {
        "mode": mode,
        "html": str(html),
        "name": name,
        "viewport_px": cfg["viewport"],
        "unit_name": cfg["unit"],
        "min_text_px_floor": floor,
        "unit_selector": meas.get("unit_selector"),
        "unit_count": meas.get("unit_count"),
        "pdf_page_count": pdf_pages,
        "pdf_path": str(pdf_path.relative_to(out)) if pdf_written else None,
        "png_paths": png_paths,
        "colors_used": meas.get("colors_used", []),
        "units": meas.get("units", []),
        # quick top-level flags so callers don't have to walk `units` themselves
        # NOTE: `min_font_px` (and therefore `below_min_text`) only considers BODY text — text
        # inside graphic-content regions (charts, mockups, SVGs, [data-graphic] / .cr-graphic
        # wrappers — see GRAPHIC_SEL in _MEASURE_JS) is auto-exempt from the floor.
        # `min_font_px_all_text` is exposed per unit for transparency.
        "any_overflow": any(u.get("overflowing") for u in meas.get("units", [])),
        "any_overlap": any(u.get("overlaps") for u in meas.get("units", [])),
        "below_min_text": [u["index"] for u in meas.get("units", []) if (u.get("min_font_px") or 999) < floor],
        "page_count_ok": (pdf_pages == meas.get("unit_count")) if pdf_pages is not None else None,
    }
    mpath = out / "measurements.json"
    mpath.write_text(json.dumps(report, indent=2))
    print(f"[render-deliverable] wrote {mpath}")
    # exit 0 even if checks failed — the review skill interprets measurements.json; this script only renders.
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", required=True, choices=list(MODE_DEFAULTS))
    ap.add_argument("--html", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--selector", default=None, help="override the unit selector (default: .page for brochure, .slide for deck)")
    ap.add_argument("--min-text-px", type=int, default=None, dest="min_text_px", help="override the format's minimum text size")
    ap.add_argument("--no-pdf", action="store_true", dest="no_pdf", help="do not write the .pdf file; still count print pages in memory (used by S8P/S8C review)")
    ap.add_argument("--no-png", action="store_true", dest="no_png", help="do not write per-slide PNGs (deck mode); still measure. Used by S8P review — PNGs render at S9P handoff")
    args = ap.parse_args()
    return render(args.mode, Path(args.html), Path(args.out), args.selector, args.min_text_px, write_pdf=not args.no_pdf, write_png=not args.no_png)


if __name__ == "__main__":
    sys.exit(main())
