# Self-hosted Pretendard

`pretendard-subset.woff2` is the **full, unmodified official Pretendard Variable
v1.3.9**, not a subset. The legacy filename is retained so existing HTML preloads
and `assets/style.css` use the same URL without changes to page content. The font
supports all 11,172 modern Hangul syllables (U+AC00–U+D7A3) and the variable weight
axis 45–930. JetBrains Mono is unchanged by this replacement.

## Provenance and license

- Upstream: https://github.com/orioncactus/pretendard
- Release tag: `v1.3.9`
- Pinned commit: `5c41199ea0024a9e0b2cb31735265056e5472d76`
- Font: https://raw.githubusercontent.com/orioncactus/pretendard/5c41199ea0024a9e0b2cb31735265056e5472d76/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
- License: https://raw.githubusercontent.com/orioncactus/pretendard/5c41199ea0024a9e0b2cb31735265056e5472d76/LICENSE
- Local license: [Pretendard-LICENSE.txt](Pretendard-LICENSE.txt), the upstream SIL
  Open Font License 1.1 including Kil Hyung-jin's copyright notice and Reserved
  Font Name. Both downloaded files are byte-for-byte upstream copies; only their
  local filenames differ.

SHA-256:

```text
9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4  assets/fonts/pretendard-subset.woff2
d31ddd9f2bed32fd7e302a205cf2380ba0de6529152d239ef99cfb6f261bfc04  assets/fonts/Pretendard-LICENSE.txt
```

## Reproduce

From the repository root, with `curl`, `sha256sum`, Python 3 and
`fonttools[woff]` (including Brotli support) available:

```sh
UPSTREAM=https://raw.githubusercontent.com/orioncactus/pretendard/5c41199ea0024a9e0b2cb31735265056e5472d76
curl --fail --location --silent --show-error --retry 2 \
  "$UPSTREAM/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2" \
  --output assets/fonts/pretendard-subset.woff2
curl --fail --location --silent --show-error --retry 2 \
  "$UPSTREAM/LICENSE" --output assets/fonts/Pretendard-LICENSE.txt
sha256sum assets/fonts/pretendard-subset.woff2 assets/fonts/Pretendard-LICENSE.txt
python3 tools/check-font-coverage.py
```

Compare the hashes against those above. No font rebuilding or subsetting is
required when Korean text changes.

The coverage check uses fontTools' Unicode cmap and rejects `.notdef` mappings.
It checks every modern Hangul syllable, current Hangul, all non-whitespace
characters in root HTML and `data/*.js` / `assets/*.js` (a conservative superset
of displayed text, including code and comments), and the CSS weight range.
HTML entities and Unicode escapes are decoded before checking.

Before replacement, the check failed: 139/11,172 modern Hangul syllables,
139/238 current Hangul syllables, and 242/342 current source characters were
covered. After replacement, the same check passed with 11,172/11,172, 238/238,
and 342/342 covered respectively. Current-text totals may change with edits.
