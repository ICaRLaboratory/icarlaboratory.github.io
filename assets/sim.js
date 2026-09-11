/* ===============================================================
   The simulator shell.

   There is more than one loop worth playing with now, so the parts
   that were the same either way live here: the canvas and its pixel
   ratio, the run loop, the reduced-motion path, the tabs, and the
   panel the sliders and readouts are built into. A simulation is a
   module that registers itself with the sliders it wants, the numbers
   it reports and one draw call -- assets/sim-arm.js and
   assets/sim-contact.js are the two.

   A module draws in design units into a fixed box and the shell
   scales it, so nothing in a module knows about device pixel ratios,
   canvas sizes or the transform. The box is the same shape for every
   module, so switching tabs never changes the height of the figure.

   The words belong to the site rather than to the physics, so each
   module's tab label, its note and its footnote sit in data/site.js
   under SITE.sims, keyed by the id the module registers, and follow
   the language toggle with everything else there.
   =============================================================== */

const SIM = (function () {
  const defs = [];
  const INK = (a) => `rgba(10,10,10,${a})`;

  /* Two hues and ink. Ink carries everything that is a reference -- axes,
     targets, the surface, the wall's own line -- and the two hues carry the
     things being compared, so a legend is a colour and not a shade of grey.
     Teal and amber stay apart for the common colour deficiencies, and the
     line weights and dashes still differ, so colour is never the only cue. */
  const HUE = {
    one: "#0d9488",                      /* shoulder, and what was measured */
    two: "#ea580c",                      /* elbow, and what was predicted */
    onePale: "rgba(13,148,136,0.45)",
    twoPale: "rgba(234,88,12,0.45)",
  };

  /* one shape wide, another stacked; a module lays its own blocks out
     inside whichever it is handed */
  const WIDE = { w: 780, h: 620 };
  const TALL = { w: 380, h: 1010 };

  /* ---------- the drawing kit ---------- */

  function makeKit(ctx) {
    const g = { ctx, ink: INK };

    g.roundBox = (x, y, w, h, r = 4) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = INK(0.9);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    };

    g.arrow = (x1, y1, x2, y2, head = true) => {
      ctx.strokeStyle = INK(0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (!head) return;
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = INK(0.9);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.42) * 9, y2 - Math.sin(a - 0.42) * 9);
      ctx.lineTo(x2 - Math.cos(a + 0.42) * 9, y2 - Math.sin(a + 0.42) * 9);
      ctx.closePath();
      ctx.fill();
    };

    /* the small monospaced labels: panel titles, axis names, tags */
    g.cap = (text, x, y, size = 10, align = "center", alpha = 0.5) => {
      ctx.font = `500 ${size}px "JetBrains Mono", ui-monospace, monospace`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
      ctx.fillStyle = INK(alpha);
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    };

    g.words = (text, x, y, size = 13, align = "center", alpha = 0.9) => {
      ctx.font = `500 ${size}px "Pretendard Variable", Pretendard, system-ui, sans-serif`;
      ctx.fillStyle = INK(alpha);
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
    };

    g.maths = (text, x, y, size = 14, align = "center", alpha = 0.9) => {
      ctx.font = `italic ${size}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = INK(alpha);
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
    };

    /* An italic symbol, an optional subscript and plain text, measured and
       centred as one line: the small blocks in the loop diagrams are narrow,
       and setting the three parts by eye overflowed them. */
    g.labelled = (sym, sub, rest, cx, y, size = 12, alpha = 0.6) => {
      const small = size * 0.75, plain = size * 0.88;
      ctx.font = `italic ${size}px Georgia, "Times New Roman", serif`;
      const a = ctx.measureText(sym).width;
      ctx.font = `italic ${small}px Georgia, "Times New Roman", serif`;
      const b = sub ? ctx.measureText(sub).width : 0;
      ctx.font = `500 ${plain}px "Pretendard Variable", Pretendard, system-ui, sans-serif`;
      const c = ctx.measureText(rest).width;
      let x = cx - (a + b + c) / 2;
      g.maths(sym, x, y, size, "left", alpha);
      x += a;
      if (sub) { g.maths(sub, x, y + 4, small, "left", alpha); x += b; }
      g.words(rest, x, y, plain, "left", alpha - 0.05);
    };

    /* names a wire the way tau and q are named on the horizontal ones */
    g.signal = (letter, x, yTop, yBot) =>
      g.maths(letter, x, (yTop + yBot) / 2 + 5, 15, "left");

    /* a name turned on its side, for the axis that runs up the page */
    g.vcap = (text, x, y, size = 9, alpha = 0.45) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      g.cap(text, 0, 0, size, "center", alpha);
      ctx.restore();
    };

    /* A key, laid across the top of a panel: each name behind a short piece
       of the line it belongs to, drawn in that line's own weight and dash, so
       nothing has to be matched up by memory. */
    g.keyRow = (items, x, y) => {
      const LINE = 15, GAP = 5, PAD = 15;
      const width = (label) => {
        ctx.font = '500 9px "JetBrains Mono", ui-monospace, monospace';
        if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
        const w = ctx.measureText(label).width;
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        return w;
      };
      let at = x;
      for (const it of items) {
        if (it.dot) {
          ctx.fillStyle = it.stroke;
          ctx.beginPath();
          ctx.arc(at + LINE / 2, y - 3, 3.2, 0, 7);
          ctx.fill();
        } else {
          ctx.strokeStyle = it.stroke;
          ctx.lineWidth = it.width || 1.5;
          ctx.setLineDash(it.dash || []);
          ctx.beginPath();
          ctx.moveTo(at, y - 3);
          ctx.lineTo(at + LINE, y - 3);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        g.cap(it.label, at + LINE + GAP, y, 9, "left", 0.5);
        at += LINE + GAP + width(it.label) + PAD;
      }
    };

    g.frameBox = (p, title) => {
      ctx.strokeStyle = INK(0.13);
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      if ("letterSpacing" in ctx) ctx.letterSpacing = "1.6px";
      ctx.fillStyle = INK(0.55);
      ctx.textAlign = "left";
      ctx.fillText(title, p.x + 10, p.y + 19);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    };

    /* a framed record, drawn clipped so a diverging trace cannot spill
       over its neighbour */
    g.panel = (p, title, body) => {
      g.frameBox(p, title);
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
      ctx.clip();
      body();
      ctx.restore();
    };

    /* the seconds down a time axis, so the length of a record reads off it */
    g.seconds = (p, px, yTop, yBot, span, every) => {
      ctx.strokeStyle = INK(0.09);
      ctx.lineWidth = 1;
      for (let t = every; t < span; t += every) {
        ctx.beginPath();
        ctx.moveTo(px(t), yTop);
        ctx.lineTo(px(t), yBot);
        ctx.stroke();
        g.cap(t + "s", px(t), yBot + 14, 9, "center", 0.38);
      }
    };

    /* the moment something was done to the loop, marked down a record */
    g.event = (x, yTop, yBot, label) => {
      ctx.strokeStyle = INK(0.5);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
      ctx.setLineDash([]);
      if (label) g.cap(label, x + 5, yTop + 11, 9, "left", 0.5);
    };

    return g;
  }

  /* ---------- matrices, for the plants that need discretising ---------- */

  function matmul(X, Y, n) {
    const C = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let k = 0; k < n; k++) {
        const c = X[i][k];
        if (c === 0) continue;
        for (let j = 0; j < n; j++) C[i][j] += c * Y[k][j];
      }
    return C;
  }

  /* The matrix exponential, by scaling and squaring: the plants here are
     stiff enough that a plain Taylor series at a full sampling period would
     be nonsense, so it is taken at a step small enough to converge and
     squared back up. */
  function expm(M, n) {
    let worst = 0;
    for (let i = 0; i < n; i++) {
      let row = 0;
      for (let j = 0; j < n; j++) row += Math.abs(M[i][j]);
      if (row > worst) worst = row;
    }
    const squarings = Math.max(0, Math.ceil(Math.log2(Math.max(worst, 1e-12))) + 1);
    const scale = Math.pow(2, squarings);
    const A = M.map((r) => r.map((c) => c / scale));
    const I = () => Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    let E = I(), term = I();
    for (let k = 1; k <= 20; k++) {
      term = matmul(term, A, n).map((r) => r.map((c) => c / k));
      E = E.map((r, i) => r.map((c, j) => c + term[i][j]));
    }
    for (let k = 0; k < squarings; k++) E = matmul(E, E, n);
    return E;
  }

  /* x' = A x + B u with u held over T, as one step: the augmented exponential
     gives the state map and the input map together. */
  function discretize(A, B, T, n, m) {
    const N = n + m;
    const Z = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) Z[i][j] = A[i][j] * T;
      for (let j = 0; j < m; j++) Z[i][n + j] = B[i][j] * T;
    }
    const E = expm(Z, N);
    return {
      Ad: Array.from({ length: n }, (_, i) => E[i].slice(0, n)),
      Bd: Array.from({ length: n }, (_, i) => E[i].slice(n, N)),
    };
  }

  /* ---------- one running simulation ---------- */

  function runner(def, host) {
    const canvas = host.querySelector("canvas");
    const ctx = canvas.getContext && canvas.getContext("2d");
    /* a machine with canvas turned off gets the prose and no empty box */
    if (!ctx) { host.classList.add("sim--noctx"); return null; }

    const g = makeKit(ctx);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const P = {};
    const inputs = {};
    /* where a slider was before another law's fixed value parked it */
    const parked = {};
    const outs = {};
    const readouts = {};
    let verdictEl = null;
    let raf = null;
    let live = true;
    let invited = false;      /* the reader has asked to watch it run */

    /* --- the panel: sliders, readouts, footnote --- */

    const panel = host.querySelector(".sim__panel");
    const noteEl = host.querySelector("[data-sim-note]");
    const footEl = host.querySelector("[data-sim-foot]");
    panel.innerHTML =
      def.controls.map((c) => (c.choices ? `
        <div class="sim__ctrl sim__ctrl--pick">
          <span class="sim__ctrl-name" id="sim-${def.id}-${c.id}-lab">${c.label}</span>
          <div class="sim__pick${c.cols ? " sim__pick--grid" : ""}"
               ${c.cols ? `style="--cols:${c.cols}"` : ""} role="radiogroup"
               aria-labelledby="sim-${def.id}-${c.id}-lab" id="sim-${def.id}-${c.id}">
            ${c.choices.map((o) => `
              <button type="button" class="chip${o.value === c.value ? " is-active" : ""}"
                      role="radio" aria-checked="${o.value === c.value}"
                      ${o.off ? "disabled" : ""}
                      data-value="${o.value}">${o.label}</button>`).join("")}
          </div>
        </div>` : `
        <div class="sim__ctrl">
          <label for="sim-${def.id}-${c.id}">${c.label}</label>
          <output id="sim-${def.id}-${c.id}-val" for="sim-${def.id}-${c.id}"></output>
          <input id="sim-${def.id}-${c.id}" type="range" min="${c.min}" max="${c.max}"
                 step="${c.step}" value="${c.value}">
        </div>`)).join("") +
      `<button class="chip sim__play" type="button"
               id="sim-${def.id}-play">Play</button>` +
      def.readouts.map((r, i) => `
        <div class="sim__out${i ? " sim__out--tight" : ""}" aria-live="polite"
             id="sim-${def.id}-row-${r.id}">
          <div class="sim__rho">
            <span class="sim__rho-label" id="sim-${def.id}-lab-${r.id}"></span>
            <span id="sim-${def.id}-out-${r.id}"
                  class="sim__rho-val${i ? " sim__rho-val--sm" : ""}">&mdash;</span>
          </div>
          ${i === 0 && def.verdict
            ? `<span id="sim-${def.id}-verdict" class="sim__verdict"></span>` : ""}
        </div>`).join("");

    for (const c of def.controls) {
      inputs[c.id] = panel.querySelector(`#sim-${def.id}-${c.id}`);
      outs[c.id] = panel.querySelector(`#sim-${def.id}-${c.id}-val`);
    }
    const labels = {};
    const rows = {};
    for (const r of def.readouts) {
      readouts[r.id] = panel.querySelector(`#sim-${def.id}-out-${r.id}`);
      labels[r.id] = panel.querySelector(`#sim-${def.id}-lab-${r.id}`);
      rows[r.id] = panel.querySelector(`#sim-${def.id}-row-${r.id}`);
    }
    verdictEl = panel.querySelector(`#sim-${def.id}-verdict`);
    const playBtn = panel.querySelector(`#sim-${def.id}-play`);

    /* --- parameters, readouts --- */

    function readParams() {
      for (const c of def.controls) {
        if (c.choices) {
          const on = inputs[c.id].querySelector("[aria-checked=true]");
          P[c.id] = on ? on.dataset.value : c.value;
        } else {
          const raw = +inputs[c.id].value;
          P[c.id] = c.read ? c.read(raw) : raw;
        }
      }
      /* A slider can be beside the point in one mode and not another -- a
         virtual mass means nothing to a controller that has no way to render
         one -- so a control can say when it does not apply, and is switched
         off and dimmed rather than quietly ignored. */
      for (const c of def.controls) {
        const row = inputs[c.id].closest(".sim__ctrl");
        row.hidden = c.hide ? c.hide(P) : false;
        /* A group of chips is the question itself: it is either being asked
           or it is not. There is no value beside it to switch off. */
        if (c.choices) continue;
        /* A slider can belong to another mode entirely, in which case it goes
           away; or it can belong to this one and have nothing to say -- a
           virtual mass to a controller with no way to render one -- in which
           case it stays, switched off, so the reader can see that it is
           beside the point rather than missing. */
        const applies = c.applies ? c.applies(P) : true;
        /* A control the mode does not expose can still name the value that
           mode runs at. `lock` gives that value on the slider's own scale:
           the handle is parked there and switched off, so a law that keeps
           its own clock shows what the clock is instead of hiding the
           question. */
        const locked = !applies && c.lock ? c.lock(P) : null;
        if (locked != null) {
          /* Park the handle on the fixed value, but keep what the reader had
             set: coming back to a law that does read this slider should find
             it where they left it, not where another law's clock put it. */
          if (parked[c.id] === undefined) parked[c.id] = inputs[c.id].value;
          inputs[c.id].value = String(locked);
        } else if (parked[c.id] !== undefined) {
          inputs[c.id].value = parked[c.id];
          delete parked[c.id];
          const raw = +inputs[c.id].value;      /* P was read before this */
          P[c.id] = c.read ? c.read(raw) : raw;
        }
        const shown = locked != null ? (c.read ? c.read(locked) : locked) : P[c.id];
        inputs[c.id].disabled = !applies;
        row.classList.toggle("is-off", !applies);
        outs[c.id].textContent = !applies && locked == null ? (c.off || "—")
          : c.show ? c.show(shown, P) : String(shown);
      }
      for (const r of def.readouts) {
        if (rows[r.id]) rows[r.id].hidden = r.hide ? r.hide(P) : false;
        if (labels[r.id]) {
          /* markup, like the control labels: a readout naming a formula needs
             a span the uppercasing cannot reach */
          labels[r.id].innerHTML = typeof r.label === "function" ? r.label(P) : r.label;
        }
      }
    }

    function show(state) {
      if (!state) return;
      if (state.readouts) {
        for (const key in state.readouts) {
          if (readouts[key]) readouts[key].textContent = state.readouts[key];
        }
      }
      if (verdictEl && state.verdict) {
        verdictEl.textContent = state.verdict.text;
        verdictEl.classList.toggle("is-bad", !!state.verdict.bad);
      }
    }

    /* Each mode can have its own note and footnote, kept in data/site.js
       under SITE.sims[id].modes; a simulation with one mode just uses the
       block itself. */
    function words() {
      const all = (typeof SITE !== "undefined" && SITE.sims && SITE.sims[def.id]) || {};
      const key = def.words ? def.words(P) : null;
      const w = (key && all.modes && all.modes[key]) || all;
      /* A mode can have nothing to say -- a reference under the figure can
         be the whole of it -- so an absent line is cleared and hidden
         rather than left holding the words of the mode before it. */
      for (const [el, v] of [[noteEl, w.note], [footEl, w.foot]]) {
        if (!el) continue;
        setProse(el, v || "");
        el.hidden = !v;
      }
      /* A mode can name a paper instead of writing a footnote, and then the
         caption is the publication's own row. It is built from the DOI, so
         nothing about the paper is retyped here. */
      const ref = footEl && w.ref && typeof pubRef === "function" ? pubRef(w.ref) : "";
      if (footEl) footEl.classList.toggle("pub-ref", !!ref);
      if (ref) {
        footEl.removeAttribute("lang");   /* setProse may have left one */
        footEl.innerHTML = ref;
        footEl.hidden = false;
      }
    }

    function retune() {
      readParams();
      words();
      def.reset(P);
      show(def.tune ? def.tune(P) : null);
      show(def.live ? def.live(P) : null);
    }

    /* --- drawing --- */

    function draw() {
      const rect = canvas.getBoundingClientRect();
      /* nothing has been laid out yet; the observer below calls back when
         it has, so this is a wait rather than a failure */
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(rect.width * dpr), ch = Math.round(rect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      const D = rect.width / rect.height >= 1.1 ? WIDE : TALL;
      const scale = Math.min(rect.width / D.w, rect.height / D.h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.translate((rect.width - D.w * scale) / 2, (rect.height - D.h * scale) / 2);
      ctx.scale(scale, scale);
      ctx.textBaseline = "alphabetic";
      def.draw(g, P, D);
    }

    /* --- the run loop, which retires itself when the run is over --- */

    function frame() {
      if (!def.done(P)) def.advance(P, 1 / 60);
      draw();
      show(def.live ? def.live(P) : null);
      if (def.done(P)) { raf = null; syncPlay(); return; }
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    /* Reduced motion still gets the whole answer, just not the animation. */
    function runToEnd() {
      let guard = 0;
      while (!def.done(P) && guard++ < 6000) def.advance(P, 1 / 60);
    }

    /* A machine set to reduce motion used to be handed the finished figure
       and nothing else, which reads as a broken one: everything is there and
       none of it ever moves. So the run is still computed in full and drawn,
       and the button below offers the animation rather than starting it
       unasked. Once it has been asked for, the setting has been answered, and
       later runs -- a slider moved, say -- play without asking again. */
    const still = () => reduced.matches && !invited;

    function start() {
      if (!live) return;
      if (still()) { runToEnd(); draw(); show(def.live ? def.live(P) : null); }
      else if (def.done(P)) { draw(); show(def.live ? def.live(P) : null); }
      else if (raf === null) raf = requestAnimationFrame(frame);
      syncPlay();
    }

    /* One button, named for what it will do next. */
    function syncPlay() {
      if (!playBtn) return;
      playBtn.textContent = raf !== null ? "Pause" : def.done(P) ? "Replay" : "Play";
    }

    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (raf !== null) { stop(); syncPlay(); return; }
        invited = true;
        if (def.done(P)) retune();          /* a finished run starts again */
        raf = requestAnimationFrame(frame);
        syncPlay();
      });
    }

    for (const c of def.controls) {
      if (c.choices) {
        inputs[c.id].addEventListener("click", (ev) => {
          const btn = ev.target.closest("[role=radio]");
          if (!btn || btn.disabled) return;
          for (const b of inputs[c.id].querySelectorAll("[role=radio]")) {
            b.classList.toggle("is-active", b === btn);
            b.setAttribute("aria-checked", String(b === btn));
          }
          retune();
          start();
        });
      } else {
        inputs[c.id].addEventListener("input", () => { retune(); start(); });
      }
    }

    /* the setting can be changed while the page is open */
    if (reduced.addEventListener) {
      reduced.addEventListener("change", () => { stop(); retune(); start(); });
    }

    /* The canvas can be measured at zero -- a tab that has not been shown,
       fonts still arriving, a column mid-reflow -- and a run that has already
       finished never asks again. Watching the element itself covers all of
       them, where a window resize listener covers only one. */
    if (window.ResizeObserver) {
      new ResizeObserver(() => { if (raf === null) draw(); }).observe(canvas);
    } else {
      window.addEventListener("resize", () => { if (raf === null) draw(); });
    }
    /* the labels are measured in a font that may not have arrived yet */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (raf === null) draw(); });
    }

    /* Settled before anything can ask for a frame: a tab that has not been
       opened yet still has an observer on its canvas, and that observer must
       not be the first thing to reach the module's state. */
    retune();

    return {
      /* a hidden canvas is not worth a frame */
      show() { live = true; retune(); start(); },
      hide() { live = false; stop(); },
      pause() { stop(); syncPlay(); },
      resume: start,
      redraw() { if (raf === null) draw(); },
      words,
    };
  }

  /* ---------- the tabs ---------- */

  function boot() {
    const tablist = document.getElementById("simtabs");
    const stack = document.getElementById("simpanels");
    if (!tablist || !stack || !defs.length) return;

    const words = (id) => (typeof SITE !== "undefined" && SITE.sims && SITE.sims[id]) || {};

    tablist.innerHTML = defs.map((d, i) => `
      <button class="chip${i ? "" : " is-active"}" type="button" role="tab"
              id="simtab-${d.id}" aria-controls="simpanel-${d.id}"
              aria-selected="${i ? "false" : "true"}" tabindex="${i ? "-1" : "0"}"
      >${words(d.id).tab || d.id}</button>`).join("");

    stack.innerHTML = defs.map((d, i) => `
      <div class="simpanel" id="simpanel-${d.id}" role="tabpanel"
           aria-labelledby="simtab-${d.id}" tabindex="0" ${i ? "hidden" : ""}>
        <div class="sim">
          <figure class="sim__fig">
            <canvas aria-label="${d.canvasLabel}"></canvas>
          </figure>
          <div class="sim__panel"></div>
          <div class="sim__words">
            <p class="sim__note" data-sim-note></p>
            <p class="sim__foot" data-sim-foot></p>
          </div>
        </div>
      </div>`).join("");

    const running = defs.map((d) => runner(d, document.getElementById("simpanel-" + d.id)));

    /* the prose is the site's, so it is written here and rewritten whenever
       the language toggle fires */
    function fillWords() {
      defs.forEach((d, i) => {
        const tab = document.getElementById("simtab-" + d.id);
        const w = words(d.id);
        if (tab && w.tab) tab.textContent = w.tab;
        if (running[i]) running[i].words();
      });
    }
    fillWords();
    document.addEventListener("icar:lang", fillWords);

    let current = 0;

    function select(next, focus) {
      if (next === current) return;
      if (running[current]) running[current].hide();
      current = next;
      defs.forEach((d, i) => {
        const tab = document.getElementById("simtab-" + d.id);
        tab.classList.toggle("is-active", i === next);
        tab.setAttribute("aria-selected", String(i === next));
        tab.tabIndex = i === next ? 0 : -1;
        document.getElementById("simpanel-" + d.id).hidden = i !== next;
      });
      if (focus) document.getElementById("simtab-" + defs[next].id).focus();
      if (running[next]) running[next].show();
    }

    tablist.addEventListener("click", (e) => {
      const btn = e.target.closest("[role=tab]");
      if (!btn) return;
      select(defs.findIndex((d) => "simtab-" + d.id === btn.id), false);
    });

    /* arrow keys walk the tabs, which is what a tablist is expected to do */
    tablist.addEventListener("keydown", (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const next = !Number.isFinite(step)
        ? (step < 0 ? 0 : defs.length - 1)
        : (current + step + defs.length) % defs.length;
      select(next, true);
    });

    document.addEventListener("visibilitychange", () => {
      if (!running[current]) return;
      if (document.hidden) running[current].pause();
      else running[current].resume();
    });

    if (running[0]) running[0].show();
  }

  return {
    register: (def) => defs.push(def),
    hue: HUE,
    discretize,
    boot,
  };
})();

/* Every module is a plain script loaded after this one, so by the time the
   document is parsed they have all registered. */
document.addEventListener("DOMContentLoaded", SIM.boot);
