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

/* ---------- language ---------- */

const LANG_KEY = "icar-lang";
let LANG = "en";
try {
  /* ?lang=ko wins, so a link can point at one language */
  const forced = new URLSearchParams(location.search).get("lang");
  const saved = localStorage.getItem(LANG_KEY);
  if (LANGS.includes(forced)) LANG = forced;
  else if (LANGS.includes(saved)) LANG = saved;
  else if ((navigator.language || "").toLowerCase().startsWith("ko")) LANG = "ko";
} catch (e) { /* private mode */ }

/* a bilingual value is { en, ko }; a plain string is used as-is */
const t = (v) =>
  v && typeof v === "object" && !Array.isArray(v) ? v[LANG] ?? v.en ?? v.ko ?? "" : v ?? "";

const tl = (arr) => (arr || []).map(t).filter(Boolean);

const copy = (key) => t(COPY[key]) ?? "";

let CURRENT_PAGE = "index.html";

function setLang(next) {
  if (next === LANG || !LANGS.includes(next)) return;
  LANG = next;
  try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
  document.documentElement.lang = next;
  renderNav(CURRENT_PAGE);
  boot(CURRENT_PAGE);
}

/* text bound through data-t="copy.key"; the values may contain markup */
function fillCopy(root = document) {
  $$("[data-t]", root).forEach((el) => { el.innerHTML = copy(el.dataset.t); });
}

/* text bound through data-site="field" */
function fillFields(root = document) {
  const map = {
    tagline: t(SITE.tagline),
    intro: t(SITE.intro),
    labName: t(SITE.labName),
    labShort: SITE.labShort,
    department: t(SITE.department),
    university: t(SITE.university),
    since: String(SITE.since),
    email: SITE.contact.email,
    office: t(SITE.contact.office),
    address: t(SITE.contact.address),
    addressAlt: t(SITE.contact.addressAlt),
  };
  $$("[data-site]", root).forEach((el) => {
    const v = map[el.dataset.site];
    if (v != null) el.textContent = v;
  });
}

/* ---------- nav + footer ---------- */

const NAV_ITEMS = [
  { href: "index.html",        key: "nav.home" },
  { href: "research.html",     key: "nav.research" },
  { href: "members.html",      key: "nav.members" },
  { href: "publications.html", key: "nav.publications" },
  { href: "lecture.html",      key: "nav.lecture" },
];

const ICON = {
  menu:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  ext:   '<svg class="ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
};

let navScrollBound = false;

function renderNav(current) {
  const host = $("#nav");
  if (!host) return;
  CURRENT_PAGE = current;

  const links = NAV_ITEMS.map(
    (i) => `<a href="${i.href}"${i.href === current ? ' aria-current="page"' : ""}>${copy(i.key)}</a>`
  ).join("");

  host.innerHTML = `
    <nav class="nav invert" id="navbar">
      <div class="wrap nav__inner">
        <a class="brand" href="index.html">
          <span class="brand__mark"><img src="assets/img/logo.png" alt=""></span>
          <span class="brand__text">
            <span class="brand__name">${esc(SITE.labShort)} Lab</span>
            <span class="brand__sub">${esc(t(SITE.university))}</span>
          </span>
        </a>
        <div class="nav__links" id="navlinks">${links}</div>
        <div class="lang" role="group" aria-label="Language">
          ${LANGS.map((l) =>
            `<button type="button" data-lang="${l}" class="${l === LANG ? "on" : ""}"
                     aria-pressed="${l === LANG}">${l === "ko" ? "한국어" : "EN"}</button>`
          ).join("")}
        </div>
        <button class="icon-btn nav__toggle" id="menuBtn" type="button"
                aria-label="Menu" aria-expanded="false">${ICON.menu}</button>
      </div>
    </nav>`;

  $(".lang", host).addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (b) setLang(b.dataset.lang);
  });

  const menuBtn = $("#menuBtn");
  const navlinks = $("#navlinks");
  menuBtn.addEventListener("click", () => {
    const open = navlinks.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  navlinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") navlinks.classList.remove("is-open");
  });

  if (!navScrollBound) {
    navScrollBound = true;
    const onScroll = () => {
      const bar = $("#navbar");
      if (bar) bar.classList.toggle("is-stuck", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  } else {
    $("#navbar").classList.toggle("is-stuck", window.scrollY > 8);
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
              <span class="brand__sub">${copy("footer.est")} ${SITE.since}</span>
            </span>
          </div>
          <p class="muted" style="font-size:.88rem;max-width:34ch;margin:0">${copy("footer.blurb")}</p>
        </div>
        <div>
          <h4>${copy("footer.navigate")}</h4>
          <ul>${NAV_ITEMS.map((i) => `<li><a href="${i.href}">${copy(i.key)}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>${copy("footer.find")}</h4>
          <ul>
            <li>${esc(t(c.office))}</li>
            <li>${esc(t(c.address))}</li>
            <li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
            <li><a href="${esc(c.mapUrl)}" target="_blank" rel="noopener">${copy("footer.maps")} &rarr;</a></li>
          </ul>
        </div>
      </div>
      <div class="wrap footer__bottom">
        <span>&copy; ${new Date().getFullYear()} ${esc(SITE.labShort)} Lab &middot; ${esc(t(SITE.university))}</span>
        <span>${esc(t(c.addressAlt))}</span>
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

const markAuthor = (authors) =>
  esc(authors).replace(/S\. Y\. Lee/g, "<b>S. Y. Lee</b>");

const groupByYear = (papers) => {
  const map = new Map();
  papers.forEach((p) => {
    if (!map.has(p.year)) map.set(p.year, []);
    map.get(p.year).push(p);
  });
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
};

function pubRow(p, i) {
  const href = p.doi ? `https://doi.org/${esc(p.doi)}` : "";
  const title = href
    ? `<a class="pub__link" href="${href}" target="_blank" rel="noopener">${esc(p.title)}${ICON.ext}</a>`
    : esc(p.title);
  const doi = p.doi
    ? ` &middot; <a class="pub__doi" href="${href}" target="_blank" rel="noopener">doi:${esc(p.doi)}</a>`
    : "";

  return `
    <div class="pub" data-reveal style="--d:${Math.min(i, 6) * 45}ms">
      <div class="pub__title">${title}</div>
      <div class="pub__authors">${markAuthor(p.authors)}</div>
      <div class="pub__venue"><em>${esc(p.venue)}</em> &middot; ${esc(p.detail)}${doi}</div>
    </div>`;
}

function renderPublications() {
  const host = $("#publist");
  if (!host) return;

  const sets = {
    journal: JOURNAL_PAPERS,
    conference: CONFERENCE_PAPERS,
    all: [...JOURNAL_PAPERS, ...CONFERENCE_PAPERS],
  };

  const draw = (key) => {
    host.innerHTML = groupByYear(sets[key])
      .map(([year, papers]) => `
        <section class="year-group">
          <div class="year-label">${year}</div>
          <div>${papers.map(pubRow).join("")}</div>
        </section>`)
      .join("");
    initReveal();
  };

  const filters = $("#pubfilters");
  if (filters && !filters.dataset.bound) {
    filters.dataset.bound = "1";
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      $$(".chip", filters).forEach((c) => c.classList.toggle("is-active", c === btn));
      draw(btn.dataset.set);
    });
  }

  const counts = $("#pubcounts");
  if (counts) {
    counts.textContent = LANG === "ko"
      ? `저널 논문 ${JOURNAL_PAPERS.length}편 · 학회 논문 ${CONFERENCE_PAPERS.length}편`
      : `${JOURNAL_PAPERS.length} journal articles · ${CONFERENCE_PAPERS.length} conference papers`;
  }

  const active = filters ? $(".chip.is-active", filters) : null;
  draw(active ? active.dataset.set : "journal");
}

/* ---------- home ---------- */

const ROLE_KEY = { core: "areas.core", app: "areas.app", next: "areas.next" };

function areaCard(a, i) {
  return `
    <article class="card card--area" data-reveal style="--d:${i * 80}ms">
      <div class="card__index">
        <span class="role role--${a.role || "core"}">${copy(ROLE_KEY[a.role] || "areas.core")}</span>
      </div>
      <h3 class="card__title">${esc(t(a.label))}</h3>
      <p>${esc(t(a.blurb))}</p>
      <div class="tags">${tl(a.keywords).map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</div>
    </article>`;
}

function renderHome() {
  const areasHost = $("#areas");
  if (areasHost) areasHost.innerHTML = SITE.areas.map(areaCard).join("");

  const statsHost = $("#stats");
  if (statsHost) {
    const people = 1 + GRAD_STUDENTS.length + UNDERGRAD_STUDENTS.length;
    const items = [
      { n: JOURNAL_PAPERS.length,    key: "stat.journal" },
      { n: CONFERENCE_PAPERS.length, key: "stat.conference" },
      { n: PROJECTS.length,          key: "stat.projects" },
      { n: people,                   key: "stat.members" },
    ];
    statsHost.innerHTML = items.map((s, i) => `
      <div class="stat" data-reveal data-count="${s.n}" style="--d:${i * 80}ms">
        <div class="stat__num">0</div>
        <div class="stat__label">${copy(s.key)}</div>
      </div>`).join("");
  }

  const recentHost = $("#recent");
  if (recentHost) recentHost.innerHTML = JOURNAL_PAPERS.slice(0, 4).map(pubRow).join("");
}

/* ---------- research ---------- */

function renderResearch() {
  const host = $("#areas-full");
  if (host) host.innerHTML = SITE.areas.map(areaCard).join("");

  const projectHost = $("#projects");
  if (!projectHost) return;

  const row = (p, i) => `
    <div class="project" data-reveal style="--d:${i * 60}ms">
      <div>
        <div class="project__title">${esc(t(p.title))}</div>
        <div class="project__ko">${esc(LANG === "ko" ? p.title.en : p.title.ko)}</div>
        <div class="project__meta">
          <span>${esc(t(p.agency))}</span>
          <span>${esc(t(p.role))}</span>
          <span>${esc(p.period)}</span>
        </div>
      </div>
      <span class="pill ${p.status === "ongoing" ? "pill--live" : ""}">${
        copy(p.status === "ongoing" ? "projects.ongoing" : "projects.completed")}</span>
    </div>`;

  const ongoing = PROJECTS.filter((p) => p.status === "ongoing");
  const done = PROJECTS.filter((p) => p.status !== "ongoing");

  projectHost.innerHTML = `
    <h3 class="eyebrow" style="margin-top:0">${copy("projects.ongoing")}</h3>
    ${ongoing.map(row).join("")}
    <h3 class="eyebrow" style="margin-top:3rem">${copy("projects.completed")}</h3>
    ${done.map(row).join("")}`;
}

/* ---------- members ---------- */

const nameMain = (p) => (LANG === "ko" && p.nameKo ? p.nameKo : p.nameEn);
const nameSub  = (p) => (LANG === "ko" ? p.nameEn : p.nameKo || "");

function personCard(p, i, opts = {}) {
  const avatar = p.photo
    ? `<img src="${esc(p.photo)}" alt="${esc(nameMain(p))}" loading="lazy">`
    : esc(initials(p.nameEn));

  const line2 = opts.alumni
    ? `${copy("members.graduated")} ${esc(p.graduated)}${p.now ? " &middot; " + esc(t(p.now)) : ""}`
    : p.email
    ? esc(p.email)
    : "";

  return `
    <div class="person" data-reveal style="--d:${i * 60}ms">
      <div class="avatar">${avatar}</div>
      <div>
        <div class="person__name">${esc(nameMain(p))}<span class="person__ko">${esc(nameSub(p))}</span>${
          p.role ? `<span class="badge">${esc(t(p.role))}</span>` : ""}</div>
        <div class="person__role">${esc(t(p.degree))}</div>
        <div class="person__meta">${tl(p.interests).map(esc).join(" &middot; ")}</div>
        ${line2 ? `<div class="person__meta faint">${line2}</div>` : ""}
      </div>
    </div>`;
}

function renderMembers() {
  const advHost = $("#advisor");
  if (advHost) {
    const a = ADVISOR;
    const tl_ = (list, past) => list.map((c, i) => `
      <div class="tl-item ${past || i > 0 ? "tl-item--past" : ""}">
        <div class="tl-period">${esc(c.period)}</div>
        <div class="tl-role">${esc(t(c.role || c.degree))}</div>
        <div class="tl-org">${esc(t(c.org))}</div>
        ${t(c.note) ? `<div class="tl-note">${esc(t(c.note))}</div>` : ""}
      </div>`).join("");

    advHost.innerHTML = `
      <div data-reveal>
        <div class="portrait">
          ${a.photo
            ? `<img src="${esc(a.photo)}" alt="${esc(nameMain(a))}">`
            : `<span class="portrait__initials">${esc(initials(a.nameEn))}</span>`}
        </div>
        <dl class="contact-list">
          <div class="contact-row"><dt>${copy("label.email")}</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></dd></div>
          <div class="contact-row"><dt>${copy("label.office")}</dt><dd>${esc(t(a.office))}</dd></div>
          <div class="contact-row"><dt>ORCID</dt><dd><a href="https://orcid.org/${esc(a.orcid)}" target="_blank" rel="noopener">${esc(a.orcid)}</a></dd></div>
        </dl>
      </div>
      <div data-reveal style="--d:120ms">
        <h2 class="h2">${esc(nameMain(a))} <span class="faint" style="font-size:.5em">${esc(nameSub(a))}</span></h2>
        <p class="lede" style="margin-top:.75rem">${esc(t(a.title))}, ${esc(t(a.affiliation))}</p>
        <div class="tags" style="margin-top:1.5rem">
          ${tl(a.interests).map((k) => `<span class="tag">${esc(k)}</span>`).join("")}
        </div>
        <h3 class="eyebrow" style="margin-top:3rem">${copy("members.appointments")}</h3>
        <div class="timeline">${tl_(a.career, false)}</div>
        <h3 class="eyebrow" style="margin-top:3rem">${copy("members.education")}</h3>
        <div class="timeline">${tl_(a.education, true)}</div>
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
        <span class="course__name">${esc(t(c.name))}</span>
        <span class="course__ko">${esc(LANG === "ko" ? c.name.en : c.name.ko)}</span>
      </span>
      <span class="course__years">${esc(c.years || t(c.level))}</span>
    </div>`;

  const fill = (id, list) => { const h = $(id); if (h) h.innerHTML = list.map(row).join(""); };
  fill("#spring", COURSES.spring);
  fill("#fall", COURSES.fall);

  const past = $("#past");
  if (past) {
    past.innerHTML = COURSES.past
      .map((c) => `<span class="tag">${esc(t(c.name))} <span class="faint">${
        esc(LANG === "ko" ? c.name.en : c.name.ko)}</span></span>`)
      .join("");
  }
}

/* ---------- boot ---------- */

function boot(page) {
  CURRENT_PAGE = page;
  document.documentElement.lang = LANG;
  if ($("#nav") && !$("#nav").firstElementChild) renderNav(page);
  fillCopy();
  fillFields();
  renderHome();
  renderResearch();
  renderMembers();
  renderPublications();
  renderCourses();
  renderFooter();
  initReveal();
}
