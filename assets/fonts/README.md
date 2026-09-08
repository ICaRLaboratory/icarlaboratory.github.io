# Self-hosted Pretendard dynamic subsets

The site uses all **92 official Pretendard Variable v1.3.9 dynamic WOFF2 chunks**,
selected by the upstream `unicode-range` declarations. All 11,172 modern Hangul
syllables (U+AC00–U+D7A3) remain available, including syllables not currently in
site text. No rebuilding or content-specific subsetting is needed for Korean
text edits. JetBrains Mono and its preload are unchanged.

`assets/style.css` imports the local `pretendardvariable-dynamic-subset.css`
before other rules. Its relative font URLs resolve within this directory.
There is no unconditional Pretendard preload or full-font fallback download.
`font-display: swap` and variable weights 45–930 are preserved.

## Provenance and license

- Upstream: https://github.com/orioncactus/pretendard
- Release: `v1.3.9`
- Pinned commit: `5c41199ea0024a9e0b2cb31735265056e5472d76`
- Upstream directory: `packages/pretendard/dist/web/variable/`
- CSS: `pretendardvariable-dynamic-subset.css`
- Font files: `woff2-dynamic-subset/PretendardVariable.subset.{0..91}.woff2`
- [Pretendard-LICENSE.txt](Pretendard-LICENSE.txt): unmodified upstream `LICENSE`,
  SIL Open Font License 1.1, including copyright and Reserved Font Name.
- [Pretendard-SHA256SUMS](Pretendard-SHA256SUMS): SHA-256 for all local chunks,
  the local CSS, and the license; paths are relative to this directory.

**Only CSS adaptation:** upstream declares `font-weight: 45 920`; each downloaded
font's actual `fvar` weight axis is 45–930. The local CSS changes those 92
weight declarations to `45 930` to preserve the site's previous range. All font
binaries, Unicode ranges, URLs, family/style/display declarations and copyright
comments are otherwise upstream originals. Fonts are not rebuilt or renamed.

Original upstream CSS SHA-256 (before the weight-declaration adaptation):
`2973bcae80262dcb630cfb793fbf6af29bd986c769ee54953fb3e5b3e32323ca`.

## Reproduce

From the repository root, with Python 3 and network access, run this Python
snippet (e.g. paste into `python3`). It fetches only the pinned upstream files,
checks the upstream CSS, stages downloads in memory, then installs the assets.
It does not regenerate the checked-in checksum manifest.

```python
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from pathlib import Path
import re
from urllib.request import urlopen

base = ('https://raw.githubusercontent.com/orioncactus/pretendard/'
        '5c41199ea0024a9e0b2cb31735265056e5472d76/')
web = base + 'packages/pretendard/dist/web/variable/'
root = Path('assets/fonts')

def fetch(url):
    with urlopen(url, timeout=60) as response:
        return response.read()

css = fetch(web + 'pretendardvariable-dynamic-subset.css')
assert sha256(css).hexdigest() == '2973bcae80262dcb630cfb793fbf6af29bd986c769ee54953fb3e5b3e32323ca'
urls = re.findall(rb'url\(([^)]+)\)', css)
assert len(urls) == 92
with ThreadPoolExecutor(max_workers=8) as pool:
    payloads = list(pool.map(lambda url: fetch(web + url.decode()), urls))
license_bytes = fetch(base + 'LICENSE')
for url, payload in zip(urls, payloads):
    target = root / url.decode()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
(root / 'Pretendard-LICENSE.txt').write_bytes(license_bytes)
(root / 'pretendardvariable-dynamic-subset.css').write_bytes(
    css.replace(b'font-weight: 45 920;', b'font-weight: 45 930;'))
```

Then verify (fontTools with Brotli support is required for the coverage test;
install `fonttools[woff]` in a virtual environment if it is not available):

```sh
(cd assets/fonts && sha256sum --check Pretendard-SHA256SUMS)
python3 tools/check-font-coverage.py
python3 -m unittest discover -s tests -p test_font_loading.py -v
```

## Coverage and byte comparison

The checker intersects each real font's Unicode cmap (excluding `.notdef`) with
its CSS `unicode-range`, then unions those sets. It checks all modern Hangul,
current Hangul, and all non-whitespace source characters in root HTML,
`data/*.js`, and `assets/*.js`; HTML entities and JS Unicode escapes are decoded.
Every chunk's variable axis and CSS weight declaration must be 45–930.

At migration: **11,172/11,172** modern Hangul, **238/238** current Hangul, and
**342/342** current source characters across 17 HTML/JS files are covered.
These source totals can change as the site is edited.

The previous unconditionally preloaded full WOFF2 was **2,057,688 bytes**:
upstream `woff2/PretendardVariable.woff2`, previously saved locally under the
legacy filename `pretendard-subset.woff2`, SHA-256
`9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`.
The unused full file remains as a reference asset; no HTML or CSS loads it.
Deletion was not performed because the tool approval gate blocked that action.

The current source-character set intersects **15 chunks totaling 399,008 bytes**
(**80.6% fewer font bytes** than the full font), plus **55,760 bytes of uncompressed
font CSS**. All 92 chunks total 2,957,724 bytes on disk: full-coverage availability
costs more repository storage, but does not force all chunks to be downloaded.

This is a reproducible static byte comparison, **not a measured page-load time
or browser request count**. Sources include both languages, code and comments,
so they conservatively overcount displayed text. Actual requests depend on the
page, language, rendered font usage, browser and cache. The CSS import adds a
stylesheet dependency; measure cold-cache browser requests separately rather
than inferring timing gains from bytes alone.
