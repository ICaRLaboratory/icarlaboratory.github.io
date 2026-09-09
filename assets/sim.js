/* ===============================================================
   The loop, with the gains exposed.

   Two joints of an arm, each under the same sampled-data PD law:

       plant       q'' = u                    (one per joint)
       controller  u[k] = Kp (r - q[k-m]) - Kd q'[k-m],  held to k+1

   Decoupled double integrators are the model a computed-torque law
   leaves behind, so this is the honest small version of the lab's
   own subject rather than a cartoon of it. Both joints share the
   gains, the sampling period and the delay, which is why one
   stability number covers the pair.

   A run is one step, held, and it ends when the response does: both
   joints inside a 2% band for long enough and it stops there. The
   length of the record is therefore the answer. A well damped loop
   finishes in about a second and leaves most of the axis empty; a
   poorly damped one rings across all of it; an unstable one walks
   off the frame. Ten seconds is only the cap.
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
  const settleOut = document.getElementById("sim-settle");
  if (!inputs.kp || !rhoOut) return;

  const P = { kp: 6, kd: 3, h: 0.05, m: 0 };

  const WINDOW = 10;          /* the cap on one run, in seconds */
  const HOLD = 0.45;          /* how long it has to stay inside the band */
  /* shoulder and elbow, in radians: where they start and where they are sent */
  const JOINTS = [
    { from: -2.16, to: -1.24 },
    { from: 1.62, to: 0.54 },
  ];
  const BAND = 0.02;          /* of each joint's own step */

  /* ---------- the sampled-data loop ---------- */

  let q, v, held, queue, simT, nextT, hist, marks, diverged, inBand, settledAt;

  const done = () => diverged || settledAt !== null || simT >= WINDOW;

  function reset() {
    q = JOINTS.map((j) => j.from);
    v = [0, 0];
    held = [0, 0];
    queue = [[], []];
    simT = 0;
    nextT = 0;
    hist = [];
    marks = [];
    diverged = false;
    inBand = 0;
    settledAt = null;
  }

  /* Exact between samples: with the input held constant a double integrator
     closes in one line, so nothing here accumulates integration error. */
  function coast(dt) {
    for (let i = 0; i < 2; i++) {
      q[i] += v[i] * dt + 0.5 * held[i] * dt * dt;
      v[i] += held[i] * dt;
    }
    simT += dt;
  }

  function sample() {
    for (let i = 0; i < 2; i++) {
      queue[i].push(P.kp * (JOINTS[i].to - q[i]) - P.kd * v[i]);
      const k = queue[i].length - 1 - P.m;
      held[i] = k >= 0 ? queue[i][k] : 0;
      if (queue[i].length > 64) queue[i].shift();
    }
    marks.push([simT, q[0], q[1]]);
    if (marks.length > 1200) marks.shift();
  }

  /* each joint on its own scale, 0 where it started and 1 at its target, so
     one target line and one band serve both traces */
  const progress = (i, value = q[i]) =>
    (value - JOINTS[i].from) / (JOINTS[i].to - JOINTS[i].from);

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
    hist.push([simT, q[0], q[1], v[0], v[1]]);
    if (hist.length > 1400) hist.shift();

    const wild = q.some((a, i) => !Number.isFinite(a) || Math.abs(progress(i)) > 4)
      || v.some((s) => Math.abs(s) > 80);
    if (wild) diverged = true;

    if (!diverged) {
      const settled = [0, 1].every((i) =>
        Math.abs(1 - progress(i)) <= BAND && Math.abs(v[i]) <= 0.25);
      if (settled) {
        inBand += dt;
        if (inBand >= HOLD && settledAt === null) settledAt = simT - inBand;
      } else {
        inBand = 0;
      }
    }
  }

  /* ---------- stability of the loop, not of the picture ----------
     One step of the loop, written on the augmented state
     z = [q, q', u(k-1), ..., u(k-m)], is a matrix, and the loop is stable
     exactly when that matrix has spectral radius under 1. Without a delay
     it is 2x2 and closes in radicals; with one it is read off matrix
     powers, which a complex leading pair does not throw off. Both joints
     carry the same matrix, so one number covers them. */

  function spectralRadius() {
    const h = P.h, m = P.m, n = 2 + m;
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    if (m === 0) {
      M[0][0] = 1 - 0.5 * h * h * P.kp;
      M[0][1] = h - 0.5 * h * h * P.kd;
      M[1][0] = -h * P.kp;
      M[1][1] = 1 - h * P.kd;
      const tr = M[0][0] + M[1][1];
      const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      const disc = tr * tr - 4 * det;
      if (disc < 0) return Math.sqrt(Math.abs(det));
      const r = Math.sqrt(disc);
      return Math.max(Math.abs((tr + r) / 2), Math.abs((tr - r) / 2));
    }
    M[0][0] = 1; M[0][1] = h; M[0][n - 1] = 0.5 * h * h;
    M[1][1] = 1; M[1][n - 1] = h;
    M[2][0] = -P.kp; M[2][1] = -P.kd;
    for (let i = 3; i < n; i++) M[i][i - 1] = 1;
    return radiusByPowers(M, n);
  }

  /* rho(M) = lim ||M^n||^(1/n); repeated squaring reaches n = 4096 in twelve
     multiplications and does not stall on a complex leading pair. */
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
    /* Three places is enough to read, but near the boundary show as many as it
       takes to separate the number from 1, so a loop that really is unstable
       never sits beside a flat 1.000 and looks like a mistake. */
    let places = 3;
    if (Number.isFinite(rho)) {
      const gap = Math.abs(rho - 1);
      if (gap > 0 && gap < 0.0015) places = Math.min(7, Math.ceil(-Math.log10(gap)) + 1);
    }
    rhoOut.textContent = Number.isFinite(rho) ? rho.toFixed(places) : "∞";
    const bad = !(rho < 1);
    verdict.textContent = bad ? "Unstable" : "Stable";
    verdict.classList.toggle("is-bad", bad);
    reset();
    showSettling();
  }

  function showSettling() {
    if (!settleOut) return;
    settleOut.textContent = settledAt !== null ? settledAt.toFixed(2) + " s"
      : diverged ? "never"
      : simT >= WINDOW ? "over " + WINDOW + " s"
      : "—";
  }

  /* ---------- drawing ---------- */

  const D = { w: 0, h: 0 };
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

  function inPanel(p, title, body) {
    frameBox(p, title);
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

  /* both joints' errors, so two trajectories spiral into the one origin */
  function drawPhase(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + 8;
    const s = Math.min(p.w, p.h - 26) / 2 / 1.5;
    ctx.strokeStyle = INK(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 8, cy); ctx.lineTo(p.x + p.w - 8, cy);
    ctx.moveTo(cx, p.y + 26); ctx.lineTo(cx, p.y + p.h - 8);
    ctx.stroke();

    for (let j = 0; j < 2; j++) {
      const span = JOINTS[j].to - JOINTS[j].from;
      const ex = (row) => (1 - progress(j, row[1 + j])) * s * (span > 0 ? 1 : -1);
      const ey = (row) => (row[3 + j] / Math.abs(span)) * s * 0.34;
      ctx.lineWidth = j === 0 ? 1.5 : 1.1;
      for (let i = 1; i < hist.length; i++) {
        const a = i / hist.length;
        ctx.strokeStyle = INK((j === 0 ? 0.08 : 0.05) + a * (j === 0 ? 0.7 : 0.4));
        ctx.beginPath();
        ctx.moveTo(cx + ex(hist[i - 1]), cy - ey(hist[i - 1]));
        ctx.lineTo(cx + ex(hist[i]), cy - ey(hist[i]));
        ctx.stroke();
      }
      if (hist.length) {
        const last = hist[hist.length - 1];
        ctx.fillStyle = j === 0 ? INK(1) : INK(0.5);
        ctx.beginPath();
        ctx.arc(cx + ex(last), cy - ey(last), j === 0 ? 3.2 : 2.4, 0, 7);
        ctx.fill();
      }
    }
  }

  function drawArm(p) {
    const bx = p.x + p.w / 2, by = p.y + p.h * 0.72;
    const L = Math.min(p.w * 0.26, p.h * 0.26);
    const a1 = q[0], a2 = q[1];
    const j1 = { x: bx + Math.cos(a1) * L, y: by + Math.sin(a1) * L };
    const tip = { x: j1.x + Math.cos(a1 + a2) * L, y: j1.y + Math.sin(a1 + a2) * L };

    /* where it was sent */
    const t1 = JOINTS[0].to, t2 = JOINTS[1].to;
    const g1 = { x: bx + Math.cos(t1) * L, y: by + Math.sin(t1) * L };
    const g2 = { x: g1.x + Math.cos(t1 + t2) * L, y: g1.y + Math.sin(t1 + t2) * L };
    ctx.strokeStyle = INK(0.2);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(g2.x, g2.y, 4, 0, 7); ctx.stroke();

    /* the tip's own path, which two joints make more than a swing */
    if (hist.length > 1) {
      ctx.strokeStyle = INK(0.28);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const A = hist[i][1], B = hist[i][2];
        const e = { x: bx + Math.cos(A) * L + Math.cos(A + B) * L,
                    y: by + Math.sin(A) * L + Math.sin(A + B) * L };
        i ? ctx.lineTo(e.x, e.y) : ctx.moveTo(e.x, e.y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = INK(0.16);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx - 30, by); ctx.lineTo(bx + 30, by); ctx.stroke();

    ctx.strokeStyle = INK(1);
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(j1.x, j1.y); ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.moveTo(bx - 9, by); ctx.lineTo(bx + 9, by);
    ctx.lineTo(bx + 6, by + 11); ctx.lineTo(bx - 6, by + 11); ctx.closePath(); ctx.fill();
    for (const [pt, r, solid] of [[j1, 4, false], [tip, 4.6, true]]) {
      ctx.fillStyle = solid ? "#0a0a0a" : "#fff";
      ctx.strokeStyle = INK(1);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  /* Both joints on one angle scale rather than each normalised to its own
     step: normalised, two identical loops draw the same curve twice and the
     panel looks like it holds one trace. */
  const A_TOP = 1.95, A_BOT = -2.5;

  function drawSampled(p) {
    const x0 = p.x + 10, x1 = p.x + p.w - 10;
    const yTop = p.y + 30, yBot = p.y + p.h - 14;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (a) => yTop + ((A_TOP - a) / (A_TOP - A_BOT)) * (yBot - yTop);

    for (let j = 0; j < 2; j++) {
      const target = JOINTS[j].to;
      const band = BAND * Math.abs(JOINTS[j].to - JOINTS[j].from);
      ctx.fillStyle = INK(0.07);
      ctx.fillRect(x0, py(target + band), x1 - x0, py(target - band) - py(target + band));
      ctx.strokeStyle = INK(0.32);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x0, py(target)); ctx.lineTo(x1, py(target)); ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = INK(j === 0 ? 0.28 : 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const row of hist) {
        const X = px(row[0]), Y = py(row[1 + j]);
        started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
      }
      ctx.stroke();

      /* zero-order hold: what the controller was actually handed */
      ctx.strokeStyle = INK(j === 0 ? 0.95 : 0.55);
      ctx.lineWidth = j === 0 ? 1.6 : 1.3;
      ctx.beginPath();
      for (let i = 0; i < marks.length; i++) {
        const X = px(marks[i][0]), Y = py(marks[i][1 + j]);
        const Xn = i + 1 < marks.length ? px(marks[i + 1][0]) : px(Math.min(simT, WINDOW));
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        ctx.lineTo(Xn, Y);
      }
      ctx.stroke();
    }

    /* where it was declared settled */
    if (settledAt !== null) {
      ctx.strokeStyle = INK(0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px(settledAt), p.y + 26); ctx.lineTo(px(settledAt), p.y + p.h - 10);
      ctx.stroke();
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

    inPanel(panels[0], "JOINT ERRORS", () => drawPhase(panels[0]));
    inPanel(panels[1], "ARM", () => drawArm(panels[1]));
    inPanel(panels[2], "MEASURED", () => drawSampled(panels[2]));
  }

  /* ---------- run ---------- */

  let raf = null;

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  /* the loop retires itself the moment the run finishes, so a settled figure
     costs nothing to leave on the page */
  function loop() {
    if (!done()) advance(1 / 60);
    draw();
    showSettling();
    if (done()) { raf = null; return; }
    raf = requestAnimationFrame(loop);
  }

  /* Reduced motion still gets the whole answer, just not the animation of it. */
  function runToEnd() {
    let guard = 0;
    while (!done() && guard++ < 5000) advance(1 / 60);
  }

  function start() {
    if (reduced.matches) { runToEnd(); draw(); showSettling(); return; }
    if (done()) { draw(); showSettling(); return; }
    if (raf === null) raf = requestAnimationFrame(loop);
  }

  for (const el of Object.values(inputs)) {
    el.addEventListener("input", () => { readParams(); start(); });
  }
  readParams();
  start();

  reduced.addEventListener("change", () => { stop(); start(); });
  window.addEventListener("resize", () => { if (raf === null) draw(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
})();
