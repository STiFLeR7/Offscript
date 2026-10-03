#!/usr/bin/env python3
"""
capture-reference.py — unified reference capture for S2.

Wraps three operations into one command:
  1. dembrandt CLI for tokens + screenshot extraction
  2. Scrapling StealthyFetcher for Cloudflare-resilient HTML scrape
  3. Playwright section-by-section screenshots with scroll-reveal CSS killed

Usage:
  python3 .claude/lib/capture-reference.py <url> [--mode=full|structure-only]
                                                 [--slug=<slug>]
                                                 [--out=.claude/pipeline/references]

Modes:
  full            — extract tokens, structure, motion, screenshots (DESIGN_MD_MODE=generate)
  structure-only  — extract structure + motion only; ignore tokens (DESIGN_MD_MODE=imported / brand-kit)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

# CSS injected to neutralize scroll-reveal libraries (AOS, GSAP defaults, etc.)
KILL_REVEAL_CSS = (
    "*, *::before, *::after { "
    "animation: none !important; "
    "transition: none !important; "
    "opacity: 1 !important; "
    "transform: none !important; "
    "visibility: visible !important; "
    "}"
)


def slugify(url: str) -> str:
    host = urlparse(url).netloc.replace("www.", "")
    return re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")


def run_dembrandt(url: str, out_dir: Path, mode: str) -> None:
    """Call dembrandt CLI. In structure-only mode we still capture screenshot
    + design-md output; the offscript skill ignores token fields."""
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "dembrandt", url,
        "--design-md",
        "--save-output",
        "--screenshot", str(out_dir / "hero.png"),
    ]
    # Windows: resolve npm shim (dembrandt.cmd/.ps1) via PATHEXT.
    resolved = shutil.which(cmd[0])
    if resolved:
        cmd[0] = resolved
    print(f"[dembrandt] {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f"[dembrandt] FAILED ({e}); continuing without dembrandt output", file=sys.stderr)


def scrape_with_scrapling(url: str, out_dir: Path) -> None:
    """Scrapling StealthyFetcher with reveal-killing CSS. Saves rendered HTML
    + a full-page screenshot."""
    try:
        from scrapling.fetchers import StealthyFetcher
    except ImportError:
        print("[scrapling] not installed — pip install scrapling", file=sys.stderr)
        return

    fetcher = StealthyFetcher(auto_match=False)
    page = fetcher.fetch(
        url,
        headless=True,
        network_idle=True,
        wait_selector="body",
        page_action=lambda p: p.add_style_tag(content=KILL_REVEAL_CSS),
    )
    (out_dir / "page.html").write_text(page.html_content, encoding="utf-8")
    print(f"[scrapling] saved {out_dir / 'page.html'}")


def screenshot_sections(url: str, out_dir: Path) -> None:
    """Playwright section-by-section screenshots. Each <section>, <main > section>,
    or [data-section] gets one viewport-NN.png in out_dir."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[playwright] not installed — pip install playwright && playwright install", file=sys.stderr)
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(url, wait_until="networkidle")
        page.add_style_tag(content=KILL_REVEAL_CSS)

        sections = page.query_selector_all("section, [data-section], main > div")
        for i, sec in enumerate(sections):
            try:
                sec.scroll_into_view_if_needed()
                sec.screenshot(path=str(out_dir / f"viewport-{i:02d}.png"))
            except Exception as e:
                print(f"[playwright] section {i} skipped: {e}", file=sys.stderr)

        page.screenshot(path=str(out_dir / "fullpage.png"), full_page=True)
        browser.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--mode", choices=["full", "structure-only"], default="full")
    ap.add_argument("--slug", default=None)
    ap.add_argument("--out", default=".claude/pipeline/references")
    args = ap.parse_args()

    slug = args.slug or slugify(args.url)
    out_dir = Path(args.out) / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[capture] url={args.url} mode={args.mode} → {out_dir}")
    run_dembrandt(args.url, out_dir, args.mode)
    scrape_with_scrapling(args.url, out_dir)
    screenshot_sections(args.url, out_dir)

    (out_dir / "meta.json").write_text(
        json.dumps({"url": args.url, "mode": args.mode, "slug": slug}, indent=2),
        encoding="utf-8",
    )
    print(f"[capture] done → {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
