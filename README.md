# ICaR Lab website

Static site for the Intelligent Control and Robotics Laboratory, Sejong University.
Replaces <https://sites.google.com/view/seokyounglee>.

No build step, no dependencies. Double-click `index.html` to view it locally.

## Layout

```
index.html          Home — hero figure, stats, research pillars, recent papers
research.html       Research areas + funded projects
members.html        Advisor, graduate students, alumni
publications.html   Journal / conference papers, filterable, grouped by year, DOI-linked
lecture.html        Courses
gallery.html        Event photos, grouped into albums
contact.html        Address, email, map

assets/
  style.css         All styling. Colours are the :root block at the top;
                    .invert is the black band used by the nav, hero and footer.
  site.js           Nav, footer, and the page renderers.
  hero.js           The live hero figure (see below).
  favicon.png
  img/              Logo, portraits, research-area images.

data/
  site.js           Lab identity, contact, advisor CV, research areas
  members.js        Students and alumni
  publications.js   Journal and conference papers, with DOIs
  projects.js       Funded projects
  courses.js        Teaching
  gallery.js        Photo albums
```

## Updating content

Everything you would normally change lives in `data/`.

**Add a paper** — open `data/publications.js`, copy the topmost entry and edit
it. Position in the file does not matter: entries are sorted by year, then by
the month read out of `detail` ("Jul. 2026"), so a paper with no month printed
sorts to the back of its year. Include the `doi` and the title becomes a link to
doi.org automatically. Mark corresponding authors with an asterisk, as the
existing entries do, and add `domestic: true` for a Korean venue so it shows
under the Domestic filter. `S. Y. Lee` in the `authors` string is bolded on its own.
The counters on the home page and the year groups both update themselves.

**Add a student** — add an entry to `GRAD_STUDENTS` in `data/members.js`. Reuse
the `DEG` and `TOPIC` constants at the top of that file. For a photo, drop the file in `assets/img/` and add
`photo: "assets/img/name.jpg"`; without one the card shows a monogram. The
"Undergraduate researchers" section hides itself while its list is empty.

**Graduate someone** — move the entry from `GRAD_STUDENTS` to `ALUMNI`, swap
`DEG.ms` for `DEG.msDone`, and add `graduated: "2027.02"` (plus `now:` for their
current position, if you want it shown).

**Add a project or course** — `data/projects.js` (`status` is `"ongoing"` or
`"completed"`) and `data/courses.js`.

**Add photos** — drop the camera originals in `_originals/gallery/`. That
folder is gitignored, so they stay on this machine: they are far too big for
the repo, and anything committed here is served publicly by GitHub Pages, EXIF
and GPS coordinates included. What goes on the site is a web copy in
`assets/img/gallery/` — graded at full size, resized to 1400px last so the
image is resampled and JPEG-encoded only once, with the metadata dropped. Then
list it in `data/gallery.js`, newest album first.

**Advisor CV, contact, research areas** — `data/site.js`.

Careful with the JavaScript punctuation: every entry needs its quotes, commas and
braces. If a page ever comes up blank, open the browser console (F12) — a missing
comma will say so.

## The hero figure

`assets/hero.js` draws one damped second-order system, three ways: the phase
plane inside the controller block, a two-link arm posed from the same state, and
the zero-order-hold of that state in the sensor block. It is a canvas, so it
stays sharp at any size; it pauses when the tab is hidden and freezes to a single
still frame for visitors who ask for reduced motion.

## Publishing

Plain files, so any static host works. A git repository is already initialised
here — see the GitHub Pages steps below.

1. Create a GitHub organisation (e.g. `icar-lab`), then a **public** repository
   named `<org>.github.io` with no README or .gitignore.
2. `git remote add origin https://github.com/<org>/<org>.github.io.git`
   then `git push -u origin main`.
3. Repo Settings → Pages → deploy from branch `main`, folder `/ (root)`.

`.nojekyll` is already committed so GitHub serves the files as-is.

For university web space instead, upload the whole folder over SFTP keeping the
structure intact. Either way `index.html` must stay at the top level; all paths
are relative.

## Notes

- The site is black-on-white with black bands for the nav, hero and footer. There
  is no light/dark toggle — one design, matching the lab's own palette.
- The site is in English. Korean appears only where it identifies something:
  member names, the official Korean titles of projects and courses, and the
  address in the footer.
- Two type families: Pretendard (jsDelivr) for everything from the headlines
  down — it covers Latin and the Korean that remains — and JetBrains Mono
  (Google Fonts) for the small uppercase labels. Offline, the site falls back
  to system fonts and still reads correctly.
- Images in `assets/img/` came from the old Google Sites page.

## Day-to-day updates

Edit the file in `data/`, check it locally by opening `index.html`, then:

```sh
./publish.sh "Add 2027 Automatica paper"
```

Publishing requires **Bash, Git, Python 3 (standard library only), and Node.js**.
There is no package install or fontTools requirement for daily publishing.

The script only runs on `main`. It fetches `origin/main` and refuses a missing
remote or a branch that is behind/diverged before making a commit. Initialize
the remote using the Publishing steps above before using this daily helper.
It checks JavaScript (`.js`, `.cjs`, `.mjs`) with `node --check` and shell scripts
with `bash -n`, then prints the exact changed/new/deleted paths, plus any existing
unpushed commit IDs and their touched paths. Review the list and type **`publish`**
to approve. Anything else cancels without staging or committing. Do not edit files
or run other Git operations while reviewing the prompt.

Only the enumerated, nonignored paths are staged, not a blanket `git add -A`.
Partially staged files are refused rather than silently overwriting your staged
selection; finish staging or unstage them first. A clean working tree can still
push reviewed, existing ahead commits without creating an empty commit. After
pushing, the script checks the remote branch SHA. GitHub Pages normally redeploys
within a minute or two; that SHA check is not a deployment/browser test.

Noninteractive use is refused by default. For deliberate, already-reviewed
automation, `./publish.sh --yes "Commit message"` bypasses only the confirmation,
not the safety checks. The original optional message argument is preserved;
omitting it still uses `Update site`.

`.gitignore` excludes common environment files, keys, credentials, dependency
caches and local artifacts. Sanitized `*.example`, `*.sample`, and `*.template`
files are allowed outside private/cache directories. The publisher independently
blocks suspicious paths even if force-staged, already tracked, or present in an
outgoing commit that later deleted them. It also refuses symlinks. Checks report
path names only, not secret contents. These are conservative filename safeguards,
**not a content-based secret scanner**: review all public files and templates.
If a credential was committed, stop, rotate it and remove it from the relevant
history before publishing; merely deleting the current file is not enough.

### Verification

```sh
python3 -m unittest discover -s tests -p test_publish.py -v
node --test tests/news.test.cjs
bash -n publish.sh
git diff --check
```

Publishing tests use disposable Git repositories, test identities and local bare
remotes only; they never push the real origin. To run the browser checks, serve
the repository root with `python3 -m http.server 8000`, then open
`http://localhost:8000/tests/browser-checks.html`.
