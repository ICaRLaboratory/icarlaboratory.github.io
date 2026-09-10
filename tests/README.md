# Automated checks

`.github/workflows/checks.yml` runs on pushes and pull requests with read-only
repository permissions and no persisted checkout credentials, deployment step,
or repository secrets. Publishing integration tests create their own temporary
repositories and local bare remotes; they never publish this checkout.

CI checks JavaScript/Bash syntax, news unit tests, publishing safeguards,
self-hosted font coverage and asset checksums, and the real `browser-checks.html` harness in headless
Chromium. Failed assertions, empty results, uncaught page errors, console errors
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
npm install --prefix "$deps" --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.63.0
node "$deps/node_modules/playwright/cli.js" install chromium
PLAYWRIGHT_MODULE="$deps/node_modules/playwright/index.mjs" node tools/run-browser-checks.mjs
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

Action commit pins were resolved from the official `actions/checkout` v4.2.2,
`actions/setup-node` v4.4.0 and `actions/setup-python` v5.6.0 tags. When updating
actions or Playwright, verify upstream refs and rerun these checks. Passing checks
does not deploy the site or enable branch protection; repository administrators
must configure required checks separately if desired.
