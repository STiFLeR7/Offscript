#!/usr/bin/env python3
"""
parent-extract.py — programmatic parent-brand extraction for the design pipeline.

Called by /design-init at S1.5 when .claude/pipeline/.parent is set. Outputs
canonical JSON that COMPILE, S6, S6.5, S7, and S8 all read.

Usage:
  python3 .claude/lib/parent-extract.py \\
    --url "https://www.solidroad.com/" \\
    --out .claude/pipeline/research/parent-extraction.json
"""
import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


# ─── HTTP fetch (stdlib urllib first, Scrapling fallback for Cloudflare) ─────
def fetch(url: str) -> str:
    """Fetch HTML. urllib.request first (stdlib, no install needed);
    Scrapling StealthyFetcher fallback for Cloudflare-protected pages."""
    import urllib.request
    import urllib.error

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            text = body.decode(resp.headers.get_content_charset() or "utf-8", errors="replace")
            if len(text) > 1000:
                return text
            print(
                f"[parent-extract] urllib got {len(text)} bytes "
                f"(too short) — falling through to Scrapling",
                file=sys.stderr,
            )
    except urllib.error.HTTPError as e:
        print(
            f"[parent-extract] urllib HTTP {e.code} — falling through to Scrapling",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"[parent-extract] urllib failed: {e}", file=sys.stderr)

    try:
        from scrapling.fetchers import StealthyFetcher  # type: ignore
        fetcher = StealthyFetcher(auto_match=False)
        page = fetcher.fetch(url, network_idle=True)
        # Scrapling's Adaptor exposes raw HTML on .html_content (preferred)
        # or .body; str(page) is a repr, not the full HTML.
        for attr in ("html_content", "body", "text"):
            html = getattr(page, attr, None)
            if html and len(str(html)) > 1000:
                return str(html)
        # Last resort: stringify the adaptor's element tree
        return page.adaptor.html_content if hasattr(page, "adaptor") else str(page)
    except ImportError:
        sys.stderr.write(
            "[parent-extract] scrapling not installed and urllib failed.\n"
            "Install: pip install scrapling\n"
        )
        sys.exit(2)


# ─── Stack detection ─────────────────────────────────────────────────────────
def detect_stack(html: str) -> str:
    if "framerusercontent.com" in html or "framer.app" in html:
        return "framer"
    if "webflow.com" in html or "assets-global.website-files.com" in html:
        return "webflow"
    if "_next/static" in html or "__NEXT_DATA__" in html:
        return "nextjs"
    if "/wp-content/" in html or "wp-includes" in html:
        return "wordpress"
    return "bespoke"


# ─── Colors ──────────────────────────────────────────────────────────────────
_HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b")


def _hue_family(hex_str: str) -> str | None:
    """Crude hue-family classification for multi-accent detection."""
    if hex_str in {"#000000", "#ffffff"}:
        return None
    r, g, b = (int(hex_str[i : i + 2], 16) for i in (1, 3, 5))
    # Skip near-neutrals (low chroma)
    if max(r, g, b) - min(r, g, b) < 40:
        return None
    # Dominant-channel classification
    if g > r and g > b:
        return "green"
    if b > r and b > g:
        return "blue_or_teal"
    if g > b and r > b:
        return "teal" if g > r else "yellow_or_orange"
    if r > g and r > b:
        if g > 100 and b < 100:
            return "yellow_or_orange"
        if b > g:
            return "red_or_pink"
        return "red"
    if b > g and r > g:
        return "purple"
    return None


def extract_colors(html: str) -> dict:
    hexes = [m.lower() for m in _HEX_RE.findall(html)]
    counts = Counter(hexes)
    by_freq = [{"hex": h, "count": c} for h, c in counts.most_common(40)]
    all_hex = sorted(counts.keys())
    families = {f for h in all_hex if (f := _hue_family(h))}
    return {
        "all_hex": all_hex,
        "by_frequency": by_freq,
        "multi_accent": len(families) > 1,
        "hue_families_detected": sorted(families),
    }


# ─── Fonts (@font-face declarations) ─────────────────────────────────────────
_FONT_FACE_RE = re.compile(r"@font-face\s*\{([^}]+)\}", re.DOTALL)
_FAMILY_RE = re.compile(r'font-family:\s*"([^"]+)"')
_WEIGHT_RE = re.compile(r"font-weight:\s*(\d+)")
_URL_RE = re.compile(r'src:\s*url\("([^"]+)"\)')


def extract_fonts(html: str) -> dict:
    families: set[str] = set()
    font_face_urls: list[dict] = []
    for block in _FONT_FACE_RE.finditer(html):
        content = block.group(1)
        fam_m = _FAMILY_RE.search(content)
        url_m = _URL_RE.search(content)
        if fam_m and url_m:
            fam = fam_m.group(1)
            families.add(fam)
            weight_m = _WEIGHT_RE.search(content)
            font_face_urls.append(
                {
                    "family": fam,
                    "weight": int(weight_m.group(1)) if weight_m else 400,
                    "url": url_m.group(1),
                }
            )
    return {
        "families": sorted(families),
        "font_face_urls": font_face_urls,
    }


# ─── Image / SVG asset URLs ──────────────────────────────────────────────────
_IMAGE_RE = re.compile(
    r'https?://[^\s"\'<>]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"\'<>]*)?',
    re.IGNORECASE,
)
_SVG_RE = re.compile(
    r'https?://[^\s"\'<>]+\.svg(?:\?[^\s"\'<>]*)?', re.IGNORECASE
)


def extract_assets(html: str) -> dict:
    # Dedupe by URL stem (strip query string for grouping)
    def _stem(u: str) -> str:
        return u.split("?", 1)[0]

    images_seen: set[str] = set()
    images: list[dict] = []
    for m in _IMAGE_RE.finditer(html):
        u = m.group(0).replace("&amp;", "&")
        stem = _stem(u)
        if stem not in images_seen:
            images_seen.add(stem)
            images.append({"url": u})

    svgs_seen: set[str] = set()
    svgs: list[dict] = []
    for m in _SVG_RE.finditer(html):
        u = m.group(0).replace("&amp;", "&")
        stem = _stem(u)
        if stem not in svgs_seen:
            svgs_seen.add(stem)
            svgs.append({"url": u})

    return {"images": images[:60], "svgs": svgs[:30]}


# ─── Layer names (Framer / Webflow data attributes) ──────────────────────────
_LAYER_RE = re.compile(r'data-framer-name="([^"]+)"')


def extract_layer_names(html: str) -> list[str]:
    return sorted({m.group(1) for m in _LAYER_RE.finditer(html)})


# ─── Customer logos (best-effort from Framer ticker pattern) ─────────────────
def extract_customer_logos(layer_names: list[str]) -> list[str]:
    """Framer sites typically pair desktop layer 'Brand' with 'Mobile Brand'.
    Brands present in both desktop and mobile layer names are customer logos.
    """
    layer_set = set(layer_names)
    mobile_brands = {
        name[len("Mobile "):].strip()
        for name in layer_names
        if name.startswith("Mobile ")
    }
    confirmed = sorted({b for b in mobile_brands if b in layer_set})
    return confirmed


# ─── Meta (title, description, hero, CTA) ────────────────────────────────────
def extract_meta(html: str) -> dict:
    out: dict[str, str] = {}
    title_m = re.search(r"<title>([^<]+)</title>", html)
    if title_m:
        out["title"] = title_m.group(1).strip()
    desc_m = re.search(
        r'<meta\s+name="description"\s+content="([^"]+)"', html
    )
    if desc_m:
        out["description"] = desc_m.group(1).strip()
    h1_m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL)
    if h1_m:
        text = re.sub(r"<[^>]+>", "", h1_m.group(1))
        out["hero_headline"] = re.sub(r"\s+", " ", text).strip()
    for label in [
        "See a demo",
        "Book a demo",
        "Get started",
        "Get a demo",
        "Try free",
        "Contact sales",
        "Sign up free",
        "Start free trial",
    ]:
        if label in html:
            out["primary_cta_label"] = label
            break
    return out


# ─── Mascot identity (best-effort from layer names) ──────────────────────────
def extract_mascot(layer_names: list[str]) -> dict:
    """Look for descriptive animal/mascot tokens in layer names.
    Framer's verbose Magnific / Photoshop-generated names often leak the
    art-direction prompt (e.g. 'a_roadrunner_looking_confidently...').
    """
    mark_layers = [n for n in layer_names if "Mark" in n or "Logo" in n]
    descriptive_names = [
        n for n in layer_names
        if len(n) > 30 and ("_" in n or " " in n)
    ]
    animals = [
        "roadrunner", "fox", "wolf", "bird", "owl", "deer", "lion",
        "tiger", "bear", "eagle", "hawk", "cat", "dog", "horse",
    ]
    mascot_animals = []
    for n in descriptive_names:
        n_lower = n.lower()
        for a in animals:
            if a in n_lower:
                mascot_animals.append({"animal": a, "layer_name": n})
                break
    return {
        "mark_layers": mark_layers[:10],
        "descriptive_layer_names": descriptive_names[:10],
        "mascot_animals_detected": mascot_animals,
    }


# ─── Main ────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Programmatic parent-brand extraction"
    )
    parser.add_argument("--url", required=True, help="Parent URL")
    parser.add_argument(
        "--out", required=True, help="Output JSON path"
    )
    args = parser.parse_args()

    print(f"[parent-extract] fetching {args.url}", file=sys.stderr)
    html = fetch(args.url)
    print(
        f"[parent-extract] fetched {len(html)} bytes", file=sys.stderr
    )

    layer_names = extract_layer_names(html)

    result = {
        "url": args.url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "stack": detect_stack(html),
        "meta": extract_meta(html),
        "colors": extract_colors(html),
        "fonts": extract_fonts(html),
        "assets": extract_assets(html),
        "layer_names": layer_names,
        "customer_logos": extract_customer_logos(layer_names),
        "mascot": extract_mascot(layer_names),
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[parent-extract] wrote {out_path}", file=sys.stderr)

    # Stderr summary
    c = result["colors"]
    print(
        f"  stack:          {result['stack']}\n"
        f"  hex colors:     {len(c['all_hex'])} "
        f"({'multi-accent' if c['multi_accent'] else 'single-accent'})\n"
        f"  hue families:   {c['hue_families_detected']}\n"
        f"  font families:  {result['fonts']['families']}\n"
        f"  layer names:    {len(result['layer_names'])}\n"
        f"  customer logos: {len(result['customer_logos'])} "
        f"({', '.join(result['customer_logos'][:6])}...)\n"
        f"  mascot animals: "
        f"{[m['animal'] for m in result['mascot']['mascot_animals_detected']]}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
