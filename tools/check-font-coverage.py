#!/usr/bin/env python3
"""Check self-hosted Pretendard coverage; requires fonttools[woff]."""
from html import unescape
from pathlib import Path
import re
import sys

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / "assets/fonts/pretendard-subset.woff2"


def main():
    with TTFont(FONT) as font:
        cmap = font.getBestCmap()
        covered = {cp for cp, glyph in cmap.items() if glyph != ".notdef"}
        axes = {axis.axisTag: (axis.minValue, axis.maxValue)
                for axis in font["fvar"].axes} if "fvar" in font else {}
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
    print(f"Variable axes: {axes}")
    if axes.get("wght") != (45.0, 930.0):
        print("FAIL: expected weight axis 45–930 to match CSS")
        failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
