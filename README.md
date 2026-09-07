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

assets/
  style.css         All styling. Colours are the :root block at the top;
                    .invert is the black band used by the nav, hero and footer.
  site.js           Language switch, nav, footer, and the page renderers.
  hero.js           The live hero figure (see below).
  favicon.png
  img/              Logo, portraits, research-area images.

data/
  i18n.js           Fixed page text, in both languages
  site.js           Lab identity, contact, advisor CV, research areas
  members.js        Students and alumni
  publications.js   Journal and conference papers, with DOIs
  projects.js       Funded projects
  courses.js        Teaching
```

## Two languages

Every visitor-facing string exists in English and Korean. The switch is in the
header, the choice is remembered, and `?lang=ko` / `?lang=en` forces one — useful
when you want a link to open in a particular language.

Anywhere a value differs between languages, write it as an object:

```js
label: { en: "Control Algorithms", ko: "제어 알고리즘" },
```

A plain string is used unchanged in both — which is what you want for names,
journal titles and citations. Fixed page text (headings, buttons, section
labels) lives in `data/i18n.js` under `COPY`; the HTML pulls it in through
`data-t="key"` attributes.

## Updating content

Everything you would normally change lives in `data/`.

**Add a paper** — open `data/publications.js`, copy the topmost entry, edit it,
keep the list newest-first. Include the `doi` and the title becomes a link to
doi.org automatically. `S. Y. Lee` in the `authors` string is bolded on its own.
The counters on the home page and the year groups both update themselves.

**Add a student** — add an entry to `GRAD_STUDENTS` in `data/members.js`. Reuse
the `DEG` and `TOPIC` constants at the top of that file so the Korean comes for
free. For a photo, drop the file in `assets/img/` and add
`photo: "assets/img/name.jpg"`; without one the card shows a monogram. The
"Undergraduate researchers" section hides itself while its list is empty.

**Graduate someone** — move the entry from `GRAD_STUDENTS` to `ALUMNI`, swap
`DEG.ms` for `DEG.msDone`, and add `graduated: "2027.02"` (plus `now:` for their
current position, if you want it shown).

**Add a project or course** — `data/projects.js` (`status` is `"ongoing"` or
`"completed"`) and `data/courses.js`.

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
- Fonts load from Google Fonts (Bodoni Moda for display, JetBrains Mono for
  labels) and jsDelivr
  (Pretendard, which covers Hangul and Latin in one family). Offline, the site
  falls back to system fonts and still reads correctly.
- Images in `assets/img/` came from the old Google Sites page.
