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
  };
  $$("[data-site]", root).forEach((el) => {
    const v = map[el.dataset.site];
    if (v != null) el.textContent = v;
  });
}

/* ---------- nav + footer ---------- */

const NAV_ITEMS = [
  { href: "index.html",        label: "Home" },
  { href: "research.html",     label: "Research" },
  { href: "members.html",      label: "Members" },
  { href: "publications.html", label: "Publications" },
  { href: "lecture.html",      label: "Lecture" },
  { href: "contact.html",      label: "Contact" },
];

const ICON = {
  menu:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  ext:   '<svg class="ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
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
        <button class="icon-btn nav__toggle" id="menuBtn" type="button"
                aria-label="Menu" aria-expanded="false">${ICON.menu}</button>
      </div>
    </nav>`;

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
          <h4>Navigate</h4>
          <ul>${NAV_ITEMS.map((i) => `<li><a href="${i.href}">${i.label}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h4>Find us</h4>
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
        <span>${esc(c.addressKo)}</span>
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
  if (filters) {
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      $$(".chip", filters).forEach((c) => c.classList.toggle("is-active", c === btn));
      draw(btn.dataset.set);
    });
  }

  const counts = $("#pubcounts");
  if (counts) {
    const scholar = ADVISOR.scholar
      ? ` &middot; <a class="pub__doi" href="${esc(ADVISOR.scholar)}" target="_blank" rel="noopener">Google Scholar${ICON.ext}</a>`
      : "";
    counts.innerHTML =
      `${JOURNAL_PAPERS.length} journal articles &middot; ${CONFERENCE_PAPERS.length} conference papers${scholar}`;
  }

  draw("journal");
}

/* ---------- home ---------- */

function areaCard(a, i) {
  const total = SITE.areas.length;
  return `
    <article class="card ${a.image ? "card--media" : ""}" data-reveal style="--d:${i * 90}ms">
      ${a.image ? `<div class="card__media"><img src="${esc(a.image)}" alt="" loading="lazy"></div>` : ""}
      <div class="card__index">0${i + 1} / ${total < 10 ? "0" : ""}${total}</div>
      <h3 class="card__title">${esc(a.label)}</h3>
      <p>${esc(a.blurb)}</p>
      <div class="tags">${a.keywords.map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</div>
    </article>`;
}

function renderHome() {
  const areasHost = $("#areas");
  if (areasHost) areasHost.innerHTML = SITE.areas.map(areaCard).join("");

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
        <div class="project__title">${esc(p.titleEn)}</div>
        <div class="project__ko">${esc(p.titleKo)}</div>
        <div class="project__meta">
          <span>${esc(p.agency)}</span>
          <span>${esc(p.role)}</span>
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
    p.orcid && ["ORCID", `https://orcid.org/${p.orcid}`],
  ].filter(Boolean);

  return `
    <div class="person" data-reveal style="--d:${i * 60}ms">
      <div class="avatar">${avatar}</div>
      <div>
        <div class="person__name">${esc(p.nameEn)}<span class="person__ko">${esc(p.nameKo || "")}</span>${
          p.role ? `<span class="badge">${esc(p.role)}</span>` : ""}</div>
        <div class="person__role">${esc(p.degree)}</div>
        <div class="person__meta">${(p.interests || []).map(esc).join(" &middot; ")}</div>
        ${line2 ? `<div class="person__meta faint">${line2}</div>` : ""}
        ${profiles.length ? `<div class="person__links">${profiles
          .map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}${ICON.ext}</a>`)
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
          ${a.scholar ? `<div class="contact-row"><dt>Scholar</dt><dd><a href="${esc(a.scholar)}" target="_blank" rel="noopener">Google Scholar${ICON.ext}</a></dd></div>` : ""}
        </dl>
      </div>
      <div data-reveal style="--d:120ms">
        <h2 class="h2">${esc(a.nameEn)} <span class="faint" style="font-size:.5em">${esc(a.nameKo)}</span></h2>
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
        <span class="course__ko">${esc(c.nameKo)}</span>
      </span>
      <span class="course__years">${esc(c.years || c.level)}</span>
    </div>`;

  const fill = (id, list) => { const h = $(id); if (h) h.innerHTML = list.map(row).join(""); };
  fill("#spring", COURSES.spring);
  fill("#fall", COURSES.fall);

  const past = $("#past");
  if (past) {
    past.innerHTML = COURSES.past
      .map((c) => `<span class="tag">${esc(c.nameEn)} <span class="faint">${esc(c.nameKo)}</span></span>`)
      .join("");
  }
}

/* ---------- contact ---------- */

function renderContact() {
  const host = $("#map");
  if (!host) return;
  const c = SITE.contact;
  host.innerHTML = `
    <iframe src="${esc(c.mapEmbed)}" title="Map to the ICaR Laboratory"
            loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

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
  renderHome();
  renderResearch();
  renderMembers();
  renderPublications();
  renderCourses();
  renderContact();
  renderFooter();
  initReveal();
}
