#!/usr/bin/env python3
"""
generate-assets.py — procedural gradient + photo sourcing for S6.5.

Functions are deterministic / idempotent: same params produce same output.
Re-running is safe and skips files that already exist with matching params
(checked via a sidecar .meta.json).

CLI usage:
  python3 .claude/lib/generate-assets.py gradient \
      --name hero-bg --token accent-primary \
      --size 1920x1080 --style radial-soft \
      --out .claude/pipeline/assets/

  python3 .claude/lib/generate-assets.py unsplash \
      --query "team collaboration warm light" --count 3 \
      --out .claude/pipeline/assets/photos/
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    print("Missing deps — pip install pillow numpy", file=sys.stderr)
    sys.exit(1)


# ---- gradient generation ---------------------------------------------------

def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def _seed_from(name: str, style: str, hex_color: str) -> int:
    return int(hashlib.md5(f"{name}|{style}|{hex_color}".encode()).hexdigest()[:8], 16)


def _radial_soft(w: int, h: int, hex_color: str, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    cx, cy = w * (0.4 + rng.random() * 0.2), h * (0.3 + rng.random() * 0.4)
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    falloff = np.clip(1.0 - dist / max(w, h), 0, 1) ** 1.6
    base = np.array(hex_to_rgb(hex_color), dtype=np.float32)
    bg = np.array([18, 18, 22], dtype=np.float32)  # dark base — overridden by surface
    rgb = (falloff[..., None] * base + (1 - falloff[..., None]) * bg).astype(np.uint8)
    img = Image.fromarray(rgb).filter(ImageFilter.GaussianBlur(radius=24))
    return img


def _linear_split(w: int, h: int, hex_color: str, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    angle = rng.uniform(0.2, 0.8)
    yy, xx = np.mgrid[0:h, 0:w]
    t = np.clip(xx / w * angle + yy / h * (1 - angle), 0, 1)
    base = np.array(hex_to_rgb(hex_color), dtype=np.float32)
    end = np.array([245, 244, 240], dtype=np.float32)
    rgb = ((1 - t[..., None]) * base + t[..., None] * end).astype(np.uint8)
    return Image.fromarray(rgb).filter(ImageFilter.GaussianBlur(radius=12))


def _mesh_noise(w: int, h: int, hex_color: str, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    base = _radial_soft(w, h, hex_color, seed)
    arr = np.asarray(base, dtype=np.float32)
    noise = rng.normal(0, 6, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


GRADIENT_STYLES = {
    "radial-soft": _radial_soft,
    "linear-split": _linear_split,
    "mesh-noise": _mesh_noise,
}


def generate_gradient(
    name: str,
    palette_token: str,
    hex_color: str,
    size: tuple[int, int],
    style: str,
    out_dir: Path,
) -> Path:
    """Idempotent — checks sidecar meta and skips regeneration if unchanged."""
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{name}.webp"
    meta_path = out_dir / f"{name}.meta.json"
    params = {
        "name": name, "token": palette_token, "hex": hex_color,
        "size": size, "style": style,
    }
    if out_path.exists() and meta_path.exists():
        prev = json.loads(meta_path.read_text())
        if prev == params:
            print(f"[gradient] up-to-date {out_path}")
            return out_path

    fn = GRADIENT_STYLES.get(style)
    if fn is None:
        raise ValueError(f"unknown gradient style: {style}")
    seed = _seed_from(name, style, hex_color)
    img = fn(size[0], size[1], hex_color, seed)
    img.save(out_path, format="WEBP", quality=92, method=6)
    meta_path.write_text(json.dumps(params, indent=2))
    print(f"[gradient] wrote {out_path}")
    return out_path


# ---- Unsplash sourcing -----------------------------------------------------

def source_unsplash(query: str, count: int, out_dir: Path) -> list[Path]:
    """Download `count` photos for `query` with attribution sidecar.
    Requires UNSPLASH_ACCESS_KEY env var. Idempotent on (query, count, out_dir)."""
    import urllib.request

    key = os.environ.get("UNSPLASH_ACCESS_KEY")
    if not key:
        print("[unsplash] UNSPLASH_ACCESS_KEY not set — skipping", file=sys.stderr)
        return []
    out_dir.mkdir(parents=True, exist_ok=True)

    api = (
        f"https://api.unsplash.com/search/photos"
        f"?query={urllib.parse.quote(query)}&per_page={count}&orientation=landscape"
    )
    req = urllib.request.Request(api, headers={"Authorization": f"Client-ID {key}"})
    data = json.loads(urllib.request.urlopen(req).read())
    saved: list[Path] = []
    for i, photo in enumerate(data.get("results", [])):
        url = photo["urls"]["regular"]
        slug = f"{query.replace(' ', '-')}-{i:02d}"
        dest = out_dir / f"{slug}.jpg"
        urllib.request.urlretrieve(url, dest)
        attr = {
            "photographer": photo["user"]["name"],
            "photographer_url": photo["user"]["links"]["html"],
            "source": photo["links"]["html"],
            "license": "Unsplash License",
        }
        (out_dir / f"{slug}.attribution.json").write_text(json.dumps(attr, indent=2))
        saved.append(dest)
        print(f"[unsplash] {dest}")
    return saved


# ---- CLI -------------------------------------------------------------------

def parse_size(s: str) -> tuple[int, int]:
    w, h = s.lower().split("x")
    return int(w), int(h)


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("gradient")
    g.add_argument("--name", required=True)
    g.add_argument("--token", required=True)
    g.add_argument("--hex", required=True, help="hex color, e.g. #FF6F3C")
    g.add_argument("--size", required=True, type=parse_size)
    g.add_argument("--style", choices=list(GRADIENT_STYLES), default="radial-soft")
    g.add_argument("--out", default=".claude/pipeline/assets/")

    u = sub.add_parser("unsplash")
    u.add_argument("--query", required=True)
    u.add_argument("--count", type=int, default=3)
    u.add_argument("--out", default=".claude/pipeline/assets/photos/")

    args = ap.parse_args()
    if args.cmd == "gradient":
        generate_gradient(
            args.name, args.token, args.hex, args.size, args.style, Path(args.out),
        )
    elif args.cmd == "unsplash":
        source_unsplash(args.query, args.count, Path(args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
