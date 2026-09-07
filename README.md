# ICaR Lab website

Static site for the Intelligent Control and Robotics Laboratory, Sejong University.
Replaces <https://sites.google.com/view/seokyounglee>.

No build step, no dependencies. Double-click `index.html` to view it locally.

## Layout

```
index.html          Home — hero, stats, research pillars, recent papers
research.html       Research areas + funded projects
members.html        Advisor, graduate students, alumni
publications.html   Journal / conference papers, filterable, grouped by year
lecture.html        Courses

assets/
  style.css         All styling. Colours live in the :root block at the top.
  site.js           Nav, footer, theme toggle, and the page renderers.
  phase.js          The hero animation (phase portrait of a damped system).
  favicon.svg
  img/              Put member photos here.

data/
  site.js           Lab identity, contact details, advisor CV, research areas
  members.js        Students and alumni
  publications.js   Journal and conference papers
  projects.js       Funded projects
  courses.js        Teaching
```

## Updating content

Everything you would normally change lives in `data/`. Nothing else needs touching.

**Add a paper** — open `data/publications.js`, copy the topmost entry, edit it, keep the
list newest-first. `S. Y. Lee` in the `authors` string is bolded automatically. The
counters on the home page and the year groups on the publications page both update
themselves.

**Add a student** — open `data/members.js` and add an entry to `GRAD_STUDENTS`. To use a
photo, drop the file in `assets/img/` and add `photo: "assets/img/name.jpg"` to the entry;
without it the card shows a generated monogram. The "Undergraduate researchers" section
hides itself while `UNDERGRAD_STUDENTS` is empty.

**Graduate someone** — move the entry from `GRAD_STUDENTS` to `ALUMNI` and add
`graduated: "2027.02"` (and optionally `now: "..."` for their current position).

**Add a project or course** — `data/projects.js` (`status` is `"ongoing"` or
`"completed"`) and `data/courses.js`.

**Advisor CV, contact, research areas** — `data/site.js`.

Careful with the JavaScript punctuation: every entry needs its quotes, commas and braces.
If a page ever comes up blank, open the browser console (F12) — a missing comma will say so.

## Publishing

The site is plain files, so any static host works.

**GitHub Pages** — push this folder to a repository, then Settings → Pages → deploy from
the `main` branch, root folder. The site appears at
`https://<user>.github.io/<repo>/`.

**University web space** — upload the whole folder over SFTP, keeping the structure intact.

Either way, `index.html` must stay at the top level; all paths are relative.

## Notes

- Colour theme follows the visitor's OS setting and can be toggled in the header; the
  choice is remembered in `localStorage`.
- Fonts load from Google Fonts. Offline, the site falls back to system fonts and still
  looks right.
- The hero animation stops when the tab is hidden and is replaced by a single static
  drawing for visitors who set "reduce motion".
