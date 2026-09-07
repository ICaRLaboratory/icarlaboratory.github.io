/* ===============================================================
   TEMPORARY — display-typeface picker.
   Open any page with ?font=1 .. ?font=10 to preview that face on
   the real site. Delete this file and its <script> tag once the
   typeface is chosen.
   =============================================================== */

(function () {
  const G = "https://fonts.googleapis.com/css2?display=swap&";
  const FS = "https://api.fontshare.com/v2/css?display=swap&";

  const FONTS = {
    1:  { label: "Bodoni Moda — 하이패션 디도네",
          href: G + "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900",
          stack: '"Bodoni Moda", serif', weight: 600, ls: "-.02em", scale: 1 },
    2:  { label: "Playfair Display — 클래식 우아함",
          href: G + "family=Playfair+Display:ital,wght@0,400..900;1,400..900",
          stack: '"Playfair Display", serif', weight: 600, ls: "-.025em", scale: 1 },
    3:  { label: "Fraunces — 개성 있는 모던 세리프",
          href: G + "family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900",
          stack: '"Fraunces", serif', weight: 600, ls: "-.03em", scale: 0.97,
          vf: '"SOFT" 40, "WONK" 1' },
    4:  { label: "Syne — 실험적 · 디자인 스튜디오",
          href: G + "family=Syne:wght@400..800",
          stack: '"Syne", sans-serif', weight: 800, ls: "-.035em", scale: 0.9 },
    5:  { label: "Unbounded — 기하학적 테크",
          href: G + "family=Unbounded:wght@200..900",
          stack: '"Unbounded", sans-serif', weight: 600, ls: "-.045em", scale: 0.84 },
    6:  { label: "Clash Display — 트렌디 디스플레이",
          href: FS + "f[]=clash-display@400,500,600,700",
          stack: '"Clash Display", sans-serif', weight: 600, ls: "-.03em", scale: 0.96 },
    7:  { label: "Space Grotesk — 엔지니어링 그로테스크",
          href: G + "family=Space+Grotesk:wght@300..700",
          stack: '"Space Grotesk", sans-serif', weight: 700, ls: "-.045em", scale: 0.95 },
    8:  { label: "Instrument Serif — 현재 적용본",
          href: G + "family=Instrument+Serif:ital@0;1",
          stack: '"Instrument Serif", serif', weight: 400, ls: "-.025em", scale: 1.05 },
    9:  { label: "Zilla Slab — 기존 구글사이트와 유사",
          href: G + "family=Zilla+Slab:ital,wght@0,400;0,600;0,700;1,600",
          stack: '"Zilla Slab", serif', weight: 600, ls: "-.025em", scale: 0.97 },
    10: { label: "Pretendard Heavy — 한글·영문 완전 통일",
          href: "", stack: "var(--sans)", weight: 800, ls: "-.05em", scale: 0.92 },
  };

  const n = new URLSearchParams(location.search).get("font");
  const f = FONTS[n];
  if (!f) return;

  if (f.href) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = f.href;
    document.head.appendChild(link);
  }

  const st = document.createElement("style");
  st.textContent = `
    .display, .h2, .card__title, .year-label, .stat__num, .portrait__initials {
      font-family: ${f.stack} !important;
      font-weight: ${f.weight} !important;
      letter-spacing: ${f.ls} !important;
      ${f.vf ? `font-variation-settings: ${f.vf};` : ""}
    }
    .display { font-size: calc(clamp(2.9rem, 8vw, 5.6rem) * ${f.scale}) !important; }
    .h2      { font-size: calc(clamp(2rem, 4.4vw, 3.1rem) * ${f.scale}) !important; }
    ${f.weight >= 600 && f.stack.indexOf("serif") === -1
        ? ".hero__title em { font-style: normal !important; color: var(--accent); }" : ""}

    #fontlab { position: fixed; left: 12px; bottom: 12px; z-index: 999;
      background: rgba(0,0,0,.86); border: 1px solid rgba(255,255,255,.18);
      border-radius: 12px; padding: 10px 12px; backdrop-filter: blur(10px);
      font-family: var(--mono); font-size: 11px; color: #f4f4f5; max-width: min(92vw, 560px); }
    #fontlab b { color: #6ee7d0; font-weight: 500; }
    #fontlab div { margin-top: 7px; display: flex; flex-wrap: wrap; gap: 4px; }
    #fontlab a { display: inline-grid; place-items: center; width: 22px; height: 22px;
      border: 1px solid rgba(255,255,255,.2); border-radius: 6px; color: #a1a1aa; text-decoration: none; }
    #fontlab a:hover { color: #fff; border-color: #6ee7d0; }
    #fontlab a.on { background: #6ee7d0; color: #000; border-color: #6ee7d0; font-weight: 600; }
  `;
  document.head.appendChild(st);

  const page = location.pathname.split("/").pop() || "index.html";
  const links = Object.keys(FONTS)
    .map((k) => `<a href="${page}?font=${k}" class="${k === n ? "on" : ""}">${k}</a>`)
    .join("");

  document.addEventListener("DOMContentLoaded", () => {
    const box = document.createElement("div");
    box.id = "fontlab";
    box.innerHTML = `<b>${n}. ${f.label}</b><div>${links}</div>`;
    document.body.appendChild(box);
  });
})();
