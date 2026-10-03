#!/usr/bin/env python3
"""
screenshot-build.py — Playwright runner for S7 + S8.

Boots the Vite dev server (or attaches to a running one), navigates the built
page, and:
  1. screenshots:
     - full page (desktop + mobile)
     - each named section by selector
     - 3 random scroll positions per animated section (freeze-state audit for S8)
  2. measures (per viewport): runs `.claude/lib/_measure.js` against the whole
     document (no per-unit selector) and writes:
     - measurements-desktop.json
     - measurements-mobile.json
     Same schema as collateral's S8C `measurements.json` — plus the page-level
     `horizontal_overflow` block — so S8 (design-review) gets pixel-precise
     ground truth without the AI agent having to eyeball every alignment.

Saves to .claude/pipeline/components/screenshots/ by default.

Usage:
  python3 .claude/lib/screenshot-build.py [--url=http://localhost:3000]
                                           [--out=.claude/pipeline/components/screenshots]
                                           [--sections=hero,features,pricing,faq,footer]
                                           [--animated=hero,features]
                                           [--seed=42]
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path


# ── shared measurement script (also used by render-deliverable.py) ─────────
# See `.claude/lib/_measure.js` for the per-element / per-unit / per-page schema.
# Leading `//` comment lines are stripped so Playwright's `page.evaluate` auto-
# detects the arrow function (its is-function regex doesn't recognise comment
# prefixes; if it misses, the `selector` arg gets silently dropped).
def _load_measure_js() -> str:
    raw = Path(__file__).with_name("_measure.js").read_text(encoding="utf-8")
    lines = raw.split("\n")
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and not stripped.startswith("//"):
            return "\n".join(lines[i:])
    return raw  # all-comment file, shouldn't happen
_MEASURE_JS = _load_measure_js()


def screenshot(url: str, out_dir: Path, sections: list[str], animated: list[str], seed: int) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[playwright] not installed — pip install playwright && playwright install", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for label, viewport in [("desktop", {"width": 1440, "height": 900}),
                                 ("mobile", {"width": 390, "height": 844})]:
            page = browser.new_page(viewport=viewport)
            try:
                page.goto(url, wait_until="networkidle", timeout=30_000)
            except Exception as e:
                print(f"[screenshot] failed to load {url}: {e}", file=sys.stderr)
                browser.close()
                return 1

            # Full page
            page.screenshot(path=str(out_dir / f"fullpage-{label}.png"), full_page=True)
            print(f"[screenshot] fullpage-{label}.png")

            # Per-section
            for name in sections:
                el = page.query_selector(f"#{name}, [data-section='{name}'], section[data-name='{name}']")
                if not el:
                    print(f"[screenshot] section '{name}' not found", file=sys.stderr)
                    continue
                el.scroll_into_view_if_needed()
                page.wait_for_timeout(400)
                el.screenshot(path=str(out_dir / f"{name}-{label}.png"))
                print(f"[screenshot] {name}-{label}.png")

            # Freeze-state: 3 random scroll positions per animated section
            for name in animated:
                el = page.query_selector(f"#{name}, [data-section='{name}'], section[data-name='{name}']")
                if not el:
                    continue
                box = el.bounding_box()
                if not box:
                    continue
                for i in range(3):
                    offset = rng.randint(0, max(1, int(box["height"])))
                    page.evaluate(
                        "([top, h, off]) => window.scrollTo(0, top + off)",
                        [box["y"], box["height"], offset],
                    )
                    page.wait_for_timeout(150)
                    page.screenshot(
                        path=str(out_dir / f"{name}-freeze-{label}-{i}.png"),
                        clip={"x": 0, "y": 0, "width": viewport["width"], "height": viewport["height"]},
                    )
                    print(f"[screenshot] {name}-freeze-{label}-{i}.png")

            # ── Pixel-precision measurement ──
            # Scroll back to top so the measurement sees the page in its natural
            # state, then evaluate the shared _measure.js with selector=null
            # (= "treat the whole document as the unit"). Write a per-viewport
            # measurements file alongside the screenshots.
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(200)  # let any scroll-driven CSS settle
            try:
                meas = page.evaluate(_MEASURE_JS, None)
                # Helpful flags promoted to top-level for the review skill
                meas["any_overflow_text"]    = any(u.get("overflowing")            for u in meas.get("units", []))
                meas["any_overflow_any"]     = any(u.get("overflowing_any")        for u in meas.get("units", []))
                meas["any_text_overlap"]     = any(u.get("overlaps")               for u in meas.get("units", []))
                meas["any_element_overlap"]  = any(u.get("overlaps_element_on_text") for u in meas.get("units", []))
                meas["any_line_overlap"]     = any(u.get("overlaps_line_on_text")  for u in meas.get("units", []))
                meas["any_broken"]           = any(u.get("broken")                 for u in meas.get("units", []))
                meas["any_z_inversion"]      = any(u.get("z_inversions")           for u in meas.get("units", []))
                meas["horizontal_overflow_px"] = (meas.get("horizontal_overflow") or {}).get("overflow_px", 0)
                meas["viewport"] = viewport
                mpath = out_dir / f"measurements-{label}.json"
                mpath.write_text(json.dumps(meas, indent=2))
                print(f"[measure] wrote {mpath.name}  (h-overflow {meas['horizontal_overflow_px']}px)")
            except Exception as e:
                print(f"[measure] {label} measurement failed: {e}", file=sys.stderr)

            page.close()

        browser.close()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:3000")
    ap.add_argument("--out", default=".claude/pipeline/components/screenshots")
    ap.add_argument("--sections", default="hero,features,pricing,faq,footer")
    ap.add_argument("--animated", default="hero,features")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    sections = [s.strip() for s in args.sections.split(",") if s.strip()]
    animated = [s.strip() for s in args.animated.split(",") if s.strip()]
    return screenshot(args.url, Path(args.out), sections, animated, args.seed)


if __name__ == "__main__":
    sys.exit(main())
