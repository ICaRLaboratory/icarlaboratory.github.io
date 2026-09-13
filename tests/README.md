# Automated checks

`.github/workflows/checks.yml` runs on pushes and pull requests with read-only
repository permissions and no persisted checkout credentials, deployment step,
or repository secrets. Publishing integration tests create their own temporary
repositories and local bare remotes; they never publish this checkout.

CI checks JavaScript/Bash syntax, news unit tests, publishing safeguards,
self-hosted font coverage and asset checksums, and the real `browser-checks.html` harness in headless
Chromium. The harness also checks gallery strip endpoint focus, album-specific
button names, and reduced-motion scrolling. `lightbox-interactions.mjs` uses
native double/triple clicks and touch input, compares image screenshots before
and after rapid navigation, and exercises delayed/failed image loads, Retry,
and close-during-load cleanup. Network failures in its image fixtures are
intentional; unexpected page errors still fail the checks.

Native interaction checks also cover mobile-menu keyboard and mixed pointer/keyboard
navigation, language selection across reloads, page navigation and same-document
Back/Forward (Research anchors, Skip and Gallery year hashes), and simulator
radio-group keys. Simulator state checks cover pause/history preservation across
panel changes, conditional playback resumption, Replay, parameter changes and
reduced motion. Document visibility changes are simulated in these checks; they
do not certify physical browser-tab switching.

Publication checks cover title/author/venue/DOI search, combined type/year filters,
result announcements, empty/reset states, safe query rendering and URL restoration.
Research checks cover native section-link navigation, focus, deep links and
contextual routes to Publications and Contact. Both include narrow-screen checks.
Publication URLs use `q`, `type` (`journal`, `conference`, `domestic`, `all`) and
`year`. Initial selection and Reset use All. An explicitly chosen type remains
selected while typing and after reload. Reset removes only these publication
parameters; unrelated parameters and the fragment are preserved.
Search requires every whitespace-separated word to match across title, authors,
venue or DOI, ignoring case. Bare DOIs, `doi:` prefixes and DOI resolver URLs are
supported; the original query remains in the input and URL. It does not add fuzzy
or quoted-phrase syntax. Checks cover highlights across author-formatting
boundaries, immediate visibility after search updates, editing-session history,
and print-only query/type/year summaries.
Compact-layout checks cover KO/EN at 320, 390, 768 and 1280px: search/result placement,
native control order, 44px targets, clipping, and attributed Scholar/ORCID links.
`accessibility-interactions.mjs` checks actual text contrast with axe-core on all
seven main pages in KO/EN at 320 and 1280px. A current-date news fixture keeps
announcement contrast covered after real news expires. The same pages are checked
in print media for a removed navigation slot and restored screen navigation.
Axe is injected only by the test runner, never loaded by the published pages.
Automated contrast checks do not replace manual accessibility review.
`contact-layout-interactions.mjs` checks Contact and Members contact rows in KO/EN
at 320, 360, 768 and 1280px, in screen and print media. It measures actual label
text bounds, value containment, and unchanged contact text/links at normal and
200% root-font size. Root-font scaling simulates text enlargement, not native zoom.
The browser suite has a 180-second overall deadline for its expanded native checks.

Failed assertions, empty results, uncaught page errors, console errors
from this site's own files, and local HTTP errors fail the browser step. Console
errors from another origin do not: the contact page embeds a map, and that
service having a bad day is not a fault in this repository. The runner binds Python's
HTTP server to loopback on an OS-assigned port, verifies HTTP readiness, applies
timeouts, and closes the server/browser on completion, failure, or interruption.

The site still has no runtime package dependencies or build step. Playwright is
installed outside the checkout for testing only. To reproduce browser CI on Linux
with Node.js 22+ and Python 3:

```bash
deps=$(mktemp -d)
trap 'rm -rf "$deps"' EXIT
npm install --prefix "$deps" --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.63.0 axe-core@4.13.0
node "$deps/node_modules/playwright/cli.js" install chromium
PLAYWRIGHT_MODULE="$deps/node_modules/playwright/index.mjs" \
AXE_SCRIPT="$deps/node_modules/axe-core/axe.min.js" node tools/run-browser-checks.mjs
```

On a fresh Linux machine, use `install --with-deps chromium` instead to install
Chromium's system libraries (may require administrator privileges). `PYTHON` can
select a different Python executable. No separately managed HTTP server is needed.

Other checks:

```bash
node --test tests/news.test.cjs
python3 -m unittest discover -s tests -p test_publish.py -v
# Install fonttools==4.46.0 and Brotli==1.1.0 in a development Python environment.
python3 tools/check-font-coverage.py
python3 -m unittest discover -s tests -p test_font_loading.py -v
bash -n publish.sh
node --check tools/run-browser-checks.mjs
git diff --check
```

The action commit pins and tool versions are maintained in
`.github/workflows/checks.yml`. When updating actions or Playwright, verify
upstream refs and rerun these checks. Site checks validate the repository;
GitHub Pages deployment must be checked separately.
