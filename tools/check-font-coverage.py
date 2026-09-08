#!/usr/bin/env python3
"""Check self-hosted Pretendard coverage; requires fonttools[woff]."""
from html import unescape
from pathlib import Path
import re
import sys

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "assets/fonts/pretendardvariable-dynamic-subset.css"
# Size of the previously preloaded official full v1.3.9 WOFF2; see fonts/README.md.
FULL_FONT_BYTES = 2057688


def load_chunks(css_path=CSS):
    """Use the intersection of each real cmap and its browser-visible CSS range."""
    chunks = []
    for block in re.findall(r"@font-face\s*\{([^}]+)\}", css_path.read_text()):
        url = re.search(r"url\(([^)]+)\)", block).group(1).strip("\"'")
        path = (css_path.parent / url).resolve()
        if not path.is_relative_to(css_path.parent.resolve()):
            raise ValueError(f"Nonlocal font URL: {url}")
        ranges = re.search(r"unicode-range:\s*([^;]+);", block).group(1)
        declared = set()
        for item in ranges.split(','):
            bounds = item.strip()[2:].split('-')
            declared.update(range(int(bounds[0], 16), int(bounds[-1], 16) + 1))
        with TTFont(path) as font:
            cmap = {cp for cp, glyph in font.getBestCmap().items() if glyph != '.notdef'}
            axes = {axis.axisTag: (axis.minValue, axis.maxValue)
                    for axis in font['fvar'].axes} if 'fvar' in font else {}
        weight = tuple(map(float, re.search(r"font-weight:\s*([\d ]+);", block).group(1).split()))
        if axes.get('wght') != (45.0, 930.0) or weight != (45.0, 930.0):
            raise ValueError(f"Expected CSS and variable weight axis 45–930: {path.name}")
        chunks.append((path, declared & cmap))
    if not chunks:
        raise ValueError('No dynamic font faces found')
    return chunks


def main():
    chunks = load_chunks()
    covered = set().union(*(coverage for _, coverage in chunks))
    sources = sorted(set(ROOT.glob("*.html")) | set((ROOT / "data").glob("*.js"))
                     | set((ROOT / "assets").glob("*.js")))
    text = "".join(unescape(path.read_text(encoding="utf-8")) for path in sources)
    # Include escaped Unicode in JavaScript/JSON strings as well as literal text.
    text = re.sub(r"\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})",
                  lambda match: chr(int(match.group(1) or match.group(2), 16)), text)
    current = {ord(char) for char in text if not char.isspace()}
    syllables = set(range(0xAC00, 0xD7A4))
    current_hangul = current & syllables
    checks = [("All modern Hangul syllables", syllables),
              (f"Current Hangul ({len(sources)} HTML/JS files)", current_hangul),
              ("All current non-whitespace HTML/JS characters", current)]
    failed = False
    for label, required in checks:
        missing = sorted(required - covered)
        print(f"{label}: {len(required) - len(missing)}/{len(required)} covered; "
              f"{len(missing)} missing")
        if missing:
            print("  Missing (first 30): " + " ".join(
                f"U+{cp:04X} ({chr(cp)})" for cp in missing[:30]))
            failed = True
    needed = {path for path, coverage in chunks if coverage & current}
    needed_bytes = sum(path.stat().st_size for path in needed)
    print(f"Dynamic chunks: {len(chunks)}; all CSS/variable weight axes: 45–930")
    print(f"Previous full-font bytes: {FULL_FONT_BYTES}")
    print(f"Source-character chunk bytes: {needed_bytes} ({len(needed)} chunks; "
          f"{100 * (1 - needed_bytes / FULL_FONT_BYTES):.1f}% fewer font bytes)")
    print(f"Dynamic CSS bytes (uncompressed): {CSS.stat().st_size}")
    print("Source-character estimate includes code/comments and both languages; "
          "not a browser request count or timing measurement.")
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
