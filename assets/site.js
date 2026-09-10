/* ===============================================================
   ICaR Lab — shared behaviour and page renderers.
   Loaded on every page after the data/*.js files.
   Each render function no-ops unless its container is present,
   so one file serves all five pages.
   =============================================================== */

/* ---------- tiny helpers ---------- */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/* "Jin Woong Lee" -> "JL" */
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("")
    .toUpperCase();

/* text bound through data-site="field" */
/* ---------- language ----------
   Only descriptive prose is translated. Headings, technical terms,
   keywords and the hero figure stay English on both sides, so the page
   is mixed-language in Korean mode: the <html lang> stays "en" and the
   Korean runs are tagged individually, which is what a screen reader
   needs to switch voices mid-page. */

const LANG_KEY = "icar-lang";
/* Korean is the default: the lab and most of its visitors are Korean, so
   English is the deliberate switch, not the other way round. */
let LANG = "ko";

function initLang() {
  const forced = new URLSearchParams(location.search).get("lang");
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* private mode */ }
  if (forced === "ko" || forced === "en") LANG = forced;
  else if (saved === "ko" || saved === "en") LANG = saved;
}

/* renderNav() runs from the page body before boot(), so the language has
   to be settled while this file loads, not on boot. */
initLang();

/* A { en, ko } pair follows the toggle; a plain string is shown as-is. */
const t = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v[LANG] ?? v.en ?? "" : v;

/* True when the value actually differs by language, so only real
   translations get lang="ko" — not the strings shared by both. */
const isPair = (v) => !!v && typeof v === "object" && !Array.isArray(v);

function setProse(el, v) {
  el.textContent = t(v);
  if (LANG === "ko" && isPair(v) && v.ko) el.setAttribute("lang", "ko");
  else el.removeAttribute("lang");
}

function setLang(next) {
  if (next === LANG) return;
  LANG = next;
  try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
  applyLang();
}

/* Re-renders only what the toggle touches, so nothing that holds an
   event listener (the nav, the lightbox) is rebuilt. */
function applyLang() {
  fillFields();
  renderRecruiting();
  renderNews();
  ["#areas", "#areas-full"].forEach((sel) => {
    const host = $(sel);
    if (!host) return;
    host.innerHTML = SITE.areas.map(areaCard).join("");
    /* They were already on screen, so skip the entrance animation. */
    $$("[data-reveal]", host).forEach((el) => el.classList.add("is-in"));
  });
  if ($("#projects")) {
    renderProjects();
    /* Same as the area cards: already on screen, so no entrance animation. */
    $$("[data-reveal]", $("#projects")).forEach((el) => el.classList.add("is-in"));
  }
  /* The simulator's tab labels and notes live in assets/sim.js, which loads
     after this file and only on the research page. */
  document.dispatchEvent(new CustomEvent("icar:lang"));
  $$("[data-lang]").forEach((b) => {
    const on = b.dataset.lang === LANG;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function fillFields(root = document) {
  const map = {
    tagline: SITE.tagline,
    intro: SITE.intro,
    labName: SITE.labName,
    labShort: SITE.labShort,
    department: SITE.department,
    university: SITE.university,
    since: String(SITE.since),
    email: SITE.contact.email,
    office: SITE.contact.office,
    address: SITE.contact.address,
    addressKo: SITE.contact.addressKo,
    mapUrl: SITE.contact.mapUrl,
    homeNote: SITE.homeNote,
    researchLede: SITE.researchLede,
    notFound: SITE.notFound,
  };
  $$("[data-site]", root).forEach((el) => {
    const v = map[el.dataset.site];
    if (v != null) setProse(el, v);
  });
}

/* ---------- nav + footer ---------- */

const NAV_ITEMS = [
  { href: "index.html",        label: "Home" },
  { href: "research.html",     label: "Research" },
  { href: "members.html",      label: "Members" },
  { href: "publications.html", label: "Publications" },
  { href: "lecture.html",      label: "Lecture" },
  { href: "gallery.html",      label: "Gallery" },
  { href: "contact.html",      label: "Contact" },
];

const ICON = {
  menu:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

let navScrollBound = false;

function renderNav(current) {
  const host = $("#nav");
  if (!host || host.dataset.done) return;
  host.dataset.done = "1";

  const links = NAV_ITEMS.map(
    (i) => `<a href="${i.href}"${i.href === current ? ' aria-current="page"' : ""}>${i.label}</a>`
  ).join("");

  host.innerHTML = `
    <nav class="nav invert" id="navbar">
      <div class="wrap nav__inner">
        <a class="brand" href="index.html">
          <span class="brand__mark"><img src="assets/img/logo.png" alt=""></span>
          <span class="brand__text">
            <span class="brand__name">${esc(SITE.labShort)} Lab</span>
            <span class="brand__sub">${esc(SITE.university)}</span>
          </span>
        </a>
        <div class="nav__links" id="navlinks">${links}</div>
        <div class="lang" role="group" aria-label="Description language">
          <button type="button" data-lang="ko" class="${LANG === "ko" ? "on" : ""}"
                  aria-pressed="${LANG === "ko"}" lang="ko">한국어</button>
          <button type="button" data-lang="en" class="${LANG === "en" ? "on" : ""}"
                  aria-pressed="${LANG === "en"}">EN</button>
        </div>
        <button class="icon-btn nav__toggle" id="menuBtn" type="button"
                aria-label="Menu" aria-expanded="false" aria-controls="navlinks">${ICON.menu}</button>
      </div>
    </nav>`;

  $(".lang", host).addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (b) setLang(b.dataset.lang);
  });

  const menuBtn = $("#menuBtn");
  const navlinks = $("#navlinks");
  const mobileNav = window.matchMedia("(max-width: 920px)");
  const setMenuOpen = (open) => {
    const collapsed = mobileNav.matches && !open;
    /* Move focus before inert hides the links, including at a breakpoint. */
    if (collapsed && navlinks.contains(document.activeElement)) menuBtn.focus();
    navlinks.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    navlinks.toggleAttribute("inert", collapsed);
  };
  setMenuOpen(false);
  menuBtn.addEventListener("click", () => {
    setMenuOpen(!navlinks.classList.contains("is-open"));
  });
  navlinks.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenuOpen(false);
  });
  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navlinks.classList.contains("is-open")) {
      setMenuOpen(false);
      menuBtn.focus();
    }
  });
  mobileNav.addEventListener("change", () => {
    setMenuOpen(false);
  });

  if (!navScrollBound) {
    navScrollBound = true;
    const onScroll = () => {
      const bar = $("#navbar");
      if (bar) bar.classList.toggle("is-stuck", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
}

function renderFooter() {
  const host = $("#footer");
  if (!host) return;
  const c = SITE.contact;

  host.innerHTML = `
    <footer class="footer invert">
      <div class="wrap footer__grid">
        <div>
          <div class="brand" style="margin-bottom:1rem">
            <span class="brand__mark"><img src="assets/img/logo.png" alt=""></span>
            <span class="brand__text">
              <span class="brand__name">${esc(SITE.labShort)} Lab</span>
              <span class="brand__sub">Est. ${SITE.since}</span>
            </span>
          </div>
          <p class="muted" style="font-size:.88rem;max-width:34ch;margin:0">${
            esc(SITE.labName)}, ${esc(SITE.department)}, ${esc(SITE.university)}.</p>
        </div>
        <div>
          <h2>Navigate</h2>
          <ul>${NAV_ITEMS.map((i) => `<li><a href="${i.href}">${i.label}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h2>Find us</h2>
          <ul>
            <li>${esc(c.office)}</li>
            <li>${esc(c.address)}</li>
            <li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
            <li><a href="${esc(c.mapUrl)}" target="_blank" rel="noopener">Open in Maps &rarr;</a></li>
          </ul>
        </div>
      </div>
      <div class="wrap footer__bottom">
        <span>&copy; ${new Date().getFullYear()} ${esc(SITE.labShort)} Lab &middot; ${esc(SITE.university)}</span>
        <span lang="ko">${esc(c.addressKo)}</span>
      </div>
    </footer>`;
}

/* ---------- scroll reveal + counters ---------- */

let revealObserver = null;

function initReveal() {
  const targets = $$("[data-reveal]:not(.is-in)");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((t) => t.classList.add("is-in"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
          if (entry.target.dataset.count) countUp(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
  }
  targets.forEach((t) => revealObserver.observe(t));

  /* If the observer never fires -- an odd embedding, a stalled frame -- the
     copy would sit at opacity 0 forever. Reveal everything after a beat. */
  clearTimeout(initReveal._safety);
  initReveal._safety = setTimeout(() => {
    $$("[data-reveal]:not(.is-in)").forEach((el) => {
      el.classList.add("is-in");
      if (el.dataset.count) countUp(el);
    });
  }, 2500);
}

function countUp(el) {
  const target = Number(el.dataset.count);
  const node = $(".stat__num", el) || el;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = target;
    return;
  }
  const dur = 1100;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    node.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- publications ---------- */

/* the lab head, with the corresponding-author asterisk when the paper carries one */
const markAuthor = (authors) =>
  esc(authors).replace(/S\. Y\. Lee(\*?)/g, "<b>S. Y. Lee$1</b>");

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
                 jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/* `detail` carries the month for most entries ("Jul. 2026"); a few journals
   print only a year, and those sort to the back of their year. */
const pubMonth = (p) => {
  const m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.exec(p.detail || "");
  return m ? MONTHS[m[1].toLowerCase()] : 0;
};

const byDate = (a, b) => b.year - a.year || pubMonth(b) - pubMonth(a);

const groupByYear = (papers) => {
  const map = new Map();
  [...papers].sort(byDate).forEach((p) => {
    if (!map.has(p.year)) map.set(p.year, []);
    map.get(p.year).push(p);
  });
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
};

function pubRow(p, i) {
  const href = p.doi ? `https://doi.org/${esc(p.doi)}` : "";
  const title = href
    ? `<a class="pub__link" href="${href}" target="_blank" rel="noopener">${esc(p.title)}</a>`
    : esc(p.title);
  const doi = p.doi
    ? ` &middot; <a class="pub__doi" href="${href}" target="_blank" rel="noopener">doi:${esc(p.doi)}</a>`
    : "";

  return `
    <li class="pub" data-reveal style="--d:${Math.min(i, 6) * 45}ms">
      <div class="pub__title">${title}</div>
      <div class="pub__authors">${markAuthor(p.authors)}</div>
      <div class="pub__venue"><em>${esc(p.venue)}</em> &middot; ${esc(p.detail)}${doi}</div>
    </li>`;
}

function renderPublications() {
  const host = $("#publist");
  if (!host) return;

  const every = [...JOURNAL_PAPERS, ...CONFERENCE_PAPERS];
  /* Journal and Conference split by type; Domestic is a cross-cutting view of
     the Korean-venue papers, which also appear under their own type. */
  const sets = {
    journal: JOURNAL_PAPERS,
    conference: CONFERENCE_PAPERS,
    domestic: every.filter((p) => p.domestic),
    all: every,
  };

  const draw = (key) => {
    host.innerHTML = groupByYear(sets[key])
      .map(([year, papers]) => `
        <section class="year-group">
          <h2 class="year-label">${year}</h2>
          <ol class="pub-list">${papers.map(pubRow).join("")}</ol>
        </section>`)
      .join("");
    initReveal();
  };

  const filters = $("#pubfilters");
  if (filters) {
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      $$(".chip", filters).forEach((c) => {
        c.classList.toggle("is-active", c === btn);
        c.setAttribute("aria-pressed", String(c === btn));
      });
      draw(btn.dataset.set);
    });
  }

  const counts = $("#pubcounts");
  if (counts) {
    const dom = every.filter((p) => p.domestic).length;
    counts.textContent =
      `${JOURNAL_PAPERS.length} journal articles · ${CONFERENCE_PAPERS.length} conference papers` +
      (dom ? ` · ${dom} at Korean venues` : "");
  }

  const banner = $("#profiles");
  if (banner) {
    const links = [
      ADVISOR.scholar && ["Google Scholar", ADVISOR.scholar, "btn--primary"],
      ADVISOR.orcid && ["ORCID", `https://orcid.org/${esc(ADVISOR.orcid)}`, "btn--ghost"],
    ].filter(Boolean);
    banner.innerHTML = `
      <div class="banner invert">
        <div>
          <div class="banner__t">The complete record, kept up to date</div>
          <div class="banner__s">Profiles for ${esc(ADVISOR.nameEn)}</div>
        </div>
        <div class="banner__a">${links
          .map(([n, u, c]) => `<a class="btn ${c}" href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`)
          .join("")}</div>
      </div>`;
  }

  draw("journal");
}

/* ---------- home ---------- */

function areaCard(a, i) {
  const total = SITE.areas.length;
  return `
    <article class="card ${a.image ? "card--media" : ""}" data-reveal style="--d:${i * 90}ms">
      ${a.image ? `<div class="card__media"><img src="${esc(a.image)}" alt="" loading="lazy">
        <button class="card__zoom" type="button" data-src="${esc(a.image)}"
          data-alt="${esc(t(a.label))}" aria-label="Enlarge the ${esc(t(a.label))} figure"></button>
        </div>` : ""}
      <div class="card__index">0${i + 1} / ${total < 10 ? "0" : ""}${total}</div>
      <h3 class="card__title">${esc(t(a.label))}</h3>
      <p${LANG === "ko" && a.blurb.ko ? ' lang="ko"' : ""}>${esc(t(a.blurb))}</p>
      <div class="tags">${a.keywords.map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</div>
    </article>`;
}

/* ---------- news ---------- */

/* Parsed as a local calendar day. new Date("2026-09-15") would be UTC
   midnight, which reads as the previous day west of Greenwich. */
function newsDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  /* Date normalizes impossible days/months instead of rejecting them. */
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 &&
    d.getDate() === +m[3] ? d : null;
}

/* The newest few items, but only while one of them is actually recent:
   a fresh post carries the previous couple back onto the page with it,
   and a quiet stretch takes the whole band down rather than leaving
   last spring's news sitting under the hero. */
function currentNews(now = new Date()) {
  if (typeof NEWS === "undefined") return [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const window = (typeof NEWS_WINDOW_DAYS === "number" ? NEWS_WINDOW_DAYS : 14);
  const max = (typeof NEWS_MAX_ITEMS === "number" ? NEWS_MAX_ITEMS : 3);
  const age = (n) => Math.round((today - n.day) / 86400000);
  const posted = NEWS
    .map((n) => ({ ...n, day: newsDay(n.date) }))
    .filter((n) => n.day && age(n) >= 0)    /* a real date, and due */
    .sort((a, b) => b.day - a.day);
  return posted.some((n) => age(n) < window) ? posted.slice(0, max) : [];
}

const NEWS_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* The standing recruiting band under the hero. It has no window: unlike
   a news item it stays up until SITE.recruiting.on is turned off. */
function renderRecruiting() {
  const band = $("#recruit");
  if (!band) return;
  const r = SITE.recruiting;
  if (!r || !r.on) { band.hidden = true; return; }
  band.hidden = false;

  const ko = LANG === "ko" && isPair(r.title) && r.title.ko ? ' lang="ko"' : "";
  const mail = SITE.contact.email;
  $("#recruittext", band).innerHTML =
    `<span${ko}>${esc(t(r.title))}</span> <a class="recruit__link" href="mailto:${esc(mail)}">${esc(mail)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`;
}

function renderNews() {
  const band = $("#news");
  if (!band) return;
  const items = currentNews();
  /* Nothing inside the window: drop the band rather than leave a gap. */
  if (!items.length) { band.hidden = true; return; }
  band.hidden = false;

  const list = items.map((n) => {
    const label = t(n.title);
    const ko = LANG === "ko" && n.title && n.title.ko ? ' lang="ko"' : "";
    const body = n.href
      ? `<a class="news__link" href="${esc(n.href)}">${esc(label)}</a>`
      : esc(label);
    const stamp = `${NEWS_MONTH[n.day.getMonth()]} ${n.day.getDate()}`;
    return `<li class="news__item">
        <time class="news__date" datetime="${esc(n.date)}">${stamp}</time>
        <span class="news__text"${ko}>${body}</span>
      </li>`;
  }).join("");

  $("#newslist", band).innerHTML = list;
}

function renderHome() {
  const areasHost = $("#areas");
  if (areasHost) {
    areasHost.innerHTML = SITE.areas.map(areaCard).join("");
    wireLightbox(areasHost, ".card__zoom");
  }

  const statsHost = $("#stats");
  if (statsHost) {
    const people = 1 + GRAD_STUDENTS.length + UNDERGRAD_STUDENTS.length;
    const items = [
      { n: JOURNAL_PAPERS.length,    label: "Journal articles" },
      { n: CONFERENCE_PAPERS.length, label: "Conference papers" },
      { n: PROJECTS.length,          label: "Funded projects" },
      { n: people,                   label: "Lab members" },
    ];
    statsHost.innerHTML = items.map((s, i) => `
      <div class="stat" data-reveal data-count="${s.n}" style="--d:${i * 80}ms">
        <div class="stat__num">0</div>
        <div class="stat__label">${s.label}</div>
      </div>`).join("");
  }

  const recentHost = $("#recent");
  if (recentHost) {
    recentHost.innerHTML = '<ol class="pub-list">' +
      [...JOURNAL_PAPERS, ...CONFERENCE_PAPERS].sort(byDate).slice(0, 5).map(pubRow).join("") +
      "</ol>";
  }
}

/* ---------- research ---------- */

function renderResearch() {
  const host = $("#areas-full");
  if (host) {
    host.innerHTML = SITE.areas.map(areaCard).join("");
    wireLightbox(host, ".card__zoom");
  }

  renderProjects();
}

/* Separate from renderResearch() so the language toggle can rebuild the
   project list without touching the area cards or the lightbox wiring. */
function renderProjects() {
  const projectHost = $("#projects");
  if (!projectHost) return;

  /* A project reads in one language at a time -- the Korean names are the
     official ones, so in Korean mode they stand alone rather than sitting
     under an English translation. */
  const ko = LANG === "ko" ? ' lang="ko"' : "";

  const row = (p, i) => `
    <div class="project" data-reveal style="--d:${i * 60}ms">
      <div>
        <div class="project__title"${ko}>${esc(t(p.title))}</div>
        <div class="project__meta">
          <span${ko}>${esc(t(p.agency))}</span>
          <span${ko}>${esc(t(p.role))}</span>
          <span>${esc(p.period)}</span>
        </div>
      </div>
      <span class="pill ${p.status === "ongoing" ? "pill--live" : ""}">${p.status}</span>
    </div>`;

  const ongoing = PROJECTS.filter((p) => p.status === "ongoing");
  const done = PROJECTS.filter((p) => p.status !== "ongoing");

  projectHost.innerHTML = `
    <h3 class="eyebrow" style="margin-top:0">Ongoing</h3>
    ${ongoing.map(row).join("")}
    <h3 class="eyebrow" style="margin-top:3rem">Completed</h3>
    ${done.map(row).join("")}`;
}

/* ---------- members ---------- */

function personCard(p, i, opts = {}) {
  const avatar = p.photo
    ? `<img src="${esc(p.photo)}" alt="${esc(p.nameEn)}" loading="lazy">`
    : esc(initials(p.nameEn));

  const line2 = opts.alumni
    ? `Graduated ${esc(p.graduated)}${p.now ? " &middot; " + esc(p.now) : ""}`
    : p.email
    ? esc(p.email)
    : "";

  const profiles = [
    p.scholar && ["Google Scholar", p.scholar],
    p.orcid && ["ORCID", `https://orcid.org/${esc(p.orcid)}`],
  ].filter(Boolean);

  return `
    <div class="person" data-reveal style="--d:${i * 60}ms">
      <div class="avatar">${avatar}</div>
      <div>
        <div class="person__name">${esc(p.nameEn)}<span class="person__ko" lang="ko">${esc(p.nameKo || "")}</span></div>
        <div class="person__role">${esc(p.degree)}</div>
        <!-- always rendered, so a card without a role keeps the same rhythm -->
        <div class="badge-slot">${p.role ? `<span class="badge">${esc(p.role)}</span>` : ""}</div>
        <div class="person__meta">${(p.interests || []).map(esc).join(" &middot; ")}</div>
        ${line2 ? `<div class="person__meta faint">${line2}</div>` : ""}
        ${profiles.length ? `<div class="person__links">${profiles
          .map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`)
          .join("")}</div>` : ""}
      </div>
    </div>`;
}

function renderMembers() {
  const advHost = $("#advisor");
  if (advHost) {
    const a = ADVISOR;
    const timeline = (list, allPast) => list.map((c, i) => `
      <div class="tl-item ${allPast || i > 0 ? "tl-item--past" : ""}">
        <div class="tl-period">${esc(c.period)}</div>
        <div class="tl-role">${esc(c.role || c.degree)}</div>
        <div class="tl-org">${esc(c.org)}</div>
        ${c.dept ? `<div class="tl-note">${esc(c.dept)}</div>` : ""}
        ${c.note ? `<div class="tl-note">${esc(c.note)}</div>` : ""}
      </div>`).join("");

    advHost.innerHTML = `
      <div data-reveal>
        <div class="portrait">
          ${a.photo
            ? `<img src="${esc(a.photo)}" alt="${esc(a.nameEn)}">`
            : `<span class="portrait__initials">${esc(initials(a.nameEn))}</span>`}
        </div>
        <dl class="contact-list">
          <div class="contact-row"><dt>Email</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></dd></div>
          <div class="contact-row"><dt>Office</dt><dd>${esc(a.office)}</dd></div>
          <div class="contact-row"><dt>ORCID</dt><dd><a href="https://orcid.org/${esc(a.orcid)}" target="_blank" rel="noopener">${esc(a.orcid)}</a></dd></div>
          ${a.scholar ? `<div class="contact-row"><dt>Scholar</dt><dd><a href="${esc(a.scholar)}" target="_blank" rel="noopener">Google Scholar</a></dd></div>` : ""}
        </dl>
      </div>
      <div data-reveal style="--d:120ms">
        <h2 class="h2">${esc(a.nameEn)} <span class="faint" lang="ko" style="font-size:.5em">${esc(a.nameKo)}</span></h2>
        <p class="lede" style="margin-top:.75rem">${esc(a.title)}, ${esc(a.affiliation)}</p>
        <div class="tags" style="margin-top:1.5rem">
          ${a.interests.map((k) => `<span class="tag">${esc(k)}</span>`).join("")}
        </div>
        <h3 class="eyebrow" style="margin-top:3rem">Appointments</h3>
        <div class="timeline">${timeline(a.career, false)}</div>
        <h3 class="eyebrow" style="margin-top:3rem">Education</h3>
        <div class="timeline">${timeline(a.education, true)}</div>
      </div>`;
  }

  const grad = $("#grad");
  if (grad) grad.innerHTML = GRAD_STUDENTS.map((p, i) => personCard(p, i)).join("");

  const undergrad = $("#undergrad");
  const undergradSection = $("#undergrad-section");
  if (undergrad) {
    if (UNDERGRAD_STUDENTS.length) {
      undergrad.innerHTML = UNDERGRAD_STUDENTS.map((p, i) => personCard(p, i)).join("");
    } else if (undergradSection) {
      undergradSection.remove();
    }
  }

  const alumni = $("#alumni");
  if (alumni) alumni.innerHTML = ALUMNI.map((p, i) => personCard(p, i, { alumni: true })).join("");
}

/* ---------- lecture ---------- */

function renderCourses() {
  if (typeof COURSES === "undefined") return;

  const row = (c) => `
    <div class="course">
      <span>
        <span class="course__name">${esc(c.nameEn)}</span>
        <span class="course__ko" lang="ko">${esc(c.nameKo)}</span>
      </span>
      <span class="course__years">${esc(c.years || c.level)}</span>
    </div>`;

  const fill = (id, list) => { const h = $(id); if (h) h.innerHTML = list.map(row).join(""); };
  fill("#spring", COURSES.spring);
  fill("#fall", COURSES.fall);

  const past = $("#past");
  if (past) {
    past.innerHTML = COURSES.past
      .map((c) => `<span class="tag">${esc(c.nameEn)} <span class="faint" lang="ko">${esc(c.nameKo)}</span></span>`)
      .join("");
  }
}

/* ---------- gallery ---------- */

function renderGallery() {
  const host = $("#gallery");
  if (!host || typeof GALLERY === "undefined") return;

  host.innerHTML = GALLERY.map((a, i) => `
    <section class="album" data-reveal style="--d:${i * 80}ms">
      <div class="album__head">
        <h2 class="album__title">${esc(a.title)}</h2>
        ${a.titleKo ? `<div class="album__ko" lang="ko">${esc(a.titleKo)}</div>` : ""}
        <div class="album__meta">${esc(a.date)}${a.place ? " &middot; " + esc(a.place) : ""}</div>
      </div>
      <div class="album__grid">
        ${a.photos.map((p) => `
          <button class="shot" type="button" data-src="${esc(p.src)}" data-alt="${esc(p.alt)}">
            <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy">
          </button>`).join("")}
      </div>
    </section>`).join("");

  wireLightbox(host, ".shot");
}

/* One viewer for the gallery photos and the research figures alike. A native
   <dialog> gives Esc-to-close and focus handling for free, and the trigger is
   a real button, so keyboard users reach it without any help from us.

   The listener sits on the host, not on the triggers: the language toggle
   replaces the cards' innerHTML but never the host, so this survives it. */
function wireLightbox(host, selector) {
  const box = $("#lightbox");
  if (!host || !box) return;
  const img = $("img", box);
  const cap = $("figcaption", box);

  host.addEventListener("click", (e) => {
    const trigger = e.target.closest(selector);
    if (!trigger) return;
    img.src = trigger.dataset.src;
    img.alt = trigger.dataset.alt;
    cap.textContent = trigger.dataset.alt;
    box.showModal();
  });
  if (box.dataset.wired) return;        /* the dialog's own controls, once */
  box.dataset.wired = "1";
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
  $(".lightbox__x", box).addEventListener("click", () => box.close());
  box.addEventListener("close", () => { img.removeAttribute("src"); });
}

/* ---------- contact ---------- */

function renderContact() {
  const host = $("#map");
  if (!host) return;
  const c = SITE.contact;
  host.innerHTML = `
    <iframe src="${esc(c.mapEmbed)}" title="Map to the ICaR Laboratory"
            loading="lazy" referrerpolicy="no-referrer"></iframe>`;

  const links = $("#contactlinks");
  if (links) {
    links.innerHTML = `
      <a class="btn btn--primary" href="mailto:${esc(c.email)}">${esc(c.email)}</a>
      <a class="btn" href="${esc(c.mapUrl)}" target="_blank" rel="noopener">Open in Google Maps</a>`;
  }
}

/* ---------- boot ---------- */

function boot(page) {
  if ($("#nav") && !$("#nav").firstElementChild) renderNav(page);
  fillFields();
  renderRecruiting();
  renderNews();
  renderHome();
  renderResearch();
  renderMembers();
  renderPublications();
  renderCourses();
  renderGallery();
  renderContact();
  renderFooter();
  initReveal();
}
