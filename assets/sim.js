/* ===============================================================
   The loop, with the gains exposed.

   The plant is a two-link planar arm in the horizontal plane, with
   its real dynamics rather than a stand-in for them:

       M(q) q'' + c(q, q') = tau

   M is the inertia matrix, which changes with the elbow angle, and c
   collects the Coriolis and centripetal terms. The joints are
   therefore coupled: swinging the shoulder throws the elbow, and the
   inertia the controller is pushing against is different at the end
   of the move than at the start.

   The controller is plain sampled PD on each joint, with no attempt
   to cancel any of that:

       tau[k] = Kp (r - q[k-m]) - Kd q'[k-m],   held until k+1

   Deliberately plain. Computed torque would cancel the coupling and
   leave two identical step responses, which is the point of the
   method and the death of the picture.

   The stability readout is the loop linearised about the target
   pose, discretised with the hold and the delay: at q' = 0 the
   Coriolis terms and their derivatives vanish, so the linearisation
   is exactly M(r) dq'' = -Kp dq - Kd dq', and its spectral radius
   decides local stability. Checked against the nonlinear run over a
   dozen settings: every radius over one fails to settle. Some of
   those do not run away, though -- the varying inertia and the
   Coriolis terms bound the growth, and the arm chatters around the
   pose in a limit cycle instead of leaving the frame. So the verdict
   can read Unstable beside a settling time of "over 10 s" rather
   than "never", and both are telling the truth: unstable about the
   pose, and never settling on it.

   A run ends when both joints hold a 2% band, so its length is the
   answer. Ten seconds is only the cap.
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

  const P = { kp: 40, kd: 5, h: 0.04, m: 0 };

  const WINDOW = 20;          /* the cap on one run, in seconds */
  const HOLD = 0.45;          /* how long it has to stay inside the band */
  /* shoulder and elbow, in radians: where they start and where they are sent */
  const JOINTS = [
    { from: -2.16, to: -1.24 },
    { from: 1.62, to: 0.54 },
  ];
  const BAND = 0.02;          /* of each joint's own step */

  /* the arm: point masses at the end of each link, which is the smallest
     model that still has a varying inertia and real Coriolis terms */
  const ARM = { m1: 1, m2: 0.7, l1: 1, l2: 0.85 };

  function inertia(q2) {
    const { m1, m2, l1, l2 } = ARM;
    const off = m2 * l2 * l2 + m2 * l1 * l2 * Math.cos(q2);
    return [(m1 + m2) * l1 * l1 + m2 * l2 * l2 + 2 * m2 * l1 * l2 * Math.cos(q2),
            off, off, m2 * l2 * l2];                       /* [a, b, b, d] */
  }

  /* Coriolis and centripetal, the terms that couple the two joints */
  function coriolis(q2, d1, d2) {
    const k = ARM.m2 * ARM.l1 * ARM.l2 * Math.sin(q2);
    return [-k * (2 * d1 * d2 + d2 * d2), k * d1 * d1];
  }

  function solve2(Mv, r0, r1) {
    const [a, b, , d] = Mv;
    const det = a * d - b * b;
    return [(d * r0 - b * r1) / det, (a * r1 - b * r0) / det];
  }

  /* q'' = M(q)^-1 (tau - c(q, q')) */
  function accel(qv, dv, tau) {
    const c = coriolis(qv[1], dv[0], dv[1]);
    return solve2(inertia(qv[1]), tau[0] - c[0], tau[1] - c[1]);
  }

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

  /* The arm is nonlinear, so it is integrated rather than solved: RK4 on
     [q, q'] with the torque held, in steps well under the sampling period. */
  const SUB = 1 / 600;

  function deriv(y) {
    const a = accel([y[0], y[1]], [y[2], y[3]], held);
    return [y[2], y[3], a[0], a[1]];
  }

  function rk4(dt) {
    let y = [q[0], q[1], v[0], v[1]];
    const k1 = deriv(y);
    const k2 = deriv(y.map((c, i) => c + (dt / 2) * k1[i]));
    const k3 = deriv(y.map((c, i) => c + (dt / 2) * k2[i]));
    const k4 = deriv(y.map((c, i) => c + dt * k3[i]));
    y = y.map((c, i) => c + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    q = [y[0], y[1]];
    v = [y[2], y[3]];
    simT += dt;
  }

  function coast(dt) {
    let left = dt;
    while (left > 1e-12) {
      const step = Math.min(SUB, left);
      rk4(step);
      left -= step;
    }
  }

  function sample() {
    for (let i = 0; i < 2; i++) {
      /* plain PD, in torque, with nothing cancelled */
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

    const wild = q.some((a, i) => !Number.isFinite(a) || Math.abs(progress(i)) > 5)
      || v.some((s) => Math.abs(s) > 120);
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
     Linearise about the target pose. At q' = 0 the Coriolis terms and their
     derivatives both vanish, so what is left is M(r) dq'' = -Kp dq - Kd dq' --
     a four-state plant whose channels are coupled only through M(r)^-1. The
     hold makes that exact rather than approximate: with A nilpotent,
     exp(Ah) and its integral are polynomials in h, so no matrix exponential
     is needed. Written on z = [dq, dq', tau(k-1), ..., tau(k-m)] the loop is
     one matrix, and it is locally stable exactly when the radius is under 1. */

  function spectralRadius() {
    const h = P.h, m = P.m;
    const Mv = inertia(JOINTS[1].to);
    const [a, b, , d] = Mv;
    const det = a * d - b * b;
    const Mi = [d / det, -b / det, -b / det, a / det];      /* M(r)^-1 */

    const n = 4 + 2 * m;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    /* dq(k+1) = dq + h dq' + (h^2/2) M^-1 tau,  dq'(k+1) = dq' + h M^-1 tau */
    A[0][0] = 1; A[1][1] = 1;
    A[0][2] = h; A[1][3] = h;
    A[2][2] = 1; A[3][3] = 1;
    const put = (row, col, val) => { A[row][col] += val; };
    const applied = m === 0 ? null : n - 2;                 /* the oldest torque */
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const g = Mi[i * 2 + j];
        if (applied === null) {
          /* tau(k) = -Kp dq - Kd dq', substituted straight in */
          put(i, j, -0.5 * h * h * g * P.kp);
          put(i, 2 + j, -0.5 * h * h * g * P.kd);
          put(2 + i, j, -h * g * P.kp);
          put(2 + i, 2 + j, -h * g * P.kd);
        } else {
          put(i, applied + j, 0.5 * h * h * g);
          put(2 + i, applied + j, h * g);
        }
      }
    }
    if (applied !== null) {
      for (let i = 0; i < 2; i++) {
        A[4 + i][i] = -P.kp;                                /* the new torque */
        A[4 + i][2 + i] = -P.kd;
      }
      for (let k = 1; k < m; k++) {                         /* and the queue shifts */
        A[4 + 2 * k][2 + 2 * k] = 1;
        A[5 + 2 * k][3 + 2 * k] = 1;
      }
    }
    return radiusByPowers(A, n);
  }

  /* rho(M) = lim ||M^n||^(1/n); repeated squaring reaches n = 4096 in twelve
     multiplications and does not stall on a complex leading pair. */
  function radiusByPowers(M, n) {
    const norm = (X) => {
      let best = 0;
      for (let i = 0; i < n; i++) {
        let row = 0;
        for (let j = 0; j < n; j++) row += Math.abs(X[i][j]);
        if (row > best) best = row;
      }
      return best;
    };
    const mul = (X, Y) => {
      const C = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++)
        for (let k = 0; k < n; k++) {
          const c = X[i][k];
          if (c === 0) continue;
          for (let j = 0; j < n; j++) C[i][j] += c * Y[k][j];
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
    /* the delay is a whole number of samples, so name it and say what that is
       in milliseconds -- the sampling period already carries its own symbol */
    outs.m.textContent = P.m === 0 ? "0"
      : P.m + (P.m > 1 ? " samples" : " sample") + "  \u00b7  " + Math.round(P.m * P.h * 1000) + " ms";

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

  /* ---------- drawing ----------

     The loop sits across the top with the arm living inside its plant block,
     rather than as a separate diagram underneath saying the same thing twice.
     The two records go side by side below it. */

  /* how much of the record the two trails draw: everything for a run that
     settles, and only the recent past for one that never does */
  const TRAIL = 900;

  const D = { w: 0, h: 0 };
  let loopRect = null;
  let panels = [];

  function layout(aspect) {
    if (aspect >= 1.1) {
      D.w = 780; D.h = 620;
      loopRect = { x: 0, y: 0, w: 780, h: 300 };
      panels = [{ x: 0, y: 330, w: 379, h: 290 },
                { x: 401, y: 330, w: 379, h: 290 }];
    } else {
      D.w = 380; D.h = 1010;
      loopRect = { x: 0, y: 0, w: 380, h: 430 };
      panels = [{ x: 0, y: 460, w: 380, h: 265 },
                { x: 0, y: 745, w: 380, h: 265 }];
    }
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

  function inPanel(p, title, body) {
    frameBox(p, title);
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
    ctx.clip();
    body();
    ctx.restore();
  }

  /* ---------- the loop, with the arm inside the plant ---------- */

  function roundBox(x, y, w, h, r = 4) {
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
  }

  function arrow(x1, y1, x2, y2, head = true) {
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
  }

  function cap(text, x, y, size = 10, align = "center", alpha = 0.5) {
    ctx.font = `500 ${size}px "JetBrains Mono", ui-monospace, monospace`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  }

  function words(text, x, y, size = 13, align = "center", alpha = 0.9) {
    ctx.font = `500 ${size}px "Pretendard Variable", Pretendard, system-ui, sans-serif`;
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function maths(text, x, y, size = 14, align = "center", alpha = 0.9) {
    ctx.font = `italic ${size}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function drawLoop(r) {
    const { x, y, w, h } = r;
    const fwd = y + h * 0.30;
    const fbk = y + h * 0.84;
    const jr = Math.min(h * 0.055, 15);
    const jx = x + w * 0.115;

    /* the step it is asked to follow */
    words("Target", x + w * 0.045, fwd - jr - 16, 13);
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.012, fwd + 10);
    ctx.lineTo(x + w * 0.03, fwd + 10);
    ctx.bezierCurveTo(x + w * 0.05, fwd + 10, x + w * 0.05, fwd - 8, x + w * 0.068, fwd - 8);
    ctx.lineTo(x + w * 0.085, fwd - 8);
    ctx.stroke();
    arrow(x + w * 0.085, fwd, jx - jr - 2, fwd);

    /* summing junction */
    ctx.beginPath();
    ctx.arc(jx, fwd, jr, 0, 7);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = INK(0.35); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(jx - jr * 0.5, fwd); ctx.lineTo(jx + jr * 0.5, fwd);
    ctx.moveTo(jx, fwd - jr * 0.5); ctx.lineTo(jx, fwd + jr * 0.5);
    ctx.stroke();
    /* the signs, drawn rather than set */
    ctx.beginPath();
    ctx.moveTo(jx - jr - 14, fwd - jr - 4); ctx.lineTo(jx - jr - 4, fwd - jr - 4);
    ctx.moveTo(jx - jr - 9, fwd - jr - 9); ctx.lineTo(jx - jr - 9, fwd - jr + 1);
    ctx.moveTo(jx - jr - 16, fwd + jr + 8); ctx.lineTo(jx - jr - 6, fwd + jr + 8);
    ctx.stroke();

    /* the controller, with the gains as they stand */
    const cw = w * 0.145, cx0 = x + w * 0.185;
    const chh = Math.min(h * 0.22, 74);
    arrow(jx + jr + 2, fwd, cx0 - 2, fwd);
    roundBox(cx0, fwd - chh / 2, cw, chh);
    cap("PD", cx0 + cw / 2, fwd - chh / 2 - 9);
    maths("K", cx0 + cw * 0.3, fwd - 6, 15, "center");
    maths("p", cx0 + cw * 0.3 + 8, fwd - 2, 10, "center", 0.75);
    words(P.kp.toFixed(0), cx0 + cw * 0.72, fwd - 6, 13);
    maths("K", cx0 + cw * 0.3, fwd + 17, 15, "center");
    maths("d", cx0 + cw * 0.3 + 8, fwd + 21, 10, "center", 0.75);
    words(P.kd.toFixed(1), cx0 + cw * 0.72, fwd + 17, 13);

    /* the plant: the arm itself, in its own frame */
    const px0 = x + w * 0.40, pw = w * 0.34;
    const py0 = y + h * 0.05, ph = h * 0.60;
    maths("\u03c4", (cx0 + cw + px0) / 2, fwd - 8, 15);
    arrow(cx0 + cw + 2, fwd, px0 - 2, fwd);
    roundBox(px0, py0, pw, ph, 5);
    cap("ARM", px0 + pw / 2, py0 - 9);
    drawArm({ x: px0, y: py0, w: pw, h: ph });
    maths("M(q) q\u2033 + c(q, q\u2032) = \u03c4", px0 + pw / 2, py0 + ph - 12, 13, "center", 0.62);

    /* the angle out, and the tap the measurement comes from */
    const qx = x + w * 0.945;
    arrow(px0 + pw + 2, fwd, qx - 26, fwd);
    maths("q", qx, fwd + 5, 16);
    const tap = x + w * 0.855;
    ctx.fillStyle = INK(0.9);
    ctx.beginPath(); ctx.arc(tap, fwd, 3.4, 0, 7); ctx.fill();

    /* the measurement path: a delay, then the sampler, then back */
    const bw = w * 0.165, bh = Math.min(h * 0.16, 52);
    const dx0 = x + w * 0.60, sx0 = x + w * 0.315;
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tap, fwd); ctx.lineTo(tap, fbk); ctx.lineTo(dx0 + bw + 2, fbk);
    ctx.stroke();
    roundBox(dx0, fbk - bh / 2, bw, bh);
    words("Delay", dx0 + bw / 2, fbk - 2, 13);
    if (P.m === 0) {
      maths("m = 0", dx0 + bw / 2, fbk + 16, 12, "center", 0.6);
    } else {
      maths("m = " + P.m, dx0 + bw / 2 - 4, fbk + 16, 12, "right", 0.6);
      words(" \u00b7 " + Math.round(P.m * P.h * 1000) + " ms",
        dx0 + bw / 2 - 2, fbk + 16, 11, "left", 0.55);
    }
    arrow(dx0 - 2, fbk, sx0 + bw + 2, fbk);
    roundBox(sx0, fbk - bh / 2, bw, bh);
    words("Sample", sx0 + bw / 2, fbk - 2, 13);
    maths("h", sx0 + bw / 2 - 16, fbk + 16, 13, "right", 0.6);
    words(" = " + Math.round(P.h * 1000) + " ms", sx0 + bw / 2 - 14, fbk + 16, 11, "left", 0.55);
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx0 - 2, fbk); ctx.lineTo(jx, fbk);
    ctx.stroke();
    arrow(jx, fbk, jx, fwd + jr + 2);
  }

  /* ---------- the arm, drawn wherever it is asked to sit ---------- */

  function drawArm(box) {
    const bx = box.x + box.w * 0.5, by = box.y + box.h * 0.66;
    const L = Math.min(box.w * 0.27, box.h * 0.25);
    const j1 = { x: bx + Math.cos(q[0]) * L, y: by + Math.sin(q[0]) * L };
    const tip = { x: j1.x + Math.cos(q[0] + q[1]) * L, y: j1.y + Math.sin(q[0] + q[1]) * L };

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x + 1.5, box.y + 1.5, box.w - 3, box.h - 3);
    ctx.clip();

    /* where it was sent */
    const t1 = JOINTS[0].to, t2 = JOINTS[1].to;
    const g1 = { x: bx + Math.cos(t1) * L, y: by + Math.sin(t1) * L };
    const g2 = { x: g1.x + Math.cos(t1 + t2) * L, y: g1.y + Math.sin(t1 + t2) * L };
    ctx.strokeStyle = INK(0.22);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(g2.x, g2.y, 4, 0, 7); ctx.stroke();

    /* the path the tip has taken, which two coupled joints make a curve */
    const trail = hist.slice(-TRAIL);
    if (trail.length > 1) {
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const A = trail[i][1], B = trail[i][2];
        const e = { x: bx + Math.cos(A) * L + Math.cos(A + B) * L,
                    y: by + Math.sin(A) * L + Math.sin(A + B) * L };
        i ? ctx.lineTo(e.x, e.y) : ctx.moveTo(e.x, e.y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = INK(0.16);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx - L * 0.5, by); ctx.lineTo(bx + L * 0.5, by); ctx.stroke();

    ctx.strokeStyle = INK(1);
    ctx.lineWidth = Math.max(4, L * 0.11);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(j1.x, j1.y); ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.moveTo(bx - 9, by); ctx.lineTo(bx + 9, by);
    ctx.lineTo(bx + 6, by + 11); ctx.lineTo(bx - 6, by + 11);
    ctx.closePath(); ctx.fill();
    for (const [pt, rr, solid] of [[j1, 4, false], [tip, 4.6, true]]) {
      ctx.fillStyle = solid ? "#0a0a0a" : "#fff";
      ctx.strokeStyle = INK(1);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, rr, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- the two records ---------- */

  /* each joint's error against how fast that error is closing */
  function drawPhase(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + 10;
    /* wide enough for the elbow, which swings further than the shoulder */
    const s = Math.min(p.w, p.h - 30) / 2 / 2.3;
    ctx.strokeStyle = INK(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 10, cy); ctx.lineTo(p.x + p.w - 10, cy);
    ctx.moveTo(cx, p.y + 28); ctx.lineTo(cx, p.y + p.h - 10);
    ctx.stroke();
    cap("error \u2192", p.x + p.w - 12, cy - 7, 9, "right", 0.4);
    cap("rate \u2191", cx + 8, p.y + 38, 9, "left", 0.4);

    for (let j = 0; j < 2; j++) {
      const span = JOINTS[j].to - JOINTS[j].from;
      const ex = (row) => (1 - progress(j, row[1 + j])) * s * (span > 0 ? 1 : -1);
      const ey = (row) => (row[3 + j] / Math.abs(span)) * s * 0.20;
      const pts = hist.slice(-TRAIL);
      ctx.lineWidth = j === 0 ? 1.5 : 1.1;
      for (let i = 1; i < pts.length; i++) {
        const a = i / pts.length;
        ctx.strokeStyle = INK((j === 0 ? 0.08 : 0.05) + a * (j === 0 ? 0.7 : 0.4));
        ctx.beginPath();
        ctx.moveTo(cx + ex(pts[i - 1]), cy - ey(pts[i - 1]));
        ctx.lineTo(cx + ex(pts[i]), cy - ey(pts[i]));
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
    cap("SHOULDER", p.x + 12, p.y + p.h - 24, 9, "left", 0.55);
    cap("ELBOW", p.x + 12, p.y + p.h - 12, 9, "left", 0.32);
  }

  /* Both joints on one angle scale rather than each normalised to its own
     step: normalised, two identical loops draw the same curve twice. */
  const A_TOP = 1.95, A_BOT = -2.5;

  function drawSampled(p) {
    const x0 = p.x + 12, x1 = p.x + p.w - 12;
    const yTop = p.y + 34, yBot = p.y + p.h - 26;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (a) => yTop + ((A_TOP - a) / (A_TOP - A_BOT)) * (yBot - yTop);

    /* the seconds, so the length of the record can be read off it */
    ctx.strokeStyle = INK(0.09);
    ctx.lineWidth = 1;
    for (let t = 5; t < WINDOW; t += 5) {
      ctx.beginPath();
      ctx.moveTo(px(t), yTop); ctx.lineTo(px(t), yBot);
      ctx.stroke();
      cap(t + "s", px(t), yBot + 14, 9, "center", 0.38);
    }

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

      /* the sampled measurement, held: what the controller was handed */
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

    if (settledAt !== null) {
      ctx.strokeStyle = INK(0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px(settledAt), yTop); ctx.lineTo(px(settledAt), yBot);
      ctx.stroke();
      cap("SETTLED", px(settledAt) + 5, yTop + 11, 9, "left", 0.5);
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
    ctx.textBaseline = "alphabetic";

    drawLoop(loopRect);
    inPanel(panels[0], "TRACKING ERROR, JOINT BY JOINT", () => drawPhase(panels[0]));
    inPanel(panels[1], "JOINT ANGLES OVER TIME", () => drawSampled(panels[1]));
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
