/* ===============================================================
   The loop, with the gains exposed.

   A mass under proportional-derivative feedback, measured on a
   clock rather than continuously, and acted on a few samples late:

       plant       x'' = u
       controller  u[k] = -Kp x[k-m] - Kd x'[k-m],  held until k+1

   With h -> 0 and m = 0 this is the textbook continuous loop and
   any positive gain pair is stable. Give the loop a sampling period
   and a delay and that stops being true, which is the whole subject:
   the readout prints the spectral radius of the sampled-data loop,
   and the figure diverges exactly when that number passes 1.

   Three panels, the same three the hero figure draws: the phase
   plane of the state, a two-link arm posed from it, and the sampled
   measurement the controller actually sees.
   =============================================================== */

(function () {
  const canvas = document.getElementById("simfig");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const INK = (a) => `rgba(10,10,10,${a})`;

  /* ---------- controls ---------- */

  const inputs = {
    kp: document.getElementById("sim-kp"),
    kd: document.getElementById("sim-kd"),
    h: document.getElementById("sim-h"),
    m: document.getElementById("sim-m"),
  };
  const outs = {
    kp: document.getElementById("sim-kp-val"),
    kd: document.getElementById("sim-kd-val"),
    h: document.getElementById("sim-h-val"),
    m: document.getElementById("sim-m-val"),
  };
  const rhoOut = document.getElementById("sim-rho");
  const verdict = document.getElementById("sim-verdict");
  if (!inputs.kp || !rhoOut) return;

  const P = { kp: 6, kd: 3, h: 0.05, m: 0 };

  /* ---------- the sampled-data loop ---------- */

  let x, v, held, queue, simT, nextT, hist, marks, diverged, settleT;

  function reset() {
    const a = Math.random() * Math.PI * 2;
    x = Math.cos(a) * 1.6;
    v = Math.sin(a) * 2.2;
    held = 0;
    queue = [];
    simT = 0;
    nextT = 0;
    hist = [];
    marks = [];
    diverged = false;
    settleT = 0;
  }

  /* Exact between samples: with u held constant the double integrator
     closes in one line, so nothing here accumulates integration error. */
  function coast(dt) {
    x += v * dt + 0.5 * held * dt * dt;
    v += held * dt;
    simT += dt;
  }

  function sample() {
    const u = -P.kp * x - P.kd * v;
    queue.push(u);
    const i = queue.length - 1 - P.m;
    held = i >= 0 ? queue[i] : 0;
    if (queue.length > 64) queue.shift();
    marks.push([simT, x]);
    if (marks.length > 240) marks.shift();
  }

  function advance(dt) {
    let left = dt;
    let guard = 0;
    while (left > 1e-9 && guard++ < 400) {
      if (simT >= nextT - 1e-12) {
        sample();
        nextT = simT + P.h;
      }
      const stepTo = Math.min(left, Math.max(nextT - simT, 1e-9));
      coast(stepTo);
      left -= stepTo;
    }
    hist.push([simT, x, v]);
    if (hist.length > 1400) hist.shift();

    if (!Number.isFinite(x) || Math.abs(x) > 8 || Math.abs(v) > 60) diverged = true;
    /* settled or blown up: start again so the figure keeps its life */
    if (diverged) {
      settleT += dt;
      if (settleT > 1.1) reset();
    } else if (Math.hypot(x, v * 0.5) < 0.02) {
      settleT += dt;
      if (settleT > 1.0) reset();
    } else {
      settleT = 0;
    }
  }

  /* ---------- stability of the loop, not of the picture ----------
     One step of the loop, written on the augmented state
     z = [x, x', u(k-1), ..., u(k-m)], is a matrix, and the loop is stable
     exactly when that matrix has spectral radius under 1. Without a delay
     it is 2x2 and closes in radicals; with one it is read off matrix
     powers, which a complex leading pair does not throw off. */

  function spectralRadius() {
    const h = P.h, m = P.m, n = 2 + m;
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    if (m === 0) {
      /* u is computed and applied within the same step */
      M[0][0] = 1 - 0.5 * h * h * P.kp;
      M[0][1] = h - 0.5 * h * h * P.kd;
      M[1][0] = -h * P.kp;
      M[1][1] = 1 - h * P.kd;
      /* 2x2 closes in radicals, so take it exactly */
      const tr = M[0][0] + M[1][1];
      const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      const disc = tr * tr - 4 * det;
      if (disc < 0) return Math.sqrt(Math.abs(det));   /* complex pair */
      const r = Math.sqrt(disc);
      return Math.max(Math.abs((tr + r) / 2), Math.abs((tr - r) / 2));
    }
    /* z = [x, x', u(k-1), ..., u(k-m)]: the input in force is the oldest */
    M[0][0] = 1; M[0][1] = h; M[0][n - 1] = 0.5 * h * h;
    M[1][1] = 1; M[1][n - 1] = h;
    M[2][0] = -P.kp; M[2][1] = -P.kd;            /* the new u joins the queue */
    for (let i = 3; i < n; i++) M[i][i - 1] = 1;  /* and the queue shifts */
    return radiusByPowers(M, n);
  }

  /* rho(M) = lim ||M^n||^(1/n). Repeated squaring reaches n = 4096 in twelve
     multiplications and, unlike iterating a vector, does not stall on a
     complex leading pair. */
  function radiusByPowers(M, n) {
    const norm = (A) => {
      let best = 0;
      for (let i = 0; i < n; i++) {
        let row = 0;
        for (let j = 0; j < n; j++) row += Math.abs(A[i][j]);
        if (row > best) best = row;
      }
      return best;
    };
    const mul = (A, B) => {
      const C = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++)
        for (let k = 0; k < n; k++) {
          const a = A[i][k];
          if (a === 0) continue;
          for (let j = 0; j < n; j++) C[i][j] += a * B[k][j];
        }
      return C;
    };
    let s = norm(M);
    if (s === 0) return 0;
    let B = M.map((row) => row.map((c) => c / s));
    let logN = Math.log(s);
    let count = 1;
    for (let k = 0; k < 12; k++) {
      const sq = mul(B, B);
      const sn = norm(sq);
      if (!Number.isFinite(sn)) return Infinity;
      if (sn === 0) return 0;
      B = sq.map((row) => row.map((c) => c / sn));
      logN = 2 * logN + Math.log(sn);
      count *= 2;
    }
    return Math.exp(logN / count);
  }

  function readParams() {
    P.kp = +inputs.kp.value;
    P.kd = +inputs.kd.value;
    P.h = +inputs.h.value / 1000;
    P.m = +inputs.m.value;
    outs.kp.textContent = P.kp.toFixed(1);
    outs.kd.textContent = P.kd.toFixed(1);
    outs.h.textContent = inputs.h.value + " ms";
    outs.m.textContent = P.m === 0 ? "none" : P.m + (P.m > 1 ? " samples" : " sample");

    const rho = spectralRadius();
    /* Three places is enough to read, but near the boundary show as many as
       it takes to separate the number from 1, so a loop that really is
       unstable never sits beside a flat 1.000 and looks like a mistake. */
    let places = 3;
    if (Number.isFinite(rho)) {
      const gap = Math.abs(rho - 1);
      if (gap > 0 && gap < 0.0015) {
        places = Math.min(7, Math.ceil(-Math.log10(gap)) + 1);
      }
    }
    rhoOut.textContent = Number.isFinite(rho) ? rho.toFixed(places) : "∞";
    const bad = !(rho < 1);
    verdict.textContent = bad ? "Unstable" : "Stable";
    verdict.classList.toggle("is-bad", bad);
    reset();
    if (reduced.matches) draw();
  }

  /* ---------- drawing ---------- */

  const D = { w: 0, h: 0 };            /* design space, set per layout */
  let panels = [];

  function layout(aspect) {
    if (aspect >= 1.75) {
      D.w = 780; D.h = 340;
      const g = 22, pw = (780 - g * 2) / 3;
      panels = [0, 1, 2].map((i) => ({ x: i * (pw + g), y: 0, w: pw, h: 340 }));
    } else {
      D.w = 340; D.h = 540;
      const g = 18, ph = (540 - g * 2) / 3;
      panels = [0, 1, 2].map((i) => ({ x: 0, y: i * (ph + g), w: 340, h: ph }));
    }
  }

  /* every panel draws inside its own box; a diverging run would otherwise
     scribble across its neighbours */
  function inPanel(p, title, body) {
    frameBox(p, title);                 /* outside the clip, so the rule survives */
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
    ctx.clip();
    body();
    ctx.restore();
  }

  function frameBox(p, title) {
    ctx.strokeStyle = INK(0.13);
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.6px";
    ctx.fillStyle = INK(0.55);
    ctx.textAlign = "left";
    ctx.fillText(title, p.x + 10, p.y + 19);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  }

  function drawPhase(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + 8;
    const s = Math.min(p.w, p.h - 26) / 2 / 3.2;
    ctx.strokeStyle = INK(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 8, cy); ctx.lineTo(p.x + p.w - 8, cy);
    ctx.moveTo(cx, p.y + 26); ctx.lineTo(cx, p.y + p.h - 8);
    ctx.stroke();

    const pts = hist.slice(-520);
    ctx.lineWidth = 1.3;
    for (let i = 1; i < pts.length; i++) {
      const a = i / pts.length;
      ctx.strokeStyle = INK(0.06 + a * 0.72);
      ctx.beginPath();
      ctx.moveTo(cx + pts[i - 1][1] * s, cy - pts[i - 1][2] * s * 0.42);
      ctx.lineTo(cx + pts[i][1] * s, cy - pts[i][2] * s * 0.42);
      ctx.stroke();
    }
    ctx.fillStyle = INK(1);
    ctx.beginPath();
    ctx.arc(cx + x * s, cy - v * s * 0.42, 3.2, 0, 7);
    ctx.fill();
  }

  function drawArm(p) {
    const bx = p.x + p.w / 2, by = p.y + p.h * 0.74;
    const L = Math.min(p.w * 0.3, p.h * 0.3);
    /* a resting bend, so the arm reads as an arm at x = 0, and a clamp so a
       diverging run swings hard without leaving the panel */
    const q = Math.max(-2.6, Math.min(2.6, x));
    const a1 = -Math.PI / 2 - 0.42 + q * 0.34;
    const a2 = 0.84 + q * 0.5;
    const j = { x: bx + Math.cos(a1) * L, y: by + Math.sin(a1) * L };
    const e = { x: j.x + Math.cos(a1 + a2) * L, y: j.y + Math.sin(a1 + a2) * L };

    ctx.strokeStyle = INK(0.16);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx - 26, by); ctx.lineTo(bx + 26, by); ctx.stroke();

    ctx.strokeStyle = INK(0.85);
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(j.x, j.y); ctx.lineTo(e.x, e.y);
    ctx.stroke();
    for (const [q, r] of [[{ x: bx, y: by }, 4], [j, 3.4], [e, 4.2]]) {
      ctx.fillStyle = r > 4 ? INK(1) : "#fff";
      ctx.strokeStyle = INK(0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  function drawSampled(p) {
    const x0 = p.x + 10, x1 = p.x + p.w - 10;
    const cy = p.y + p.h / 2 + 8;
    const s = (p.h - 52) / 2 / 3;
    ctx.strokeStyle = INK(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();

    const span = 3.2;                      /* seconds shown */
    const t1 = simT, t0 = t1 - span;
    const px = (t) => x0 + ((t - t0) / span) * (x1 - x0);

    ctx.strokeStyle = INK(0.26);
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (const [t, xx] of hist) {
      if (t < t0) continue;
      const X = px(t), Y = cy - xx * s;
      started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
    }
    ctx.stroke();

    /* zero-order hold: what the controller is actually handed */
    const vis = marks.filter(([t]) => t >= t0);
    ctx.strokeStyle = INK(0.95);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < vis.length; i++) {
      const X = px(vis[i][0]), Y = cy - vis[i][1] * s;
      const Xn = i + 1 < vis.length ? px(vis[i + 1][0]) : px(t1);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      ctx.lineTo(Xn, Y);
    }
    ctx.stroke();
    ctx.fillStyle = INK(0.9);
    for (const [t, xx] of vis) {
      ctx.beginPath(); ctx.arc(px(t), cy - xx * s, 1.9, 0, 7); ctx.fill();
    }
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(rect.width * dpr), ch = Math.round(rect.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }

    layout(rect.width / rect.height);
    const scale = Math.min(rect.width / D.w, rect.height / D.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.translate((rect.width - D.w * scale) / 2, (rect.height - D.h * scale) / 2);
    ctx.scale(scale, scale);

    inPanel(panels[0], "PHASE PLANE", () => drawPhase(panels[0]));
    inPanel(panels[1], "PLANT", () => drawArm(panels[1]));
    inPanel(panels[2], "MEASURED", () => drawSampled(panels[2]));
  }

  /* ---------- run ---------- */

  let raf = null;
  function loop() {
    advance(1 / 60);
    draw();
    raf = requestAnimationFrame(loop);
  }

  for (const el of Object.values(inputs)) {
    el.addEventListener("input", readParams);
  }
  readParams();

  if (reduced.matches) draw();
  else raf = requestAnimationFrame(loop);

  reduced.addEventListener("change", () => {
    if (reduced.matches) { if (raf) cancelAnimationFrame(raf); raf = null; draw(); }
    else if (!raf) raf = requestAnimationFrame(loop);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf && !reduced.matches) raf = requestAnimationFrame(loop);
  });
})();
